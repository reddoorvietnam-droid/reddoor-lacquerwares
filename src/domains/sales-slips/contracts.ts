import Decimal from "decimal.js";
import { z } from "zod";
import { vndInWords } from "@/lib/money/vietnamese-words";

/**
 * Phiếu bán hàng ("Hóa đơn bán hàng" in the menu): shared contracts for the
 * server service, the API routes, the editor and the print renderers.
 * Everything here is pure — no database, no session — so the same rules run
 * on both sides.
 *
 * Business rules carried over from `08092026.xlsx` (sheet `HOADONMAU`):
 *   Vật tư / ĐVT / Giá come from the paint catalogue by code (Excel:
 *   VLOOKUP into `khoson`, case-insensitive) and are SNAPSHOTTED on the line.
 *   Thành tiền = Số lượng × Giá; Tổng tiền = Σ Thành tiền;
 *   Tổng cộng tiền thanh toán = Tổng tiền (no VAT, discount or fee on the form).
 *   The catalogue price is only the default at the time the line is entered.
 *
 * This is an internal sales slip, not a VAT e-invoice: no tax code, serial,
 * template number or tax-authority code exists here on purpose.
 */

export const salesSlipStatuses = ["DRAFT", "CONFIRMED", "CANCELLED"] as const;
export type SalesSlipStatus = (typeof salesSlipStatuses)[number];
export const statusLabels: Record<SalesSlipStatus, string> = {
  DRAFT: "Nháp",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
};

export const sourceTypes = ["WEB", "MIGRATION"] as const;
export type SourceType = (typeof sourceTypes)[number];

/** Excel VLOOKUP matching: trimmed, case-insensitive. */
export const codeKey = (code: string) => code.trim().toLocaleLowerCase("en-US");
/** Recipient name matching for migration: trimmed, lower-cased, one space. */
export const nameKey = (name: string) =>
  name.trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");

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

/** Canonical non-negative decimal string: no exponent, at most 8 decimals. */
export const decimalSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/,
    "Nhập số không âm, tối đa 8 chữ số thập phân",
  )
  .transform((value) => new Decimal(value).toFixed());

export const textSchema = (max: number) => z.string().trim().max(max);

export class SalesSlipError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "SalesSlipError";
  }
}

// ---------------------------------------------------------------- masters

/** Catalogue item: the paint-warehouse material master plus its sale price. */
export type SalesItem = {
  id: string;
  code: string;
  name: string;
  unit: string;
  /** Default "Giá" for a new line; null when the catalogue carries none. */
  salePrice: string | null;
};

/** Recipient ("Người nhận hàng"): the paint-warehouse facility master. */
export type SalesRecipient = {
  id: string;
  code: string;
  name: string;
};

export type Masters = {
  items: readonly SalesItem[];
  recipients: readonly SalesRecipient[];
};

export const findItem = (masters: Masters, code: string) =>
  masters.items.find((item) => codeKey(item.code) === codeKey(code)) ?? null;
export const findRecipient = (masters: Masters, code: string) =>
  masters.recipients.find((r) => codeKey(r.code) === codeKey(code)) ?? null;

// ---------------------------------------------------------------- records

export type SalesSlipLine = {
  id: string;
  lineNumber: number;
  /** Catalogue id, null when the code was unknown (migrated slips only). */
  itemId: string | null;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: string | null;
  /** Snapshot: the price this slip was written with, never re-read later. */
  unitPrice: string | null;
  lineAmount: string | null;
  /** True when a person typed the price instead of taking the catalogue default. */
  priceManual: boolean;
};

export type SalesSlip = {
  id: string;
  version: number;
  /** `PBH-yyyyMMdd-nnn`, an internal reference; null for migrated slips. */
  internalNumber: string | null;
  slipDate: string;
  recipientId: string | null;
  recipientCode: string;
  recipientName: string;
  recipientUnit: string;
  content: string;
  lines: SalesSlipLine[];
  subtotal: string | null;
  totalPayment: string | null;
  totalInWords: string | null;
  status: SalesSlipStatus;
  note: string;
  sourceType: SourceType;
  migrationSource: string | null;
  migrationSheet: string | null;
  migrationIssues: string[];
  /** Reserved for a future stock-issue link; never set by this module. */
  linkedInventoryDocumentId: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  /** Set by the server when the reader may not see money. */
  pricesRedacted?: boolean;
};

export const capabilityActions = [
  "read",
  "create",
  "update",
  "confirm",
  "cancel",
  "readPrice",
  "editPrice",
  "print",
  "export",
  "import",
] as const;
export type SalesSlipAction = (typeof capabilityActions)[number];
export type Capabilities = Record<SalesSlipAction, boolean>;
export const noCapabilities: Capabilities = {
  read: false,
  create: false,
  update: false,
  confirm: false,
  cancel: false,
  readPrice: false,
  editPrice: false,
  print: false,
  export: false,
  import: false,
};

// ---------------------------------------------------------------- inputs

export const lineInputSchema = z
  .object({
    id: idSchema,
    itemCode: textSchema(150),
    quantity: decimalSchema.nullable(),
    /** Omitted = leave the price alone; only `editPrice` may change it. */
    unitPrice: decimalSchema.nullable().optional(),
  })
  .strict();
export type LineInput = z.infer<typeof lineInputSchema>;

export const draftInputSchema = z
  .object({
    slipDate: dateSchema,
    /** Catalogue code when picked from the list; empty for a typed name. */
    recipientCode: textSchema(150),
    recipientName: textSchema(240),
    recipientUnit: textSchema(240),
    content: textSchema(2000),
    note: textSchema(4000),
    lines: z.array(lineInputSchema).max(500),
  })
  .strict();
export type DraftInput = z.infer<typeof draftInputSchema>;

export const createSchema = z
  .object({ id: idSchema, draft: draftInputSchema })
  .strict();
export const updateSchema = z
  .object({ version: z.number().int().min(0), draft: draftInputSchema })
  .strict();
export const transitionActions = ["confirm", "reopen", "cancel"] as const;
export type TransitionAction = (typeof transitionActions)[number];
export const transitionSchema = z
  .object({
    action: z.enum(transitionActions),
    version: z.number().int().min(0),
    reason: textSchema(2000).optional(),
  })
  .strict();

export const sortOptions = [
  "newest",
  "oldest",
  "dateDesc",
  "dateAsc",
  "totalDesc",
  "totalAsc",
] as const;
export type SortOption = (typeof sortOptions)[number];

export type ListResponse = {
  slips: SalesSlip[];
  total: number;
  nextOffset: number | null;
  /** Display names by user id for `createdBy` / `updatedBy`. */
  people: Record<string, string>;
};

export type MastersResponse = Masters & { capabilities: Capabilities };

export type HistoryEntry = {
  id: string;
  action: string;
  actorName: string;
  occurredAt: string;
  reason: string | null;
  changes: string[];
};

// ---------------------------------------------------------------- arithmetic

export const multiply = (a: string | null, b: string | null) =>
  a === null || b === null ? null : new Decimal(a).mul(b).toFixed();

const sameDecimal = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : new Decimal(a).eq(b);

function computeTotals(lines: readonly SalesSlipLine[]) {
  const amounts = lines.flatMap((line) =>
    line.lineAmount === null ? [] : [line.lineAmount],
  );
  if (lines.length === 0 || amounts.length === 0)
    return { subtotal: null, totalPayment: null, totalInWords: null };
  const subtotal = amounts
    .reduce((sum, amount) => sum.add(amount), new Decimal(0))
    .toFixed();
  return {
    subtotal,
    totalPayment: subtotal,
    totalInWords: vndInWords(subtotal),
  };
}

export function emptySlip(id: string, date: string, actor: string): SalesSlip {
  const now = new Date().toISOString();
  return {
    id,
    version: 0,
    internalNumber: null,
    slipDate: date,
    recipientId: null,
    recipientCode: "",
    recipientName: "",
    recipientUnit: "",
    content: "",
    lines: [],
    subtotal: null,
    totalPayment: null,
    totalInWords: null,
    status: "DRAFT",
    note: "",
    sourceType: "WEB",
    migrationSource: null,
    migrationSheet: null,
    migrationIssues: [],
    linkedInventoryDocumentId: null,
    confirmedAt: null,
    confirmedBy: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: now,
    createdBy: actor,
    updatedAt: now,
    updatedBy: actor,
  };
}

export type ApplyOptions = { canEditPrice: boolean };

/**
 * Applies a draft to a slip: resolves codes through the catalogue, snapshots
 * name / unit / price on new or re-coded lines, keeps the snapshot on
 * untouched lines, and recomputes every amount. Prices sent by the client are
 * only honoured for a holder of `editPrice`.
 */
export function applyDraft(
  base: SalesSlip,
  input: DraftInput,
  masters: Masters,
  options: ApplyOptions,
): SalesSlip {
  const next: SalesSlip = {
    ...base,
    slipDate: input.slipDate,
    recipientUnit: input.recipientUnit,
    content: input.content,
    note: input.note,
  };
  const recipientCode = input.recipientCode.trim();
  if (recipientCode) {
    const recipient = findRecipient(masters, recipientCode);
    if (!recipient)
      throw new SalesSlipError("Mã người nhận không có trong danh mục.");
    next.recipientId = recipient.id;
    next.recipientCode = recipient.code;
    next.recipientName = input.recipientName.trim() || recipient.name;
  } else {
    next.recipientId = null;
    next.recipientCode = "";
    next.recipientName = input.recipientName.trim();
  }
  const previous = new Map(base.lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const lines: SalesSlipLine[] = [];
  for (const entry of input.lines) {
    if (seen.has(entry.id))
      throw new SalesSlipError("Dòng bị lặp trong yêu cầu.");
    seen.add(entry.id);
    const itemCode = entry.itemCode.trim();
    const priceGiven =
      entry.unitPrice !== undefined && entry.unitPrice !== null;
    if (!itemCode && entry.quantity === null && !priceGiven) continue;
    const before = previous.get(entry.id) ?? null;
    const sameCode =
      before !== null && codeKey(before.itemCode) === codeKey(itemCode);
    const item = itemCode ? findItem(masters, itemCode) : null;
    const line: SalesSlipLine = {
      id: entry.id,
      lineNumber: lines.length + 1,
      itemId: item?.id ?? null,
      itemCode: item?.code ?? itemCode,
      itemName: item?.name ?? (sameCode && before ? before.itemName : ""),
      unit: item?.unit ?? (sameCode && before ? before.unit : ""),
      quantity: entry.quantity,
      unitPrice:
        sameCode && before ? before.unitPrice : (item?.salePrice ?? null),
      lineAmount: null,
      priceManual: sameCode && before ? before.priceManual : false,
    };
    if (
      entry.unitPrice !== undefined &&
      !sameDecimal(entry.unitPrice, line.unitPrice)
    ) {
      if (!options.canEditPrice)
        throw new SalesSlipError("Bạn không có quyền sửa đơn giá.", 403);
      line.unitPrice = entry.unitPrice;
      line.priceManual =
        entry.unitPrice !== null &&
        !sameDecimal(entry.unitPrice, item?.salePrice ?? null);
    }
    line.lineAmount = multiply(line.quantity, line.unitPrice);
    lines.push(line);
  }
  next.lines = lines;
  Object.assign(next, computeTotals(lines));
  return next;
}

/** Everything that stops a draft from being confirmed; empty when it may be. */
export function confirmProblems(slip: SalesSlip): string[] {
  const problems: string[] = [];
  if (!slip.recipientName.trim()) problems.push("Chưa nhập người nhận hàng.");
  if (slip.lines.length === 0) problems.push("Phiếu chưa có mặt hàng nào.");
  for (const line of slip.lines) {
    const issues: string[] = [];
    if (!line.itemCode) issues.push("chưa chọn mã vật tư");
    else if (line.itemId === null)
      issues.push(`mã vật tư '${line.itemCode}' không có trong danh mục`);
    if (line.quantity === null || !new Decimal(line.quantity).gt(0))
      issues.push("số lượng phải lớn hơn 0");
    if (line.unitPrice === null) issues.push("chưa có đơn giá");
    if (issues.length)
      problems.push(`Dòng ${line.lineNumber}: ${issues.join("; ")}.`);
  }
  return problems;
}

/** Codes that appear on more than one line — a warning, never a merge. */
export function duplicateCodes(lines: readonly SalesSlipLine[]): string[] {
  const counts = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const line of lines) {
    const key = codeKey(line.itemCode);
    if (!key) continue;
    if (counts.has(key)) duplicates.add(counts.get(key)!);
    else counts.set(key, line.itemCode);
  }
  return [...duplicates];
}

/** The projection a reader without `readPrice` receives. */
export function redactPrices(slip: SalesSlip): SalesSlip {
  return {
    ...slip,
    lines: slip.lines.map((line) => ({
      ...line,
      unitPrice: null,
      lineAmount: null,
      priceManual: false,
    })),
    subtotal: null,
    totalPayment: null,
    totalInWords: null,
    pricesRedacted: true,
  };
}

// ---------------------------------------------------------------- display

/** Excel `#,##0`: rounded half-up to whole đồng, comma-grouped. */
export function formatVnd(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return new Decimal(value)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Excel `General` for a quantity: exact decimals, comma-grouped integer part. */
export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const [integer, fraction] = new Decimal(value).toFixed().split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** `2026-09-08` → `08/09/2026`. */
export const displayDate = (date: string) =>
  date.split("-").reverse().join("/");

/** Row 5 of the form, spaced exactly as the template types it. */
export function slipDateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return `Ngày   ${day}   Tháng   ${month}    năm ${year}`;
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

/** Wall-clock parts of an instant in the business time zone. */
export function businessZoneParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

/** Row 3 of the form: Excel `m/d/yy h:mm` of the moment the slip was created. */
export function excelTimestamp(iso: string): string {
  const { year, month, day, hour, minute } = businessZoneParts(iso);
  return `${month}/${day}/${String(year).slice(-2)} ${hour}:${String(minute).padStart(2, "0")}`;
}

export const internalNumberFor = (date: string, sequence: number) =>
  `PBH-${date.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`;

/** Human-readable audit lines: what changed between two drafts. */
export function describeChanges(before: SalesSlip, after: SalesSlip): string[] {
  const changes: string[] = [];
  if (before.slipDate !== after.slipDate)
    changes.push(
      `Ngày: ${displayDate(before.slipDate)} → ${displayDate(after.slipDate)}`,
    );
  if (
    before.recipientName !== after.recipientName ||
    before.recipientCode !== after.recipientCode
  )
    changes.push(
      `Người nhận: ${before.recipientName || "(trống)"} → ${after.recipientName || "(trống)"}`,
    );
  if (before.recipientUnit !== after.recipientUnit)
    changes.push(
      `Đơn vị: ${before.recipientUnit || "(trống)"} → ${after.recipientUnit || "(trống)"}`,
    );
  if (before.content !== after.content)
    changes.push(
      `Nội dung: ${before.content || "(trống)"} → ${after.content || "(trống)"}`,
    );
  if (before.note !== after.note) changes.push("Ghi chú đã thay đổi");
  const previous = new Map(before.lines.map((line) => [line.id, line]));
  const kept = new Set<string>();
  for (const line of after.lines) {
    const old = previous.get(line.id);
    const label = line.itemCode || `dòng ${line.lineNumber}`;
    if (!old) {
      changes.push(
        `Thêm mặt hàng ${label} × ${formatQuantity(line.quantity) || "?"}${line.unitPrice !== null ? ` @ ${formatVnd(line.unitPrice)}` : ""}`,
      );
      continue;
    }
    kept.add(line.id);
    if (codeKey(old.itemCode) !== codeKey(line.itemCode))
      changes.push(
        `Mã vật tư dòng ${line.lineNumber}: ${old.itemCode || "(trống)"} → ${line.itemCode || "(trống)"}`,
      );
    if (!sameDecimal(old.quantity, line.quantity))
      changes.push(
        `Số lượng ${label}: ${formatQuantity(old.quantity) || "(trống)"} → ${formatQuantity(line.quantity) || "(trống)"}`,
      );
    if (!sameDecimal(old.unitPrice, line.unitPrice))
      changes.push(
        `Đơn giá ${label}: ${formatVnd(old.unitPrice) || "(trống)"} → ${formatVnd(line.unitPrice) || "(trống)"}`,
      );
  }
  for (const old of before.lines)
    if (!kept.has(old.id))
      changes.push(`Xóa mặt hàng ${old.itemCode || `dòng ${old.lineNumber}`}`);
  if (!sameDecimal(before.subtotal, after.subtotal))
    changes.push(
      `Tổng tiền: ${formatVnd(before.subtotal) || "(trống)"} → ${formatVnd(after.subtotal) || "(trống)"}`,
    );
  return changes;
}

/** Audit lines that reveal money, hidden from readers without `readPrice`. */
export const mentionsMoney = (change: string) =>
  /^(Đơn giá|Tổng tiền)|@ /.test(change);

// ---------------------------------------------------------------- clipboard

export type PastedLine = {
  itemCode: string;
  quantity: string | null;
  unitPrice: string | null;
};

/**
 * Rows copied from Excel: `Mã VT<TAB>Số lượng[<TAB>Giá]`. Numbers follow the
 * displayed comma-grouping and dot-decimals; a comma decimal is refused
 * rather than guessed.
 */
export function parsePastedLines(text: string): PastedLine[] {
  const number = (raw: string, label: string): string | null => {
    const value = raw.trim();
    if (!value) return null;
    if (value.includes(",") && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value))
      throw new SalesSlipError(
        `${label}: dùng dấu chấm cho số thập phân (ví dụ 0.5); dấu phẩy chỉ phân cách hàng nghìn.`,
      );
    const parsed = decimalSchema.safeParse(value.replaceAll(",", ""));
    if (!parsed.success)
      throw new SalesSlipError(
        `${label}: '${raw.trim()}' không phải số hợp lệ.`,
      );
    return parsed.data;
  };
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((row) => row.split("\t").map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => cell !== ""));
  if (rows.length > 500)
    throw new SalesSlipError("Dán tối đa 500 dòng mỗi lần.");
  return rows.map((cells, index) => {
    const label = `Dòng dán ${index + 1}`;
    const itemCode = cells[0] ?? "";
    if (!itemCode) throw new SalesSlipError(`${label}: thiếu mã vật tư.`);
    return {
      itemCode,
      quantity: number(cells[1] ?? "", `${label} (số lượng)`),
      unitPrice:
        cells.length > 2 ? number(cells[2] ?? "", `${label} (giá)`) : null,
    };
  });
}
