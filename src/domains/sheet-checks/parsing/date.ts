import * as XLSX from "xlsx";

import type {
  DateField,
  DateOrder,
  DateOrderSource,
  SheetCell,
  SheetPeriod,
} from "@/domains/sheet-checks/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { stripDiacritics } from "@/domains/sheet-checks/parsing/code";
import {
  cleanCellText,
  isPlaceholderText,
} from "@/domains/sheet-checks/parsing/money";
import { daysBetween, formatBusinessDay } from "@/domains/tasks/policy";

/**
 * Date cells as they arrive from Excel and from people: serials with a
 * date format, "15/08/2026", "5/6/26", "15 tháng 8 2026", "Aug 15, 2026",
 * "15/8" inside a known period. Every result is a business day string
 * (`YYYY-MM-DD`); no JS Date parsing is ever involved, and the day/month
 * order is a column decision handed in through the context, never a guess
 * made cell by cell.
 */

export type DateParseContext = {
  date1904: boolean;
  /** Effective order for the column. */
  columnOrder: DateOrder;
  columnOrderSource: DateOrderSource;
  period: SheetPeriod | null;
  field: DateField;
  /** Business day today, YYYY-MM-DD. */
  today: string;
};

export type DateParseResult = {
  day: string | null;
  blank: boolean;
  issues: Issue[];
};

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function formatDay(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidCalendarDay(
  year: number,
  month: number,
  day: number,
): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/** Calendar arithmetic on a `YYYY-MM-DD` string; no time zone is involved. */
export function addDays(day: string, days: number): string {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got "${day}".`);
  const [, year, month, date] = match;
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(date) + days),
  )
    .toISOString()
    .slice(0, 10);
}

/** YYYY-MM-DD of an instant in the business zone (wraps formatBusinessDay). */
export function businessDayOf(instant: Date, timeZone: string): string {
  return formatBusinessDay(instant, timeZone);
}

/* ------------------------------------------------------------------ */
/* Excel serials                                                       */
/* ------------------------------------------------------------------ */

type CalendarDate = { year: number; month: number; day: number };

/** Typed wrapper around SheetJS' untyped SSF; null when the serial is outside Excel's range. */
function serialToDate(serial: number, date1904: boolean): CalendarDate | null {
  const parsed: unknown = XLSX.SSF.parse_date_code(serial, { date1904 });
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const { y, m, d } = record;
  if (typeof y !== "number" || typeof m !== "number" || typeof d !== "number") {
    return null;
  }
  return { year: y, month: m, day: d };
}

/* ------------------------------------------------------------------ */
/* Text grammar                                                        */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_NAME = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
const TIME_SUFFIX = String.raw`(?:[t ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?\s*(?:z|[+-]\d{2}:?\d{2}|am|pm)?)?`;

const PREFIX = /^(?:ngay|ng\.|dated?)\s*:?\s*/;
const YMD = new RegExp(
  String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})${TIME_SUFFIX}$`,
);
const ABY = new RegExp(
  String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})${TIME_SUFFIX}$`,
);
const DAY_MONTHNAME_YEAR = new RegExp(
  String.raw`^(\d{1,2})[ /.-]?${MONTH_NAME}[ ,./-]*(?:nam )?(\d{4}|\d{2})$`,
);
const DAY_VIMONTH_YEAR =
  /^(\d{1,2})[ /.-]?(?:thg ?|thang ?|t)(\d{1,2})[ ,./-]*(?:nam )?(\d{4}|\d{2})$/;
const MONTHNAME_DAY_YEAR = new RegExp(
  String.raw`^${MONTH_NAME}\.?\s+(\d{1,2}),?\s+(\d{4})$`,
);
const NO_YEAR = /^(\d{1,2})[-/.](\d{1,2})$/;
const COMPACT = /^(20\d{2})(\d{2})(\d{2})$/;

type TextReading =
  | { kind: "ymd"; year: number; month: number; day: number }
  | { kind: "aby"; a: number; b: number; year: number }
  | { kind: "noYear"; a: number; b: number }
  | { kind: "compact"; year: number; month: number; day: number }
  | { kind: "invalid" };

function fullYear(text: string): number {
  // Two-digit years are always this century; the range check rejects the rest.
  return text.length === 2 ? 2000 + Number(text) : Number(text);
}

/** Lowercase, diacritics-free, prefix ("ngày", "dated") removed. */
function normalizeDateText(text: string): string {
  return stripDiacritics(cleanCellText(text)).replace(PREFIX, "").trim();
}

function readDateText(normalized: string): TextReading {
  const ymd = YMD.exec(normalized);
  if (ymd) {
    return {
      kind: "ymd",
      year: Number(ymd[1]),
      month: Number(ymd[2]),
      day: Number(ymd[3]),
    };
  }
  const aby = ABY.exec(normalized);
  if (aby) {
    return {
      kind: "aby",
      a: Number(aby[1]),
      b: Number(aby[2]),
      year: fullYear(aby[3] ?? ""),
    };
  }
  const named = DAY_MONTHNAME_YEAR.exec(normalized);
  if (named) {
    return {
      kind: "ymd",
      year: fullYear(named[3] ?? ""),
      month: MONTHS[named[2] ?? ""] ?? 0,
      day: Number(named[1]),
    };
  }
  const viMonth = DAY_VIMONTH_YEAR.exec(normalized);
  if (viMonth) {
    return {
      kind: "ymd",
      year: fullYear(viMonth[3] ?? ""),
      month: Number(viMonth[2]),
      day: Number(viMonth[1]),
    };
  }
  const usLong = MONTHNAME_DAY_YEAR.exec(normalized);
  if (usLong) {
    return {
      kind: "ymd",
      year: Number(usLong[3]),
      month: MONTHS[usLong[1] ?? ""] ?? 0,
      day: Number(usLong[2]),
    };
  }
  const noYear = NO_YEAR.exec(normalized);
  if (noYear) {
    return { kind: "noYear", a: Number(noYear[1]), b: Number(noYear[2]) };
  }
  const compact = COMPACT.exec(normalized);
  if (compact) {
    return {
      kind: "compact",
      year: Number(compact[1]),
      month: Number(compact[2]),
      day: Number(compact[3]),
    };
  }
  return { kind: "invalid" };
}

/**
 * Column pre-pass: a first number above 12 proves day-first, a second
 * number above 12 proves month-first. Values above 31 are junk and prove
 * nothing.
 */
export function inferDateOrder(cells: readonly SheetCell[]): {
  dmyProven: boolean;
  mdyProven: boolean;
} {
  let dmyProven = false;
  let mdyProven = false;
  for (const cell of cells) {
    if (cell.type !== "s" || cell.noCache || isPlaceholderText(cell.text)) {
      continue;
    }
    const reading = readDateText(normalizeDateText(cell.text));
    if (reading.kind !== "aby" && reading.kind !== "noYear") continue;
    if (reading.a > 12 && reading.a <= 31) dmyProven = true;
    if (reading.b > 12 && reading.b <= 31) mdyProven = true;
  }
  return { dmyProven, mdyProven };
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function blankResult(): DateParseResult {
  return { day: null, blank: true, issues: [] };
}

function invalidResult(raw: string): DateParseResult {
  return { day: null, blank: false, issues: [issue("DATE_INVALID", { raw })] };
}

/** Range and context checks shared by every grammar branch. */
function finishDay(
  day: string,
  ctx: DateParseContext,
  issues: Issue[],
): DateParseResult {
  if (
    day < sheetCheckLimits.earliestDay ||
    daysBetween(ctx.today, day) > sheetCheckLimits.futureDays
  ) {
    return {
      day: null,
      blank: false,
      issues: [...issues, issue("DATE_OUT_OF_RANGE", { day })],
    };
  }
  if (ctx.field === "date") {
    if (daysBetween(ctx.today, day) > sheetCheckLimits.dateFutureWarnDays) {
      issues.push(issue("DATE_FUTURE", { day }));
    }
    if (ctx.period && (day < ctx.period.from || day > ctx.period.to)) {
      issues.push(
        issue("DATE_OUT_OF_PERIOD", {
          day,
          period: `${ctx.period.from} – ${ctx.period.to}`,
        }),
      );
    }
  }
  return { day, blank: false, issues };
}

function orderedDate(
  a: number,
  b: number,
  year: number,
  order: DateOrder,
): CalendarDate {
  return order === "dmy"
    ? { year, month: b, day: a }
    : { year, month: a, day: b };
}

/** DATE_AMBIGUOUS only while the column order is a bare assumption and both readings are real days. */
function ambiguityIssue(
  a: number,
  b: number,
  year: number,
  raw: string,
  ctx: DateParseContext,
): Issue | null {
  if (ctx.columnOrderSource !== "assumed" || a > 12 || b > 12 || a === b) {
    return null;
  }
  if (!isValidCalendarDay(year, b, a) || !isValidCalendarDay(year, a, b)) {
    return null;
  }
  return issue("DATE_AMBIGUOUS", {
    raw,
    dmy: formatDay(year, b, a),
    mdy: formatDay(year, a, b),
  });
}

function finishCalendarDate(
  date: CalendarDate,
  raw: string,
  ctx: DateParseContext,
  issues: Issue[],
): DateParseResult {
  // An impossible day makes the pending notes (compact form, assumed year)
  // moot: the error alone is reported.
  if (!isValidCalendarDay(date.year, date.month, date.day)) {
    return invalidResult(raw);
  }
  return finishDay(formatDay(date.year, date.month, date.day), ctx, issues);
}

/**
 * "15/8" with a period: the period's year, or the other year of a period
 * that crosses New Year when that is the one that lands inside it.
 */
function yearForNoYear(
  a: number,
  b: number,
  period: SheetPeriod,
  order: DateOrder,
): number {
  const fromYear = Number(period.from.slice(0, 4));
  const toYear = Number(period.to.slice(0, 4));
  const candidates = fromYear === toYear ? [fromYear] : [fromYear, toYear];
  for (const year of candidates) {
    const date = orderedDate(a, b, year, order);
    if (!isValidCalendarDay(date.year, date.month, date.day)) continue;
    const day = formatDay(date.year, date.month, date.day);
    if (day >= period.from && day <= period.to) return year;
  }
  return fromYear;
}

function parseNumericCell(
  cell: SheetCell,
  ctx: DateParseContext,
): DateParseResult {
  const raw = cell.text;
  const value = cell.number;
  if (value === null || !Number.isFinite(value)) return invalidResult(raw);
  const serial = Math.floor(value);
  const compact = COMPACT.exec(String(serial));
  if (compact) {
    return finishCalendarDate(
      {
        year: Number(compact[1]),
        month: Number(compact[2]),
        day: Number(compact[3]),
      },
      raw,
      ctx,
      [issue("DATE_COMPACT", { raw: String(serial) })],
    );
  }
  // Serials up to 60 sit in the 1900 leap-year bug zone (and before any
  // plausible business date); nothing there can be meant.
  if (serial <= 60) return invalidResult(raw);
  const date = serialToDate(serial, ctx.date1904);
  if (!date) return invalidResult(raw);
  return finishCalendarDate(date, raw, ctx, []);
}

function parseTextCell(
  cell: SheetCell,
  ctx: DateParseContext,
): DateParseResult {
  const raw = cell.text;
  if (isPlaceholderText(raw)) return blankResult();
  const reading = readDateText(normalizeDateText(raw));
  switch (reading.kind) {
    case "invalid":
      return invalidResult(raw);
    case "ymd":
      return finishCalendarDate(reading, raw, ctx, []);
    case "compact":
      return finishCalendarDate(reading, raw, ctx, [
        issue("DATE_COMPACT", { raw }),
      ]);
    case "aby": {
      const issues: Issue[] = [];
      const ambiguity = ambiguityIssue(
        reading.a,
        reading.b,
        reading.year,
        raw,
        ctx,
      );
      if (ambiguity) issues.push(ambiguity);
      return finishCalendarDate(
        orderedDate(reading.a, reading.b, reading.year, ctx.columnOrder),
        raw,
        ctx,
        issues,
      );
    }
    case "noYear": {
      if (!ctx.period) {
        return {
          day: null,
          blank: false,
          issues: [issue("DATE_NO_YEAR", { raw })],
        };
      }
      const year = yearForNoYear(
        reading.a,
        reading.b,
        ctx.period,
        ctx.columnOrder,
      );
      const date = orderedDate(reading.a, reading.b, year, ctx.columnOrder);
      if (!isValidCalendarDay(date.year, date.month, date.day)) {
        return invalidResult(raw);
      }
      const issues: Issue[] = [
        issue("DATE_YEAR_ASSUMED", {
          day: formatDay(date.year, date.month, date.day),
        }),
      ];
      const ambiguity = ambiguityIssue(reading.a, reading.b, year, raw, ctx);
      if (ambiguity) issues.push(ambiguity);
      return finishCalendarDate(date, raw, ctx, issues);
    }
  }
}

/** Parses one date cell of a column mapped to `ctx.field`. */
export function parseDateCell(
  cell: SheetCell,
  ctx: DateParseContext,
): DateParseResult {
  if (cell.noCache || cell.type === "z") return blankResult();
  switch (cell.type) {
    case "n":
      return parseNumericCell(cell, ctx);
    case "s":
      return parseTextCell(cell, ctx);
    case "b":
    case "e":
      return invalidResult(cell.text);
  }
}
