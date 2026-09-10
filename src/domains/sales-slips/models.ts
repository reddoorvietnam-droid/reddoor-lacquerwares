import "server-only";
import mongoose, { Schema } from "mongoose";
import { getOrCreateModel } from "@/lib/content/mongoose";
import {
  salesSlipStatuses,
  sourceTypes,
  type SalesSlip,
  type SalesSlipLine,
} from "./contracts";

/**
 * `SalesSlip` (collection `salesslips`): one document per Phiếu bán hàng with
 * its lines embedded — a slip has a handful of lines and is always read,
 * written and audited as a whole. The name is deliberately not `SalesInvoice`,
 * which the finance module already uses for the accountant's INV records.
 *
 * Quantities and money are Decimal128 so the list can sort by total exactly;
 * every DTO carries them as canonical decimal strings.
 */

const decimal = () => ({ type: Schema.Types.Decimal128, default: null });

export const toDecimal128 = (value: string | null) =>
  value === null ? null : mongoose.Types.Decimal128.fromString(value);

/** Decimal128 | number | string | null → canonical decimal string (or null). */
export function decimalToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    const text = (value as { toString(): string }).toString();
    return text.includes("E") ? Number(text).toString() : text;
  }
  return null;
}

const lineSchema = new Schema(
  {
    id: { type: String, required: true },
    lineNumber: { type: Number, required: true },
    itemId: { type: String, default: null },
    itemCode: { type: String, default: "" },
    itemName: { type: String, default: "" },
    unit: { type: String, default: "" },
    quantity: decimal(),
    unitPrice: decimal(),
    lineAmount: decimal(),
    priceManual: { type: Boolean, default: false },
  },
  { _id: false, strict: "throw", minimize: false },
);

const slipSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    internalNumber: { type: String, default: null },
    /** UTC midnight of the calendar date. */
    slipDate: { type: Date, required: true },
    recipientId: { type: String, default: null },
    recipientCode: { type: String, default: "" },
    recipientName: { type: String, default: "" },
    recipientUnit: { type: String, default: "" },
    content: { type: String, default: "", maxlength: 2000 },
    lines: { type: [lineSchema], default: [] },
    subtotal: decimal(),
    totalPayment: decimal(),
    totalInWords: { type: String, default: null },
    status: { type: String, enum: salesSlipStatuses, required: true },
    note: { type: String, default: "", maxlength: 4000 },
    sourceType: { type: String, enum: sourceTypes, required: true },
    migrationSource: { type: String, default: null },
    migrationSheet: { type: String, default: null },
    migrationIssues: { type: [String], default: [] },
    /** `${sha256(workbook)}:${sheet}` — makes the migration idempotent. */
    importKey: String,
    /** Hash of the business fields, for duplicate warnings on later imports. */
    fingerprint: String,
    linkedInventoryDocumentId: { type: String, default: null },
    confirmedAt: { type: String, default: null },
    confirmedBy: { type: String, default: null },
    cancelledAt: { type: String, default: null },
    cancelledBy: { type: String, default: null },
    cancelReason: { type: String, default: null },
    createdAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    updatedAt: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { versionKey: false, strict: "throw", minimize: false },
);
// Partial (not sparse): migrated slips store `internalNumber: null`, which a
// sparse unique index would still index and refuse as a duplicate.
slipSchema.index(
  { internalNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { internalNumber: { $type: "string" } },
  },
);
slipSchema.index(
  { importKey: 1 },
  { unique: true, partialFilterExpression: { importKey: { $type: "string" } } },
);
// List default order and the date filter.
slipSchema.index({ slipDate: -1, createdAt: -1 });
slipSchema.index({ status: 1, slipDate: -1 });
slipSchema.index({ recipientId: 1, slipDate: -1 });
slipSchema.index({ createdBy: 1, slipDate: -1 });
// Search by item and the future stock-issue link.
slipSchema.index({ "lines.itemId": 1 });
slipSchema.index({ fingerprint: 1 });

/** Per-day sequence behind `PBH-yyyyMMdd-nnn`; `_id` is the day prefix. */
const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, strict: "throw" },
);

export const getSalesSlipModel = () =>
  getOrCreateModel("SalesSlip", slipSchema);
export const getSalesSlipCounterModel = () =>
  getOrCreateModel("SalesSlipCounter", counterSchema);

export type StoredLine = Omit<
  SalesSlipLine,
  "quantity" | "unitPrice" | "lineAmount"
> & {
  quantity: unknown;
  unitPrice: unknown;
  lineAmount: unknown;
};

export type StoredSlip = Omit<
  SalesSlip,
  "id" | "slipDate" | "lines" | "subtotal" | "totalPayment" | "pricesRedacted"
> & {
  _id: string;
  slipDate: Date;
  lines: StoredLine[];
  subtotal: unknown;
  totalPayment: unknown;
  importKey?: string;
  fingerprint?: string;
};

export function toSlip(stored: StoredSlip): SalesSlip {
  const {
    _id,
    slipDate,
    lines,
    subtotal,
    totalPayment,
    importKey,
    fingerprint,
    ...rest
  } = stored;
  void importKey;
  void fingerprint;
  return {
    ...rest,
    id: _id,
    slipDate: slipDate.toISOString().slice(0, 10),
    migrationIssues: [...(rest.migrationIssues ?? [])],
    lines: lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      itemId: line.itemId ?? null,
      itemCode: line.itemCode ?? "",
      itemName: line.itemName ?? "",
      unit: line.unit ?? "",
      quantity: decimalToString(line.quantity),
      unitPrice: decimalToString(line.unitPrice),
      lineAmount: decimalToString(line.lineAmount),
      priceManual: Boolean(line.priceManual),
    })),
    subtotal: decimalToString(subtotal),
    totalPayment: decimalToString(totalPayment),
  };
}

export function toStored(slip: SalesSlip): StoredSlip {
  const {
    id,
    slipDate,
    lines,
    subtotal,
    totalPayment,
    pricesRedacted,
    ...rest
  } = slip;
  void pricesRedacted;
  return {
    ...rest,
    _id: id,
    slipDate: new Date(`${slipDate}T00:00:00Z`),
    lines: lines.map((line) => ({
      ...line,
      quantity: toDecimal128(line.quantity),
      unitPrice: toDecimal128(line.unitPrice),
      lineAmount: toDecimal128(line.lineAmount),
    })),
    subtotal: toDecimal128(subtotal),
    totalPayment: toDecimal128(totalPayment),
  };
}
