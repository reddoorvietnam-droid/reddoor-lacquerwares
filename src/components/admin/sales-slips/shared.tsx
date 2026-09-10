import {
  statusLabels,
  type SalesSlipStatus,
} from "@/domains/sales-slips/contracts";

/** Small pieces both sales-slip screens share; the chrome itself comes from `sample-progress-shared`. */

/** Same badge as the materials screens (`badgeClass` there). */
export const salesBadgeClass =
  "inline-block rounded-lg px-2 py-1 font-sans text-xs font-semibold tracking-normal whitespace-nowrap";

const statusTone: Record<SalesSlipStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  CONFIRMED: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
  CANCELLED: "bg-stone-100 text-stone-700 ring-1 ring-stone-300 line-through",
};

export function StatusBadge({ status }: { status: SalesSlipStatus }) {
  return (
    <span className={`${salesBadgeClass} align-middle ${statusTone[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

export const alertClass =
  "rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900";
export const noticeClass =
  "rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900";
export const successClass = "rounded-2xl bg-emerald-50 p-4 text-emerald-900";
