import {
  columnLabel,
  fieldLabels,
  isDateField,
  isMoneyField,
  SheetCheckError,
  templateFields,
  type CanonicalField,
  type ColumnMapping,
  type ColumnProposal,
  type MappingConfidence,
  type MappingProposal,
  type SheetCell,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetPeriod,
  type SheetRow,
  type SheetRowKind,
  type UnitMultiplier,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits as limits } from "@/domains/sheet-checks/limits";
import { stripDiacritics } from "@/domains/sheet-checks/parsing/code";
import {
  inferDateOrder,
  isValidCalendarDay,
} from "@/domains/sheet-checks/parsing/date";
import {
  isBlankCell,
  isBlankRow,
  type ParsedSheet,
  type RawRow,
} from "@/domains/sheet-checks/parsing/intake";
import { inferColumnStyle } from "@/domains/sheet-checks/parsing/money";
import type { Currency } from "@/lib/money";

/**
 * Header detection, row classification and the mapping proposal. The
 * header row is found by counting cells that read like a known column
 * name (diacritics-insensitive); everything above it is a title, everything
 * below is data, totals, subtotals, group labels, blanks or a signature
 * block. The proposal is a suggestion only: the person confirms the
 * mapping, and `validateMapping` blocks a run the sheet cannot support.
 */

export type SheetAnalysis = {
  headerRowOffset: number | null;
  headerSheetRowNumber: number | null;
  headerTexts: string[];
  titleLines: string[];
  periodHint: SheetPeriod | null;
  rows: SheetRow[];
  dataRowCount: number;
  issues: Issue[];
};

/* ------------------------------------------------------------------ */
/* Text normalisation                                                  */
/* ------------------------------------------------------------------ */

/** Diacritics stripped, lowercase, punctuation → space, single spaces. */
export function normalizeHeaderText(text: string): string {
  return stripDiacritics(text)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Synonyms                                                            */
/* ------------------------------------------------------------------ */

type SynonymGroup = { field: CanonicalField; patterns: readonly string[] };

/**
 * "số tiền" in a receivables sheet means the closing balance when it is the
 * only money column and the period movement otherwise; the proposal settles
 * it after every column is seen.
 */
const RECEIVABLES_SO_TIEN = "số tiền";

const COMMON_SYNONYMS: readonly SynonymGroup[] = [
  {
    field: "orderCode",
    patterns: [
      "mã đơn",
      "mã đơn hàng",
      "mã đh",
      "số đơn",
      "số đh",
      "đơn hàng",
      "order",
      "order code",
      "order no",
      "order id",
      "po",
      "po no",
      "po number",
      "số po",
    ],
  },
  {
    field: "invoiceNumber",
    patterns: [
      "số hóa đơn",
      "số hđ",
      "hóa đơn",
      "hđ",
      "invoice",
      "invoice no",
      "invoice number",
      "inv",
      "inv no",
    ],
  },
  {
    field: "customerName",
    patterns: [
      "khách hàng",
      "tên khách",
      "tên khách hàng",
      "khách",
      "tên kh",
      "kh",
      "công ty",
      "đơn vị",
      "đối tác",
      "customer",
      "customer name",
      "client",
      "buyer",
      "đối tượng",
      "tên đối tượng",
    ],
  },
  {
    field: "customerCode",
    patterns: [
      "mã khách",
      "mã kh",
      "mã khách hàng",
      "mã đối tượng",
      "customer code",
      "cust code",
      "cust id",
      "customer id",
    ],
  },
  {
    field: "date",
    patterns: [
      "ngày",
      "ngày thu",
      "ngày nhận",
      "ngày tiền về",
      "ngày gd",
      "ngày giao dịch",
      "ngày ct",
      "ngày chứng từ",
      "ngày thanh toán",
      "ngày tt",
      "ngày phát sinh",
      "ngày hđ",
      "ngày hóa đơn",
      "ngày lập",
      "date",
      "value date",
      "posting date",
      "payment date",
      "transaction date",
      "invoice date",
    ],
  },
  {
    field: "dueDate",
    patterns: [
      "hạn",
      "hạn thanh toán",
      "hạn tt",
      "đến hạn",
      "ngày đến hạn",
      "due",
      "due date",
      "hạn nợ",
    ],
  },
  {
    field: "currency",
    patterns: ["loại tiền", "tiền tệ", "đơn vị tiền", "currency", "ccy", "cur"],
  },
  {
    field: "method",
    patterns: [
      "hình thức",
      "phương thức",
      "hình thức thanh toán",
      "phương thức thanh toán",
      "pttt",
      "httt",
      "method",
      "payment method",
      "kênh",
      "tm/ck",
    ],
  },
  {
    field: "bankRef",
    patterns: [
      "số ct",
      "số chứng từ",
      "chứng từ",
      "mã gd",
      "mã giao dịch",
      "ref",
      "reference",
      "bank ref",
      "số bút toán",
      "số unc",
      "unc",
      "transaction id",
      "trans id",
      "mã tham chiếu",
      "số tham chiếu",
    ],
  },
  {
    field: "stage",
    patterns: [
      "trạng thái",
      "tình trạng",
      "bước",
      "giai đoạn",
      "tiến độ",
      "status",
      "stage",
      "state",
    ],
  },
  {
    field: "note",
    patterns: [
      "ghi chú",
      "diễn giải",
      "nội dung",
      "mô tả",
      "note",
      "notes",
      "remark",
      "remarks",
      "description",
      "memo",
      "comment",
    ],
  },
  {
    field: "ignore",
    patterns: [
      "stt",
      "tt",
      "no",
      "no.",
      "#",
      "seq",
      "số thứ tự",
      "đvt",
      "đơn vị tính",
      "id",
    ],
  },
];

const INCOMING_CASH_SYNONYMS: readonly SynonymGroup[] = [
  {
    field: "amount",
    patterns: [
      "số tiền",
      "thành tiền",
      "tiền",
      "tiền về",
      "đã thu",
      "thực thu",
      "số tiền thu",
      "tiền thu",
      "amount",
      "paid",
      "received",
      "credit",
      "ghi có",
      "giá trị",
      "tổng tiền",
      "thanh toán",
    ],
  },
  {
    field: "ignore",
    patterns: ["còn lại", "dư nợ", "còn nợ", "còn phải thu", "balance"],
  },
];

const RECEIVABLES_SYNONYMS: readonly SynonymGroup[] = [
  {
    field: "outstanding",
    patterns: [
      "dư nợ",
      "còn lại",
      "còn phải thu",
      "còn nợ",
      "nợ cuối",
      "dư cuối",
      "dư cuối kỳ",
      "số dư cuối kỳ",
      "cuối kỳ",
      "phải thu",
      "balance",
      "outstanding",
      "closing",
      "closing balance",
      "ending balance",
      "remaining",
      "còn thiếu",
    ],
  },
  {
    field: "openingBalance",
    patterns: [
      "dư đầu",
      "đầu kỳ",
      "dư đầu kỳ",
      "số dư đầu kỳ",
      "nợ đầu",
      "nợ đầu kỳ",
      "opening",
      "opening balance",
      "beginning balance",
    ],
  },
  {
    field: "invoiced",
    patterns: [
      "phát sinh",
      "phát sinh tăng",
      "ps tăng",
      "nợ tăng",
      "doanh số",
      "doanh thu",
      "hóa đơn trong kỳ",
      "giá trị hóa đơn",
      "invoiced",
      "invoice amount",
      "sales",
      "debit",
      "ghi nợ",
      RECEIVABLES_SO_TIEN,
    ],
  },
  {
    field: "received",
    patterns: [
      "đã thu",
      "thực thu",
      "đã trả",
      "đã thanh toán",
      "đã tt",
      "thanh toán",
      "tiền về",
      "ps giảm",
      "phát sinh giảm",
      "received",
      "paid",
      "payment",
      "payments",
      "credit",
      "ghi có",
    ],
  },
  {
    field: "refunded",
    patterns: [
      "hoàn",
      "hoàn tiền",
      "hoàn trả",
      "trả lại",
      "refund",
      "refunded",
      "refunds",
    ],
  },
];

const GENERIC_SYNONYMS: readonly SynonymGroup[] = [
  {
    field: "amount",
    patterns: [
      "giá bán",
      "giá trị",
      "giá trị đơn",
      "tổng tiền",
      "thành tiền",
      "số tiền",
      "amount",
      "value",
      "price",
      "selling price",
      "order value",
      "total",
    ],
  },
];

const TEMPLATE_SYNONYMS: Record<SheetCheckTemplate, readonly SynonymGroup[]> = {
  incomingCash: INCOMING_CASH_SYNONYMS,
  receivables: RECEIVABLES_SYNONYMS,
  generic: GENERIC_SYNONYMS,
};

/** Template-specific groups first, then the shared ones. */
export function headerSynonyms(
  template: SheetCheckTemplate,
): ReadonlyArray<{ field: CanonicalField; patterns: readonly string[] }> {
  return [...TEMPLATE_SYNONYMS[template], ...COMMON_SYNONYMS];
}

type CompiledSynonym = {
  field: CanonicalField;
  normalized: string;
  raw: string;
  specific: boolean;
};

const compiledCache = new Map<SheetCheckTemplate, CompiledSynonym[]>();

function compiledSynonyms(template: SheetCheckTemplate): CompiledSynonym[] {
  const cached = compiledCache.get(template);
  if (cached) return cached;
  const specificCount = TEMPLATE_SYNONYMS[template].length;
  const compiled: CompiledSynonym[] = [];
  headerSynonyms(template).forEach((group, groupIndex) => {
    for (const raw of group.patterns) {
      const normalized = raw === "#" ? "#" : normalizeHeaderText(raw);
      if (normalized === "") continue;
      compiled.push({
        field: group.field,
        normalized,
        raw,
        specific: groupIndex < specificCount,
      });
    }
  });
  compiledCache.set(template, compiled);
  return compiled;
}

type MatchKind = "whole" | "trailing" | "leading";

export type HeaderMatch = {
  field: CanonicalField;
  kind: MatchKind;
  /** The synonym that matched, as written in the table. */
  pattern: string;
};

const MATCH_RANK: Record<MatchKind, number> = {
  whole: 3,
  trailing: 2,
  leading: 1,
};

type MatchCandidate = { kind: MatchKind; length: number; specific: boolean };

function isBetterMatch(
  candidate: MatchCandidate,
  best: MatchCandidate | null,
): boolean {
  if (!best) return true;
  const candidateWhole = candidate.kind === "whole";
  if (candidateWhole !== (best.kind === "whole")) return candidateWhole;
  if (candidate.length !== best.length) return candidate.length > best.length;
  if (MATCH_RANK[candidate.kind] !== MATCH_RANK[best.kind]) {
    return MATCH_RANK[candidate.kind] > MATCH_RANK[best.kind];
  }
  return candidate.specific && !best.specific;
}

/**
 * Whole header, then the longest synonym at either end (the trailing token
 * is the modifier in Vietnamese and the head noun in English, so it wins
 * over the leading one at equal length); template groups win ties.
 */
export function matchHeader(
  headerText: string,
  template: SheetCheckTemplate,
): HeaderMatch | null {
  const trimmed = headerText.trim();
  if (trimmed === "") return null;
  if (trimmed === "#") return { field: "ignore", kind: "whole", pattern: "#" };
  const normalized = normalizeHeaderText(trimmed);
  if (normalized === "") return null;
  let best: (HeaderMatch & { length: number; specific: boolean }) | null = null;
  for (const synonym of compiledSynonyms(template)) {
    if (synonym.normalized === "#") continue;
    let kind: MatchKind | null = null;
    if (normalized === synonym.normalized) kind = "whole";
    else if (normalized.endsWith(` ${synonym.normalized}`)) kind = "trailing";
    else if (normalized.startsWith(`${synonym.normalized} `)) kind = "leading";
    if (!kind) continue;
    const length = synonym.normalized.length;
    const better = isBetterMatch(
      { kind, length, specific: synonym.specific },
      best,
    );
    if (better) {
      best = {
        field: synonym.field,
        kind,
        pattern: synonym.raw,
        length,
        specific: synonym.specific,
      };
    }
  }
  return best
    ? { field: best.field, kind: best.kind, pattern: best.pattern }
    : null;
}

/* ------------------------------------------------------------------ */
/* Header row detection                                                */
/* ------------------------------------------------------------------ */

const SHORT_SUBHEADER_CHARS = 12;
const SHORT_SUPERHEADER_CHARS = 24;

function nonEmptyCells(row: RawRow): { column: number; cell: SheetCell }[] {
  const cells: { column: number; cell: SheetCell }[] = [];
  row.cells.forEach((cell, column) => {
    if (!isBlankCell(cell)) cells.push({ column, cell });
  });
  return cells;
}

/** Non-empty cells the row owns: copies filled from a merged range do not count. */
function ownCells(row: RawRow): { column: number; cell: SheetCell }[] {
  return nonEmptyCells(row).filter(({ cell }) => !cell.mergedFill);
}

function isShortLabel(cell: SheetCell, maxChars: number): boolean {
  return (
    cell.type === "s" && cell.text.length <= maxChars && !/\d/.test(cell.text)
  );
}

const CURRENCY_HEADER_TOKENS: Record<string, Currency> = {
  vnd: "VND",
  vnđ: "VND",
  đ: "VND",
  "₫": "VND",
  đồng: "VND",
  dong: "VND",
  usd: "USD",
  us$: "USD",
  $: "USD",
};

/**
 * Header text is data: a token such as `constructor` or `__proto__` must
 * not resolve through the prototype chain, so every lookup is guarded.
 */
function currencyOfHeaderToken(token: string): Currency | null {
  return Object.hasOwn(CURRENCY_HEADER_TOKENS, token)
    ? (CURRENCY_HEADER_TOKENS[token] ?? null)
    : null;
}

function currencyTokenOf(text: string): Currency | null {
  return currencyOfHeaderToken(text.trim().toLowerCase());
}

/** A currency the header fixes for the column: one distinct token, else null. */
export function fixedCurrencyOf(headerText: string): Currency | null {
  const tokens = headerText
    .toLowerCase()
    .split(/[\s()[\]/,:;|-]+/)
    .filter((token) => token !== "");
  const found = new Set<Currency>();
  for (const token of tokens) {
    const currency = currencyOfHeaderToken(token);
    if (currency) found.add(currency);
  }
  if (found.size !== 1) return null;
  return found.has("USD") ? "USD" : "VND";
}

function rowScore(row: RawRow, template: SheetCheckTemplate): number {
  let score = 0;
  for (const { cell } of ownCells(row)) {
    if (cell.type !== "s") continue;
    if (matchHeader(cell.text, template)) score += 1;
  }
  return score;
}

function findHeaderOffset(
  sheet: ParsedSheet,
  template: SheetCheckTemplate,
): number | null {
  const window = sheet.rows.slice(0, limits.headerWindowRows);
  const needed = sheet.columnCount <= 3 ? 1 : 2;
  let bestOffset: number | null = null;
  let bestScore = 0;
  window.forEach((row, offset) => {
    const score = rowScore(row, template);
    if (score >= needed && score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  });
  return bestOffset;
}

type HeaderBlock = {
  offset: number;
  /** Offsets of every row that belongs to the header (one or two). */
  rowOffsets: number[];
  texts: string[];
};

function joinTexts(top: string, bottom: string): string {
  if (top === "") return bottom;
  if (bottom === "") return top;
  return `${top} / ${bottom}`;
}

/**
 * A two-row header: "Số tiền" over "VND"/"USD", "Ngày" over "Chứng từ".
 * The second row may sit below the scored row (short labels under
 * money/date headers) or above it (a group label over currency tokens).
 */
function resolveHeaderBlock(
  sheet: ParsedSheet,
  offset: number,
  template: SheetCheckTemplate,
): HeaderBlock {
  const header = sheet.rows[offset];
  if (!header) return { offset, rowOffsets: [offset], texts: [] };
  const texts = header.cells.map((cell) => cell.text);
  const matches = texts.map((text) => matchHeader(text, template));

  const below = sheet.rows[offset + 1];
  if (below && !isBlankRow(below.cells)) {
    const cells = nonEmptyCells(below);
    const allShort = cells.every(({ cell }) =>
      isShortLabel(cell, SHORT_SUBHEADER_CHARS),
    );
    const anchored = cells.some(({ column, cell }) => {
      const field = matches[column]?.field;
      return (
        (field !== undefined && (isMoneyField(field) || isDateField(field))) ||
        currencyTokenOf(cell.text) !== null ||
        matchHeader(cell.text, template) !== null
      );
    });
    if (allShort && anchored) {
      return {
        offset,
        rowOffsets: [offset, offset + 1],
        texts: texts.map((text, column) =>
          joinTexts(text, below.cells[column]?.text ?? ""),
        ),
      };
    }
  }

  const above = offset > 0 ? sheet.rows[offset - 1] : undefined;
  if (above && !isBlankRow(above.cells)) {
    const cells = nonEmptyCells(above);
    const allShort = cells.every(({ cell }) =>
      isShortLabel(cell, SHORT_SUPERHEADER_CHARS),
    );
    const anchored = cells.some(({ column, cell }) => {
      const under = texts[column] ?? "";
      if (currencyTokenOf(under) !== null) return true;
      const aboveMatch = matchHeader(cell.text, template);
      return (
        aboveMatch !== null &&
        (isMoneyField(aboveMatch.field) || isDateField(aboveMatch.field)) &&
        under !== "" &&
        matches[column] === null
      );
    });
    if (allShort && anchored) {
      return {
        offset: offset - 1,
        rowOffsets: [offset - 1, offset],
        texts: texts.map((text, column) =>
          joinTexts(above.cells[column]?.text ?? "", text),
        ),
      };
    }
  }

  return { offset, rowOffsets: [offset], texts };
}

/* ------------------------------------------------------------------ */
/* Period hint                                                         */
/* ------------------------------------------------------------------ */

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function daysInMonth(year: number, month: number): number {
  let day = 31;
  while (day > 28 && !isValidCalendarDay(year, month, day)) day -= 1;
  return day;
}

function monthPeriod(year: number, month: number): SheetPeriod | null {
  if (month < 1 || month > 12 || year < 2000 || year > 2099) return null;
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`,
  };
}

function dayOf(day: string, month: string, year: string): string | null {
  const d = Number.parseInt(day, 10);
  const m = Number.parseInt(month, 10);
  const y = Number.parseInt(year, 10);
  if (!isValidCalendarDay(y, m, d) || y < 2000 || y > 2099) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

const DATE_PART = "(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})";
const RANGE_VI = new RegExp(
  `tu\\s+(?:ngay\\s+)?${DATE_PART}\\s+(?:den|toi)\\s+(?:ngay\\s+)?${DATE_PART}`,
);
const RANGE_EN = new RegExp(
  `from\\s+${DATE_PART}\\s+(?:to|until)\\s+${DATE_PART}`,
);
// "tháng 8/2026", "tháng 8 2026" and "THÁNG 8 NĂM 2026" all name one month.
const MONTH_VI = /thang\s*(\d{1,2})\s*(?:[/.-]|nam)?\s*(\d{4})/;
const MONTH_EN = /\b([a-z]{3,9})\.?\s*,?\s*(\d{4})\b/g;
const MONTH_NUMERIC = /(?<![\d/.-])(\d{1,2})[/.-](\d{4})(?![\d/.-])/;
const QUARTER = /(?:quy|q)\s*([1-4])\s*(?:[/.-]|nam)?\s*(\d{4})/;
const YEAR = /\b(?:nam|year|fy)\s*(\d{4})\b/;

/** Lowercase, diacritics stripped, punctuation kept (dates need "/" and "-"). */
function periodText(text: string): string {
  return stripDiacritics(text).replace(/\s+/g, " ").trim();
}

function periodFromText(raw: string): SheetPeriod | null {
  const text = periodText(raw);
  const range = RANGE_VI.exec(text) ?? RANGE_EN.exec(text);
  if (range) {
    const from = dayOf(range[1] ?? "", range[2] ?? "", range[3] ?? "");
    const to = dayOf(range[4] ?? "", range[5] ?? "", range[6] ?? "");
    if (from && to && from <= to) return { from, to };
  }
  const monthVi = MONTH_VI.exec(text);
  if (monthVi) {
    const period = monthPeriod(
      Number.parseInt(monthVi[2] ?? "", 10),
      Number.parseInt(monthVi[1] ?? "", 10),
    );
    if (period) return period;
  }
  for (const match of text.matchAll(MONTH_EN)) {
    const name = match[1] ?? "";
    const month = Object.hasOwn(MONTH_NAMES, name)
      ? MONTH_NAMES[name]
      : undefined;
    if (month === undefined) continue;
    const period = monthPeriod(Number.parseInt(match[2] ?? "", 10), month);
    if (period) return period;
  }
  const quarter = QUARTER.exec(text);
  if (quarter) {
    const q = Number.parseInt(quarter[1] ?? "", 10);
    const year = Number.parseInt(quarter[2] ?? "", 10);
    const first = monthPeriod(year, (q - 1) * 3 + 1);
    const last = monthPeriod(year, q * 3);
    if (first && last) return { from: first.from, to: last.to };
  }
  const monthNumeric = MONTH_NUMERIC.exec(text);
  if (monthNumeric) {
    const period = monthPeriod(
      Number.parseInt(monthNumeric[2] ?? "", 10),
      Number.parseInt(monthNumeric[1] ?? "", 10),
    );
    if (period) return period;
  }
  const year = YEAR.exec(text);
  if (year) {
    const value = Number.parseInt(year[1] ?? "", 10);
    if (value >= 2000 && value <= 2099) {
      return { from: `${value}-01-01`, to: `${value}-12-31` };
    }
  }
  return null;
}

/** First period stated in the title lines, then in the header texts. */
export function detectPeriodHint(
  titleLines: readonly string[],
  headerTexts: readonly string[],
): SheetPeriod | null {
  for (const line of titleLines) {
    const period = periodFromText(line);
    if (period) return period;
  }
  for (const text of headerTexts) {
    const period = periodFromText(text);
    if (period) return period;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Row classification                                                  */
/* ------------------------------------------------------------------ */

const TOTALS_KEYWORD =
  /^(?:tong cong|tong|cong|grand total|total|sum)(?:\s|$|:)/;
/** "Tổng công ty …" is a company, "Cộng hòa …" a title: never a totals row. */
const TOTALS_FALSE_POSITIVE = /^(?:tong cong ty|cong hoa|cong ty)\b/;
const SIGNATURE_PATTERNS: readonly RegExp[] = [
  /\bnguoi lap\b/,
  /\bnguoi (?:nhan|giao|kiem tra|duyet)\b/,
  /\bke toan\b/,
  /\bgiam doc\b/,
  /\bthu truong\b/,
  /\bky ten\b/,
  /\bky va ghi ro ho ten\b/,
  /\blap bieu\b/,
  /\bngay\b.*\bthang\b.*\bnam\b/,
  /\bprepared by\b/,
  /\bapproved by\b/,
  /\bchecked by\b/,
  /\bsignature\b/,
  /\bdirector\b/,
  /\baccountant\b/,
];
const MONEY_LIKE_TEXT =
  /^\(?[-+−]?\s*(?:us\$|\$|₫)?\s*\d[\d.,' ]*\s*(?:đ|₫|vnđ|vnd|usd|\$|d)?\)?$/i;
const CODE_LIKE_TEXT = /^[A-Za-z0-9_/-]+$/;

function firstTextCell(row: RawRow): SheetCell | null {
  for (const cell of row.cells) {
    if (cell.type === "s" && cell.text !== "") return cell;
  }
  return null;
}

function isTotalsKeywordRow(row: RawRow): boolean {
  const cell = firstTextCell(row);
  if (!cell) return false;
  const text = normalizeHeaderText(cell.text);
  return TOTALS_KEYWORD.test(text) && !TOTALS_FALSE_POSITIVE.test(text);
}

function isSignatureRow(row: RawRow): boolean {
  const cells = ownCells(row);
  if (cells.length === 0 || cells.some(({ cell }) => cell.type === "n")) {
    return false;
  }
  const text = cells
    .map(({ cell }) => normalizeHeaderText(cell.text))
    .join(" ");
  return SIGNATURE_PATTERNS.some((pattern) => pattern.test(text));
}

/** A footer line under the totals: a signature, or a short remark without figures. */
function isFooterRow(row: RawRow): boolean {
  if (isSignatureRow(row)) return true;
  const cells = ownCells(row);
  if (cells.length === 0 || cells.length > 2) return false;
  return cells.every(
    ({ cell }) =>
      cell.type === "s" &&
      !MONEY_LIKE_TEXT.test(cell.text) &&
      !/\d{1,3}(?:[.,]\d{3})+/.test(cell.text),
  );
}

function isGroupRow(row: RawRow, columnCount: number): boolean {
  if (columnCount < 3) return false;
  const cells = ownCells(row);
  if (cells.length !== 1) return false;
  const cell = cells[0]?.cell;
  if (!cell || cell.type !== "s") return false;
  const text = cell.text;
  if (!/\p{L}/u.test(text)) return false;
  if (MONEY_LIKE_TEXT.test(text)) return false;
  if (CODE_LIKE_TEXT.test(text) && /\d/.test(text)) return false;
  return true;
}

type ClassifiedRow = { row: RawRow; kind: SheetRowKind | "footer" };

/**
 * Cuts the data region (ended by a run of blank rows), names the totals
 * row (a totals keyword followed only by footer lines) and classifies the
 * rest.
 */
function classifyRows(
  rows: readonly RawRow[],
  columnCount: number,
  issues: Issue[],
): ClassifiedRow[] {
  const region: RawRow[] = [];
  let blankRun = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;
    if (isBlankRow(row.cells)) {
      blankRun += 1;
      if (blankRun >= limits.blankRowsEndRegion) {
        const trailing = rows
          .slice(index + 1)
          .some((later) => !isBlankRow(later.cells));
        if (trailing)
          issues.push(issue("TRAILING_CONTENT_IGNORED", { n: blankRun }));
        break;
      }
      region.push(row);
      continue;
    }
    blankRun = 0;
    region.push(row);
  }
  // Blank rows at the bottom (the ending run included) are not stored.
  while (
    region.length > 0 &&
    isBlankRow(region[region.length - 1]?.cells ?? [])
  ) {
    region.pop();
  }

  // The last totals keyword is the totals row when only footer lines
  // (signatures, short remarks, blanks) follow it; otherwise it is a
  // subtotal and the data goes on. Footer lines are excluded only there,
  // or as a trailing signature block when the sheet has no totals row.
  let totalIndex = -1;
  for (let index = region.length - 1; index >= 0; index -= 1) {
    const row = region[index];
    if (row && isTotalsKeywordRow(row)) {
      totalIndex = index;
      break;
    }
  }
  let footerStart = region.length;
  if (totalIndex >= 0) {
    const closesSheet = region
      .slice(totalIndex + 1)
      .every((row) => isBlankRow(row.cells) || isFooterRow(row));
    if (closesSheet) footerStart = totalIndex + 1;
    else totalIndex = -1;
  } else {
    let index = region.length - 1;
    let signatures = 0;
    while (index >= 0) {
      const row = region[index];
      if (!row) break;
      if (isBlankRow(row.cells)) {
        index -= 1;
        continue;
      }
      if (!isSignatureRow(row)) break;
      signatures += 1;
      index -= 1;
    }
    if (signatures > 0) footerStart = index + 1;
  }

  const classified: ClassifiedRow[] = [];
  region.forEach((row, index) => {
    if (index >= footerStart) {
      classified.push({ row, kind: "footer" });
      return;
    }
    if (isBlankRow(row.cells)) {
      classified.push({ row, kind: "blank" });
      return;
    }
    if (isTotalsKeywordRow(row)) {
      classified.push({
        row,
        kind: index === totalIndex ? "total" : "subtotal",
      });
      return;
    }
    if (isGroupRow(row, columnCount)) {
      classified.push({ row, kind: "group" });
      return;
    }
    classified.push({ row, kind: "data" });
  });
  return classified;
}

/* ------------------------------------------------------------------ */
/* analyzeSheet                                                        */
/* ------------------------------------------------------------------ */

const MAX_TITLE_LINES = 3;
const MAX_TITLE_CELLS = 2;

export function analyzeSheet(
  sheet: ParsedSheet,
  template: SheetCheckTemplate,
): SheetAnalysis {
  const issues: Issue[] = [];
  const headerOffset = findHeaderOffset(sheet, template);
  let headerTexts: string[] = Array.from(
    { length: sheet.columnCount },
    () => "",
  );
  let titleLines: string[] = [];
  let headerRowOffset: number | null = null;
  let headerSheetRowNumber: number | null = null;
  let dataStart = 0;

  if (headerOffset === null) {
    issues.push(issue("HEADER_NOT_FOUND", { n: 1 }));
  } else {
    const block = resolveHeaderBlock(sheet, headerOffset, template);
    headerRowOffset = block.offset;
    headerSheetRowNumber = sheet.rows[block.offset]?.sheetRowNumber ?? null;
    headerTexts = Array.from(
      { length: sheet.columnCount },
      (_unused, column) => block.texts[column] ?? "",
    );
    dataStart =
      (block.rowOffsets[block.rowOffsets.length - 1] ?? block.offset) + 1;
    titleLines = sheet.rows
      .slice(0, block.offset)
      .filter((row) => {
        const cells = ownCells(row);
        return cells.length > 0 && cells.length <= MAX_TITLE_CELLS;
      })
      .map((row) =>
        ownCells(row)
          .map(({ cell }) => cell.text)
          .join(" "),
      )
      .slice(0, MAX_TITLE_LINES);
  }

  const classified = classifyRows(
    sheet.rows.slice(dataStart),
    sheet.columnCount,
    issues,
  );
  const rows: SheetRow[] = [];
  let dataRowCount = 0;
  let hiddenDataRows = 0;
  let skippedRows = 0;
  for (const entry of classified) {
    if (entry.kind === "footer") continue;
    if (entry.kind === "data") {
      dataRowCount += 1;
      if (dataRowCount > limits.maxRows) {
        throw new SheetCheckError(
          "FILE_TOO_MANY_ROWS",
          `More than ${limits.maxRows} data rows.`,
        );
      }
      if (entry.row.hidden) hiddenDataRows += 1;
    } else if (entry.kind === "group" || entry.kind === "subtotal") {
      skippedRows += 1;
    }
    rows.push({
      index: rows.length,
      sheetRowNumber: entry.row.sheetRowNumber,
      kind: entry.kind,
      hidden: entry.row.hidden,
      cells: entry.row.cells,
    });
  }
  if (hiddenDataRows > 0)
    issues.push(issue("HIDDEN_ROWS", { n: hiddenDataRows }));
  if (skippedRows > 0)
    issues.push(issue("GROUP_ROWS_SKIPPED", { n: skippedRows }));

  return {
    headerRowOffset,
    headerSheetRowNumber,
    headerTexts,
    titleLines,
    periodHint: detectPeriodHint(titleLines, headerTexts),
    rows,
    dataRowCount,
    issues,
  };
}

/* ------------------------------------------------------------------ */
/* Mapping proposal                                                    */
/* ------------------------------------------------------------------ */

/** "ngân hàng" (bank) is not "ngàn" (thousand); "1.000.000" is checked as millions first. */
const THOUSANDS_HINT =
  /\bnghin\b|\bngan\b(?!\s*hang)|(?<![\d.,])1[.,]000(?![.,]?\d)\s*(?:d|vnd|dong)?\b|'000|x\s*1[.,]?000\b|\bthousand/;
const MILLIONS_HINT =
  /\btrieu\b|\btr\s*(?:d|vnd|dong)\b|(?<![\d.,])1[.,]000[.,]000(?![.,]?\d)|x\s*1[.,]?000[.,]?000\b|\bmillion|\bmil\b|\bmn\b/;

/** The unit a header or title states; applied only after the person confirms. */
export function multiplierHintOf(text: string): UnitMultiplier | null {
  const normalized = stripDiacritics(text).replace(/\s+/g, " ");
  if (MILLIONS_HINT.test(normalized)) return "1000000";
  if (THOUSANDS_HINT.test(normalized)) return "1000";
  return null;
}

const SHAPE_SAMPLE_ROWS = 50;
const MONEY_SHAPE_TEXT =
  /^\(?[-+−]?\s*(?:us\$|\$|₫)?\s*\d{1,3}(?:[.,' ]\d{3})+(?:[.,]\d{1,2})?\s*(?:đ|₫|vnđ|vnd|usd|\$|d)?\)?$/i;
const DATE_SHAPE_TEXT =
  /^(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})(?:\s|T|$)/;
const DATE_FORMAT = /[dmy]/i;
const ORDER_CODE_SHAPE = /^(?:rd-?)?\d{8}-?[a-z0-9]{4}$/i;
const INVOICE_SHAPE = /^(?:inv|hd|hđ)[\s_-]?\d/i;
const SMALL_INTEGER = /^\d{1,6}$/;

type ColumnShape =
  | "money"
  | "date"
  | "orderCode"
  | "invoiceNumber"
  | "smallInteger"
  | "text"
  | "empty";

function shapeOf(cells: readonly SheetCell[]): ColumnShape {
  const samples = cells
    .filter((cell) => !isBlankCell(cell) && !cell.noCache)
    .slice(0, SHAPE_SAMPLE_ROWS);
  if (samples.length === 0) return "empty";
  let money = 0;
  let date = 0;
  let orderCode = 0;
  let invoice = 0;
  let smallInteger = 0;
  for (const cell of samples) {
    if (cell.type === "n" && cell.number !== null) {
      const format = cell.numberFormat ?? "";
      const isDateFormat =
        DATE_FORMAT.test(format.replace(/\[.*?\]|"[^"]*"/g, "")) &&
        !/^general$/i.test(format);
      if (isDateFormat) date += 1;
      else if (
        Number.isInteger(cell.number) &&
        cell.number >= 0 &&
        cell.number < 1_000_000 &&
        (format === "" || /^general$/i.test(format) || format === "0")
      )
        smallInteger += 1;
      else money += 1;
      continue;
    }
    if (cell.type !== "s") continue;
    const text = cell.text;
    if (ORDER_CODE_SHAPE.test(text)) orderCode += 1;
    else if (INVOICE_SHAPE.test(text)) invoice += 1;
    else if (DATE_SHAPE_TEXT.test(text)) date += 1;
    else if (MONEY_SHAPE_TEXT.test(text)) money += 1;
    else if (SMALL_INTEGER.test(text)) smallInteger += 1;
  }
  const half = samples.length / 2;
  if (orderCode > half) return "orderCode";
  if (invoice > half) return "invoiceNumber";
  if (date > half) return "date";
  if (money > half) return "money";
  if (smallInteger > half) return "smallInteger";
  return "text";
}

function primaryMoneyField(template: SheetCheckTemplate): CanonicalField {
  return template === "receivables" ? "outstanding" : "amount";
}

function usdTokenCount(cells: readonly SheetCell[]): {
  usd: number;
  total: number;
} {
  let usd = 0;
  let total = 0;
  for (const cell of cells) {
    if (isBlankCell(cell) || cell.noCache) continue;
    total += 1;
    const text = cell.type === "n" ? (cell.numberFormat ?? "") : cell.text;
    // Excel writes VND as `[$₫-42A]` / `[$-42A]`, which contains a "$";
    // a đồng marker therefore decides before the dollar sign does.
    if (/₫|đ|vnd|vnđ/i.test(text)) continue;
    if (/\$|usd/i.test(text)) usd += 1;
  }
  return { usd, total };
}

function distinctSamples(cells: readonly SheetCell[]): string[] {
  const seen = new Set<string>();
  const samples: string[] = [];
  for (const cell of cells) {
    if (isBlankCell(cell) || cell.noCache || seen.has(cell.text)) continue;
    seen.add(cell.text);
    samples.push(cell.text);
    if (samples.length >= limits.sampleValuesShown) break;
  }
  return samples;
}

function dataCellsOf(rows: readonly SheetRow[], column: number): SheetCell[] {
  const cells: SheetCell[] = [];
  for (const row of rows) {
    if (row.kind !== "data") continue;
    const cell = row.cells[column];
    if (cell) cells.push(cell);
  }
  return cells;
}

export function proposeMapping(
  analysis: SheetAnalysis,
  template: SheetCheckTemplate,
): { proposal: MappingProposal; mapping: SheetMapping } {
  const columnCount = analysis.headerTexts.length;
  const titleMultiplier =
    analysis.titleLines
      .map(multiplierHintOf)
      .find((hint): hint is UnitMultiplier => hint !== null) ?? null;

  type Draft = {
    column: number;
    header: string;
    field: CanonicalField;
    confidence: MappingConfidence;
    soTien: boolean;
    cells: SheetCell[];
  };
  const drafts: Draft[] = [];
  const taken = new Map<CanonicalField, Draft[]>();
  const claim = (draft: Draft): void => {
    if (draft.field === "ignore") return;
    const holders = taken.get(draft.field) ?? [];
    holders.push(draft);
    taken.set(draft.field, holders);
  };

  // Pass 1: headers.
  for (let column = 0; column < columnCount; column += 1) {
    const header = analysis.headerTexts[column] ?? "";
    const cells = dataCellsOf(analysis.rows, column);
    const match =
      analysis.headerRowOffset === null ? null : matchHeader(header, template);
    let field: CanonicalField = "ignore";
    let confidence: MappingConfidence = "low";
    let soTien = false;
    if (match) {
      const idOnly = match.pattern === "id";
      if (!idOnly || shapeOf(cells) === "smallInteger") {
        field = match.field;
        confidence = match.kind === "whole" ? "high" : "medium";
        soTien =
          template === "receivables" && match.pattern === RECEIVABLES_SO_TIEN;
      }
    }
    const draft: Draft = { column, header, field, confidence, soTien, cells };
    drafts.push(draft);
    claim(draft);
  }

  // "Số tiền" in a receivables sheet: the closing balance when nothing else
  // carries money, the period movement otherwise.
  for (const draft of drafts) {
    if (!draft.soTien) continue;
    const otherMoney = drafts.some(
      (other) => other !== draft && !other.soTien && isMoneyField(other.field),
    );
    if (!otherMoney && !taken.has("outstanding")) {
      const holders = taken.get("invoiced") ?? [];
      taken.set(
        "invoiced",
        holders.filter((holder) => holder !== draft),
      );
      draft.field = "outstanding";
      claim(draft);
    }
  }

  // Pass 2: shapes for columns no synonym explained.
  for (const draft of drafts) {
    if (draft.field !== "ignore" || draft.confidence !== "low") continue;
    const shape = shapeOf(draft.cells);
    let candidate: CanonicalField | null = null;
    if (shape === "money") candidate = primaryMoneyField(template);
    else if (shape === "date") candidate = "date";
    else if (shape === "orderCode") candidate = "orderCode";
    else if (shape === "invoiceNumber") candidate = "invoiceNumber";
    if (candidate && !taken.has(candidate)) {
      draft.field = candidate;
      claim(draft);
    }
  }

  // A field claimed twice would block the run: keep the first column unless
  // both are money columns fixed to different currencies ("Số tiền / VND",
  // "Số tiền / USD").
  for (const [field, holders] of taken) {
    if (holders.length < 2) continue;
    const fixed = holders.map((holder) =>
      isMoneyField(field) ? fixedCurrencyOf(holder.header) : null,
    );
    const distinct = new Set(fixed);
    const allDistinct = !fixed.includes(null) && distinct.size === fixed.length;
    if (allDistinct) continue;
    holders.slice(1).forEach((holder) => {
      holder.field = "ignore";
      holder.confidence = "low";
    });
  }

  let usd = 0;
  let moneySamples = 0;
  const columns: ColumnProposal[] = [];
  const mappingColumns: ColumnMapping[] = [];
  for (const draft of drafts) {
    const moneyColumn = isMoneyField(draft.field);
    const dateColumn = isDateField(draft.field);
    const fixedCurrency = moneyColumn ? fixedCurrencyOf(draft.header) : null;
    if (moneyColumn) {
      const counts = usdTokenCount(draft.cells);
      moneySamples += counts.total;
      usd += fixedCurrency === "USD" ? counts.total : counts.usd;
    }
    let inferredDateOrder: ColumnProposal["inferredDateOrder"] = null;
    if (dateColumn) {
      const evidence = inferDateOrder(draft.cells);
      inferredDateOrder =
        evidence.dmyProven && evidence.mdyProven
          ? "conflict"
          : evidence.dmyProven
            ? "dmy"
            : evidence.mdyProven
              ? "mdy"
              : "assumed";
    }
    columns.push({
      columnIndex: draft.column,
      header: draft.header,
      field: draft.field,
      confidence: draft.confidence,
      suggestedMultiplier: moneyColumn
        ? (multiplierHintOf(draft.header) ?? titleMultiplier ?? "1")
        : "1",
      inferredStyle: moneyColumn ? inferColumnStyle(draft.cells) : null,
      inferredDateOrder,
      sampleValues: distinctSamples(draft.cells),
    });
    mappingColumns.push({
      columnIndex: draft.column,
      field: draft.field,
      fixedCurrency,
      unitMultiplier: "1",
      numberStyle: null,
      dateOrder: null,
    });
  }

  return {
    proposal: {
      headerSheetRowNumber: analysis.headerSheetRowNumber,
      headerFound: analysis.headerRowOffset !== null,
      columns,
      periodHint: analysis.periodHint,
      titleLines: analysis.titleLines,
    },
    mapping: {
      columns: mappingColumns,
      defaultCurrency:
        moneySamples > 0 && usd * 2 > moneySamples ? "USD" : "VND",
      period: analysis.periodHint,
      compareSellingPrice: false,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mapping validation                                                  */
/* ------------------------------------------------------------------ */

/** The template's view of a mapped field: anything it does not read is ignored. */
export function effectiveField(
  field: CanonicalField,
  template: SheetCheckTemplate,
): CanonicalField {
  const fields = templateFields[template];
  if (
    fields.required.includes(field) ||
    fields.optional.includes(field) ||
    fields.identityAnyOf.includes(field)
  ) {
    return field;
  }
  return "ignore";
}

/** Drops columns outside the grid and folds template-irrelevant fields into ignore. */
export function effectiveColumns(
  mapping: SheetMapping,
  template: SheetCheckTemplate,
  columnCount: number | null,
): ColumnMapping[] {
  return mapping.columns
    .filter(
      (column) =>
        Number.isInteger(column.columnIndex) &&
        column.columnIndex >= 0 &&
        (columnCount === null || column.columnIndex < columnCount),
    )
    .map((column) => ({
      ...column,
      field: effectiveField(column.field, template),
    }));
}

export function validateMapping(
  mapping: SheetMapping,
  template: SheetCheckTemplate,
  rows: readonly SheetRow[],
): Issue[] {
  const issues: Issue[] = [];
  const columnCount = rows[0]?.cells.length ?? null;
  const columns = effectiveColumns(mapping, template, columnCount);
  const mapped = new Set(columns.map((column) => column.field));
  const fields = templateFields[template];

  const missingRequired = fields.required.filter((field) => !mapped.has(field));
  if (missingRequired.length > 0) {
    issues.push(
      issue("REQUIRED_COLUMN_MISSING", {
        fields: missingRequired
          .map((field) => fieldLabels[field].vi)
          .join(", "),
      }),
    );
  }
  const identityMapped = fields.identityAnyOf.some((field) =>
    mapped.has(field),
  );
  const identityCovered = fields.identityAnyOf.every((field) =>
    missingRequired.includes(field),
  );
  if (!identityMapped && !identityCovered) {
    issues.push(
      issue("REQUIRED_COLUMN_MISSING", {
        fields: fields.identityAnyOf
          .map((field) => fieldLabels[field].vi)
          .join(" / "),
      }),
    );
  }

  const holders = new Map<CanonicalField, ColumnMapping[]>();
  for (const column of columns) {
    if (column.field === "ignore") continue;
    const list = holders.get(column.field) ?? [];
    list.push(column);
    holders.set(column.field, list);
  }
  for (const [field, list] of holders) {
    if (list.length < 2) continue;
    const first = list[0];
    if (!first) continue;
    for (const other of list.slice(1)) {
      const distinctCurrencies =
        isMoneyField(field) &&
        first.fixedCurrency !== null &&
        other.fixedCurrency !== null &&
        list.every((column) => column.fixedCurrency !== null) &&
        new Set(list.map((column) => column.fixedCurrency)).size ===
          list.length;
      if (distinctCurrencies) continue;
      issues.push(
        issue("MAPPING_CONFLICT", {
          a: columnLabel(first.columnIndex),
          b: columnLabel(other.columnIndex),
          field: fieldLabels[field].vi,
        }),
      );
    }
  }

  for (const column of columns) {
    if (!isDateField(column.field) || column.dateOrder !== null) continue;
    const evidence = inferDateOrder(dataCellsOf(rows, column.columnIndex));
    if (evidence.dmyProven && evidence.mdyProven) {
      issues.push(
        issue(
          "DATE_ORDER_CONFLICT",
          { header: columnLabel(column.columnIndex) },
          { columnIndex: column.columnIndex },
        ),
      );
    }
  }
  return issues;
}
