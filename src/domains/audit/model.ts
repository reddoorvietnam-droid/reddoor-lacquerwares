import "server-only";

import mongoose, { type InferSchemaType, type Model, Schema } from "mongoose";

const permissionDecisionSchema = new Schema(
  {
    permission: { type: String, required: true, trim: true, maxlength: 160 },
    outcome: { type: String, required: true, enum: ["allowed", "denied"] },
    reasonCode: { type: String, required: true, trim: true, maxlength: 120 },
    scope: {
      type: String,
      enum: ["own", "assignedBusinessUnits", "all", null],
      default: null,
    },
  },
  { _id: false, strict: "throw", minimize: false },
);

export const auditEventSchema = new Schema(
  {
    actorType: { type: String, required: true, enum: ["user", "system"] },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    systemActorName: { type: String, trim: true, maxlength: 160 },
    action: { type: String, required: true, trim: true, maxlength: 160 },
    resourceType: { type: String, required: true, trim: true, maxlength: 120 },
    resourceId: { type: String, trim: true, maxlength: 255, default: null },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    requestId: { type: String, required: true, trim: true, maxlength: 255 },
    correlationId: { type: String, trim: true, maxlength: 255 },
    reason: { type: String, trim: true, maxlength: 2_000 },
    permissionDecision: { type: permissionDecisionSchema },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, required: true, immutable: true },
  },
  {
    strict: "throw",
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false,
    versionKey: false,
  },
);

auditEventSchema.index(
  { resourceType: 1, resourceId: 1, occurredAt: -1 },
  { name: "audit_resource_timeline" },
);
auditEventSchema.index(
  { actorId: 1, occurredAt: -1 },
  { name: "audit_actor_timeline" },
);
auditEventSchema.index(
  { businessUnitIds: 1, occurredAt: -1 },
  { name: "audit_business_unit_timeline" },
);
auditEventSchema.index(
  { action: 1, occurredAt: -1 },
  { name: "audit_action_timeline" },
);

function rejectAuditMutation(): never {
  throw new Error("Audit events are append-only.");
}

auditEventSchema.pre("updateOne", rejectAuditMutation);
auditEventSchema.pre("updateMany", rejectAuditMutation);
auditEventSchema.pre("findOneAndUpdate", rejectAuditMutation);
auditEventSchema.pre("findOneAndReplace", rejectAuditMutation);
auditEventSchema.pre("replaceOne", rejectAuditMutation);
auditEventSchema.pre("deleteOne", rejectAuditMutation);
auditEventSchema.pre(
  "deleteOne",
  { document: true, query: false },
  rejectAuditMutation,
);
auditEventSchema.pre("deleteMany", rejectAuditMutation);
auditEventSchema.pre("findOneAndDelete", rejectAuditMutation);
auditEventSchema.pre("bulkWrite", rejectAuditMutation);
auditEventSchema.pre("save", function rejectExistingAuditSave() {
  if (!this.isNew) {
    rejectAuditMutation();
  }
});

export type AuditEventRecord = InferSchemaType<typeof auditEventSchema>;

export function getAuditEventModel(): Model<AuditEventRecord> {
  return (
    (mongoose.models.AuditEvent as Model<AuditEventRecord> | undefined) ??
    mongoose.model<AuditEventRecord>("AuditEvent", auditEventSchema)
  );
}
