import { notFound } from "next/navigation";

import { financeCommandService } from "@/domains/finance/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
  coverageReaches,
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
    title: "Thanh toán đơn hàng",
    description:
      "Ghi nhận từng lần khách thanh toán cho một đơn hàng. Số đã thu của mỗi đơn được cộng từ các phiếu còn hiệu lực; phiếu sai thì hủy kèm lý do, không xóa.",
    formTitle: "Ghi phiếu thu theo đơn",
    collected: "Tổng đã thu (phiếu còn hiệu lực)",
  },
  en: {
    eyebrow: "Finance",
    title: "Order payments",
    description:
      "Record each customer payment against an order. An order's collected total is the sum of its active receipts; a mistake is voided with a reason, never deleted.",
    formTitle: "Record an order payment",
    collected: "Collected (active receipts)",
  },
} as const;

export default async function FinancePaymentsPage({
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
  ] as const);
  const canRecord =
    coverages["payments.record"].global ||
    coverages["payments.record"].businessUnitIds.length > 0;

  const entries = await financeCommandService.list({
    scope,
    entryKind: "receipt",
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
        {text.collected}:{" "}
        <span className="text-burgundy font-mono font-semibold">
          {formatTotals(totals, locale)}
        </span>
      </p>

      {canRecord ? (
        <div className="mt-8">
          <FinanceEntryForm
            locale={locale}
            title={text.formTitle}
            returnTo="payments"
            categories={["orderPayment"]}
            orders={orders}
            orderRequired
          />
        </div>
      ) : null}

      <section className="mt-10">
        <EntryTable
          locale={locale}
          entries={entries}
          returnTo="payments"
          showKind={false}
          canVoid={(entry) =>
            coverageReaches(
              coverages["payments.reverse"],
              entry.businessUnitIds,
            ) || coverages["payments.reverse"].global
          }
        />
      </section>
    </div>
  );
}
