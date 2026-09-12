import { z } from "zod";

import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { OrderStage } from "@/domains/orders/workflow";

/**
 * Work items ("việc cần làm").
 *
 * A task is the durable record behind "remember and follow up": it outlives
 * a chat, carries a due date in the company's timezone, points at the order
 * it belongs to, and names who is expected to do it. The assistant only ever
 * proposes tasks; a person creates them, either by hand or by approving a
 * proposal, and the person who does the work marks it done from the task
 * list. Nothing in a chat transcript counts as completion.
 */

export const taskStatuses = ["open", "done", "cancelled"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskPriorities = ["normal", "high"] as const;
export type TaskPriority = (typeof taskPriorities)[number];

export type TaskSource =
  | { kind: "manual" }
  | { kind: "proposal"; proposalId: string; itemIndex: number };

/**
 * A deadline the assignee asked to move. One task carries at most one
 * pending request: the assignee cannot stack requests while the first is
 * waiting, and the person who assigned the work decides it. The decision is
 * kept on the task so both sides read the same history without a join.
 */
export type TaskExtensionRequest = {
  requestedDueAt: Date;
  reason: string;
  requestedBy: string;
  requestedAt: Date;
};

export type TaskExtensionDecision = {
  outcome: "approved" | "rejected";
  /** The deadline that was asked for, kept even when the answer was no. */
  requestedDueAt: Date;
  note: string | null;
  decidedBy: string;
  decidedAt: Date;
};

export type TaskRecordDto = {
  id: string;
  title: string;
  note: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  orderId: string | null;
  /** Snapshot so lists render without a join. */
  orderCode: string | null;
  /** The workflow stage this task represents when it came from a plan. */
  stage: OrderStage | null;
  /** The position expected to do it; used to pick an assignee and to route reminders. */
  ownerRole: SystemRoleKey | null;
  assigneeUserId: string | null;
  businessUnitIds: readonly string[];
  /** Instant at the end of the business day the task is due; null = no deadline. */
  dueAt: Date | null;
  dependsOnTaskIds: readonly string[];
  source: TaskSource;
  /** The assignee's pending request to move the deadline; null when none waits. */
  extensionRequest: TaskExtensionRequest | null;
  /** The last answer given to such a request, for both sides to read. */
  lastExtensionDecision: TaskExtensionDecision | null;
  completedAt: Date | null;
  completedBy: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

/**
 * How a list read is narrowed. A unit-scoped reader also sees tasks they
 * created or hold, because an assigned task without an order has no unit.
 */
export type TaskListScope =
  | { kind: "all" }
  | {
      kind: "businessUnits";
      businessUnitIds: readonly string[];
      userId: string;
    }
  | { kind: "own"; userId: string };

export type TaskListFilter = {
  scope: TaskListScope;
  status?: TaskStatus;
  orderId?: string;
  assigneeUserId?: string;
  /** Open tasks due on or before this instant (overdue included). */
  dueBefore?: Date;
  limit?: number;
};

export type NewTaskRecord = {
  title: string;
  note: string | null;
  priority: TaskPriority;
  orderId: string | null;
  orderCode: string | null;
  stage: OrderStage | null;
  ownerRole: SystemRoleKey | null;
  assigneeUserId: string | null;
  businessUnitIds: readonly string[];
  dueAt: Date | null;
  dependsOnTaskIds: readonly string[];
  source: TaskSource;
  createdBy: string;
};

export type TaskFieldsWrite = {
  title: string;
  note: string | null;
  priority: TaskPriority;
  assigneeUserId: string | null;
  dueAt: Date | null;
  /** Only when unit-less work moves to another person; omitted otherwise. */
  businessUnitIds?: readonly string[];
};

export interface TaskStore {
  /**
   * Inserts one task. A proposal-sourced task is unique per
   * (proposalId, itemIndex): a second insert for the same slot returns the
   * task already there instead of a duplicate, so applying a plan twice —
   * a double click, a retry, two concurrent approvers — is harmless.
   */
  insert(record: NewTaskRecord): Promise<{
    task: TaskRecordDto;
    created: boolean;
  }>;
  findById(taskId: string): Promise<TaskRecordDto | null>;
  findByIds(taskIds: readonly string[]): Promise<TaskRecordDto[]>;
  list(filter: TaskListFilter): Promise<TaskRecordDto[]>;
  /** Open tasks with a due date on or before `dueBefore`, across every scope (for the reminder job). */
  listOpenDue(dueBefore: Date, limit: number): Promise<TaskRecordDto[]>;
  /** Tasks whose assignee is waiting for an answer, oldest request first. */
  listPendingExtensions(limit: number): Promise<TaskRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  update(input: {
    taskId: string;
    expectedRevision: number;
    fields: TaskFieldsWrite;
    updatedBy: string;
  }): Promise<TaskRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setStatus(input: {
    taskId: string;
    expectedRevision: number;
    status: TaskStatus;
    reason: string | null;
    actorId: string;
    at: Date;
  }): Promise<TaskRecordDto | null>;
  /**
   * Records the assignee's request to move the deadline. Conditional on the
   * revision, on the task still being open, and on no request already
   * waiting, so a double submit cannot queue two.
   */
  requestExtension(input: {
    taskId: string;
    expectedRevision: number;
    request: TaskExtensionRequest;
  }): Promise<TaskRecordDto | null>;
  /**
   * Answers the pending request: an approval moves `dueAt` to the day that
   * was asked for, a rejection leaves the deadline untouched. Either way the
   * request is cleared and the decision stored. Conditional on the revision.
   */
  decideExtension(input: {
    taskId: string;
    expectedRevision: number;
    decision: TaskExtensionDecision;
    /** The new deadline on approval; null leaves `dueAt` as it stands. */
    dueAt: Date | null;
    decidedBy: string;
  }): Promise<TaskRecordDto | null>;
  /** Fills in dependency ids after a batch of plan tasks exists. */
  setDependencies(input: {
    taskId: string;
    dependsOnTaskIds: readonly string[];
  }): Promise<void>;
}

export const taskCommandErrorCodes = [
  "NOT_FOUND",
  "ORDER_NOT_FOUND",
  "ORDER_CLOSED",
  "ASSIGNEE_NOT_FOUND",
  "INVALID_TRANSITION",
  "REASON_REQUIRED",
  "REVISION_CONFLICT",
  "INVALID_INPUT",
  /** Only the person doing the work may ask for more time. */
  "NOT_ASSIGNEE",
  /** A request is already waiting for an answer on this task. */
  "EXTENSION_PENDING",
  /** Nothing is waiting to be decided. */
  "EXTENSION_NOT_FOUND",
  /** The new deadline is in the past or is the one already set. */
  "INVALID_DUE_DATE",
] as const;

export type TaskCommandErrorCode = (typeof taskCommandErrorCodes)[number];

export class TaskCommandError extends Error {
  readonly code: TaskCommandErrorCode;

  constructor(code: TaskCommandErrorCode, message: string) {
    super(message);
    this.name = "TaskCommandError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

/** A blank optional id means "not given". */
const optionalObjectId = z
  .union([z.literal(""), objectIdSchema])
  .nullable()
  .default(null)
  .transform((value) => (value ? value : null));

/** A calendar day in the business timezone, `YYYY-MM-DD`; blank = no deadline. */
export const businessDaySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const optionalBusinessDay = z
  .union([z.literal(""), businessDaySchema])
  .nullable()
  .default(null)
  .transform((value) => (value ? value : null));

const optionalNote = z
  .string()
  .trim()
  .max(2_000)
  .nullable()
  .default(null)
  .transform((value) => (value && value.length > 0 ? value : null));

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: optionalNote,
  priority: z.enum(taskPriorities).default("normal"),
  orderId: optionalObjectId,
  assigneeUserId: optionalObjectId,
  /** `YYYY-MM-DD` in the business timezone. */
  dueDate: optionalBusinessDay,
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z.object({
  taskId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  title: z.string().trim().min(1).max(200),
  note: optionalNote,
  priority: z.enum(taskPriorities).default("normal"),
  assigneeUserId: optionalObjectId,
  dueDate: optionalBusinessDay,
});

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

export const setTaskStatusInputSchema = z.object({
  taskId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  status: z.enum(taskStatuses),
  reason: z
    .string()
    .trim()
    .max(2_000)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type SetTaskStatusInput = z.infer<typeof setTaskStatusInputSchema>;

/**
 * The assignee asks for more time. A reason is required: the deadline was
 * set by someone else, so the answer has to rest on something written down.
 */
export const requestTaskExtensionInputSchema = z.object({
  taskId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  /** `YYYY-MM-DD` in the business timezone. */
  requestedDueDate: businessDaySchema,
  reason: z.string().trim().min(1).max(2_000),
});

export type RequestTaskExtensionInput = z.infer<
  typeof requestTaskExtensionInputSchema
>;

export const decideTaskExtensionInputSchema = z.object({
  taskId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  outcome: z.enum(["approved", "rejected"]),
  note: z
    .string()
    .trim()
    .max(2_000)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type DecideTaskExtensionInput = z.infer<
  typeof decideTaskExtensionInputSchema
>;
