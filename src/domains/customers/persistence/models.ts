import "server-only";

import { Schema } from "mongoose";

import { customerStatuses } from "@/domains/customers/contracts";
import { supportedCurrencies } from "@/lib/money";
import {
  actorFields,
  getOrCreateModel,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * Customer master record. `rootSchemaOptions` gives the document a
 * `revision`, so an edit is conditional on the revision the form was
 * rendered with. Customers are archived, never deleted: orders, invoices and
 * receipts keep pointing at them.
 */
export const customerSchema = new Schema(
  {
    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      default: null,
    },
    name: { type: String, required: true, trim: true, maxlength: 240 },
    taxCode: { type: String, trim: true, maxlength: 40, default: null },
    country: { type: String, trim: true, maxlength: 120, default: null },
    email: { type: String, trim: true, maxlength: 320, default: null },
    phone: { type: String, trim: true, maxlength: 80, default: null },
    address: { type: String, trim: true, maxlength: 1_000, default: null },
    defaultCurrency: {
      type: String,
      enum: [...supportedCurrencies, null],
      default: null,
    },
    notes: { type: String, trim: true, maxlength: 4_000, default: null },
    status: {
      type: String,
      required: true,
      enum: customerStatuses,
      default: "active",
    },
    ...actorFields,
  },
  rootSchemaOptions,
);

// A code is optional, but two customers may never share one.
customerSchema.index(
  { code: 1 },
  {
    unique: true,
    name: "customer_code_unique",
    partialFilterExpression: { code: { $type: "string" } },
  },
);
customerSchema.index({ status: 1, name: 1 }, { name: "customer_status_name" });

export const getCustomerModel = () =>
  getOrCreateModel("Customer", customerSchema);
