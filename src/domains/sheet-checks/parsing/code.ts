import { Decimal } from "decimal.js";

import {
  orderStageDefinitions,
  orderStages,
  type OrderStage,
} from "@/domains/orders/workflow";
import type { SheetCell } from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import {
  cleanCellText,
  isPlaceholderText,
} from "@/domains/sheet-checks/parsing/money";

/**
 * Identifiers as they appear in spreadsheets: order codes, invoice numbers,
 * customer codes, customer names and order stages typed by hand. Codes are
 * normalised (NFKC, dashes, case) but never guessed: a code that does not
 * survive normalisation is reported, not corrected, and a code never goes
 * through a JS number (leading zeros are part of the identity).
 */

export type CodeParseResult = {
  code: string | null;
  blank: boolean;
  issues: Issue[];
};

const ORDER_CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const ORDER_CODE_MAX = 40;
const INVOICE_NUMBER_MAX = 60;
const CUSTOMER_CODE_MAX = 80;
/** "20260906-E2E1": the house order code without its "RD-" prefix. */
const BARE_ORDER_CODE = /^\d{8}-[A-Z0-9]{4}$/;
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2212]/g;
const NON_ASCII = /[^\x20-\x7E]/;
const SCIENTIFIC_FORMAT = /e[+-]/i;
const SCIENTIFIC_TEXT = /\d[eE][+-]?\d/;
/** Safe-integer ceiling: beyond it the double has already lost digits. */
const MAX_EXACT_INTEGER = new Decimal("9007199254740991");

function blank(): CodeParseResult {
  return { code: null, blank: true, issues: [] };
}

function invalid(
  code: "CODE_INVALID" | "CODE_NOT_TEXT" | "CODE_SUSPICIOUS_CHARS",
  raw: string,
): CodeParseResult {
  return { code: null, blank: false, issues: [issue(code, { raw })] };
}

/**
 * A numeric cell holding a code. Integers become their digits (padded to a
 * "000000" format width when the sheet displayed them that way); decimals
 * and scientific notation cannot be a code.
 */
function digitsOfNumericCell(cell: SheetCell): CodeParseResult {
  const value = cell.number;
  const format = cell.numberFormat ?? "";
  if (
    value === null ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    SCIENTIFIC_FORMAT.test(format) ||
    SCIENTIFIC_TEXT.test(cell.text)
  ) {
    return invalid("CODE_NOT_TEXT", cell.text);
  }
  const decimal = new Decimal(value);
  if (decimal.abs().greaterThan(MAX_EXACT_INTEGER) || decimal.isNegative()) {
    return invalid("CODE_NOT_TEXT", cell.text);
  }
  const digits = decimal.toFixed(0);
  const zeroFormat = /^0+$/.exec(format);
  if (zeroFormat) {
    return {
      code: digits.padStart(zeroFormat[0].length, "0"),
      blank: false,
      issues: [],
    };
  }
  // A displayed text such as "000123" already carries the zeros Excel kept.
  const shown = cleanCellText(cell.text);
  if (/^0+\d+$/.test(shown) && shown.replace(/^0+/, "") === digits) {
    return { code: shown, blank: false, issues: [] };
  }
  return {
    code: digits,
    blank: false,
    issues: [issue("CODE_NUMERIC_CELL", { raw: cell.text })],
  };
}

/**
 * Order codes: NFKC, zero-width removed, dashes unified, spaces removed,
 * uppercase; ASCII letters/digits with single dashes only, ≤ 40 chars. A
 * bare "20260906-E2E1" gains the "RD-" prefix; every change is reported as
 * CODE_NORMALIZED so the reader can see what was matched.
 */
export function normalizeOrderCode(cell: SheetCell): CodeParseResult {
  if (cell.noCache || cell.type === "z") return blank();
  if (cell.type === "n") return digitsOfNumericCell(cell);
  if (cell.type !== "s") return invalid("CODE_INVALID", cell.text);
  if (isPlaceholderText(cell.text)) return blank();

  const raw = cell.text.trim();
  const normalized = cleanCellText(raw)
    .replace(DASHES, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
  if (NON_ASCII.test(normalized)) {
    return invalid("CODE_SUSPICIOUS_CHARS", raw);
  }
  if (!ORDER_CODE.test(normalized)) return invalid("CODE_INVALID", raw);
  const code = BARE_ORDER_CODE.test(normalized)
    ? `RD-${normalized}`
    : normalized;
  if (code.length > ORDER_CODE_MAX) return invalid("CODE_INVALID", raw);
  return {
    code,
    blank: false,
    issues: code === raw ? [] : [issue("CODE_NORMALIZED", { raw, code })],
  };
}

/** Invoice and customer codes: NFKC, trim, uppercase, single internal spaces; "/" and "-" kept. */
function normalizeLooseCode(
  cell: SheetCell,
  maxLength: number,
): CodeParseResult {
  if (cell.noCache || cell.type === "z") return blank();
  if (cell.type === "n") return digitsOfNumericCell(cell);
  if (cell.type !== "s") return invalid("CODE_INVALID", cell.text);
  if (isPlaceholderText(cell.text)) return blank();

  const raw = cell.text.trim();
  const code = cleanCellText(raw)
    .replace(DASHES, "-")
    .replace(/\s+/g, " ")
    .toUpperCase();
  // Control characters cannot be part of a number a person typed.
  if (code.length > maxLength || /[\p{Cc}]/u.test(code)) {
    return invalid("CODE_INVALID", raw);
  }
  return { code, blank: false, issues: [] };
}

export function normalizeInvoiceNumber(cell: SheetCell): CodeParseResult {
  return normalizeLooseCode(cell, INVOICE_NUMBER_MAX);
}

export function normalizeCustomerCode(cell: SheetCell): CodeParseResult {
  return normalizeLooseCode(cell, CUSTOMER_CODE_MAX);
}

/** NFD, marks removed, đ→d, lowercase — the diacritics-insensitive form. */
export function stripDiacritics(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Alnum-only uppercase key ("INV-0001" → "INV0001"), for loose invoice matching. */
export function looseKey(text: string): string {
  return stripDiacritics(text)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Legal-form words (diacritics stripped), longest phrases first. */
const LEGAL_FORM_PHRASES = [
  "mot thanh vien",
  "cong ty",
  "co phan",
  "corporation",
  "limited",
  "company",
  "tnhh",
  "corp",
  "jsc",
  "inc",
  "ltd",
  "cty",
  "mtv",
  "co",
  "cp",
];

/**
 * Name key: diacritics stripped, legal-form tokens removed, punctuation
 * removed, single spaces — so "Cty TNHH ABC Import" and "Công ty TNHH ABC
 * Import" compare equal.
 */
export function normalizeName(text: string): string {
  let key = ` ${stripDiacritics(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
  for (const phrase of LEGAL_FORM_PHRASES) {
    key = key.split(` ${phrase} `).join(" ");
  }
  return key.replace(/\s+/g, " ").trim();
}

const STAGE_SYNONYMS: Record<OrderStage, readonly string[]> = {
  received: ["đã nhận", "mới", "tiếp nhận", "new", "received"],
  fileOpened: ["mở hồ sơ", "hồ sơ"],
  awaitingDirectorApproval: ["chờ duyệt", "chờ giám đốc", "awaiting approval"],
  productionPlanning: ["kế hoạch sản xuất", "lập kế hoạch", "planning"],
  inventoryCheck: ["kiểm kho", "tồn kho", "inventory"],
  materialProcurement: ["mua vật tư", "mua nguyên liệu", "procurement"],
  materialIssued: ["xuất vật tư", "cấp vật tư", "issued"],
  inProduction: ["đang sản xuất", "sản xuất", "production"],
  qualityControl: ["qc", "kiểm tra chất lượng", "kcs", "quality"],
  packing: ["đóng gói", "packing"],
  tradeDocumentation: ["chứng từ", "hồ sơ xuất khẩu", "documentation"],
  loadingScheduled: ["lịch đóng hàng", "đóng hàng", "loading"],
  shipped: ["đã giao", "đã xuất", "xuất hàng", "shipped", "delivered"],
  invoiced: ["đã xuất hóa đơn", "hóa đơn", "invoiced"],
  settled: ["đã thanh toán", "tất toán", "settled", "paid"],
  closed: ["đã đóng", "hoàn thành", "closed", "done"],
  cancelled: ["hủy", "huỷ", "cancelled", "canceled"],
};

function stagePhraseKey(text: string): string {
  return stripDiacritics(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every phrase that names a stage, normalised once; longest phrases first. */
const STAGE_PATTERNS: ReadonlyArray<{ phrase: string; stage: OrderStage }> =
  orderStages
    .flatMap((stage) => {
      const definition = orderStageDefinitions[stage];
      return [
        stage,
        definition.labels.vi,
        definition.labels.en,
        ...STAGE_SYNONYMS[stage],
      ].map((phrase) => ({ phrase: stagePhraseKey(phrase), stage }));
    })
    .filter((entry) => entry.phrase.length > 0)
    .sort((a, b) => b.phrase.length - a.phrase.length);

/**
 * Order stage from free text: the stage key itself, a vi/en label or a
 * synonym, matched on whole words after stripping diacritics; the longest
 * phrase wins ("đã xuất hóa đơn" is invoiced, not shipped).
 */
export function stageFromText(text: string): OrderStage | null {
  const key = stagePhraseKey(text);
  if (key.length === 0) return null;
  const padded = ` ${key} `;
  for (const { phrase, stage } of STAGE_PATTERNS) {
    if (padded.includes(` ${phrase} `)) return stage;
  }
  return null;
}
