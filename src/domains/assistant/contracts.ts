import { z } from "zod";

import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { OrderStage } from "@/domains/orders/workflow";
import { taskPriorities, type TaskPriority } from "@/domains/tasks/contracts";

/**
 * The AI assistant's proposals.
 *
 * The assistant never writes business data directly. When it plans an order
 * or drafts to-dos it records a proposal: a list of task drafts, the
 * assumptions it made, and the revision of the order it looked at. A person
 * holding the right permission reviews the draft in the portal and approves
 * it — only then are the tasks created, idempotently per slot — or rejects
 * it with a reason. A proposal made against an order that has since changed
 * is refused at approval time so a stale plan never becomes work.
 */

export const proposalKinds = ["orderPlan", "tasks"] as const;
export type ProposalKind = (typeof proposalKinds)[number];

export const proposalStatuses = [
  "proposed",
  "approved",
  "rejected",
  "expired",
] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];

export type PlanItemDraft = {
  /** Stable position inside the proposal; the task slot key. */
  index: number;
  title: string;
  note: string | null;
  stage: OrderStage | null;
  ownerRole: SystemRoleKey | null;
  assigneeUserId: string | null;
  /** `YYYY-MM-DD` in the business timezone; null = no deadline. */
  dueDate: string | null;
  /** Indices of items that must finish first. */
  dependsOn: readonly number[];
  priority: TaskPriority;
};

export type AssistantProposalDto = {
  id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  orderId: string | null;
  orderCode: string | null;
  /** The order revision the plan was drafted against. */
  orderRevision: number | null;
  orderStage: OrderStage | null;
  businessUnitIds: readonly string[];
  items: readonly PlanItemDraft[];
  assumptions: readonly string[];
  /** One-line, price-free description shown in lists. */
  summary: string;
  proposedByUserId: string;
  proposedAt: Date;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  appliedTaskIds: readonly string[];
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type NewProposalRecord = Omit<
  AssistantProposalDto,
  | "id"
  | "status"
  | "decidedByUserId"
  | "decidedAt"
  | "decisionReason"
  | "appliedTaskIds"
  | "createdAt"
  | "updatedAt"
  | "revision"
>;

export interface ProposalStore {
  insert(record: NewProposalRecord): Promise<AssistantProposalDto>;
  findById(proposalId: string): Promise<AssistantProposalDto | null>;
  /** Proposals still waiting, newest first, optionally narrowed to units or a proposer. */
  listPending(filter: {
    businessUnitIds?: readonly string[] | null;
    proposedByUserId?: string;
    limit?: number;
  }): Promise<AssistantProposalDto[]>;
  /** Conditional on `proposed` status and the revision; null means it moved on. */
  decide(input: {
    proposalId: string;
    expectedRevision: number;
    status: "approved" | "rejected" | "expired";
    decidedByUserId: string;
    decidedAt: Date;
    decisionReason: string | null;
    appliedTaskIds: readonly string[];
  }): Promise<AssistantProposalDto | null>;
}

export const assistantErrorCodes = [
  "NOT_CONFIGURED",
  "PROVIDER_ERROR",
  "PROVIDER_TIMEOUT",
  "RATE_LIMITED",
  "NOT_FOUND",
  "ALREADY_DECIDED",
  "SOURCE_CHANGED",
  "ORDER_NOT_FOUND",
  "ORDER_CLOSED",
  "INVALID_PLAN",
  "REVISION_CONFLICT",
  "INVALID_INPUT",
] as const;

export type AssistantErrorCode = (typeof assistantErrorCodes)[number];

export class AssistantError extends Error {
  readonly code: AssistantErrorCode;
  readonly details: readonly string[];

  constructor(
    code: AssistantErrorCode,
    message: string,
    details: readonly string[] = [],
  ) {
    super(message);
    this.name = "AssistantError";
    this.code = code;
    this.details = details;
  }
}

/* ------------------------------------------------------------------ */
/* Chat transport                                                      */
/* ------------------------------------------------------------------ */

/** A prior turn the browser sends back; tool blocks are never round-tripped. */
export const chatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(8_000),
});

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  history: z.array(chatHistoryMessageSchema).max(20).default([]),
  locale: z.enum(["vi", "en"]).default("vi"),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ToolTraceEntry = {
  tool: string;
  ok: boolean;
  /** Error code when `ok` is false. */
  code: string | null;
  /** Internal links to the records the tool read, for the "sources" line. */
  sources: readonly { label: string; href: string }[];
};

export type ChatResponse = {
  text: string;
  trace: readonly ToolTraceEntry[];
  sources: readonly { label: string; href: string }[];
  proposals: readonly AssistantProposalDto[];
  /** True when the model hit its output ceiling; the answer may be cut. */
  truncated: boolean;
  provider: { kind: "anthropic" | "mock"; model: string };
  usage: { inputTokens: number; outputTokens: number };
  /** The instant the data was read, so the reader knows how fresh it is. */
  dataAt: string;
};

/* ------------------------------------------------------------------ */
/* Proposal decision input                                             */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const decideProposalInputSchema = z.object({
  proposalId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  decision: z.enum(["approved", "rejected"]),
  reason: z
    .string()
    .trim()
    .max(2_000)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type DecideProposalInput = z.infer<typeof decideProposalInputSchema>;

/** A task draft as the model may hand it to `propose_tasks`. */
export const taskDraftInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2_000).nullable().default(null),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  orderCode: z.string().trim().max(40).nullable().default(null),
  assigneeUserId: objectIdSchema.nullable().default(null),
  priority: z.enum(taskPriorities).default("normal"),
});

export type TaskDraftInput = z.infer<typeof taskDraftInputSchema>;
