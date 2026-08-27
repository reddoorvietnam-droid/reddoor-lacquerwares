import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  approvalStatuses,
  approvalSubjects,
} from "@/domains/approvals/contracts";
import { getOrCreateModel, rootSchemaOptions } from "@/lib/content/mongoose";

/**
 * A parked Director decision. The request is the unit of audit: who asked,
 * what for, against which revision of the record, and who released it.
 *
 * The summary is written by the requesting service and must already be
 * redacted — it is shown to every reader of the approval queue, including
 * roles that may not see selling price or other sensitive fields.
 */
export const approvalRequestSchema = new Schema(
  {
    subject: {
      type: String,
      required: true,
      immutable: true,
      enum: approvalSubjects,
    },
    resourceType: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 80,
    },
    resourceId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 80,
    },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: approvalStatuses,
      default: "pending",
    },
    requestedByUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    requestedAt: { type: Date, required: true, immutable: true },
    summary: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 1_000,
    },
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
    expectedRevision: {
      type: Number,
      required: true,
      immutable: true,
      min: 0,
    },
  },
  rootSchemaOptions,
);

// The database enforces what `assertRequestable` checks: at most one pending
// request per (resource, subject), so stacked duplicates lose the race too.
approvalRequestSchema.index(
  { resourceType: 1, resourceId: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "approval_single_pending_per_subject",
  },
);
approvalRequestSchema.index(
  { status: 1, requestedAt: -1 },
  { name: "approval_queue_listing" },
);
approvalRequestSchema.index(
  { resourceType: 1, resourceId: 1, subject: 1, status: 1, decidedAt: -1 },
  { name: "approval_resource_decisions" },
);
approvalRequestSchema.index(
  { businessUnitIds: 1, status: 1, requestedAt: -1 },
  { name: "approval_unit_queue" },
);

export type ApprovalRequestRecord = InferSchemaType<
  typeof approvalRequestSchema
>;

export const getApprovalRequestModel = () =>
  getOrCreateModel("ApprovalRequest", approvalRequestSchema);
