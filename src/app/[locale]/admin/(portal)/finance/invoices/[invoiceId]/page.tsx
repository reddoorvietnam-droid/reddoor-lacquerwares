import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentUpload } from "@/components/admin/document-upload";
import {
  financeCommandService,
  invoiceCommandService,
} from "@/domains/finance/runtime";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatBytes, storedDocumentUrl } from "@/lib/media/document-url";
import { add, formatMoney, money, type Money } from "@/lib/money";

import { removeInvoiceDocumentAction, voidInvoiceAction } from "../../actions";
import { FinanceEntryForm } from "../../entry-form";
import { formatDate, OutcomeBanner } from "../../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Hóa đơn",
    eyebrow: "Hóa đơn",
    order: "Đơn hàng",
    customer: "Khách hàng",
    issuedAt: "Ngày lập",
    dueAt: "Hạn thanh toán",
    amount: "Giá trị",
    rate: "Tỷ giá VND/USD",
    vndValue: "Quy đổi VND",
    note: "Ghi chú",
    paid: "Đã trả",
    remaining: "Còn thiếu",
    overdue: "Quá hạn",
    settled: "Đã thanh toán đủ",
    voided: "Hóa đơn đã hủy",
    documentsTitle: "File hóa đơn",
    documentsHint:
      "Tải file INV (PDF hoặc ảnh) lên đây thay vì nhập lại tên hàng. File nằm cùng hóa đơn để đối chiếu.",
    noDocuments: "Chưa có file nào.",
    remove: "Gỡ",
    paymentsTitle: "Các lần khách trả cho hóa đơn này",
    noPayments: "Chưa có tiền nào gắn vào hóa đơn này.",
    depositApplied: "Tiền cọc của đơn được trừ vào",
    recordPaymentTitle: "Ghi tiền khách trả cho hóa đơn này",
    voidTitle: "Hủy hóa đơn",
    voidReason: "Lý do hủy",
    voidButton: "Hủy hóa đơn này",
    open: "Mở",
  },
  en: {
    back: "← Invoices",
    eyebrow: "Invoice",
    order: "Order",
    customer: "Customer",
    issuedAt: "Issued",
    dueAt: "Due",
    amount: "Amount",
    rate: "VND per USD",
    vndValue: "In VND",
    note: "Note",
    paid: "Paid",
    remaining: "Open",
    overdue: "Overdue",
    settled: "Settled",
    voided: "Voided",
    documentsTitle: "Invoice file",
    documentsHint:
      "Upload the INV file (PDF or photo) here instead of retyping its lines. It stays with the invoice for reference.",
    noDocuments: "No file yet.",
    remove: "Remove",
    paymentsTitle: "Payments applied to this invoice",
    noPayments: "No money applied to this invoice yet.",
    depositApplied: "Deposit on the order applied",
    recordPaymentTitle: "Record a payment for this invoice",
    voidTitle: "Void",
    voidReason: "Reason",
    voidButton: "Void this invoice",
    open: "Open",
  },
} as const;

function isPositive(value: Money): boolean {
  return !value.amount.startsWith("-") && Number(value.amount) !== 0;
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; invoiceId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, invoiceId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  if (!/^[a-f0-9]{24}$/.test(invoiceId)) notFound();
  const invoice = await invoiceCommandService.findById(invoiceId);
  if (!invoice) notFound();

  try {
    await requirePermission("invoices.read", {
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
    });
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "invoices.manage",
    "payments.record",
  ] as const);
  const canManage =
    invoice.status === "active" &&
    coverageReaches(coverages["invoices.manage"], invoice.businessUnitIds);
  const canRecordPayment =
    invoice.status === "active" &&
    coverageReaches(coverages["payments.record"], invoice.businessUnitIds);

  const report = invoice.customerId
    ? await financeCommandService.customerReceivables(invoice.customerId)
    : await financeCommandService.receivables({ kind: "all" });
  const row = report.invoices.find((candidate) => candidate.invoice.id === invoice.id);

  const receipts = (
    await financeCommandService.listActive({
      kind: "receipt",
      category: "orderPayment",
      ...(invoice.customerId ? { customerId: invoice.customerId } : {}),
    })
  )
    .map((receipt) => ({
      receipt,
      applied: receipt.allocations
        .filter(
          (allocation) =>
            allocation.target === "invoice" && allocation.invoiceId === invoice.id,
        )
        .reduce(
          (total, allocation) =>
            add(total, money(allocation.amount, receipt.amount.currency)),
          money("0", receipt.amount.currency),
        ),
    }))
    .filter((item) => isPositive(item.applied));

  let maxBytes: number | null = null;
  try {
    maxBytes = getCloudinaryEnv().MAX_PDF_UPLOAD_MB * 1024 * 1024;
  } catch {
    maxBytes = null;
  }

  const vndValue =
    invoice.amount.currency === "USD" && invoice.fxRateToVnd
      ? formatMoney(
          {
            amount: Math.round(
              Number(invoice.amount.amount) * Number(invoice.fxRateToVnd),
            ).toString(),
            currency: "VND",
          },
          locale,
        )
      : null;

  const cardClass =
    "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
  const dtClass = "text-charcoal/50 text-xs tracking-[0.12em] uppercase";

  return (
    <div>
      <Link
        href={`/${locale}/admin/finance/invoices` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
            <span className="font-mono text-4xl">{invoice.invoiceNumber}</span>
          </h1>
          <p className="text-charcoal/75 mt-3 text-lg">
            {invoice.customerId ? (
              <Link
                href={`/${locale}/admin/customers/${invoice.customerId}` as Route}
                className="hover:underline"
              >
                {invoice.customerName}
              </Link>
            ) : (
              invoice.customerName
            )}
          </p>
        </div>
        <div className="text-right">
          {invoice.status === "voided" ? (
            <p className="text-lacquer bg-lacquer/10 rounded-full px-4 py-2 text-sm font-semibold">
              {text.voided}
              {invoice.voidReason ? ` · ${invoice.voidReason}` : ""}
            </p>
          ) : row ? (
            <>
              <p className={dtClass}>{text.remaining}</p>
              <p
                className={`mt-1 font-mono text-2xl font-semibold ${
                  isPositive(row.remaining) ? "text-lacquer" : "text-emerald-700"
                }`}
              >
                {isPositive(row.remaining)
                  ? formatMoney(row.remaining, locale)
                  : text.settled}
              </p>
              {row.overdue ? (
                <p className="text-lacquer mt-1 text-xs font-semibold uppercase">
                  {text.overdue}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <OutcomeBanner locale={locale} error={error} notice={notice} />

      <section className={`${cardClass} mt-8`}>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className={dtClass}>{text.order}</dt>
            <dd className="mt-1 font-mono">
              <Link
                href={`/${locale}/admin/orders/${invoice.orderId}` as Route}
                className="text-burgundy hover:underline"
              >
                {invoice.orderCode}
              </Link>
            </dd>
          </div>
          <div>
            <dt className={dtClass}>{text.issuedAt}</dt>
            <dd className="mt-1">{formatDate(invoice.issuedAt, locale)}</dd>
          </div>
          <div>
            <dt className={dtClass}>{text.dueAt}</dt>
            <dd className="mt-1">{formatDate(invoice.dueAt, locale)}</dd>
          </div>
          <div>
            <dt className={dtClass}>{text.amount}</dt>
            <dd className="mt-1 font-mono font-semibold">
              {formatMoney(invoice.amount, locale)}
            </dd>
          </div>
          {invoice.fxRateToVnd ? (
            <>
              <div>
                <dt className={dtClass}>{text.rate}</dt>
                <dd className="mt-1 font-mono">{invoice.fxRateToVnd}</dd>
              </div>
              <div>
                <dt className={dtClass}>{text.vndValue}</dt>
                <dd className="mt-1 font-mono">{vndValue}</dd>
              </div>
            </>
          ) : null}
          {row ? (
            <div>
              <dt className={dtClass}>{text.paid}</dt>
              <dd className="mt-1 font-mono text-emerald-700">
                {formatMoney(add(row.paid, row.depositApplied), locale)}
              </dd>
            </div>
          ) : null}
          {invoice.note ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className={dtClass}>{text.note}</dt>
              <dd className="mt-1">{invoice.note}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="text-burgundy font-serif text-2xl">{text.documentsTitle}</h2>
          <p className="text-charcoal/55 mt-2 text-sm">{text.documentsHint}</p>
          {invoice.documents.length === 0 ? (
            <p className="text-charcoal/55 mt-4 text-sm">{text.noDocuments}</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {invoice.documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-3">
                  <a
                    href={storedDocumentUrl(document)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-burgundy font-semibold hover:underline"
                  >
                    {document.label}
                  </a>
                  <span className="text-charcoal/45 text-xs">
                    {document.format.toUpperCase()} · {formatBytes(document.bytes)} ·{" "}
                    {formatDate(document.uploadedAt, locale)}
                  </span>
                  {canManage ? (
                    <form action={removeInvoiceDocumentAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <input type="hidden" name="expectedRevision" value={invoice.revision} />
                      <input type="hidden" name="documentId" value={document.id} />
                      <button
                        type="submit"
                        className="text-lacquer border-lacquer/30 hover:bg-lacquer/5 rounded-full border px-3 py-1 text-xs font-semibold"
                      >
                        {text.remove}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canManage && maxBytes ? (
            <div className="mt-5">
              <DocumentUpload
                locale={locale}
                target={{ kind: "invoiceDocument", id: invoice.id }}
                expectedRevision={invoice.revision}
                maxBytes={maxBytes}
              />
            </div>
          ) : null}
        </section>

        <section className={cardClass}>
          <h2 className="text-burgundy font-serif text-2xl">{text.paymentsTitle}</h2>
          {receipts.length === 0 && !(row && isPositive(row.depositApplied)) ? (
            <p className="text-charcoal/55 mt-4 text-sm">{text.noPayments}</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {receipts.map(({ receipt, applied }) => (
                <li key={receipt.id} className="flex flex-wrap items-center gap-x-4">
                  <span className="text-charcoal/60 text-xs">
                    {formatDate(receipt.occurredAt, locale)}
                  </span>
                  <span className="font-mono text-xs font-semibold text-emerald-700">
                    {formatMoney(applied, locale)}
                  </span>
                  <Link
                    href={`/${locale}/admin/finance/payments/${receipt.id}` as Route}
                    className="text-burgundy text-xs hover:underline"
                  >
                    {text.open}
                  </Link>
                </li>
              ))}
              {row && isPositive(row.depositApplied) ? (
                <li className="text-charcoal/70 text-xs">
                  {text.depositApplied}:{" "}
                  <span className="font-mono font-semibold text-emerald-700">
                    {formatMoney(row.depositApplied, locale)}
                  </span>
                </li>
              ) : null}
            </ul>
          )}
        </section>
      </div>

      {canRecordPayment && row && isPositive(row.remaining) ? (
        <div className="mt-6">
          <FinanceEntryForm
            locale={locale}
            title={text.recordPaymentTitle}
            returnTo={`invoice:${invoice.id}`}
            categories={["orderPayment"]}
            hidden={{ allocateTo: `invoice:${invoice.id}` }}
            defaultCurrency={invoice.amount.currency}
            defaultAmount={row.remaining.amount}
            idPrefix="invoice-payment"
          />
        </div>
      ) : null}

      {canManage ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.voidTitle}</h2>
          <form action={voidInvoiceAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value="invoices" />
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input type="hidden" name="expectedRevision" value={invoice.revision} />
            <div>
              <label
                htmlFor="invoice-void-reason"
                className="text-charcoal/55 mb-1.5 block text-xs font-semibold tracking-[0.08em] uppercase"
              >
                {text.voidReason}
              </label>
              <input
                id="invoice-void-reason"
                type="text"
                name="reason"
                required
                maxLength={2000}
                className="border-burgundy/20 w-72 rounded-xl border bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="text-lacquer border-lacquer/40 hover:bg-lacquer/5 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold"
            >
              {text.voidButton}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
