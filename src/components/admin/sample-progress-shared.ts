import {
  BUSINESS_TIMEZONE,
  formatSampleDate,
  sampleStatuses,
  type SampleRow,
  type SampleStatus,
} from "@/domains/sample-progress/contracts";

export const cardClass =
  "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
export const buttonClass =
  "bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const ghostButtonClass =
  "text-burgundy border-burgundy/30 hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButtonClass =
  "text-lacquer border-lacquer/30 hover:bg-lacquer/5 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none";
export const labelClass = "text-charcoal/60 mb-1 block text-xs";
export const tableWrapClass =
  "border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
export const theadClass =
  "border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase";
export const thClass = "px-4 py-3 text-left font-semibold";
export const tdClass = "px-4 py-3 align-top";

export const sortOptions = [
  { key: "report", label: "Thứ tự báo cáo" },
  { key: "updated", label: "Cập nhật gần nhất" },
] as const;
export type SortKey = (typeof sortOptions)[number]["key"];

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

/**
 * Filtering and ordering only change what is on screen. The saved snapshot is
 * never touched, so a filtered view can still be printed or edited safely.
 */
export function visibleRows(
  rows: readonly SampleRow[],
  filters: { search: string; status: string; sort: SortKey },
): SampleRow[] {
  const needle = filters.search.trim().toLocaleLowerCase("vi");
  const matched = rows.filter((row) => {
    if (filters.status && row.status !== filters.status) return false;
    if (!needle) return true;
    return [
      String(row.number),
      row.orderName,
      row.productDetails,
      row.workshop,
      row.notes,
      formatSampleDate(row.receivedDate),
      formatSampleDate(row.qcDate),
      formatSampleDate(row.sentDate),
    ]
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(needle);
  });
  return filters.sort === "updated"
    ? [...matched].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : matched;
}

export function isStatus(value: string): value is SampleStatus {
  return (sampleStatuses as readonly string[]).includes(value);
}
