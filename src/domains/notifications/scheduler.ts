import type {
  NotificationChannel,
  NotificationKind,
} from "@/domains/notifications/contracts";
import type { TaskRecordDto } from "@/domains/tasks/contracts";
import {
  businessHour,
  daysBetween,
  formatBusinessDay,
  zonedTimeToUtc,
} from "@/domains/tasks/policy";

/**
 * Pure scheduling rules for task reminders.
 *
 * Which reminders exist on a given day, what their dedupe keys are, when a
 * quiet-hours window pushes delivery to, and how a failed attempt backs
 * off — all decided from plain values so the job, the manual "run now"
 * button, and the tests agree.
 */

export type ReminderPlan = {
  taskId: string;
  kind: NotificationKind;
  /** The business day this reminder belongs to (`YYYY-MM-DD`). */
  day: string;
  dueDay: string;
  daysLate: number;
  recipientUserId: string;
};

export type QuietHours = { start: number; end: number };

export function parseQuietHours(value: string): QuietHours {
  const [start, end] = value.split("-").map(Number);
  const clamp = (hour: number | undefined) =>
    Number.isInteger(hour) && hour! >= 0 && hour! <= 23 ? hour! : 0;
  return { start: clamp(start), end: clamp(end) };
}

/** True when the local hour falls inside the quiet window (which may wrap midnight). */
export function isQuietHour(
  now: Date,
  timeZone: string,
  quiet: QuietHours,
): boolean {
  if (quiet.start === quiet.end) return false;
  const hour = businessHour(now, timeZone);
  return quiet.start < quiet.end
    ? hour >= quiet.start && hour < quiet.end
    : hour >= quiet.start || hour < quiet.end;
}

/** The first instant at or after `now` that is outside the quiet window. */
export function nextDeliveryInstant(
  now: Date,
  timeZone: string,
  quiet: QuietHours,
): Date {
  if (!isQuietHour(now, timeZone, quiet)) return now;
  const today = formatBusinessDay(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const hour = businessHour(now, timeZone);
  // The window ends at `quiet.end`; when it wraps midnight and we are past
  // the start, that end is on the next calendar day.
  const wraps = quiet.start > quiet.end;
  const endsTomorrow = wraps && hour >= quiet.start;
  return zonedTimeToUtc(
    {
      year: year!,
      month: month!,
      day: day! + (endsTomorrow ? 1 : 0),
      hour: quiet.end,
    },
    timeZone,
  );
}

/**
 * The reminders due today for a set of open tasks. One reminder per
 * (task, kind, day): "due soon" exactly `leadDays` before, "due" on the
 * day, and "overdue" once per day afterwards. A task without a deadline or
 * without an assignee produces nothing.
 */
export function planReminders(input: {
  tasks: readonly TaskRecordDto[];
  now: Date;
  timeZone: string;
  leadDays: number;
}): ReminderPlan[] {
  const today = formatBusinessDay(input.now, input.timeZone);
  const plans: ReminderPlan[] = [];
  for (const task of input.tasks) {
    if (task.status !== "open" || !task.dueAt || !task.assigneeUserId) continue;
    const dueDay = formatBusinessDay(task.dueAt, input.timeZone);
    const daysUntil = daysBetween(today, dueDay);
    let kind: NotificationKind | null = null;
    if (daysUntil < 0) kind = "taskOverdue";
    else if (daysUntil === 0) kind = "taskDue";
    else if (input.leadDays > 0 && daysUntil === input.leadDays)
      kind = "taskDueSoon";
    if (!kind) continue;
    plans.push({
      taskId: task.id,
      kind,
      day: today,
      dueDay,
      daysLate: daysUntil < 0 ? -daysUntil : 0,
      recipientUserId: task.assigneeUserId,
    });
  }
  return plans;
}

export function dedupeKeyFor(
  plan: Pick<ReminderPlan, "taskId" | "kind" | "day">,
  channel: NotificationChannel,
): string {
  return `task:${plan.taskId}:${plan.kind}:${plan.day}:${channel}`;
}

/** Minutes to wait before attempt N+1; null once the ceiling is reached. */
export const retryBackoffMinutes = [5, 15, 60, 240, 720] as const;

export function nextRetryAt(attemptsSoFar: number, now: Date): Date | null {
  const minutes = retryBackoffMinutes[attemptsSoFar - 1];
  if (minutes === undefined) return null;
  return new Date(now.getTime() + minutes * 60_000);
}

/**
 * Whether a reminder still applies when it is about to be sent: the task
 * must still be open, still assigned to the same person, and still due on
 * the day the reminder was computed for. Anything else means the work
 * moved on and the old reminder is dropped.
 */
export function reminderStillApplies(
  task: TaskRecordDto | null,
  intent: {
    kind: NotificationKind;
    recipientUserId: string;
    dedupeKey: string;
  },
  now: Date,
  timeZone: string,
): { applies: true } | { applies: false; reason: string } {
  if (!task) return { applies: false, reason: "TASK_MISSING" };
  if (task.status !== "open") return { applies: false, reason: "TASK_CLOSED" };
  if (task.assigneeUserId !== intent.recipientUserId) {
    return { applies: false, reason: "TASK_REASSIGNED" };
  }
  if (!task.dueAt) return { applies: false, reason: "TASK_NO_DEADLINE" };
  const today = formatBusinessDay(now, timeZone);
  const dueDay = formatBusinessDay(task.dueAt, timeZone);
  const daysUntil = daysBetween(today, dueDay);
  const expected =
    intent.kind === "taskOverdue"
      ? daysUntil < 0
      : intent.kind === "taskDue"
        ? daysUntil === 0
        : daysUntil > 0;
  return expected
    ? { applies: true }
    : { applies: false, reason: "TASK_RESCHEDULED" };
}
