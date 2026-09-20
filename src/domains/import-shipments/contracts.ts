import { z } from "zod";

/**
 * Import shipments ("Hàng nhập khẩu").
 *
 * The Director's answer of 2026-09-14: imports are declared in separate
 * customs software, but every document of an import must be kept on the
 * web. A shipment is therefore a file folder, not a workflow: a reference
 * code, the declaration facts, the foreign supplier, the goods, and the
 * documents. It has no status and is never deleted.
 */

export const importShipmentDocumentKinds = [
  "importDeclaration",
  "commercialInvoice",
  "packingList",
  "billOfLading",
  "certificateOfOrigin",
  "contract",
  "payment",
  "other",
] as const;

export type ImportShipmentDocumentKind =
  (typeof importShipmentDocumentKinds)[number];

export const importShipmentDocumentLabels: Record<
  ImportShipmentDocumentKind,
  { vi: string; en: string }
> = {
  importDeclaration: { vi: "Tờ khai nhập khẩu", en: "Import declaration" },
  commercialInvoice: { vi: "Invoice", en: "Commercial invoice" },
  packingList: { vi: "Packing List", en: "Packing list" },
  billOfLading: { vi: "B/L", en: "Bill of lading (B/L)" },
  certificateOfOrigin: { vi: "C/O", en: "Certificate of origin (C/O)" },
  contract: { vi: "Hợp đồng / PO", en: "Contract / PO" },
  payment: { vi: "Chứng từ thanh toán", en: "Payment documents" },
  other: { vi: "Chứng từ khác", en: "Other documents" },
};

export type ImportShipmentDocument = {
  id: string;
  kind: ImportShipmentDocumentKind;
  publicId: string;
  assetVersion: number;
  /** Provider format such as `pdf`, `jpg`, `png`. */
  format: string;
  bytes: number;
  label: string;
  uploadedBy: string;
  uploadedAt: Date;
};

export type NewImportShipmentDocument = Omit<ImportShipmentDocument, "id">;

export type ImportShipmentRecordDto = {
  id: string;
  code: string;
  /** Số tờ khai, as issued by the customs software. */
  declarationNumber: string | null;
  declaredOn: Date | null;
  /** The foreign supplier, free text. */
  supplierName: string;
  goodsDescription: string;
  note: string | null;
  documents: ImportShipmentDocument[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

export type ImportShipmentWriteFields = {
  declarationNumber: string | null;
  declaredOn: Date | null;
  supplierName: string;
  goodsDescription: string;
  note: string | null;
};

export type ImportShipmentListFilter = {
  /** Matched against code, declaration number, supplier and goods. */
  search?: string;
};

export interface ImportShipmentStore {
  /** Throws `DUPLICATE_CODE` when the code is taken. */
  insert(
    record: ImportShipmentWriteFields & { code: string; createdBy: string },
  ): Promise<ImportShipmentRecordDto>;
  findById(shipmentId: string): Promise<ImportShipmentRecordDto | null>;
  list(filter: ImportShipmentListFilter): Promise<ImportShipmentRecordDto[]>;
  /**
   * Conditional on the revision; null means the record moved on. Throws
   * `DUPLICATE_CODE` when the new code is taken.
   */
  update(input: {
    shipmentId: string;
    expectedRevision: number;
    fields: ImportShipmentWriteFields & { code: string };
    updatedBy: string;
  }): Promise<ImportShipmentRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  addDocument(input: {
    shipmentId: string;
    expectedRevision: number;
    document: NewImportShipmentDocument;
    updatedBy: string;
  }): Promise<ImportShipmentRecordDto | null>;
  /**
   * Conditional on the revision and on the document still being there;
   * null means the record moved on.
   */
  removeDocument(input: {
    shipmentId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<ImportShipmentRecordDto | null>;
}

export const importShipmentCommandErrorCodes = [
  "NOT_FOUND",
  "DUPLICATE_CODE",
  "REVISION_CONFLICT",
  "INVALID_INPUT",
] as const;

export type ImportShipmentCommandErrorCode =
  (typeof importShipmentCommandErrorCodes)[number];

export class ImportShipmentCommandError extends Error {
  readonly code: ImportShipmentCommandErrorCode;

  constructor(code: ImportShipmentCommandErrorCode, message: string) {
    super(message);
    this.name = "ImportShipmentCommandError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Input schemas                                                       */
/* ------------------------------------------------------------------ */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => (value && value.length > 0 ? value : null));

/** A blank date field means "not set"; anything else must parse as a date. */
const optionalDate = z
  .union([z.literal(""), z.coerce.date()])
  .nullable()
  .default(null)
  .transform((value) => (value instanceof Date ? value : null));

export const importShipmentCodePattern = /^[A-Z0-9]+(?:[-_./][A-Z0-9]+)*$/;

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(40)
  .regex(importShipmentCodePattern);

const writeFields = {
  declarationNumber: optionalText(60),
  declaredOn: optionalDate,
  supplierName: z.string().trim().min(1).max(240),
  goodsDescription: z.string().trim().min(1).max(2_000),
  note: optionalText(4_000),
};

export const createImportShipmentInputSchema = z.object({
  /** Blank means "allocate NK-YYYYMMDD-XXXX". */
  code: z
    .union([z.literal(""), codeSchema])
    .nullable()
    .default(null)
    .transform((value) => (value ? value : null)),
  ...writeFields,
});

export type CreateImportShipmentInput = z.infer<
  typeof createImportShipmentInputSchema
>;

export const updateImportShipmentInputSchema = z.object({
  shipmentId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  code: codeSchema,
  ...writeFields,
});

export const importShipmentDocumentInputSchema = z.object({
  shipmentId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  kind: z.enum(importShipmentDocumentKinds),
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

export const removeImportShipmentDocumentInputSchema = z.object({
  shipmentId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  documentId: objectIdSchema,
});

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Reference code NK-YYYYMMDD-XXXX, the same idea as the order code: a random
 * tail instead of a counter; the unique index arbitrates a collision and the
 * service retries with a fresh tail.
 */
export function generateImportShipmentCode(
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
  return `NK-${year}${month}${day}-${tail}`;
}

/** Whether the customs declaration itself is on file. */
export function hasImportDeclaration(record: {
  documents: readonly { kind: ImportShipmentDocumentKind }[];
}): boolean {
  return record.documents.some(
    (document) => document.kind === "importDeclaration",
  );
}

/** The search rule of the list, shared by every store. */
export function matchesImportShipmentSearch(
  record: Pick<
    ImportShipmentRecordDto,
    "code" | "declarationNumber" | "supplierName" | "goodsDescription"
  >,
  search: string | undefined,
): boolean {
  const needle = search?.trim().toLocaleLowerCase("vi") ?? "";
  if (!needle) return true;
  return [
    record.code,
    record.declarationNumber ?? "",
    record.supplierName,
    record.goodsDescription,
  ].some((value) => value.toLocaleLowerCase("vi").includes(needle));
}
