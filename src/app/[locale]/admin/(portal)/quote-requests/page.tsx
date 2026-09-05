import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  quoteRequestStatuses,
  type QuoteRequestStatus,
  type QuoteRequestType,
} from "@/domains/quote-requests/contracts";
import { quoteRequestService } from "@/domains/quote-requests/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Khách hàng",
    title: "Yêu cầu báo giá",
    description:
      "Yêu cầu khách gửi từ form Liên hệ trên website. Mỗi yêu cầu cũng được gửi tới hộp thư công ty; trả lời email đó là trả lời thẳng cho khách.",
    empty: "Chưa có yêu cầu nào.",
    all: "Tất cả",
    status: {
      new: "Mới",
      in_progress: "Đang xử lý",
      quoted: "Đã báo giá",
      closed: "Đã đóng",
      spam: "Spam",
    } satisfies Record<QuoteRequestStatus, string>,
    type: {
      existing_products: "Sản phẩm có sẵn",
      custom_design: "Thiết kế riêng / OEM",
      samples: "Mẫu thử",
      catalogue: "Xin catalogue",
      other: "Khác",
    } satisfies Record<QuoteRequestType, string>,
    items: (count: number) => `${count} sản phẩm`,
    open: "Mở",
    mailPending: "· chưa gửi mail",
  },
  en: {
    eyebrow: "Customers",
    title: "Quote requests",
    description:
      "Requests sent from the website's contact form. Each one is also mailed to the company inbox; replying to that email replies to the customer.",
    empty: "No requests yet.",
    all: "All",
    status: {
      new: "New",
      in_progress: "In progress",
      quoted: "Quoted",
      closed: "Closed",
      spam: "Spam",
    } satisfies Record<QuoteRequestStatus, string>,
    type: {
      existing_products: "Catalogue products",
      custom_design: "Custom design / OEM",
      samples: "Samples",
      catalogue: "Catalogue request",
      other: "Other",
    } satisfies Record<QuoteRequestType, string>,
    items: (count: number) => `${count} product${count === 1 ? "" : "s"}`,
    open: "Open",
    mailPending: "· mail not sent",
  },
} as const;

function isStatus(value: string): value is QuoteRequestStatus {
  return (quoteRequestStatuses as readonly string[]).includes(value);
}

export default async function AdminQuoteRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];
  const requestedStatus = Array.isArray(query.status)
    ? (query.status[0] ?? "")
    : (query.status ?? "");
  const status = isStatus(requestedStatus) ? requestedStatus : null;

  let context;
  try {
    context = await requirePermission("quoteRequests.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const requests = await quoteRequestService.list(
    context,
    status ? { status } : {},
  );
  const basePath = `/${locale}/admin/quote-requests`;
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label={text.title}>
        {[null, ...quoteRequestStatuses].map((entry) => {
          const isCurrent = entry === status;
          return (
            <Link
              key={entry ?? "all"}
              href={(entry ? `${basePath}?status=${entry}` : basePath) as Route}
              aria-current={isCurrent ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                isCurrent
                  ? "border-burgundy bg-burgundy text-ivory"
                  : "border-burgundy/20 text-burgundy hover:border-burgundy/50"
              }`}
            >
              {entry ? text.status[entry] : text.all}
            </Link>
          );
        })}
      </nav>

      <section className="mt-6">
        {requests.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="border-burgundy/15 divide-burgundy/10 divide-y overflow-hidden rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            {requests.map((request) => {
              const firstItem = request.details.items[0];
              const summary = firstItem
                ? request.details.items.length > 1
                  ? `${firstItem.productName} +${request.details.items.length - 1}`
                  : firstItem.productName
                : text.type[request.details.requestType];
              return (
                <li
                  key={request.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-burgundy truncate font-serif text-lg">
                      {request.contact.fullName}
                      {request.contact.company ? (
                        <span className="text-charcoal/60 ml-2 font-sans text-sm">
                          {request.contact.company}
                        </span>
                      ) : null}
                      <span className="text-charcoal/45 ml-2 font-sans text-xs">
                        {request.requestCode}
                      </span>
                    </p>
                    <p className="text-charcoal/60 truncate text-sm">
                      {text.type[request.details.requestType]} · {summary}
                      {request.details.items.length > 0
                        ? ` · ${text.items(request.details.items.length)}`
                        : ""}
                      {" · "}
                      {request.contact.country}
                    </p>
                  </div>
                  <span className="w-40 shrink-0 text-sm">
                    <span
                      className={
                        request.status === "new"
                          ? "text-lacquer font-semibold"
                          : request.status === "in_progress" ||
                              request.status === "quoted"
                            ? "text-gold-ink font-semibold"
                            : "text-charcoal/60"
                      }
                    >
                      {text.status[request.status]}
                    </span>
                    {request.notifications.adminSentAt === null &&
                    request.status === "new" ? (
                      <span className="text-charcoal/45 ml-1 text-xs">
                        {text.mailPending}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-charcoal/50 w-32 shrink-0 text-xs">
                    {dateFormat.format(request.createdAt)}
                  </span>
                  <Link
                    href={`${basePath}/${request.id}` as Route}
                    className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
                  >
                    {text.open}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
