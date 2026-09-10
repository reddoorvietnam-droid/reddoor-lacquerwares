import "server-only";
import mongoose, { Schema, type Types } from "mongoose";
import { getOrCreateModel } from "@/lib/content/mongoose";
import { transactionStatuses, transactionTypes } from "./contracts";

/**
 * Quantities are Decimal128 so MongoDB sums them exactly inside the balance
 * aggregation; every DTO carries them as canonical decimal strings.
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

const materialSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    code: { type: String, required: true, trim: true, maxlength: 150 },
    /** `codeKey(code)`: the unique, VLOOKUP-compatible identity. */
    normalizedCode: { type: String, required: true, maxlength: 150 },
    name: { type: String, default: "", trim: true, maxlength: 300 },
    unit: { type: String, default: "", trim: true, maxlength: 50 },
    openingQuantity: decimal(true),
    minimumStock: decimal(),
    note: { type: String, default: "", maxlength: 4000 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true },
    migrationSource: String,
    sourceRow: Number,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { versionKey: false, strict: "throw" },
);
materialSchema.index({ normalizedCode: 1 }, { unique: true });
materialSchema.index({ active: 1, sortOrder: 1 });

const facilitySchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    code: { type: String, required: true, trim: true, maxlength: 150 },
    normalizedCode: { type: String, required: true, maxlength: 150 },
    name: { type: String, default: "", trim: true, maxlength: 300 },
    type: { type: String, default: "", trim: true, maxlength: 50 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    note: { type: String, default: "", maxlength: 4000 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, required: true },
    migrationSource: String,
    sourceRow: Number,
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { versionKey: false, strict: "throw" },
);
facilitySchema.index({ normalizedCode: 1 }, { unique: true });
facilitySchema.index({ active: 1, sortOrder: 1 });

const transactionSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    type: { type: String, enum: transactionTypes, required: true },
    status: { type: String, enum: transactionStatuses, required: true },
    /** UTC midnight of the calendar date. */
    transactionDate: { type: Date, required: true },
    materialId: { type: String, required: true },
    materialCode: { type: String, required: true },
    materialName: { type: String, default: "" },
    unit: { type: String, default: "" },
    quantity: decimal(true),
    unitPrice: decimal(),
    amount: decimal(),
    facilityId: { type: String, default: null },
    facilityCode: { type: String, default: "" },
    facilityName: { type: String, default: "" },
    description: { type: String, default: "", maxlength: 2000 },
    note: { type: String, default: "", maxlength: 4000 },
    batchId: { type: String, default: null },
    /** `${sha256(workbook)}:${sheet}:${row}` — makes any import idempotent. */
    importKey: String,
    /** Hash of the business fields, for duplicate warnings on later imports. */
    fingerprint: String,
    migrationSource: { type: String, default: null, maxlength: 255 },
    sourceRow: { type: Number, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    cancelledAt: { type: String, default: null },
    cancelledBy: { type: String, default: null },
    cancelReason: { type: String, default: null },
  },
  { versionKey: false, strict: "throw" },
);
transactionSchema.index({ importKey: 1 }, { unique: true, sparse: true });
// Balance aggregation: posted lines grouped by material.
transactionSchema.index({ status: 1, materialId: 1, type: 1 });
// Ledger tabs: one type, newest first, stable tiebreak.
transactionSchema.index({
  type: 1,
  status: 1,
  transactionDate: 1,
  createdAt: 1,
  _id: 1,
});
// Material timeline and click-through from the summary.
transactionSchema.index({
  materialId: 1,
  status: 1,
  transactionDate: 1,
  createdAt: 1,
  _id: 1,
});
transactionSchema.index({ facilityId: 1, transactionDate: 1 });
transactionSchema.index({ fingerprint: 1 });

export type StoredMaterial = {
  _id: string;
  version: number;
  code: string;
  normalizedCode: string;
  name: string;
  unit: string;
  openingQuantity: Types.Decimal128;
  minimumStock?: Types.Decimal128 | null;
  note: string;
  active: boolean;
  sortOrder: number;
  migrationSource?: string;
  sourceRow?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type StoredFacility = {
  _id: string;
  version: number;
  code: string;
  normalizedCode: string;
  name: string;
  type: string;
  phone: string;
  note: string;
  active: boolean;
  sortOrder: number;
  migrationSource?: string;
  sourceRow?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type StoredTransaction = {
  _id: string;
  version: number;
  type: "INBOUND" | "OUTBOUND" | "ADJUSTMENT";
  status: "POSTED" | "CANCELLED";
  transactionDate: Date;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: Types.Decimal128;
  unitPrice?: Types.Decimal128 | null;
  amount?: Types.Decimal128 | null;
  facilityId: string | null;
  facilityCode: string;
  facilityName: string;
  description: string;
  note: string;
  batchId: string | null;
  importKey?: string;
  fingerprint?: string;
  migrationSource: string | null;
  sourceRow: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
};

export const getMaterialModel = () =>
  getOrCreateModel("MaterialItem", materialSchema);
export const getFacilityModel = () =>
  getOrCreateModel("MaterialFacility", facilitySchema);
export const getMaterialTransactionModel = () =>
  getOrCreateModel("MaterialTransaction", transactionSchema);
