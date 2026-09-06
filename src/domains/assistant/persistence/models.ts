import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import { proposalKinds, proposalStatuses } from "@/domains/assistant/contracts";
import { systemRoleKeys } from "@/domains/identity/role-definitions";
import { orderStages } from "@/domains/orders/workflow";
import { taskPriorities } from "@/domains/tasks/contracts";
import {
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

const planItemSchema = new Schema(
  {
    index: { type: Number, required: true, min: 0 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    stage: { type: String, enum: [...orderStages, null], default: null },
    ownerRole: { type: String, enum: [...systemRoleKeys, null], default: null },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: {
      type: String,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: null,
    },
    dependsOn: { type: [Number], required: true, default: [] },
    priority: {
      type: String,
      required: true,
      enum: taskPriorities,
      default: "normal",
    },
  },
  nestedSchemaOptions,
);

/**
 * An assistant proposal is immutable once made: items and assumptions are
 * what the approver saw. Only the decision fields change, conditionally on
 * the revision, so two approvers cannot both release it.
 */
export const assistantProposalSchema = new Schema(
  {
    kind: {
      type: String,
      required: true,
      immutable: true,
      enum: proposalKinds,
    },
    status: {
      type: String,
      required: true,
      enum: proposalStatuses,
      default: "proposed",
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      immutable: true,
      default: null,
    },
    orderCode: { type: String, trim: true, maxlength: 40, default: null },
    orderRevision: { type: Number, min: 0, default: null },
    orderStage: { type: String, enum: [...orderStages, null], default: null },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    items: { type: [planItemSchema], required: true, default: [] },
    assumptions: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      required: true,
      default: [],
    },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    proposedByUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    proposedAt: { type: Date, required: true, immutable: true },
    decidedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    decidedAt: { type: Date, default: null },
    decisionReason: {
      type: String,
      trim: true,
      maxlength: 2_000,
      default: null,
    },
    appliedTaskIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Task" }],
      required: true,
      default: [],
    },
  },
  rootSchemaOptions,
);

assistantProposalSchema.index(
  { status: 1, proposedAt: -1 },
  { name: "assistant_proposal_queue" },
);
assistantProposalSchema.index(
  { proposedByUserId: 1, status: 1, proposedAt: -1 },
  { name: "assistant_proposal_by_user" },
);
assistantProposalSchema.index(
  { businessUnitIds: 1, status: 1, proposedAt: -1 },
  { name: "assistant_proposal_unit_queue" },
);
assistantProposalSchema.index(
  { orderId: 1, status: 1 },
  { name: "assistant_proposal_order" },
);

export type AssistantProposalRecord = InferSchemaType<
  typeof assistantProposalSchema
>;

export const getAssistantProposalModel = () =>
  getOrCreateModel("AssistantProposal", assistantProposalSchema);
