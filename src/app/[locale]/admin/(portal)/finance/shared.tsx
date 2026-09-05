import type { Route } from "next";
import Link from "next/link";

import type {
  FinanceEntryCategory,
  FinanceEntryRecordDto,
  FinancePaymentMethod,
} from "@/domains/finance/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import {
  add,
  formatMoney,
  money,
  subtract,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

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
    orderPayment: "Khách thanh toán",
    otherIncome: "Thu khác",
    materials: "Nguyên vật liệu",
    labor: "Nhân công",
    outsourcing: "Gia công ngoài",
    shipping: "Vận chuyển",
    packaging: "Đóng gói",
    generalCost: "Chi phí chung",
    refund: "Hoàn tiền khách",
  },
  en: {
    orderPayment: "Customer payment",
    otherIncome: "Other income",
    materials: "Materials",
    labor: "Labor",
    outsourcing: "Outsourcing",
    shipping: "Shipping",
    packaging: "Packaging",
    generalCost: "General cost",
    refund: "Customer refund",
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
    allocationColumn: "Phân bổ",
    actionColumn: "Thao tác",
    receipt: "Thu",
    expense: "Chi",
    voided: "Đã hủy",
    voidButton: "Hủy phiếu",
    voidReasonPlaceholder: "Lý do hủy…",
    emptyLedger: "Chưa có phiếu nào trong phạm vi của bạn.",
    totalLabel: "Tổng",
    unallocated: "Chưa phân bổ",
    allocated: "Đã phân bổ",
    openDetail: "Mở",
    errorLead: "Thao tác không thành công:",
    notices: {
      recorded: "Đã ghi phiếu.",
      voided: "Đã hủy phiếu.",
      allocated: "Đã lưu phân bổ.",
      invoiceIssued: "Đã lập hóa đơn.",
      invoiceVoided: "Đã hủy hóa đơn.",
      rateSaved: "Đã lưu tỷ giá.",
      documentRemoved: "Đã gỡ chứng từ.",
      refunded: "Đã ghi phiếu hoàn tiền.",
    } as Record<string, string>,
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy bản ghi.",
      ORDER_NOT_FOUND: "Không tìm thấy đơn hàng.",
      ORDER_CANCELLED: "Đơn hàng đã hủy, không ghi nhận tiền thu vào đơn này.",
      ORDER_CLOSED: "Đơn hàng đã đóng hồ sơ.",
      CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
      CUSTOMER_REQUIRED: "Phiếu thu của khách phải chọn khách hàng.",
      CUSTOMER_MISMATCH: "Khách hàng không khớp với đơn hoặc hóa đơn đã chọn.",
      SUPPLIER_NOT_FOUND: "Không tìm thấy nhà cung cấp.",
      INVOICE_NOT_FOUND: "Không tìm thấy hóa đơn.",
      INVOICE_VOIDED: "Hóa đơn đã hủy.",
      DUPLICATE_INVOICE_NUMBER: "Số hóa đơn này đã tồn tại.",
      CURRENCY_MISMATCH: "Loại tiền không khớp với đơn hàng hoặc hóa đơn.",
      FX_RATE_REQUIRED:
        "Hóa đơn USD cần tỷ giá. Nhập tỷ giá vào ô hoặc thêm tỷ giá của ngày lập vào bảng tỷ giá.",
      NOT_A_RECEIPT: "Chỉ phiếu thu của khách mới phân bổ được.",
      ALLOCATION_EXCEEDS_ENTRY: "Tổng phân bổ lớn hơn số tiền của phiếu.",
      ALLOCATION_EXCEEDS_INVOICE: "Phân bổ nhiều hơn phần còn thiếu của hóa đơn.",
      REFUND_EXCEEDS_CREDIT: "Số tiền hoàn lớn hơn số khách đang trả dư.",
      REVISION_CONFLICT:
        "Bản ghi đã thay đổi trong lúc bạn thao tác. Trang đã tải lại, kiểm tra rồi thử lại.",
      ALREADY_VOIDED: "Bản ghi đã hủy trước đó.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ.",
      INVALID_AMOUNT: "Số tiền không hợp lệ với loại tiền đã chọn.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
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
    allocationColumn: "Allocation",
    actionColumn: "Action",
    receipt: "In",
    expense: "Out",
    voided: "Voided",
    voidButton: "Void",
    voidReasonPlaceholder: "Reason…",
    emptyLedger: "No entries inside your scope yet.",
    totalLabel: "Total",
    unallocated: "Unallocated",
    allocated: "Allocated",
    openDetail: "Open",
    errorLead: "The action failed:",
    notices: {
      recorded: "Entry recorded.",
      voided: "Entry voided.",
      allocated: "Allocation saved.",
      invoiceIssued: "Invoice issued.",
      invoiceVoided: "Invoice voided.",
      rateSaved: "Rate saved.",
      documentRemoved: "Document removed.",
      refunded: "Refund recorded.",
    } as Record<string, string>,
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The record was not found.",
      ORDER_NOT_FOUND: "The order was not found.",
      ORDER_CANCELLED: "The order is cancelled; no payment can be recorded on it.",
      ORDER_CLOSED: "The order file is closed.",
      CUSTOMER_NOT_FOUND: "The customer was not found.",
      CUSTOMER_REQUIRED: "A customer payment needs a customer.",
      CUSTOMER_MISMATCH: "The customer does not match the chosen order or invoice.",
      SUPPLIER_NOT_FOUND: "The supplier was not found.",
      INVOICE_NOT_FOUND: "The invoice was not found.",
      INVOICE_VOIDED: "The invoice is voided.",
      DUPLICATE_INVOICE_NUMBER: "This invoice number already exists.",
      CURRENCY_MISMATCH: "The currency does not match the order or invoice.",
      FX_RATE_REQUIRED:
        "A USD invoice needs a rate. Type one or add the issue date to the rate table.",
      NOT_A_RECEIPT: "Only a customer payment can be allocated.",
      ALLOCATION_EXCEEDS_ENTRY: "The allocations add up to more than the receipt.",
      ALLOCATION_EXCEEDS_INVOICE: "More than what is still open on the invoice.",
      REFUND_EXCEEDS_CREDIT: "The refund is larger than the customer's credit.",
      REVISION_CONFLICT:
        "The record changed while you were acting. The page has reloaded — review and retry.",
      ALREADY_VOIDED: "The record was already voided.",
      INVALID_INPUT: "The submitted data is not valid.",
      INVALID_AMOUNT: "The amount is not valid for the chosen currency.",
      UNAVAILABLE: "The system is temporarily unavailable.",
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

export function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

/** `YYYY-MM-DD` for a date input, in UTC to match how the form dates are stored. */
export function dateInputValue(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** What a receipt has not applied to any invoice or order yet. */
export function unallocatedAmount(entry: FinanceEntryRecordDto): Money {
  let allocated = zero(entry.amount.currency);
  for (const allocation of entry.allocations) {
    allocated = add(allocated, money(allocation.amount, entry.amount.currency));
  }
  return subtract(money(entry.amount.amount, entry.amount.currency), allocated);
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
        {text.errorLead} {text.errors[error] ?? error}
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
  showAllocation = false,
  canVoid,
}: {
  locale: AdminLocale;
  entries: readonly FinanceEntryRecordDto[];
  returnTo: string;
  showKind: boolean;
  /** Customer payments: show how much is applied and link to the allocation page. */
  showAllocation?: boolean;
  canVoid: (entry: FinanceEntryRecordDto) => boolean;
}) {
  const text = sharedCopy[locale];

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
            {showAllocation ? (
              <th scope="col" className="px-5 py-4 font-semibold">
                {text.allocationColumn}
              </th>
            ) : null}
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.methodColumn}
            </th>
            <th scope="col" className="px-5 py-4 font-semibold">
              {text.actionColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const open = unallocatedAmount(entry);
            const isPayment =
              entry.kind === "receipt" && entry.category === "orderPayment";
            return (
              <tr
                key={entry.id}
                className={
                  entry.status === "voided"
                    ? "border-burgundy/8 border-b opacity-45"
                    : "border-burgundy/8 border-b"
                }
              >
                <td className="text-charcoal/70 px-5 py-4 text-xs">
                  {formatDate(entry.occurredAt, locale)}
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
                  {entry.orderId ? (
                    <Link
                      href={`/${locale}/admin/orders/${entry.orderId}` as Route}
                      className="text-burgundy hover:underline"
                    >
                      {entry.orderCode}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-charcoal/75 px-5 py-4">
                  {entry.customerId ? (
                    <Link
                      href={
                        `/${locale}/admin/customers/${entry.customerId}` as Route
                      }
                      className="hover:underline"
                    >
                      {entry.counterparty}
                    </Link>
                  ) : (
                    entry.counterparty
                  )}
                </td>
                <td className="px-5 py-4 font-mono text-xs font-semibold">
                  {formatMoney(entry.amount, locale)}
                </td>
                {showAllocation ? (
                  <td className="px-5 py-4 text-xs">
                    {isPayment && entry.status === "active" ? (
                      <Link
                        href={
                          `/${locale}/admin/finance/payments/${entry.id}` as Route
                        }
                        className={
                          open.amount === zero(open.currency).amount
                            ? "text-emerald-700 hover:underline"
                            : "text-lacquer font-semibold hover:underline"
                        }
                      >
                        {open.amount === zero(open.currency).amount
                          ? text.allocated
                          : `${text.unallocated}: ${formatMoney(open, locale)}`}
                      </Link>
                    ) : (
                      <span className="text-charcoal/35">—</span>
                    )}
                  </td>
                ) : null}
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
