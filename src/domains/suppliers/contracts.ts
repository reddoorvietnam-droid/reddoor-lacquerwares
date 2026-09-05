import { z } from "zod";

/**
 * Supplier master records.
 *
 * Asked for by the company accountant on 2026-09-05 alongside the customer
 * list: the factory accountant records actual factory costs against a
 * supplier picked from a list instead of typing a name each time, so the
 * cost ledger can be read per supplier later.
 */

export const supplierStatuses = ["active", "archived"] as const;
export type SupplierStatus = (typeof supplierStatuses)[number];

export type SupplierRecordDto = {
  id: string;
  /** Short reference used on purchase files; optional, unique when set. */
  code: string | null;
  name: string;
  /** Tax identification number, for Vietnamese suppliers and their invoices. */
  taxCode: string | null;
  /** What the supplier provides: materials, outsourcing, shipping, packaging… */
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: SupplierStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type SupplierListFilter = {
  status?: SupplierStatus;
};

export type SupplierWriteFields = {
  code: string | null;
  name: string;
  taxCode: string | null;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

export interface SupplierStore {
  insert(
    record: SupplierWriteFields & { createdBy: string },
  ): Promise<SupplierRecordDto>;
  findById(supplierId: string): Promise<SupplierRecordDto | null>;
  list(filter: SupplierListFilter): Promise<SupplierRecordDto[]>;
  /** Conditional on the revision; null means the record moved on. */
  update(input: {
    supplierId: string;
    expectedRevision: number;
    fields: SupplierWriteFields;
    updatedBy: string;
  }): Promise<SupplierRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setStatus(input: {
    supplierId: string;
    expectedRevision: number;
    status: SupplierStatus;
    updatedBy: string;
  }): Promise<SupplierRecordDto | null>;
}

export const supplierCommandErrorCodes = [
  "NOT_FOUND",
  "DUPLICATE_CODE",
  "REVISION_CONFLICT",
  "INVALID_INPUT",
] as const;

export type SupplierCommandErrorCode =
  (typeof supplierCommandErrorCodes)[number];

export class SupplierCommandError extends Error {
  readonly code: SupplierCommandErrorCode;

  constructor(code: SupplierCommandErrorCode, message: string) {
    super(message);
    this.name = "SupplierCommandError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null));

export const supplierWriteInputSchema = z.object({
  // Same rule as customer codes: the accountant's own reference, any
  // printable text, upper-cased for uniqueness.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .max(80)
    .regex(/^[^\p{Cc}]*$/u)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null)),
  name: z.string().trim().min(1).max(240),
  taxCode: optionalText(40),
  category: optionalText(120),
  contactName: optionalText(160),
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
  notes: optionalText(4_000),
});

export type SupplierWriteInput = z.infer<typeof supplierWriteInputSchema>;
