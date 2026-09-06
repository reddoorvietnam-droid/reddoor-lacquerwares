import { z } from "zod";

import type { OrderStage } from "@/domains/orders/workflow";
import { supportedCurrencies, type Currency } from "@/lib/money";

/**
 * Sales-order records as the service and UI see them.
 *
 * The selling price is carried separately from the rest of the record and is
 * stripped by the service unless the reader holds `orders.readSellingPrice` —
 * a resource read never implies the commercial fields (RBAC rule 1).
 *
 * Every order points at a customer record (`customerId`) and keeps the
 * customer's name as a snapshot so lists render without a join. Orders
 * recorded before the customer list existed carry a null `customerId`; the
 * receivables view groups those by name.
 */

export type OrderSellingPrice = {
  amount: string;
  currency: Currency;
};

export type OrderStageHistoryEntry = {
  from: OrderStage;
  to: OrderStage;
  byUserId: string;
  reason: string | null;
  at: Date;
};

/** A payment document (bank advice, remittance, L/C copy) stored at Cloudinary. */
export type OrderPaymentDocument = {
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

export type OrderRecordDto = {
  id: string;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  businessUnitIds: readonly string[];
  stage: OrderStage;
  qcPassed: boolean;
  sellingPrice: OrderSellingPrice | null;
  /** Export progress the Company Accountant keeps: when the goods are expected to be ready. */
  expectedReadyAt: Date | null;
  /** Booking reference with the forwarder or carrier. */
  bookingNumber: string | null;
  /** Booking / loading date agreed with the carrier. */
  bookingDate: Date | null;
  paymentDocuments: readonly OrderPaymentDocument[];
  notes: string | null;
  stageHistory: readonly OrderStageHistoryEntry[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

/** The record with commercial fields removed for unauthorized readers. */
export type OrderReadDto = Omit<OrderRecordDto, "sellingPrice"> & {
  sellingPrice: OrderSellingPrice | null;
  sellingPriceVisible: boolean;
};

export type OrderListFilter =
  | { kind: "all" }
  | { kind: "businessUnits"; businessUnitIds: readonly string[] }
  | { kind: "own"; userId: string };

export type NewOrderRecord = {
  orderCode: string;
  customerId: string;
  customerName: string;
  businessUnitIds: readonly string[];
  sellingPrice: OrderSellingPrice | null;
  notes: string | null;
  createdBy: string;
};

export type OrderTransitionWrite = {
  orderId: string;
  expectedRevision: number;
  to: OrderStage;
  qcPassed: boolean;
  historyEntry: OrderStageHistoryEntry;
  updatedBy: string;
};

export type OrderExportProgressWrite = {
  orderId: string;
  expectedRevision: number;
  expectedReadyAt: Date | null;
  bookingNumber: string | null;
  bookingDate: Date | null;
  updatedBy: string;
};

export type NewOrderPaymentDocument = Omit<OrderPaymentDocument, "id">;

export interface OrderStore {
  insert(record: NewOrderRecord): Promise<OrderRecordDto>;
  findById(orderId: string): Promise<OrderRecordDto | null>;
  /** Exact match on the unique, upper-cased order code. */
  findByCode(orderCode: string): Promise<OrderRecordDto | null>;
  list(filter: OrderListFilter): Promise<OrderRecordDto[]>;
  listByCustomer(customerId: string): Promise<OrderRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  applyTransition(input: OrderTransitionWrite): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setQcPassed(input: {
    orderId: string;
    expectedRevision: number;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setSellingPrice(input: {
    orderId: string;
    expectedRevision: number;
    sellingPrice: OrderSellingPrice;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setExportProgress(
    input: OrderExportProgressWrite,
  ): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  addPaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    document: NewOrderPaymentDocument;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  removePaymentDocument(input: {
    orderId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
}

export const orderCommandErrorCodes = [
  "NOT_FOUND",
  "CUSTOMER_NOT_FOUND",
  "CUSTOMER_ARCHIVED",
  "DUPLICATE_ORDER_CODE",
  "REVISION_CONFLICT",
  "STAGE_MISMATCH",
  "INVALID_INPUT",
] as const;

export type OrderCommandErrorCode = (typeof orderCommandErrorCodes)[number];

export class OrderCommandError extends Error {
  readonly code: OrderCommandErrorCode;

  constructor(code: OrderCommandErrorCode, message: string) {
    super(message);
    this.name = "OrderCommandError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const createOrderInputSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
    .max(40)
    .optional(),
  customerId: objectIdSchema,
  businessUnitIds: z.array(objectIdSchema).min(1).max(20),
  sellingPrice: z
    .object({
      amount: z.string().trim().min(1).max(40),
      currency: z.enum(supportedCurrencies),
    })
    .nullable()
    .default(null),
  notes: z.string().trim().max(4_000).nullable().default(null),
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

export const transitionOrderInputSchema = z.object({
  orderId: objectIdSchema,
  to: z.string().trim().min(1).max(40),
  expectedRevision: z.coerce.number().int().min(0),
  reason: z.string().trim().max(2_000).nullable().default(null),
});

export type TransitionOrderInput = z.infer<typeof transitionOrderInputSchema>;

/** A blank date field means "not set"; anything else must parse as a date. */
const optionalDate = z
  .union([z.literal(""), z.coerce.date()])
  .nullable()
  .default(null)
  .transform((value) => (value instanceof Date ? value : null));

export const exportProgressInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  expectedReadyAt: optionalDate,
  bookingNumber: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
  bookingDate: optionalDate,
});

export type ExportProgressInput = z.infer<typeof exportProgressInputSchema>;

export const paymentDocumentInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
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

export type PaymentDocumentInput = z.infer<typeof paymentDocumentInputSchema>;

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Human-readable order code: RD-YYYYMMDD-XXXX. The random tail avoids a
 * counter document; the unique index still arbitrates a collision and the
 * service retries with a fresh tail.
 */
export function generateOrderCode(
  now: Date,
  random: () => number = Math.random,
): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const tail = Array.from({ length: 4 }, () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return alphabet[Math.floor(random() * alphabet.length)] ?? "X";
  }).join("");
  return `RD-${year}${month}${day}-${tail}`;
}

/**
 * The queue-facing description of a gated order action. Deliberately excludes
 * price, customer contact, and every other sensitive field: the summary is
 * shown to all queue readers.
 */
export function approvalSummaryForOrder(order: {
  orderCode: string;
  customerName: string;
  stage: OrderStage;
}): string {
  return `${order.orderCode} · ${order.customerName} · ${order.stage}`;
}
