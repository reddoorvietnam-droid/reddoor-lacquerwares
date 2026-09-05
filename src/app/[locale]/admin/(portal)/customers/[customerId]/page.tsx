import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { customerCommandService } from "@/domains/customers/runtime";
import type { FinanceEntryRecordDto } from "@/domains/finance/contracts";
import { financeCommandService } from "@/domains/finance/runtime";
import type { ReceivablesReport } from "@/domains/finance/receivables";
import { orderCommandService } from "@/domains/orders/runtime";
import { orderStageDefinitions } from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney, type Money } from "@/lib/money";

import { FinanceEntryForm } from "../../finance/entry-form";
import { EntryTable, OutcomeBanner as FinanceBanner } from "../../finance/shared";
import { setCustomerStatusAction } from "../actions";
import { CustomerForm, customerCopy } from "../customer-form";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Danh sách khách hàng",
    eyebrow: "Khách hàng",
    archived: "Đã lưu trữ",
    detailsTitle: "Thông tin",
    archive: "Lưu trữ khách hàng",
    restore: "Khôi phục",
    balanceTitle: "Công nợ",
    invoiced: "Đã xuất hóa đơn",
    received: "Đã thu",
    refunded: "Đã hoàn",
    outstanding: "Còn phải thu",
    credit: "Trả trước / dư",
    balance: "Cân đối",
    overdue: "hóa đơn quá hạn",
    noBalance: "Chưa có hóa đơn hay tiền thu nào.",
    refundTitle: "Hoàn tiền cho khách",
    refundHint:
      "Chỉ dùng khi thực sự chuyển trả lại tiền. Số tiền không được vượt phần khách đang trả dư.",
    ordersTitle: "Đơn hàng",
    noOrders: "Chưa có đơn hàng nào.",
    codeColumn: "Mã đơn",
    stageColumn: "Bước hiện tại",
    priceColumn: "Giá bán",
    receiptsTitle: "Tiền khách đã trả",
    errorLead: "Thao tác không thành công:",
  },
  en: {
    back: "← Customer list",
    eyebrow: "Customer",
    archived: "Archived",
    detailsTitle: "Details",
    archive: "Archive customer",
    restore: "Restore",
    balanceTitle: "Receivables",
    invoiced: "Invoiced",
    received: "Received",
    refunded: "Refunded",
    outstanding: "Outstanding",
    credit: "Advance / credit",
    balance: "Balance",
    overdue: "overdue invoice(s)",
    noBalance: "No invoice or receipt yet.",
    refundTitle: "Refund the customer",
    refundHint:
      "Only when money is actually returned. The amount may not exceed the customer's credit.",
    ordersTitle: "Orders",
    noOrders: "No orders yet.",
    codeColumn: "Code",
    stageColumn: "Current stage",
    priceColumn: "Price",
    receiptsTitle: "Money received",
    errorLead: "The action failed:",
  },
} as const;

function isPositive(value: Money): boolean {
  return !value.amount.startsWith("-") && Number(value.amount) !== 0;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; customerId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, customerId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];
  const formText = customerCopy[locale];

  if (!/^[a-f0-9]{24}$/.test(customerId)) notFound();

  try {
    await requirePermission("customers.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const customer = await customerCommandService.findById(customerId);
  if (!customer) notFound();

  const coverages = await resolvePermissionCoverages([
    "customers.update",
    "customers.archive",
    "orders.read",
    "orders.readSellingPrice",
    "invoices.read",
    "payments.read",
    "payments.refund",
    "payments.reverse",
  ] as const);
  const canEdit = coverages["customers.update"].global;
  const canArchive = coverages["customers.archive"].global;
  const priceVisible = coverages["orders.readSellingPrice"].global;

  let orders: Awaited<ReturnType<typeof orderCommandService.listByCustomer>> = [];
  if (coverages["orders.read"].global) {
    orders = await orderCommandService.listByCustomer(customer.id, priceVisible);
  }

  let report: ReceivablesReport | null = null;
  if (coverages["invoices.read"].global) {
    report = await financeCommandService.customerReceivables(customer.id);
  }
  const rows = report
    ? report.customers.filter((row) => row.customerId === customer.id)
    : [];
  const creditRows = rows.filter((row) => isPositive(row.credit));

  let receipts: FinanceEntryRecordDto[] = [];
  if (coverages["payments.read"].global) {
    const { scope } = await requireListAccess("payments.read");
    receipts = await financeCommandService.list({
      scope,
      customerId: customer.id,
      limit: 100,
    });
  }

  const cardClass =
    "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
  const financeNotices = new Set(["recorded", "refunded", "voided"]);

  return (
    <div>
      <Link
        href={`/${locale}/admin/customers` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
            {customer.name}
          </h1>
          <p className="text-charcoal/60 mt-3 font-mono text-sm">
            {[customer.code, customer.taxCode ? `MST ${customer.taxCode}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {customer.status === "archived" ? (
          <p className="text-charcoal/60 bg-charcoal/8 rounded-full px-4 py-2 text-sm font-semibold">
            {text.archived}
          </p>
        ) : null}
      </div>

      {notice && financeNotices.has(notice) ? (
        <FinanceBanner locale={locale} notice={notice} />
      ) : notice && formText.notices[notice] ? (
        <p className="mt-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {formText.notices[notice]}
        </p>
      ) : null}
      {error ? (
        formText.errors[error] ? (
          <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
            {text.errorLead} {formText.errors[error]}
          </p>
        ) : (
          <FinanceBanner locale={locale} error={error} />
        )
      ) : null}

      {rows.length > 0 ? (
        <section className={`${cardClass} mt-8`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.balanceTitle}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {rows.map((row) => (
              <dl
                key={row.currency}
                className="border-burgundy/10 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border p-4 text-sm"
              >
                <dt className="text-charcoal/50 col-span-2 font-mono text-xs font-semibold">
                  {row.currency}
                </dt>
                <dt className="text-charcoal/60">{text.invoiced}</dt>
                <dd className="text-right font-mono">{formatMoney(row.invoiced, locale)}</dd>
                <dt className="text-charcoal/60">{text.received}</dt>
                <dd className="text-right font-mono text-emerald-700">
                  {formatMoney(row.received, locale)}
                </dd>
                {isPositive(row.refunded) ? (
                  <>
                    <dt className="text-charcoal/60">{text.refunded}</dt>
                    <dd className="text-right font-mono">{formatMoney(row.refunded, locale)}</dd>
                  </>
                ) : null}
                <dt className="text-charcoal/60">{text.outstanding}</dt>
                <dd className="text-lacquer text-right font-mono font-semibold">
                  {formatMoney(row.outstanding, locale)}
                  {row.overdueInvoiceCount > 0 ? (
                    <span className="ml-2 text-xs font-normal">
                      ({row.overdueInvoiceCount} {text.overdue})
                    </span>
                  ) : null}
                </dd>
                <dt className="text-charcoal/60">{text.credit}</dt>
                <dd className="text-right font-mono font-semibold text-emerald-700">
                  {formatMoney(row.credit, locale)}
                </dd>
                <dt className="text-charcoal/80 font-semibold">{text.balance}</dt>
                <dd
                  className={`text-right font-mono font-semibold ${
                    isPositive(row.balance) ? "text-lacquer" : "text-emerald-700"
                  }`}
                >
                  {formatMoney(row.balance, locale)}
                </dd>
              </dl>
            ))}
          </div>
        </section>
      ) : report ? (
        <p className="text-charcoal/55 mt-8 text-sm">{text.noBalance}</p>
      ) : null}

      {coverages["payments.refund"].global && creditRows.length > 0 ? (
        <div className="mt-6">
          <FinanceEntryForm
            locale={locale}
            title={text.refundTitle}
            returnTo={`customer:${customer.id}`}
            categories={["refund"]}
            hidden={{ customerId: customer.id }}
            defaultCurrency={creditRows[0]!.currency}
            defaultAmount={creditRows[0]!.credit.amount}
            submitLabel={text.refundTitle}
            idPrefix="refund"
          />
          <p className="text-charcoal/50 mt-2 text-xs">{text.refundHint}</p>
        </div>
      ) : null}

      {coverages["orders.read"].global ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.ordersTitle}</h2>
          {orders.length === 0 ? (
            <p className="text-charcoal/55 mt-3 text-sm">{text.noOrders}</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-3 py-2 font-semibold">{text.codeColumn}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{text.stageColumn}</th>
                  {priceVisible ? (
                    <th scope="col" className="px-3 py-2 font-semibold">{text.priceColumn}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-burgundy/8 border-b">
                    <td className="px-3 py-2">
                      <Link
                        href={`/${locale}/admin/orders/${order.id}` as Route}
                        className="text-burgundy font-mono text-xs font-semibold hover:underline"
                      >
                        {order.orderCode}
                      </Link>
                    </td>
                    <td className="text-charcoal/70 px-3 py-2 text-xs">
                      {orderStageDefinitions[order.stage].labels[locale]}
                    </td>
                    {priceVisible ? (
                      <td className="px-3 py-2 font-mono text-xs">
                        {order.sellingPrice ? formatMoney(order.sellingPrice, locale) : "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {coverages["payments.read"].global ? (
        <section className="mt-6">
          <h2 className="text-burgundy font-serif text-2xl">{text.receiptsTitle}</h2>
          <div className="mt-4">
            <EntryTable
              locale={locale}
              entries={receipts}
              returnTo={`customer:${customer.id}`}
              showKind
              showAllocation
              canVoid={(entry) =>
                entry.kind === "receipt" && coverages["payments.reverse"].global
              }
            />
          </div>
        </section>
      ) : null}

      {canEdit ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.detailsTitle}</h2>
          <div className="mt-5">
            <CustomerForm locale={locale} customer={customer} />
          </div>
        </section>
      ) : (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.detailsTitle}</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <dt className="text-charcoal/50">{formText.country}</dt>
            <dd>{customer.country ?? "—"}</dd>
            <dt className="text-charcoal/50">{formText.address}</dt>
            <dd>{customer.address ?? "—"}</dd>
            <dt className="text-charcoal/50">{formText.defaultCurrency}</dt>
            <dd className="font-mono">{customer.defaultCurrency ?? "—"}</dd>
          </dl>
        </section>
      )}

      {canArchive ? (
        <form action={setCustomerStatusAction} className="mt-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="expectedRevision" value={customer.revision} />
          <input
            type="hidden"
            name="status"
            value={customer.status === "archived" ? "active" : "archived"}
          />
          <button
            type="submit"
            className="text-lacquer border-lacquer/40 hover:bg-lacquer/5 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
          >
            {customer.status === "archived" ? text.restore : text.archive}
          </button>
        </form>
      ) : null}
    </div>
  );
}
