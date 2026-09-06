import { describe, expect, it } from "vitest";

import type { SheetCell } from "@/domains/sheet-checks/contracts";
import type { IssueCode } from "@/domains/sheet-checks/issues";
import {
  addDays,
  businessDayOf,
  inferDateOrder,
  isValidCalendarDay,
  parseDateCell,
  type DateParseContext,
} from "@/domains/sheet-checks/parsing/date";
import { daysBetween } from "@/domains/tasks/policy";

const today = "2026-09-06";
const timeZone = "Asia/Ho_Chi_Minh";

function cell(overrides: Partial<SheetCell>): SheetCell {
  return {
    text: "",
    type: "z",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
    ...overrides,
  };
}

function textCell(text: string): SheetCell {
  return cell({ text, type: "s" });
}

function numberCell(
  number: number,
  numberFormat: string | null = null,
  text: string = String(number),
): SheetCell {
  return cell({ text, type: "n", number, numberFormat });
}

function context(overrides: Partial<DateParseContext> = {}): DateParseContext {
  return {
    date1904: false,
    columnOrder: "dmy",
    columnOrderSource: "proven",
    period: null,
    field: "date",
    today,
    ...overrides,
  };
}

function codesOf(result: {
  issues: readonly { code: IssueCode }[];
}): IssueCode[] {
  return result.issues.map((entry) => entry.code);
}

function parseText(text: string, overrides: Partial<DateParseContext> = {}) {
  return parseDateCell(textCell(text), context(overrides));
}

describe("parseDateCell — Excel serials", () => {
  it.each([
    { serial: 46249, day: "2026-08-15" },
    { serial: 46249.75, day: "2026-08-15" },
    { serial: 46270, day: "2026-09-05" },
    { serial: 46000, day: "2025-12-09" },
  ])("serial $serial → $day", ({ serial, day }) => {
    const result = parseDateCell(numberCell(serial, "dd/mm/yyyy"), context());
    expect(result).toEqual({ day, blank: false, issues: [] });
  });

  it("reads 1904-system serials through the workbook flag", () => {
    expect(
      parseDateCell(numberCell(44787), context({ date1904: true })).day,
    ).toBe("2026-08-15");
  });

  it("needs no number format once the column is mapped to a date", () => {
    expect(parseDateCell(numberCell(46249, "General"), context()).day).toBe(
      "2026-08-15",
    );
  });

  it("rejects the 1900 leap-bug zone and ancient serials", () => {
    const bug = parseDateCell(numberCell(60), context());
    expect(bug.day).toBeNull();
    expect(bug.issues).toEqual([
      expect.objectContaining({ code: "DATE_INVALID", params: { raw: "60" } }),
    ]);
    const ancient = parseDateCell(numberCell(10000), context());
    expect(ancient.day).toBeNull();
    expect(ancient.issues).toEqual([
      expect.objectContaining({
        code: "DATE_OUT_OF_RANGE",
        params: { day: "1927-05-18" },
      }),
    ]);
    expect(codesOf(parseDateCell(numberCell(-5), context()))).toEqual([
      "DATE_INVALID",
    ]);
    expect(codesOf(parseDateCell(numberCell(1e21), context()))).toEqual([
      "DATE_INVALID",
    ]);
  });

  it("reads a compact yyyymmdd number and says so", () => {
    const result = parseDateCell(numberCell(20260815), context());
    expect(result.day).toBe("2026-08-15");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "DATE_COMPACT",
        severity: "info",
        params: { raw: "20260815" },
      }),
    ]);
    expect(codesOf(parseDateCell(numberCell(20261315), context()))).toEqual([
      "DATE_INVALID",
    ]);
  });
});

describe("parseDateCell — text grammar", () => {
  it.each([
    "15/08/2026",
    "15-8-26",
    "15.08.2026",
    "15-08-2026",
    "15/08/2026 14:30",
    "15/08/2026 14:30:15",
    "2026-08-15",
    "2026/08/15",
    "2026-08-15T10:00:00Z",
    "2026-08-15 10:00",
    "15 Aug 2026",
    "15 August 2026",
    "15-thg8-2026",
    "15 tháng 8 2026",
    "ngày 15 tháng 8 năm 2026",
    "Ngày 15/08/2026",
    "Aug 15, 2026",
    "August 15 2026",
    "20260815",
  ])("%s → 2026-08-15", (text) => {
    const result = parseText(text);
    expect(result.day).toBe("2026-08-15");
    expect(codesOf(result).filter((code) => code !== "DATE_COMPACT")).toEqual(
      [],
    );
  });

  it("reads year-first text the same under either column order", () => {
    for (const text of ["2026-08-15", "2026/08/15", "2026-08-15T10:00:00Z"]) {
      expect(parseText(text, { columnOrder: "mdy" }).day).toBe("2026-08-15");
      expect(parseText(text, { columnOrder: "dmy" }).day).toBe("2026-08-15");
    }
  });

  it("flags the compact text form", () => {
    expect(parseText("20260815").issues).toEqual([
      expect.objectContaining({
        code: "DATE_COMPACT",
        params: { raw: "20260815" },
      }),
    ]);
  });

  it.each([
    "31/02/2026",
    "15/13/2026",
    "00/08/2026",
    "hôm qua",
    "abc",
    "Q3/2026",
    "46249",
  ])("%s → DATE_INVALID", (text) => {
    const result = parseText(text);
    expect(result.day).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({ code: "DATE_INVALID", params: { raw: text } }),
    ]);
  });

  it("rejects days outside 2015-01-01 .. today + 366", () => {
    for (const text of ["01/01/2010", "01/01/2030", "31/12/2014"]) {
      const result = parseText(text);
      expect(result.day).toBeNull();
      expect(codesOf(result)).toEqual(["DATE_OUT_OF_RANGE"]);
    }
    expect(parseText("01/01/2015")).toMatchObject({
      day: "2015-01-01",
      issues: [],
    });
    const edge = addDays(today, 366);
    expect(parseText(edge).day).toBe(edge);
    expect(codesOf(parseText(addDays(today, 367)))).toEqual([
      "DATE_OUT_OF_RANGE",
    ]);
  });

  it("treats blanks as blank and booleans as invalid", () => {
    for (const text of ["", "-", "–", "n/a", "NA", "null", "none"]) {
      expect(parseText(text)).toEqual({ day: null, blank: true, issues: [] });
    }
    expect(parseDateCell(cell({}), context())).toEqual({
      day: null,
      blank: true,
      issues: [],
    });
    expect(
      parseDateCell(
        cell({ type: "n", formula: true, noCache: true }),
        context(),
      ),
    ).toEqual({ day: null, blank: true, issues: [] });
    expect(
      codesOf(parseDateCell(cell({ type: "b", text: "TRUE" }), context())),
    ).toEqual(["DATE_INVALID"]);
    expect(
      codesOf(parseDateCell(cell({ type: "e", text: "#N/A" }), context())),
    ).toEqual(["DATE_INVALID"]);
  });
});

describe("parseDateCell — day/month order", () => {
  it("proves day-first from a day above 12", () => {
    expect(inferDateOrder([textCell("15/08/2026")])).toEqual({
      dmyProven: true,
      mdyProven: false,
    });
    expect(parseText("15/08/2026")).toEqual({
      day: "2026-08-15",
      blank: false,
      issues: [],
    });
  });

  it("flags an ambiguous cell only while the order is assumed", () => {
    const assumed = parseText("05/06/2026", { columnOrderSource: "assumed" });
    expect(assumed.day).toBe("2026-06-05");
    expect(assumed.issues).toEqual([
      expect.objectContaining({
        code: "DATE_AMBIGUOUS",
        severity: "info",
        params: { raw: "05/06/2026", dmy: "2026-06-05", mdy: "2026-05-06" },
      }),
    ]);
    expect(parseText("05/06/2026", { columnOrderSource: "confirmed" })).toEqual(
      {
        day: "2026-06-05",
        blank: false,
        issues: [],
      },
    );
    expect(
      parseText("05/06/2026", { columnOrderSource: "proven" }).issues,
    ).toEqual([]);
    // Equal numbers read the same either way.
    expect(
      parseText("06/06/2026", { columnOrderSource: "assumed" }).issues,
    ).toEqual([]);
    const short = parseText("5/6/26", { columnOrderSource: "assumed" });
    expect(short.day).toBe("2026-06-05");
    expect(codesOf(short)).toEqual(["DATE_AMBIGUOUS"]);
  });

  it("leaves a column of small numbers unproven (DATE_ORDER_ASSUMED is the column's)", () => {
    const cells = [textCell("05/08/2026"), textCell("06/08/2026")];
    expect(inferDateOrder(cells)).toEqual({
      dmyProven: false,
      mdyProven: false,
    });
    expect(cells.map((entry) => parseDateCell(entry, context()).day)).toEqual([
      "2026-08-05",
      "2026-08-06",
    ]);
  });

  it("proves day-first for a whole column from one cell", () => {
    const cells = [textCell("05/08/2026"), textCell("15/08/2026")];
    expect(inferDateOrder(cells)).toEqual({
      dmyProven: true,
      mdyProven: false,
    });
    expect(
      cells.map((entry) =>
        parseDateCell(entry, context({ columnOrderSource: "proven" })),
      ),
    ).toEqual([
      { day: "2026-08-05", blank: false, issues: [] },
      { day: "2026-08-15", blank: false, issues: [] },
    ]);
  });

  it("reads the whole column month-first when only the second number exceeds 12", () => {
    const cells = [textCell("08/15/2026"), textCell("05/06/2026")];
    expect(inferDateOrder(cells)).toEqual({
      dmyProven: false,
      mdyProven: true,
    });
    const ctx = context({ columnOrder: "mdy", columnOrderSource: "proven" });
    expect(cells.map((entry) => parseDateCell(entry, ctx).day)).toEqual([
      "2026-08-15",
      "2026-05-06",
    ]);
    expect(cells.map((entry) => parseDateCell(entry, ctx).issues)).toEqual([
      [],
      [],
    ]);
  });

  it("reports conflicting evidence and makes the impossible cell invalid once chosen", () => {
    const cells = [textCell("25/08/2026"), textCell("08/15/2026")];
    expect(inferDateOrder(cells)).toEqual({ dmyProven: true, mdyProven: true });
    const chosen = parseText("08/15/2026", {
      columnOrder: "dmy",
      columnOrderSource: "confirmed",
    });
    expect(chosen.day).toBeNull();
    expect(codesOf(chosen)).toEqual(["DATE_INVALID"]);
  });

  it("ignores junk, year-first and numeric cells as evidence", () => {
    expect(
      inferDateOrder([
        textCell("45/06/2026"),
        textCell("2026-08-15"),
        numberCell(46249),
        textCell(""),
        textCell("abc"),
      ]),
    ).toEqual({ dmyProven: false, mdyProven: false });
    expect(inferDateOrder([textCell("15/8")])).toEqual({
      dmyProven: true,
      mdyProven: false,
    });
  });
});

describe("parseDateCell — missing year", () => {
  const period = { from: "2026-08-01", to: "2026-08-31" };

  it("takes the year from the period", () => {
    const result = parseText("15/8", { period });
    expect(result.day).toBe("2026-08-15");
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "DATE_YEAR_ASSUMED",
        severity: "info",
        params: { day: "2026-08-15" },
      }),
    ]);
  });

  it("keeps the period year even when the day falls outside the period", () => {
    // Viewed after the fact so the future warning does not apply.
    const result = parseText("5/10", {
      period: { from: "2026-09-01", to: "2026-09-30" },
      today: "2026-10-15",
    });
    expect(result.day).toBe("2026-10-05");
    expect(codesOf(result)).toEqual([
      "DATE_YEAR_ASSUMED",
      "DATE_OUT_OF_PERIOD",
    ]);
    expect(result.issues[1]?.params).toEqual({
      day: "2026-10-05",
      period: "2026-09-01 – 2026-09-30",
    });
  });

  it("picks the year that lands inside a period crossing New Year", () => {
    const crossing = { from: "2025-12-01", to: "2026-01-31" };
    expect(parseText("5/1", { period: crossing })).toMatchObject({
      day: "2026-01-05",
      issues: [expect.objectContaining({ code: "DATE_YEAR_ASSUMED" })],
    });
    expect(parseText("15/12", { period: crossing }).day).toBe("2025-12-15");
  });

  it("fails without a period", () => {
    const result = parseText("15/8");
    expect(result.day).toBeNull();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "DATE_NO_YEAR",
        severity: "error",
        params: { raw: "15/8" },
      }),
    ]);
  });

  it("still flags ambiguity and validity on year-less cells", () => {
    expect(
      codesOf(
        parseText("5/6", {
          period: { from: "2026-06-01", to: "2026-06-30" },
          columnOrderSource: "assumed",
        }),
      ),
    ).toEqual(["DATE_YEAR_ASSUMED", "DATE_AMBIGUOUS"]);
    expect(codesOf(parseText("31/2", { period }))).toEqual(["DATE_INVALID"]);
  });
});

describe("parseDateCell — context", () => {
  it("warns about a date more than a week ahead, but not a due date", () => {
    const ahead = addDays(today, 30);
    const soon = addDays(today, 5);
    expect(parseText(ahead)).toMatchObject({
      day: ahead,
      issues: [
        expect.objectContaining({
          code: "DATE_FUTURE",
          params: { day: ahead },
        }),
      ],
    });
    expect(parseText(ahead, { field: "dueDate" })).toEqual({
      day: ahead,
      blank: false,
      issues: [],
    });
    expect(parseText(soon).issues).toEqual([]);
    expect(parseText(addDays(today, 7)).issues).toEqual([]);
    expect(codesOf(parseText(addDays(today, 8)))).toEqual(["DATE_FUTURE"]);
  });

  it("warns about a date outside the period, only for the date field", () => {
    const period = { from: "2026-08-01", to: "2026-08-31" };
    expect(parseText("15/07/2026", { period })).toMatchObject({
      day: "2026-07-15",
      issues: [expect.objectContaining({ code: "DATE_OUT_OF_PERIOD" })],
    });
    expect(
      parseText("15/07/2026", { period, field: "dueDate" }).issues,
    ).toEqual([]);
    expect(parseText("15/08/2026", { period }).issues).toEqual([]);
    expect(parseText("31/08/2026", { period }).issues).toEqual([]);
  });
});

describe("business days", () => {
  it("maps instants to the business calendar day for Δ comparisons", () => {
    expect(businessDayOf(new Date("2026-08-14T17:30:00Z"), timeZone)).toBe(
      "2026-08-15",
    );
    expect(
      daysBetween(
        "2026-08-15",
        businessDayOf(new Date("2026-08-14T17:30:00Z"), timeZone),
      ),
    ).toBe(0);
    // 17:30Z is already 00:30 the next day in Hanoi (UTC+7).
    expect(businessDayOf(new Date("2026-09-05T17:30:00Z"), timeZone)).toBe(
      "2026-09-06",
    );
    expect(businessDayOf(new Date("2026-09-05T16:30:00Z"), timeZone)).toBe(
      "2026-09-05",
    );
    expect(businessDayOf(new Date("2026-09-05T17:30:00Z"), "UTC")).toBe(
      "2026-09-05",
    );
  });

  it("adds calendar days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(() => addDays("15/08/2026", 1)).toThrow(RangeError);
  });

  it("knows the calendar", () => {
    expect(isValidCalendarDay(2024, 2, 29)).toBe(true);
    expect(isValidCalendarDay(2026, 2, 29)).toBe(false);
    expect(isValidCalendarDay(2000, 2, 29)).toBe(true);
    expect(isValidCalendarDay(1900, 2, 29)).toBe(false);
    expect(isValidCalendarDay(2026, 4, 31)).toBe(false);
    expect(isValidCalendarDay(2026, 13, 1)).toBe(false);
    expect(isValidCalendarDay(2026, 0, 1)).toBe(false);
    expect(isValidCalendarDay(2026, 1, 0)).toBe(false);
    expect(isValidCalendarDay(2026, 1.5, 1)).toBe(false);
  });
});
