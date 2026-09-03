import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import type { OrderReadDto } from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { add, subtract, zero, type Currency, type Money } from "@/lib/money";

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
      "Bức tranh dòng tiền theo luồng đã chốt: Đơn hàng → Thanh toán → Thu/Chi → Chi phí → Công nợ. Doanh thu tính theo giá bán đơn hàng; số liệu tách riêng từng loại tiền tệ.",
    revenue: "Doanh thu (giá bán các đơn)",
    collected: "Đã thu",
    spent: "Đã chi",
    outstanding: "Còn phải thu",
    overdueOrders: "Đơn quá hạn thanh toán",
    recentTitle: "Phiếu gần đây",
    viewLedger: "Mở sổ thu – chi",
    viewReceivables: "Xem công nợ",
  },
  en: {
    eyebrow: "Finance",
    title: "Finance overview",
    description:
      "The cash picture along the confirmed flow: Order → Payment → Ledger → Costs → Receivables. Revenue follows the order selling price; figures are kept per currency.",
    revenue: "Revenue (order prices)",
    collected: "Collected",
    spent: "Spent",
    outstanding: "Outstanding",
    overdueOrders: "Orders past due date",
    recentTitle: "Recent entries",
    viewLedger: "Open the cash ledger",
    viewReceivables: "View receivables",
  },
} as const;

function isPositive(value: Money): boolean {
  return !value.amount.startsWith("-") && Number(value.amount) !== 0;
}

function addInto(totals: Map<Currency, Money>, value: Money): void {
  const current = totals.get(value.currency);
  totals.set(value.currency, current ? add(current, value) : value);
}

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
    "orders.readSellingPrice",
  ] as const);
  const priceVisible = coverages["orders.readSellingPrice"].global;

  const entries = await financeCommandService.list({ scope, limit: 500 });

  let orders: OrderReadDto[] = [];
  try {
    const { scope: orderScope } = await requireListAccess("orders.read");
    orders = (await orderCommandService.list(orderScope, priceVisible)).filter(
      (order) => order.stage !== "cancelled",
    );
  } catch (cause) {
    if (!(cause instanceof ContentAccessDeniedError)) throw cause;
  }

  const collected = sumEntriesByCurrency(
    entries.filter((entry) => entry.kind === "receipt"),
  );
  const spent = sumEntriesByCurrency(
    entries.filter((entry) => entry.kind === "expense"),
  );

  let revenue: Money[] = [];
  let outstanding: Money[] = [];
  let overdueCount = 0;

  if (priceVisible) {
    const pricedOrders = orders.filter((order) => order.sellingPrice !== null);
    const paidByOrder = await financeCommandService.sumActiveByOrder(
      pricedOrders.map((order) => order.id),
      "receipt",
    );

    const revenueTotals = new Map<Currency, Money>();
    const outstandingTotals = new Map<Currency, Money>();
    const now = new Date();

    for (const order of pricedOrders) {
      if (!order.sellingPrice) continue;
      addInto(revenueTotals, order.sellingPrice);

      const paid =
        (paidByOrder.get(order.id) ?? []).find(
          (value) => value.currency === order.sellingPrice?.currency,
        ) ?? zero(order.sellingPrice.currency);
      const remaining = subtract(order.sellingPrice, paid);
      if (isPositive(remaining)) {
        addInto(outstandingTotals, remaining);
        if (order.paymentDueAt && order.paymentDueAt < now) {
          overdueCount += 1;
        }
      }
    }

    revenue = [...revenueTotals.values()];
    outstanding = [...outstandingTotals.values()];
  }

  const cards: { label: string; value: string; tone: string }[] = [
    ...(priceVisible
      ? [
          {
            label: text.revenue,
            value: formatTotals(revenue, locale),
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
    ...(priceVisible
      ? [
          {
            label: text.outstanding,
            value: formatTotals(outstanding, locale),
            tone: "text-lacquer",
          },
          {
            label: text.overdueOrders,
            value: String(overdueCount),
            tone: overdueCount > 0 ? "text-lacquer" : "text-charcoal/70",
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
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/${locale}/admin/finance/ledger` as Route}
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold"
        >
          {text.viewLedger}
        </Link>
        <Link
          href={`/${locale}/admin/finance/receivables` as Route}
          className="text-burgundy border-burgundy/25 hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
        >
          {text.viewReceivables}
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
