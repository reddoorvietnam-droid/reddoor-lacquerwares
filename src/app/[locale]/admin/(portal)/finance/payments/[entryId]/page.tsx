import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney, money } from "@/lib/money";

import { setAllocationsAction, voidFinanceEntryAction } from "../../actions";
import {
  categoryLabels,
  formatDate,
  methodLabels,
  OutcomeBanner,
  sharedCopy,
  unallocatedAmount,
} from "../../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Tiền khách trả",
    eyebrow: "Phiếu thu",
    customer: "Khách hàng",
    amount: "Số tiền",
    date: "Ngày",
    method: "Hình thức",
    note: "Ghi chú",
    rate: "Tỷ giá ngày thu",
    voided: "Phiếu đã hủy",
    allocationTitle: "Phân bổ tiền vào hóa đơn / đơn hàng",
    allocationHint:
      "Nhập số tiền cho từng dòng. Tổng không được vượt số tiền của phiếu; phần còn lại là tiền khách trả trước và tự bù cho hóa đơn sau. Để trống hoặc 0 để bỏ dòng.",
    invoiceColumn: "Hóa đơn",
    orderColumn: "Đơn hàng",
    dueColumn: "Hạn",
    invoiceAmountColumn: "Giá trị",
    openColumn: "Còn thiếu",
    thisEntryColumn: "Phiếu này",
    depositRowsTitle: "Đặt cọc cho đơn hàng chưa có hóa đơn",
    noTargets: "Khách hàng này chưa có hóa đơn hay đơn hàng nào để phân bổ.",
    legacy:
      "Phiếu này ghi theo tên khách trước khi có danh sách khách hàng nên không phân bổ được. Hủy phiếu và ghi lại nếu cần.",
    save: "Lưu phân bổ",
    unallocated: "Chưa phân bổ",
    currentTitle: "Đang phân bổ",
    none: "Chưa phân bổ vào đâu.",
    voidTitle: "Hủy phiếu",
    voidReason: "Lý do hủy",
    voidButton: "Hủy phiếu này",
    overdue: "Quá hạn",
  },
  en: {
    back: "← Customer payments",
    eyebrow: "Receipt",
    customer: "Customer",
    amount: "Amount",
    date: "Date",
    method: "Method",
    note: "Note",
    rate: "Rate on the day",
    voided: "Voided",
    allocationTitle: "Apply the money to invoices / orders",
    allocationHint:
      "Enter an amount per line. The total may not exceed the receipt; the rest is the customer's advance and offsets the next invoice. Blank or 0 drops the line.",
    invoiceColumn: "Invoice",
    orderColumn: "Order",
    dueColumn: "Due",
    invoiceAmountColumn: "Amount",
    openColumn: "Open",
    thisEntryColumn: "This receipt",
    depositRowsTitle: "Deposits on orders without an invoice yet",
    noTargets: "This customer has no invoice or order to apply money to.",
    legacy:
      "This receipt was recorded by name before the customer list existed, so it cannot be allocated. Void and re-record it if needed.",
    save: "Save allocation",
    unallocated: "Unallocated",
    currentTitle: "Currently applied to",
    none: "Not applied anywhere yet.",
    voidTitle: "Void",
    voidReason: "Reason",
    voidButton: "Void this receipt",
    overdue: "Overdue",
  },
} as const;

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; entryId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, entryId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];
  const shared = sharedCopy[locale];

  if (!/^[a-f0-9]{24}$/.test(entryId)) notFound();
  const entry = await financeCommandService.findById(entryId);
  if (!entry || entry.kind !== "receipt" || entry.category !== "orderPayment") {
    notFound();
  }

  try {
    await requirePermission("payments.read", {
      resourceId: entry.id,
      ...(entry.businessUnitIds.length > 0
        ? { businessUnitIds: entry.businessUnitIds }
        : {}),
    });
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "payments.allocate",
    "payments.reverse",
  ] as const);
  const reaches = (coverage: (typeof coverages)[keyof typeof coverages]) =>
    coverage.global ||
    (entry.businessUnitIds.length > 0 &&
      coverageReaches(coverage, entry.businessUnitIds));
  const canAllocate = entry.status === "active" && reaches(coverages["payments.allocate"]);
  const canVoid = entry.status === "active" && reaches(coverages["payments.reverse"]);

  const currency = entry.amount.currency;
  const open = unallocatedAmount(entry);
  const ownAllocation = (key: string): string => {
    const found = entry.allocations.find((allocation) =>
      allocation.target === "invoice"
        ? `invoice:${allocation.invoiceId}` === key
        : `order:${allocation.orderId}` === key,
    );
    return found ? found.amount : "";
  };

  // Targets: the customer's invoices in this currency (open ones, plus any
  // this receipt already sits on) and orders without a terminal stage.
  type InvoiceRow = {
    id: string;
    invoiceNumber: string;
    orderId: string;
    orderCode: string;
    dueAt: Date;
    amount: string;
    open: string;
    overdue: boolean;
    own: string;
  };
  let invoiceRows: InvoiceRow[] = [];
  let orderRows: { id: string; orderCode: string; own: string }[] = [];
  if (canAllocate && entry.customerId) {
    const report = await financeCommandService.customerReceivables(
      entry.customerId,
    );
    invoiceRows = report.invoices
      .filter((row) => row.invoice.amount.currency === currency)
      .map((row) => {
        const own = ownAllocation(`invoice:${row.invoice.id}`);
        return {
          id: row.invoice.id,
          invoiceNumber: row.invoice.invoiceNumber,
          orderId: row.invoice.orderId,
          orderCode: row.invoice.orderCode,
          dueAt: row.invoice.dueAt,
          amount: row.invoice.amount.amount,
          open: row.remaining.amount,
          overdue: row.overdue,
          own,
        };
      })
      .filter(
        (row) =>
          row.own !== "" ||
          (!row.open.startsWith("-") && Number(row.open) > 0),
      );
    const orders = await orderCommandService.listByCustomer(entry.customerId, false);
    orderRows = orders
      .filter(
        (order) =>
          !isTerminalStage(order.stage) &&
          (!order.sellingPrice || order.sellingPrice.currency === currency),
      )
      .map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        own: ownAllocation(`order:${order.id}`),
      }));
  }

  const cardClass =
    "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
  const inputClass =
    "border-burgundy/20 focus:border-burgundy/50 w-36 rounded-lg border bg-white px-2 py-1.5 text-right font-mono text-xs outline-none";

  return (
    <div>
      <Link
        href={`/${locale}/admin/finance/payments` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
            <span className="font-mono text-4xl">
              {formatMoney(entry.amount, locale)}
            </span>
          </h1>
          <p className="text-charcoal/75 mt-3 text-lg">
            {entry.customerId ? (
              <Link
                href={`/${locale}/admin/customers/${entry.customerId}` as Route}
                className="hover:underline"
              >
                {entry.counterparty}
              </Link>
            ) : (
              entry.counterparty
            )}
          </p>
        </div>
        {entry.status === "voided" ? (
          <p className="text-lacquer bg-lacquer/10 rounded-full px-4 py-2 text-sm font-semibold">
            {text.voided}
            {entry.voidReason ? ` · ${entry.voidReason}` : ""}
          </p>
        ) : null}
      </div>

      <OutcomeBanner locale={locale} error={error} notice={notice} />

      <section className={`${cardClass} mt-8`}>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
              {text.date}
            </dt>
            <dd className="mt-1">{formatDate(entry.occurredAt, locale)}</dd>
          </div>
          <div>
            <dt className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
              {text.method}
            </dt>
            <dd className="mt-1">{methodLabels[locale][entry.method]}</dd>
          </div>
          <div>
            <dt className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
              {shared.categoryColumn}
            </dt>
            <dd className="mt-1">{categoryLabels[locale][entry.category]}</dd>
          </div>
          {entry.fxRateToVnd ? (
            <div>
              <dt className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
                {text.rate}
              </dt>
              <dd className="mt-1 font-mono">{entry.fxRateToVnd}</dd>
            </div>
          ) : null}
          {entry.note ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
                {text.note}
              </dt>
              <dd className="mt-1">{entry.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className={`${cardClass} mt-6`}>
        <h2 className="text-burgundy font-serif text-2xl">{text.currentTitle}</h2>
        {entry.allocations.length === 0 ? (
          <p className="text-charcoal/55 mt-3 text-sm">{text.none}</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {entry.allocations.map((allocation, index) => (
              <li key={index} className="flex flex-wrap gap-x-4">
                <span className="font-mono text-xs">
                  {allocation.target === "invoice"
                    ? `HĐ ${allocation.invoiceNumber} · ${allocation.orderCode}`
                    : `${locale === "vi" ? "Cọc" : "Deposit"} · ${allocation.orderCode}`}
                </span>
                <span className="font-mono text-xs font-semibold">
                  {formatMoney(money(allocation.amount, currency), locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-charcoal/70 mt-4 text-sm">
          {text.unallocated}:{" "}
          <span
            className={`font-mono font-semibold ${
              Number(open.amount) > 0 ? "text-lacquer" : "text-emerald-700"
            }`}
          >
            {formatMoney(open, locale)}
          </span>
        </p>
      </section>

      {canAllocate ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.allocationTitle}
          </h2>
          <p className="text-charcoal/55 mt-2 text-sm">{text.allocationHint}</p>
          {!entry.customerId ? (
            <p className="border-gold/45 bg-gold/10 text-charcoal/75 mt-5 rounded-2xl border px-5 py-4 text-sm">
              {text.legacy}
            </p>
          ) : invoiceRows.length === 0 && orderRows.length === 0 ? (
            <p className="text-charcoal/55 mt-5 text-sm">{text.noTargets}</p>
          ) : (
            <form action={setAllocationsAction} className="mt-5">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="entryId" value={entry.id} />
              <input
                type="hidden"
                name="expectedRevision"
                value={entry.revision}
              />
              {invoiceRows.length > 0 ? (
                <div className="border-burgundy/15 overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {text.invoiceColumn}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {text.orderColumn}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {text.dueColumn}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {text.invoiceAmountColumn}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {text.openColumn}
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          {text.thisEntryColumn}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceRows.map((row) => (
                        <tr key={row.id} className="border-burgundy/8 border-b">
                          <td className="px-4 py-3 font-mono text-xs">
                            <Link
                              href={
                                `/${locale}/admin/finance/invoices/${row.id}` as Route
                              }
                              className="text-burgundy hover:underline"
                            >
                              {row.invoiceNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {row.orderCode}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {formatDate(row.dueAt, locale)}
                            {row.overdue ? (
                              <span className="text-lacquer ml-2 font-semibold">
                                {text.overdue}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {formatMoney(money(row.amount, currency), locale)}
                          </td>
                          <td className="text-lacquer px-4 py-3 font-mono text-xs font-semibold">
                            {formatMoney(money(row.open, currency), locale)}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              name={`alloc:invoice:${row.id}`}
                              inputMode="decimal"
                              pattern="[0-9]*([.][0-9]+)?"
                              defaultValue={row.own}
                              placeholder="0"
                              className={inputClass}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {orderRows.length > 0 ? (
                <div className="mt-5">
                  <p className="text-charcoal/60 text-xs font-semibold tracking-[0.12em] uppercase">
                    {text.depositRowsTitle}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {orderRows.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center gap-4 text-sm"
                      >
                        <Link
                          href={`/${locale}/admin/orders/${row.id}` as Route}
                          className="text-burgundy w-40 font-mono text-xs hover:underline"
                        >
                          {row.orderCode}
                        </Link>
                        <input
                          type="text"
                          name={`alloc:order:${row.id}`}
                          inputMode="decimal"
                          pattern="[0-9]*([.][0-9]+)?"
                          defaultValue={row.own}
                          placeholder="0"
                          className={inputClass}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <button
                type="submit"
                className="bg-lacquer text-ivory hover:bg-burgundy mt-5 inline-flex min-h-11 items-center rounded-full px-7 text-sm font-semibold"
              >
                {text.save}
              </button>
            </form>
          )}
        </section>
      ) : null}

      {canVoid ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.voidTitle}</h2>
          <form
            action={voidFinanceEntryAction}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value="payments" />
            <input type="hidden" name="entryId" value={entry.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={entry.revision}
            />
            <div>
              <label
                htmlFor="void-reason"
                className="text-charcoal/55 mb-1.5 block text-xs font-semibold tracking-[0.08em] uppercase"
              >
                {text.voidReason}
              </label>
              <input
                id="void-reason"
                type="text"
                name="reason"
                required
                maxLength={2000}
                className="border-burgundy/20 w-72 rounded-xl border bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="text-lacquer border-lacquer/40 hover:bg-lacquer/5 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
            >
              {text.voidButton}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
