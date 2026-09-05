import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  financeCommandService,
  fxRateService,
  invoiceCommandService,
} from "@/domains/finance/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney, type Money } from "@/lib/money";

import { voidInvoiceAction } from "../actions";
import type { EntryFormOption } from "../entry-form";
import { InvoiceForm } from "../invoice-form";
import { formatDate, formatTotals, OutcomeBanner } from "../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tài chính",
    title: "Hóa đơn (INV)",
    description:
      "Doanh thu ghi theo hóa đơn xuất cho khách. Mỗi hóa đơn có hạn thanh toán riêng; hóa đơn USD giữ tỷ giá của ngày lập để quy đổi báo cáo. Hóa đơn sai thì hủy kèm lý do rồi lập lại, số hóa đơn được dùng lại.",
    formTitle: "Lập hóa đơn",
    revenue: "Tổng doanh thu (hóa đơn còn hiệu lực)",
    revenueVnd: "Quy đổi VND",
    numberColumn: "Số hóa đơn",
    orderColumn: "Đơn hàng",
    customerColumn: "Khách hàng",
    issuedColumn: "Ngày lập",
    dueColumn: "Hạn",
    amountColumn: "Giá trị",
    remainingColumn: "Còn thiếu",
    rateColumn: "Tỷ giá",
    actionColumn: "Thao tác",
    overdue: "Quá hạn",
    settled: "Đã đủ",
    voided: "Đã hủy",
    voidButton: "Hủy",
    voidReasonPlaceholder: "Lý do hủy…",
    empty: "Chưa có hóa đơn nào.",
    orderOption: (code: string, customer: string) => `${code} · ${customer}`,
  },
  en: {
    eyebrow: "Finance",
    title: "Invoices (INV)",
    description:
      "Revenue follows the invoices issued to customers. Each invoice has its own due date; a USD invoice keeps the rate of its issue date for reporting. A wrong invoice is voided with a reason and re-issued; the number can be reused.",
    formTitle: "Issue an invoice",
    revenue: "Revenue (active invoices)",
    revenueVnd: "In VND",
    numberColumn: "Number",
    orderColumn: "Order",
    customerColumn: "Customer",
    issuedColumn: "Issued",
    dueColumn: "Due",
    amountColumn: "Amount",
    remainingColumn: "Open",
    rateColumn: "Rate",
    actionColumn: "Action",
    overdue: "Overdue",
    settled: "Settled",
    voided: "Voided",
    voidButton: "Void",
    voidReasonPlaceholder: "Reason…",
    empty: "No invoices yet.",
    orderOption: (code: string, customer: string) => `${code} · ${customer}`,
  },
} as const;

function isPositive(value: Money): boolean {
  return !value.amount.startsWith("-") && Number(value.amount) !== 0;
}

export default async function FinanceInvoicesPage({
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
    ({ scope } = await requireListAccess("invoices.read"));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages(["invoices.manage"] as const);
  const canManage =
    coverages["invoices.manage"].global ||
    coverages["invoices.manage"].businessUnitIds.length > 0;

  const [invoices, report, todayRate] = await Promise.all([
    invoiceCommandService.list({ scope }),
    financeCommandService.receivables(scope),
    fxRateService.rateOn(new Date()),
  ]);
  const rowById = new Map(report.invoices.map((row) => [row.invoice.id, row]));

  let orders: EntryFormOption[] = [];
  if (canManage) {
    try {
      const { scope: orderScope } = await requireListAccess("orders.read");
      orders = (await orderCommandService.list(orderScope, false))
        .filter((order) => !isTerminalStage(order.stage))
        .map((order) => ({
          value: order.id,
          label: text.orderOption(order.orderCode, order.customerName),
        }));
    } catch (cause) {
      if (!(cause instanceof ContentAccessDeniedError)) throw cause;
    }
  }

  const sorted = [...invoices].sort(
    (left, right) => right.issuedAt.getTime() - left.issuedAt.getTime(),
  );

  const thClass = "px-5 py-4 font-semibold";

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

      <p className="text-charcoal/60 mt-8 text-sm">
        {text.revenue}:{" "}
        <span className="text-burgundy font-mono font-semibold">
          {formatTotals(report.totals.revenue, locale)}
        </span>
        <span className="text-charcoal/45 ml-3 font-mono text-xs">
          {text.revenueVnd}: {formatMoney(report.totals.revenueVnd, locale)}
        </span>
      </p>

      {canManage ? (
        <div className="mt-8">
          <InvoiceForm
            locale={locale}
            title={text.formTitle}
            returnTo="invoices"
            orders={orders}
            todayRate={todayRate?.rate ?? null}
          />
        </div>
      ) : null}

      <section className="mt-10">
        {sorted.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <div className="border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.title}</caption>
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className={thClass}>{text.numberColumn}</th>
                  <th scope="col" className={thClass}>{text.orderColumn}</th>
                  <th scope="col" className={thClass}>{text.customerColumn}</th>
                  <th scope="col" className={thClass}>{text.issuedColumn}</th>
                  <th scope="col" className={thClass}>{text.dueColumn}</th>
                  <th scope="col" className={thClass}>{text.amountColumn}</th>
                  <th scope="col" className={thClass}>{text.rateColumn}</th>
                  <th scope="col" className={thClass}>{text.remainingColumn}</th>
                  <th scope="col" className={thClass}>{text.actionColumn}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((invoice) => {
                  const row = rowById.get(invoice.id);
                  const canVoid =
                    invoice.status === "active" &&
                    (coverages["invoices.manage"].global ||
                      coverageReaches(
                        coverages["invoices.manage"],
                        invoice.businessUnitIds,
                      ));
                  return (
                    <tr
                      key={invoice.id}
                      className={
                        invoice.status === "voided"
                          ? "border-burgundy/8 border-b opacity-45"
                          : row?.overdue
                            ? "border-burgundy/8 bg-lacquer/5 border-b"
                            : "border-burgundy/8 border-b"
                      }
                    >
                      <th scope="row" className="px-5 py-4 text-left">
                        <Link
                          href={`/${locale}/admin/finance/invoices/${invoice.id}` as Route}
                          className="text-burgundy font-mono text-xs font-semibold hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </th>
                      <td className="px-5 py-4 font-mono text-xs">
                        <Link
                          href={`/${locale}/admin/orders/${invoice.orderId}` as Route}
                          className="hover:underline"
                        >
                          {invoice.orderCode}
                        </Link>
                      </td>
                      <td className="text-charcoal/75 px-5 py-4">{invoice.customerName}</td>
                      <td className="px-5 py-4 text-xs">{formatDate(invoice.issuedAt, locale)}</td>
                      <td className="px-5 py-4 text-xs">{formatDate(invoice.dueAt, locale)}</td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold">
                        {formatMoney(invoice.amount, locale)}
                      </td>
                      <td className="text-charcoal/60 px-5 py-4 font-mono text-xs">
                        {invoice.fxRateToVnd ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold">
                        {invoice.status === "voided" ? (
                          <span className="text-charcoal/50">{text.voided}</span>
                        ) : row ? (
                          isPositive(row.remaining) ? (
                            <span className="text-lacquer">
                              {formatMoney(row.remaining, locale)}
                              {row.overdue ? ` · ${text.overdue}` : ""}
                            </span>
                          ) : (
                            <span className="text-emerald-700">{text.settled}</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {invoice.status === "voided" ? (
                          <span className="text-charcoal/50 text-xs">
                            {invoice.voidReason ?? ""}
                          </span>
                        ) : canVoid ? (
                          <form action={voidInvoiceAction} className="flex items-center gap-2">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="returnTo" value="invoices" />
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="expectedRevision" value={invoice.revision} />
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
        )}
      </section>
    </div>
  );
}
