import "server-only";

import mongoose, { type InferSchemaType, type Model, Schema } from "mongoose";

import {
  accessGrantStatuses,
  permissionScopes,
  userStatuses,
} from "@/domains/identity/contracts";
import { locales } from "@/lib/i18n/config";

const rootOptions = {
  strict: "throw" as const,
  timestamps: true,
  optimisticConcurrency: true,
  minimize: false,
  versionKey: "revision",
};

const nestedOptions = {
  _id: false,
  strict: "throw" as const,
  minimize: false,
};

const rolePermissionSchema = new Schema(
  {
    permission: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      match: /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/,
    },
    scope: { type: String, required: true, enum: permissionScopes },
  },
  nestedOptions,
);

const localizedRoleLabelSchema = new Schema(
  {
    locale: { type: String, required: true, enum: locales },
    label: { type: String, required: true, trim: true, maxlength: 160 },
  },
  nestedOptions,
);

export const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      maxlength: 320,
    },
    normalizedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    googleSubject: { type: String, trim: true, maxlength: 255 },
    displayName: { type: String, trim: true, maxlength: 200 },
    avatarUrl: { type: String, trim: true, maxlength: 2_048 },
    preferredAdminLocale: { type: String, enum: locales, default: "vi" },
    status: {
      type: String,
      required: true,
      enum: userStatuses,
      default: "pending",
    },
    lastLoginAt: { type: Date },
    authzVersion: { type: Number, required: true, min: 1, default: 1 },
    suspendedAt: { type: Date },
    suspendedBy: { type: Schema.Types.ObjectId, ref: "User" },
    suspensionReason: { type: String, trim: true, maxlength: 1_000 },
  },
  rootOptions,
);

userSchema.index(
  { normalizedEmail: 1 },
  { unique: true, name: "user_normalized_email_unique" },
);
userSchema.index(
  { googleSubject: 1 },
  {
    unique: true,
    partialFilterExpression: { googleSubject: { $type: "string" } },
    name: "user_google_subject_unique",
  },
);
userSchema.index({ status: 1, updatedAt: -1 }, { name: "user_status_updated" });

export const roleDefinitionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
      match: /^[A-Z][A-Z0-9_]*$/,
    },
    labels: {
      type: [localizedRoleLabelSchema],
      required: true,
      default: [],
    },
    permissions: {
      type: [rolePermissionSchema],
      required: true,
      default: [],
    },
    system: { type: Boolean, required: true, default: false },
    active: { type: Boolean, required: true, default: true },
  },
  rootOptions,
);

roleDefinitionSchema.index(
  { key: 1 },
  { unique: true, name: "role_definition_key_unique" },
);

export const accessGrantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    roleKey: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      immutable: true,
      ref: "BusinessUnit",
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: accessGrantStatuses,
      default: "active",
    },
    grantedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    grantedAt: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
    },
    expiresAt: { type: Date },
  },
  rootOptions,
);

accessGrantSchema.index(
  { userId: 1, roleKey: 1, businessUnitId: 1 },
  { unique: true, name: "access_grant_assignment_unique" },
);
accessGrantSchema.index(
  { userId: 1, status: 1 },
  { name: "access_grant_user_status" },
);
accessGrantSchema.index(
  { businessUnitId: 1, status: 1 },
  { name: "access_grant_unit_status" },
);

export const businessUnitSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
      match: /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 240 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    parentId: { type: Schema.Types.ObjectId, ref: "BusinessUnit" },
    status: {
      type: String,
      required: true,
      enum: ["active", "inactive"],
      default: "active",
    },
    contactEmail: { type: String, trim: true, maxlength: 320 },
    contactPhone: { type: String, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 1_000 },
  },
  rootOptions,
);

businessUnitSchema.index(
  { code: 1 },
  { unique: true, name: "business_unit_code_unique" },
);

export const securityBootstrapClaimSchema = new Schema(
  {
    _id: {
      type: String,
      required: true,
      immutable: true,
      enum: ["initial-super-admin"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    mode: {
      type: String,
      required: true,
      immutable: true,
      enum: ["bootstrapped", "alreadyProvisioned"],
    },
    claimedAt: { type: Date, required: true, immutable: true },
  },
  {
    strict: "throw",
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false,
    versionKey: false,
  },
);

function rejectBootstrapClaimMutation(): never {
  throw new Error("Security bootstrap claims are append-only.");
}

securityBootstrapClaimSchema.pre("updateOne", rejectBootstrapClaimMutation);
securityBootstrapClaimSchema.pre("updateMany", rejectBootstrapClaimMutation);
securityBootstrapClaimSchema.pre(
  "findOneAndUpdate",
  rejectBootstrapClaimMutation,
);
securityBootstrapClaimSchema.pre(
  "findOneAndReplace",
  rejectBootstrapClaimMutation,
);
securityBootstrapClaimSchema.pre("replaceOne", rejectBootstrapClaimMutation);
securityBootstrapClaimSchema.pre("deleteOne", rejectBootstrapClaimMutation);
securityBootstrapClaimSchema.pre(
  "deleteOne",
  { document: true, query: false },
  rejectBootstrapClaimMutation,
);
securityBootstrapClaimSchema.pre("deleteMany", rejectBootstrapClaimMutation);
securityBootstrapClaimSchema.pre(
  "findOneAndDelete",
  rejectBootstrapClaimMutation,
);
securityBootstrapClaimSchema.pre("bulkWrite", rejectBootstrapClaimMutation);
securityBootstrapClaimSchema.pre("save", function rejectExistingClaimSave() {
  if (!this.isNew) {
    rejectBootstrapClaimMutation();
  }
});
businessUnitSchema.index(
  { parentId: 1, status: 1 },
  { name: "business_unit_parent_status" },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export type RoleDefinitionRecord = InferSchemaType<typeof roleDefinitionSchema>;
export type AccessGrantRecord = InferSchemaType<typeof accessGrantSchema>;
export type BusinessUnitRecord = InferSchemaType<typeof businessUnitSchema>;
export type SecurityBootstrapClaimRecord = InferSchemaType<
  typeof securityBootstrapClaimSchema
>;

function getOrCreateModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (
    (mongoose.models[name] as Model<T> | undefined) ??
    mongoose.model<T>(name, schema)
  );
}

export const getUserModel = () => getOrCreateModel("User", userSchema);
export const getRoleDefinitionModel = () =>
  getOrCreateModel("RoleDefinition", roleDefinitionSchema);
export const getAccessGrantModel = () =>
  getOrCreateModel("AccessGrant", accessGrantSchema);
export const getBusinessUnitModel = () =>
  getOrCreateModel("BusinessUnit", businessUnitSchema);
export const getSecurityBootstrapClaimModel = () =>
  getOrCreateModel("SecurityBootstrapClaim", securityBootstrapClaimSchema);
