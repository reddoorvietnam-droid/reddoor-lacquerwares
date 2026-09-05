import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import { orderStages } from "@/domains/orders/workflow";
import { supportedCurrencies } from "@/lib/money";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * The sales-order record behind the fifteen-step workflow.
 *
 * `rootSchemaOptions` gives the document optimistic concurrency with a
 * `revision` field — the same number an approval request pins via
 * `expectedRevision`, so a Director decision granted against one revision can
 * never release a record that has since changed.
 *
 * The selling price lives in a single nested field so the repository can
 * project it away in one place for readers without `orders.readSellingPrice`.
 */

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
    from: { type: String, required: true, enum: orderStages },
    to: { type: String, required: true, enum: orderStages },
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

const paymentDocumentSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    assetVersion: { type: Number, required: true, min: 1 },
    format: { type: String, required: true, trim: true, maxlength: 10 },
    bytes: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    uploadedAt: { type: Date, required: true },
  },
  // Documents keep their own `_id` so one can be removed by id.
  { _id: true, strict: "throw" as const, minimize: false },
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
      enum: orderStages,
      default: "received",
    },
    qcPassed: { type: Boolean, required: true, default: false },
    sellingPrice: { type: sellingPriceSchema, default: null },
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
