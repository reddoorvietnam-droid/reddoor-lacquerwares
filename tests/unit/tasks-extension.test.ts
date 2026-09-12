import { describe, expect, it } from "vitest";

import { TaskCommandError } from "@/domains/tasks/contracts";
import { TaskCommandService } from "@/domains/tasks/service";
import { businessDayEnd } from "@/domains/tasks/policy";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

import {
  FakeTaskStore,
  FakeUserDirectory,
  roleUsers,
} from "./helpers/assistant-fakes";
import {
  accessContext,
  auditRepository,
  FakeOrderStore,
} from "./helpers/finance-fakes";

/**
 * Asking for more time, and answering.
 *
 * The deadline belongs to whoever handed the work out: the assignee may ask
 * and must say why, the answer moves the date or leaves it, and nothing in
 * between changes what the reminder job will send.
 */
const tz = "Asia/Ho_Chi_Minh";
const now = new Date("2026-09-12T03:00:00.000Z"); // 10:00 in Vietnam
const director = roleUsers.DIRECTOR;
const storekeeper = roleUsers.WAREHOUSE_MANAGER;

function build(units: readonly string[] = []) {
  const tasks = new FakeTaskStore();
  const orders = new FakeOrderStore();
  const users = new FakeUserDirectory();
  const audit = auditRepository();
  const service = new TaskCommandService({
    store: tasks,
    orderStore: orders,
    userDirectory: users,
    userUnits: {
      async unitsFor() {
        return units;
      },
    },
    auditRepository: audit,
    timeZone: tz,
    now: () => now,
  });
  return { tasks, audit, service };
}

const assigner = accessContext(
  ["tasks.create", "tasks.assign", "tasks.update"],
  "all",
  director.id,
);
const worker = accessContext(["tasks.update"], "own", storekeeper.id);

async function assignedTask(
  service: TaskCommandService,
  dueDate = "2026-09-15",
) {
  return service.create(assigner, {
    title: "Kiểm kê kho sơn",
    note: null,
    priority: "normal",
    orderId: "",
    assigneeUserId: storekeeper.id,
    dueDate,
  });
}

describe("asking for more time", () => {
  it("records the request without moving the deadline", async () => {
    const { service, audit } = build();
    const task = await assignedTask(service);

    const updated = await service.requestExtension(worker, {
      taskId: task.id,
      expectedRevision: task.revision,
      requestedDueDate: "2026-09-18",
      reason: "Chờ sơn về kho",
    });

    expect(updated.dueAt).toEqual(businessDayEnd("2026-09-15", tz));
    expect(updated.extensionRequest).toEqual({
      requestedDueAt: businessDayEnd("2026-09-18", tz),
      reason: "Chờ sơn về kho",
      requestedBy: storekeeper.id,
      requestedAt: now,
    });
    expect(
      audit.events
        .map((event) => event.action)
        .filter((action) => action.startsWith("task.")),
    ).toEqual(["task.created", "task.extensionRequested"]);
  });

  it("is refused to anyone but the assignee", async () => {
    const { service } = build();
    const task = await assignedTask(service);
    const other = accessContext(
      ["tasks.update"],
      "own",
      roleUsers.FACTORY_MANAGER.id,
    );

    await expect(
      service.requestExtension(other, {
        taskId: task.id,
        expectedRevision: task.revision,
        requestedDueDate: "2026-09-18",
        reason: "Muốn dời hộ",
      }),
    ).rejects.toMatchObject({ code: "NOT_ASSIGNEE" });
  });

  it("takes one request at a time", async () => {
    const { service } = build();
    const task = await assignedTask(service);
    const asked = await service.requestExtension(worker, {
      taskId: task.id,
      expectedRevision: task.revision,
      requestedDueDate: "2026-09-18",
      reason: "Chờ sơn về kho",
    });

    await expect(
      service.requestExtension(worker, {
        taskId: asked.id,
        expectedRevision: asked.revision,
        requestedDueDate: "2026-09-20",
        reason: "Xin thêm lần nữa",
      }),
    ).rejects.toMatchObject({ code: "EXTENSION_PENDING" });
  });

  it("refuses a day already gone or the deadline already set", async () => {
    const { service } = build();
    const task = await assignedTask(service);

    for (const requestedDueDate of ["2026-09-10", "2026-09-15"]) {
      await expect(
        service.requestExtension(worker, {
          taskId: task.id,
          expectedRevision: task.revision,
          requestedDueDate,
          reason: "Không kịp",
        }),
      ).rejects.toMatchObject({ code: "INVALID_DUE_DATE" });
    }
  });

  it("refuses a task that is already finished", async () => {
    const { service } = build();
    const task = await assignedTask(service);
    const done = await service.setStatus(worker, {
      taskId: task.id,
      expectedRevision: task.revision,
      status: "done",
      reason: null,
    });

    await expect(
      service.requestExtension(worker, {
        taskId: done.id,
        expectedRevision: done.revision,
        requestedDueDate: "2026-09-18",
        reason: "Quên mất",
      }),
    ).rejects.toBeInstanceOf(TaskCommandError);
  });
});

describe("answering the request", () => {
  async function pending() {
    const built = build();
    const task = await assignedTask(built.service);
    const asked = await built.service.requestExtension(worker, {
      taskId: task.id,
      expectedRevision: task.revision,
      requestedDueDate: "2026-09-18",
      reason: "Chờ sơn về kho",
    });
    return { ...built, asked };
  }

  it("moves the deadline when approved and clears the request", async () => {
    const { service, asked, audit } = await pending();

    const decided = await service.decideExtension(assigner, {
      taskId: asked.id,
      expectedRevision: asked.revision,
      outcome: "approved",
      note: "Ok, cố xong trước 18",
    });

    expect(decided.task.dueAt).toEqual(businessDayEnd("2026-09-18", tz));
    expect(decided.task.extensionRequest).toBeNull();
    expect(decided.task.lastExtensionDecision).toMatchObject({
      outcome: "approved",
      requestedDueAt: businessDayEnd("2026-09-18", tz),
      note: "Ok, cố xong trước 18",
      decidedBy: director.id,
    });
    expect(decided.requestedBy).toBe(storekeeper.id);
    expect(audit.events.at(-1)?.action).toBe("task.extensionApproved");
  });

  it("leaves the deadline alone when declined", async () => {
    const { service, asked } = await pending();

    const decided = await service.decideExtension(assigner, {
      taskId: asked.id,
      expectedRevision: asked.revision,
      outcome: "rejected",
      note: null,
    });

    expect(decided.task.dueAt).toEqual(businessDayEnd("2026-09-15", tz));
    expect(decided.task.extensionRequest).toBeNull();
    expect(decided.task.lastExtensionDecision?.outcome).toBe("rejected");
  });

  it("needs the grant that hands work out", async () => {
    const { service, asked } = await pending();

    await expect(
      service.decideExtension(worker, {
        taskId: asked.id,
        expectedRevision: asked.revision,
        outcome: "approved",
        note: null,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });

  it("refuses when nothing is waiting", async () => {
    const { service } = build();
    const task = await assignedTask(service);

    await expect(
      service.decideExtension(assigner, {
        taskId: task.id,
        expectedRevision: task.revision,
        outcome: "approved",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "EXTENSION_NOT_FOUND" });
  });
});

describe("work handed to someone else", () => {
  it("carries the units of the person who has to do it", async () => {
    const { service } = build(["66c84b2d12ad6a75f9400010"]);
    const task = await assignedTask(service);
    expect(task.businessUnitIds).toEqual(["66c84b2d12ad6a75f9400010"]);
  });

  it("keeps a deadline the assigner sets by hand and drops the pending plea", async () => {
    const { service } = build();
    const task = await assignedTask(service);
    const asked = await service.requestExtension(worker, {
      taskId: task.id,
      expectedRevision: task.revision,
      requestedDueDate: "2026-09-18",
      reason: "Chờ sơn về kho",
    });

    const edited = await service.update(assigner, {
      taskId: asked.id,
      expectedRevision: asked.revision,
      title: asked.title,
      note: null,
      priority: "high",
      assigneeUserId: storekeeper.id,
      dueDate: "2026-09-16",
    });

    expect(edited.dueAt).toEqual(businessDayEnd("2026-09-16", tz));
    expect(edited.extensionRequest).toBeNull();
  });
});
