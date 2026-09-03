import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import { FinanceEntryForm } from "../entry-form";
import {
  EntryTable,
  formatTotals,
  OutcomeBanner,
  sumEntriesByCurrency,
} from "../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Tài chính",
    title: "Chi phí đơn hàng",
    description:
      "Ghi từng khoản chi phí phát sinh cho một đơn hàng — nguyên vật liệu, nhân công, gia công, vận chuyển, đóng gói. Tổng chi phí của đơn được cộng từ các phiếu còn hiệu lực.",
    formTitle: "Ghi phiếu chi theo đơn",
    spent: "Tổng đã chi (phiếu còn hiệu lực)",
  },
  en: {
    eyebrow: "Finance",
    title: "Order costs",
    description:
      "Record each cost incurred for an order — materials, labor, outsourcing, shipping, packaging. An order's total cost is the sum of its active expense entries.",
    formTitle: "Record an order cost",
    spent: "Spent (active entries)",
  },
} as const;

export default async function FinanceExpensesPage({
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
    ({ scope } = await requireListAccess("expenses.read"));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "expenses.create",
    "expenses.reverse",
  ] as const);
  const canRecord =
    coverages["expenses.create"].global ||
    coverages["expenses.create"].businessUnitIds.length > 0;

  const entries = await financeCommandService.list({
    scope,
    entryKind: "expense",
  });

  let orders: Awaited<ReturnType<typeof orderCommandService.list>> = [];
  if (canRecord) {
    try {
      const { scope: orderScope } = await requireListAccess("orders.read");
      orders = (await orderCommandService.list(orderScope, false)).filter(
        (order) => order.stage !== "cancelled",
      );
    } catch (cause) {
      if (!(cause instanceof ContentAccessDeniedError)) throw cause;
    }
  }

  const totals = sumEntriesByCurrency(entries);

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
        {text.spent}:{" "}
        <span className="text-lacquer font-mono font-semibold">
          {formatTotals(totals, locale)}
        </span>
      </p>

      {canRecord ? (
        <div className="mt-8">
          <FinanceEntryForm
            locale={locale}
            title={text.formTitle}
            returnTo="expenses"
            categories={[
              "materials",
              "labor",
              "outsourcing",
              "shipping",
              "packaging",
            ]}
            orders={orders}
            orderRequired
          />
        </div>
      ) : null}

      <section className="mt-10">
        <EntryTable
          locale={locale}
          entries={entries}
          returnTo="expenses"
          showKind={false}
          canVoid={(entry) =>
            coverageReaches(
              coverages["expenses.reverse"],
              entry.businessUnitIds,
            ) || coverages["expenses.reverse"].global
          }
        />
      </section>
    </div>
  );
}
