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

const amountSchema = new Schema(
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
    counterparty: { type: String, required: true, trim: true, maxlength: 240 },
    amount: { type: amountSchema, required: true },
    method: { type: String, required: true, enum: financePaymentMethods },
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2_000, default: null },
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

export const getFinanceEntryModel = () =>
  getOrCreateModel("FinanceEntry", financeEntrySchema);
