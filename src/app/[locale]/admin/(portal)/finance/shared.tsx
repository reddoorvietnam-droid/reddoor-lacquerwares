import type {
  FinanceEntryCategory,
  FinanceEntryRecordDto,
  FinancePaymentMethod,
} from "@/domains/finance/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import { add, formatMoney, zero, type Currency, type Money } from "@/lib/money";

import { voidFinanceEntryAction } from "./actions";

/**
 * Shared copy and building blocks for the finance screens. Copy lives here
 * (like the orders pages) instead of the admin dictionary: the screens ship
 * together and read together.
 */

export const categoryLabels: Record<
  AdminLocale,
  Record<FinanceEntryCategory, string>
> = {
  vi: {
    orderPayment: "Khách thanh toán đơn",
    otherIncome: "Thu khác",
    materials: "Nguyên vật liệu",
    labor: "Nhân công",
    outsourcing: "Gia công ngoài",
    shipping: "Vận chuyển",
    packaging: "Đóng gói",
    generalCost: "Chi phí chung",
  },
  en: {
    orderPayment: "Order payment",
    otherIncome: "Other income",
    materials: "Materials",
    labor: "Labor",
    outsourcing: "Outsourcing",
    shipping: "Shipping",
    packaging: "Packaging",
    generalCost: "General cost",
  },
};

export const methodLabels: Record<
  AdminLocale,
  Record<FinancePaymentMethod, string>
> = {
  vi: { bankTransfer: "Chuyển khoản", cash: "Tiền mặt", other: "Khác" },
  en: { bankTransfer: "Bank transfer", cash: "Cash", other: "Other" },
};

export const sharedCopy = {
  vi: {
    dateColumn: "Ngày",
    kindColumn: "Loại",
    categoryColumn: "Hạng mục",
    orderColumn: "Đơn hàng",
    counterpartyColumn: "Đối tác",
    amountColumn: "Số tiền",
    methodColumn: "Hình thức",
    noteColumn: "Ghi chú",
    actionColumn: "Thao tác",
    receipt: "Thu",
    expense: "Chi",
    voided: "Đã hủy",
    voidButton: "Hủy phiếu",
    voidReasonPlaceholder: "Lý do hủy…",
    emptyLedger: "Chưa có phiếu nào trong phạm vi của bạn.",
    totalLabel: "Tổng",
    errorLead: "Thao tác không thành công:",
    notices: {
      recorded: "Đã ghi phiếu.",
      voided: "Đã hủy phiếu.",
      dueDateSet: "Đã cập nhật hạn thanh toán.",
    } as Record<string, string>,
  },
  en: {
    dateColumn: "Date",
    kindColumn: "Kind",
    categoryColumn: "Category",
    orderColumn: "Order",
    counterpartyColumn: "Counterparty",
    amountColumn: "Amount",
    methodColumn: "Method",
    noteColumn: "Note",
    actionColumn: "Action",
    receipt: "In",
    expense: "Out",
    voided: "Voided",
    voidButton: "Void",
    voidReasonPlaceholder: "Reason…",
    emptyLedger: "No entries inside your scope yet.",
    totalLabel: "Total",
    errorLead: "The action failed:",
    notices: {
      recorded: "Entry recorded.",
      voided: "Entry voided.",
      dueDateSet: "Payment due date updated.",
    } as Record<string, string>,
  },
} as const;

/** Per-currency totals of the ACTIVE entries. */
export function sumEntriesByCurrency(
  entries: readonly FinanceEntryRecordDto[],
): Money[] {
  const totals = new Map<Currency, Money>();
  for (const entry of entries) {
    if (entry.status !== "active") continue;
    const current = totals.get(entry.amount.currency);
    const value: Money = {
      amount: entry.amount.amount,
      currency: entry.amount.currency,
    };
    totals.set(
      entry.amount.currency,
      current ? add(current, value) : add(zero(value.currency), value),
    );
  }
  return [...totals.values()];
}

export function formatTotals(totals: readonly Money[], locale: string): string {
  if (totals.length === 0) return "—";
  return totals.map((total) => formatMoney(total, locale)).join(" · ");
}

export function OutcomeBanner({
  locale,
  error,
  notice,
}: {
  locale: AdminLocale;
  error?: string | undefined;
  notice?: string | undefined;
}) {
  const text = sharedCopy[locale];
  if (error) {
    return (
      <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
        {text.errorLead} <span className="font-mono">{error}</span>
      </p>
    );
  }
  if (notice && text.notices[notice]) {
    return (
      <p className="mt-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        {text.notices[notice]}
      </p>
    );
  }
  return null;
}

export function EntryTable({
  locale,
  entries,
  returnTo,
  showKind,
  canVoid,
}: {
  locale: AdminLocale;
  entries: readonly FinanceEntryRecordDto[];
  returnTo: "payments" | "ledger" | "expenses";
  showKind: boolean;
  canVoid: (entry: FinanceEntryRecordDto) => boolean;
}) {
  const text = sharedCopy[locale];
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  if (entries.length === 0) {
    return (
      <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
        {text.emptyLedger}
      </p>
    );
  }

  return (
    <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
      <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.dateColumn}
            </th>
            {showKind ? (
              <th scope="col" className="px-5 py-4 font-semibold">
                {text.kindColumn}
              </th>
            ) : null}
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.categoryColumn}
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.orderColumn}
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.counterpartyColumn}
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.amountColumn}
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.methodColumn}
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.actionColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={
                entry.status === "voided"
                  ? "border-burgundy/8 border-b opacity-45"
                  : "border-burgundy/8 border-b"
              }
            >
              <td className="text-charcoal/70 px-5 py-4 text-xs">
                {dateFormat.format(entry.occurredAt)}
              </td>
              {showKind ? (
                <td className="px-5 py-4">
                  <span
                    className={
                      entry.kind === "receipt"
                        ? "font-semibold text-emerald-700"
                        : "text-lacquer font-semibold"
                    }
                  >
                    {entry.kind === "receipt" ? text.receipt : text.expense}
                  </span>
                </td>
              ) : null}
              <td className="text-charcoal/75 px-5 py-4">
                {categoryLabels[locale][entry.category]}
                {entry.note ? (
                  <span className="text-charcoal/45 mt-1 block max-w-[16rem] truncate text-xs">
                    {entry.note}
                  </span>
                ) : null}
              </td>
              <td className="px-5 py-4 font-mono text-xs">
                {entry.orderCode ?? "—"}
              </td>
              <td className="text-charcoal/75 px-5 py-4">
                {entry.counterparty}
              </td>
              <td className="px-5 py-4 font-mono text-xs font-semibold">
                {formatMoney(entry.amount, locale)}
              </td>
              <td className="text-charcoal/60 px-5 py-4 text-xs">
                {methodLabels[locale][entry.method]}
              </td>
              <td className="px-5 py-4">
                {entry.status === "voided" ? (
                  <span className="text-charcoal/50 text-xs">
                    {text.voided}
                    {entry.voidReason ? ` · ${entry.voidReason}` : ""}
                  </span>
                ) : canVoid(entry) ? (
                  <form
                    action={voidFinanceEntryAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input
                      type="hidden"
                      name="expectedRevision"
                      value={entry.revision}
                    />
                    <input
                      type="text"
                      name="reason"
                      required
                      placeholder={text.voidReasonPlaceholder}
                      className="border-burgundy/20 w-28 rounded-lg border bg-white px-2 py-1.5 text-xs"
                    />
                    <button
                      type="submit"
                      className="text-lacquer border-lacquer/30 hover:bg-lacquer/5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                    >
                      {text.voidButton}
                    </button>
                  </form>
                ) : (
                  <span className="text-charcoal/35 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
