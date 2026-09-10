import { ZodError } from "zod";
import {
  debtStateLabels,
  displayDate,
  issueLabels,
  statusLabels,
  typeLabels,
  type DebtState,
  type EntryStatus,
  type EntryType,
  type HistoryEntry,
  type MigrationIssue,
} from "@/domains/receivables/contracts";

/** Labels, tones and audit wording shared by the Công nợ cards. */

export type Tab = "summary" | "sales" | "reductions" | "history";
export const tabs: { id: Tab; label: string }[] = [
  { id: "summary", label: "Tổng hợp công nợ" },
  { id: "sales", label: "Phát sinh bán hàng" },
  { id: "reductions", label: "Thanh toán / Giảm nợ" },
  { id: "history", label: "Nhật ký" },
];
export const isTab = (value: string | null): value is Tab =>
  tabs.some((tab) => tab.id === value);

/**
 * Debt tone. A negative balance is not an error: it means the customer has
 * paid ahead, and the source workbook already carries one (`QuyetBK`, −250),
 * so it gets its own calm colour rather than a red alarm.
 */
export const debtTone: Record<
  DebtState,
  { badge: string; card: string; amount: string }
> = {
  OWING: {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    card: "bg-amber-50 text-amber-900",
    amount: "text-amber-900",
  },
  SETTLED: {
    badge: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
    card: "bg-emerald-50 text-emerald-900",
    amount: "text-charcoal/70",
  },
  PREPAID: {
    badge: "bg-sky-100 text-sky-900 ring-1 ring-sky-300",
    card: "bg-sky-50 text-sky-900",
    amount: "text-sky-900",
  },
};
export const debtStates: DebtState[] = ["OWING", "SETTLED", "PREPAID"];
export { debtStateLabels, typeLabels, statusLabels, issueLabels };

export const statusTone: Record<EntryStatus, string> = {
  DRAFT: "bg-stone-100 text-stone-700 ring-1 ring-stone-300",
  POSTED: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
  CANCELLED: "bg-red-100 text-red-900 ring-1 ring-red-300",
};

export const badgeClass =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

/** The reduction types a person may pick, in the order the counter uses them. */
export const reductionOptions: { id: EntryType; label: string }[] = [
  { id: "PAYMENT", label: typeLabels.PAYMENT },
  { id: "PAINT_OFFSET", label: typeLabels.PAINT_OFFSET },
  { id: "MATERIAL_OFFSET", label: typeLabels.MATERIAL_OFFSET },
  { id: "SALES_RETURN", label: typeLabels.SALES_RETURN },
  { id: "OTHER_OFFSET", label: typeLabels.OTHER_OFFSET },
];

export const sortOptions = [
  // The workbook's own row order, which is how the staff read the report.
  { id: "report", label: "Thứ tự báo cáo" },
  { id: "code", label: "Mã khách" },
  { id: "name", label: "Tên khách" },
  { id: "closingDesc", label: "Dư nợ cao nhất" },
  { id: "closingAsc", label: "Dư nợ thấp nhất" },
  { id: "increase", label: "Phát sinh tăng" },
  { id: "decrease", label: "Phát sinh giảm" },
] as const;

const auditWording: Record<string, string> = {
  "receivables.sale.create": "Ghi phát sinh bán hàng",
  "receivables.sale.createBatch": "Ghi phát sinh bán hàng (nhiều mặt hàng)",
  "receivables.entry.update": "Sửa dòng giao dịch",
  "receivables.catalogue.create": "Thêm mã sơn",
  "receivables.catalogue.update": "Sửa mã sơn / đơn giá",
  "receivables.reduction.create": "Ghi giảm công nợ",
  "receivables.entry.post": "Ghi sổ giao dịch",
  "receivables.entry.cancel": "Hủy giao dịch",
  "receivables.openingBalance.create": "Tạo dư đầu kỳ",
  "receivables.openingBalance.update": "Sửa dư đầu kỳ",
  "receivables.customer.create": "Thêm khách hàng",
  "receivables.customer.update": "Sửa khách hàng",
};

export const actionLabel = (action: string) => auditWording[action] ?? action;

/** One line describing what an audit event changed, in the staff's wording. */
export function historySummary(entry: HistoryEntry): string {
  const after = entry.after as Record<string, unknown> | null;
  const before = entry.before as Record<string, unknown> | null;
  const record = after ?? before;
  const parts: string[] = [];
  if (record && typeof record.customerCode === "string")
    parts.push(record.customerCode);
  if (record && typeof record.type === "string" && record.type in typeLabels)
    parts.push(typeLabels[record.type as EntryType]);
  if (entry.reason) parts.push(`Lý do: ${entry.reason}`);
  return parts.join(" · ");
}

export const issueList = (issues: readonly MigrationIssue[]) =>
  issues.map((issue) => issueLabels[issue]).join("; ");

export { displayDate };

/** Turns any thrown value into one sentence a person can act on. */
export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ZodError)
    return reason.issues.map((issue) => issue.message).join("; ") || fallback;
  if (reason instanceof Error && reason.message) return reason.message;
  return fallback;
}
