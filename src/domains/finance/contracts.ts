import { z } from "zod";

import { supportedCurrencies, type Currency } from "@/lib/money";

/**
 * Finance ledger entries: every đồng that moves is one record.
 *
 * A `receipt` is money coming in (an order payment or another income), an
 * `expense` is money going out (an order cost or a general cost). One
 * collection carries both so the cash ledger, the per-order payment status,
 * and the per-order cost total are all reads over the same records.
 *
 * Entries are never hard-deleted: a mistake is voided (kept, flagged, audited)
 * so the book always adds up to what was actually recorded.
 */

export const financeEntryKinds = ["receipt", "expense"] as const;
export type FinanceEntryKind = (typeof financeEntryKinds)[number];

export const financeEntryCategories = [
  "orderPayment",
  "otherIncome",
  "materials",
  "labor",
  "outsourcing",
  "shipping",
  "packaging",
  "generalCost",
] as const;
export type FinanceEntryCategory = (typeof financeEntryCategories)[number];

export const financePaymentMethods = ["bankTransfer", "cash", "other"] as const;
export type FinancePaymentMethod = (typeof financePaymentMethods)[number];

export type FinanceEntryAmount = {
  amount: string;
  currency: Currency;
};

export type FinanceEntryRecordDto = {
  id: string;
  kind: FinanceEntryKind;
  category: FinanceEntryCategory;
  orderId: string | null;
  /** Snapshot so lists render without joining the order collection. */
  orderCode: string | null;
  counterparty: string;
  amount: FinanceEntryAmount;
  method: FinancePaymentMethod;
  occurredAt: Date;
  note: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  businessUnitIds: readonly string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type FinanceListFilter = {
  scope:
    | { kind: "all" }
    | { kind: "businessUnits"; businessUnitIds: readonly string[] }
    | { kind: "own"; userId: string };
  entryKind?: FinanceEntryKind;
  orderId?: string;
  limit?: number;
};

export type NewFinanceEntryRecord = {
  kind: FinanceEntryKind;
  category: FinanceEntryCategory;
  orderId: string | null;
  orderCode: string | null;
  counterparty: string;
  amount: FinanceEntryAmount;
  method: FinancePaymentMethod;
  occurredAt: Date;
  note: string | null;
  businessUnitIds: readonly string[];
  createdBy: string;
};

/** Per-order, per-currency totals of ACTIVE entries of one kind. */
export type OrderAmountTotals = ReadonlyMap<
  string,
  readonly FinanceEntryAmount[]
>;

export interface FinanceEntryStore {
  insert(record: NewFinanceEntryRecord): Promise<FinanceEntryRecordDto>;
  findById(entryId: string): Promise<FinanceEntryRecordDto | null>;
  list(filter: FinanceListFilter): Promise<FinanceEntryRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  void(input: {
    entryId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null>;
  /** Active-entry totals per order and currency, for the given kind. */
  sumActiveByOrder(
    orderIds: readonly string[],
    kind: FinanceEntryKind,
  ): Promise<OrderAmountTotals>;
}

export const financeCommandErrorCodes = [
  "NOT_FOUND",
  "ORDER_NOT_FOUND",
  "CURRENCY_MISMATCH",
  "REVISION_CONFLICT",
  "ALREADY_VOIDED",
  "INVALID_INPUT",
] as const;

export type FinanceCommandErrorCode = (typeof financeCommandErrorCodes)[number];

export class FinanceCommandError extends Error {
  readonly code: FinanceCommandErrorCode;

  constructor(code: FinanceCommandErrorCode, message: string) {
    super(message);
    this.name = "FinanceCommandError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const createFinanceEntryInputSchema = z.object({
  kind: z.enum(financeEntryKinds),
  category: z.enum(financeEntryCategories),
  orderId: objectIdSchema.nullable().default(null),
  /** May be blank when linked to an order — the order's customer is used. */
  counterparty: z.string().trim().max(240).default(""),
  amount: z.object({
    amount: z.string().trim().min(1).max(40),
    currency: z.enum(supportedCurrencies),
  }),
  method: z.enum(financePaymentMethods),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(2_000).nullable().default(null),
});

export type CreateFinanceEntryInput = z.infer<
  typeof createFinanceEntryInputSchema
>;

export const voidFinanceEntryInputSchema = z.object({
  entryId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  reason: z.string().trim().min(1).max(2_000),
});

export type VoidFinanceEntryInput = z.infer<typeof voidFinanceEntryInputSchema>;

/** Category → the entry kind it belongs to; a receipt can never carry a cost category. */
export const categoryKind: Record<FinanceEntryCategory, FinanceEntryKind> = {
  orderPayment: "receipt",
  otherIncome: "receipt",
  materials: "expense",
  labor: "expense",
  outsourcing: "expense",
  shipping: "expense",
  packaging: "expense",
  generalCost: "expense",
};
