import { ZodError } from "zod";
import {
  displayDate,
  formatQuantity,
  type Facility,
  type HistoryEntry,
  type Material,
  type StockState,
  type TransactionType,
} from "@/domains/materials/contracts";

/** Labels, tones and audit wording shared by the materials cards. */

export type Tab = "summary" | "inbound" | "outbound" | "catalog";
export const tabs: { id: Tab; label: string }[] = [
  { id: "summary", label: "Tổng kho" },
  { id: "inbound", label: "Nhập kho" },
  { id: "outbound", label: "Xuất kho" },
  { id: "catalog", label: "Danh mục NVL" },
];
export const isTab = (value: string | null): value is Tab =>
  tabs.some((tab) => tab.id === value);

export type StockTone = StockState | "inactive";
export const stockTones: StockTone[] = ["in", "low", "out", "inactive"];
export const stockLabels: Record<StockTone, string> = {
  in: "Còn hàng",
  low: "Sắp hết",
  out: "Hết hàng",
  inactive: "Ngừng dùng",
};
export const stockTone: Record<
  StockTone,
  { badge: string; card: string; chart: string }
> = {
  in: {
    badge: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
    card: "bg-emerald-50 text-emerald-900",
    chart: "#16a34a",
  },
  low: {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    card: "bg-amber-50 text-amber-900",
    chart: "#f59e0b",
  },
  out: {
    badge: "bg-red-100 text-red-900 ring-1 ring-red-300",
    card: "bg-red-50 text-red-900",
    chart: "#dc2626",
  },
  inactive: {
    badge: "bg-stone-100 text-stone-700 ring-1 ring-stone-300",
    card: "bg-stone-50 text-stone-700",
    chart: "#a8a29e",
  },
};
export const toneOf = (row: {
  active: boolean;
  state: StockState;
}): StockTone => (row.active ? row.state : "inactive");

export const typeLabels: Record<TransactionType, string> = {
  INBOUND: "Nhập kho",
  OUTBOUND: "Xuất kho",
  ADJUSTMENT: "Điều chỉnh",
};
export const slipLabels: Record<TransactionType, string> = {
  INBOUND: "phiếu nhập",
  OUTBOUND: "phiếu xuất",
  ADJUSTMENT: "điều chỉnh",
};

export { formatQuantity };

export const badgeClass =
  "inline-block rounded-lg px-2 py-1 text-xs font-semibold whitespace-nowrap";

export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ZodError)
    return reason.issues.map((issue) => issue.message).join("; ");
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export const masterLabel = (
  master: Pick<Material, "code" | "name"> | Pick<Facility, "code" | "name">,
) => (master.name ? `${master.name} (${master.code})` : master.code);

// ---------------------------------------------------------------- audit wording

const fieldLabels: Record<string, string> = {
  transactionDate: "ngày",
  materialCode: "mã vật tư",
  facilityCode: "cơ sở",
  description: "diễn giải",
  quantity: "số lượng",
  unitPrice: "đơn giá",
  note: "ghi chú",
  code: "mã",
  name: "tên",
  unit: "ĐVT",
  type: "loại",
  phone: "SĐT",
  openingQuantity: "tồn đầu",
  minimumStock: "tồn tối thiểu",
  active: "trạng thái",
};
const numericKeys = new Set([
  "quantity",
  "unitPrice",
  "openingQuantity",
  "minimumStock",
]);

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value);

function showValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "trống";
  if (key === "transactionDate") return displayDate(String(value));
  if (key === "active") return value ? "đang dùng" : "ngừng dùng";
  if (numericKeys.has(key)) return formatQuantity(String(value));
  return String(value);
}

/** "số lượng từ 20 thành 25; ghi chú từ trống thành ..." for the fields that changed. */
function changedFields(before: unknown, after: unknown): string {
  const previous = asRecord(before);
  const next = asRecord(after);
  return Object.keys(fieldLabels)
    .filter(
      (key) =>
        key in next &&
        JSON.stringify(previous[key] ?? null) !==
          JSON.stringify(next[key] ?? null),
    )
    .map(
      (key) =>
        `${fieldLabels[key]} từ ${showValue(key, previous[key])} thành ${showValue(key, next[key])}`,
    )
    .join("; ");
}

function lineLabel(row: Record<string, unknown>): string {
  const material = text(row.materialName) || text(row.materialCode);
  const quantity = row.quantity ? formatQuantity(String(row.quantity)) : "";
  const unit = text(row.unit);
  const parts = [material];
  if (quantity) parts.push(`${quantity} ${unit}`.trim());
  if (row.transactionDate) parts.push(displayDate(String(row.transactionDate)));
  if (row.facilityName) parts.push(`đến ${text(row.facilityName)}`);
  return parts.filter(Boolean).join(" · ");
}

const slipOf = (row: Record<string, unknown>) =>
  slipLabels[(row.type as TransactionType) ?? "INBOUND"] ?? "phiếu";

/**
 * One audit event as a verb phrase and its detail, so the history table can
 * read "Thủ kho · Sửa phiếu xuất · số lượng từ 20 thành 25".
 */
export function describeAudit(entry: HistoryEntry): {
  action: string;
  detail: string;
} {
  const after = asRecord(entry.after);
  const before = asRecord(entry.before);
  const meta = asRecord(entry.metadata);
  switch (entry.action) {
    case "materials.transaction.create":
      return { action: `Ghi ${slipOf(after)}`, detail: lineLabel(after) };
    case "materials.transaction.update":
      return {
        action: `Sửa ${slipOf(after)}`,
        detail: [lineLabel(after), changedFields(before, after)]
          .filter(Boolean)
          .join(": "),
      };
    case "materials.transaction.cancel":
      return {
        action: `Hủy ${slipOf(after)}`,
        detail: [
          lineLabel(before),
          after.cancelReason ? `lý do: ${text(after.cancelReason)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "materials.material.create":
      return {
        action: "Thêm vật tư",
        detail: `${text(after.name)} (${text(after.code)}) · ĐVT ${text(after.unit) || "trống"} · tồn đầu ${showValue("openingQuantity", after.openingQuantity)}`,
      };
    case "materials.material.update":
      return {
        action: "Sửa vật tư",
        detail: `${text(after.name) || text(after.code)}: ${changedFields(before, after) || "không đổi"}`,
      };
    case "materials.facility.create":
      return {
        action: "Thêm cơ sở",
        detail: `${text(after.name)} (${text(after.code)})`,
      };
    case "materials.facility.update":
      return {
        action: "Sửa cơ sở",
        detail: `${text(after.name) || text(after.code)}: ${changedFields(before, after) || "không đổi"}`,
      };
    case "materials.import":
      return {
        action: "Nhập Excel",
        detail: `${text(meta.fileName) || "file"}: đã nhập ${text(meta.imported) || 0} dòng, bỏ qua ${text(meta.skipped) || 0} dòng`,
      };
    default:
      return { action: entry.action, detail: changedFields(before, after) };
  }
}

/** Sentence form for the material card: "Thủ kho đã sửa phiếu xuất · số lượng từ 20 thành 25". */
export function auditSentence(entry: HistoryEntry): string {
  const { action, detail } = describeAudit(entry);
  const verb = action.charAt(0).toLocaleLowerCase("vi") + action.slice(1);
  return `${entry.actorName || entry.actor} đã ${verb}${detail ? ` · ${detail}` : ""}`;
}
