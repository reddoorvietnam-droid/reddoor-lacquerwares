import "server-only";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { ClientSession } from "mongodb";
import * as XLSX from "xlsx";
import type { AuditActor } from "@/domains/audit/contracts";
import { appendAuditEventWithSession } from "@/domains/audit/mongo-repository";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  applyTransactionPatch,
  codeKey,
  dateSchema,
  decimalSchema,
  defaultDescription,
  emptyTransaction,
  findFacility,
  findMaterial,
  MaterialsError,
  multiply,
  parseDisplayDate,
  positiveDecimalSchema,
  transactionCompleteness,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportResult,
  type ImportRowStatus,
  type Lookups,
  type MaterialTransaction,
} from "./contracts";
import {
  getMaterialModel,
  getMaterialTransactionModel,
  type StoredTransaction,
} from "./models";
import {
  fingerprintOf,
  readBalances,
  readLookups,
  toStoredTransaction,
} from "./service";

/**
 * Reads `RedDoor - NVL - 2026.xlsx` (and any workbook laid out the same way)
 * the way Excel evaluated it: cached formula values, VLOOKUP-style code
 * matching, calendar dates without time-zone drift.
 */

export const ledgerSheets = ["ChiTietNhapNVL", "ChiTietxuatNVL"] as const;
export type LedgerSheet = (typeof ledgerSheets)[number];

export type Issue = {
  sheet: string;
  row: number;
  kind: string;
  message: string;
};

export type ParsedMaterial = {
  sourceRow: number;
  code: string;
  name: string;
  unit: string;
  /** KhoNVL columns E/F carry stray numbers; reported, never migrated. */
  columnE: string | null;
  columnF: string | null;
};

export type ParsedFacility = {
  sourceRow: number;
  type: string;
  code: string;
  name: string;
  phone: string;
  note: string;
};

export type ParsedSummaryRow = {
  sourceRow: number;
  code: string;
  name: string;
  unit: string;
  opening: string;
  note: string;
  excelInbound: string | null;
  excelOutbound: string | null;
  excelClosing: string | null;
};

export type ParsedTransaction = {
  sheet: LedgerSheet;
  sourceRow: number;
  importKey: string;
  migrationSource: string;
  type: "INBOUND" | "OUTBOUND";
  transactionDate: string;
  materialCode: string;
  facilityCode: string;
  description: string;
  quantity: string;
  unitPrice: string | null;
  amount: string | null;
  note: string;
};

export type LedgerReport = {
  /** Rows carrying at least one typed value inside the table (A:I). */
  candidateRows: number;
  transactions: number;
  partial: number;
  formulaOnly: number;
  empty: number;
  whitespaceOnly: number;
  /** Rows whose only values sit in the helper columns J:L. */
  helperOnly: number;
  cellsOutsideTable: number;
};

export type ParsedWorkbook = {
  hash: string;
  fileName: string;
  materials: ParsedMaterial[];
  facilities: ParsedFacility[];
  summary: ParsedSummaryRow[];
  transactions: ParsedTransaction[];
  issues: Issue[];
  warnings: Issue[];
  report: {
    materials: {
      sourceRows: number;
      duplicates: number;
      whitespaceCodes: string[];
      duplicateNames: Record<string, number>;
      columnEValues: Record<string, string>;
      columnFValues: Record<string, string>;
    };
    facilities: { sourceRows: number; duplicates: number };
    summary: { rows: number; duplicateCodes: string[] };
    inbound: LedgerReport;
    outbound: LedgerReport;
  };
};

type Cell = XLSX.CellObject | undefined;

const cellAt = (sheet: XLSX.WorkSheet, row: number, col: number): Cell =>
  sheet[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })] as Cell;

const lastRow = (sheet: XLSX.WorkSheet): number =>
  XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1").e.r + 1;

const isBlank = (value: unknown) =>
  value === undefined || value === null || value === "";

const text = (cell: Cell): string =>
  cell === undefined || isBlank(cell.v) ? "" : String(cell.v);

/** A value the user typed, as opposed to a formula result. */
const isLiteral = (cell: Cell): cell is XLSX.CellObject =>
  cell !== undefined && cell.f === undefined && !isBlank(cell.v);

const isWhitespace = (cell: Cell) =>
  isLiteral(cell) && typeof cell.v === "string" && cell.v.trim() === "";

const hasValue = (cell: Cell) => cell !== undefined && !isBlank(cell.v);

/** Excel keeps 15 significant digits; the cached binary tail is noise. */
export const excelNumber = (value: number): string =>
  new Decimal(Number(value.toPrecision(15))).toFixed();

/** Number cell (cached value for formulas) → canonical decimal; null when blank; undefined when not numeric. */
function numberOf(cell: Cell): string | null | undefined {
  if (cell === undefined || isBlank(cell.v)) return null;
  if (typeof cell.v === "number")
    return Number.isFinite(cell.v) ? excelNumber(cell.v) : undefined;
  if (typeof cell.v === "string") {
    const trimmed = cell.v.trim().replaceAll(",", "");
    return /^-?\d+(?:\.\d+)?$/.test(trimmed)
      ? excelNumber(Number(trimmed))
      : undefined;
  }
  return undefined;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Date cell → `YYYY-MM-DD`; SheetJS dates are UTC midnight, serials go through SSF. */
function dateOf(cell: Cell): string | null {
  if (cell === undefined || isBlank(cell.v)) return null;
  const value = cell.v;
  let candidate: string | null = null;
  if (value instanceof Date) candidate = value.toISOString().slice(0, 10);
  else if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) candidate = `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  } else if (typeof value === "string") {
    try {
      candidate = parseDisplayDate(value);
    } catch {
      candidate = null;
    }
  }
  return candidate && dateSchema.safeParse(candidate).success
    ? candidate
    : null;
}

const normalizeText = (value: string) => value.normalize("NFC").trim();

type LedgerColumns = {
  date: number;
  materialCode: number;
  facilityCode: number | null;
  description: number;
  quantity: number;
  unitPrice: number | null;
  amount: number | null;
  note: number;
};

const ledgerColumns: Record<LedgerSheet, LedgerColumns> = {
  ChiTietNhapNVL: {
    date: 1,
    materialCode: 2,
    facilityCode: null,
    description: 4,
    quantity: 6,
    unitPrice: 7,
    amount: 8,
    note: 9,
  },
  ChiTietxuatNVL: {
    date: 1,
    facilityCode: 2,
    materialCode: 4,
    description: 6,
    quantity: 8,
    unitPrice: null,
    amount: null,
    note: 9,
  },
};

const tableWidth = 9;
const helperColumns = [10, 11, 12];

const emptyLedgerReport = (): LedgerReport => ({
  candidateRows: 0,
  transactions: 0,
  partial: 0,
  formulaOnly: 0,
  empty: 0,
  whitespaceOnly: 0,
  helperOnly: 0,
  cellsOutsideTable: 0,
});

export type ParseOptions = {
  fileName?: string;
  /** The migration needs every sheet; a storekeeper's upload may carry a ledger alone. */
  requireMasters?: boolean;
};

export function parseMaterialsWorkbook(
  bytes: Uint8Array,
  options: ParseOptions = {},
): ParsedWorkbook {
  const fileName = options.fileName ?? "workbook.xlsx";
  const hash = createHash("sha256").update(bytes).digest("hex");
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      cellFormula: true,
      sheets: [...ledgerSheets, "Tong kho NVL", "KhoNVL", "Cososx"],
    });
  } catch {
    throw new MaterialsError("Không đọc được tệp Excel; cần tệp .xlsx hợp lệ.");
  }
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const sheetOf = (name: string, required: boolean): XLSX.WorkSheet | null => {
    const sheet = book.Sheets[name];
    if (!sheet && required)
      throw new MaterialsError(`Thiếu sheet ${name} trong tệp Excel.`);
    return sheet ?? null;
  };
  const requireMasters = options.requireMasters ?? false;
  const catalog = sheetOf("KhoNVL", requireMasters);
  const summarySheet = sheetOf("Tong kho NVL", requireMasters);
  const facilitySheet = sheetOf("Cososx", requireMasters);
  const inboundSheet = sheetOf("ChiTietNhapNVL", false);
  const outboundSheet = sheetOf("ChiTietxuatNVL", false);
  if (!inboundSheet && !outboundSheet)
    throw new MaterialsError(
      "Tệp không có sheet ChiTietNhapNVL hoặc ChiTietxuatNVL.",
    );

  // ---- KhoNVL: the canonical material list (VLOOKUP keeps the first match)
  const materials: ParsedMaterial[] = [];
  const materialReport = {
    sourceRows: 0,
    duplicates: 0,
    whitespaceCodes: [] as string[],
    duplicateNames: {} as Record<string, number>,
    columnEValues: {} as Record<string, string>,
    columnFValues: {} as Record<string, string>,
  };
  if (catalog) {
    const seen = new Set<string>();
    const names = new Map<string, number>();
    for (let r = 3; r <= lastRow(catalog); r++) {
      const rawCode = text(cellAt(catalog, r, 2));
      const code = rawCode.trim();
      if (!code) continue;
      materialReport.sourceRows += 1;
      if (rawCode !== code) materialReport.whitespaceCodes.push(rawCode);
      if (seen.has(codeKey(code))) {
        materialReport.duplicates += 1;
        warnings.push({
          sheet: "KhoNVL",
          row: r,
          kind: "duplicate-code",
          message: `Mã ${code} lặp lại; giữ dòng đầu tiên như VLOOKUP.`,
        });
        continue;
      }
      seen.add(codeKey(code));
      const name = text(cellAt(catalog, r, 3)).trim();
      const unit = text(cellAt(catalog, r, 4)).trim();
      const columnE = text(cellAt(catalog, r, 5)).trim() || null;
      const columnF = text(cellAt(catalog, r, 6)).trim() || null;
      if (columnE) materialReport.columnEValues[code] = columnE;
      if (columnF) materialReport.columnFValues[code] = columnF;
      if (name) names.set(codeKey(name), (names.get(codeKey(name)) ?? 0) + 1);
      materials.push({ sourceRow: r, code, name, unit, columnE, columnF });
    }
    for (const [name, count] of names)
      if (count > 1) materialReport.duplicateNames[name] = count;
  }

  // ---- Tong kho NVL: opening balances and the cached totals to reconcile against
  const summary: ParsedSummaryRow[] = [];
  const summaryReport = { rows: 0, duplicateCodes: [] as string[] };
  if (summarySheet) {
    const seen = new Set<string>();
    for (let r = 4; r <= lastRow(summarySheet); r++) {
      if (
        normalizeText(text(cellAt(summarySheet, r, 3))).toLowerCase() === "tổng"
      )
        break;
      const code = text(cellAt(summarySheet, r, 4)).trim();
      if (!code) continue;
      // Blank → 0 (the sheet leaves untouched rows empty); text or a
      // negative number is a real error, never a silent zero.
      const openingCell = numberOf(cellAt(summarySheet, r, 7));
      const opening = openingCell ?? "0";
      const parsedOpening = decimalSchema.safeParse(opening);
      if (openingCell === undefined || !parsedOpening.success) {
        issues.push({
          sheet: "Tong kho NVL",
          row: r,
          kind: "invalid-opening",
          message: `Tồn đầu của ${code} không phải số hợp lệ.`,
        });
        continue;
      }
      if (seen.has(codeKey(code))) {
        summaryReport.duplicateCodes.push(code);
        warnings.push({
          sheet: "Tong kho NVL",
          row: r,
          kind: "duplicate-code",
          message: `Mã ${code} xuất hiện hai lần trong Tong kho; tồn đầu lấy dòng đầu tiên.`,
        });
      }
      seen.add(codeKey(code));
      summaryReport.rows += 1;
      summary.push({
        sourceRow: r,
        code,
        name: text(cellAt(summarySheet, r, 5)).trim(),
        unit: text(cellAt(summarySheet, r, 6)).trim(),
        opening: parsedOpening.data,
        note: text(cellAt(summarySheet, r, 11)).trim(),
        excelInbound: numberOf(cellAt(summarySheet, r, 8)) ?? null,
        excelOutbound: numberOf(cellAt(summarySheet, r, 9)) ?? null,
        excelClosing: numberOf(cellAt(summarySheet, r, 10)) ?? null,
      });
    }
  }

  // ---- Cososx
  const facilities: ParsedFacility[] = [];
  const facilityReport = { sourceRows: 0, duplicates: 0 };
  if (facilitySheet) {
    const seen = new Set<string>();
    for (let r = 5; r <= lastRow(facilitySheet); r++) {
      const code = text(cellAt(facilitySheet, r, 3)).trim();
      if (!code) continue;
      facilityReport.sourceRows += 1;
      if (seen.has(codeKey(code))) {
        facilityReport.duplicates += 1;
        warnings.push({
          sheet: "Cososx",
          row: r,
          kind: "duplicate-code",
          message: `Mã cơ sở ${code} lặp lại; giữ dòng đầu tiên.`,
        });
        continue;
      }
      seen.add(codeKey(code));
      const phone = text(cellAt(facilitySheet, r, 5)).trim();
      facilities.push({
        sourceRow: r,
        type: text(cellAt(facilitySheet, r, 2)).trim(),
        code,
        name: text(cellAt(facilitySheet, r, 4)).trim(),
        phone: phone === "0" ? "" : phone,
        note: text(cellAt(facilitySheet, r, 6)).trim(),
      });
    }
  }

  // ---- ledgers
  const transactions: ParsedTransaction[] = [];
  const ledgerReports = {
    inbound: emptyLedgerReport(),
    outbound: emptyLedgerReport(),
  };
  const ledgers: [LedgerSheet, XLSX.WorkSheet | null, LedgerReport][] = [
    ["ChiTietNhapNVL", inboundSheet, ledgerReports.inbound],
    ["ChiTietxuatNVL", outboundSheet, ledgerReports.outbound],
  ];
  for (const [sheetName, sheet, report] of ledgers) {
    if (!sheet) continue;
    const columns = ledgerColumns[sheetName];
    const type = sheetName === "ChiTietNhapNVL" ? "INBOUND" : "OUTBOUND";
    const yearMatch = /NĂM\s+(\d{4})/iu.exec(
      normalizeText(text(cellAt(sheet, 1, 1))),
    );
    const expectedYear = yearMatch ? yearMatch[1] : null;
    for (let r = 4; r <= lastRow(sheet); r++) {
      const table = Array.from({ length: tableWidth }, (_, c) =>
        cellAt(sheet, r, c + 1),
      );
      const helpers = helperColumns
        .map((c) => ({ col: c, cell: cellAt(sheet, r, c) }))
        .filter(({ cell }) => hasValue(cell));
      if (helpers.length) {
        report.cellsOutsideTable += helpers.length;
        warnings.push({
          sheet: sheetName,
          row: r,
          kind: "cell-outside-table",
          message: `Ô ngoài bảng bị bỏ qua: ${helpers
            .map(({ col }) => XLSX.utils.encode_cell({ r: r - 1, c: col - 1 }))
            .join(", ")}.`,
        });
      }
      const literals = table.filter(isLiteral);
      if (!literals.some((cell) => !isWhitespace(cell))) {
        if (literals.length) report.whitespaceOnly += 1;
        else if (table.some((cell) => cell?.f !== undefined))
          report.formulaOnly += 1;
        else if (helpers.length) report.helperOnly += 1;
        else report.empty += 1;
        continue;
      }
      report.candidateRows += 1;
      const problems: string[] = [];
      const transactionDate = dateOf(cellAt(sheet, r, columns.date));
      if (!transactionDate) problems.push("cột A không phải ngày");
      const materialCode = text(cellAt(sheet, r, columns.materialCode)).trim();
      if (!materialCode) problems.push("thiếu mã vật tư");
      const facilityCode =
        columns.facilityCode === null
          ? ""
          : text(cellAt(sheet, r, columns.facilityCode)).trim();
      if (columns.facilityCode !== null && !facilityCode)
        problems.push("thiếu mã cơ sở SX");
      const rawQuantity = numberOf(cellAt(sheet, r, columns.quantity));
      const quantity =
        rawQuantity === null || rawQuantity === undefined
          ? null
          : positiveDecimalSchema.safeParse(rawQuantity);
      if (!quantity) problems.push("thiếu số lượng");
      else if (!quantity.success) problems.push("số lượng phải lớn hơn 0");
      const unitPrice =
        columns.unitPrice === null
          ? null
          : numberOf(cellAt(sheet, r, columns.unitPrice));
      // Same rule as the grid: non-negative, at most 8 decimals.
      if (
        unitPrice === undefined ||
        (unitPrice !== null && !decimalSchema.safeParse(unitPrice).success)
      )
        problems.push("đơn giá không hợp lệ");
      const amount =
        columns.amount === null
          ? null
          : numberOf(cellAt(sheet, r, columns.amount));
      if (
        amount === undefined ||
        (amount !== null && !decimalSchema.safeParse(amount).success)
      )
        problems.push("thành tiền không hợp lệ");
      if (problems.length || !transactionDate || !quantity?.success) {
        report.partial += 1;
        issues.push({
          sheet: sheetName,
          row: r,
          kind: "partial",
          message: `Dòng chưa đủ dữ liệu giao dịch: ${problems.join(", ")}.`,
        });
        continue;
      }
      if (expectedYear && !transactionDate.startsWith(expectedYear))
        warnings.push({
          sheet: sheetName,
          row: r,
          kind: "date-outside-year",
          message: `Ngày ${transactionDate
            .split("-")
            .reverse()
            .join("/")} nằm ngoài năm ${expectedYear}; vẫn được nhập.`,
        });
      const price = unitPrice === undefined ? null : unitPrice;
      const cachedAmount = amount === undefined ? null : amount;
      if (
        cachedAmount !== null &&
        multiply(quantity.data, price) !== cachedAmount
      )
        warnings.push({
          sheet: sheetName,
          row: r,
          kind: "amount-mismatch",
          message: `Thành tiền ${cachedAmount} khác Số lượng × Đơn giá; hệ thống tính lại.`,
        });
      report.transactions += 1;
      transactions.push({
        sheet: sheetName,
        sourceRow: r,
        importKey: `${hash}:${sheetName}:${r}`,
        migrationSource: fileName,
        type,
        transactionDate,
        materialCode,
        facilityCode,
        description:
          text(cellAt(sheet, r, columns.description)).trim() ||
          defaultDescription[type],
        quantity: quantity.data,
        unitPrice: price,
        amount: cachedAmount,
        note: text(cellAt(sheet, r, columns.note)).trim(),
      });
    }
  }

  return {
    hash,
    fileName,
    materials,
    facilities,
    summary,
    transactions,
    issues,
    warnings,
    report: {
      materials: materialReport,
      facilities: facilityReport,
      summary: summaryReport,
      inbound: ledgerReports.inbound,
      outbound: ledgerReports.outbound,
    },
  };
}

// ---------------------------------------------------------------- preview

export type RowDecision = {
  status: Extract<
    ImportRowStatus,
    "valid" | "invalid" | "unknown-material" | "unknown-facility"
  >;
  message: string | null;
};

/** Master-data check shared by the web preview and the migration script. */
export function classifyTransaction(
  row: Pick<ParsedTransaction, "type" | "materialCode" | "facilityCode">,
  lookups: Lookups,
): RowDecision {
  const material = findMaterial(lookups, row.materialCode);
  if (!material)
    return {
      status: "unknown-material",
      message: `Mã vật tư "${row.materialCode}" không có trong danh mục.`,
    };
  if (!material.active)
    return {
      status: "invalid",
      message: `Vật tư "${material.code}" đã ngừng sử dụng.`,
    };
  if (row.type === "OUTBOUND") {
    const facility = findFacility(lookups, row.facilityCode);
    if (!facility)
      return {
        status: "unknown-facility",
        message: `Mã cơ sở SX "${row.facilityCode}" không có trong danh mục.`,
      };
    if (!facility.active)
      return {
        status: "invalid",
        message: `Cơ sở "${facility.code}" đã ngừng sử dụng.`,
      };
  }
  return { status: "valid", message: null };
}

const fingerprintOfParsed = (row: ParsedTransaction) =>
  fingerprintOf({
    type: row.type,
    transactionDate: row.transactionDate,
    materialCode: row.materialCode,
    facilityCode: row.facilityCode,
    quantity: row.quantity,
    note: row.note,
  });

const sheetType = (sheet: LedgerSheet) =>
  sheet === "ChiTietNhapNVL" ? "INBOUND" : "OUTBOUND";

async function decideRows(
  parsed: ParsedWorkbook,
  session: ClientSession | null,
): Promise<{
  preview: ImportPreview;
  decided: Map<ParsedTransaction, ImportRowStatus>;
}> {
  const model = getMaterialTransactionModel();
  // Sequential: inside a transaction only one command may be in flight per session.
  const lookups = await readLookups(session);
  const imported = await model
    .find({ importKey: { $in: parsed.transactions.map((t) => t.importKey) } })
    .select("importKey")
    .session(session)
    .lean<Pick<StoredTransaction, "importKey">[]>()
    .exec();
  const posted = await model
    .find({
      status: "POSTED",
      fingerprint: { $in: parsed.transactions.map(fingerprintOfParsed) },
    })
    .select("fingerprint")
    .session(session)
    .lean<Pick<StoredTransaction, "fingerprint">[]>()
    .exec();
  const importedKeys = new Set(imported.map((t) => t.importKey));
  const fingerprints = new Set(posted.map((t) => t.fingerprint));
  const decided = new Map<ParsedTransaction, ImportRowStatus>();
  const rows: ImportPreviewRow[] = [];
  for (const row of parsed.transactions) {
    const decision = classifyTransaction(row, lookups);
    let status: ImportRowStatus = decision.status;
    let message = decision.message;
    if (status === "valid" && importedKeys.has(row.importKey)) {
      status = "already-imported";
      message = "Dòng này đã được nhập từ đúng tệp này trước đó.";
    } else if (
      status === "valid" &&
      fingerprints.has(fingerprintOfParsed(row))
    ) {
      status = "duplicate";
      message =
        "Trùng một dòng đã có (cùng loại, ngày, mã, số lượng, ghi chú).";
    }
    decided.set(row, status);
    rows.push({
      sheet: row.sheet,
      row: row.sourceRow,
      type: row.type,
      status,
      message,
      transactionDate: row.transactionDate,
      materialCode: row.materialCode,
      facilityCode: row.facilityCode,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      note: row.note,
    });
  }
  for (const issue of parsed.issues) {
    if (!ledgerSheets.includes(issue.sheet as LedgerSheet)) continue;
    const sheet = issue.sheet as LedgerSheet;
    rows.push({
      sheet,
      row: issue.row,
      type: sheetType(sheet),
      status: "invalid",
      message: issue.message,
      transactionDate: null,
      materialCode: "",
      facilityCode: "",
      quantity: null,
      unitPrice: null,
      note: "",
    });
  }
  rows.sort((a, b) =>
    a.sheet === b.sheet
      ? a.row - b.row
      : ledgerSheets.indexOf(a.sheet) - ledgerSheets.indexOf(b.sheet),
  );
  const counts: Record<ImportRowStatus, number> = {
    valid: 0,
    invalid: 0,
    duplicate: 0,
    "already-imported": 0,
    "unknown-material": 0,
    "unknown-facility": 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return {
    preview: { hash: parsed.hash, fileName: parsed.fileName, rows, counts },
    decided,
  };
}

export async function buildImportPreview(
  parsed: ParsedWorkbook,
): Promise<ImportPreview> {
  await connectToDatabase();
  return (await decideRows(parsed, null)).preview;
}

// ---------------------------------------------------------------- write

export type ImportOutcome = ImportResult & {
  /** Codes whose balance is negative after the import (history is never blocked). */
  negativeBalances: string[];
};

export type ImportWriteMeta = {
  hash: string;
  fileName: string;
  batchId: string;
  metadata?: Record<string, unknown>;
};

const actorName = (actor: AuditActor) =>
  actor.type === "user" ? actor.userId : actor.systemName;

/** Stable per file and row, so a re-run of the same workbook never creates a second line. */
export const importedTransactionId = (row: ParsedTransaction) =>
  `${row.type === "INBOUND" ? "nhap" : "xuat"}-${row.importKey.slice(0, 24)}-${row.sourceRow}`;

/**
 * Inserts the rows inside the caller's transaction: upsert on `importKey`
 * with `$setOnInsert`, so the second run of the same file inserts nothing.
 * History may drive a balance negative; that is reported, not refused.
 */
export async function writeImportedTransactions(
  session: ClientSession,
  rows: readonly ParsedTransaction[],
  lookups: Lookups,
  actor: AuditActor,
  meta: ImportWriteMeta,
): Promise<ImportOutcome> {
  const createdBy = actorName(actor);
  const documents: StoredTransaction[] = [];
  for (const row of rows) {
    let line: MaterialTransaction;
    try {
      line = applyTransactionPatch(
        emptyTransaction(
          importedTransactionId(row),
          row.type,
          row.transactionDate,
          createdBy,
        ),
        {
          transactionDate: row.transactionDate,
          materialCode: row.materialCode,
          ...(row.type === "OUTBOUND"
            ? { facilityCode: row.facilityCode }
            : {}),
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          description: row.description,
          note: row.note,
        },
        lookups,
      );
    } catch (error) {
      throw new MaterialsError(
        `${row.sheet} dòng ${row.sourceRow}: ${error instanceof Error ? error.message : "không hợp lệ"}`,
      );
    }
    const missing = transactionCompleteness(line);
    if (missing)
      throw new MaterialsError(
        `${row.sheet} dòng ${row.sourceRow}: ${missing}`,
      );
    line.version = 1;
    line.batchId = meta.batchId;
    line.migrationSource = row.migrationSource;
    line.sourceRow = row.sourceRow;
    documents.push({
      ...toStoredTransaction(line),
      importKey: row.importKey,
      fingerprint: fingerprintOf(line),
    });
  }

  // Same document lock the interactive save takes, so both serialise on the material.
  const affected = [...new Set(documents.map((d) => d.materialId))].sort();
  const stamp = new Date().toISOString();
  for (const _id of affected)
    await getMaterialModel().updateOne(
      { _id },
      { $set: { updatedAt: stamp } },
      { session },
    );

  const result = documents.length
    ? await getMaterialTransactionModel().bulkWrite(
        documents.map((document) => ({
          updateOne: {
            filter: { importKey: document.importKey },
            update: { $setOnInsert: document },
            upsert: true,
          },
        })),
        { session, ordered: true },
      )
    : null;
  const imported = result?.upsertedCount ?? 0;

  const balances = await readBalances(affected, session);
  const codeOf = new Map(lookups.materials.map((m) => [m.id, m.code]));
  const negativeBalances = affected
    .filter((id) => new Decimal(balances.get(id)?.currentQuantity ?? "0").lt(0))
    .map((id) => codeOf.get(id) ?? id);

  const outcome: ImportOutcome = {
    hash: meta.hash,
    imported,
    skipped: documents.length - imported,
    batchId: meta.batchId,
    negativeBalances,
  };
  await appendAuditEventWithSession(
    {
      actor,
      action: "materials.import",
      resourceType: "materials",
      resourceId: meta.hash,
      requestId: crypto.randomUUID(),
      metadata: {
        ...outcome,
        fileName: meta.fileName,
        rows: documents.length,
        ...(meta.metadata ?? {}),
      },
      occurredAt: new Date(),
    },
    session,
  );
  return outcome;
}

/**
 * Web import: re-decides every row under the transaction, imports the valid
 * ones (plus duplicates when asked), leaves masters untouched.
 */
export async function importTransactions(
  parsed: ParsedWorkbook,
  actor: AuditActor,
  options: { includeDuplicates: boolean },
): Promise<ImportOutcome> {
  const db = await connectToDatabase();
  const batchId = crypto.randomUUID();
  return db.connection.transaction(async (session) => {
    const { decided } = await decideRows(parsed, session);
    const rows = parsed.transactions.filter((row) => {
      const status = decided.get(row);
      return (
        status === "valid" ||
        (options.includeDuplicates && status === "duplicate")
      );
    });
    if (!rows.length) throw new MaterialsError("Không có dòng hợp lệ để nhập.");
    return writeImportedTransactions(
      session,
      rows,
      await readLookups(session),
      actor,
      {
        hash: parsed.hash,
        fileName: parsed.fileName,
        batchId,
        metadata: { includeDuplicates: options.includeDuplicates },
      },
    );
  });
}
