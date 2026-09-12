import { describe, expect, it } from "vitest";

import {
  dedupeKeyFor,
  isQuietHour,
  nextDeliveryInstant,
  nextRetryAt,
  parseQuietHours,
  planReminders,
  reminderStillApplies,
} from "@/domains/notifications/scheduler";
import { reminderMessage } from "@/domains/notifications/templates";
import type { TaskRecordDto } from "@/domains/tasks/contracts";
import { businessDayEnd, zonedTimeToUtc } from "@/domains/tasks/policy";

const tz = "Asia/Ho_Chi_Minh";

function task(partial: Partial<TaskRecordDto> = {}): TaskRecordDto {
  return {
    id: partial.id ?? "000000000000000000000001",
    title: "Kiểm tra tồn kho",
    note: null,
    status: "open",
    priority: "normal",
    orderId: null,
    orderCode: "RD-20260906-AB12",
    stage: null,
    ownerRole: null,
    assigneeUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    businessUnitIds: [],
    dueAt: businessDayEnd("2026-09-10", tz),
    dependsOnTaskIds: [],
    source: { kind: "manual" },
    extensionRequest: null,
    lastExtensionDecision: null,
    completedAt: null,
    completedBy: null,
    cancelledAt: null,
    cancelReason: null,
    createdBy: "aaaaaaaaaaaaaaaaaaaaaaaa",
    updatedBy: "aaaaaaaaaaaaaaaaaaaaaaaa",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    revision: 0,
    ...partial,
  };
}

const at = (day: number, hour: number) =>
  zonedTimeToUtc({ year: 2026, month: 9, day, hour }, tz);

describe("planReminders", () => {
  it("emits due-soon one lead day before, due on the day, overdue afterwards, one per day", () => {
    const tasks = [task()];
    const soon = planReminders({
      tasks,
      now: at(9, 8),
      timeZone: tz,
      leadDays: 1,
    });
    expect(soon).toEqual([
      expect.objectContaining({
        kind: "taskDueSoon",
        day: "2026-09-09",
        dueDay: "2026-09-10",
        daysLate: 0,
      }),
    ]);
    const due = planReminders({
      tasks,
      now: at(10, 8),
      timeZone: tz,
      leadDays: 1,
    });
    expect(due[0]?.kind).toBe("taskDue");
    const overdue = planReminders({
      tasks,
      now: at(12, 8),
      timeZone: tz,
      leadDays: 1,
    });
    expect(overdue[0]).toEqual(
      expect.objectContaining({
        kind: "taskOverdue",
        daysLate: 2,
        day: "2026-09-12",
      }),
    );
    // Two days before: nothing.
    expect(
      planReminders({ tasks, now: at(8, 8), timeZone: tz, leadDays: 1 }),
    ).toEqual([]);
  });

  it("respects the day boundary: 23:30 local on the due day is still 'due', 00:10 next day is overdue", () => {
    const tasks = [task()];
    expect(
      planReminders({
        tasks,
        now: zonedTimeToUtc(
          { year: 2026, month: 9, day: 10, hour: 23, minute: 30 },
          tz,
        ),
        timeZone: tz,
        leadDays: 1,
      })[0]?.kind,
    ).toBe("taskDue");
    expect(
      planReminders({
        tasks,
        now: zonedTimeToUtc(
          { year: 2026, month: 9, day: 11, hour: 0, minute: 10 },
          tz,
        ),
        timeZone: tz,
        leadDays: 1,
      })[0]?.kind,
    ).toBe("taskOverdue");
  });

  it("skips done, cancelled, unassigned and undated tasks", () => {
    const now = at(12, 8);
    expect(
      planReminders({
        tasks: [task({ status: "done" })],
        now,
        timeZone: tz,
        leadDays: 1,
      }),
    ).toEqual([]);
    expect(
      planReminders({
        tasks: [task({ status: "cancelled" })],
        now,
        timeZone: tz,
        leadDays: 1,
      }),
    ).toEqual([]);
    expect(
      planReminders({
        tasks: [task({ assigneeUserId: null })],
        now,
        timeZone: tz,
        leadDays: 1,
      }),
    ).toEqual([]);
    expect(
      planReminders({
        tasks: [task({ dueAt: null })],
        now,
        timeZone: tz,
        leadDays: 1,
      }),
    ).toEqual([]);
  });

  it("derives a dedupe key per task, kind, day and channel so a rerun cannot duplicate", () => {
    const [plan] = planReminders({
      tasks: [task()],
      now: at(12, 8),
      timeZone: tz,
      leadDays: 1,
    });
    expect(dedupeKeyFor(plan!, "email")).toBe(
      "task:000000000000000000000001:taskOverdue:2026-09-12:email",
    );
    expect(dedupeKeyFor(plan!, "zalo")).not.toBe(dedupeKeyFor(plan!, "email"));
    const rerun = planReminders({
      tasks: [task()],
      now: at(12, 15),
      timeZone: tz,
      leadDays: 1,
    });
    expect(dedupeKeyFor(rerun[0]!, "email")).toBe(dedupeKeyFor(plan!, "email"));
  });
});

describe("quiet hours", () => {
  const quiet = parseQuietHours("21-7");

  it("detects the wrapped window and pushes delivery to its end", () => {
    expect(isQuietHour(at(10, 22), tz, quiet)).toBe(true);
    expect(isQuietHour(at(10, 6), tz, quiet)).toBe(true);
    expect(isQuietHour(at(10, 9), tz, quiet)).toBe(false);
    expect(nextDeliveryInstant(at(10, 22), tz, quiet).toISOString()).toBe(
      at(11, 7).toISOString(),
    );
    expect(nextDeliveryInstant(at(10, 6), tz, quiet).toISOString()).toBe(
      at(10, 7).toISOString(),
    );
    expect(nextDeliveryInstant(at(10, 9), tz, quiet).toISOString()).toBe(
      at(10, 9).toISOString(),
    );
  });

  it("treats an empty window as always deliverable", () => {
    expect(isQuietHour(at(10, 22), tz, parseQuietHours("0-0"))).toBe(false);
  });
});

describe("retry backoff", () => {
  it("backs off with a ceiling", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    expect(nextRetryAt(1, now)?.toISOString()).toBe("2026-09-10T00:05:00.000Z");
    expect(nextRetryAt(5, now)?.toISOString()).toBe("2026-09-10T12:00:00.000Z");
    expect(nextRetryAt(6, now)).toBeNull();
  });
});

describe("reminderStillApplies", () => {
  const intent = {
    kind: "taskDue" as const,
    recipientUserId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    dedupeKey: "task:1:taskDue:2026-09-10:email",
  };

  it("drops a reminder once the task is done, reassigned, rescheduled or gone", () => {
    const now = at(10, 8);
    expect(reminderStillApplies(task(), intent, now, tz)).toEqual({
      applies: true,
    });
    expect(
      reminderStillApplies(task({ status: "done" }), intent, now, tz),
    ).toEqual({ applies: false, reason: "TASK_CLOSED" });
    expect(
      reminderStillApplies(
        task({ assigneeUserId: "bbbbbbbbbbbbbbbbbbbbbbbb" }),
        intent,
        now,
        tz,
      ),
    ).toEqual({ applies: false, reason: "TASK_REASSIGNED" });
    expect(
      reminderStillApplies(
        task({ dueAt: businessDayEnd("2026-09-20", tz) }),
        intent,
        now,
        tz,
      ),
    ).toEqual({ applies: false, reason: "TASK_RESCHEDULED" });
    expect(reminderStillApplies(null, intent, now, tz)).toEqual({
      applies: false,
      reason: "TASK_MISSING",
    });
  });
});

describe("reminderMessage", () => {
  it("carries the task, the order code and the link but no money", () => {
    const message = reminderMessage({
      kind: "taskOverdue",
      task: { title: "Đóng gói", orderCode: "RD-1", priority: "high" },
      dueDay: "2026-09-10",
      daysLate: 2,
      link: "http://localhost:3000/vi/admin/tasks?task=1",
    });
    expect(message.subject).toContain("Quá hạn 2 ngày");
    expect(message.subject).toContain("RD-1");
    expect(message.text).toContain("Ưu tiên cao");
    expect(message.html).toContain(
      "http://localhost:3000/vi/admin/tasks?task=1",
    );
    expect(message.chat.split("\n")).toHaveLength(3);
    expect(message.html).not.toMatch(/USD|VND/);
  });

  it("escapes HTML in staff-written titles", () => {
    const message = reminderMessage({
      kind: "taskDue",
      task: {
        title: "<script>alert(1)</script>",
        orderCode: null,
        priority: "normal",
      },
      dueDay: "2026-09-10",
      daysLate: 0,
      link: "http://localhost:3000/vi/admin/tasks",
    });
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;script&gt;");
  });
});
