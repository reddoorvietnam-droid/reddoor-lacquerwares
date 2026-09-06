import { z } from "zod";

import {
  adminHref,
  guarded,
  isoDay,
  moneyView,
  notFound,
  objectIdSchema,
  orderCodeSchema,
} from "@/domains/assistant/tools/shared";
import type {
  AssistantTool,
  ToolContext,
} from "@/domains/assistant/tools/types";
import type { OrderRecordDto } from "@/domains/orders/contracts";
import {
  isTerminalStage,
  orderStageDefinitions,
  orderStages,
  stageDefinition,
} from "@/domains/orders/workflow";
import { isOverdue } from "@/domains/tasks/policy";
import { coverageReaches } from "@/lib/auth";

/**
 * Order tools. Both read through the same guard and the same command
 * service as the order pages, so the model sees exactly the projection the
 * signed-in person would see on screen: the selling price appears only for
 * holders of `orders.readSellingPrice`, invoices and money only for holders
 * of the finance reads, and never otherwise — not even as `null`.
 */

const stageLabel = (stage: OrderRecordDto["stage"], locale: "vi" | "en") =>
  orderStageDefinitions[stage].labels[locale];

function orderListView(order: OrderRecordDto, locale: "vi" | "en") {
  const definition = stageDefinition(order.stage);
  return {
    id: order.id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    stage: order.stage,
    step: definition.step,
    stageLabel: stageLabel(order.stage, locale),
    ownerRole: definition.ownerRole,
    terminal: isTerminalStage(order.stage),
    expectedReadyDate: isoDay(order.expectedReadyAt),
    updatedAt: order.updatedAt.toISOString(),
  };
}

const listOrdersInput = z.object({
  stage: z
    .enum(orderStages)
    .optional()
    .describe("Only orders currently in this workflow stage."),
  customerQuery: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("Case-insensitive part of the customer name."),
  limit: z.number().int().min(1).max(50).default(20),
});

export const listOrdersTool: AssistantTool<z.infer<typeof listOrdersInput>> = {
  name: "list_orders",
  description:
    "List sales orders inside the signed-in user's scope with their current workflow stage, owner position and expected ready date. Use it to answer 'what is in progress', 'which orders are at stage X', or to find an order code. Returns no prices.",
  inputSchema: listOrdersInput,
  requires: ["orders.read"],
  async run(input, context) {
    return guarded(async () => {
      const { scope } = await context.auth.requireListAccess("orders.read");
      const filter =
        scope.kind === "all"
          ? ({ kind: "all" } as const)
          : scope.kind === "businessUnits"
            ? ({
                kind: "businessUnits",
                businessUnitIds: scope.businessUnitIds,
              } as const)
            : ({ kind: "own", userId: scope.userId } as const);
      const query = input.customerQuery?.toLowerCase();
      const orders = (await context.services.orders.list(filter, false))
        .filter((order) => (input.stage ? order.stage === input.stage : true))
        .filter((order) =>
          query ? order.customerName.toLowerCase().includes(query) : true,
        )
        .slice(0, input.limit);
      return {
        ok: true,
        data: {
          items: orders.map((order) => orderListView(order, context.locale)),
          total: orders.length,
        },
        sources: [
          {
            label: context.locale === "vi" ? "Sổ đơn hàng" : "Order book",
            href: adminHref(context.locale, "/orders"),
          },
        ],
      };
    });
  },
};

const getOrderInput = z
  .object({
    orderCode: orderCodeSchema
      .optional()
      .describe("The order code, e.g. RD-20260905-AB12."),
    orderId: objectIdSchema.optional().describe("The order id when known."),
  })
  .refine((value) => value.orderCode || value.orderId, {
    message: "orderCode or orderId is required",
  });

export const getOrderTool: AssistantTool<z.infer<typeof getOrderInput>> = {
  name: "get_order",
  description:
    "Read one sales order: current stage and owner, allowed next stages, Director approval state, QC flag, export progress (expected ready date, booking), recent stage history, linked tasks, and — only when the user holds the permission — selling price, invoices, money received and costs. Use it for 'which step is order X at', 'what blocks it', 'is it approved'.",
  inputSchema: getOrderInput,
  requires: ["orders.read"],
  async run(input, context) {
    return guarded(async () => {
      const raw = input.orderId
        ? await context.services.orders.findForAuthorization(input.orderId)
        : await context.services.orders.findByCodeForAuthorization(
            input.orderCode!,
          );
      if (!raw) return notFound("Order");

      await context.auth.requirePermission("orders.read", {
        resourceId: raw.id,
        businessUnitIds: raw.businessUnitIds,
      });
      const coverages = await context.auth.coverages([
        "orders.readSellingPrice",
        "invoices.read",
        "payments.read",
        "expenses.read",
        "tasks.read",
      ] as const);
      const reaches = (permission: keyof typeof coverages) =>
        coverageReaches(coverages[permission], raw.businessUnitIds);

      const priceVisible = reaches("orders.readSellingPrice");
      const order = (await context.services.orders.findById(
        raw.id,
        priceVisible,
      ))!;
      const definition = stageDefinition(order.stage);

      let approval: null | { required: true; state: string } = null;
      if (definition.approvalSubject) {
        const found = await context.services.approvals.findForResource(
          "salesOrder",
          order.id,
          definition.approvalSubject,
        );
        const approvedValid =
          found.approved !== null &&
          found.approved.expectedRevision === order.revision;
        approval = {
          required: true,
          state: approvedValid
            ? "approved"
            : found.pending
              ? found.pending.expectedRevision === order.revision
                ? "pending"
                : "pendingStale"
              : found.approved
                ? "approvedStale"
                : "none",
        };
      }

      const data: Record<string, unknown> = {
        ...orderListView(order, context.locale),
        customerId: order.customerId,
        qcPassed: order.qcPassed,
        nextStages: definition.next.map((stage) => ({
          stage,
          label: stageLabel(stage, context.locale),
          ownerRole: orderStageDefinitions[stage].ownerRole,
        })),
        approval,
        bookingNumber: order.bookingNumber,
        bookingDate: isoDay(order.bookingDate),
        notes: order.notes,
        businessUnitCount: order.businessUnitIds.length,
        revision: order.revision,
        lastTransitions: [...order.stageHistory]
          .slice(-5)
          .reverse()
          .map((entry) => ({
            from: entry.from,
            to: entry.to,
            at: entry.at.toISOString(),
            reason: entry.reason,
          })),
        sellingPriceVisible: priceVisible,
      };
      if (priceVisible && order.sellingPrice) {
        data.sellingPrice = moneyView(order.sellingPrice, context.locale);
      }

      if (reaches("tasks.read")) {
        const { scope } = await context.auth.requireListAccess("tasks.read");
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
          orderId: order.id,
          limit: 50,
        });
        data.tasks = tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: isoDay(task.dueAt),
          overdue: isOverdue(task, context.now),
          assigneeUserId: task.assigneeUserId,
          ownerRole: task.ownerRole,
        }));
      }

      if (reaches("invoices.read")) {
        const [report, invoices] = await Promise.all([
          order.customerId
            ? context.services.finance.customerReceivables(
                order.customerId,
                context.now,
              )
            : context.services.finance.receivables(
                { kind: "all" },
                context.now,
              ),
          context.services.invoices.list({ orderId: order.id }),
        ]);
        const rows = new Map(
          report.invoices
            .filter((row) => row.invoice.orderId === order.id)
            .map((row) => [row.invoice.id, row]),
        );
        data.invoices = invoices.map((invoice) => {
          const row = rows.get(invoice.id);
          return {
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            dueDate: isoDay(invoice.dueAt),
            amount: moneyView(invoice.amount, context.locale),
            remaining: row ? moneyView(row.remaining, context.locale) : null,
            overdue: row?.overdue ?? false,
          };
        });
        data.money = report.orders
          .filter((row) => row.orderId === order.id)
          .map((row) => ({
            currency: row.currency,
            invoiced: moneyView(row.invoiced, context.locale),
            paid: moneyView(row.paid, context.locale),
            deposits: moneyView(row.deposits, context.locale),
            remaining: moneyView(row.remaining, context.locale),
          }));
      }

      if (reaches("expenses.read")) {
        const totals = await context.services.finance.sumActiveByOrder(
          [order.id],
          "expense",
        );
        data.costTotals = (totals.get(order.id) ?? []).map((total) =>
          moneyView(total, context.locale),
        );
      }

      return {
        ok: true,
        data,
        sources: [
          {
            label: order.orderCode,
            href: adminHref(context.locale, `/orders/${order.id}`),
          },
        ],
      };
    });
  },
};

export type OrderToolContext = ToolContext;
