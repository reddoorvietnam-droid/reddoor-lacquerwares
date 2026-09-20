import { z } from "zod";

import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import {
  emptyReadiness,
  productionStages,
  qcCheckpoints,
  type OrderReadiness,
  type OrderStage,
  type ProductionStage,
  type QcCheckpoint,
} from "@/domains/orders/workflow";
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
 *
 * The SOP outputs live on the record itself: the line items and shipping
 * mark (step 01), the production plan and workshop stage (03, 05), the
 * inspections (05–07), the packing slip (07) and the documents each step
 * produces (contract, PKL, INV, customs declaration, B/L…).
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

/**
 * One product line of the order: the item code the customer ordered, the
 * quantity, and the production site ("cơ sở") that makes it (the Director's
 * answer of 2026-09-14: code, production unit, shipping mark).
 */
export type OrderLineItem = {
  id: string;
  productCode: string;
  description: string;
  quantity: string;
  unit: string;
  /** Production site / sub-workshop making this line; free text. */
  facilityName: string | null;
  note: string | null;
};

/** Step 03 output: the schedule per workshop stage and who does the work. */
export type OrderProductionPlan = {
  woodworkDue: Date | null;
  lacquerDue: Date | null;
  finishingDue: Date | null;
  packingDue: Date | null;
  shipDue: Date | null;
  /** Workers or sub-workshops assigned, free text. */
  assignment: string | null;
  note: string | null;
  savedBy: string;
  savedAt: Date;
};

export const qcResults = ["pass", "fail"] as const;
export type QcResult = (typeof qcResults)[number];

/** One inspection record; the latest per checkpoint decides. */
export type OrderQcCheck = {
  id: string;
  checkpoint: QcCheckpoint;
  result: QcResult;
  /** Pieces found defective, for the per-order defect rate. */
  defectCount: number | null;
  note: string | null;
  byUserId: string;
  at: Date;
};

/** Step 07 output: the Storekeeper's packing slip. */
export type OrderPackingRecord = {
  packedAt: Date | null;
  cartons: number | null;
  pallets: number | null;
  /** Container number when the goods go straight into one. */
  containerNumber: string | null;
  note: string | null;
  byUserId: string;
  at: Date;
};

/**
 * Every file an order produces or receives, by the SOP step it belongs to.
 * Payment evidence keeps its own list (`paymentDocuments`) because it is
 * governed by `payments.record` and hidden from everyone without
 * `payments.read`.
 */
export const orderDocumentKinds = [
  "contract",
  "technical",
  "productionOrder",
  "materialIssue",
  "qcChecklist",
  "packingSlip",
  "packingPhoto",
  "invoice",
  "packingList",
  "label",
  "customerLabelSpec",
  "labelProof",
  "customsDeclaration",
  "billOfLading",
  "fumigation",
  "phyto",
  "certificateOfOrigin",
  "deliveryNote",
  "other",
] as const;

export type OrderDocumentKind = (typeof orderDocumentKinds)[number];

export type OrderDocument = OrderPaymentDocument & { kind: OrderDocumentKind };

export const orderDocumentLabels: Record<
  OrderDocumentKind,
  { vi: string; en: string }
> = {
  contract: { vi: "Hợp đồng / PO", en: "Contract / PO" },
  technical: { vi: "Hồ sơ kỹ thuật mẫu", en: "Technical file" },
  productionOrder: { vi: "Lệnh sản xuất", en: "Production order" },
  materialIssue: { vi: "Phiếu xuất kho", en: "Material issue slip" },
  qcChecklist: { vi: "Checklist QC", en: "QC checklist" },
  packingSlip: { vi: "Phiếu đóng gói", en: "Packing slip" },
  packingPhoto: { vi: "Ảnh đóng gói", en: "Packing photo" },
  invoice: { vi: "Invoice (INV)", en: "Invoice (INV)" },
  packingList: { vi: "Packing List (PKL)", en: "Packing list (PKL)" },
  label: { vi: "Tem nhãn", en: "Labels" },
  customerLabelSpec: {
    vi: "Mẫu tem, shipping mark của khách",
    en: "Customer label & shipping mark spec",
  },
  labelProof: {
    vi: "Mẫu tem, shipping mark theo mẫu công ty",
    en: "Company label & shipping mark proof",
  },
  customsDeclaration: { vi: "Tờ khai hải quan", en: "Customs declaration" },
  billOfLading: { vi: "Bill of Lading (B/L)", en: "Bill of lading (B/L)" },
  fumigation: { vi: "Chứng thư hun trùng", en: "Fumigation certificate" },
  phyto: { vi: "Kiểm dịch thực vật (Phyto)", en: "Phytosanitary certificate" },
  certificateOfOrigin: { vi: "C/O (xuất xứ)", en: "Certificate of origin" },
  deliveryNote: { vi: "Biên bản giao hàng", en: "Delivery note" },
  other: { vi: "Tài liệu khác", en: "Other document" },
};

/**
 * Who may attach or remove each kind. Mirrors the position the SOP names for
 * the step that produces the file; the Director holds every permission.
 */
export const orderDocumentPermissions: Record<OrderDocumentKind, Permission> = {
  contract: "orders.updateDraft",
  technical: "samples.update",
  productionOrder: "production.createPlan",
  materialIssue: "inventory.issue",
  qcChecklist: "production.approveQc",
  packingSlip: "packing.update",
  packingPhoto: "packing.update",
  invoice: "tradeDocuments.manage",
  packingList: "tradeDocuments.manage",
  label: "tradeDocuments.manage",
  customerLabelSpec: "orders.updateDraft",
  labelProof: "orders.updateDraft",
  customsDeclaration: "tradeDocuments.manage",
  billOfLading: "tradeDocuments.manage",
  fumigation: "tradeDocuments.manage",
  phyto: "tradeDocuments.manage",
  certificateOfOrigin: "tradeDocuments.manage",
  deliveryNote: "packing.update",
  other: "orders.updateDraft",
};

/**
 * The export document set and its deadlines (Director, 2026-09-14): INV and
 * PKL must exist 2–3 weeks before the goods leave, kept as 21 days before the
 * booking date; the declaration before loading; B/L,
 * fumigation, phyto and C/O within a week of loading or as soon as the
 * vessel sails.
 */
export type TradeDocumentRule = {
  readonly kind: OrderDocumentKind;
  readonly phase: "beforeShipment" | "afterShipment";
  readonly ownerRole: SystemRoleKey;
  /** Days before the booking date (before) or after dispatch (after). */
  readonly days: number;
  /** Required to leave the stage that produces it. */
  readonly required: boolean;
};

export const tradeDocumentRules: readonly TradeDocumentRule[] = [
  {
    kind: "invoice",
    phase: "beforeShipment",
    ownerRole: "FACTORY_ACCOUNTANT",
    days: 21,
    required: true,
  },
  {
    kind: "packingList",
    phase: "beforeShipment",
    ownerRole: "FACTORY_ACCOUNTANT",
    days: 21,
    required: true,
  },
  {
    kind: "label",
    phase: "beforeShipment",
    ownerRole: "FACTORY_ACCOUNTANT",
    days: 21,
    required: false,
  },
  {
    kind: "customsDeclaration",
    phase: "beforeShipment",
    ownerRole: "COMPANY_ACCOUNTANT",
    days: 0,
    required: true,
  },
  {
    kind: "billOfLading",
    phase: "afterShipment",
    ownerRole: "COMPANY_ACCOUNTANT",
    days: 7,
    required: false,
  },
  {
    kind: "fumigation",
    phase: "afterShipment",
    ownerRole: "COMPANY_ACCOUNTANT",
    days: 7,
    required: false,
  },
  {
    kind: "phyto",
    phase: "afterShipment",
    ownerRole: "COMPANY_ACCOUNTANT",
    days: 7,
    required: false,
  },
  {
    kind: "certificateOfOrigin",
    phase: "afterShipment",
    ownerRole: "COMPANY_ACCOUNTANT",
    days: 7,
    required: false,
  },
];

/** Who approved which company label proof, and when. */
export type OrderLabelApproval = {
  documentId: string;
  approvedBy: string;
  approvedAt: Date;
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
  lineItems: readonly OrderLineItem[];
  /** Shipping mark printed on the cartons. */
  shippingMark: string | null;
  /** Delivery date promised to the customer; the on-time target of the order. */
  deliveryDueAt: Date | null;
  /** Order-specific targets (defect rate, waste…), set per order. */
  targets: string | null;
  productionPlan: OrderProductionPlan | null;
  /** Current workshop stage while the order is in production. */
  productionStage: ProductionStage | null;
  qcChecks: readonly OrderQcCheck[];
  packingRecord: OrderPackingRecord | null;
  documents: readonly OrderDocument[];
  /**
   * The Director's approval of one company label proof (`labelProof`). Tied
   * to that document: a newer proof is not approved by it, and removing the
   * approved file clears it.
   */
  labelApproval: OrderLabelApproval | null;
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

export type NewOrderLineItem = Omit<OrderLineItem, "id">;

export type NewOrderRecord = {
  orderCode: string;
  customerId: string;
  customerName: string;
  businessUnitIds: readonly string[];
  sellingPrice: OrderSellingPrice | null;
  lineItems: readonly NewOrderLineItem[];
  shippingMark: string | null;
  deliveryDueAt: Date | null;
  targets: string | null;
  notes: string | null;
  createdBy: string;
};

export type OrderTransitionWrite = {
  orderId: string;
  expectedRevision: number;
  to: OrderStage;
  qcPassed: boolean;
  /** Set when entering production for the first time; otherwise unchanged. */
  productionStage?: ProductionStage | null;
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

export type OrderDetailsWrite = {
  orderId: string;
  expectedRevision: number;
  shippingMark: string | null;
  deliveryDueAt: Date | null;
  targets: string | null;
  updatedBy: string;
};

export type NewOrderPaymentDocument = Omit<OrderPaymentDocument, "id">;
export type NewOrderDocument = Omit<OrderDocument, "id">;
export type NewOrderQcCheck = Omit<OrderQcCheck, "id">;

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
  setSellingPrice(input: {
    orderId: string;
    expectedRevision: number;
    sellingPrice: OrderSellingPrice;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setLineItems(input: {
    orderId: string;
    expectedRevision: number;
    lineItems: readonly NewOrderLineItem[];
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setDetails(input: OrderDetailsWrite): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setProductionPlan(input: {
    orderId: string;
    expectedRevision: number;
    plan: OrderProductionPlan;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setProductionStage(input: {
    orderId: string;
    expectedRevision: number;
    productionStage: ProductionStage;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /**
   * Appends an inspection; `qcPassed` is set alongside when the caller says
   * so. Conditional on the revision; null means the record moved on.
   */
  addQcCheck(input: {
    orderId: string;
    expectedRevision: number;
    check: NewOrderQcCheck;
    qcPassed: boolean;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setPackingRecord(input: {
    orderId: string;
    expectedRevision: number;
    record: OrderPackingRecord;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  setExportProgress(
    input: OrderExportProgressWrite,
  ): Promise<OrderRecordDto | null>;
  /** Conditional on the revision; null means the record moved on. */
  addDocument(input: {
    orderId: string;
    expectedRevision: number;
    document: NewOrderDocument;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /**
   * Removes a file; when it is the approved label proof the approval is
   * cleared in the same write. Conditional on the revision; null means the
   * record moved on.
   */
  removeDocument(input: {
    orderId: string;
    expectedRevision: number;
    documentId: string;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
  /**
   * Records the Director's approval of a label proof that is still on file.
   * Conditional on the revision; null means the record moved on.
   */
  setLabelApproval(input: {
    orderId: string;
    expectedRevision: number;
    approval: OrderLabelApproval;
    updatedBy: string;
  }): Promise<OrderRecordDto | null>;
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
  "WOODWORK_NOT_PASSED",
  "SELF_APPROVAL",
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

/** A blank text field means "not set". */
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

/** Whole pieces; blank means unknown. */
const optionalCount = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)])
  .nullable()
  .default(null)
  .transform((value) => (typeof value === "number" ? value : null));

const quantitySchema = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,3})?$/, "Quantity must be a number.");

export const lineItemInputSchema = z.object({
  productCode: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  quantity: quantitySchema,
  unit: z.string().trim().max(20).default("cái"),
  facilityName: optionalText(150),
  note: optionalText(500),
});

export type LineItemInput = z.infer<typeof lineItemInputSchema>;

export const lineItemsInputSchema = z.array(lineItemInputSchema).max(200);

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
  lineItems: lineItemsInputSchema.default([]),
  shippingMark: optionalText(500),
  deliveryDueAt: optionalDate,
  targets: optionalText(2_000),
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

export const setLineItemsInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  lineItems: lineItemsInputSchema,
});

export const orderDetailsInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  shippingMark: optionalText(500),
  deliveryDueAt: optionalDate,
  targets: optionalText(2_000),
});

export const productionPlanInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  woodworkDue: optionalDate,
  lacquerDue: optionalDate,
  finishingDue: optionalDate,
  packingDue: optionalDate,
  shipDue: optionalDate,
  assignment: optionalText(2_000),
  note: optionalText(2_000),
});

export const productionStageInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  productionStage: z.enum(productionStages),
});

export const qcCheckInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  checkpoint: z.enum(qcCheckpoints),
  result: z.enum(qcResults),
  defectCount: optionalCount,
  note: optionalText(2_000),
});

export const packingRecordInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  packedAt: optionalDate,
  cartons: optionalCount,
  pallets: optionalCount,
  containerNumber: optionalText(60),
  note: optionalText(2_000),
});

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

const storedDocumentFields = {
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
};

export const paymentDocumentInputSchema = z.object(storedDocumentFields);

export type PaymentDocumentInput = z.infer<typeof paymentDocumentInputSchema>;

export const orderDocumentInputSchema = z.object({
  ...storedDocumentFields,
  kind: z.enum(orderDocumentKinds),
});

export type OrderDocumentInput = z.infer<typeof orderDocumentInputSchema>;

export const approveLabelProofInputSchema = z.object({
  orderId: objectIdSchema,
  expectedRevision: z.coerce.number().int().min(0),
  documentId: objectIdSchema,
});

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

/** The most recent inspection at a checkpoint, or null. */
export function latestQcCheck(
  checks: readonly OrderQcCheck[],
  checkpoint: QcCheckpoint,
): OrderQcCheck | null {
  let latest: OrderQcCheck | null = null;
  for (const check of checks) {
    if (check.checkpoint !== checkpoint) continue;
    if (!latest || check.at.getTime() >= latest.at.getTime()) latest = check;
  }
  return latest;
}

export function hasDocument(
  documents: readonly OrderDocument[],
  kind: OrderDocumentKind,
): boolean {
  return documents.some((document) => document.kind === kind);
}

/** The most recently uploaded file of a kind, or null. */
export function latestDocument(
  documents: readonly OrderDocument[],
  kind: OrderDocumentKind,
): OrderDocument | null {
  let latest: OrderDocument | null = null;
  for (const document of documents) {
    if (document.kind !== kind) continue;
    if (
      !latest ||
      document.uploadedAt.getTime() >= latest.uploadedAt.getTime()
    ) {
      latest = document;
    }
  }
  return latest;
}

export type LabelStatus =
  /** The customer supplied the template; nothing to approve. */
  | { kind: "customerSpec" }
  /** A company proof is approved and still on file. */
  | { kind: "proofApproved"; approval: OrderLabelApproval }
  /** A company proof waits for the Director; `proof` is the newest one. */
  | { kind: "proofPending"; proof: OrderDocument }
  /** Neither a customer spec nor a company proof is on file. */
  | { kind: "missing" };

/**
 * Where the order's labels and shipping marks stand (Director, 2026-09-14):
 * the customer's template is used as given; without one the company's own
 * proof prints only after the Director approves it. The approval counts only
 * while the approved file is still on file as a `labelProof`.
 */
export function labelStatus(
  order: Pick<OrderRecordDto, "documents" | "labelApproval">,
): LabelStatus {
  if (hasDocument(order.documents, "customerLabelSpec")) {
    return { kind: "customerSpec" };
  }
  // Only the newest proof is the one that prints: an approval of an older
  // file does not cover a proof uploaded after it.
  const proof = latestDocument(order.documents, "labelProof");
  if (!proof) return { kind: "missing" };
  const approval = order.labelApproval;
  if (approval && approval.documentId === proof.id) {
    return { kind: "proofApproved", approval };
  }
  return { kind: "proofPending", proof };
}

/** What the record has on file, as `assertTransition` judges it. */
export function orderReadiness(
  order: Pick<
    OrderRecordDto,
    | "productionPlan"
    | "productionStage"
    | "qcChecks"
    | "packingRecord"
    | "documents"
    | "labelApproval"
  >,
): OrderReadiness {
  const labels = labelStatus(order).kind;
  return {
    ...emptyReadiness,
    planned: order.productionPlan !== null,
    productionComplete: order.productionStage === "finishing",
    packingReady:
      order.packingRecord !== null &&
      latestQcCheck(order.qcChecks, "packing")?.result === "pass",
    labelsReady: labels === "customerSpec" || labels === "proofApproved",
    exportDocumentsReady:
      hasDocument(order.documents, "invoice") &&
      hasDocument(order.documents, "packingList"),
    customsDeclared: hasDocument(order.documents, "customsDeclaration"),
  };
}

/** When the order entered its current stage. */
export function stageEnteredAt(
  order: Pick<OrderRecordDto, "stageHistory" | "createdAt">,
): Date {
  const last = order.stageHistory[order.stageHistory.length - 1];
  return last ? last.at : order.createdAt;
}

/** When the goods left (the move out of dispatch), or null. */
export function dispatchedAt(
  order: Pick<OrderRecordDto, "stageHistory">,
): Date | null {
  for (let index = order.stageHistory.length - 1; index >= 0; index -= 1) {
    const entry = order.stageHistory[index]!;
    if (entry.from === "shipped" && entry.to === "invoiced") return entry.at;
  }
  return null;
}

const DAY_MS = 86_400_000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export type TradeDocumentStatus = TradeDocumentRule & {
  readonly present: boolean;
  /** Null until the booking (before) or dispatch (after) date is known. */
  readonly dueAt: Date | null;
  readonly overdue: boolean;
};

/**
 * The export document checklist with each deadline resolved against the
 * order's booking and dispatch dates. Overdue only ever applies to a file
 * still missing.
 */
export function tradeDocumentStatuses(
  order: Pick<OrderRecordDto, "documents" | "bookingDate" | "stageHistory">,
  now: Date,
): TradeDocumentStatus[] {
  const shippedAt = dispatchedAt(order);
  return tradeDocumentRules.map((rule) => {
    const present = hasDocument(order.documents, rule.kind);
    const anchor =
      rule.phase === "beforeShipment"
        ? order.bookingDate
        : (shippedAt ?? order.bookingDate);
    const dueAt = anchor
      ? addDays(
          anchor,
          rule.phase === "beforeShipment" ? -rule.days : rule.days,
        )
      : null;
    return {
      ...rule,
      present,
      dueAt,
      overdue: !present && dueAt !== null && dueAt.getTime() < now.getTime(),
    };
  });
}

/** Sum of the line quantities, for the defect rate; null when no lines. */
export function totalQuantity(
  lineItems: readonly OrderLineItem[],
): number | null {
  if (lineItems.length === 0) return null;
  return lineItems.reduce((total, line) => total + Number(line.quantity), 0);
}

/**
 * Defective pieces across the latest inspection at each checkpoint, over the
 * ordered quantity. Null when nothing can be computed yet.
 */
export function defectRate(
  order: Pick<OrderRecordDto, "lineItems" | "qcChecks">,
): { defects: number; quantity: number; ratio: number } | null {
  const quantity = totalQuantity(order.lineItems);
  if (!quantity) return null;
  let defects = 0;
  let counted = false;
  for (const checkpoint of qcCheckpoints) {
    const latest = latestQcCheck(order.qcChecks, checkpoint);
    if (latest?.defectCount != null) {
      defects += latest.defectCount;
      counted = true;
    }
  }
  if (!counted) return null;
  return { defects, quantity, ratio: defects / quantity };
}

/**
 * Whether the goods left by the promised date: null until they leave or the
 * promise is missing; otherwise the number of days late (0 or negative = on
 * time).
 */
export function deliveryLateness(
  order: Pick<OrderRecordDto, "deliveryDueAt" | "stageHistory">,
): number | null {
  const shippedAt = dispatchedAt(order);
  if (!shippedAt || !order.deliveryDueAt) return null;
  return Math.ceil(
    (shippedAt.getTime() - order.deliveryDueAt.getTime()) / DAY_MS,
  );
}
