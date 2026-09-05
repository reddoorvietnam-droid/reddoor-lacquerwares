import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  shopOrderStatuses,
  type ShopOrderStatus,
} from "@/domains/shop/contracts";
import { shopService } from "@/domains/shop/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Cửa hàng",
    title: "Đơn đặt mua",
    description:
      "Đơn khách đặt trên website. Xác nhận sau khi đã trao đổi phí vận chuyển với khách; tồn kho trừ khi xác nhận.",
    empty: "Chưa có đơn nào.",
    all: "Tất cả",
    status: {
      new: "Mới",
      confirmed: "Đã xác nhận",
      completed: "Hoàn thành",
      cancelled: "Đã huỷ",
    } satisfies Record<ShopOrderStatus, string>,
    open: "Mở",
    mailPending: "· chưa gửi mail",
  },
  en: {
    eyebrow: "Shop",
    title: "Customer orders",
    description:
      "Orders placed on the website. Confirm once the shipping cost is agreed with the customer; stock is deducted on confirmation.",
    empty: "No orders yet.",
    all: "All",
    status: {
      new: "New",
      confirmed: "Confirmed",
      completed: "Completed",
      cancelled: "Cancelled",
    } satisfies Record<ShopOrderStatus, string>,
    open: "Open",
    mailPending: "· mail not sent",
  },
} as const;

function isStatus(value: string): value is ShopOrderStatus {
  return (shopOrderStatuses as readonly string[]).includes(value);
}

export default async function AdminShopOrdersPage({
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
    context = await requirePermission("shopOrders.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const orders = await shopService.listOrders(
    context,
    status ? { status } : {},
  );
  const basePath = `/${locale}/admin/shop/orders`;

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
        {[null, ...shopOrderStatuses].map((entry) => {
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
        {orders.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="border-burgundy/15 divide-burgundy/10 divide-y overflow-hidden rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-burgundy truncate font-serif text-lg">
                    {order.customer.fullName}
                    <span className="text-charcoal/45 ml-2 font-sans text-xs">
                      {order.orderCode}
                    </span>
                  </p>
                  <p className="text-charcoal/60 truncate text-sm">
                    {order.itemName} × {order.quantity}
                  </p>
                </div>
                <span className="text-charcoal/70 w-36 shrink-0 text-sm tabular-nums">
                  {formatMoney(order.total, order.locale === "vi" ? "vi-VN" : "en-US")}
                </span>
                <span className="w-40 shrink-0 text-sm">
                  <span
                    className={
                      order.status === "new"
                        ? "text-lacquer font-semibold"
                        : order.status === "confirmed"
                          ? "text-gold-ink font-semibold"
                          : "text-charcoal/60"
                    }
                  >
                    {text.status[order.status]}
                  </span>
                  {order.notifications.adminSentAt === null &&
                  order.status === "new" ? (
                    <span className="text-charcoal/45 ml-1 text-xs">
                      {text.mailPending}
                    </span>
                  ) : null}
                </span>
                <span className="text-charcoal/50 w-32 shrink-0 text-xs">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(order.createdAt)}
                </span>
                <Link
                  href={`${basePath}/${order.id}` as Route}
                  className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold"
                >
                  {text.open}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
