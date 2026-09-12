import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import { systemRoleKeys } from "@/domains/identity/role-definitions";
import { orderStages } from "@/domains/orders/workflow";
import { taskPriorities, taskStatuses } from "@/domains/tasks/contracts";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

const sourceSchema = new Schema(
  {
    kind: { type: String, required: true, enum: ["manual", "proposal"] },
    proposalId: {
      type: Schema.Types.ObjectId,
      ref: "AssistantProposal",
      default: null,
    },
    itemIndex: { type: Number, min: 0, default: null },
  },
  nestedSchemaOptions,
);

/** The assignee's pending plea for more time; at most one per task. */
const extensionRequestSchema = new Schema(
  {
    requestedDueAt: { type: Date, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 2_000 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedAt: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

const extensionDecisionSchema = new Schema(
  {
    outcome: { type: String, required: true, enum: ["approved", "rejected"] },
    requestedDueAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decidedAt: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

export const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    status: {
      type: String,
      required: true,
      enum: taskStatuses,
      default: "open",
    },
    priority: {
      type: String,
      required: true,
      enum: taskPriorities,
      default: "normal",
    },
    orderId: { type: Schema.Types.ObjectId, ref: "SalesOrder", default: null },
    orderCode: { type: String, trim: true, maxlength: 40, default: null },
    stage: { type: String, enum: [...orderStages, null], default: null },
    ownerRole: { type: String, enum: [...systemRoleKeys, null], default: null },
    assigneeUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    dueAt: { type: Date, default: null },
    dependsOnTaskIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Task" }],
      required: true,
      default: [],
    },
    source: { type: sourceSchema, required: true },
    extensionRequest: { type: extensionRequestSchema, default: null },
    lastExtensionDecision: { type: extensionDecisionSchema, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 2_000, default: null },
    ...actorFields,
  },
  rootSchemaOptions,
);

// One task per plan slot: applying the same proposal twice cannot double the
// work, the second insert loses the race and the first task is reused.
taskSchema.index(
  { "source.proposalId": 1, "source.itemIndex": 1 },
  {
    unique: true,
    partialFilterExpression: { "source.kind": "proposal" },
    name: "task_proposal_slot_unique",
  },
);
taskSchema.index({ status: 1, dueAt: 1 }, { name: "task_status_due" });
taskSchema.index(
  { assigneeUserId: 1, status: 1, dueAt: 1 },
  { name: "task_assignee_board" },
);
taskSchema.index(
  { businessUnitIds: 1, status: 1, dueAt: 1 },
  { name: "task_unit_board" },
);
taskSchema.index(
  { orderId: 1, status: 1, dueAt: 1 },
  { name: "task_order_listing" },
);
taskSchema.index(
  { createdBy: 1, status: 1, dueAt: 1 },
  { name: "task_creator_board" },
);
// The assigner's queue of pending extension requests: few rows at a time,
// so the index only covers tasks that actually carry one.
taskSchema.index(
  { "extensionRequest.requestedAt": 1 },
  {
    name: "task_extension_queue",
    partialFilterExpression: {
      "extensionRequest.requestedAt": { $exists: true },
    },
  },
);

export type TaskRecord = InferSchemaType<typeof taskSchema>;

export const getTaskModel = () => getOrCreateModel("Task", taskSchema);
