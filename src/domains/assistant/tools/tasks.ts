import { z } from "zod";

import { taskDraftInputSchema } from "@/domains/assistant/contracts";
import {
  adminHref,
  guarded,
  isoDay,
  notFound,
  orderCodeSchema,
} from "@/domains/assistant/tools/shared";
import type { AssistantTool } from "@/domains/assistant/tools/types";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import { orderStages } from "@/domains/orders/workflow";
import { taskStatuses } from "@/domains/tasks/contracts";
import { formatBusinessDay, isOverdue } from "@/domains/tasks/policy";
import type { AccessContext } from "@/lib/auth/authorization";

/**
 * Task tools. Reading follows the task list guard; the two `propose_*`
 * tools never create a task — they record a proposal the person approves
 * from the portal, and their result says so in as many words.
 */

const listMyTasksInput = z.object({
  status: z.enum(taskStatuses).optional().describe("Defaults to open tasks."),
  dueWithinDays: z
    .number()
    .int()
    .min(0)
    .max(90)
    .optional()
    .describe("Only open tasks due within this many days (overdue included)."),
  overdueOnly: z
    .boolean()
    .optional()
    .describe("Only open tasks past their deadline."),
  orderCode: orderCodeSchema
    .optional()
    .describe("Only tasks linked to this order."),
  limit: z.number().int().min(1).max(100).default(30),
});

export const listMyTasksTool: AssistantTool<z.infer<typeof listMyTasksInput>> =
  {
    name: "list_my_tasks",
    description:
      "List work items (tasks) the signed-in user can see: their own and assigned tasks, or every task inside their units. Use it for 'what do I need to do today', 'what is overdue', 'what is due this week'. Each item carries the due date in the business timezone and whether it is overdue.",
    inputSchema: listMyTasksInput,
    requires: ["tasks.read"],
    async run(input, context) {
      return guarded(async () => {
        const { scope } = await context.auth.requireListAccess("tasks.read");
        let orderId: string | undefined;
        if (input.orderCode) {
          const order =
            await context.services.orders.findByCodeForAuthorization(
              input.orderCode,
            );
          if (!order) return notFound("Order");
          orderId = order.id;
        }
        const dueBefore =
          input.dueWithinDays !== undefined
            ? new Date(context.now.getTime() + input.dueWithinDays * 86_400_000)
            : input.overdueOnly
              ? context.now
              : undefined;
        const status = input.status ?? (dueBefore ? "open" : undefined);
        const tasks = await context.services.tasks.list({
          scope:
            scope.kind === "all"
              ? { kind: "all" }
              : scope.kind === "businessUnits"
                ? {
                    kind: "businessUnits",
                    businessUnitIds: scope.businessUnitIds,
                    userId: context.userId,
                  }
                : { kind: "own", userId: context.userId },
          ...(status ? { status } : {}),
          ...(orderId ? { orderId } : {}),
          ...(dueBefore ? { dueBefore } : {}),
          limit: input.limit,
        });
        const items = tasks
          .filter((task) =>
            input.overdueOnly ? isOverdue(task, context.now) : true,
          )
          .map((task) => ({
            id: task.id,
            title: task.title,
            note: task.note,
            status: task.status,
            priority: task.priority,
            orderCode: task.orderCode,
            stage: task.stage,
            ownerRole: task.ownerRole,
            assignedToMe: task.assigneeUserId === context.userId,
            dueDate: task.dueAt
              ? formatBusinessDay(task.dueAt, context.timeZone)
              : null,
            overdue: isOverdue(task, context.now),
            completedAt: task.completedAt?.toISOString() ?? null,
          }));
        return {
          ok: true,
          data: {
            today: formatBusinessDay(context.now, context.timeZone),
            items,
            total: items.length,
          },
          sources: [
            {
              label: context.locale === "vi" ? "Việc cần làm" : "Tasks",
              href: adminHref(context.locale, "/tasks"),
            },
          ],
        };
      });
    },
  };

/** Two guards for one action: the union of what each evaluated. */
function merge(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

const proposeOrderPlanInput = z.object({
  orderCode: orderCodeSchema.describe("The order to plan."),
  targetReadyDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .describe(
      "Override the ready date (YYYY-MM-DD) only when the user states one; otherwise omit and the order file's date is used.",
    ),
  stageDurations: z
    .record(z.enum(orderStages), z.number().int().min(0).max(365))
    .optional()
    .describe(
      "Days per stage the user explicitly gave; unspecified stages use defaults.",
    ),
  stageNotes: z
    .record(z.enum(orderStages), z.string().trim().max(500))
    .optional()
    .describe("Short notes per stage taken from the user's instructions."),
});

export const proposeOrderPlanTool: AssistantTool<
  z.infer<typeof proposeOrderPlanInput>
> = {
  name: "propose_order_plan",
  description:
    "Draft a task plan for an order from the stages it still has to pass in the company's fifteen-step process: one task per remaining stage, owned by the position the process names, with due dates derived from the expected ready date (or default durations when none is set). The result is a PROPOSAL that a person must approve in the portal; no task exists until then. Report the proposal id, the item count, and every assumption verbatim.",
  inputSchema: proposeOrderPlanInput,
  requires: ["orders.read", "tasks.create"],
  async run(input, context) {
    return guarded(async () => {
      const order = await context.services.orders.findByCodeForAuthorization(
        input.orderCode,
      );
      if (!order) return notFound("Order");
      await context.auth.requirePermission("orders.read", {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
      });
      const access = await context.auth.requirePermission("tasks.create", {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
        ownerUserId: context.userId,
      });
      const proposal = await context.services.proposals.proposeOrderPlan(
        access,
        {
          order,
          locale: context.locale,
          overrides: {
            targetReadyDate: input.targetReadyDate ?? null,
            stageDurations: input.stageDurations ?? {},
            stageNotes: input.stageNotes ?? {},
          },
        },
      );
      return {
        ok: true,
        data: {
          proposalId: proposal.id,
          status: proposal.status,
          orderCode: proposal.orderCode,
          itemCount: proposal.items.length,
          items: proposal.items.map((item) => ({
            index: item.index,
            title: item.title,
            ownerRole: item.ownerRole,
            assigneeUserId: item.assigneeUserId,
            dueDate: item.dueDate,
            dependsOn: item.dependsOn,
          })),
          assumptions: proposal.assumptions,
          nextStep:
            "A person holding tasks.approvePlan must approve this proposal in the portal before any task is created.",
        },
        sources: [
          {
            label:
              context.locale === "vi"
                ? "Đề xuất chờ duyệt"
                : "Pending proposals",
            href: adminHref(context.locale, "/tasks#proposals"),
          },
          {
            label: order.orderCode,
            href: adminHref(context.locale, `/orders/${order.id}`),
          },
        ],
      };
    });
  },
};

const proposeTasksInput = z.object({
  tasks: z.array(taskDraftInputSchema).min(1).max(10),
});

export const proposeTasksTool: AssistantTool<
  z.infer<typeof proposeTasksInput>
> = {
  name: "propose_tasks",
  description:
    "Draft one or more ad-hoc work items (reminders, follow-ups) for the signed-in user or, if they hold tasks.assign, for a colleague. Dates are YYYY-MM-DD in the business timezone. The result is a PROPOSAL the user confirms in the portal; nothing is saved as a task until then. Never claim the task was created.",
  inputSchema: proposeTasksInput,
  requires: ["tasks.create"],
  async run(input, context) {
    return guarded(async () => {
      const drafts: {
        title: string;
        note: string | null;
        dueDate: string | null;
        order: OrderRecordDto | null;
        assigneeUserId: string | null;
        priority: "normal" | "high";
      }[] = [];
      const unitIds = new Set<string>();
      let needsAssign = false;
      for (const draft of input.tasks) {
        let order: OrderRecordDto | null = null;
        if (draft.orderCode) {
          order = await context.services.orders.findByCodeForAuthorization(
            draft.orderCode,
          );
          if (!order) return notFound(`Order ${draft.orderCode}`);
          await context.auth.requirePermission("orders.read", {
            resourceId: order.id,
            businessUnitIds: order.businessUnitIds,
          });
          for (const id of order.businessUnitIds) unitIds.add(id);
        }
        if (draft.assigneeUserId && draft.assigneeUserId !== context.userId) {
          needsAssign = true;
        }
        drafts.push({
          title: draft.title,
          note: draft.note,
          dueDate: draft.dueDate,
          order,
          assigneeUserId: draft.assigneeUserId ?? context.userId,
          priority: draft.priority,
        });
      }

      // Drafts without an order are stamped with the proposer's own granted
      // units (resolved from their grants, never from the request), so a
      // unit-bound grant reaches the resulting tasks.
      const coverage = (
        await context.auth.coverages(["tasks.create"] as const)
      )["tasks.create"];
      const fallbackUnits = coverage.global
        ? []
        : [...coverage.businessUnitIds];
      const targetUnits = unitIds.size > 0 ? [...unitIds] : fallbackUnits;

      let access = await context.auth.requirePermission("tasks.create", {
        businessUnitIds: targetUnits,
        ownerUserId: context.userId,
      });
      if (needsAssign) {
        access = merge(
          access,
          await context.auth.requirePermission("tasks.assign", {
            businessUnitIds: targetUnits,
            ownerUserId: context.userId,
          }),
        );
      }

      const proposal = await context.services.proposals.proposeTasks(access, {
        drafts,
        locale: context.locale,
        fallbackBusinessUnitIds: fallbackUnits,
      });
      return {
        ok: true,
        data: {
          proposalId: proposal.id,
          status: proposal.status,
          itemCount: proposal.items.length,
          items: proposal.items.map((item) => ({
            index: item.index,
            title: item.title,
            dueDate: item.dueDate,
            assigneeUserId: item.assigneeUserId,
          })),
          assumptions: proposal.assumptions,
          nextStep:
            "The user must confirm this proposal in the portal before any task is created.",
        },
        sources: [
          {
            label:
              context.locale === "vi"
                ? "Đề xuất chờ duyệt"
                : "Pending proposals",
            href: adminHref(context.locale, "/tasks#proposals"),
          },
        ],
      };
    });
  },
};

export const taskDateHelpers = { isoDay };
