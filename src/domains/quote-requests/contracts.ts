import { z } from "zod";

import type { AuditRepository } from "@/domains/audit/contracts";
import type { AccessContext } from "@/lib/auth/authorization";
import type { Locale } from "@/lib/i18n/config";

/**
 * Quote requests: the enquiries visitors send from the contact page. A
 * request is a snapshot of what the buyer asked for — who they are, which
 * catalogue pieces or custom work they want, how many, by when, on what
 * shipping terms — plus the trail of how the Director handled it.
 *
 * Nothing here is a price. Pricing lives in the internal quote module; this
 * is the inbox that feeds it.
 */

export const quoteRequestStatuses = [
  "new",
  "in_progress",
  "quoted",
  "closed",
  "spam",
] as const;
export type QuoteRequestStatus = (typeof quoteRequestStatuses)[number];

export const quoteRequestTypes = [
  "existing_products",
  "custom_design",
  "samples",
  "catalogue",
  "other",
] as const;
export type QuoteRequestType = (typeof quoteRequestTypes)[number];

/** Incoterms buyers actually ask for, plus "not sure yet" for first contact. */
export const quoteRequestDeliveryTerms = [
  "EXW",
  "FOB",
  "CIF",
  "DDP",
  "unsure",
] as const;
export type QuoteRequestDeliveryTerm =
  (typeof quoteRequestDeliveryTerms)[number];

export type QuoteRequestContact = {
  fullName: string;
  company: string | null;
  email: string;
  phone: string | null;
  country: string;
};

export type QuoteRequestItem = {
  /** Catalogue product id when picked from the list; null for free text. */
  productId: string | null;
  productName: string;
  quantity: number | null;
};

export type QuoteRequestDetails = {
  requestType: QuoteRequestType;
  items: readonly QuoteRequestItem[];
  /** Overall quantity for custom work that has no catalogue line items. */
  estimatedQuantity: number | null;
  /** Free text: a target price, a budget, a currency. Never parsed. */
  budget: string | null;
  /** ISO date (YYYY-MM-DD) the buyer needs the goods by. */
  deadline: string | null;
  deliveryTerms: QuoteRequestDeliveryTerm | null;
  destination: string | null;
  message: string;
};

export type QuoteRequestHistoryEntry = {
  from: QuoteRequestStatus | null;
  to: QuoteRequestStatus;
  byUserId: string | null;
  reason: string | null;
  at: Date;
};

export type QuoteRequestNotificationState = {
  adminSentAt: Date | null;
  customerSentAt: Date | null;
  lastError: string | null;
};

export type QuoteRequestDto = {
  id: string;
  requestCode: string;
  contact: QuoteRequestContact;
  details: QuoteRequestDetails;
  /** The site language the visitor wrote in; replies should match it. */
  locale: Locale;
  status: QuoteRequestStatus;
  history: readonly QuoteRequestHistoryEntry[];
  notifications: QuoteRequestNotificationState;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null));

export const quoteRequestContactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  company: optionalText(200),
  email: z.email().max(200),
  phone: optionalText(30).refine(
    (value) => value === null || /^[+\d][\d\s().-]{5,29}$/.test(value),
    "Phone number looks wrong.",
  ),
  country: z.string().trim().min(2).max(120),
});

export const quoteRequestItemSchema = z.object({
  productId: z.string().trim().min(1).max(120).nullable().default(null),
  productName: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(1_000_000).nullable().default(null),
});

export const quoteRequestDetailsSchema = z.object({
  requestType: z.enum(quoteRequestTypes),
  items: z.array(quoteRequestItemSchema).max(30).default([]),
  estimatedQuantity: z
    .number()
    .int()
    .min(1)
    .max(10_000_000)
    .nullable()
    .default(null),
  budget: optionalText(120),
  deadline: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  deliveryTerms: z.enum(quoteRequestDeliveryTerms).nullable().default(null),
  destination: optionalText(200),
  message: z.string().trim().min(10).max(5_000),
});

export const submitQuoteRequestSchema = z.object({
  locale: z.string().min(2).max(10),
  contact: quoteRequestContactSchema,
  details: quoteRequestDetailsSchema,
});
export type SubmitQuoteRequestInput = z.infer<typeof submitQuoteRequestSchema>;

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export type QuoteRequestListFilter = {
  status?: QuoteRequestStatus;
};

export type NewQuoteRequestRecord = Omit<
  QuoteRequestDto,
  "id" | "createdAt" | "updatedAt" | "revision"
>;

export interface QuoteRequestStore {
  list(filter: QuoteRequestListFilter): Promise<QuoteRequestDto[]>;
  findById(requestId: string): Promise<QuoteRequestDto | null>;
  insert(record: NewQuoteRequestRecord): Promise<QuoteRequestDto>;
  /** Conditional on the revision; null means the record moved on. */
  applyTransition(input: {
    requestId: string;
    expectedRevision: number;
    to: QuoteRequestStatus;
    historyEntry: QuoteRequestHistoryEntry;
    updatedBy: string;
  }): Promise<QuoteRequestDto | null>;
  recordNotification(input: {
    requestId: string;
    notifications: QuoteRequestNotificationState;
  }): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const quoteRequestErrorCodes = [
  "NOT_FOUND",
  "DUPLICATE_REQUEST_CODE",
  "REVISION_CONFLICT",
  "STATUS_MISMATCH",
  "INVALID_INPUT",
  "PERSISTENCE_FAILURE",
] as const;
export type QuoteRequestErrorCode = (typeof quoteRequestErrorCodes)[number];

export class QuoteRequestError extends Error {
  readonly code: QuoteRequestErrorCode;

  constructor(code: QuoteRequestErrorCode, message: string) {
    super(message);
    this.name = "QuoteRequestError";
    this.code = code;
  }
}

export type QuoteRequestServiceDependencies = {
  store: QuoteRequestStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export type { AccessContext };

/** Request codes: RQ-YYYYMMDD-XXXX, easy to quote back in an email. */
export function generateQuoteRequestCode(
  now: Date,
  random = Math.random,
): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += alphabet[Math.floor(random() * alphabet.length)];
  }
  return `RQ-${date}-${suffix}`;
}
