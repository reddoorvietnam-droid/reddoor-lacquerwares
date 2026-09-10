import "server-only";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { vndInWords } from "@/lib/money/vietnamese-words";
import {
  codeKey,
  dateSchema,
  decimalSchema,
  emptySlip,
  findItem,
  multiply,
  nameKey,
  type Masters,
  type SalesSlip,
  type SalesSlipLine,
} from "./contracts";

/**
 * Reads `08092026.xlsx`: classifies every sheet by structure (never by name
 * alone), extracts the master lists and each Phiếu bán hàng with its lines,
 * and checks each slip against the workbook's own totals. Nothing here
 * writes to the database; `scripts/import-sales-slips.ts` does that.
 */

export type SheetKind =
  | "template"
  | "invoice"
  | "master"
  | "shippingLabel"
  | "legacyLedger"
  | "helper"
  | "empty";

export type SheetSummary = {
  name: string;
  hidden: boolean;
  kind: SheetKind;
  range: string;
  note: string;
};

export type WorkbookItem = {
  row: number;
  code: string;
  name: string;
  unit: string;
  salePrice: string | null;
};

export type WorkbookRecipient = {
  row: number;
  code: string;
  name: string;
  phone: string;
  address: string;
};

export type ParsedInvoice = {
  sheet: string;
  hidden: boolean;
  slip: SalesSlip;
  excelTotal: string | null;
  computedTotal: string | null;
  difference: string | null;
  issues: string[];
  valid: boolean;
  unknownItems: string[];
  fingerprint: string;
};

export type ImportReport = {
  sourceHash: string;
  sheetCount: number;
  sheetKinds: Record<SheetKind, number>;
  invoiceCandidates: number;
  validInvoices: number;
  needsReview: number;
  totalLines: number;
  unknownItemLines: number;
  amountMismatches: number;
  totalMismatches: number;
  excelTotal: string;
  computedTotal: string;
  difference: string;
  masterItems: number;
  masterItemDuplicates: string[];
  masterRecipients: number;
  warnings: string[];
};

export type ParseResult = {
  hash: string;
  sheets: SheetSummary[];
  items: WorkbookItem[];
  recipients: WorkbookRecipient[];
  invoices: ParsedInvoice[];
  report: ImportReport;
};

export const migrationActor = "sales-workbook-migration";

const invoiceHeaders = [
  "Stt",
  "Mã VT",
  "Vật tư",
  "ĐVT",
  "Số lượng",
  "Giá",
  "Thành tiền",
];

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

/** Excel only guarantees 15 significant digits; normalise cached binary tails. */
function number(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const input =
    typeof value === "number"
      ? String(Number(value.toPrecision(15)))
      : text(value);
  const parsed = decimalSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function cellOf(sheet: XLSX.WorkSheet, row: number, col: number) {
  return sheet[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })] as
    XLSX.CellObject | undefined;
}

function classify(
  sheet: XLSX.WorkSheet,
  name: string,
): { kind: SheetKind; note: string } {
  const a1 = text(cellOf(sheet, 1, 1)?.v);
  const title = text(cellOf(sheet, 4, 1)?.v).toUpperCase();
  const header = Array.from({ length: 7 }, (_, col) =>
    text(cellOf(sheet, 10, col + 1)?.v),
  );
  if (
    title === "PHIẾU BÁN HÀNG" &&
    header.join("|") === invoiceHeaders.join("|")
  )
    return name.toUpperCase() === "HOADONMAU"
      ? { kind: "template", note: "Biểu mẫu gốc; dữ liệu mẫu không nhập." }
      : { kind: "invoice", note: "Phiếu bán hàng thực tế." };
  if (name === "KhoSon")
    return {
      kind: "master",
      note: "Danh mục vật tư + giá bán (named range khoson).",
    };
  if (name === "MaNhaCungCap")
    return {
      kind: "master",
      note: "Danh mục người nhận (named range MaNhaCungCap).",
    };
  if (/^Người (Nhận|nhận|gửi)/.test(a1))
    return {
      kind: "shippingLabel",
      note: "Tem gửi hàng; không phải phiếu bán hàng.",
    };
  if (a1.startsWith("SỔ CHI TIẾT BÁN HÀNG"))
    return {
      kind: "legacyLedger",
      note: "Sổ bán hàng cũ (2017); nghiệp vụ khác, không nhập.",
    };
  const ref = sheet["!ref"];
  if (!ref || ref === "A1:A1") {
    return a1
      ? { kind: "helper", note: "Ghi chú rời." }
      : { kind: "empty", note: "Sheet trống." };
  }
  return { kind: "helper", note: "Bảng phụ không liên quan." };
}

function readDate(label: string): string | null {
  const match = /Ngày\s+(\d{1,2})\s+Tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i.exec(
    label,
  );
  if (!match) return null;
  const value = `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  return dateSchema.safeParse(value).success ? value : null;
}

function readItems(sheet: XLSX.WorkSheet): {
  items: WorkbookItem[];
  duplicates: string[];
} {
  const items: WorkbookItem[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  const end = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:E2").e.r + 1;
  for (let row = 3; row <= end; row++) {
    const code = text(cellOf(sheet, row, 2)?.v);
    if (!code) continue;
    if (seen.has(codeKey(code))) {
      duplicates.push(code);
      continue;
    }
    seen.add(codeKey(code));
    items.push({
      row,
      code,
      name: text(cellOf(sheet, row, 3)?.v),
      unit: text(cellOf(sheet, row, 4)?.v),
      salePrice: number(cellOf(sheet, row, 5)?.v),
    });
  }
  return { items, duplicates };
}

function readRecipients(sheet: XLSX.WorkSheet): WorkbookRecipient[] {
  const recipients: WorkbookRecipient[] = [];
  const seen = new Set<string>();
  const end = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:F5").e.r + 1;
  for (let row = 5; row <= end; row++) {
    const code = text(cellOf(sheet, row, 3)?.v);
    if (!code || seen.has(codeKey(code))) continue;
    seen.add(codeKey(code));
    recipients.push({
      row,
      code,
      name: text(cellOf(sheet, row, 4)?.v),
      phone: text(cellOf(sheet, row, 5)?.v),
      address: text(cellOf(sheet, row, 6)?.v),
    });
  }
  return recipients;
}

const isError = (cell: XLSX.CellObject | undefined) => cell?.t === "e";

function readInvoice(
  sheet: XLSX.WorkSheet,
  name: string,
  hidden: boolean,
  index: number,
  hash: string,
  masters: Masters,
  source: string,
): ParsedInvoice {
  const issues: string[] = [];
  const unknownItems: string[] = [];
  const dateLabel = text(cellOf(sheet, 5, 1)?.v);
  const slipDate = readDate(dateLabel);
  if (!slipDate) issues.push(`Không đọc được ngày từ '${dateLabel}'.`);
  const recipientName = text(cellOf(sheet, 6, 3)?.v);
  if (!recipientName) issues.push("Thiếu người nhận hàng (C6).");
  const unitText = text(cellOf(sheet, 7, 1)?.v).replace(/^Đơn vị:\s*/i, "");
  const unitExtra =
    [4, 5, 6].map((col) => text(cellOf(sheet, 7, col)?.v)).find(Boolean) ?? "";
  const contentText = text(cellOf(sheet, 8, 1)?.v).replace(
    /^Nội dung:\s*/i,
    "",
  );
  const contentExtra =
    [2, 3, 4].map((col) => text(cellOf(sheet, 8, col)?.v)).find(Boolean) ?? "";

  const stamp = cellOf(sheet, 3, 1);
  const createdAt =
    stamp?.v instanceof Date && Number.isFinite(stamp.v.getTime())
      ? stamp.v.toISOString()
      : slipDate
        ? new Date(`${slipDate}T00:00:00+07:00`).toISOString()
        : new Date().toISOString();

  const lines: SalesSlipLine[] = [];
  let row = 11;
  let excelTotalRow: number | null = null;
  while (row < 200) {
    const stt = cellOf(sheet, row, 1);
    if (typeof stt?.v !== "number") {
      if (text(stt?.v).startsWith("Tổng tiền")) excelTotalRow = row;
      break;
    }
    const code = text(cellOf(sheet, row, 2)?.v);
    const quantity = number(cellOf(sheet, row, 5)?.v);
    const priceCell = cellOf(sheet, row, 6);
    const amountCell = cellOf(sheet, row, 7);
    const item = code ? findItem(masters, code) : null;
    const price = isError(priceCell) ? null : number(priceCell?.v);
    const nameCached = isError(cellOf(sheet, row, 3))
      ? ""
      : text(cellOf(sheet, row, 3)?.v);
    const unitCached = isError(cellOf(sheet, row, 4))
      ? ""
      : text(cellOf(sheet, row, 4)?.v);
    const lineNumber = lines.length + 1;
    if (!code)
      issues.push(`Dòng ${lineNumber} (hàng ${row}): thiếu mã vật tư.`);
    else if (!item) {
      unknownItems.push(code);
      issues.push(
        `Dòng ${lineNumber} (hàng ${row}): mã '${code}' không có trong danh mục.`,
      );
    }
    if (quantity === null || !new Decimal(quantity).gt(0))
      issues.push(`Dòng ${lineNumber} (hàng ${row}): số lượng không hợp lệ.`);
    if (price === null)
      issues.push(`Dòng ${lineNumber} (hàng ${row}): không có đơn giá.`);
    const lineAmount = multiply(quantity, price);
    if (isError(amountCell))
      issues.push(
        `Dòng ${lineNumber} (hàng ${row}): thành tiền là lỗi Excel (${String(amountCell?.w ?? "#VALUE!")}).`,
      );
    else {
      const excelAmount = number(amountCell?.v);
      if (
        excelAmount !== null &&
        lineAmount !== null &&
        !new Decimal(excelAmount).eq(lineAmount)
      )
        issues.push(
          `Dòng ${lineNumber} (hàng ${row}): thành tiền Excel ${excelAmount} khác số lượng × giá = ${lineAmount}.`,
        );
    }
    lines.push({
      id: `${index}-${lineNumber}`,
      lineNumber,
      itemId: item?.id ?? null,
      // Exactly as typed on the sheet; the catalogue match is case-insensitive.
      itemCode: code,
      itemName: nameCached || item?.name || "",
      unit: unitCached || item?.unit || "",
      quantity,
      unitPrice: price,
      lineAmount,
      priceManual: priceCell?.f === undefined && price !== null,
    });
    row += 1;
  }
  if (lines.length === 0) issues.push("Phiếu không có dòng hàng nào.");
  const totalCell = excelTotalRow ? cellOf(sheet, excelTotalRow, 7) : undefined;
  const excelTotal =
    totalCell && !isError(totalCell) ? number(totalCell.v) : null;
  const amounts = lines.flatMap((line) =>
    line.lineAmount === null ? [] : [line.lineAmount],
  );
  const computedTotal =
    amounts.length > 0
      ? amounts
          .reduce((sum, amount) => sum.add(amount), new Decimal(0))
          .toFixed()
      : null;
  let difference: string | null = null;
  if (excelTotal === null)
    issues.push("Tổng tiền trong Excel là lỗi hoặc trống.");
  else if (computedTotal === null)
    issues.push("Không tính được tổng tiền từ các dòng.");
  else {
    difference = new Decimal(computedTotal).minus(excelTotal).toFixed();
    if (difference !== "0")
      issues.push(
        `Tổng tiền Excel ${excelTotal} khác tổng tính lại ${computedTotal}.`,
      );
  }

  const valid = issues.length === 0;
  const recipient =
    masters.recipients.find(
      (candidate) => nameKey(candidate.name) === nameKey(recipientName),
    ) ?? null;
  const slip: SalesSlip = {
    ...emptySlip(
      `xlsx_${hash.slice(0, 24)}_${String(index).padStart(3, "0")}`,
      slipDate ?? "1970-01-01",
      migrationActor,
    ),
    recipientId: recipient?.id ?? null,
    recipientCode: recipient?.code ?? "",
    recipientName,
    recipientUnit: unitText || unitExtra,
    content: contentText || contentExtra,
    lines,
    subtotal: computedTotal,
    totalPayment: computedTotal,
    totalInWords: computedTotal === null ? null : vndInWords(computedTotal),
    status: valid ? "CONFIRMED" : "DRAFT",
    sourceType: "MIGRATION",
    migrationSource: source,
    migrationSheet: name,
    migrationIssues: issues,
    confirmedAt: valid ? createdAt : null,
    confirmedBy: valid ? migrationActor : null,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  };
  const fingerprint = createHash("sha256")
    .update(
      [
        slip.slipDate,
        nameKey(recipientName),
        ...lines.map(
          (line) =>
            `${codeKey(line.itemCode)}:${line.quantity}:${line.unitPrice}`,
        ),
      ].join("|"),
    )
    .digest("hex");
  return {
    sheet: name,
    hidden,
    slip,
    excelTotal,
    computedTotal,
    difference,
    issues,
    valid,
    unknownItems,
    fingerprint,
  };
}

/** Workbook items merged over the catalogue: the workbook's sale price wins, new codes are appended. */
export function mergeMasters(
  base: Masters,
  items: readonly WorkbookItem[],
  recipients: readonly WorkbookRecipient[],
): Masters {
  const merged: Masters = {
    items: base.items.map((item) => ({ ...item })),
    recipients: base.recipients.map((recipient) => ({ ...recipient })),
  };
  const itemsByKey = new Map(
    merged.items.map((item) => [codeKey(item.code), item]),
  );
  for (const item of items) {
    const existing = itemsByKey.get(codeKey(item.code));
    if (existing) existing.salePrice = item.salePrice;
    else {
      const created = {
        id: "",
        code: item.code,
        name: item.name,
        unit: item.unit,
        salePrice: item.salePrice,
      };
      itemsByKey.set(codeKey(item.code), created);
      (merged.items as (typeof created)[]).push(created);
    }
  }
  const recipientKeys = new Set(
    merged.recipients.map((recipient) => codeKey(recipient.code)),
  );
  for (const recipient of recipients)
    if (!recipientKeys.has(codeKey(recipient.code)))
      (merged.recipients as { id: string; code: string; name: string }[]).push({
        id: "",
        code: recipient.code,
        name: recipient.name,
      });
  return merged;
}

/** Re-points a parsed slip at catalogue ids once the masters exist in the database. */
export function linkSlip(slip: SalesSlip, masters: Masters): SalesSlip {
  const recipient =
    masters.recipients.find(
      (candidate) => nameKey(candidate.name) === nameKey(slip.recipientName),
    ) ?? null;
  return {
    ...slip,
    recipientId: recipient?.id || null,
    recipientCode: recipient?.code ?? "",
    lines: slip.lines.map((line) => {
      const item = line.itemCode ? findItem(masters, line.itemCode) : null;
      return { ...line, itemId: item?.id || null };
    }),
  };
}

export function parseSalesWorkbook(
  bytes: Uint8Array,
  baseMasters: Masters,
  source = "08092026.xlsx",
): ParseResult {
  const hash = createHash("sha256").update(bytes).digest("hex");
  const book = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
    cellFormula: true,
  });
  const hiddenOf = (index: number) =>
    (book.Workbook?.Sheets?.[index]?.Hidden ?? 0) !== 0;

  const khoSon = book.Sheets.KhoSon;
  const maNhaCungCap = book.Sheets.MaNhaCungCap;
  if (!khoSon) throw new Error("Thiếu sheet KhoSon.");
  if (!maNhaCungCap) throw new Error("Thiếu sheet MaNhaCungCap.");
  const { items, duplicates } = readItems(khoSon);
  const recipients = readRecipients(maNhaCungCap);
  const masters = mergeMasters(baseMasters, items, recipients);

  const sheets: SheetSummary[] = [];
  const invoices: ParsedInvoice[] = [];
  book.SheetNames.forEach((name, index) => {
    const sheet = book.Sheets[name];
    if (!sheet) return;
    const { kind, note } = classify(sheet, name);
    const hidden = hiddenOf(index);
    sheets.push({ name, hidden, kind, range: sheet["!ref"] ?? "", note });
    if (kind === "invoice")
      invoices.push(
        readInvoice(sheet, name, hidden, index, hash, masters, source),
      );
  });

  const sheetKinds: Record<SheetKind, number> = {
    template: 0,
    invoice: 0,
    master: 0,
    shippingLabel: 0,
    legacyLedger: 0,
    helper: 0,
    empty: 0,
  };
  for (const sheet of sheets) sheetKinds[sheet.kind] += 1;
  const sum = (values: (string | null)[]) =>
    values
      .reduce(
        (total, value) => (value === null ? total : total.add(value)),
        new Decimal(0),
      )
      .toFixed();
  const excelTotal = sum(invoices.map((invoice) => invoice.excelTotal));
  const computedTotal = sum(invoices.map((invoice) => invoice.computedTotal));
  const warnings: string[] = [];
  if (duplicates.length)
    warnings.push(
      `KhoSon: mã trùng ${duplicates.join(", ")}; giữ lần xuất hiện đầu theo VLOOKUP.`,
    );
  for (const invoice of invoices)
    if (invoice.hidden)
      warnings.push(
        `Sheet ẩn '${invoice.sheet}' vẫn là phiếu bán hàng; đã đọc.`,
      );
  return {
    hash,
    sheets,
    items,
    recipients,
    invoices,
    report: {
      sourceHash: hash,
      sheetCount: sheets.length,
      sheetKinds,
      invoiceCandidates: invoices.length,
      validInvoices: invoices.filter((invoice) => invoice.valid).length,
      needsReview: invoices.filter((invoice) => !invoice.valid).length,
      totalLines: invoices.reduce(
        (total, invoice) => total + invoice.slip.lines.length,
        0,
      ),
      unknownItemLines: invoices.reduce(
        (total, invoice) => total + invoice.unknownItems.length,
        0,
      ),
      amountMismatches: invoices.reduce(
        (total, invoice) =>
          total +
          invoice.issues.filter((issue) => issue.includes("thành tiền Excel"))
            .length,
        0,
      ),
      totalMismatches: invoices.filter(
        (invoice) => invoice.difference !== null && invoice.difference !== "0",
      ).length,
      excelTotal,
      computedTotal,
      difference: new Decimal(computedTotal).minus(excelTotal).toFixed(),
      masterItems: items.length,
      masterItemDuplicates: duplicates,
      masterRecipients: recipients.length,
      warnings,
    },
  };
}
