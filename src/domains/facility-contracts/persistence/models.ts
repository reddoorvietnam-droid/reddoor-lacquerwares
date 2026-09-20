import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  facilityContractDocumentKinds,
  facilityContractStatuses,
  facilityPaymentStatuses,
} from "@/domains/facility-contracts/contracts";
import {
  actorFields,
  getOrCreateModel,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * Purchase contracts with production sites and the payment requests against
 * them. `rootSchemaOptions` gives both optimistic concurrency with a
 * `revision` field — the number a Director approval pins, so a decision
 * granted for one revision never releases a record that has since changed.
 *
 * `facilityId` is the materials module's facility id, which is a string key
 * rather than an ObjectId.
 */

const identifiedSubdocumentOptions = {
  _id: true,
  strict: "throw" as const,
  minimize: false,
};

const vndAmount = /^[1-9]\d{0,14}$/;

const lineSchema = new Schema(
  {
    productCode: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    quantity: {
      type: String,
      trim: true,
      match: /^(?:0|[1-9]\d{0,9})(?:\.\d{1,3})?$/,
      default: null,
    },
    unit: { type: String, trim: true, maxlength: 20, default: "cái" },
    unitPrice: { type: String, required: true, match: vndAmount },
    previousUnitPrice: { type: String, match: vndAmount, default: null },
    previousContractCode: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },
  },
  identifiedSubdocumentOptions,
);

const documentSchema = new Schema(
  {
    kind: { type: String, required: true, enum: facilityContractDocumentKinds },
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    assetVersion: { type: Number, required: true, min: 1 },
    format: { type: String, required: true, trim: true, maxlength: 10 },
    bytes: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    uploadedAt: { type: Date, required: true },
  },
  identifiedSubdocumentOptions,
);

const codePattern = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const facilityContractSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      match: codePattern,
    },
    facilityId: { type: String, required: true, trim: true, maxlength: 80 },
    facilityCode: { type: String, trim: true, maxlength: 80, default: "" },
    facilityName: { type: String, required: true, trim: true, maxlength: 240 },
    orderId: { type: Schema.Types.ObjectId, ref: "SalesOrder", default: null },
    orderCode: { type: String, trim: true, maxlength: 40, default: null },
    lines: {
      type: [lineSchema],
      required: true,
      validate: {
        validator: (value: unknown[]) =>
          value.length >= 1 && value.length <= 100,
        message: "A contract holds between 1 and 100 lines.",
      },
    },
    startDate: { type: Date, required: true },
    deliveryDate: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    documents: { type: [documentSchema], required: true, default: [] },
    status: {
      type: String,
      required: true,
      enum: facilityContractStatuses,
      default: "draft",
    },
    cancelReason: { type: String, trim: true, maxlength: 2_000, default: null },
    activatedAt: { type: Date, default: null },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    ...actorFields,
  },
  { ...rootSchemaOptions, collection: "facilitycontracts" },
);

facilityContractSchema.index(
  { code: 1 },
  { unique: true, name: "facility_contract_code_unique" },
);
facilityContractSchema.index(
  { status: 1, updatedAt: -1 },
  { name: "facility_contract_status_listing" },
);
facilityContractSchema.index(
  { facilityId: 1, status: 1 },
  { name: "facility_contract_site_listing" },
);

export const facilityPaymentSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      match: codePattern,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "FacilityContract",
    },
    contractCode: { type: String, required: true, trim: true, maxlength: 40 },
    facilityId: { type: String, required: true, trim: true, maxlength: 80 },
    facilityName: { type: String, required: true, trim: true, maxlength: 240 },
    orderCode: { type: String, trim: true, maxlength: 40, default: null },
    amount: { type: String, required: true, match: vndAmount },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    status: {
      type: String,
      required: true,
      enum: facilityPaymentStatuses,
      default: "proposed",
    },
    proposedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    proposedAt: { type: Date, required: true },
    checkedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    checkedAt: { type: Date, default: null },
    accountantApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    accountantApprovedAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
    paidOn: { type: Date, default: null },
    paidNote: { type: String, trim: true, maxlength: 2_000, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectReason: { type: String, trim: true, maxlength: 2_000, default: null },
    rejectedAtStage: {
      type: String,
      enum: [...facilityPaymentStatuses, null],
      default: null,
    },
  },
  { ...rootSchemaOptions, collection: "facilitypayments" },
);

facilityPaymentSchema.index(
  { code: 1 },
  { unique: true, name: "facility_payment_code_unique" },
);
facilityPaymentSchema.index(
  { contractId: 1, createdAt: -1 },
  { name: "facility_payment_contract_listing" },
);
facilityPaymentSchema.index(
  { status: 1, updatedAt: -1 },
  { name: "facility_payment_status_listing" },
);

export type FacilityContractRecord = InferSchemaType<
  typeof facilityContractSchema
>;
export type FacilityPaymentRecord = InferSchemaType<
  typeof facilityPaymentSchema
>;

export const getFacilityContractModel = () =>
  getOrCreateModel("FacilityContract", facilityContractSchema);

export const getFacilityPaymentModel = () =>
  getOrCreateModel("FacilityPayment", facilityPaymentSchema);
