import "server-only";
import mongoose, { Schema } from "mongoose";
import { getOrCreateModel } from "@/lib/content/mongoose";
import {
  entryRoles,
  entryStatuses,
  entryTypes,
  migrationIssues,
  referenceTypes,
  sourceTypes,
} from "./contracts";

/**
 * Money is Decimal128 so MongoDB sums it exactly inside the balance
 * aggregation; every DTO carries it as a canonical decimal string. A binary
 * float must never touch a debt figure.
 */
const decimal = (required = false) => ({
  type: Schema.Types.Decimal128,
  required,
});

export const toDecimal128 = (value: string) =>
  mongoose.Types.Decimal128.fromString(value);

/** Decimal128 | number | string | null → canonical decimal string (or null). */
export function decimalToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    const text = (value as { toString(): string }).toString();
    // Decimal128 renders exponents for some inputs ("1E+3"); normalise.
    return text.includes("E") ? Number(text).toString() : text;
  }
  return null;
}

const customerSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    code: { type: String, required: true, trim: true, maxlength: 150 },
    /** `codeKey(code)`: the unique, SUMIF-compatible identity. */
    normalizedCode: { type: String, required: true, maxlength: 150 },
    name: { type: String, default: "", trim: true, maxlength: 300 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    address: { type: String, default: "", trim: true, maxlength: 500 },
    type: { type: String, default: "", trim: true, maxlength: 50 },
    note: { type: String, default: "", maxlength: 2000 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true },
    migrationSource: { type: String, default: null, maxlength: 255 },
    sourceRow: { type: Number, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { versionKey: false, strict: "throw" },
);
customerSchema.index({ normalizedCode: 1 }, { unique: true });
customerSchema.index({ active: 1, sortOrder: 1 });

const entrySchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    customerId: { type: String, required: true },
    customerCode: { type: String, required: true, maxlength: 150 },
    customerName: { type: String, default: "", maxlength: 300 },
    customerPhone: { type: String, default: "", maxlength: 50 },
    /** UTC midnight of the calendar date; the ledger is date-only. */
    entryDate: { type: Date, required: true },
    role: { type: String, enum: entryRoles, required: true },
    type: { type: String, enum: entryTypes, required: true },
    status: { type: String, enum: entryStatuses, required: true },
    amount: decimal(true),
    documentNumber: { type: String, default: "", maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    note: { type: String, default: "", maxlength: 2000 },
    legacyDescription: { type: String, default: "", maxlength: 500 },
    itemCode: { type: String, default: "", maxlength: 150 },
    itemName: { type: String, default: "", maxlength: 300 },
    unit: { type: String, default: "", maxlength: 50 },
    quantity: decimal(),
    unitPrice: decimal(),
    referenceType: { type: String, enum: referenceTypes, required: true },
    referenceId: { type: String, default: null, maxlength: 200 },
    referenceNumber: { type: String, default: "", maxlength: 100 },
    sequence: { type: Number, required: true },
    /** Groups the lines written together as one purchase; null for a single line. */
    batchId: { type: String, default: null },
    periodYear: { type: Number, default: null },
    sourceType: { type: String, enum: sourceTypes, required: true },
    migrationSource: { type: String, default: null, maxlength: 255 },
    migrationSheet: { type: String, default: null, maxlength: 255 },
    sourceRow: { type: Number, default: null },
    issues: [{ type: String, enum: migrationIssues }],
    /**
     * `${sha256(workbook)}:${sheet}:${row}` — re-running the migration updates
     * the same document instead of creating a second one.
     */
    importKey: { type: String, default: null },
    /** Hash of the business fields, for duplicate warnings on later imports. */
    fingerprint: { type: String, default: null },
    /** One key = one entry, however many times the browser retries. */
    idempotencyKey: { type: String, default: null },
    postedAt: { type: String, default: null },
    postedBy: { type: String, default: null },
    cancelledAt: { type: String, default: null },
    cancelledBy: { type: String, default: null },
    cancelReason: { type: String, default: null, maxlength: 500 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { versionKey: false, strict: "throw" },
);

// The ledger read: one customer's entries in report order.
entrySchema.index({ customerId: 1, entryDate: 1, sequence: 1 });
// The summary aggregation and every date-window report.
entrySchema.index({ status: 1, entryDate: 1 });
entrySchema.index({ type: 1, status: 1, entryDate: 1 });
entrySchema.index({ batchId: 1 }, { sparse: true });
/**
 * The double-count guard. A source document can back at most one ledger entry,
 * so an opening balance cannot be written twice for a customer, a migrated row
 * cannot be imported twice, and a sales slip — should it ever be wired to post
 * — cannot add a second debit for a sale the ledger already carries.
 * `MANUAL` entries carry a null `referenceId` and are exempt.
 */
entrySchema.index(
  { referenceType: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: "string" } },
  },
);
entrySchema.index(
  { importKey: 1 },
  { unique: true, partialFilterExpression: { importKey: { $type: "string" } } },
);
entrySchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { versionKey: false, strict: "throw" },
);

export const getReceivableCustomerModel = () =>
  getOrCreateModel("ReceivableCustomer", customerSchema);
export const getReceivableEntryModel = () =>
  getOrCreateModel("ReceivableEntry", entrySchema);
export const getReceivableCounterModel = () =>
  getOrCreateModel("ReceivableCounter", counterSchema);

export type StoredCustomer = {
  _id: string;
  version: number;
  code: string;
  normalizedCode: string;
  name: string;
  phone: string;
  address: string;
  type: string;
  note: string;
  active: boolean;
  sortOrder: number;
  migrationSource: string | null;
  sourceRow: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type StoredEntry = {
  _id: string;
  version: number;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerPhone: string;
  entryDate: Date;
  role: string;
  type: string;
  status: string;
  amount: unknown;
  documentNumber: string;
  description: string;
  note: string;
  legacyDescription: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: unknown;
  unitPrice: unknown;
  referenceType: string;
  referenceId: string | null;
  referenceNumber: string;
  sequence: number;
  batchId: string | null;
  periodYear: number | null;
  sourceType: string;
  migrationSource: string | null;
  migrationSheet: string | null;
  sourceRow: number | null;
  issues: string[];
  importKey: string | null;
  fingerprint: string | null;
  idempotencyKey: string | null;
  postedAt: string | null;
  postedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};
