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
    title: "Sổ thu – chi",
    description:
      "Toàn bộ dòng tiền vào và ra, kể cả các khoản không gắn đơn hàng. Mỗi phiếu ghi rõ người nhập; phiếu sai được hủy kèm lý do và giữ nguyên trong sổ.",
    formTitle: "Ghi phiếu thu / chi",
    inTotal: "Tổng thu",
    outTotal: "Tổng chi",
  },
  en: {
    eyebrow: "Finance",
    title: "Cash ledger",
    description:
      "Every movement of money, including entries not linked to an order. Each entry records who entered it; mistakes are voided with a reason and stay in the book.",
    formTitle: "Record an entry",
    inTotal: "Total in",
    outTotal: "Total out",
  },
} as const;

export default async function FinanceLedgerPage({
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
    "payments.record",
    "payments.reverse",
    "expenses.create",
    "expenses.reverse",
  ] as const);
  // The form offers only the categories this session can actually record:
  // receipts need payments.record, expense entries need expenses.create.
  const holds = (coverage: {
    global: boolean;
    businessUnitIds: readonly string[];
  }) => coverage.global || coverage.businessUnitIds.length > 0;
  const recordableCategories = [
    ...(holds(coverages["payments.record"])
      ? (["orderPayment", "otherIncome"] as const)
      : []),
    ...(holds(coverages["expenses.create"])
      ? ([
          "materials",
          "labor",
          "outsourcing",
          "shipping",
          "packaging",
          "generalCost",
        ] as const)
      : []),
  ];
  const canRecord = recordableCategories.length > 0;

  const entries = await financeCommandService.list({ scope });

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

  const receiptTotals = sumEntriesByCurrency(
    entries.filter((entry) => entry.kind === "receipt"),
  );
  const expenseTotals = sumEntriesByCurrency(
    entries.filter((entry) => entry.kind === "expense"),
  );

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
          {text.inTotal}:{" "}
          <span className="font-mono font-semibold text-emerald-700">
            {formatTotals(receiptTotals, locale)}
          </span>
        </p>
        <p>
          {text.outTotal}:{" "}
          <span className="text-lacquer font-mono font-semibold">
            {formatTotals(expenseTotals, locale)}
          </span>
        </p>
      </div>

      {canRecord ? (
        <div className="mt-8">
          <FinanceEntryForm
            locale={locale}
            title={text.formTitle}
            returnTo="ledger"
            categories={recordableCategories}
            orders={orders}
            orderRequired={false}
          />
        </div>
      ) : null}

      <section className="mt-10">
        <EntryTable
          locale={locale}
          entries={entries}
          returnTo="ledger"
          showKind
          canVoid={(entry) => {
            const coverage =
              entry.kind === "receipt"
                ? coverages["payments.reverse"]
                : coverages["expenses.reverse"];
            return (
              coverage.global ||
              coverageReaches(coverage, entry.businessUnitIds)
            );
          }}
        />
      </section>
    </div>
  );
}
