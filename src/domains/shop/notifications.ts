import "server-only";

import type { ShopOrderDto, ShopOrderStore } from "@/domains/shop/contracts";
import {
  getOrderNotificationRecipients,
  sendEmail,
  type EmailMessage,
} from "@/lib/email/resend";
import { formatMoney } from "@/lib/money";
import { getSiteUrl } from "@/lib/seo/urls";

/**
 * The two emails a new shop order produces: one to the staff inbox listed in
 * `ORDER_NOTIFICATION_EMAILS`, one confirmation to the customer. Both are
 * plain HTML strings — no template engine — and both are best effort: the
 * order is already saved before either is attempted.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b5f57;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:#1b1917;vertical-align:top">${escapeHtml(value).replaceAll("\n", "<br>")}</td></tr>`;
}

function wrap(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f0e8;font-family:Georgia,serif;color:#1b1917"><div style="max-width:600px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8a1c1c">Red Door Viet Nam</p><h1 style="margin:0 0 20px;font-size:24px;font-weight:normal;color:#3d0d10">${escapeHtml(title)}</h1>${body}</div></body></html>`;
}

function orderRows(order: ShopOrderDto, labels: OrderLabels): string {
  const displayLocale = order.locale === "vi" ? "vi-VN" : "en-US";
  return [
    row(labels.orderCode, order.orderCode),
    row(labels.item, order.itemName),
    row(labels.quantity, String(order.quantity)),
    row(labels.unitPrice, formatMoney(order.unitPrice, displayLocale)),
    row(labels.total, formatMoney(order.total, displayLocale)),
    row(labels.fullName, order.customer.fullName),
    row(labels.phone, order.customer.phone),
    row(labels.email, order.customer.email),
    row(labels.address, order.customer.address),
    ...(order.customer.note ? [row(labels.note, order.customer.note)] : []),
  ].join("");
}

function orderText(order: ShopOrderDto, labels: OrderLabels): string {
  const displayLocale = order.locale === "vi" ? "vi-VN" : "en-US";
  return [
    `${labels.orderCode}: ${order.orderCode}`,
    `${labels.item}: ${order.itemName}`,
    `${labels.quantity}: ${order.quantity}`,
    `${labels.unitPrice}: ${formatMoney(order.unitPrice, displayLocale)}`,
    `${labels.total}: ${formatMoney(order.total, displayLocale)}`,
    `${labels.fullName}: ${order.customer.fullName}`,
    `${labels.phone}: ${order.customer.phone}`,
    `${labels.email}: ${order.customer.email}`,
    `${labels.address}: ${order.customer.address}`,
    ...(order.customer.note ? [`${labels.note}: ${order.customer.note}`] : []),
  ].join("\n");
}

type OrderLabels = {
  orderCode: string;
  item: string;
  quantity: string;
  unitPrice: string;
  total: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  note: string;
};

const labelsByLocale: Record<"vi" | "en", OrderLabels> = {
  vi: {
    orderCode: "Mã đơn",
    item: "Sản phẩm",
    quantity: "Số lượng",
    unitPrice: "Đơn giá",
    total: "Tạm tính",
    fullName: "Họ tên",
    phone: "Điện thoại",
    email: "Email",
    address: "Địa chỉ",
    note: "Ghi chú",
  },
  en: {
    orderCode: "Order code",
    item: "Item",
    quantity: "Quantity",
    unitPrice: "Unit price",
    total: "Subtotal",
    fullName: "Full name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    note: "Note",
  },
};

export function buildAdminOrderEmail(
  order: ShopOrderDto,
  recipients: readonly string[],
): EmailMessage {
  // Staff read Vietnamese; the customer's own locale is noted in the body.
  const labels = labelsByLocale.vi;
  const adminUrl = new URL(
    `/vi/admin/shop/orders/${order.id}`,
    getSiteUrl(),
  ).toString();
  const title = `Đơn hàng mới ${order.orderCode}`;
  const html = wrap(
    title,
    `<p style="margin:0 0 16px;line-height:1.6">Khách vừa đặt mua trên website (ngôn ngữ: ${escapeHtml(order.locale)}). Phí vận chuyển chưa tính, cần trao đổi với khách trước khi xác nhận.</p><table style="border-collapse:collapse;font-size:14px">${orderRows(order, labels)}</table><p style="margin:24px 0 0"><a href="${escapeHtml(adminUrl)}" style="color:#8a1c1c">Mở đơn trong cổng quản trị</a></p>`,
  );
  const text = `${title}\n\n${orderText(order, labels)}\n\nMở đơn: ${adminUrl}`;
  return {
    to: recipients,
    subject: `[Red Door Shop] ${title} — ${order.customer.fullName}`,
    html,
    text,
    replyTo: order.customer.email,
  };
}

export function buildCustomerOrderEmail(order: ShopOrderDto): EmailMessage {
  const locale = order.locale === "vi" ? "vi" : "en";
  const labels = labelsByLocale[locale];
  const title =
    locale === "vi"
      ? `Red Door đã nhận đơn ${order.orderCode}`
      : `Red Door received your order ${order.orderCode}`;
  const intro =
    locale === "vi"
      ? "Cảm ơn bạn đã đặt mua. Chúng tôi sẽ liên hệ qua điện thoại hoặc email để xác nhận đơn và thông báo phí vận chuyển trước khi giao."
      : "Thank you for your order. We will contact you by phone or email to confirm the order and let you know the shipping cost before dispatch.";
  const html = wrap(
    title,
    `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(intro)}</p><table style="border-collapse:collapse;font-size:14px">${orderRows(order, labels)}</table>`,
  );
  const text = `${title}\n\n${intro}\n\n${orderText(order, labels)}`;
  return {
    to: [order.customer.email],
    subject: title,
    html,
    text,
  };
}

/**
 * Sends both emails and records what happened on the order. Never throws:
 * a mail problem is visible on the order in the portal, not to the visitor.
 */
export async function notifyShopOrderPlaced(
  order: ShopOrderDto,
  orderStore: ShopOrderStore,
  now: () => Date = () => new Date(),
): Promise<void> {
  const state = { ...order.notifications };
  const errors: string[] = [];

  const recipients = getOrderNotificationRecipients();
  const adminResult = await sendEmail(buildAdminOrderEmail(order, recipients));
  if (adminResult.sent) state.adminSentAt = now();
  else errors.push(`admin: ${adminResult.detail}`);

  const customerResult = await sendEmail(buildCustomerOrderEmail(order));
  if (customerResult.sent) state.customerSentAt = now();
  else errors.push(`customer: ${customerResult.detail}`);

  state.lastError =
    errors.length > 0 ? errors.join(" | ").slice(0, 1_000) : null;

  try {
    await orderStore.recordNotification({
      orderId: order.id,
      notifications: state,
    });
  } catch (error) {
    console.error("[shop] could not record notification state", error);
  }
}
