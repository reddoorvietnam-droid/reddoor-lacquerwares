import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QuoteRequestActions } from "@/components/admin/quote-request-actions";
import type {
  QuoteRequestDeliveryTerm,
  QuoteRequestStatus,
  QuoteRequestType,
} from "@/domains/quote-requests/contracts";
import { quoteRequestService } from "@/domains/quote-requests/runtime";
import {
  allowedQuoteRequestTransitions,
  permissionForQuoteRequestTransition,
} from "@/domains/quote-requests/service";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "Tất cả yêu cầu",
    eyebrow: "Yêu cầu báo giá",
    status: {
      new: "Mới",
      in_progress: "Đang xử lý",
      quoted: "Đã báo giá",
      closed: "Đã đóng",
      spam: "Spam",
    } satisfies Record<QuoteRequestStatus, string>,
    type: {
      existing_products: "Báo giá sản phẩm có sẵn",
      custom_design: "Thiết kế riêng / OEM",
      samples: "Đặt mẫu thử",
      catalogue: "Xin catalogue",
      other: "Khác",
    } satisfies Record<QuoteRequestType, string>,
    terms: {
      EXW: "EXW – giao tại xưởng",
      FOB: "FOB – giao lên tàu",
      CIF: "CIF – gồm bảo hiểm và cước",
      DDP: "DDP – giao tận nơi, đã thuế",
      unsure: "Chưa xác định",
    } satisfies Record<QuoteRequestDeliveryTerm, string>,
    request: "Nhu cầu",
    requestType: "Loại yêu cầu",
    items: "Sản phẩm quan tâm",
    quantity: "SL",
    estimatedQuantity: "Tổng số lượng dự kiến",
    budget: "Ngân sách / giá mục tiêu",
    deadline: "Thời hạn mong muốn",
    deliveryTerms: "Điều kiện giao hàng",
    destination: "Nơi nhận hàng",
    message: "Nội dung",
    customer: "Khách hàng",
    fullName: "Họ tên",
    company: "Công ty",
    email: "Email",
    phone: "Điện thoại",
    country: "Quốc gia",
    locale: "Ngôn ngữ khách dùng",
    reply: "Trả lời qua email",
    mail: "Thông báo email",
    mailAdmin: "Gửi cho công ty",
    mailCustomer: "Gửi cho khách",
    mailSent: "Đã gửi",
    mailNotSent: "Chưa gửi",
    mailError: "Lỗi gần nhất",
    history: "Lịch sử",
    submitted: "Khách gửi",
  },
  en: {
    back: "All requests",
    eyebrow: "Quote request",
    status: {
      new: "New",
      in_progress: "In progress",
      quoted: "Quoted",
      closed: "Closed",
      spam: "Spam",
    } satisfies Record<QuoteRequestStatus, string>,
    type: {
      existing_products: "Quote for catalogue products",
      custom_design: "Custom design / OEM",
      samples: "Sample order",
      catalogue: "Catalogue request",
      other: "Other",
    } satisfies Record<QuoteRequestType, string>,
    terms: {
      EXW: "EXW – ex works",
      FOB: "FOB – free on board",
      CIF: "CIF – cost, insurance and freight",
      DDP: "DDP – delivered duty paid",
      unsure: "Not sure yet",
    } satisfies Record<QuoteRequestDeliveryTerm, string>,
    request: "Request",
    requestType: "Request type",
    items: "Products of interest",
    quantity: "Qty",
    estimatedQuantity: "Total estimated quantity",
    budget: "Budget / target price",
    deadline: "Desired deadline",
    deliveryTerms: "Delivery terms",
    destination: "Destination",
    message: "Message",
    customer: "Customer",
    fullName: "Full name",
    company: "Company",
    email: "Email",
    phone: "Phone",
    country: "Country",
    locale: "Customer's language",
    reply: "Reply by email",
    mail: "Email notifications",
    mailAdmin: "To company",
    mailCustomer: "To customer",
    mailSent: "Sent",
    mailNotSent: "Not sent",
    mailError: "Last error",
    history: "History",
    submitted: "Submitted by customer",
  },
} as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-charcoal/60 text-xs tracking-[0.1em] uppercase">
        {label}
      </dt>
      <dd className="text-sm leading-6 font-medium whitespace-pre-line">
        {value}
      </dd>
    </div>
  );
}

const cardClassName =
  "border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8";

export default async function AdminQuoteRequestPage({
  params,
}: {
  params: Promise<{ locale: string; requestId: string }>;
}) {
  const { locale: requestedLocale, requestId } = await params;
  if (!isLocale(requestedLocale)) notFound();
  if (!/^[a-f0-9]{24}$/.test(requestId)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("quoteRequests.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const [request, coverage] = await Promise.all([
    quoteRequestService.read(context, requestId),
    resolvePermissionCoverages([
      "quoteRequests.update",
      "quoteRequests.close",
      "quoteRequests.markSpam",
    ]),
  ]);
  if (!request) notFound();

  const allowed = allowedQuoteRequestTransitions(request.status).filter(
    (to) => coverage[permissionForQuoteRequestTransition(to)].global,
  );
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const { contact, details } = request;
  const mailto = `mailto:${contact.email}?subject=${encodeURIComponent(
    `Re: ${request.requestCode}`,
  )}`;

  return (
    <div className="max-w-4xl">
      <Link
        href={`/${locale}/admin/quote-requests` as Route}
        className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <span aria-hidden="true">←</span>
        {text.back}
      </Link>
      <p className="eyebrow mt-4">{text.eyebrow}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-burgundy font-serif text-4xl tracking-[-0.035em] md:text-5xl">
          {request.requestCode}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.08em] uppercase ${
            request.status === "new"
              ? "bg-lacquer/10 text-lacquer"
              : request.status === "in_progress" || request.status === "quoted"
                ? "bg-gold/15 text-gold-ink"
                : "bg-charcoal/8 text-charcoal/60"
          }`}
        >
          {text.status[request.status]}
        </span>
        <span className="text-charcoal/50 text-xs">
          {dateFormat.format(request.createdAt)}
        </span>
      </div>

      <section className={cardClassName}>
        <h2 className="text-burgundy font-serif text-2xl">{text.request}</h2>
        <dl className="divide-burgundy/10 mt-3 divide-y">
          <Row
            label={text.requestType}
            value={text.type[details.requestType]}
          />
          {details.items.length > 0 ? (
            <Row
              label={text.items}
              value={details.items
                .map((item) =>
                  item.quantity
                    ? `${item.productName} — ${text.quantity} ${item.quantity}`
                    : item.productName,
                )
                .join("\n")}
            />
          ) : null}
          {details.estimatedQuantity ? (
            <Row
              label={text.estimatedQuantity}
              value={String(details.estimatedQuantity)}
            />
          ) : null}
          {details.budget ? (
            <Row label={text.budget} value={details.budget} />
          ) : null}
          {details.deadline ? (
            <Row label={text.deadline} value={details.deadline} />
          ) : null}
          {details.deliveryTerms ? (
            <Row
              label={text.deliveryTerms}
              value={text.terms[details.deliveryTerms]}
            />
          ) : null}
          {details.destination ? (
            <Row label={text.destination} value={details.destination} />
          ) : null}
          <Row label={text.message} value={details.message} />
        </dl>
      </section>

      <section className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-burgundy font-serif text-2xl">{text.customer}</h2>
          <a
            href={mailto}
            className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold"
          >
            {text.reply}
          </a>
        </div>
        <dl className="divide-burgundy/10 mt-3 divide-y">
          <Row label={text.fullName} value={contact.fullName} />
          {contact.company ? (
            <Row label={text.company} value={contact.company} />
          ) : null}
          <Row label={text.email} value={contact.email} />
          {contact.phone ? (
            <Row label={text.phone} value={contact.phone} />
          ) : null}
          <Row label={text.country} value={contact.country} />
          <Row label={text.locale} value={request.locale} />
        </dl>
      </section>

      <section className={cardClassName}>
        <h2 className="text-burgundy font-serif text-2xl">{text.mail}</h2>
        <dl className="divide-burgundy/10 mt-3 divide-y">
          <Row
            label={text.mailAdmin}
            value={
              request.notifications.adminSentAt
                ? `${text.mailSent} · ${dateFormat.format(request.notifications.adminSentAt)}`
                : text.mailNotSent
            }
          />
          <Row
            label={text.mailCustomer}
            value={
              request.notifications.customerSentAt
                ? `${text.mailSent} · ${dateFormat.format(request.notifications.customerSentAt)}`
                : text.mailNotSent
            }
          />
          {request.notifications.lastError ? (
            <Row
              label={text.mailError}
              value={request.notifications.lastError}
            />
          ) : null}
        </dl>
      </section>

      <section className={cardClassName}>
        <h2 className="text-burgundy font-serif text-2xl">{text.history}</h2>
        <ol className="divide-burgundy/10 mt-3 divide-y">
          {request.history.map((entry, index) => (
            <li key={`${entry.to}-${index}`} className="py-3 text-sm">
              <span className="font-medium">
                {entry.from
                  ? `${text.status[entry.from]} → `
                  : `${text.submitted} → `}
                {text.status[entry.to]}
              </span>
              <span className="text-charcoal/50 ml-2 text-xs">
                {dateFormat.format(entry.at)}
              </span>
              {entry.reason ? (
                <p className="text-charcoal/65 mt-1">{entry.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <QuoteRequestActions
        locale={locale}
        requestId={request.id}
        revision={request.revision}
        allowed={allowed}
      />
    </div>
  );
}
