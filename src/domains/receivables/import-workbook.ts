import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import {
  classifyReduction,
  codeKey,
  OPENING_DATE,
  type EntryType,
  type MigrationIssue,
} from "./contracts";

/**
 * Parser for `Reddoor-congno-2026.xlsx`.
 *
 * Reads only the four sheets that carry authority:
 *
 *   TongHopCongNo   `Dư đầu ngày 02/01/2026` — the opening balances
 *   ChiTietBanHang  every sale (the workbook's `Phát sinh tăng`)
 *   ThanhToan       every payment/offset/return (the `Phát sinh giảm`)
 *   MaNhaCungCap    the customer master the two SUMIFs look up
 *
 * Everything else in the 31-sheet workbook is deliberately ignored, and
 * `classifySheets` says why for each one: the 17 per-customer sheets are
 * printed statements whose lines are already in `ChiTietBanHang`, the five
 * pre-2026 sheets are history already inside the opening balance, and the
 * hidden `TongHopCongNo (2)` is a stale copy of the summary carrying the same
 * SUMIF formulas over the same two ledgers. Importing any of them would
 * double-count. See `docs/accounts-receivable-migration.md`.
 *
 * Amounts come from the workbook's own `Thành tiền` column, not from
 * quantity × price: that column is what the SUMIFs added up, so using it is
 * what makes the migrated totals reconcile to the last đồng. Where the two
 * disagree (the source has ten rows with a blank or zeroed amount) the row is
 * still imported, with the amount the workbook used and an `AMOUNT_MISMATCH`
 * or `MISSING_AMOUNT` flag for review. Nothing is silently dropped or fixed.
 */

export const SHEETS = {
  summary: "TongHopCongNo",
  sales: "ChiTietBanHang",
  payments: "ThanhToan",
  partners: "MaNhaCungCap",
  items: "KhoSon",
} as const;

export type ParsedCustomer = {
  code: string;
  normalizedCode: string;
  name: string;
  phone: string;
  address: string;
  type: string;
  note: string;
  sourceRow: number;
};

export type ParsedOpening = {
  code: string;
  normalizedCode: string;
  amount: string;
  /** What the workbook itself reported, for the reconciliation report. */
  excelIncrease: string;
  excelDecrease: string;
  excelClosing: string;
  note: string;
  sourceRow: number;
};

export type ParsedSale = {
  sheet: string;
  sourceRow: number;
  entryDate: string;
  customerCode: string;
  normalizedCode: string;
  documentNumber: string;
  itemCode: string;
  itemName: string;
  unit: string;
  description: string;
  quantity: string | null;
  unitPrice: string | null;
  amount: string;
  note: string;
  issues: MigrationIssue[];
};

export type ParsedReduction = {
  sheet: string;
  sourceRow: number;
  entryDate: string;
  customerCode: string;
  normalizedCode: string;
  documentNumber: string;
  type: EntryType;
  legacyDescription: string;
  amount: string;
  note: string;
  issues: MigrationIssue[];
};

export type SheetVerdict = {
  sheet: string;
  rows: number;
  matchedInSalesLedger: number;
  years: string[];
  classification:
    | "primarySource"
    | "masterData"
    | "derivedReport"
    | "historicalSource"
    | "legacyReport"
    | "emptyOrHelper";
  reason: string;
};

export type ParsedWorkbook = {
  sourceName: string;
  sourceSha256: string;
  customers: ParsedCustomer[];
  openings: ParsedOpening[];
  sales: ParsedSale[];
  reductions: ParsedReduction[];
  itemCodes: Set<string>;
  sheets: SheetVerdict[];
  excelTotals: {
    opening: string;
    increase: string;
    decrease: string;
    closing: string;
  };
};

// ---------------------------------------------------------------- cell helpers

type Cell = string | number | boolean | Date | null | undefined;
type Grid = Cell[][];

const str = (value: Cell): string =>
  value === null || value === undefined ? "" : String(value).trim();

const blank = (value: Cell): boolean => str(value) === "";

/**
 * An Excel numeric cell → canonical decimal string.
 *
 * The workbook's cached results carry binary-float tails (491999.99999999994
 * for 4.1 × 120000). Rounding to 8 significant decimals removes the artefact
 * without touching any real value: no price or quantity in the source has more
 * than four.
 */
function decimal(value: Cell): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  if (value instanceof Date) return null;
  // Free text lives in these columns too (signature blocks, "Tổng cộng"), so a
  // non-numeric cell is simply "no number" rather than a thrown error.
  const text = typeof value === "number" ? value : String(value).trim();
  let parsed: Decimal;
  try {
    parsed = new Decimal(text);
  } catch {
    return null;
  }
  if (!parsed.isFinite()) return null;
  return parsed.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed();
}

/**
 * Excel serial or Date → `yyyy-MM-dd`.
 *
 * The workbook is read WITHOUT `cellDates`, so a date cell arrives as its raw
 * serial and is converted here with UTC arithmetic from the 1899-12-30 epoch.
 * That matters: SheetJS builds `Date` objects in the machine's local zone, and
 * on any zone east of UTC a midnight date reads back as the previous day. The
 * `Date` branch below is only a fallback and therefore reads local components,
 * which is how such a value was constructed in the first place.
 */
function isoDate(value: Cell): string | null {
  if (value instanceof Date) {
    const year = String(value.getFullYear()).padStart(4, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const days = Math.floor(value);
    if (days < 1) return null;
    return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000)
      .toISOString()
      .slice(0, 10);
  }
  const text = str(value);
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (match)
    return `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

const grid = (book: XLSX.WorkBook, sheet: string): Grid => {
  const worksheet = book.Sheets[sheet];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<Cell[]>(worksheet, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null,
  }) as unknown as Grid;
};

// ---------------------------------------------------------------- parsing

export function parseReceivablesWorkbook(
  bytes: Buffer,
  sourceName: string,
): ParsedWorkbook {
  // No `cellDates`: raw serials convert deterministically in `isoDate`, while
  // SheetJS's own Date objects are built in the machine's local zone and would
  // shift every date by a day on a machine east of UTC.
  const book = XLSX.read(bytes, { type: "buffer" });
  const sourceSha256 = createHash("sha256").update(bytes).digest("hex");

  for (const sheet of [
    SHEETS.summary,
    SHEETS.sales,
    SHEETS.payments,
    SHEETS.partners,
  ])
    if (!book.Sheets[sheet])
      throw new Error(`Thiếu sheet "${sheet}" trong file nguồn.`);

  const customers = parsePartners(grid(book, SHEETS.partners));
  // `KhoSon` starts at A2 with its own header row (STT | Ma | Tên sơn | ...).
  const itemCodes = new Set(
    grid(book, SHEETS.items)
      .filter((row) => str(row[0]).toUpperCase() !== "STT")
      .map((row) => codeKey(str(row[1])))
      .filter(Boolean),
  );
  const { openings, excelTotals } = parseSummary(grid(book, SHEETS.summary));
  const known = new Set(customers.map((customer) => customer.normalizedCode));
  const sales = parseSales(grid(book, SHEETS.sales), known, itemCodes);
  const reductions = parseReductions(grid(book, SHEETS.payments), known);

  return {
    sourceName,
    sourceSha256,
    customers,
    openings,
    sales,
    reductions,
    itemCodes,
    sheets: classifySheets(book, sales),
    excelTotals,
  };
}

/** `MaNhaCungCap`: STT | Loại | Mã | Tên | SĐT | Địa chỉ | Ghi chú, from row 5. */
function parsePartners(rows: Grid): ParsedCustomer[] {
  const parsed: ParsedCustomer[] = [];
  const seen = new Set<string>();
  for (let index = 4; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const code = str(row[2]);
    if (!code) continue;
    const normalizedCode = codeKey(code);
    // Excel's VLOOKUP takes the first match; a later duplicate never wins.
    if (seen.has(normalizedCode)) continue;
    seen.add(normalizedCode);
    parsed.push({
      code,
      normalizedCode,
      name: str(row[3]),
      // A phone kept as the number 0 means "none", not the digit zero.
      phone: str(row[4]) === "0" ? "" : str(row[4]),
      address: str(row[5]),
      type: str(row[1]),
      note: str(row[6]),
      sourceRow: index + 1,
    });
  }
  return parsed;
}

/**
 * `TongHopCongNo`: header row 2, customers from row 3 until `Cộng tổng`.
 * Only column G (`Dư đầu`) is authoritative — H, I and J are SUMIF and
 * subtraction formulas over the two ledgers and are read for reconciliation
 * only, never imported as figures.
 */
function parseSummary(rows: Grid): {
  openings: ParsedOpening[];
  excelTotals: ParsedWorkbook["excelTotals"];
} {
  const openings: ParsedOpening[] = [];
  let excelTotals = {
    opening: "0",
    increase: "0",
    decrease: "0",
    closing: "0",
  };
  const seen = new Set<string>();
  for (let index = 2; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const label = str(row[2]);
    if (label.toLocaleLowerCase("vi").includes("cộng")) {
      excelTotals = {
        opening: decimal(row[6]) ?? "0",
        increase: decimal(row[7]) ?? "0",
        decrease: decimal(row[8]) ?? "0",
        closing: decimal(row[9]) ?? "0",
      };
      break; // everything below is the signature block
    }
    const code = str(row[3]);
    if (!code) continue;
    const normalizedCode = codeKey(code);
    if (seen.has(normalizedCode)) continue;
    seen.add(normalizedCode);
    openings.push({
      code,
      normalizedCode,
      amount: decimal(row[6]) ?? "0",
      excelIncrease: decimal(row[7]) ?? "0",
      excelDecrease: decimal(row[8]) ?? "0",
      excelClosing: decimal(row[9]) ?? "0",
      note: str(row[10]),
      sourceRow: index + 1,
    });
  }
  return { openings, excelTotals };
}

/**
 * A row is a transaction only when a business field carries a value. The
 * workbook fills its VLOOKUP and product formulas thousands of rows past the
 * last sale, so counting used rows would invent four thousand transactions.
 */
const hasBusinessValue = (values: readonly Cell[]) =>
  values.some((value) => !blank(value) && value !== 0);

/** `ChiTietBanHang`: header row 3, data from row 4, columns A..M. */
function parseSales(
  rows: Grid,
  known: ReadonlySet<string>,
  itemCodes: ReadonlySet<string>,
): ParsedSale[] {
  const parsed: ParsedSale[] = [];
  for (let index = 3; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const [
      date,
      code,
      ,
      ,
      document,
      item,
      itemName,
      description,
      unit,
      qty,
      price,
      amount,
      note,
    ] = row;
    if (!hasBusinessValue([date, code, item, qty, price])) continue;

    const issues: MigrationIssue[] = [];
    const entryDate = isoDate(date);
    const quantity = decimal(qty);
    const unitPrice = decimal(price);
    const stated = decimal(amount);
    if (stated === null || stated === "0") issues.push("MISSING_AMOUNT");
    else if (quantity !== null && unitPrice !== null) {
      const product = new Decimal(quantity).times(unitPrice);
      if (!product.minus(stated).abs().lessThanOrEqualTo("0.005"))
        issues.push("AMOUNT_MISMATCH");
    }
    const normalizedCode = codeKey(str(code));
    if (!normalizedCode || !known.has(normalizedCode))
      issues.push("UNKNOWN_CUSTOMER");
    const normalizedItem = codeKey(str(item));
    if (normalizedItem && !itemCodes.has(normalizedItem))
      issues.push("UNKNOWN_ITEM");
    if (entryDate && !entryDate.startsWith("2026"))
      issues.push("DATE_OUTSIDE_PERIOD");

    parsed.push({
      sheet: SHEETS.sales,
      sourceRow: index + 1,
      entryDate: entryDate ?? OPENING_DATE,
      customerCode: str(code),
      normalizedCode,
      documentNumber: str(document),
      itemCode: str(item),
      itemName: str(itemName),
      unit: str(unit),
      description: str(description) || "xuất kho",
      quantity,
      unitPrice,
      amount: stated ?? "0",
      note: str(note),
      issues,
    });
  }
  return parsed;
}

/** `ThanhToan`: header row 2, data from row 3, columns A..H. */
function parseReductions(
  rows: Grid,
  known: ReadonlySet<string>,
): ParsedReduction[] {
  const parsed: ParsedReduction[] = [];
  for (let index = 2; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const [date, document, code, , , description, amount, note] = row;
    if (!hasBusinessValue([date, code, amount, description])) continue;

    const issues: MigrationIssue[] = [];
    const entryDate = isoDate(date);
    const stated = decimal(amount);
    if (stated === null || stated === "0") issues.push("MISSING_AMOUNT");
    const normalizedCode = codeKey(str(code));
    if (!normalizedCode || !known.has(normalizedCode))
      issues.push("UNKNOWN_CUSTOMER");
    if (entryDate && !entryDate.startsWith("2026"))
      issues.push("DATE_OUTSIDE_PERIOD");

    const legacyDescription = str(description);
    const { type, mapped } = classifyReduction(legacyDescription);
    if (!mapped) issues.push("UNMAPPED_DESCRIPTION");

    parsed.push({
      sheet: SHEETS.payments,
      sourceRow: index + 1,
      entryDate: entryDate ?? OPENING_DATE,
      customerCode: str(code),
      normalizedCode,
      documentNumber: str(document),
      type,
      legacyDescription,
      amount: stated ?? "0",
      note: str(note),
      issues,
    });
  }
  return parsed;
}

// ---------------------------------------------------------------- sheet triage

/**
 * Decides, from the data rather than from the sheet name, which of the other
 * 27 sheets may be imported. A per-customer sheet whose every line already
 * appears in `ChiTietBanHang` is a printed statement, not a second source.
 */
export function classifySheets(
  book: XLSX.WorkBook,
  sales: readonly ParsedSale[],
): SheetVerdict[] {
  const fingerprints = new Set(
    sales.map(
      (sale) =>
        `${sale.entryDate}|${codeKey(sale.itemCode)}|${sale.quantity ?? ""}|${sale.amount}`,
    ),
  );
  const primary = new Set<string>([
    SHEETS.summary,
    SHEETS.sales,
    SHEETS.payments,
  ]);
  const masters = new Set<string>([SHEETS.partners, SHEETS.items]);

  return book.SheetNames.map((sheet): SheetVerdict => {
    if (primary.has(sheet))
      return {
        sheet,
        rows: 0,
        matchedInSalesLedger: 0,
        years: [],
        classification: "primarySource",
        reason: "Nguồn chính của kỳ 2026.",
      };
    if (masters.has(sheet))
      return {
        sheet,
        rows: 0,
        matchedInSalesLedger: 0,
        years: [],
        classification: "masterData",
        reason: "Danh mục khách hàng / hàng hóa.",
      };
    if (sheet.toUpperCase().includes("TONGHOPCONGNO"))
      return {
        sheet,
        rows: 0,
        matchedInSalesLedger: 0,
        years: [],
        classification: "legacyReport",
        reason:
          "Bản sao cũ của bảng tổng hợp: dùng lại chính công thức SUMIF trên hai sổ 2026, chỉ khác cột dư đầu.",
      };

    // The per-customer sheets share one shape: date | name | code | item |
    // description | unit | qty | price | amount, from row 3.
    const rows = grid(book, sheet)
      .slice(2)
      .map((row) => ({
        date: isoDate(row[0]),
        item: codeKey(str(row[2])),
        quantity: decimal(row[6]),
        amount: decimal(row[8]),
      }))
      .filter((row) => row.date !== null);
    if (!rows.length)
      return {
        sheet,
        rows: 0,
        matchedInSalesLedger: 0,
        years: [],
        classification: "emptyOrHelper",
        reason: "Không có dòng giao dịch.",
      };

    const matched = rows.filter((row) =>
      fingerprints.has(
        `${row.date}|${row.item}|${row.quantity ?? ""}|${row.amount ?? "0"}`,
      ),
    ).length;
    const years = [...new Set(rows.map((row) => row.date!.slice(0, 4)))].sort();
    if (matched === rows.length)
      return {
        sheet,
        rows: rows.length,
        matchedInSalesLedger: matched,
        years,
        classification: "derivedReport",
        reason: `Bản in đối chiếu của khách: ${matched}/${rows.length} dòng đã có trong ${SHEETS.sales}.`,
      };
    if (years.every((year) => year < "2026"))
      return {
        sheet,
        rows: rows.length,
        matchedInSalesLedger: matched,
        years,
        classification: "historicalSource",
        reason: `Dữ liệu ${years.join(", ")} trước kỳ 2026; đã nằm trong dư đầu kỳ.`,
      };
    return {
      sheet,
      rows: rows.length,
      matchedInSalesLedger: matched,
      years,
      classification: "emptyOrHelper",
      reason: `Cần rà soát: ${rows.length - matched} dòng chưa khớp ${SHEETS.sales}.`,
    };
  });
}

/**
 * `${sha256(workbook)}:${sheet}:${row}` — the key that makes a re-run update
 * the same document instead of writing a second one.
 */
export const importKeyOf = (sha: string, sheet: string, row: number) =>
  `${sha}:${sheet}:${row}`;

/** Business-field hash, for reporting exact duplicates inside one source. */
export function fingerprintOf(parts: readonly (string | null)[]): string {
  return createHash("sha256")
    .update(parts.map((part) => part ?? "").join("|"))
    .digest("hex");
}
