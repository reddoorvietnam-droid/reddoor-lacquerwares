import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import type { OrderReadDto } from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import {
  add,
  formatMoney,
  subtract,
  zero,
  type Currency,
  type Money,
} from "@/lib/money";

import { setPaymentDueAtAction } from "../actions";
import { formatTotals, OutcomeBanner } from "../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tài chính",
    title: "Công nợ khách hàng",
    description:
      "Mỗi đơn hàng có giá bán: công nợ = giá bán trừ tổng đã thu. Đơn quá hạn thanh toán mà còn thiếu tiền được đánh dấu đỏ. Hạn thanh toán do kế toán đặt cho từng đơn.",
    priceHiddenNote:
      "Bạn không có quyền xem giá bán nên cột công nợ bị ẩn — chỉ hiển thị số đã thu và hạn thanh toán.",
    empty: "Chưa có đơn hàng nào có giá bán trong phạm vi của bạn.",
    codeColumn: "Mã đơn",
    customerColumn: "Khách hàng",
    priceColumn: "Giá bán",
    paidColumn: "Đã thu",
    remainingColumn: "Còn thiếu",
    dueColumn: "Hạn thanh toán",
    statusColumn: "Trạng thái",
    overdue: "Quá hạn",
    settled: "Đã đủ",
    open: "Còn nợ",
    noDue: "Chưa đặt",
    saveDue: "Lưu",
    outstandingTotal: "Tổng còn phải thu",
    byCustomerTitle: "Công nợ theo khách hàng",
    byCustomerCustomer: "Khách hàng",
    byCustomerRemaining: "Còn thiếu",
  },
  en: {
    eyebrow: "Finance",
    title: "Customer receivables",
    description:
      "For each priced order: outstanding = selling price minus collected. An order past its due date with money still owed is flagged. The accountant sets each order's due date.",
    priceHiddenNote:
      "You cannot read selling prices, so the outstanding column is hidden — only collected amounts and due dates are shown.",
    empty: "No priced orders inside your scope yet.",
    codeColumn: "Code",
    customerColumn: "Customer",
    priceColumn: "Price",
    paidColumn: "Collected",
    remainingColumn: "Outstanding",
    dueColumn: "Due date",
    statusColumn: "Status",
    overdue: "Overdue",
    settled: "Settled",
    open: "Open",
    noDue: "Not set",
    saveDue: "Save",
    outstandingTotal: "Total outstanding",
    byCustomerTitle: "Receivables by customer",
    byCustomerCustomer: "Customer",
    byCustomerRemaining: "Outstanding",
  },
} as const;

function isPositive(value: Money): boolean {
  return !value.amount.startsWith("-") && Number(value.amount) !== 0;
}

export default async function FinanceReceivablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale }, { error, notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  try {
    await requireListAccess("receivables.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "orders.readSellingPrice",
    "payments.record",
  ] as const);
  const priceVisible = coverages["orders.readSellingPrice"].global;

  let orders: OrderReadDto[] = [];
  try {
    const { scope } = await requireListAccess("orders.read");
    orders = (await orderCommandService.list(scope, priceVisible)).filter(
      (order) => order.stage !== "cancelled",
    );
  } catch (cause) {
    if (!(cause instanceof ContentAccessDeniedError)) throw cause;
  }

  const pricedOrders = priceVisible
    ? orders.filter((order) => order.sellingPrice !== null)
    : orders;
  const paidByOrder = await financeCommandService.sumActiveByOrder(
    pricedOrders.map((order) => order.id),
    "receipt",
  );

  const now = new Date();
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  type Row = {
    order: OrderReadDto;
    paid: readonly Money[];
    remaining: Money | null;
    overdue: boolean;
  };

  const rows: Row[] = pricedOrders.map((order) => {
    const paid = paidByOrder.get(order.id) ?? [];
    let remaining: Money | null = null;
    if (order.sellingPrice) {
      const paidSame =
        paid.find((value) => value.currency === order.sellingPrice?.currency) ??
        zero(order.sellingPrice.currency);
      remaining = subtract(order.sellingPrice, paidSame);
    }
    const overdue =
      remaining !== null &&
      isPositive(remaining) &&
      order.paymentDueAt !== null &&
      order.paymentDueAt.getTime() < now.getTime();
    return { order, paid, remaining, overdue };
  });

  const outstandingTotals = new Map<Currency, Money>();
  for (const row of rows) {
    if (!row.remaining || !isPositive(row.remaining)) continue;
    const current = outstandingTotals.get(row.remaining.currency);
    outstandingTotals.set(
      row.remaining.currency,
      current ? add(current, row.remaining) : row.remaining,
    );
  }

  const byCustomer = new Map<string, Map<Currency, Money>>();
  for (const row of rows) {
    if (!row.remaining || !isPositive(row.remaining)) continue;
    const totals =
      byCustomer.get(row.order.customerName) ?? new Map<Currency, Money>();
    const current = totals.get(row.remaining.currency);
    totals.set(
      row.remaining.currency,
      current ? add(current, row.remaining) : row.remaining,
    );
    byCustomer.set(row.order.customerName, totals);
  }

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      <OutcomeBanner locale={locale} error={error} notice={notice} />

      {!priceVisible ? (
        <p className="border-gold/45 bg-gold/10 text-charcoal/75 mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {text.priceHiddenNote}
        </p>
      ) : (
        <p className="text-charcoal/60 mt-8 text-sm">
          {text.outstandingTotal}:{" "}
          <span className="text-lacquer font-mono font-semibold">
            {formatTotals([...outstandingTotals.values()], locale)}
          </span>
        </p>
      )}

      <section className="mt-8">
        {rows.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.title}</caption>
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.codeColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.customerColumn}
                  </th>
                  {priceVisible ? (
                    <th scope="col" className="px-5 py-4 font-semibold">
                      {text.priceColumn}
                    </th>
                  ) : null}
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.paidColumn}
                  </th>
                  {priceVisible ? (
                    <th scope="col" className="px-5 py-4 font-semibold">
                      {text.remainingColumn}
                    </th>
                  ) : null}
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.dueColumn}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.statusColumn}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ order, paid, remaining, overdue }) => {
                  const canSetDue =
                    coverages["payments.record"].global ||
                    coverageReaches(
                      coverages["payments.record"],
                      order.businessUnitIds,
                    );
                  const settled = remaining !== null && !isPositive(remaining);
                  return (
                    <tr
                      key={order.id}
                      className={
                        overdue
                          ? "border-burgundy/8 bg-lacquer/5 border-b"
                          : "border-burgundy/8 border-b"
                      }
                    >
                      <th
                        scope="row"
                        className="text-burgundy px-5 py-4 text-left font-mono text-xs font-semibold"
                      >
                        {order.orderCode}
                      </th>
                      <td className="text-charcoal/75 px-5 py-4">
                        {order.customerName}
                      </td>
                      {priceVisible ? (
                        <td className="px-5 py-4 font-mono text-xs">
                          {order.sellingPrice
                            ? formatMoney(order.sellingPrice, locale)
                            : "—"}
                        </td>
                      ) : null}
                      <td className="px-5 py-4 font-mono text-xs text-emerald-700">
                        {paid.length > 0 ? formatTotals(paid, locale) : "—"}
                      </td>
                      {priceVisible ? (
                        <td className="px-5 py-4 font-mono text-xs font-semibold">
                          {remaining ? (
                            <span
                              className={
                                isPositive(remaining)
                                  ? "text-lacquer"
                                  : "text-emerald-700"
                              }
                            >
                              {formatMoney(remaining, locale)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                      <td className="px-5 py-4 text-xs">
                        {canSetDue ? (
                          <form
                            action={setPaymentDueAtAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input
                              type="hidden"
                              name="orderId"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="expectedRevision"
                              value={order.revision}
                            />
                            <input
                              type="date"
                              name="paymentDueAt"
                              defaultValue={
                                order.paymentDueAt
                                  ? order.paymentDueAt
                                      .toISOString()
                                      .slice(0, 10)
                                  : ""
                              }
                              className="border-burgundy/20 rounded-lg border bg-white px-2 py-1.5 text-xs"
                            />
                            <button
                              type="submit"
                              className="text-burgundy border-burgundy/25 hover:bg-ivory/70 rounded-full border px-3 py-1.5 text-xs font-semibold"
                            >
                              {text.saveDue}
                            </button>
                          </form>
                        ) : order.paymentDueAt ? (
                          dateFormat.format(order.paymentDueAt)
                        ) : (
                          <span className="text-charcoal/40">{text.noDue}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {overdue ? (
                          <span className="bg-lacquer/10 text-lacquer inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                            {text.overdue}
                          </span>
                        ) : settled ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            {text.settled}
                          </span>
                        ) : (
                          <span className="text-charcoal/55 bg-charcoal/6 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                            {text.open}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {priceVisible && byCustomer.size > 0 ? (
        <section className="mt-12 max-w-2xl">
          <h2 className="text-burgundy font-serif text-3xl">
            {text.byCustomerTitle}
          </h2>
          <div className="border-burgundy/15 mt-5 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">{text.byCustomerTitle}</caption>
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.byCustomerCustomer}
                  </th>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    {text.byCustomerRemaining}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...byCustomer.entries()].map(([customer, totals]) => (
                  <tr key={customer} className="border-burgundy/8 border-b">
                    <th
                      scope="row"
                      className="text-charcoal/80 px-5 py-4 text-left font-semibold"
                    >
                      {customer}
                    </th>
                    <td className="text-lacquer px-5 py-4 font-mono text-xs font-semibold">
                      {formatTotals([...totals.values()], locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
