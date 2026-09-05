import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ShopOrderActions } from "@/components/admin/shop-order-actions";
import type { ShopOrderStatus } from "@/domains/shop/contracts";
import { shopService } from "@/domains/shop/runtime";
import { allowedShopOrderTransitions } from "@/domains/shop/service";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "Tất cả đơn",
    eyebrow: "Đơn đặt mua",
    status: {
      new: "Mới",
      confirmed: "Đã xác nhận",
      completed: "Hoàn thành",
      cancelled: "Đã huỷ",
    } satisfies Record<ShopOrderStatus, string>,
    item: "Mặt hàng",
    quantity: "Số lượng",
    unitPrice: "Đơn giá",
    total: "Tạm tính (chưa gồm phí vận chuyển)",
    locale: "Ngôn ngữ khách đặt",
    customer: "Khách hàng",
    fullName: "Họ tên",
    phone: "Điện thoại",
    email: "Email",
    address: "Địa chỉ",
    note: "Ghi chú",
    mail: "Thông báo email",
    mailAdmin: "Gửi cho admin",
    mailCustomer: "Gửi cho khách",
    mailSent: "Đã gửi",
    mailNotSent: "Chưa gửi",
    mailError: "Lỗi gần nhất",
    history: "Lịch sử",
    placed: "Khách đặt",
    stockHeld: "Đang giữ tồn kho cho đơn này.",
  },
  en: {
    back: "All orders",
    eyebrow: "Customer order",
    status: {
      new: "New",
      confirmed: "Confirmed",
      completed: "Completed",
      cancelled: "Cancelled",
    } satisfies Record<ShopOrderStatus, string>,
    item: "Item",
    quantity: "Quantity",
    unitPrice: "Unit price",
    total: "Subtotal (shipping not included)",
    locale: "Customer's locale",
    customer: "Customer",
    fullName: "Full name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    note: "Note",
    mail: "Email notifications",
    mailAdmin: "To staff",
    mailCustomer: "To customer",
    mailSent: "Sent",
    mailNotSent: "Not sent",
    mailError: "Last error",
    history: "History",
    placed: "Placed by customer",
    stockHeld: "Stock is held for this order.",
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

export default async function AdminShopOrderPage({
  params,
}: {
  params: Promise<{ locale: string; orderId: string }>;
}) {
  const { locale: requestedLocale, orderId } = await params;
  if (!isLocale(requestedLocale)) notFound();
  if (!/^[a-f0-9]{24}$/.test(orderId)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("shopOrders.read");
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) notFound();
    throw error;
  }

  const [order, coverage] = await Promise.all([
    shopService.readOrder(context, orderId),
    resolvePermissionCoverages(["shopOrders.manage"]),
  ]);
  if (!order) notFound();

  const displayLocale = order.locale === "vi" ? "vi-VN" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="max-w-4xl">
      <Link
        href={`/${locale}/admin/shop/orders` as Route}
        className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <span aria-hidden="true">←</span>
        {text.back}
      </Link>
      <p className="eyebrow mt-4">{text.eyebrow}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-burgundy font-serif text-4xl tracking-[-0.035em] md:text-5xl">
          {order.orderCode}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.08em] uppercase ${
            order.status === "new"
              ? "bg-lacquer/10 text-lacquer"
              : order.status === "confirmed"
                ? "bg-gold/15 text-gold-ink"
                : "bg-charcoal/8 text-charcoal/60"
          }`}
        >
          {text.status[order.status]}
        </span>
        {order.stockDeducted ? (
          <span className="text-charcoal/55 text-xs">{text.stockHeld}</span>
        ) : null}
      </div>

      <section className="border-burgundy/15 mt-8 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <dl className="divide-burgundy/10 divide-y">
          <Row label={text.item} value={order.itemName} />
          <Row label={text.quantity} value={String(order.quantity)} />
          <Row
            label={text.unitPrice}
            value={formatMoney(order.unitPrice, displayLocale)}
          />
          <Row label={text.total} value={formatMoney(order.total, displayLocale)} />
          <Row label={text.locale} value={order.locale} />
        </dl>
      </section>

      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.customer}</h2>
        <dl className="divide-burgundy/10 mt-3 divide-y">
          <Row label={text.fullName} value={order.customer.fullName} />
          <Row label={text.phone} value={order.customer.phone} />
          <Row label={text.email} value={order.customer.email} />
          <Row label={text.address} value={order.customer.address} />
          {order.customer.note ? (
            <Row label={text.note} value={order.customer.note} />
          ) : null}
        </dl>
      </section>

      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.mail}</h2>
        <dl className="divide-burgundy/10 mt-3 divide-y">
          <Row
            label={text.mailAdmin}
            value={
              order.notifications.adminSentAt
                ? `${text.mailSent} · ${dateFormat.format(order.notifications.adminSentAt)}`
                : text.mailNotSent
            }
          />
          <Row
            label={text.mailCustomer}
            value={
              order.notifications.customerSentAt
                ? `${text.mailSent} · ${dateFormat.format(order.notifications.customerSentAt)}`
                : text.mailNotSent
            }
          />
          {order.notifications.lastError ? (
            <Row label={text.mailError} value={order.notifications.lastError} />
          ) : null}
        </dl>
      </section>

      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.history}</h2>
        <ol className="divide-burgundy/10 mt-3 divide-y">
          {order.history.map((entry, index) => (
            <li key={`${entry.to}-${index}`} className="py-3 text-sm">
              <span className="font-medium">
                {entry.from ? `${text.status[entry.from]} → ` : `${text.placed} → `}
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

      {coverage["shopOrders.manage"].global ? (
        <ShopOrderActions
          locale={locale}
          orderId={order.id}
          revision={order.revision}
          allowed={allowedShopOrderTransitions(order.status)}
        />
      ) : null}
    </div>
  );
}
