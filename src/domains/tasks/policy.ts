import {
  TaskCommandError,
  type TaskRecordDto,
  type TaskStatus,
} from "@/domains/tasks/contracts";

/**
 * Pure task rules: business-day deadlines in the company's timezone and the
 * status transitions. No database, no session, so every branch is testable
 * with plain values and the reminder job shares the same definition of
 * "due" and "overdue" as the screens.
 */

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Offset of `timeZone` from UTC at `instant`, in minutes. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant at which a local wall-clock time occurs in `timeZone`. Two
 * passes settle the offset across a DST edge; Vietnam has none, but the
 * helper stays correct for any zone the company might configure.
 */
export function zonedTimeToUtc(
  input: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
  },
  timeZone: string,
): Date {
  const guess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0,
    input.millisecond ?? 0,
  );
  let offset = offsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60_000;
  const secondOffset = offsetMinutes(new Date(result), timeZone);
  if (secondOffset !== offset) {
    offset = secondOffset;
    result = guess - offset * 60_000;
  }
  return new Date(result);
}

/** `YYYY-MM-DD` of `instant` as seen in `timeZone`. */
export function formatBusinessDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

/** Local hour (0–23) of `instant` in `timeZone`. */
export function businessHour(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
  }).formatToParts(instant);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

/**
 * A deadline given as a calendar day means "by the end of that day" for the
 * company: the stored instant is 23:59:59.999 local time, so a task due
 * "2026-09-10" is not overdue at 23:30 in Hanoi and is overdue at 00:00.
 */
export function businessDayEnd(day: string, timeZone: string): Date {
  const match = DAY_PATTERN.exec(day);
  if (!match) {
    throw new TaskCommandError("INVALID_INPUT", "Expected YYYY-MM-DD.");
  }
  const [, year, month, date] = match;
  const parsed = {
    year: Number(year),
    month: Number(month),
    day: Number(date),
  };
  const candidate = zonedTimeToUtc(
    { ...parsed, hour: 23, minute: 59, second: 59, millisecond: 999 },
    timeZone,
  );
  // Reject impossible days such as 2026-02-30 by round-tripping.
  if (formatBusinessDay(candidate, timeZone) !== day) {
    throw new TaskCommandError("INVALID_INPUT", "Not a calendar day.");
  }
  return candidate;
}

/** Start of the business day, for date arithmetic in the scheduler. */
export function businessDayStart(day: string, timeZone: string): Date {
  const match = DAY_PATTERN.exec(day);
  if (!match) {
    throw new TaskCommandError("INVALID_INPUT", "Expected YYYY-MM-DD.");
  }
  const [, year, month, date] = match;
  return zonedTimeToUtc(
    { year: Number(year), month: Number(month), day: Number(date) },
    timeZone,
  );
}

/** Adds calendar days to a `YYYY-MM-DD` value without touching timezones. */
export function addBusinessDays(day: string, days: number): string {
  const match = DAY_PATTERN.exec(day);
  if (!match) {
    throw new TaskCommandError("INVALID_INPUT", "Expected YYYY-MM-DD.");
  }
  const [, year, month, date] = match;
  const utc = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(date) + days),
  );
  return utc.toISOString().slice(0, 10);
}

/** Whole calendar days from `fromDay` to `toDay` (negative when past). */
export function daysBetween(fromDay: string, toDay: string): number {
  const from = businessDayStart(fromDay, "UTC").getTime();
  const to = businessDayStart(toDay, "UTC").getTime();
  return Math.round((to - from) / 86_400_000);
}

export function isOverdue(
  task: Pick<TaskRecordDto, "status" | "dueAt">,
  now: Date,
): boolean {
  return (
    task.status === "open" &&
    task.dueAt !== null &&
    task.dueAt.getTime() < now.getTime()
  );
}

/**
 * open → done, open → cancelled, done → open (reopen). A cancelled task is
 * terminal: the reason stays on it and a fresh task is created instead.
 */
export function assertStatusTransition(
  from: TaskStatus,
  to: TaskStatus,
  reason: string | null,
): void {
  const allowed =
    (from === "open" && (to === "done" || to === "cancelled")) ||
    (from === "done" && to === "open");
  if (!allowed) {
    throw new TaskCommandError(
      "INVALID_TRANSITION",
      `A task cannot move from ${from} to ${to}.`,
    );
  }
  if (to === "cancelled" && !reason?.trim()) {
    throw new TaskCommandError(
      "REASON_REQUIRED",
      "Cancelling a task must record a reason.",
    );
  }
}
