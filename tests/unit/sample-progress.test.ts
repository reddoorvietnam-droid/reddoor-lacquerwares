import { describe, expect, it } from "vitest";
import {
  addDays,
  emptyRow,
  formatIsoDate,
  formatSampleDate,
  formatWeekRange,
  isMonday,
  isoDate,
  isoWeekLabel,
  dateNote,
  maxSampleRows,
  parseVietnameseDate,
  reportInputSchema,
  sameRowContent,
  sampleDateSchema,
  statusLabels,
  summarize,
  todayInBusinessTimezone,
  weekEnd,
  weekStart,
  type SampleRowInput,
} from "@/domains/sample-progress/contracts";

const baseInput = (rows: SampleRowInput[]) => ({
  week: "2026-08-24",
  reportDate: "2026-08-24",
  rows,
  changeNote: "Cập nhật tuần này",
  expectedRevision: 0,
});

describe("weeks run Monday to Sunday in Asia/Ho_Chi_Minh", () => {
  it.each([
    ["2026-08-24", "2026-08-24"],
    ["2026-08-30", "2026-08-24"],
    ["2026-08-25", "2026-08-24"],
    ["2027-01-01", "2026-12-28"],
    ["2026-01-01", "2025-12-29"],
  ])("puts %s in the week starting %s", (day, monday) => {
    expect(weekStart(day)).toBe(monday);
    expect(weekEnd(day)).toBe(addDays(monday, 6));
    expect(isMonday(monday)).toBe(true);
  });

  it("spans exactly seven days and never drifts a day across a year", () => {
    let day = "2025-12-01";
    for (let index = 0; index < 400; index++) {
      const monday = weekStart(day);
      expect(new Date(`${monday}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(new Date(`${weekEnd(day)}T00:00:00Z`).getUTCDay()).toBe(0);
      // A date must always sit inside its own week.
      expect(monday <= day && day <= weekEnd(day)).toBe(true);
      day = addDays(day, 1);
    }
  });

  it("reads today in Vietnam, not in the machine's zone", () => {
    // 2026-08-24T18:30Z is already 25 August in Ho Chi Minh City (UTC+7).
    expect(
      todayInBusinessTimezone(new Date("2026-08-24T18:30:00.000Z")),
    ).toBe("2026-08-25");
    expect(
      todayInBusinessTimezone(new Date("2026-08-24T16:00:00.000Z")),
    ).toBe("2026-08-24");
  });

  it("labels ISO weeks and formats ranges for display", () => {
    expect(isoWeekLabel("2026-08-24")).toBe("2026-W35");
    expect(isoWeekLabel("2026-12-28")).toBe("2026-W53");
    expect(formatWeekRange("2026-08-24")).toBe("24/08/2026 – 30/08/2026");
    expect(formatIsoDate("2026-08-24")).toBe("24/08/2026");
  });
});

describe("sample date columns keep dates, notes and blanks apart", () => {
  it.each([
    ["18/07/2026", "2026-07-18"],
    ["18/7/2026", "2026-07-18"],
    ["31/12/2025", "2025-12-31"],
    ["25-04-2026", "2026-04-25"],
  ])("reads unambiguous %s as %s", (raw, iso) => {
    expect(parseVietnameseDate(raw)).toEqual({ iso });
  });

  it.each(["06/05/2026", "01/02/2026", "3/8/2026"])(
    "refuses to guess between day and month for %s",
    (raw) => {
      expect(parseVietnameseDate(raw)).toEqual({ ambiguous: true });
    },
  );

  it.each(["Chờ gửi", "18/07/", "( hàng chỉ chụp ảnh không gửi )", "32/13/2026"])(
    "reads %s as not a date at all",
    (raw) => {
      expect(parseVietnameseDate(raw)).toBeNull();
    },
  );

  it("treats a same day and month value as unambiguous", () => {
    expect(parseVietnameseDate("06/06/2026")).toEqual({ iso: "2026-06-06" });
  });

  it("formats each kind for the screen", () => {
    expect(formatSampleDate(isoDate("2026-07-18"))).toBe("18/07/2026");
    expect(formatSampleDate(dateNote("Chờ gửi"))).toBe("Chờ gửi");
    expect(formatSampleDate({ kind: "empty", value: "" })).toBe("");
  });

  it("rejects malformed stored shapes", () => {
    expect(sampleDateSchema.safeParse({ kind: "date", value: "18/07/2026" }).success).toBe(false);
    expect(sampleDateSchema.safeParse({ kind: "date", value: "2026-02-30" }).success).toBe(false);
    expect(sampleDateSchema.safeParse({ kind: "text", value: "  " }).success).toBe(false);
    expect(sampleDateSchema.safeParse({ kind: "empty", value: "x" }).success).toBe(false);
    expect(sampleDateSchema.safeParse({ kind: "other", value: "" }).success).toBe(false);
  });
});

describe("status statistics count rows, never quantities", () => {
  it("uses only the four report statuses", () => {
    expect(Object.values(statusLabels)).toEqual([
      "1. Đang làm mộc/vóc",
      "2. Đang hoàn thiện",
      "3. Đã kiểm duyệt (QC Đạt)",
      "4. Đã gửi mẫu",
    ]);
  });

  it("counts one per row even when the description names many pieces", () => {
    const rows = [
      { ...emptyRow(1), status: "sent" as const, productDetails: "20 chiếc cỡ 20cm" },
      { ...emptyRow(2), status: "sent" as const, productDetails: "12 hộp 2 cỡ" },
      { ...emptyRow(3), status: "finishing" as const },
    ];
    expect(summarize(rows).map((entry) => entry.count)).toEqual([0, 1, 0, 2]);
    expect(summarize(rows).map((entry) => entry.ratio)).toEqual([
      0,
      1 / 3,
      0,
      2 / 3,
    ]);
  });

  it("reports zero ratios rather than dividing by zero", () => {
    expect(summarize([]).every((entry) => entry.ratio === 0)).toBe(true);
    expect(summarize([]).reduce((total, entry) => total + entry.count, 0)).toBe(0);
  });

  it("ratios always add up to one when there are rows", () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      ...emptyRow(index + 1),
      status: (["woodwork", "finishing", "qc_passed", "sent"] as const)[
        index % 4
      ]!,
    }));
    const total = summarize(rows).reduce((sum, entry) => sum + entry.ratio, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("report validation", () => {
  it("accepts a well formed report", () => {
    expect(
      reportInputSchema.safeParse(
        baseInput([{ ...emptyRow(1), orderName: "Sofitel" }]),
      ).success,
    ).toBe(true);
  });

  it.each([
    [
      "a week that is not a Monday",
      { ...baseInput([]), week: "2026-08-25", reportDate: "2026-08-25" },
      "thứ Hai",
    ],
    [
      "a report date outside the week",
      { ...baseInput([]), reportDate: "2026-09-02" },
      "trong tuần",
    ],
    [
      "a blank change note",
      { ...baseInput([]), changeNote: "   " },
      "nội dung cập nhật",
    ],
    [
      "a date that does not exist",
      { ...baseInput([]), week: "2026-02-30", reportDate: "2026-02-30" },
      "",
    ],
  ])("rejects %s", (_label, payload, fragment) => {
    const result = reportInputSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success && fragment)
      expect(
        result.error.issues.some((issue) => issue.message.includes(fragment)),
      ).toBe(true);
  });

  it("rejects duplicate ids and duplicate STT with a named reason", () => {
    const row = { ...emptyRow(1), orderName: "A" };
    const duplicateId = reportInputSchema.safeParse(
      baseInput([row, { ...row, number: 2 }]),
    );
    expect(duplicateId.success).toBe(false);
    if (!duplicateId.success)
      expect(
        duplicateId.error.issues.some((issue) =>
          issue.message.includes("Mã mẫu bị trùng"),
        ),
      ).toBe(true);

    const duplicateNumber = reportInputSchema.safeParse(
      baseInput([row, { ...emptyRow(1), orderName: "B" }]),
    );
    expect(duplicateNumber.success).toBe(false);
    if (!duplicateNumber.success)
      expect(
        duplicateNumber.error.issues.some((issue) =>
          issue.message.includes("STT mẫu bị trùng"),
        ),
      ).toBe(true);
  });

  it("requires an order name and enforces field lengths", () => {
    expect(
      reportInputSchema.safeParse(baseInput([{ ...emptyRow(1), orderName: " " }]))
        .success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse(
        baseInput([
          { ...emptyRow(1), orderName: "A".repeat(301) },
        ]),
      ).success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse(
        baseInput([
          { ...emptyRow(1), orderName: "A", notes: "x".repeat(10_001) },
        ]),
      ).success,
    ).toBe(false);
    expect(
      reportInputSchema.safeParse(
        baseInput([
          { ...emptyRow(1), orderName: "A", productDetails: "x".repeat(5001) },
        ]),
      ).success,
    ).toBe(false);
  });

  it(`allows ${maxSampleRows} rows and refuses one more`, () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...emptyRow(index + 1),
        orderName: `Mẫu ${index + 1}`,
      }));
    expect(reportInputSchema.safeParse(baseInput(rows(maxSampleRows))).success).toBe(
      true,
    );
    expect(
      reportInputSchema.safeParse(baseInput(rows(maxSampleRows + 1))).success,
    ).toBe(false);
  });

  it("rejects a report whose text exceeds the storage budget", () => {
    const rows = Array.from({ length: 120 }, (_, index) => ({
      ...emptyRow(index + 1),
      orderName: `Mẫu ${index + 1}`,
      notes: "x".repeat(9000),
    }));
    const result = reportInputSchema.safeParse(baseInput(rows));
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.some((issue) => issue.message.includes("quá lớn")),
      ).toBe(true);
  });

  it("keeps multi-line detail and formula-like text verbatim", () => {
    const notes = '=SUM(A1)\n+84\n-1\n@name';
    const result = reportInputSchema.safeParse(
      baseInput([
        {
          ...emptyRow(1),
          orderName: "Sofitel",
          productDetails: "2 tấm phẳng\n1 bộ 3 khay",
          notes,
        },
      ]),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]!.notes).toBe(notes);
      expect(result.data.rows[0]!.productDetails).toContain("\n");
    }
  });

  it("ignores row audit fields supplied by a client", () => {
    const result = reportInputSchema.safeParse(
      baseInput([
        {
          ...emptyRow(1),
          orderName: "Sofitel",
          updatedBy: "someone-else",
          updatedByName: "Kẻ giả mạo",
          updatedAt: "1999-01-01T00:00:00.000Z",
        } as SampleRowInput,
      ]),
    );
    expect(result.success).toBe(true);
    if (result.success)
      expect(Object.keys(result.data.rows[0]!)).not.toContain("updatedBy");
  });
});

describe("row comparison decides when a row was really edited", () => {
  it("ignores the id and sees every business field", () => {
    const row = { ...emptyRow(1), orderName: "Sofitel" };
    expect(sameRowContent(row, { ...row, id: emptyRow(9).id })).toBe(true);
    expect(sameRowContent(row, { ...row, notes: "mới" })).toBe(false);
    expect(sameRowContent(row, { ...row, status: "sent" })).toBe(false);
    expect(
      sameRowContent(row, { ...row, sentDate: isoDate("2026-07-18") }),
    ).toBe(false);
    expect(sameRowContent(row, { ...row, number: 2 })).toBe(false);
  });
});
