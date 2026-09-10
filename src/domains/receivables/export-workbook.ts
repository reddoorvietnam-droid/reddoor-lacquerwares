import "server-only";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { createZip, type ZipEntry } from "@/domains/sample-progress/zip";
import {
  displayDate,
  type ExportScope,
  type ReceivableEntry,
  type SummaryRow,
  type SummaryTotals,
} from "./contracts";
import rawLayout from "./layout.json";

/**
 * Fills the checked-in template (`assets/receivables-template.xlsx`: the three
 * business sheets of the source workbook, formatting kept, data removed) so the
 * export opens exactly like the file the accountant has always used — same
 * title, merges, column widths, number formats, freeze panes, print area and
 * signature block.
 *
 * Cells are written as literal values only. The SUMIF and VLOOKUP formulas that
 * once derived the movement columns are replaced by what the server already
 * computed, so an exported file can never disagree with the screen and can
 * never recompute itself into a different number.
 */

export type ExportInput = {
  scope: ExportScope;
  summary: SummaryRow[];
  totals: SummaryTotals;
  sales: ReceivableEntry[];
  reductions: ReceivableEntry[];
  window: { from: string | null; to: string | null };
  preparedBy: string;
  generatedAt: Date;
};

type SheetName = "TongHopCongNo" | "ChiTietBanHang" | "ThanhToan";

const scopeSheets: Record<ExportScope, SheetName[]> = {
  all: ["TongHopCongNo", "ChiTietBanHang", "ThanhToan"],
  summary: ["TongHopCongNo"],
  sales: ["ChiTietBanHang"],
  reductions: ["ThanhToan"],
};

export const exportFileNames: Record<ExportScope, string> = {
  all: "CONG-NO-2026.xlsx",
  summary: "TONG-HOP-CONG-NO.xlsx",
  sales: "SO-CHI-TIET-BAN-HANG.xlsx",
  reductions: "BANG-THANH-TOAN.xlsx",
};

/**
 * `Xuất sổ công nợ` for one customer: the same three sheets, restricted to that
 * customer, which is what gets sent out for a debt reconciliation. ASCII-folded
 * so the filename survives every mail client and file system.
 */
export const statementFileName = (code: string) =>
  `CONG-NO-${
    code
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase() || "KHACH"
  }.xlsx`;

const layout = rawLayout;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Reads only our checked-in template, never an uploaded archive. */
function templateEntries(bytes: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let at = 0;
  while (at + 30 <= bytes.length && bytes.readUInt32LE(at) === 0x04034b50) {
    const method = bytes.readUInt16LE(at + 8);
    const size = bytes.readUInt32LE(at + 18);
    const nameLength = bytes.readUInt16LE(at + 26);
    const extra = bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 30, at + 30 + nameLength).toString("utf8");
    const start = at + 30 + nameLength + extra;
    const payload = bytes.subarray(start, start + size);
    entries.push({
      name,
      data: method === 8 ? inflateRawSync(payload) : payload,
    });
    at = start + size;
  }
  return entries;
}

/** XML 1.0 forbids most control characters; tab and newline must survive. */
const xml = (value: string) =>
  value
    .replace(/\r\n?/g, "\n")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const column = (index: number) => {
  let rest = index;
  let letters = "";
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - remainder - 1) / 26);
  }
  return letters;
};

/** Excel 1900 serial for a calendar date (epoch 1899-12-30, UTC). */
export const excelSerial = (iso: string) =>
  Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000,
  );

type CellValue =
  | { kind: "text"; value: string }
  | { kind: "number"; value: string | null }
  | { kind: "date"; value: string };

const cellXml = (address: string, style: number, cell: CellValue) => {
  const attrs = `r="${address}" s="${style}"`;
  if (cell.kind === "date")
    return `<c ${attrs}><v>${excelSerial(cell.value)}</v></c>`;
  if (cell.kind === "number")
    return cell.value === null || cell.value === ""
      ? `<c ${attrs}/>`
      : `<c ${attrs}><v>${xml(cell.value)}</v></c>`;
  if (cell.value === "") return `<c ${attrs}/>`;
  // Inline strings cannot execute a pasted =formula or an external link.
  return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
};

const text = (value: string): CellValue => ({ kind: "text", value });
const number = (value: string | null): CellValue => ({ kind: "number", value });
const date = (value: string): CellValue => ({ kind: "date", value });

/** px from the source workbook → pt, the unit `ht` expects. */
const pt = (px: number) => Math.round(px * 75) / 100;

function rowXml(
  r: number,
  heightPx: number,
  firstColumn: number,
  styles: readonly number[],
  cells: readonly CellValue[],
): string {
  const body = cells
    .map((cell, index) =>
      cellXml(`${column(firstColumn + index)}${r}`, styles[index] ?? 0, cell),
    )
    .join("");
  return `<row r="${r}" ht="${pt(heightPx)}" customHeight="1">${body}</row>`;
}

/** Rows the template keeps above the data: titles and headers. */
function headerRows(original: string, firstDataRow: number): string {
  return [...original.matchAll(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g)]
    .filter((match) => {
      const r = /\br="(\d+)"/.exec(match[0]);
      return r !== null && Number(r[1]) < firstDataRow;
    })
    .map((match) => match[0])
    .join("");
}

function replaceSheetData(
  original: string,
  body: string,
  dimension: string,
  extraMerges: readonly string[],
): string {
  let next = original
    .replace(
      /<sheetData>[\s\S]*?<\/sheetData>|<sheetData\s*\/>/,
      `<sheetData>${body}</sheetData>`,
    )
    .replace(/<dimension ref="[^"]*"\s*\/>/, `<dimension ref="${dimension}"/>`);
  if (extraMerges.length) {
    const merges = extraMerges
      .map((ref) => `<mergeCell ref="${ref}"/>`)
      .join("");
    // Element order matters: sheetData, then mergeCells.
    next = /<mergeCells count="\d+">/.test(next)
      ? next.replace(
          /<mergeCells count="(\d+)">([\s\S]*?)<\/mergeCells>/,
          (_, count: string, inner: string) =>
            `<mergeCells count="${Number(count) + extraMerges.length}">${inner}${merges}</mergeCells>`,
        )
      : next.replace(
          "</sheetData>",
          `</sheetData><mergeCells count="${extraMerges.length}">${merges}</mergeCells>`,
        );
  }
  return next;
}

const generatedDate = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);

const periodNote = (window: { from: string | null; to: string | null }) => {
  if (window.from && window.to)
    return `Kỳ báo cáo: ${displayDate(window.from)} - ${displayDate(window.to)}`;
  if (window.to) return `Số liệu tính đến ngày ${displayDate(window.to)}`;
  if (window.from) return `Số liệu từ ngày ${displayDate(window.from)}`;
  return "";
};

// ---------------------------------------------------------------- sheets

/**
 * `TongHopCongNo`: the report the accountant prints. Columns C..K exactly as
 * the source, then the total line and the untouched signature block.
 */
function summarySheet(original: string, input: ExportInput): string {
  const spec = layout.summary;
  const firstRow = 3;
  const head = headerRows(original, firstRow);
  const rows = input.summary.map((row, index) =>
    rowXml(firstRow + index, spec.heights.data, 3, spec.styles.data, [
      number(String(row.stt)),
      text(row.code),
      text(row.name),
      text(row.phone),
      number(row.opening),
      number(row.increase),
      number(row.decrease),
      number(row.closing),
      text(row.note),
    ]),
  );
  const last = Math.max(firstRow, firstRow + input.summary.length - 1);
  const totalRow = last + 1;
  const merges = [`C${totalRow}:D${totalRow}`];
  const footer = [
    rowXml(totalRow, spec.heights.data, 3, spec.styles.data, [
      text("Cộng tổng"),
      text(""),
      text(""),
      text(""),
      number(input.totals.opening),
      number(input.totals.increase),
      number(input.totals.decrease),
      number(input.totals.closing),
      text(periodNote(input.window)),
    ]),
  ];
  // The source keeps a blank row, then "Ngày lập báo cáo" and the three
  // signatures. Reproduced with the same styles so a printed page is unchanged.
  const [dateRow, signRow] = spec.rowsAfterTable;
  if (dateRow)
    footer.push(
      rowXml(totalRow + 2, dateRow.height, 3, dateRow.styles, [
        text(""),
        text(""),
        text(""),
        text(""),
        text(""),
        text(""),
        text("Ngày lập báo cáo"),
        text(displayDate(generatedDate(input.generatedAt))),
        text(""),
      ]),
    );
  if (signRow)
    footer.push(
      rowXml(totalRow + 3, signRow.height, 3, signRow.styles, [
        text(""),
        text(input.preparedBy ? `Người lập: ${input.preparedBy}` : "Người lập"),
        text(""),
        text(""),
        text("Phụ trách kế toán"),
        text(""),
        text(""),
        text(""),
        text("Giám đốc"),
      ]),
    );
  return replaceSheetData(
    original,
    head + rows.join("") + footer.join(""),
    `A1:K${totalRow + 3}`,
    merges,
  );
}

/** `ChiTietBanHang`: every debit line behind `Phát sinh tăng`. */
function salesSheet(original: string, input: ExportInput): string {
  const spec = layout.sales;
  const firstRow = 4;
  const head = headerRows(original, firstRow);
  const rows = input.sales.map((entry, index) =>
    rowXml(firstRow + index, spec.heights.data, 1, spec.styles.data, [
      date(entry.entryDate),
      text(entry.customerCode),
      text(entry.customerName),
      text(entry.customerPhone),
      text(entry.documentNumber),
      text(entry.itemCode),
      text(entry.itemName),
      text(entry.description),
      text(entry.unit),
      number(entry.quantity),
      number(entry.unitPrice),
      number(entry.amount),
      text(entry.note),
    ]),
  );
  const last = Math.max(firstRow, firstRow + input.sales.length - 1);
  return replaceSheetData(original, head + rows.join(""), `A1:M${last}`, []);
}

/** `ThanhToan`: every credit line behind `Phát sinh giảm`. */
function reductionsSheet(original: string, input: ExportInput): string {
  const spec = layout.payments;
  const firstRow = 3;
  const head = headerRows(original, firstRow);
  const rows = input.reductions.map((entry, index) =>
    rowXml(firstRow + index, spec.heights.data, 1, spec.styles.data, [
      date(entry.entryDate),
      text(entry.documentNumber),
      text(entry.customerCode),
      text(entry.customerName),
      text(entry.customerPhone),
      // The legacy wording is the one the accountant recognises; the mapped
      // type follows it so nothing is lost and nothing is invented.
      text(entry.legacyDescription || entry.description),
      number(entry.amount),
      text(entry.note),
    ]),
  );
  const last = Math.max(firstRow, firstRow + input.reductions.length - 1);
  return replaceSheetData(original, head + rows.join(""), `A1:H${last}`, []);
}

// ---------------------------------------------------------------- assembly

const sheetBuilders: Record<
  SheetName,
  (original: string, input: ExportInput) => string
> = {
  TongHopCongNo: summarySheet,
  ChiTietBanHang: salesSheet,
  ThanhToan: reductionsSheet,
};

/** Sheet order inside the template archive, so `sheetN.xml` maps correctly. */
const templateOrder: SheetName[] = [
  "ChiTietBanHang",
  "ThanhToan",
  "TongHopCongNo",
];

export async function buildWorkbook(input: ExportInput): Promise<Uint8Array> {
  const bytes = await readFile("assets/receivables-template.xlsx");
  const entries = templateEntries(bytes);
  const wanted = new Set(scopeSheets[input.scope]);

  const kept: ZipEntry[] = entries.map((entry) => {
    const match = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(entry.name);
    if (!match) return entry;
    const name = templateOrder[Number(match[1]) - 1];
    if (!name || !wanted.has(name)) return entry;
    const original = decoder.decode(entry.data);
    return {
      name: entry.name,
      data: encoder.encode(sheetBuilders[name](original, input)),
    };
  });
  return createZip(kept, input.generatedAt);
}
