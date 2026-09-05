import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney, type Money } from "@/lib/money";

import { formatDate, formatTotals, OutcomeBanner } from "../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tài chính",
    title: "Công nợ khách hàng",
    description:
      "Mỗi hóa đơn có hạn thanh toán riêng: còn thiếu = giá trị hóa đơn trừ tiền đã gắn vào hóa đơn (kể cả tiền cọc của đơn). Hóa đơn quá hạn mà còn thiếu được đánh dấu đỏ. Tiền khách chuyển chưa gắn vào đâu là tiền trả trước, hiện ở cột trả trước và tự bù cho hóa đơn sau.",
    outstandingTotal: "Tổng còn phải thu",
    creditTotal: "Tổng khách trả trước",
    overdueTotal: "Hóa đơn quá hạn",
    invoicesTitle: "Theo hóa đơn",
    emptyInvoices: "Chưa có hóa đơn nào trong phạm vi của bạn.",
    invoiceColumn: "Hóa đơn",
    orderColumn: "Đơn hàng",
    customerColumn: "Khách hàng",
    dueColumn: "Hạn thanh toán",
    amountColumn: "Giá trị",
    paidColumn: "Đã trả",
    remainingColumn: "Còn thiếu",
    statusColumn: "Trạng thái",
    overdue: "Quá hạn",
    settled: "Đã đủ",
    open: "Còn nợ",
    customersTitle: "Theo khách hàng",
    invoicedColumn: "Đã xuất hóa đơn",
    receivedColumn: "Đã thu",
    refundedColumn: "Đã hoàn",
    creditColumn: "Trả trước / dư",
    balanceColumn: "Cân đối",
    balanceHint: "Cân đối = còn thiếu trừ trả trước. Âm nghĩa là khách đang trả dư.",
  },
  en: {
    eyebrow: "Finance",
    title: "Customer receivables",
    description:
      "Each invoice has its own due date: open = invoice amount minus the money applied to it (including the order's deposit). An overdue invoice with money still owed is flagged. Money a customer transferred without a target is an advance, shown in its own column and offset against the next invoice.",
    outstandingTotal: "Total outstanding",
    creditTotal: "Total customer advances",
    overdueTotal: "Overdue invoices",
    invoicesTitle: "By invoice",
    emptyInvoices: "No invoices inside your scope yet.",
    invoiceColumn: "Invoice",
    orderColumn: "Order",
    customerColumn: "Customer",
    dueColumn: "Due date",
    amountColumn: "Amount",
    paidColumn: "Paid",
    remainingColumn: "Open",
    statusColumn: "Status",
    overdue: "Overdue",
    settled: "Settled",
    open: "Open",
    customersTitle: "By customer",
    invoicedColumn: "Invoiced",
    receivedColumn: "Received",
    refundedColumn: "Refunded",
    creditColumn: "Advance / credit",
    balanceColumn: "Balance",
    balanceHint: "Balance = outstanding minus advance. Negative means the customer is in advance.",
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

  let scope;
  try {
    ({ scope } = await requireListAccess("receivables.read"));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  // Receivables are invoice amounts; without the invoice read there is
  // nothing this page may show.
  const coverages = await resolvePermissionCoverages(["invoices.read"] as const);
  if (!coverages["invoices.read"].global) notFound();

  const report = await financeCommandService.receivables(scope);

  const thClass = "px-5 py-4 font-semibold";
  const headClass =
    "border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase";

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

      <div className="text-charcoal/60 mt-8 flex flex-wrap gap-x-10 gap-y-2 text-sm">
        <p>
          {text.outstandingTotal}:{" "}
          <span className="text-lacquer font-mono font-semibold">
            {formatTotals(report.totals.outstanding, locale)}
          </span>
        </p>
        <p>
          {text.creditTotal}:{" "}
          <span className="font-mono font-semibold text-emerald-700">
            {formatTotals(report.totals.credit, locale)}
          </span>
        </p>
        <p>
          {text.overdueTotal}:{" "}
          <span
            className={`font-mono font-semibold ${
              report.totals.overdueInvoiceCount > 0
                ? "text-lacquer"
                : "text-charcoal/70"
            }`}
          >
            {report.totals.overdueInvoiceCount}
          </span>
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-burgundy font-serif text-3xl">{text.invoicesTitle}</h2>
        {report.invoices.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 mt-5 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.emptyInvoices}
          </p>
        ) : (
          <div className="border-burgundy/15 mt-5 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.invoicesTitle}</caption>
              <thead>
                <tr className={headClass}>
                  <th scope="col" className={thClass}>{text.invoiceColumn}</th>
                  <th scope="col" className={thClass}>{text.orderColumn}</th>
                  <th scope="col" className={thClass}>{text.customerColumn}</th>
                  <th scope="col" className={thClass}>{text.dueColumn}</th>
                  <th scope="col" className={thClass}>{text.amountColumn}</th>
                  <th scope="col" className={thClass}>{text.paidColumn}</th>
                  <th scope="col" className={thClass}>{text.remainingColumn}</th>
                  <th scope="col" className={thClass}>{text.statusColumn}</th>
                </tr>
              </thead>
              <tbody>
                {report.invoices.map((row) => {
                  const settled = !isPositive(row.remaining);
                  const paid = {
                    amount: row.paid.amount,
                    currency: row.paid.currency,
                  };
                  return (
                    <tr
                      key={row.invoice.id}
                      className={
                        row.overdue
                          ? "border-burgundy/8 bg-lacquer/5 border-b"
                          : "border-burgundy/8 border-b"
                      }
                    >
                      <th scope="row" className="px-5 py-4 text-left">
                        <Link
                          href={
                            `/${locale}/admin/finance/invoices/${row.invoice.id}` as Route
                          }
                          className="text-burgundy font-mono text-xs font-semibold hover:underline"
                        >
                          {row.invoice.invoiceNumber}
                        </Link>
                      </th>
                      <td className="px-5 py-4 font-mono text-xs">
                        <Link
                          href={`/${locale}/admin/orders/${row.invoice.orderId}` as Route}
                          className="hover:underline"
                        >
                          {row.invoice.orderCode}
                        </Link>
                      </td>
                      <td className="text-charcoal/75 px-5 py-4">
                        {row.invoice.customerId ? (
                          <Link
                            href={
                              `/${locale}/admin/customers/${row.invoice.customerId}` as Route
                            }
                            className="hover:underline"
                          >
                            {row.invoice.customerName}
                          </Link>
                        ) : (
                          row.invoice.customerName
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {formatDate(row.invoice.dueAt, locale)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        {formatMoney(row.invoice.amount, locale)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-emerald-700">
                        {formatMoney(
                          {
                            amount: (
                              Number(paid.amount) + Number(row.depositApplied.amount)
                            ).toString(),
                            currency: paid.currency,
                          },
                          locale,
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold">
                        <span className={settled ? "text-emerald-700" : "text-lacquer"}>
                          {formatMoney(row.remaining, locale)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {row.overdue ? (
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

      {report.customers.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-burgundy font-serif text-3xl">{text.customersTitle}</h2>
          <p className="text-charcoal/55 mt-2 text-sm">{text.balanceHint}</p>
          <div className="border-burgundy/15 mt-5 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.customersTitle}</caption>
              <thead>
                <tr className={headClass}>
                  <th scope="col" className={thClass}>{text.customerColumn}</th>
                  <th scope="col" className={thClass}>{text.invoicedColumn}</th>
                  <th scope="col" className={thClass}>{text.receivedColumn}</th>
                  <th scope="col" className={thClass}>{text.refundedColumn}</th>
                  <th scope="col" className={thClass}>{text.remainingColumn}</th>
                  <th scope="col" className={thClass}>{text.creditColumn}</th>
                  <th scope="col" className={thClass}>{text.balanceColumn}</th>
                </tr>
              </thead>
              <tbody>
                {report.customers.map((row) => (
                  <tr
                    key={`${row.customerKey}|${row.currency}`}
                    className="border-burgundy/8 border-b"
                  >
                    <th scope="row" className="text-charcoal/80 px-5 py-4 text-left font-semibold">
                      {row.customerId ? (
                        <Link
                          href={`/${locale}/admin/customers/${row.customerId}` as Route}
                          className="hover:underline"
                        >
                          {row.customerName}
                        </Link>
                      ) : (
                        row.customerName
                      )}
                      <span className="text-charcoal/45 ml-2 font-mono text-xs">
                        {row.currency}
                      </span>
                    </th>
                    <td className="px-5 py-4 font-mono text-xs">
                      {formatMoney(row.invoiced, locale)}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-emerald-700">
                      {formatMoney(row.received, locale)}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {formatMoney(row.refunded, locale)}
                    </td>
                    <td className="text-lacquer px-5 py-4 font-mono text-xs font-semibold">
                      {formatMoney(row.outstanding, locale)}
                      {row.overdueInvoiceCount > 0 ? (
                        <span className="ml-2 text-[0.65rem] font-semibold uppercase">
                          {text.overdue} ×{row.overdueInvoiceCount}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-emerald-700">
                      {formatMoney(row.credit, locale)}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-semibold">
                      <span className={isPositive(row.balance) ? "text-lacquer" : "text-emerald-700"}>
                        {formatMoney(row.balance, locale)}
                      </span>
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
