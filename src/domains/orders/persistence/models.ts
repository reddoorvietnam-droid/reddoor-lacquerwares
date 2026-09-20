import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import { orderDocumentKinds, qcResults } from "@/domains/orders/contracts";
import {
  orderStages,
  productionStages,
  qcCheckpoints,
  retiredOrderStages,
} from "@/domains/orders/workflow";
import { supportedCurrencies } from "@/lib/money";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * The sales-order record behind the SOP workflow.
 *
 * `rootSchemaOptions` gives the document optimistic concurrency with a
 * `revision` field — the same number an approval request pins via
 * `expectedRevision`, so a Director decision granted against one revision can
 * never release a record that has since changed.
 *
 * The selling price lives in a single nested field so the repository can
 * project it away in one place for readers without `orders.readSellingPrice`.
 *
 * Stage enums accept the retired keys of the earlier fifteen-step chart so
 * records written under it still validate; the store reads them forward.
 */

const anyStage = [...orderStages, ...Object.keys(retiredOrderStages)];

const sellingPriceSchema = new Schema(
  {
    amount: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      match: /^-?\d+(?:\.\d+)?$/,
    },
    currency: { type: String, required: true, enum: supportedCurrencies },
  },
  nestedSchemaOptions,
);

const stageHistorySchema = new Schema(
  {
    from: { type: String, required: true, enum: anyStage },
    to: { type: String, required: true, enum: anyStage },
    byUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    reason: { type: String, trim: true, maxlength: 2_000, default: null },
    at: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

// Sub-documents that can be removed by id keep their own `_id`.
const identifiedSubdocumentOptions = {
  _id: true,
  strict: "throw" as const,
  minimize: false,
};

const storedFileFields = {
  publicId: { type: String, required: true, trim: true, maxlength: 500 },
  assetVersion: { type: Number, required: true, min: 1 },
  format: { type: String, required: true, trim: true, maxlength: 10 },
  bytes: { type: Number, required: true, min: 1 },
  label: { type: String, required: true, trim: true, maxlength: 200 },
  uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  uploadedAt: { type: Date, required: true },
};

const paymentDocumentSchema = new Schema(
  storedFileFields,
  identifiedSubdocumentOptions,
);

const orderDocumentSchema = new Schema(
  {
    kind: { type: String, required: true, enum: orderDocumentKinds },
    ...storedFileFields,
  },
  identifiedSubdocumentOptions,
);

const lineItemSchema = new Schema(
  {
    productCode: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    quantity: {
      type: String,
      required: true,
      trim: true,
      match: /^(?:0|[1-9]\d{0,9})(?:\.\d{1,3})?$/,
    },
    unit: { type: String, trim: true, maxlength: 20, default: "cái" },
    facilityName: { type: String, trim: true, maxlength: 150, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
  },
  identifiedSubdocumentOptions,
);

const productionPlanSchema = new Schema(
  {
    woodworkDue: { type: Date, default: null },
    lacquerDue: { type: Date, default: null },
    finishingDue: { type: Date, default: null },
    packingDue: { type: Date, default: null },
    shipDue: { type: Date, default: null },
    assignment: { type: String, trim: true, maxlength: 2_000, default: null },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    savedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    savedAt: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

const qcCheckSchema = new Schema(
  {
    checkpoint: { type: String, required: true, enum: qcCheckpoints },
    result: { type: String, required: true, enum: qcResults },
    defectCount: { type: Number, min: 0, default: null },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    byUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    at: { type: Date, required: true },
  },
  identifiedSubdocumentOptions,
);

const packingRecordSchema = new Schema(
  {
    packedAt: { type: Date, default: null },
    cartons: { type: Number, min: 0, default: null },
    pallets: { type: Number, min: 0, default: null },
    containerNumber: { type: String, trim: true, maxlength: 60, default: null },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    byUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    at: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

/** The Director's approval of one company label proof, by document id. */
const labelApprovalSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, required: true },
    approvedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    approvedAt: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

export const salesOrderSchema = new Schema(
  {
    orderCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
      match: /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
    },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true, trim: true, maxlength: 240 },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      validate: {
        validator: (value: unknown[]) => value.length > 0,
        message: "A sales order must belong to at least one business unit.",
      },
    },
    stage: {
      type: String,
      required: true,
      enum: anyStage,
      default: "received",
    },
    qcPassed: { type: Boolean, required: true, default: false },
    sellingPrice: { type: sellingPriceSchema, default: null },
    lineItems: { type: [lineItemSchema], required: true, default: [] },
    shippingMark: { type: String, trim: true, maxlength: 500, default: null },
    deliveryDueAt: { type: Date, default: null },
    targets: { type: String, trim: true, maxlength: 2_000, default: null },
    productionPlan: { type: productionPlanSchema, default: null },
    productionStage: {
      type: String,
      enum: [...productionStages, null],
      default: null,
    },
    qcChecks: { type: [qcCheckSchema], required: true, default: [] },
    packingRecord: { type: packingRecordSchema, default: null },
    documents: { type: [orderDocumentSchema], required: true, default: [] },
    labelApproval: { type: labelApprovalSchema, default: null },
    expectedReadyAt: { type: Date, default: null },
    bookingNumber: { type: String, trim: true, maxlength: 120, default: null },
    bookingDate: { type: Date, default: null },
    paymentDocuments: {
      type: [paymentDocumentSchema],
      required: true,
      default: [],
    },
    notes: { type: String, trim: true, maxlength: 4_000, default: null },
    stageHistory: { type: [stageHistorySchema], required: true, default: [] },
    ...actorFields,
  },
  rootSchemaOptions,
);

salesOrderSchema.index(
  { orderCode: 1 },
  { unique: true, name: "sales_order_code_unique" },
);
salesOrderSchema.index(
  { stage: 1, updatedAt: -1 },
  { name: "sales_order_stage_board" },
);
salesOrderSchema.index(
  { businessUnitIds: 1, stage: 1, updatedAt: -1 },
  { name: "sales_order_unit_board" },
);
salesOrderSchema.index(
  { createdBy: 1, updatedAt: -1 },
  { name: "sales_order_owner_listing" },
);
salesOrderSchema.index(
  { customerId: 1, updatedAt: -1 },
  { name: "sales_order_customer_listing" },
);

export type SalesOrderRecord = InferSchemaType<typeof salesOrderSchema>;

export const getSalesOrderModel = () =>
  getOrCreateModel("SalesOrder", salesOrderSchema);
