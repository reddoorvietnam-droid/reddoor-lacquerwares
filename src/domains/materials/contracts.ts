import Decimal from "decimal.js";
import { z } from "zod";

/**
 * Raw-material inventory ("Nguyên vật liệu"): shared contracts for the server
 * service, the API routes and the browser grid. Everything here is pure —
 * no database, no session — so the same rules run on both sides.
 *
 * Business rules carried over from `RedDoor - NVL - 2026.xlsx`:
 *   Tồn cuối = Tồn đầu + Σ nhập − Σ xuất (+ Σ điều chỉnh)
 *   Vật tư / ĐVT / Tên cơ sở come from the master data by code; Excel resolved
 *   them with case-insensitive VLOOKUP, so codes compare through `codeKey`.
 *   Thành tiền = Số lượng × Đơn giá, recomputed by the server.
 */

export const transactionTypes = ["INBOUND", "OUTBOUND", "ADJUSTMENT"] as const;
export type TransactionType = (typeof transactionTypes)[number];
export const transactionStatuses = ["POSTED", "CANCELLED"] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];

export const defaultDescription: Record<TransactionType, string> = {
  INBOUND: "nhập kho",
  OUTBOUND: "xuất kho",
  ADJUSTMENT: "điều chỉnh",
};

/** Excel VLOOKUP/SUMIF matching: trimmed, case-insensitive. */
export const codeKey = (code: string) => code.trim().toLocaleLowerCase("en-US");

export const idSchema = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng dd/MM/yyyy")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Ngày không hợp lệ");

const decimalPattern = /^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/;

/** Canonical non-negative decimal string: no exponent, at most 8 decimals. */
export const decimalSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/,
    "Nhập số không âm, tối đa 8 chữ số thập phân",
  )
  .transform((value) => new Decimal(value).toFixed());

/** Quantities on nhập/xuất must be strictly positive (negative moves use ADJUSTMENT). */
export const positiveDecimalSchema = decimalSchema.refine(
  (value) => new Decimal(value).gt(0),
  "Số lượng phải lớn hơn 0",
);

/** Signed decimal for adjustments and computed balances. */
export const signedDecimalSchema = z
  .string()
  .trim()
  .regex(decimalPattern, "Số không hợp lệ")
  .transform((value) => new Decimal(value).toFixed());

export const textSchema = (max: number) => z.string().trim().max(max);

// ---------------------------------------------------------------- masters

export type Material = {
  id: string;
  version: number;
  code: string;
  name: string;
  unit: string;
  /** Tồn đầu kỳ 2026 (Tong kho NVL column G). */
  openingQuantity: string;
  /** Optional low-stock threshold; the workbook carries none. */
  minimumStock: string | null;
  note: string;
  active: boolean;
  /** Tong kho NVL row order first, then KhoNVL-only rows, then new rows. */
  sortOrder: number;
  /** True once any transaction (posted or cancelled) references the material; the code is then locked. */
  hasTransactions: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export const materialPatchSchema = z
  .object({
    code: textSchema(150).min(1, "Mã vật tư không được trống"),
    name: textSchema(300),
    unit: textSchema(50),
    openingQuantity: decimalSchema,
    minimumStock: decimalSchema.nullable(),
    note: textSchema(4000),
    active: z.boolean(),
  })
  .partial()
  .strict();
export type MaterialPatch = z.infer<typeof materialPatchSchema>;

export type Facility = {
  id: string;
  version: number;
  code: string;
  name: string;
  /** Cososx column B ("Loại 1", "Loại 2", "Loại 3"); free text. */
  type: string;
  phone: string;
  note: string;
  active: boolean;
  sortOrder: number;
  hasTransactions: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export const facilityPatchSchema = z
  .object({
    code: textSchema(150).min(1, "Mã cơ sở không được trống"),
    name: textSchema(300),
    type: textSchema(50),
    phone: textSchema(50),
    note: textSchema(4000),
    active: z.boolean(),
  })
  .partial()
  .strict();
export type FacilityPatch = z.infer<typeof facilityPatchSchema>;

export type MasterKind = "material" | "facility";

// ---------------------------------------------------------------- transactions

export type MaterialTransaction = {
  id: string;
  version: number;
  type: TransactionType;
  status: TransactionStatus;
  /** Calendar date, `YYYY-MM-DD`; shown as dd/MM/yyyy. */
  transactionDate: string;
  materialId: string;
  /** Snapshots taken when the line was recorded; master-data renames never rewrite history. */
  materialCode: string;
  materialName: string;
  unit: string;
  /** Positive for INBOUND/OUTBOUND, signed for ADJUSTMENT. */
  quantity: string;
  unitPrice: string | null;
  /** quantity × unitPrice, server computed; null while the price is unknown. */
  amount: string | null;
  facilityId: string | null;
  facilityCode: string;
  facilityName: string;
  description: string;
  note: string;
  /** Lines saved in the same request share a batch id (a future phiếu). */
  batchId: string | null;
  /** Excel provenance: workbook name and row, never a business identifier. */
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

export const transactionPatchSchema = z
  .object({
    transactionDate: dateSchema,
    materialCode: textSchema(150),
    facilityCode: textSchema(150),
    quantity: positiveDecimalSchema,
    unitPrice: decimalSchema.nullable(),
    description: textSchema(2000),
    note: textSchema(4000),
  })
  .partial()
  .strict();
export type TransactionPatch = z.infer<typeof transactionPatchSchema>;

export const transactionChangeSchema = z
  .object({
    id: idSchema,
    /** 0 = create; the server compares any other value against the stored row (compare-and-swap). */
    version: z.number().int().min(0),
    type: z.enum(transactionTypes),
    patch: transactionPatchSchema,
  })
  .strict();
export type TransactionChange = z.infer<typeof transactionChangeSchema>;

export const transactionBatchSchema = z
  .object({ changes: z.array(transactionChangeSchema).min(1).max(500) })
  .strict();

export const cancelSchema = z
  .object({
    id: idSchema,
    version: z.number().int().min(1),
    reason: textSchema(2000).optional(),
  })
  .strict();

export const masterChangeSchema = z
  .object({
    id: idSchema,
    version: z.number().int().min(0),
    patch: z.record(z.string(), z.unknown()),
  })
  .strict();
export const masterBatchSchema = z
  .object({
    kind: z.enum(["material", "facility"]),
    changes: z.array(masterChangeSchema).min(1).max(500),
  })
  .strict();

/** Fields the grids may edit; everything else is derived or system-owned. */
export const editableTransactionFields = {
  INBOUND: [
    "transactionDate",
    "materialCode",
    "description",
    "quantity",
    "unitPrice",
    "note",
  ],
  OUTBOUND: [
    "transactionDate",
    "facilityCode",
    "materialCode",
    "description",
    "quantity",
    "note",
  ],
  ADJUSTMENT: [],
} as const satisfies Record<
  TransactionType,
  readonly (keyof TransactionPatch)[]
>;
export type EditableTransactionField = keyof TransactionPatch;

// ---------------------------------------------------------------- summary / balances

export type StockState = "in" | "low" | "out";

export type SummaryRow = {
  materialId: string;
  stt: number;
  code: string;
  name: string;
  unit: string;
  openingQuantity: string;
  inboundQuantity: string;
  outboundQuantity: string;
  adjustmentQuantity: string;
  currentQuantity: string;
  minimumStock: string | null;
  note: string;
  active: boolean;
  state: StockState;
};

export type SummaryKpis = {
  materials: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
};

export type Balance = {
  openingQuantity: string;
  inboundQuantity: string;
  outboundQuantity: string;
  adjustmentQuantity: string;
  currentQuantity: string;
};

export function computeCurrent(
  balance: Omit<Balance, "currentQuantity">,
): string {
  return new Decimal(balance.openingQuantity)
    .add(balance.inboundQuantity)
    .sub(balance.outboundQuantity)
    .add(balance.adjustmentQuantity)
    .toFixed();
}

export function stockState(
  current: string,
  minimumStock: string | null,
): StockState {
  const value = new Decimal(current);
  if (value.lte(0)) return "out";
  if (minimumStock !== null && value.lte(minimumStock)) return "low";
  return "in";
}

/** Signed stock effect of one posted line. */
export function stockDelta(type: TransactionType, quantity: string): Decimal {
  const value = new Decimal(quantity);
  return type === "OUTBOUND" ? value.neg() : value;
}

export type StockDecision = {
  allowed: boolean;
  current: string;
  resulting: string;
  requested: string;
};

/**
 * Xuất kho may never push a balance below zero. A change that does not reduce
 * stock is always allowed, even for a material whose migrated history is
 * already negative — otherwise nothing could ever repair it.
 */
export function decideStock(current: string, delta: Decimal): StockDecision {
  const resulting = new Decimal(current).add(delta);
  return {
    allowed: delta.gte(0) || resulting.gte(0),
    current: new Decimal(current).toFixed(),
    resulting: resulting.toFixed(),
    requested: delta.abs().toFixed(),
  };
}

// ---------------------------------------------------------------- helpers

export class MaterialsError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "MaterialsError";
  }
}

export const multiply = (a: string | null, b: string | null) =>
  a === null || b === null ? null : new Decimal(a).mul(b).toFixed();

export type Lookups = {
  materials: readonly Pick<
    Material,
    "id" | "code" | "name" | "unit" | "active"
  >[];
  facilities: readonly Pick<Facility, "id" | "code" | "name" | "active">[];
};

export function findMaterial(lookups: Lookups, code: string) {
  const wanted = codeKey(code);
  return lookups.materials.find((m) => codeKey(m.code) === wanted) ?? null;
}

export function findFacility(lookups: Lookups, code: string) {
  const wanted = codeKey(code);
  return lookups.facilities.find((f) => codeKey(f.code) === wanted) ?? null;
}

export function emptyTransaction(
  id: string,
  type: TransactionType,
  date: string,
  actor: string,
): MaterialTransaction {
  const now = new Date().toISOString();
  return {
    id,
    version: 0,
    type,
    status: "POSTED",
    transactionDate: date,
    materialId: "",
    materialCode: "",
    materialName: "",
    unit: "",
    quantity: "0",
    unitPrice: null,
    amount: null,
    facilityId: null,
    facilityCode: "",
    facilityName: "",
    description: defaultDescription[type],
    note: "",
    batchId: null,
    migrationSource: null,
    sourceRow: null,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
  };
}

/**
 * Applies an edit the way Excel's VLOOKUPs did: a changed code re-resolves the
 * snapshot columns from master data, an unchanged code keeps history intact.
 * Throws `MaterialsError` for unknown or inactive codes.
 */
export function applyTransactionPatch(
  row: MaterialTransaction,
  patch: TransactionPatch,
  lookups: Lookups,
): MaterialTransaction {
  const next: MaterialTransaction = { ...row };
  if (patch.transactionDate !== undefined)
    next.transactionDate = patch.transactionDate;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.note !== undefined) next.note = patch.note;
  if (patch.quantity !== undefined) next.quantity = patch.quantity;
  if (patch.unitPrice !== undefined) next.unitPrice = patch.unitPrice;
  if (
    patch.materialCode !== undefined &&
    (codeKey(patch.materialCode) !== codeKey(row.materialCode) ||
      !row.materialId)
  ) {
    if (!patch.materialCode.trim()) {
      next.materialId = "";
      next.materialCode = "";
      next.materialName = "";
      next.unit = "";
    } else {
      const material = findMaterial(lookups, patch.materialCode);
      if (!material)
        throw new MaterialsError(
          `Mã vật tư "${patch.materialCode.trim()}" không có trong danh mục.`,
        );
      if (!material.active)
        throw new MaterialsError(`Vật tư "${material.code}" đã ngừng sử dụng.`);
      next.materialId = material.id;
      next.materialCode = material.code;
      next.materialName = material.name;
      next.unit = material.unit;
    }
  }
  if (
    patch.facilityCode !== undefined &&
    (codeKey(patch.facilityCode) !== codeKey(row.facilityCode) ||
      !row.facilityId)
  ) {
    if (!patch.facilityCode.trim()) {
      next.facilityId = null;
      next.facilityCode = "";
      next.facilityName = "";
    } else {
      const facility = findFacility(lookups, patch.facilityCode);
      if (!facility)
        throw new MaterialsError(
          `Mã cơ sở SX "${patch.facilityCode.trim()}" không có trong danh mục.`,
        );
      if (!facility.active)
        throw new MaterialsError(`Cơ sở "${facility.code}" đã ngừng sử dụng.`);
      next.facilityId = facility.id;
      next.facilityCode = facility.code;
      next.facilityName = facility.name;
    }
  }
  next.amount = multiply(next.quantity, next.unitPrice);
  return next;
}

/** Whether a line has everything the ledger needs before it may be saved. */
export function transactionCompleteness(
  row: MaterialTransaction,
): string | null {
  if (!row.materialId) return "Chưa chọn mã vật tư";
  if (!new Decimal(row.quantity || 0).gt(0) && row.type !== "ADJUSTMENT")
    return "Số lượng phải lớn hơn 0";
  if (row.type === "OUTBOUND" && !row.facilityId)
    return "Chưa chọn cơ sở / người nhận";
  return null;
}

/** Clipboard and cell-editor text → patch value. Numbers follow Excel display: 1,234.5 */
export function parseCell(
  field: EditableTransactionField,
  text: string,
): string | null {
  const value = text.trim();
  if (field === "transactionDate") return parseDisplayDate(value);
  if (field === "quantity" || field === "unitPrice") {
    if (!value) return field === "unitPrice" ? null : "0";
    if (value.includes(",") && !/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(value))
      throw new MaterialsError(
        "Dùng dấu chấm cho số thập phân (ví dụ 0.3); dấu phẩy chỉ phân cách hàng nghìn.",
      );
    return decimalSchema.parse(value.replaceAll(",", ""));
  }
  return text;
}

export function parseDisplayDate(value: string): string {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim());
  return dateSchema.parse(
    match
      ? `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`
      : value.trim(),
  );
}

export function displayDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * Thousands grouping with a dot decimal, no forced ".00" — 3280 → "3,280",
 * 212898.6 → "212,898.6". Binary float tails never reach here because every
 * value is a canonical decimal string.
 */
export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const number = new Decimal(value);
  const [integer, fraction] = number.toFixed().split(".");
  const sign = integer!.startsWith("-") ? "-" : "";
  const grouped = integer!
    .replace("-", "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/** Today's calendar date in the business time zone (Asia/Ho_Chi_Minh). */
export function todayInBusinessZone(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// ---------------------------------------------------------------- API payloads

export const capabilityActions = [
  "read",
  "manageCatalog",
  "receive",
  "issue",
  "cancel",
  "export",
  "import",
] as const;
export type MaterialsAction = (typeof capabilityActions)[number];
export type Capabilities = Record<MaterialsAction, boolean>;

export type MastersResponse = {
  materials: Material[];
  facilities: Facility[];
  capabilities: Capabilities;
};

export type SummaryResponse = {
  rows: SummaryRow[];
  kpis: SummaryKpis;
  generatedAt: string;
};

export type TransactionListResponse = {
  rows: MaterialTransaction[];
  total: number;
  nextOffset: number | null;
  /** Display names for the `updatedBy` user ids on this page. */
  actorNames: Record<string, string>;
};

export type TimelineEntry = MaterialTransaction & {
  /** Balance after this line, in ledger order. */
  balanceAfter: string;
};

export type HistoryEntry = {
  id: string;
  action: string;
  actor: string;
  actorName: string;
  occurredAt: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
};

/** `GET /api/materials/history`: warehouse-wide audit page plus header counts. */
export type HistoryListResponse = {
  /** Newest first, resourceType "materials", any action. */
  entries: HistoryEntry[];
  total: number;
  nextOffset: number | null;
  /** Posted transactions (for the page header). */
  transactions: number;
  lastActivity: {
    occurredAt: string;
    actorName: string;
    action: string;
  } | null;
};

export type MaterialDetailResponse = {
  material: Material;
  balance: Balance;
  state: StockState;
  timeline: TimelineEntry[];
  timelineTotal: number;
  nextOffset: number | null;
  history: HistoryEntry[];
};

export type ImportRowStatus =
  | "valid"
  | "invalid"
  | "duplicate"
  | "already-imported"
  | "unknown-material"
  | "unknown-facility";

export type ImportPreviewRow = {
  sheet: "ChiTietNhapNVL" | "ChiTietxuatNVL";
  row: number;
  type: TransactionType;
  status: ImportRowStatus;
  message: string | null;
  transactionDate: string | null;
  materialCode: string;
  facilityCode: string;
  quantity: string | null;
  unitPrice: string | null;
  note: string;
};

export type ImportPreview = {
  hash: string;
  fileName: string;
  rows: ImportPreviewRow[];
  counts: Record<ImportRowStatus, number>;
};

export type ImportResult = {
  hash: string;
  imported: number;
  skipped: number;
  batchId: string;
};

export const exportScopes = ["all", "summary", "inbound", "outbound"] as const;
export type ExportScope = (typeof exportScopes)[number];
