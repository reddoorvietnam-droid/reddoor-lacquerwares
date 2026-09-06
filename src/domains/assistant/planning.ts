import type { PlanItemDraft } from "@/domains/assistant/contracts";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import {
  isTerminalStage,
  orderProgressStages,
  orderStageDefinitions,
  type OrderStage,
} from "@/domains/orders/workflow";
import { addBusinessDays, daysBetween } from "@/domains/tasks/policy";

/**
 * Order planning, kept pure.
 *
 * A plan is nothing more than the stages the order still has to pass in the
 * confirmed fifteen-step process, one task per stage, owned by the position
 * the process names for that stage. The assistant does not invent steps or
 * owners; it may only adjust durations and notes, and everything it could
 * not know — a missing ready date, a default duration, an unstaffed role —
 * is written down as an assumption so the approver sees it.
 */

/** Calendar days each stage is assumed to take when nobody has said otherwise. */
export const defaultStageDurations: Readonly<Record<OrderStage, number>> = {
  received: 1,
  fileOpened: 2,
  awaitingDirectorApproval: 1,
  productionPlanning: 2,
  inventoryCheck: 1,
  materialProcurement: 7,
  materialIssued: 1,
  inProduction: 14,
  qualityControl: 2,
  packing: 2,
  tradeDocumentation: 3,
  loadingScheduled: 2,
  shipped: 1,
  invoiced: 7,
  settled: 3,
  closed: 0,
  cancelled: 0,
};

/** Stages that must be finished before the goods are ready to leave. */
const readyByStages: ReadonlySet<OrderStage> = new Set([
  "received",
  "fileOpened",
  "awaitingDirectorApproval",
  "productionPlanning",
  "inventoryCheck",
  "materialIssued",
  "inProduction",
  "qualityControl",
  "packing",
]);

export type PlanOrderSnapshot = {
  id: string;
  orderCode: string;
  stage: OrderStage;
  expectedReadyAt: Date | null;
  revision: number;
};

export type RoleHolder = { id: string; displayName: string };

export type BuildPlanInput = {
  order: PlanOrderSnapshot;
  /** Today in the business timezone, `YYYY-MM-DD`. */
  today: string;
  timeZone: string;
  /** Active staff per position, for picking a default assignee. */
  roleHolders: ReadonlyMap<SystemRoleKey, readonly RoleHolder[]>;
  /** The model's adjustments; every value is validated before use. */
  overrides?: {
    targetReadyDate?: string | null;
    stageDurations?: Partial<Record<OrderStage, number>>;
    stageNotes?: Partial<Record<OrderStage, string>>;
  };
  locale?: "vi" | "en";
};

export type BuiltPlan = {
  items: PlanItemDraft[];
  assumptions: string[];
};

/** Stages still ahead of the order on the main path (no branches, no terminals). */
export function remainingStages(stage: OrderStage): OrderStage[] {
  if (isTerminalStage(stage)) return [];
  const index = orderProgressStages.indexOf(stage);
  if (index < 0) return [];
  return orderProgressStages
    .slice(index)
    .filter((candidate) => candidate !== "materialProcurement");
}

function formatBusinessDayFromInstant(instant: Date, timeZone: string): string {
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

const copy = {
  vi: {
    stageTitle: (step: number | null, label: string) =>
      step !== null ? `Bước ${step}: ${label}` : label,
    noReadyDate:
      "Đơn chưa có ngày dự kiến sẵn hàng; lịch được tính xuôi từ hôm nay với thời lượng mặc định.",
    scaled: (days: number) =>
      `Các bước trước khi sẵn hàng được nén để kịp ngày sẵn hàng (còn ${days} ngày); thời lượng mặc định bị rút ngắn.`,
    readyDateTooClose:
      "Ngày sẵn hàng đã qua hoặc quá gần; các bước sản xuất được xếp dồn vào ngày sẵn hàng và cần xác nhận lại.",
    defaultDuration: (label: string, days: number) =>
      `Thời lượng của "${label}" là giả định mặc định ${days} ngày.`,
    procurementBranch:
      "Kế hoạch giả định đủ nguyên liệu; nếu thiếu, bước đặt mua nguyên liệu sẽ được thêm sau khi kiểm kho.",
    noHolder: (role: string) =>
      `Chưa có tài khoản đang hoạt động cho vị trí ${role}; việc chưa gán người.`,
    manyHolders: (role: string, count: number) =>
      `Vị trí ${role} có ${count} người; việc chưa gán người, cần chọn khi duyệt.`,
    overrideReady: (date: string) =>
      `Ngày sẵn hàng dùng cho kế hoạch là ${date} theo yêu cầu trong hội thoại, khác với hồ sơ đơn.`,
  },
  en: {
    stageTitle: (step: number | null, label: string) =>
      step !== null ? `Step ${step}: ${label}` : label,
    noReadyDate:
      "The order has no expected ready date; the schedule runs forward from today with default durations.",
    scaled: (days: number) =>
      `Stages before the ready date were compressed to fit it (${days} days left); default durations were shortened.`,
    readyDateTooClose:
      "The ready date has passed or is too close; production stages are stacked on the ready date and need confirmation.",
    defaultDuration: (label: string, days: number) =>
      `The duration of "${label}" is a default assumption of ${days} days.`,
    procurementBranch:
      "The plan assumes material is available; a purchase step is added after the stock check if it is not.",
    noHolder: (role: string) =>
      `No active account holds the ${role} position; the task is unassigned.`,
    manyHolders: (role: string, count: number) =>
      `${count} accounts hold the ${role} position; the task is unassigned and needs a choice at approval.`,
    overrideReady: (date: string) =>
      `The plan uses ${date} as the ready date at the conversation's request, which differs from the order file.`,
  },
} as const;

/**
 * Builds the task list for an order. Deterministic: the same order, day and
 * overrides always give the same plan, so a proposal can be re-derived and
 * compared. Every default the builder falls back on becomes an assumption.
 */
export function buildOrderPlan(input: BuildPlanInput): BuiltPlan {
  const locale = input.locale ?? "vi";
  const text = copy[locale];
  const assumptions: string[] = [];
  const stages = remainingStages(input.order.stage);
  if (stages.length === 0) return { items: [], assumptions };

  const durations: Record<OrderStage, number> = { ...defaultStageDurations };
  const overridden = new Set<OrderStage>();
  for (const [stage, days] of Object.entries(
    input.overrides?.stageDurations ?? {},
  ) as [OrderStage, number | undefined][]) {
    if (
      days !== undefined &&
      Number.isInteger(days) &&
      days >= 0 &&
      days <= 365 &&
      stage in durations
    ) {
      durations[stage] = days;
      overridden.add(stage);
    }
  }

  const fileReadyDate = input.order.expectedReadyAt
    ? formatBusinessDayFromInstant(input.order.expectedReadyAt, input.timeZone)
    : null;
  const readyDate = input.overrides?.targetReadyDate ?? fileReadyDate;
  if (
    input.overrides?.targetReadyDate &&
    input.overrides.targetReadyDate !== fileReadyDate
  ) {
    assumptions.push(text.overrideReady(input.overrides.targetReadyDate));
  }

  // Split the remaining stages into the part that must finish by the ready
  // date and the part that follows it.
  const before = stages.filter((stage) => readyByStages.has(stage));
  const after = stages.filter((stage) => !readyByStages.has(stage));

  const dueByStage = new Map<OrderStage, string>();
  let cursor = input.today;

  if (!readyDate) {
    assumptions.push(text.noReadyDate);
    for (const stage of stages) {
      cursor = addBusinessDays(cursor, durations[stage]);
      dueByStage.set(stage, cursor);
    }
  } else {
    const available = daysBetween(input.today, readyDate);
    const needed = before.reduce((total, stage) => total + durations[stage], 0);
    if (available <= 0) {
      assumptions.push(text.readyDateTooClose);
      for (const stage of before) dueByStage.set(stage, readyDate);
    } else if (needed > available) {
      assumptions.push(text.scaled(available));
      // Scale durations proportionally: every stage keeps at least one day
      // when there are enough days for that, the rest is shared in
      // proportion to the defaults, and the last stage is pinned to the
      // ready date. Distinct days keep the plan readable and its order
      // unambiguous.
      const minimum = available >= before.length ? 1 : 0;
      const spare = available - minimum * before.length;
      let spent = 0;
      for (const [position, stage] of before.entries()) {
        const share =
          minimum +
          Math.max(0, Math.floor((durations[stage] / needed) * spare));
        spent += share;
        const isLast = position === before.length - 1;
        dueByStage.set(
          stage,
          isLast
            ? readyDate
            : addBusinessDays(input.today, Math.min(spent, available)),
        );
      }
    } else {
      // Enough room: schedule forward with the given durations; the ready
      // date itself caps the last production stage.
      for (const [position, stage] of before.entries()) {
        cursor = addBusinessDays(cursor, durations[stage]);
        const isLast = position === before.length - 1;
        dueByStage.set(stage, isLast ? readyDate : cursor);
      }
    }
    cursor = readyDate;
    for (const stage of after) {
      cursor = addBusinessDays(cursor, durations[stage]);
      dueByStage.set(stage, cursor);
    }
  }

  for (const stage of stages) {
    if (!overridden.has(stage)) {
      assumptions.push(
        text.defaultDuration(
          orderStageDefinitions[stage].labels[locale],
          durations[stage],
        ),
      );
    }
  }
  if (stages.includes("inventoryCheck")) {
    assumptions.push(text.procurementBranch);
  }

  const items: PlanItemDraft[] = [];
  const reportedRoles = new Set<SystemRoleKey>();
  for (const [index, stage] of stages.entries()) {
    const definition = orderStageDefinitions[stage];
    const holders = input.roleHolders.get(definition.ownerRole) ?? [];
    let assigneeUserId: string | null = null;
    if (holders.length === 1) {
      assigneeUserId = holders[0]!.id;
    } else if (!reportedRoles.has(definition.ownerRole)) {
      reportedRoles.add(definition.ownerRole);
      assumptions.push(
        holders.length === 0
          ? text.noHolder(definition.ownerRole)
          : text.manyHolders(definition.ownerRole, holders.length),
      );
    }
    const note = input.overrides?.stageNotes?.[stage]?.trim() || null;
    items.push({
      index,
      title: text.stageTitle(definition.step, definition.labels[locale]),
      note: note ? note.slice(0, 2_000) : null,
      stage,
      ownerRole: definition.ownerRole,
      assigneeUserId,
      dueDate: dueByStage.get(stage) ?? null,
      dependsOn: index === 0 ? [] : [index - 1],
      priority: "normal",
    });
  }

  return { items, assumptions };
}

export type PlanValidation =
  { ok: true } | { ok: false; errors: readonly string[] };

/**
 * Checks a plan the way the approval screen must trust it: acyclic
 * dependencies inside the list, deadlines that do not precede the work they
 * depend on, stages that the order can still reach, owners that match the
 * process, and no deadline already in the past.
 */
export function validatePlanItems(
  items: readonly PlanItemDraft[],
  context: { today: string; orderStage: OrderStage | null },
): PlanValidation {
  const errors: string[] = [];
  const indices = new Set(items.map((item) => item.index));
  if (indices.size !== items.length) {
    errors.push("Duplicate item index.");
  }
  const byIndex = new Map(items.map((item) => [item.index, item]));
  const allowedStages = context.orderStage
    ? new Set(remainingStages(context.orderStage))
    : null;

  for (const item of items) {
    if (!item.title.trim()) errors.push(`Item ${item.index}: empty title.`);
    for (const dependency of item.dependsOn) {
      if (!byIndex.has(dependency)) {
        errors.push(
          `Item ${item.index}: depends on unknown item ${dependency}.`,
        );
      } else if (dependency === item.index) {
        errors.push(`Item ${item.index}: depends on itself.`);
      }
    }
    if (item.dueDate && daysBetween(context.today, item.dueDate) < 0) {
      errors.push(
        `Item ${item.index}: due date ${item.dueDate} is in the past.`,
      );
    }
    if (item.stage) {
      if (allowedStages && !allowedStages.has(item.stage)) {
        errors.push(
          `Item ${item.index}: stage ${item.stage} is not ahead of the order.`,
        );
      }
      const owner = orderStageDefinitions[item.stage].ownerRole;
      if (item.ownerRole && item.ownerRole !== owner) {
        errors.push(
          `Item ${item.index}: ${item.stage} is owned by ${owner}, not ${item.ownerRole}.`,
        );
      }
    }
  }

  // Cycle detection over the dependency graph.
  const state = new Map<number, "visiting" | "done">();
  const visit = (index: number, path: number[]): void => {
    const current = state.get(index);
    if (current === "done") return;
    if (current === "visiting") {
      errors.push(`Dependency cycle: ${[...path, index].join(" -> ")}.`);
      return;
    }
    state.set(index, "visiting");
    const item = byIndex.get(index);
    for (const dependency of item?.dependsOn ?? []) {
      if (byIndex.has(dependency)) visit(dependency, [...path, index]);
    }
    state.set(index, "done");
  };
  for (const item of items) visit(item.index, []);

  // A task cannot be due before something it waits on.
  for (const item of items) {
    if (!item.dueDate) continue;
    for (const dependency of item.dependsOn) {
      const upstream = byIndex.get(dependency);
      if (
        upstream?.dueDate &&
        daysBetween(upstream.dueDate, item.dueDate) < 0
      ) {
        errors.push(
          `Item ${item.index}: due ${item.dueDate} before its dependency ${dependency} (${upstream.dueDate}).`,
        );
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
