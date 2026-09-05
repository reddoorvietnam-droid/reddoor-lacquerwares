import { z } from "zod";

import { supportedCurrencies, type Currency } from "@/lib/money";

/**
 * Customer master records.
 *
 * Confirmed with the company accountant on 2026-09-05: receivables and
 * customer credit are kept per customer, because customers pay for several
 * orders at once and the goods actually shipped can differ from the order
 * placed. Every sales order, invoice, and customer receipt therefore points at
 * a customer record; the accountant maintains the list herself.
 */

export const customerStatuses = ["active", "archived"] as const;
export type CustomerStatus = (typeof customerStatuses)[number];

export type CustomerRecordDto = {
  id: string;
  /** The reference the accountant uses on her own books; optional, unique when set. */
  code: string | null;
  name: string;
  /** Tax identification number, for Vietnamese customers and invoices. */
  taxCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** The currency this customer is usually invoiced in; pre-selects forms only. */
  defaultCurrency: Currency | null;
  notes: string | null;
  status: CustomerStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type CustomerListFilter = {
  status?: CustomerStatus;
};

export type CustomerWriteFields = {
  code: string | null;
  name: string;
  taxCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  defaultCurrency: Currency | null;
  notes: string | null;
};

export interface CustomerStore {
  insert(
    record: CustomerWriteFields & { createdBy: string },
  ): Promise<CustomerRecordDto>;
  findById(customerId: string): Promise<CustomerRecordDto | null>;
  findByIds(
    customerIds: readonly string[],
  ): Promise<ReadonlyMap<string, CustomerRecordDto>>;
  list(filter: CustomerListFilter): Promise<CustomerRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  update(input: {
    customerId: string;
    expectedRevision: number;
    fields: CustomerWriteFields;
    updatedBy: string;
  }): Promise<CustomerRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setStatus(input: {
    customerId: string;
    expectedRevision: number;
    status: CustomerStatus;
    updatedBy: string;
  }): Promise<CustomerRecordDto | null>;
}

export const customerCommandErrorCodes = [
  "NOT_FOUND",
  "DUPLICATE_CODE",
  "REVISION_CONFLICT",
  "INVALID_INPUT",
] as const;

export type CustomerCommandErrorCode =
  (typeof customerCommandErrorCodes)[number];

export class CustomerCommandError extends Error {
  readonly code: CustomerCommandErrorCode;

  constructor(code: CustomerCommandErrorCode, message: string) {
    super(message);
    this.name = "CustomerCommandError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

/** Trimmed free text where an empty field means "not given". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null));

/**
 * The accountant's own references come from her accounting software and may
 * be a tax number, a short word, or the company name itself; only control
 * characters are refused. Upper-cased so `abc` and `ABC` are the same code.
 */
const referenceCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(80)
  .regex(/^[^\p{Cc}]*$/u)
  .nullable()
  .default(null)
  .transform((value) => (value && value.length > 0 ? value : null));

export const customerWriteInputSchema = z.object({
  code: referenceCodeSchema,
  name: z.string().trim().min(1).max(240),
  taxCode: optionalText(40),
  country: optionalText(120),
  email: z
    .string()
    .trim()
    .max(320)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null))
    .pipe(z.email().nullable()),
  phone: optionalText(80),
  address: optionalText(1_000),
  defaultCurrency: z
    .union([z.enum(supportedCurrencies), z.literal("")])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  notes: optionalText(4_000),
});

export type CustomerWriteInput = z.infer<typeof customerWriteInputSchema>;
