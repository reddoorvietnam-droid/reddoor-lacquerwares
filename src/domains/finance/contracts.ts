import { z } from "zod";

import { supportedCurrencies, type Currency } from "@/lib/money";

/**
 * Finance ledger entries: every đồng that moves is one record.
 *
 * A `receipt` is money coming in (a customer payment or another income), an
 * `expense` is money going out (an order cost, a general cost, or a refund
 * to a customer). One collection carries both so the cash ledger, the
 * per-order cost total, and the receivables all read the same records.
 *
 * Entries are never hard-deleted: a mistake is voided (kept, flagged, audited)
 * so the book always adds up to what was actually recorded.
 *
 * Rules confirmed with the company accountant on 2026-09-05:
 *
 * - Revenue is recognised per sales invoice (INV), not per order price. An
 *   order may carry several invoices; each has its own due date.
 * - Customers deposit per order and pay per invoice, and often transfer one
 *   sum for several orders. A customer receipt is therefore recorded against
 *   the customer and then ALLOCATED to invoices (payments) or orders
 *   (deposits). Whatever stays unallocated is the customer's credit and
 *   offsets later orders. Nothing is ever shown as "overpaid" to refund.
 * - A cancelled order keeps its receipts in the cash total. If money is
 *   actually returned, a `refund` expense is recorded against the customer.
 * - Only USD and VND are used. The accountant enters the USD→VND rate by
 *   date; USD invoices snapshot the rate they were issued with so reports
 *   convert to VND without ever recomputing the past.
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
  "refund",
] as const;
export type FinanceEntryCategory = (typeof financeEntryCategories)[number];

/** Cost categories the factory accountant records against an order. */
export const orderCostCategories = [
  "materials",
  "labor",
  "outsourcing",
  "shipping",
  "packaging",
] as const satisfies readonly FinanceEntryCategory[];

export const financePaymentMethods = ["bankTransfer", "cash", "other"] as const;
export type FinancePaymentMethod = (typeof financePaymentMethods)[number];

export type FinanceEntryAmount = {
  amount: string;
  currency: Currency;
};

/** A file stored at the storage provider and described here. */
export type StoredDocument = {
  id: string;
  publicId: string;
  assetVersion: number;
  /** Provider format such as `pdf`, `jpg`, `png`. */
  format: string;
  bytes: number;
  label: string;
  uploadedBy: string;
  uploadedAt: Date;
};

export type NewStoredDocument = Omit<StoredDocument, "id">;

/**
 * How much of a customer receipt settles which invoice (a payment) or which
 * order (a deposit taken before the invoice exists). Amounts are decimal
 * strings in the receipt's currency. Snapshots of the invoice number and
 * order code let lists render without a join.
 */
export type ReceiptAllocation =
  | {
      target: "invoice";
      invoiceId: string;
      invoiceNumber: string;
      orderId: string;
      orderCode: string;
      amount: string;
    }
  | {
      target: "order";
      orderId: string;
      orderCode: string;
      amount: string;
    };

export type FinanceEntryRecordDto = {
  id: string;
  kind: FinanceEntryKind;
  category: FinanceEntryCategory;
  orderId: string | null;
  /** Snapshot so lists render without joining the order collection. */
  orderCode: string | null;
  /** The customer a receipt or refund belongs to; null for other entries and legacy rows. */
  customerId: string | null;
  /** The supplier a cost was paid to, when picked from the list. */
  supplierId: string | null;
  /** Display name: the customer, the supplier, or free text for other entries. */
  counterparty: string;
  amount: FinanceEntryAmount;
  method: FinancePaymentMethod;
  occurredAt: Date;
  note: string | null;
  /** Receipts only: how the money was applied. Empty means unallocated. */
  allocations: readonly ReceiptAllocation[];
  /** USD entries: VND per 1 USD from the rate table on the entry date; null when no rate was on file. */
  fxRateToVnd: string | null;
  status: "active" | "voided";
  voidReason: string | null;
  businessUnitIds: readonly string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type FinanceListScope =
  | { kind: "all" }
  | { kind: "businessUnits"; businessUnitIds: readonly string[] }
  | { kind: "own"; userId: string };

export type FinanceListFilter = {
  scope: FinanceListScope;
  entryKind?: FinanceEntryKind;
  orderId?: string;
  customerId?: string;
  supplierId?: string;
  limit?: number;
};

/** Active entries only, without a row limit: the input of the receivables computation. */
export type FinanceActiveFilter = {
  scope?: FinanceListScope;
  kind?: FinanceEntryKind;
  category?: FinanceEntryCategory;
  customerId?: string;
  orderId?: string;
};

export type NewFinanceEntryRecord = {
  kind: FinanceEntryKind;
  category: FinanceEntryCategory;
  orderId: string | null;
  orderCode: string | null;
  customerId: string | null;
  supplierId: string | null;
  counterparty: string;
  amount: FinanceEntryAmount;
  method: FinancePaymentMethod;
  occurredAt: Date;
  note: string | null;
  allocations: readonly ReceiptAllocation[];
  fxRateToVnd: string | null;
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
  listActive(filter: FinanceActiveFilter): Promise<FinanceEntryRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  void(input: {
    entryId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null>;
  /** Replaces a receipt's allocations. Conditional on the revision. */
  setAllocations(input: {
    entryId: string;
    expectedRevision: number;
    allocations: readonly ReceiptAllocation[];
    updatedBy: string;
  }): Promise<FinanceEntryRecordDto | null>;
  /** Active-entry totals per order and currency, for the given kind. */
  sumActiveByOrder(
    orderIds: readonly string[],
    kind: FinanceEntryKind,
  ): Promise<OrderAmountTotals>;
}

/* ------------------------------------------------------------------ */
/* Sales invoices (INV)                                                */
/* ------------------------------------------------------------------ */

export type InvoiceRecordDto = {
  id: string;
  orderId: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date;
  amount: FinanceEntryAmount;
  /** USD invoices: VND per 1 USD the invoice was issued with. Always null for VND. */
  fxRateToVnd: string | null;
  note: string | null;
  /** The invoice file itself (PDF or photo), so nothing has to be retyped. */
  documents: readonly StoredDocument[];
  status: "active" | "voided";
  voidReason: string | null;
  businessUnitIds: readonly string[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type NewInvoiceRecord = {
  orderId: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  invoiceNumber: string;
  issuedAt: Date;
  dueAt: Date;
  amount: FinanceEntryAmount;
  fxRateToVnd: string | null;
  note: string | null;
  businessUnitIds: readonly string[];
  createdBy: string;
};

export type InvoiceListFilter = {
  scope?: FinanceListScope;
  orderId?: string;
  customerId?: string;
  status?: "active" | "voided";
};

export interface InvoiceStore {
  insert(record: NewInvoiceRecord): Promise<InvoiceRecordDto>;
  findById(invoiceId: string): Promise<InvoiceRecordDto | null>;
  list(filter: InvoiceListFilter): Promise<InvoiceRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  void(input: {
    invoiceId: string;
    expectedRevision: number;
    reason: string;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  addDocument(input: {
    invoiceId: string;
    expectedRevision: number;
    document: NewStoredDocument;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  removeDocument(input: {
    invoiceId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<InvoiceRecordDto | null>;
}

/* ------------------------------------------------------------------ */
/* Exchange rates                                                      */
/* ------------------------------------------------------------------ */

/**
 * One USD→VND rate per calendar day, entered by the company accountant. The
 * table is a convenience for pre-filling; every USD invoice keeps its own
 * snapshot so a later correction never rewrites an issued invoice.
 */
export type FxRateRecordDto = {
  id: string;
  /** Calendar day at UTC midnight. */
  date: Date;
  from: "USD";
  to: "VND";
  /** Decimal string: VND per 1 USD. */
  rate: string;
  source: string | null;
  updatedBy: string;
  updatedAt: Date;
};

export interface FxRateStore {
  upsert(input: {
    date: Date;
    rate: string;
    source: string | null;
    actorId: string;
  }): Promise<FxRateRecordDto>;
  findLatestOnOrBefore(date: Date): Promise<FxRateRecordDto | null>;
  list(limit: number): Promise<FxRateRecordDto[]>;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const financeCommandErrorCodes = [
  "NOT_FOUND",
  "ORDER_NOT_FOUND",
  "ORDER_CANCELLED",
  "ORDER_CLOSED",
  "CUSTOMER_NOT_FOUND",
  "CUSTOMER_REQUIRED",
  "CUSTOMER_MISMATCH",
  "SUPPLIER_NOT_FOUND",
  "INVOICE_NOT_FOUND",
  "INVOICE_VOIDED",
  "DUPLICATE_INVOICE_NUMBER",
  "CURRENCY_MISMATCH",
  "FX_RATE_REQUIRED",
  "NOT_A_RECEIPT",
  "ALLOCATION_EXCEEDS_ENTRY",
  "ALLOCATION_EXCEEDS_INVOICE",
  "REFUND_EXCEEDS_CREDIT",
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

/** A blank optional id means "not given". */
const optionalObjectId = z
  .union([z.literal(""), objectIdSchema])
  .nullable()
  .default(null)
  .transform((value) => (value ? value : null));

/** A positive decimal string such as "25400" or "25400.5". */
const decimalStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d+)?$/)
  .max(40);

export const allocationTargetSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("invoice"), invoiceId: objectIdSchema }),
  z.object({ target: z.literal("order"), orderId: objectIdSchema }),
]);

export type AllocationTargetInput = z.infer<typeof allocationTargetSchema>;

export const createFinanceEntryInputSchema = z.object({
  kind: z.enum(financeEntryKinds),
  category: z.enum(financeEntryCategories),
  orderId: optionalObjectId,
  customerId: optionalObjectId,
  supplierId: optionalObjectId,
  /** Free text for entries without a customer or supplier record. */
  counterparty: z.string().trim().max(240).default(""),
  amount: z.object({
    amount: z.string().trim().min(1).max(40),
    currency: z.enum(supportedCurrencies),
  }),
  method: z.enum(financePaymentMethods),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(2_000).nullable().default(null),
  /** Customer receipts: apply the money to one invoice or one order on entry. */
  allocateTo: allocationTargetSchema.nullable().default(null),
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

export const setAllocationsInputSchema = z.object({
  entryId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  allocations: z
    .array(
      z.discriminatedUnion("target", [
        z.object({
          target: z.literal("invoice"),
          invoiceId: objectIdSchema,
          amount: z.string().trim().min(1).max(40),
        }),
        z.object({
          target: z.literal("order"),
          orderId: objectIdSchema,
          amount: z.string().trim().min(1).max(40),
        }),
      ]),
    )
    .max(200),
});

export type SetAllocationsInput = z.infer<typeof setAllocationsInputSchema>;

export const createInvoiceInputSchema = z.object({
  orderId: objectIdSchema,
  invoiceNumber: z.string().trim().min(1).max(60),
  issuedAt: z.coerce.date(),
  dueAt: z.coerce.date(),
  amount: z.object({
    amount: z.string().trim().min(1).max(40),
    currency: z.enum(supportedCurrencies),
  }),
  /** USD only. Blank means "take the rate table's rate for the issue date". */
  fxRateToVnd: z
    .union([z.literal(""), decimalStringSchema])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  note: z.string().trim().max(2_000).nullable().default(null),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceInputSchema>;

export const voidInvoiceInputSchema = z.object({
  invoiceId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  reason: z.string().trim().min(1).max(2_000),
});

export const storedDocumentInputSchema = z.object({
  publicId: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(/^[A-Za-z0-9._\-/]+$/),
  assetVersion: z.coerce.number().int().min(1),
  format: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]{1,10}$/),
  bytes: z.coerce.number().int().min(1),
  label: z.string().trim().min(1).max(200),
});

export const invoiceDocumentInputSchema = storedDocumentInputSchema.extend({
  invoiceId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
});

export const setFxRateInputSchema = z.object({
  date: z.coerce.date(),
  rate: decimalStringSchema.refine((value) => Number(value) > 0, {
    message: "The rate must be positive.",
  }),
  source: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type SetFxRateInput = z.infer<typeof setFxRateInputSchema>;

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
  refund: "expense",
};

/** Normalises a calendar day to UTC midnight so one day has one rate. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
