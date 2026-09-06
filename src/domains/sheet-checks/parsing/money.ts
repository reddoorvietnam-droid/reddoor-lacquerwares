import { Decimal } from "decimal.js";

import type {
  ColumnNumberStyle,
  MoneyField,
  NumberStyle,
  SheetCell,
  SheetCheckTemplate,
  UnitMultiplier,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { money, MoneyError, type Currency, type Money } from "@/lib/money";

/**
 * Money cells as accountants type them: "1.250.000", "1,250.00", "(500)",
 * "US$ 1.250,00", "1.250.000,-". Every reading goes through decimal.js and
 * `money()`; a JS number is only ever the raw double SheetJS handed over
 * for an `n` cell, and it is converted to a Decimal before anything else.
 * Nothing here is rounded silently: typed text with too many decimals is an
 * error, a numeric cell with hidden decimals is compared as displayed and
 * flagged.
 */

/** Where the currency of a parsed cell came from. */
export type CurrencySource = "cell" | "column" | "fixed" | "default";

export type MoneyParseContext = {
  /** "1"|"1000"|"1000000" — applied after parsing (Decimal multiply). */
  unitMultiplier: UnitMultiplier;
  /** Decided per column in a pre-pass. */
  columnStyle: ColumnNumberStyle;
  /** Currency the header fixes for this column, if any. */
  fixedCurrency: Currency | null;
  /** Value of the mapped currency column on this row (raw text), if any. */
  currencyCellText: string | null;
  defaultCurrency: Currency;
  template: SheetCheckTemplate;
  field: MoneyField;
};

export type MoneyParseResult = {
  /** Decimal string at the currency scale, or null when blank/unparsable. */
  amount: string | null;
  currency: Currency | null;
  /** Style this cell's own form proves, if any. */
  style: NumberStyle | null;
  /** True for "", "-", "N/A"… (no issue raised here). */
  blank: boolean;
  /** How the currency was settled; null when blank or unresolved. */
  currencySource: CurrencySource | null;
  issues: Issue[];
};

/** Minor-unit digits per currency; `@/lib/money` keeps its table private. */
export const moneyScale: Record<Currency, number> = { VND: 0, USD: 2 };

const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
/** Spaces NFKC leaves alone (figure/thin spaces are already folded). */
const ODD_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const PLACEHOLDERS = new Set([
  "",
  "-",
  "–",
  "—",
  "n/a",
  "na",
  "#n/a",
  "null",
  "none",
]);

/** NFKC, exotic spaces → space, zero-width characters removed, trimmed. */
export function cleanCellText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ZERO_WIDTH, "")
    .replace(ODD_SPACES, " ")
    .trim();
}

/** "", "-", "N/A"… — a cell that holds no value. */
export function isPlaceholderText(text: string): boolean {
  return PLACEHOLDERS.has(cleanCellText(text).toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Currency tokens                                                     */
/* ------------------------------------------------------------------ */

const UNSUPPORTED_TOKEN =
  /[€£¥]|(?<![A-Za-z])(?:EUR|GBP|JPY|CNY|RMB|AUD|SGD)(?![A-Za-z])/i;

/**
 * Supported tokens inside cell text. Order matters at a given position:
 * "US$" before "$", "VND"/"đồng" before a lone "đ", and a bare "d" only
 * right after the last digit ("1.250.000d").
 */
const CELL_CURRENCY_TOKEN =
  /US\$|(?<![A-Za-z])USD(?![A-Za-z])|(?<![A-Za-z])VN[DĐ](?![A-Za-z])|(?<![\p{L}])(?:[đĐ]ồng|dong)(?![\p{L}])|₫|[đĐ](?![\p{L}])|\$|(?<=\d)[dD](?![A-Za-z0-9])/giu;

/** Tokens inside number-format literals; no bare "d" (it is a date code there). */
const FORMAT_CURRENCY_TOKEN =
  /US\$|(?<![A-Za-z])USD(?![A-Za-z])|(?<![A-Za-z])VN[DĐ](?![A-Za-z])|₫|[đĐ]|\$/giu;

function currencyOfToken(token: string): Currency {
  return /\$|usd/i.test(token) ? "USD" : "VND";
}

/**
 * Excel writes other dollar currencies as `[$CA$-1009]`, `[$A$-C09]`,
 * `[$S$-1004]`, `[$HK$-C04]`. The bare `$` inside must not read as USD.
 */
const FOREIGN_DOLLAR_FORMAT = /(?:^|[^A-Za-z])(CA|A|S|HK|NT|NZ|R|C)\$/;

const VND_WORDS = new Set(["VND", "VNĐ", "Đ", "₫", "D", "ĐỒNG", "DONG"]);
const USD_WORDS = new Set(["USD", "$", "US$"]);

/** VND/VNĐ/đ/₫/D → VND; USD/$/US$ → USD; blank → null; anything else → "INVALID". */
export function parseCurrencyText(text: string): Currency | "INVALID" | null {
  const cleaned = cleanCellText(text);
  if (PLACEHOLDERS.has(cleaned.toLowerCase())) return null;
  const upper = cleaned.toUpperCase();
  if (VND_WORDS.has(upper)) return "VND";
  if (USD_WORDS.has(upper)) return "USD";
  return "INVALID";
}

type TokenScan = {
  /** Distinct currencies named, in order of appearance. */
  currencies: Currency[];
  /** The text with the tokens removed. */
  remainder: string;
};

function scanCellTokens(text: string): TokenScan {
  const currencies: Currency[] = [];
  const remainder = text.replace(CELL_CURRENCY_TOKEN, (token) => {
    const currency = currencyOfToken(token);
    if (!currencies.includes(currency)) currencies.push(currency);
    return " ";
  });
  return { currencies, remainder: remainder.replace(/\s+/g, " ").trim() };
}

type FormatScan = {
  currencies: Currency[];
  unsupported: string | null;
  percent: boolean;
};

/**
 * Reads the literal parts of an Excel number format: `[$€-2]`-style
 * sections, quoted strings, backslash escapes and bare symbols. Format
 * codes (d, m, y, 0, #) are skipped so a date format never reads as VND.
 */
function scanNumberFormat(format: string): FormatScan {
  const literals: string[] = [];
  let percent = false;
  let index = 0;
  while (index < format.length) {
    const char = format[index] ?? "";
    if (char === "[") {
      const close = format.indexOf("]", index);
      const section = format.slice(index + 1, close === -1 ? undefined : close);
      if (section.startsWith("$")) {
        const dash = section.lastIndexOf("-");
        literals.push(dash === -1 ? section.slice(1) : section.slice(1, dash));
      }
      index = close === -1 ? format.length : close + 1;
    } else if (char === '"') {
      const close = format.indexOf('"', index + 1);
      literals.push(format.slice(index + 1, close === -1 ? undefined : close));
      index = close === -1 ? format.length : close + 1;
    } else if (char === "\\") {
      literals.push(format[index + 1] ?? "");
      index += 2;
    } else {
      if (char === "%") percent = true;
      if (/[$₫đĐ]/u.test(char)) literals.push(char);
      index += 1;
    }
  }
  const literal = literals.join(" ");
  const foreignDollar = FOREIGN_DOLLAR_FORMAT.exec(literal);
  const unsupported = UNSUPPORTED_TOKEN.exec(literal) ?? foreignDollar;
  const currencies: Currency[] = [];
  for (const match of literal.matchAll(FORMAT_CURRENCY_TOKEN)) {
    const currency = currencyOfToken(match[0]);
    if (!currencies.includes(currency)) currencies.push(currency);
  }
  return {
    currencies,
    unsupported: unsupported ? unsupported[0] : null,
    percent,
  };
}

/* ------------------------------------------------------------------ */
/* Currency resolution                                                 */
/* ------------------------------------------------------------------ */

type CurrencyResolution =
  | { currency: Currency; source: CurrencySource; issues: Issue[] }
  | { currency: null; source: null; issues: Issue[] };

/** First hit wins: cell token > currency column > fixed header > default; disagreement is an error. */
function resolveCurrency(
  cellToken: Currency | null,
  ctx: MoneyParseContext,
): CurrencyResolution {
  const columnValue =
    ctx.currencyCellText === null
      ? null
      : parseCurrencyText(ctx.currencyCellText);
  if (columnValue === "INVALID") {
    return {
      currency: null,
      source: null,
      issues: [issue("CURRENCY_INVALID", { raw: ctx.currencyCellText ?? "" })],
    };
  }
  const conflict = (a: Currency, b: Currency): CurrencyResolution => ({
    currency: null,
    source: null,
    issues: [issue("CURRENCY_CONFLICT", { a, b })],
  });
  if (cellToken) {
    if (columnValue && columnValue !== cellToken) {
      return conflict(cellToken, columnValue);
    }
    if (ctx.fixedCurrency && ctx.fixedCurrency !== cellToken) {
      return conflict(cellToken, ctx.fixedCurrency);
    }
    return { currency: cellToken, source: "cell", issues: [] };
  }
  if (columnValue) {
    if (ctx.fixedCurrency && ctx.fixedCurrency !== columnValue) {
      return conflict(columnValue, ctx.fixedCurrency);
    }
    return { currency: columnValue, source: "column", issues: [] };
  }
  if (ctx.fixedCurrency) {
    return { currency: ctx.fixedCurrency, source: "fixed", issues: [] };
  }
  return { currency: ctx.defaultCurrency, source: "default", issues: [] };
}

/* ------------------------------------------------------------------ */
/* Text bodies                                                         */
/* ------------------------------------------------------------------ */

type Body = { digits: string; negative: boolean };

const THOUSAND_GROUP = /^\d{3}$/;
const FIRST_GROUP = /^\d{1,3}$/;
const LAST_SPACED_GROUP = /^\d{3}(?:[.,]\d{1,6})?$/;

/**
 * Steps 4–7 of the text grammar: trailing ",-", accounting minus, sign and
 * parentheses, spaced/apostrophe thousand groups, then the digit body.
 * Returns null when the text cannot be a number.
 */
function extractBody(remainder: string): Body | null {
  let text = remainder.replace(/[.,]-$/, "").trim();
  let negative = false;
  if (text.endsWith("-")) {
    negative = true;
    text = text.slice(0, -1).trim();
  }
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  }
  const sign = /^([-−–+])\s*/.exec(text);
  if (sign) {
    if (sign[1] !== "+") negative = true;
    text = text.slice(sign[0].length);
  }
  if (/[ ']/.test(text)) {
    const groups = text.split(/[ ']/);
    const first = groups[0] ?? "";
    const last = groups[groups.length - 1] ?? "";
    const middle = groups.slice(1, -1);
    if (
      groups.length < 2 ||
      !FIRST_GROUP.test(first) ||
      !middle.every((group) => THOUSAND_GROUP.test(group)) ||
      !LAST_SPACED_GROUP.test(last)
    ) {
      return null;
    }
    text = groups.join("");
  }
  if (!/^\d[\d.,]*$/.test(text)) return null;
  return { digits: text, negative };
}

type Reading =
  | { kind: "integer"; value: string }
  | { kind: "decimal"; value: string; style: NumberStyle }
  | { kind: "thousands"; value: string; style: NumberStyle }
  /** One separator followed by exactly three digits: "12.500". */
  | {
      kind: "ambiguous";
      separator: "." | ",";
      asThousands: string;
      asDecimal: string;
    }
  | { kind: "invalid" };

const INVALID: Reading = { kind: "invalid" };

function groupsValid(integer: string, separator: string): boolean {
  const groups = integer.split(separator);
  return (
    FIRST_GROUP.test(groups[0] ?? "") &&
    groups.slice(1).every((group) => THOUSAND_GROUP.test(group))
  );
}

function styleOfDecimalSeparator(separator: string): NumberStyle {
  return separator === "," ? "vi" : "en";
}

/** Step 8: which separator means what, decided from the cell's own form. */
function readSeparators(digits: string): Reading {
  const dots = digits.split(".").length - 1;
  const commas = digits.split(",").length - 1;
  if (dots === 0 && commas === 0) return { kind: "integer", value: digits };

  if (dots >= 1 && commas >= 1) {
    const decimalSep =
      digits.lastIndexOf(".") > digits.lastIndexOf(",") ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    if ((decimalSep === "." ? dots : commas) !== 1) return INVALID;
    const at = digits.lastIndexOf(decimalSep);
    const integer = digits.slice(0, at);
    const fraction = digits.slice(at + 1);
    if (!/^\d{1,6}$/.test(fraction) || !groupsValid(integer, thousandsSep)) {
      return INVALID;
    }
    return {
      kind: "decimal",
      value: `${integer.split(thousandsSep).join("")}.${fraction}`,
      style: styleOfDecimalSeparator(decimalSep),
    };
  }

  const separator = dots > 0 ? "." : ",";
  const count = dots > 0 ? dots : commas;
  if (count >= 2) {
    if (!groupsValid(digits, separator)) return INVALID;
    return {
      kind: "thousands",
      value: digits.split(separator).join(""),
      style: separator === "." ? "vi" : "en",
    };
  }

  const at = digits.indexOf(separator);
  const integer = digits.slice(0, at);
  const fraction = digits.slice(at + 1);
  if (fraction.length === 0 || fraction.length >= 4) return INVALID;
  if (fraction.length <= 2) {
    return {
      kind: "decimal",
      value: `${integer}.${fraction}`,
      style: styleOfDecimalSeparator(separator),
    };
  }
  // Three digits after the only separator: a thousands group or three
  // decimals. A first group longer than three digits rules thousands out.
  if (!FIRST_GROUP.test(integer)) {
    return {
      kind: "decimal",
      value: `${integer}.${fraction}`,
      style: styleOfDecimalSeparator(separator),
    };
  }
  return {
    kind: "ambiguous",
    separator,
    asThousands: `${integer}${fraction}`,
    asDecimal: `${integer}.${fraction}`,
  };
}

/** The style a text cell proves on its own, for the column pre-pass. */
function styleVote(text: string): NumberStyle | null {
  const cleaned = cleanCellText(text);
  if (PLACEHOLDERS.has(cleaned.toLowerCase())) return null;
  if (UNSUPPORTED_TOKEN.test(cleaned)) return null;
  const body = extractBody(scanCellTokens(cleaned).remainder);
  if (!body) return null;
  const reading = readSeparators(body.digits);
  return reading.kind === "decimal" || reading.kind === "thousands"
    ? reading.style
    : null;
}

/**
 * Column pre-pass: every text cell whose form is unambiguous casts a vote.
 * Agreement → that style; disagreement → "mixed"; no votes → "unknown".
 */
export function inferColumnStyle(
  cells: readonly SheetCell[],
): ColumnNumberStyle {
  let vi = false;
  let en = false;
  for (const cell of cells) {
    if (cell.type !== "s" || cell.noCache) continue;
    const vote = styleVote(cell.text);
    if (vote === "vi") vi = true;
    if (vote === "en") en = true;
  }
  if (vi && en) return "mixed";
  if (vi) return "vi";
  if (en) return "en";
  return "unknown";
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function blankResult(): MoneyParseResult {
  return {
    amount: null,
    currency: null,
    style: null,
    blank: true,
    currencySource: null,
    issues: [],
  };
}

function failed(
  issues: Issue[],
  style: NumberStyle | null = null,
): MoneyParseResult {
  return {
    amount: null,
    currency: null,
    style,
    blank: false,
    currencySource: null,
    issues,
  };
}

function isMoneyTemplate(template: SheetCheckTemplate): boolean {
  return template === "incomingCash" || template === "receivables";
}

function applyMultiplier(value: Decimal, multiplier: UnitMultiplier): Decimal {
  return multiplier === "1" ? value : value.times(new Decimal(multiplier));
}

/**
 * Steps 12–13: build the Money value and judge it (sign, zero, plausibility).
 * `value` is already at the currency scale.
 */
function finish(
  value: Decimal,
  currency: Currency,
  source: CurrencySource,
  style: NumberStyle | null,
  raw: string,
  ctx: MoneyParseContext,
  issues: Issue[],
): MoneyParseResult {
  // A parenthesised zero would otherwise read "-0".
  const normalized = value.isZero() ? new Decimal(0) : value;
  let built: Money;
  try {
    built = money(normalized.toFixed(), currency);
  } catch (error) {
    if (error instanceof MoneyError) {
      return failed([...issues, issue("AMOUNT_NOT_NUMBER", { raw })], style);
    }
    throw error;
  }
  const amount = new Decimal(built.amount);
  if (
    amount.isNegative() &&
    ctx.template === "incomingCash" &&
    ctx.field === "amount"
  ) {
    issues.push(issue("AMOUNT_NEGATIVE"));
  }
  if (amount.isZero()) {
    issues.push(
      issue(
        "AMOUNT_ZERO",
        {},
        ctx.template === "incomingCash" ? {} : { severity: "info" },
      ),
    );
  }
  if (isMoneyTemplate(ctx.template)) {
    const magnitude = amount.abs();
    if (currency === "VND") {
      if (
        !magnitude.isZero() &&
        magnitude.lessThan(sheetCheckLimits.vndUnitSuspectBelow)
      ) {
        issues.push(issue("AMOUNT_UNIT_SUSPECT", { raw }));
      }
      if (magnitude.greaterThan(sheetCheckLimits.vndImplausibleAbove)) {
        issues.push(issue("AMOUNT_IMPLAUSIBLE", { raw }));
      }
    } else if (magnitude.greaterThan(sheetCheckLimits.usdImplausibleAbove)) {
      issues.push(issue("AMOUNT_IMPLAUSIBLE", { raw }));
    }
  }
  return {
    amount: built.amount,
    currency,
    style,
    blank: false,
    currencySource: source,
    issues,
  };
}

const MAX_NUMERIC_MAGNITUDE = new Decimal("1e15");

/** Section A: a numeric cell, read from the stored double and its number format. */
function parseNumericCell(
  cell: SheetCell,
  ctx: MoneyParseContext,
): MoneyParseResult {
  const raw = cell.text;
  const value = cell.number;
  if (
    value === null ||
    !Number.isFinite(value) ||
    new Decimal(value).abs().greaterThanOrEqualTo(MAX_NUMERIC_MAGNITUDE)
  ) {
    return failed([issue("AMOUNT_NOT_NUMBER", { raw })]);
  }
  const format = scanNumberFormat(cell.numberFormat ?? "");
  if (format.percent) return failed([issue("AMOUNT_NOT_NUMBER", { raw })]);
  if (format.unsupported) {
    return failed([issue("CURRENCY_UNSUPPORTED", { raw: format.unsupported })]);
  }
  if (format.currencies.length > 1) {
    return failed([
      issue("CURRENCY_CONFLICT", {
        a: format.currencies[0] ?? "",
        b: format.currencies[1] ?? "",
      }),
    ]);
  }
  const resolved = resolveCurrency(format.currencies[0] ?? null, ctx);
  if (resolved.currency === null) return failed(resolved.issues);

  const issues: Issue[] = [];
  // Six places absorb binary noise (0.30000000000000004) without touching
  // any decimal a person could have typed.
  const scaled = applyMultiplier(
    new Decimal(value).toDecimalPlaces(6),
    ctx.unitMultiplier,
  );
  const scale = moneyScale[resolved.currency];
  let used = scaled;
  if (scaled.decimalPlaces() > scale) {
    used = scaled.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
    issues.push(
      issue("AMOUNT_HIDDEN_DECIMALS", {
        raw: scaled.toFixed(),
        used: used.toFixed(scale),
      }),
    );
  }
  return finish(
    used,
    resolved.currency,
    resolved.source,
    null,
    raw,
    ctx,
    issues,
  );
}

/** Section B: a text cell, steps 1–13. */
function parseTextCell(
  cell: SheetCell,
  ctx: MoneyParseContext,
): MoneyParseResult {
  const raw = cell.text;
  const cleaned = cleanCellText(raw);
  if (PLACEHOLDERS.has(cleaned.toLowerCase())) return blankResult();

  if (UNSUPPORTED_TOKEN.test(cleaned)) {
    return failed([issue("CURRENCY_UNSUPPORTED", { raw })]);
  }
  const tokens = scanCellTokens(cleaned);
  if (tokens.currencies.length > 1) {
    return failed([
      issue("CURRENCY_CONFLICT", {
        a: tokens.currencies[0] ?? "",
        b: tokens.currencies[1] ?? "",
      }),
    ]);
  }
  const resolved = resolveCurrency(tokens.currencies[0] ?? null, ctx);
  if (resolved.currency === null) return failed(resolved.issues);
  const currency = resolved.currency;

  const body = extractBody(tokens.remainder);
  if (!body) return failed([issue("AMOUNT_NOT_NUMBER", { raw })]);
  const reading = readSeparators(body.digits);
  if (reading.kind === "invalid") {
    return failed([issue("AMOUNT_NOT_NUMBER", { raw })]);
  }

  const issues: Issue[] = [];
  let plain: string;
  let style: NumberStyle | null = null;
  /** Fraction digits as typed; "12.500" read as a decimal has three. */
  let typedDecimals = 0;
  if (reading.kind === "ambiguous") {
    // Rule 8d n=3: the column's decided style wins; VND has no decimals so
    // the thousands reading is the only sensible one; otherwise read as
    // thousands and say so.
    const decidedDecimalSeparator =
      ctx.columnStyle === "vi" ? "," : ctx.columnStyle === "en" ? "." : null;
    if (decidedDecimalSeparator !== null) {
      if (reading.separator === decidedDecimalSeparator) {
        plain = reading.asDecimal;
        typedDecimals = 3;
      } else {
        plain = reading.asThousands;
      }
    } else {
      plain = reading.asThousands;
      if (currency !== "VND") {
        const thousands = applyMultiplier(
          new Decimal(reading.asThousands),
          ctx.unitMultiplier,
        );
        issues.push(
          issue("AMOUNT_AMBIGUOUS", {
            raw,
            asThousands: thousands.toFixed(moneyScale[currency]),
            asDecimal: reading.asDecimal,
          }),
        );
      }
    }
  } else {
    plain = reading.value;
    if (reading.kind !== "integer") style = reading.style;
    if (reading.kind === "decimal") {
      typedDecimals = plain.length - plain.indexOf(".") - 1;
    }
  }

  // Typed text is never rounded: a USD figure with three decimals is
  // malformed even when the third is a zero, and a VND figure may carry
  // only a zero fraction ("1,250.00" → 1250).
  if (currency === "USD" && typedDecimals > moneyScale.USD) {
    return failed([...issues, issue("AMOUNT_SCALE", { raw })], style);
  }
  let value = applyMultiplier(new Decimal(plain), ctx.unitMultiplier);
  if (body.negative) value = value.negated();
  if (value.decimalPlaces() > moneyScale[currency]) {
    return failed([...issues, issue("AMOUNT_SCALE", { raw })], style);
  }
  return finish(value, currency, resolved.source, style, raw, ctx, issues);
}

/**
 * Parses one money cell. Error cells are the row parser's business
 * (CELL_ERROR_VALUE) but still fail here rather than pass silently.
 */
export function parseMoneyCell(
  cell: SheetCell,
  ctx: MoneyParseContext,
): MoneyParseResult {
  if (cell.noCache || cell.type === "z") return blankResult();
  switch (cell.type) {
    case "n":
      return parseNumericCell(cell, ctx);
    case "s":
      return parseTextCell(cell, ctx);
    case "b":
    case "e":
      return failed([issue("AMOUNT_NOT_NUMBER", { raw: cell.text })]);
  }
}

/* ------------------------------------------------------------------ */
/* Money helpers shared with the reconciliation                        */
/* ------------------------------------------------------------------ */

/** "25000000 VND" — the param form of a money value. */
export function moneyText(value: Money): string {
  return `${value.amount} ${value.currency}`;
}

/**
 * Bank-fee tolerance for a system figure: ratio × |amount|, capped, but
 * never below the per-currency floor (a 1,000 ₫ fee on a small transfer is
 * still a fee).
 */
export function feeToleranceFor(base: Money): Money {
  const { ratio, capVnd, capUsd, floorVnd, floorUsd } =
    sheetCheckLimits.feeTolerance;
  const cap = base.currency === "VND" ? capVnd : capUsd;
  const floor = base.currency === "VND" ? floorVnd : floorUsd;
  const scale = moneyScale[base.currency];
  const proportional = new Decimal(base.amount).abs().times(ratio);
  const tolerance = Decimal.max(Decimal.min(proportional, cap), floor);
  return money(
    tolerance.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toFixed(scale),
    base.currency,
  );
}

/** |sheet − system| within the fee tolerance of the system figure; never across currencies. */
export function withinFeeTolerance(sheet: Money, system: Money): boolean {
  if (sheet.currency !== system.currency) return false;
  const difference = new Decimal(sheet.amount).minus(system.amount).abs();
  return difference.lessThanOrEqualTo(feeToleranceFor(system).amount);
}
