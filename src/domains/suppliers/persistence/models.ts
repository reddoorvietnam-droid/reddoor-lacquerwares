import "server-only";

import { Schema } from "mongoose";

import { supplierStatuses } from "@/domains/suppliers/contracts";
import {
  actorFields,
  getOrCreateModel,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * Supplier master record. Archived, never deleted: expense entries keep
 * pointing at the supplier they were paid to.
 */
export const supplierSchema = new Schema(
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
    category: { type: String, trim: true, maxlength: 120, default: null },
    contactName: { type: String, trim: true, maxlength: 160, default: null },
    email: { type: String, trim: true, maxlength: 320, default: null },
    phone: { type: String, trim: true, maxlength: 80, default: null },
    address: { type: String, trim: true, maxlength: 1_000, default: null },
    notes: { type: String, trim: true, maxlength: 4_000, default: null },
    status: {
      type: String,
      required: true,
      enum: supplierStatuses,
      default: "active",
    },
    ...actorFields,
  },
  rootSchemaOptions,
);

supplierSchema.index(
  { code: 1 },
  {
    unique: true,
    name: "supplier_code_unique",
    partialFilterExpression: { code: { $type: "string" } },
  },
);
supplierSchema.index({ status: 1, name: 1 }, { name: "supplier_status_name" });

export const getSupplierModel = () =>
  getOrCreateModel("Supplier", supplierSchema);
