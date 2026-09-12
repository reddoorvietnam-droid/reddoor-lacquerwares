import { describe, expect, it } from "vitest";

import { AssistantProposalService } from "@/domains/assistant/service";
import { TaskCommandService } from "@/domains/tasks/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

import {
  FakeProposalStore,
  FakeTaskStore,
  FakeUserDirectory,
  roleUsers,
} from "./helpers/assistant-fakes";
import {
  accessContext,
  auditRepository,
  FakeOrderStore,
  occurredAt,
} from "./helpers/finance-fakes";

const tz = "Asia/Ho_Chi_Minh";

function build(now: Date = occurredAt) {
  const orders = new FakeOrderStore();
  const tasks = new FakeTaskStore();
  const proposals = new FakeProposalStore();
  const users = new FakeUserDirectory();
  const audit = auditRepository();
  const taskService = new TaskCommandService({
    store: tasks,
    orderStore: orders,
    userDirectory: users,
    // The fake directory carries no grants; unit-less work stays unit-less.
    userUnits: {
      async unitsFor() {
        return [];
      },
    },
    auditRepository: audit,
    timeZone: tz,
    now: () => now,
  });
  const service = new AssistantProposalService({
    store: proposals,
    orderStore: orders,
    taskService,
    userDirectory: users,
    auditRepository: audit,
    timeZone: tz,
    now: () => now,
  });
  return { orders, tasks, proposals, users, audit, taskService, service };
}

const proposer = accessContext(
  ["tasks.create"],
  "assignedBusinessUnits",
  roleUsers.COMPANY_ACCOUNTANT.id,
);
const approver = accessContext(
  ["tasks.approvePlan", "tasks.create"],
  "all",
  roleUsers.DIRECTOR.id,
);

describe("AssistantProposalService.proposeOrderPlan", () => {
  it("drafts a proposal pinned to the order revision, without creating any task", async () => {
    const { service, orders, tasks, audit } = build();
    const order = orders.seed({
      stage: "received",
      revision: 2,
      expectedReadyAt: new Date("2026-10-15T00:00:00Z"),
    });

    const proposal = await service.proposeOrderPlan(proposer, {
      order,
      locale: "vi",
      overrides: { targetReadyDate: null, stageDurations: {}, stageNotes: {} },
    });

    expect(proposal.status).toBe("proposed");
    expect(proposal.orderRevision).toBe(2);
    expect(proposal.items.length).toBeGreaterThan(5);
    expect(
      proposal.items.find((i) => i.stage === "fileOpened")?.assigneeUserId,
    ).toBe(roleUsers.COMPANY_ACCOUNTANT.id);
    expect(tasks.tasks.size).toBe(0);
    expect(audit.events.map((e) => e.action)).toContain(
      "assistant.proposalCreated",
    );
    expect(proposal.summary).not.toMatch(/USD|VND|\d{4,}/);
  });

  it("refuses a closed order, a past target date, and a context without tasks.create", async () => {
    const { service, orders } = build();
    const closed = orders.seed({ stage: "closed" });
    const open = orders.seed({ stage: "received" });
    const overrides = {
      targetReadyDate: null,
      stageDurations: {},
      stageNotes: {},
    };
    await expect(
      service.proposeOrderPlan(proposer, {
        order: closed,
        locale: "vi",
        overrides,
      }),
    ).rejects.toMatchObject({ code: "ORDER_CLOSED" });
    await expect(
      service.proposeOrderPlan(proposer, {
        order: open,
        locale: "vi",
        overrides: { ...overrides, targetReadyDate: "2020-01-01" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_PLAN" });
    await expect(
      service.proposeOrderPlan(accessContext(["tasks.read"]), {
        order: open,
        locale: "vi",
        overrides,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("AssistantProposalService.decide", () => {
  async function proposed(now = occurredAt) {
    const built = build(now);
    const order = built.orders.seed({
      stage: "received",
      revision: 0,
      expectedReadyAt: new Date("2026-10-15T00:00:00Z"),
    });
    const proposal = await built.service.proposeOrderPlan(proposer, {
      order,
      locale: "vi",
      overrides: { targetReadyDate: null, stageDurations: {}, stageNotes: {} },
    });
    return { ...built, order, proposal };
  }

  it("approval creates one task per item with dependencies, and a second approval creates nothing more", async () => {
    const { service, proposal, tasks, order } = await proposed();

    const first = await service.decide(approver, {
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      decision: "approved",
      reason: null,
    });
    expect(first.proposal.status).toBe("approved");
    expect(first.tasks).toHaveLength(proposal.items.length);
    expect(tasks.tasks.size).toBe(proposal.items.length);
    const second = first.tasks[1]!;
    expect(second.dependsOnTaskIds).toEqual([first.tasks[0]!.id]);
    expect(second.orderCode).toBe(order.orderCode);
    expect(second.businessUnitIds).toEqual(order.businessUnitIds);
    expect(second.dueAt?.toISOString()).toMatch(/T16:59:59\.999Z$/);

    await expect(
      service.decide(approver, {
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        decision: "approved",
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "ALREADY_DECIDED" });
    expect(tasks.tasks.size).toBe(proposal.items.length);
  });

  it("two concurrent approvals end with one set of tasks and one approved proposal", async () => {
    const { service, proposal, tasks, proposals } = await proposed();
    const input = {
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      decision: "approved" as const,
      reason: null,
    };
    const results = await Promise.allSettled([
      service.decide(approver, input),
      service.decide(approver, input),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(tasks.tasks.size).toBe(proposal.items.length);
    expect(proposals.proposals.get(proposal.id)?.status).toBe("approved");
  });

  it("refuses to apply a plan whose order moved on and expires the proposal", async () => {
    const { service, proposal, orders, order, tasks, proposals } =
      await proposed();
    await orders.applyTransition({
      orderId: order.id,
      expectedRevision: 0,
      to: "fileOpened",
      qcPassed: false,
      historyEntry: {
        from: "received",
        to: "fileOpened",
        byUserId: proposer.userId,
        reason: null,
        at: occurredAt,
      },
      updatedBy: proposer.userId,
    });
    await expect(
      service.decide(approver, {
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        decision: "approved",
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "SOURCE_CHANGED" });
    expect(tasks.tasks.size).toBe(0);
    expect(proposals.proposals.get(proposal.id)?.status).toBe("expired");
  });

  it("refuses a plan whose dates have passed by approval time", async () => {
    const { service, proposal, tasks } = await proposed();
    const later = new AssistantProposalService({
      ...(
        service as unknown as {
          dependencies: ConstructorParameters<
            typeof AssistantProposalService
          >[0];
        }
      ).dependencies,
      now: () => new Date("2027-01-01T00:00:00Z"),
    });
    await expect(
      later.decide(approver, {
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        decision: "approved",
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_PLAN" });
    expect(tasks.tasks.size).toBe(0);
  });

  it("demands tasks.approvePlan AND tasks.create for an order plan, a reason for a rejection, and the current revision", async () => {
    const { service, proposal, tasks } = await proposed();
    await expect(
      service.decide(
        accessContext(["tasks.create"], "all", roleUsers.WAREHOUSE_MANAGER.id),
        {
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          decision: "approved",
          reason: null,
        },
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    // Approval alone is not enough either: the tasks it creates need tasks.create.
    await expect(
      service.decide(
        accessContext(["tasks.approvePlan"], "all", roleUsers.DIRECTOR.id),
        {
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          decision: "approved",
          reason: null,
        },
      ),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    expect(tasks.tasks.size).toBe(0);
    await expect(
      service.decide(approver, {
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        decision: "rejected",
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.decide(approver, {
        proposalId: proposal.id,
        expectedRevision: 99,
        decision: "approved",
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
    const rejected = await service.decide(approver, {
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      decision: "rejected",
      reason: "Chưa chốt ngày",
    });
    expect(rejected.proposal.status).toBe("rejected");
    expect(tasks.tasks.size).toBe(0);
  });
});

describe("AssistantProposalService.proposeTasks", () => {
  it("drafts ad-hoc tasks for the requester, then approval with tasks.create creates them once", async () => {
    const { service, tasks } = build();
    const proposal = await service.proposeTasks(proposer, {
      locale: "vi",
      drafts: [
        {
          title: "Gọi khách Kiso",
          note: null,
          dueDate: "2026-09-06",
          order: null,
          assigneeUserId: proposer.userId,
          priority: "high",
        },
        {
          title: "Kiểm tra mẫu",
          note: null,
          dueDate: null,
          order: null,
          assigneeUserId: proposer.userId,
          priority: "normal",
        },
      ],
    });
    expect(proposal.kind).toBe("tasks");
    expect(proposal.assumptions.some((a) => a.includes("chưa có hạn"))).toBe(
      true,
    );

    const decided = await service.decide(
      accessContext(["tasks.create"], "own", proposer.userId),
      {
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        decision: "approved",
        reason: null,
      },
    );
    expect(decided.tasks).toHaveLength(2);
    expect(decided.tasks[0]!.assigneeUserId).toBe(proposer.userId);
    expect(tasks.tasks.size).toBe(2);
  });

  it("refuses inactive assignees and drafts spanning two orders", async () => {
    const { service, orders } = build();
    await expect(
      service.proposeTasks(proposer, {
        locale: "vi",
        drafts: [
          {
            title: "x",
            note: null,
            dueDate: null,
            order: null,
            assigneeUserId: "ffffffffffffffffffffffff",
            priority: "normal",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PLAN" });
    const a = orders.seed({ stage: "received" });
    const b = orders.seed({ stage: "received" });
    await expect(
      service.proposeTasks(proposer, {
        locale: "vi",
        drafts: [
          {
            title: "a",
            note: null,
            dueDate: null,
            order: a,
            assigneeUserId: proposer.userId,
            priority: "normal",
          },
          {
            title: "b",
            note: null,
            dueDate: null,
            order: b,
            assigneeUserId: proposer.userId,
            priority: "normal",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INVALID_PLAN" });
  });
});

describe("TaskCommandService", () => {
  it("creates a manual task with a business-day deadline and marks it done, refusing a stale revision", async () => {
    const { taskService, orders } = build();
    const order = orders.seed({ stage: "inProduction" });
    const context = accessContext(
      ["tasks.create", "tasks.update"],
      "own",
      roleUsers.WAREHOUSE_MANAGER.id,
    );
    const task = await taskService.create(context, {
      title: "Xuất sơn lô 3",
      orderId: order.id,
      dueDate: "2026-09-08",
      priority: "normal",
    });
    expect(task.orderCode).toBe(order.orderCode);
    expect(task.assigneeUserId).toBe(roleUsers.WAREHOUSE_MANAGER.id);
    expect(task.dueAt?.toISOString()).toBe("2026-09-08T16:59:59.999Z");

    const done = await taskService.setStatus(context, {
      taskId: task.id,
      expectedRevision: 0,
      status: "done",
    });
    expect(done.status).toBe("done");
    expect(done.completedBy).toBe(context.userId);
    await expect(
      taskService.setStatus(context, {
        taskId: task.id,
        expectedRevision: 0,
        status: "open",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("requires tasks.assign to hand work to someone else and refuses closed orders", async () => {
    const { taskService, orders } = build();
    const closed = orders.seed({ stage: "cancelled" });
    const creator = accessContext(
      ["tasks.create"],
      "own",
      roleUsers.FACTORY_ACCOUNTANT.id,
    );
    await expect(
      taskService.create(creator, {
        title: "x",
        assigneeUserId: roleUsers.DIRECTOR.id,
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
    await expect(
      taskService.create(creator, { title: "x", orderId: closed.id }),
    ).rejects.toMatchObject({ code: "ORDER_CLOSED" });
  });

  it("[unit] applying plan items twice reuses slots (idempotent) and wires dependencies", async () => {
    const { taskService, tasks } = build();
    const context = accessContext(
      ["tasks.create"],
      "all",
      roleUsers.DIRECTOR.id,
    );
    const items = [
      {
        index: 0,
        title: "A",
        note: null,
        stage: null,
        ownerRole: null,
        assigneeUserId: null,
        dueDate: "2026-09-07",
        dependsOn: [],
        priority: "normal" as const,
      },
      {
        index: 1,
        title: "B",
        note: null,
        stage: null,
        ownerRole: null,
        assigneeUserId: null,
        dueDate: "2026-09-08",
        dependsOn: [0],
        priority: "normal" as const,
      },
    ];
    const first = await taskService.applyPlanItems(context, {
      proposalId: "888888888888888888888888",
      order: null,
      items,
    });
    const again = await taskService.applyPlanItems(context, {
      proposalId: "888888888888888888888888",
      order: null,
      items,
    });
    expect(first.createdCount).toBe(2);
    expect(again.createdCount).toBe(0);
    expect(tasks.tasks.size).toBe(2);
    expect(again.tasks[1]!.dependsOnTaskIds).toEqual([first.tasks[0]!.id]);
  });
});
