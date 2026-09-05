import "server-only";

import { Schema } from "mongoose";

import {
  financeEntryCategories,
  financeEntryKinds,
  financePaymentMethods,
} from "@/domains/finance/contracts";
import { supportedCurrencies } from "@/lib/money";
import {
  actorFields,
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * One ledger record per movement of money. `rootSchemaOptions` gives the
 * document a `revision` so a void is conditional on the revision the caller
 * saw. Voided entries stay in place — the collection is the book of record,
 * so corrections append (a void plus a fresh entry), never erase.
 */

const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

const amountSchema = new Schema(
  {
    amount: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      match: DECIMAL_PATTERN,
    },
    currency: { type: String, required: true, enum: supportedCurrencies },
  },
  nestedSchemaOptions,
);

const allocationSchema = new Schema(
  {
    target: { type: String, required: true, enum: ["invoice", "order"] },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "SalesInvoice",
      default: null,
    },
    invoiceNumber: { type: String, trim: true, maxlength: 60, default: null },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "SalesOrder" },
    orderCode: { type: String, required: true, trim: true, maxlength: 40 },
    amount: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      match: DECIMAL_PATTERN,
    },
  },
  nestedSchemaOptions,
);

/** A stored file; keeps its own `_id` so one can be removed by id. */
export const storedDocumentSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true, maxlength: 500 },
    assetVersion: { type: Number, required: true, min: 1 },
    format: { type: String, required: true, trim: true, maxlength: 10 },
    bytes: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    uploadedAt: { type: Date, required: true },
  },
  { _id: true, strict: "throw" as const, minimize: false },
);

export const financeEntrySchema = new Schema(
  {
    kind: { type: String, required: true, enum: financeEntryKinds },
    category: { type: String, required: true, enum: financeEntryCategories },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      default: null,
    },
    orderCode: { type: String, trim: true, maxlength: 40, default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null },
    counterparty: { type: String, required: true, trim: true, maxlength: 240 },
    amount: { type: amountSchema, required: true },
    method: { type: String, required: true, enum: financePaymentMethods },
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    allocations: { type: [allocationSchema], required: true, default: [] },
    fxRateToVnd: {
      type: String,
      trim: true,
      maxlength: 40,
      match: DECIMAL_PATTERN,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "voided"],
      default: "active",
    },
    voidReason: { type: String, trim: true, maxlength: 2_000, default: null },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    ...actorFields,
  },
  rootSchemaOptions,
);

financeEntrySchema.index({ occurredAt: -1 }, { name: "finance_entry_ledger" });
financeEntrySchema.index(
  { orderId: 1, kind: 1, status: 1 },
  { name: "finance_entry_order_totals" },
);
financeEntrySchema.index(
  { kind: 1, occurredAt: -1 },
  { name: "finance_entry_kind_ledger" },
);
financeEntrySchema.index(
  { businessUnitIds: 1, occurredAt: -1 },
  { name: "finance_entry_unit_ledger" },
);
financeEntrySchema.index(
  { customerId: 1, category: 1, status: 1 },
  { name: "finance_entry_customer" },
);
financeEntrySchema.index(
  { "allocations.invoiceId": 1, status: 1 },
  { name: "finance_entry_allocation_invoice" },
);

export const getFinanceEntryModel = () =>
  getOrCreateModel("FinanceEntry", financeEntrySchema);

/**
 * Sales invoices. The invoice number is unique among ACTIVE invoices, so a
 * voided invoice frees its number for the corrected one.
 */
export const salesInvoiceSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "SalesOrder" },
    orderCode: { type: String, required: true, trim: true, maxlength: 40 },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, required: true, trim: true, maxlength: 240 },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 60 },
    issuedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    amount: { type: amountSchema, required: true },
    fxRateToVnd: {
      type: String,
      trim: true,
      maxlength: 40,
      match: DECIMAL_PATTERN,
      default: null,
    },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
    documents: { type: [storedDocumentSchema], required: true, default: [] },
    status: {
      type: String,
      required: true,
      enum: ["active", "voided"],
      default: "active",
    },
    voidReason: { type: String, trim: true, maxlength: 2_000, default: null },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    ...actorFields,
  },
  rootSchemaOptions,
);

salesInvoiceSchema.index(
  { invoiceNumber: 1 },
  {
    unique: true,
    name: "sales_invoice_number_active_unique",
    partialFilterExpression: { status: "active" },
  },
);
salesInvoiceSchema.index(
  { orderId: 1, status: 1, dueAt: 1 },
  { name: "sales_invoice_order" },
);
salesInvoiceSchema.index(
  { customerId: 1, status: 1, dueAt: 1 },
  { name: "sales_invoice_customer" },
);
salesInvoiceSchema.index(
  { status: 1, dueAt: 1 },
  { name: "sales_invoice_due" },
);
salesInvoiceSchema.index(
  { businessUnitIds: 1, status: 1 },
  { name: "sales_invoice_units" },
);

export const getSalesInvoiceModel = () =>
  getOrCreateModel("SalesInvoice", salesInvoiceSchema);

/** One USD→VND rate per calendar day. */
export const fxRateSchema = new Schema(
  {
    date: { type: Date, required: true },
    from: { type: String, required: true, enum: ["USD"], default: "USD" },
    to: { type: String, required: true, enum: ["VND"], default: "VND" },
    rate: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      match: /^\d+(?:\.\d+)?$/,
    },
    source: { type: String, trim: true, maxlength: 120, default: null },
    updatedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  { strict: "throw" as const, timestamps: true, minimize: false },
);

fxRateSchema.index(
  { from: 1, to: 1, date: -1 },
  { unique: true, name: "fx_rate_pair_day_unique" },
);

export const getFxRateModel = () => getOrCreateModel("FxRate", fxRateSchema);
