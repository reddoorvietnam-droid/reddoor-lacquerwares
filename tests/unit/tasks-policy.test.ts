import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  assertStatusTransition,
  businessDayEnd,
  businessDayStart,
  businessHour,
  daysBetween,
  formatBusinessDay,
  isOverdue,
  zonedTimeToUtc,
} from "@/domains/tasks/policy";

const tz = "Asia/Ho_Chi_Minh";

describe("business-day deadlines in Asia/Ho_Chi_Minh", () => {
  it("stores a calendar day as 23:59:59.999 local time (UTC+7)", () => {
    const due = businessDayEnd("2026-09-10", tz);
    expect(due.toISOString()).toBe("2026-09-10T16:59:59.999Z");
    expect(businessDayStart("2026-09-10", tz).toISOString()).toBe(
      "2026-09-09T17:00:00.000Z",
    );
  });

  it("is not overdue at 23:30 local and overdue at 00:00 local the next day", () => {
    const task = {
      status: "open" as const,
      dueAt: businessDayEnd("2026-09-10", tz),
    };
    const lateEvening = zonedTimeToUtc(
      { year: 2026, month: 9, day: 10, hour: 23, minute: 30 },
      tz,
    );
    const midnight = zonedTimeToUtc({ year: 2026, month: 9, day: 11 }, tz);
    expect(isOverdue(task, lateEvening)).toBe(false);
    expect(isOverdue(task, midnight)).toBe(true);
  });

  it("never reports a done or cancelled task as overdue", () => {
    const dueAt = businessDayEnd("2026-01-01", tz);
    expect(
      isOverdue({ status: "done", dueAt }, new Date("2026-09-01T00:00:00Z")),
    ).toBe(false);
    expect(
      isOverdue(
        { status: "cancelled", dueAt },
        new Date("2026-09-01T00:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isOverdue(
        { status: "open", dueAt: null },
        new Date("2026-09-01T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("formats an instant back to the local calendar day across the UTC boundary", () => {
    // 2026-09-10T18:30Z is already 2026-09-11 01:30 in Hanoi.
    expect(formatBusinessDay(new Date("2026-09-10T18:30:00Z"), tz)).toBe(
      "2026-09-11",
    );
    expect(businessHour(new Date("2026-09-10T18:30:00Z"), tz)).toBe(1);
  });

  it("rejects impossible days and bad formats", () => {
    expect(() => businessDayEnd("2026-02-30", tz)).toThrowError();
    expect(() => businessDayEnd("10/09/2026", tz)).toThrowError();
  });

  it("does calendar arithmetic without timezones", () => {
    expect(addBusinessDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-09-06", "2026-09-10")).toBe(4);
    expect(daysBetween("2026-09-10", "2026-09-06")).toBe(-4);
  });

  it("handles a DST zone with the two-pass offset", () => {
    // Europe/Berlin switches to summer time on 2026-03-29.
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 3, day: 29, hour: 12 },
        "Europe/Berlin",
      ).toISOString(),
    ).toBe("2026-03-29T10:00:00.000Z");
    expect(
      zonedTimeToUtc(
        { year: 2026, month: 3, day: 28, hour: 12 },
        "Europe/Berlin",
      ).toISOString(),
    ).toBe("2026-03-28T11:00:00.000Z");
  });
});

describe("task status transitions", () => {
  it("allows open→done, open→cancelled with a reason, done→open", () => {
    expect(() => assertStatusTransition("open", "done", null)).not.toThrow();
    expect(() =>
      assertStatusTransition("open", "cancelled", "khách hủy"),
    ).not.toThrow();
    expect(() => assertStatusTransition("done", "open", null)).not.toThrow();
  });

  it("refuses cancelling without a reason and any move out of cancelled", () => {
    expect(() =>
      assertStatusTransition("open", "cancelled", "  "),
    ).toThrowError(/reason/);
    expect(() =>
      assertStatusTransition("cancelled", "open", null),
    ).toThrowError(/cannot move/);
    expect(() =>
      assertStatusTransition("done", "cancelled", "x"),
    ).toThrowError();
  });
});
