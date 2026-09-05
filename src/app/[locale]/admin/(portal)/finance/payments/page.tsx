import { notFound } from "next/navigation";

import { customerCommandService } from "@/domains/customers/runtime";
import { financeCommandService } from "@/domains/finance/runtime";
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
import { formatMoney } from "@/lib/money";

import { FinanceEntryForm, type EntryFormOption } from "../entry-form";
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
    title: "Tiền khách trả",
    description:
      "Ghi từng lần khách chuyển tiền. Gắn ngay vào hóa đơn (thanh toán) hoặc đơn hàng (đặt cọc); khách chuyển gộp cho nhiều đơn thì để trống và chia sau ở trang phiếu. Phần chưa chia là tiền khách trả trước, tự bù cho hóa đơn sau.",
    formTitle: "Ghi phiếu thu của khách",
    collected: "Tổng đã thu (phiếu còn hiệu lực)",
    invoiceOption: (number: string, order: string, customer: string, open: string) =>
      `HĐ ${number} · ${order} · ${customer} · còn ${open}`,
    depositOption: (order: string, customer: string) =>
      `Cọc đơn ${order} · ${customer}`,
  },
  en: {
    eyebrow: "Finance",
    title: "Customer payments",
    description:
      "Record each transfer a customer makes. Apply it right away to an invoice (payment) or an order (deposit); a lump sum for several orders is left open and spread later on the receipt page. Whatever stays open is the customer's advance and offsets the next invoice.",
    formTitle: "Record a customer payment",
    collected: "Collected (active receipts)",
    invoiceOption: (number: string, order: string, customer: string, open: string) =>
      `INV ${number} · ${order} · ${customer} · open ${open}`,
    depositOption: (order: string, customer: string) =>
      `Deposit on ${order} · ${customer}`,
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
    "customers.read",
    "invoices.read",
  ] as const);
  const canRecord =
    coverages["payments.record"].global ||
    coverages["payments.record"].businessUnitIds.length > 0;

  const entries = (
    await financeCommandService.list({ scope, entryKind: "receipt" })
  ).filter((entry) => entry.category === "orderPayment");

  let customers: EntryFormOption[] = [];
  let targets: EntryFormOption[] = [];
  if (canRecord) {
    if (coverages["customers.read"].global) {
      customers = (await customerCommandService.list({ status: "active" })).map(
        (customer) => ({
          value: customer.id,
          label: customer.code ? `${customer.name} (${customer.code})` : customer.name,
        }),
      );
    }
    if (coverages["invoices.read"].global) {
      const report = await financeCommandService.receivables(scope);
      targets = report.invoices
        .filter((row) => !row.remaining.amount.startsWith("-") && row.remaining.amount !== "0" && row.remaining.amount !== "0.00")
        .map((row) => ({
          value: `invoice:${row.invoice.id}`,
          label: text.invoiceOption(
            row.invoice.invoiceNumber,
            row.invoice.orderCode,
            row.invoice.customerName,
            formatMoney(row.remaining, locale),
          ),
        }));
    }
    try {
      const { scope: orderScope } = await requireListAccess("orders.read");
      const orders = (await orderCommandService.list(orderScope, false)).filter(
        (order) => !isTerminalStage(order.stage),
      );
      targets = [
        ...targets,
        ...orders.map((order) => ({
          value: `order:${order.id}`,
          label: text.depositOption(order.orderCode, order.customerName),
        })),
      ];
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
            targets={targets}
            customers={customers}
            defaultCurrency="USD"
          />
        </div>
      ) : null}

      <section className="mt-10">
        <EntryTable
          locale={locale}
          entries={entries}
          returnTo="payments"
          showKind={false}
          showAllocation
          canVoid={(entry) =>
            coverages["payments.reverse"].global ||
            coverageReaches(coverages["payments.reverse"], entry.businessUnitIds)
          }
        />
      </section>
    </div>
  );
}
