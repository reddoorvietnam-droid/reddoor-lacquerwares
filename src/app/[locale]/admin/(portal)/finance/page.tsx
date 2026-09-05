import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import type { ReceivablesReport } from "@/domains/finance/receivables";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney } from "@/lib/money";

import {
  EntryTable,
  formatTotals,
  OutcomeBanner,
  sumEntriesByCurrency,
} from "./shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tài chính",
    title: "Tổng quan tài chính",
    description:
      "Doanh thu ghi theo hóa đơn (INV), công nợ tính theo từng hóa đơn, tiền khách trả dư giữ lại để bù đơn sau. Số liệu tách riêng từng loại tiền; doanh thu USD quy đổi về VND theo tỷ giá ghi trên từng hóa đơn.",
    revenue: "Doanh thu (theo hóa đơn)",
    revenueVnd: "Quy đổi VND",
    revenueVndIncomplete: "Thiếu tỷ giá trên một số hóa đơn USD",
    collected: "Đã thu",
    spent: "Đã chi",
    outstanding: "Còn phải thu",
    credit: "Khách trả trước / trả dư",
    overdueInvoices: "Hóa đơn quá hạn",
    recentTitle: "Phiếu gần đây",
    viewInvoices: "Hóa đơn",
    viewReceivables: "Công nợ",
    viewLedger: "Sổ thu – chi",
  },
  en: {
    eyebrow: "Finance",
    title: "Finance overview",
    description:
      "Revenue follows the invoices (INV), receivables are per invoice, and customer overpayments are kept to offset later orders. Figures are kept per currency; USD revenue converts to VND through the rate on each invoice.",
    revenue: "Revenue (invoiced)",
    revenueVnd: "In VND",
    revenueVndIncomplete: "Some USD invoices carry no rate",
    collected: "Collected",
    spent: "Spent",
    outstanding: "Outstanding",
    credit: "Customer advances / credit",
    overdueInvoices: "Overdue invoices",
    recentTitle: "Recent entries",
    viewInvoices: "Invoices",
    viewReceivables: "Receivables",
    viewLedger: "Cash ledger",
  },
} as const;

export default async function FinanceOverviewPage({
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
    ({ scope } = await requireListAccess("payments.read"));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "invoices.read",
    "receivables.read",
  ] as const);
  const revenueVisible = coverages["invoices.read"].global;

  const entries = await financeCommandService.list({ scope, limit: 500 });
  const collected = sumEntriesByCurrency(
    entries.filter((entry) => entry.kind === "receipt"),
  );
  const spent = sumEntriesByCurrency(
    entries.filter((entry) => entry.kind === "expense"),
  );

  let report: ReceivablesReport | null = null;
  if (revenueVisible) {
    report = await financeCommandService.receivables(scope);
  }

  const cards: { label: string; value: string; hint?: string; tone: string }[] =
    [
      ...(report
        ? [
            {
              label: text.revenue,
              value: formatTotals(report.totals.revenue, locale),
              hint: `${text.revenueVnd}: ${formatMoney(report.totals.revenueVnd, locale)}${
                report.totals.revenueVndComplete
                  ? ""
                  : ` · ${text.revenueVndIncomplete}`
              }`,
              tone: "text-burgundy",
            },
          ]
        : []),
      {
        label: text.collected,
        value: formatTotals(collected, locale),
        tone: "text-emerald-700",
      },
      {
        label: text.spent,
        value: formatTotals(spent, locale),
        tone: "text-lacquer",
      },
      ...(report
        ? [
            {
              label: text.outstanding,
              value: formatTotals(report.totals.outstanding, locale),
              tone: "text-lacquer",
            },
            {
              label: text.credit,
              value: formatTotals(report.totals.credit, locale),
              tone: "text-emerald-700",
            },
            {
              label: text.overdueInvoices,
              value: String(report.totals.overdueInvoiceCount),
              tone:
                report.totals.overdueInvoiceCount > 0
                  ? "text-lacquer"
                  : "text-charcoal/70",
            },
          ]
        : []),
    ];

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

      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <section
            key={card.label}
            className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]"
          >
            <p className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
              {card.label}
            </p>
            <p className={`mt-3 font-mono text-xl font-semibold ${card.tone}`}>
              {card.value}
            </p>
            {card.hint ? (
              <p className="text-charcoal/50 mt-2 text-xs">{card.hint}</p>
            ) : null}
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {revenueVisible ? (
          <Link
            href={`/${locale}/admin/finance/invoices` as Route}
            className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold"
          >
            {text.viewInvoices}
          </Link>
        ) : null}
        {coverages["receivables.read"].global ? (
          <Link
            href={`/${locale}/admin/finance/receivables` as Route}
            className="text-burgundy border-burgundy/25 hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
          >
            {text.viewReceivables}
          </Link>
        ) : null}
        <Link
          href={`/${locale}/admin/finance/ledger` as Route}
          className="text-burgundy border-burgundy/25 hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
        >
          {text.viewLedger}
        </Link>
      </div>

      <section className="mt-12">
        <h2 className="text-burgundy font-serif text-3xl">
          {text.recentTitle}
        </h2>
        <div className="mt-5">
          <EntryTable
            locale={locale}
            entries={entries.slice(0, 10)}
            returnTo="ledger"
            showKind
            canVoid={() => false}
          />
        </div>
      </section>
    </div>
  );
}
