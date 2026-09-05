import "server-only";

import type {
  QuoteRequestDeliveryTerm,
  QuoteRequestDto,
  QuoteRequestStore,
  QuoteRequestType,
} from "@/domains/quote-requests/contracts";
import {
  getOrderNotificationRecipients,
  sendEmail,
  type EmailMessage,
} from "@/lib/email/resend";
import { getSiteUrl } from "@/lib/seo/urls";

/**
 * The two emails a new quote request produces: one to the company inbox
 * listed in `ORDER_NOTIFICATION_EMAILS` (the same Gmail the shop uses), with
 * reply-to set to the buyer so staff answer straight from their mailbox, and
 * one acknowledgement to the buyer in their own language. Both are best
 * effort: the request is already saved before either is attempted.
 */

type Labels = {
  requestCode: string;
  requestType: string;
  requestTypes: Record<QuoteRequestType, string>;
  items: string;
  quantityUnit: string;
  estimatedQuantity: string;
  budget: string;
  deadline: string;
  deliveryTerms: string;
  deliveryTermOptions: Record<QuoteRequestDeliveryTerm, string>;
  destination: string;
  message: string;
  fullName: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  language: string;
};

const labelsByLocale: Record<"vi" | "en", Labels> = {
  vi: {
    requestCode: "Mã yêu cầu",
    requestType: "Loại yêu cầu",
    requestTypes: {
      existing_products: "Báo giá sản phẩm có sẵn",
      custom_design: "Thiết kế riêng / OEM",
      samples: "Đặt mẫu thử",
      catalogue: "Xin catalogue",
      other: "Khác",
    },
    items: "Sản phẩm quan tâm",
    quantityUnit: "chiếc",
    estimatedQuantity: "Số lượng dự kiến",
    budget: "Ngân sách / giá mục tiêu",
    deadline: "Thời hạn mong muốn",
    deliveryTerms: "Điều kiện giao hàng",
    deliveryTermOptions: {
      EXW: "EXW – giao tại xưởng",
      FOB: "FOB – giao lên tàu",
      CIF: "CIF – gồm bảo hiểm và cước",
      DDP: "DDP – giao tận nơi đã thuế",
      unsure: "Chưa xác định",
    },
    destination: "Nơi nhận hàng",
    message: "Nội dung",
    fullName: "Họ tên",
    company: "Công ty",
    email: "Email",
    phone: "Điện thoại",
    country: "Quốc gia",
    language: "Ngôn ngữ khách dùng",
  },
  en: {
    requestCode: "Request code",
    requestType: "Request type",
    requestTypes: {
      existing_products: "Quote for catalogue products",
      custom_design: "Custom design / OEM",
      samples: "Sample order",
      catalogue: "Catalogue request",
      other: "Other",
    },
    items: "Products of interest",
    quantityUnit: "pcs",
    estimatedQuantity: "Estimated quantity",
    budget: "Budget / target price",
    deadline: "Desired deadline",
    deliveryTerms: "Delivery terms",
    deliveryTermOptions: {
      EXW: "EXW – ex works",
      FOB: "FOB – free on board",
      CIF: "CIF – cost, insurance and freight",
      DDP: "DDP – delivered duty paid",
      unsure: "Not sure yet",
    },
    destination: "Destination",
    message: "Message",
    fullName: "Full name",
    company: "Company",
    email: "Email",
    phone: "Phone",
    country: "Country",
    language: "Customer's language",
  },
};

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

type SummaryRow = [label: string, value: string];

/** Label/value pairs in reading order; blank optional fields are left out. */
export function quoteRequestSummaryRows(
  request: QuoteRequestDto,
  labels: Labels,
): SummaryRow[] {
  const { contact, details } = request;
  const items = details.items
    .map((item) =>
      item.quantity
        ? `${item.productName} × ${item.quantity} ${labels.quantityUnit}`
        : item.productName,
    )
    .join("\n");
  const rows: (SummaryRow | null)[] = [
    [labels.requestCode, request.requestCode],
    [labels.requestType, labels.requestTypes[details.requestType]],
    items ? [labels.items, items] : null,
    details.estimatedQuantity
      ? [labels.estimatedQuantity, String(details.estimatedQuantity)]
      : null,
    details.budget ? [labels.budget, details.budget] : null,
    details.deadline ? [labels.deadline, details.deadline] : null,
    details.deliveryTerms
      ? [
          labels.deliveryTerms,
          labels.deliveryTermOptions[details.deliveryTerms],
        ]
      : null,
    details.destination ? [labels.destination, details.destination] : null,
    [labels.message, details.message],
    [labels.fullName, contact.fullName],
    contact.company ? [labels.company, contact.company] : null,
    [labels.email, contact.email],
    contact.phone ? [labels.phone, contact.phone] : null,
    [labels.country, contact.country],
  ];
  return rows.filter((entry): entry is SummaryRow => entry !== null);
}

function rowsHtml(rows: readonly SummaryRow[]): string {
  return rows.map(([label, value]) => row(label, value)).join("");
}

function rowsText(rows: readonly SummaryRow[]): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export function buildAdminQuoteRequestEmail(
  request: QuoteRequestDto,
  recipients: readonly string[],
): EmailMessage {
  // Staff read Vietnamese; the buyer's own language is noted in the body.
  const labels = labelsByLocale.vi;
  const adminUrl = new URL(
    `/vi/admin/quote-requests/${request.id}`,
    getSiteUrl(),
  ).toString();
  const title = `Yêu cầu báo giá mới ${request.requestCode}`;
  const rows: SummaryRow[] = [
    ...quoteRequestSummaryRows(request, labels),
    [labels.language, request.locale],
  ];
  const html = wrap(
    title,
    `<p style="margin:0 0 16px;line-height:1.6">Khách vừa gửi yêu cầu báo giá từ website. Trả lời email này sẽ gửi thẳng tới khách.</p><table style="border-collapse:collapse;font-size:14px">${rowsHtml(rows)}</table><p style="margin:24px 0 0"><a href="${escapeHtml(adminUrl)}" style="color:#8a1c1c">Mở yêu cầu trong cổng quản trị</a></p>`,
  );
  const text = `${title}\n\n${rowsText(rows)}\n\nMở yêu cầu: ${adminUrl}`;
  const who = request.contact.company
    ? `${request.contact.fullName} (${request.contact.company})`
    : request.contact.fullName;
  return {
    to: recipients,
    subject: `[Red Door] ${title} — ${who}`,
    html,
    text,
    replyTo: request.contact.email,
  };
}

export function buildCustomerQuoteRequestEmail(
  request: QuoteRequestDto,
): EmailMessage {
  const locale = request.locale === "vi" ? "vi" : "en";
  const labels = labelsByLocale[locale];
  const title =
    locale === "vi"
      ? `Red Door đã nhận yêu cầu báo giá ${request.requestCode}`
      : `Red Door received your quote request ${request.requestCode}`;
  const intro =
    locale === "vi"
      ? "Cảm ơn bạn đã liên hệ. Chúng tôi sẽ xem xét yêu cầu và phản hồi qua email trong vòng 1–2 ngày làm việc. Khi trao đổi, bạn chỉ cần nhắc mã yêu cầu bên dưới."
      : "Thank you for getting in touch. We will review your request and reply by email within one to two working days. Please quote the request code below in any follow-up.";
  const rows = quoteRequestSummaryRows(request, labels);
  const html = wrap(
    title,
    `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(intro)}</p><table style="border-collapse:collapse;font-size:14px">${rowsHtml(rows)}</table>`,
  );
  const text = `${title}\n\n${intro}\n\n${rowsText(rows)}`;
  return {
    to: [request.contact.email],
    subject: title,
    html,
    text,
  };
}

/**
 * Sends both emails and records what happened on the request. Never throws:
 * a mail problem is visible on the request in the portal, not to the visitor.
 */
export async function notifyQuoteRequestSubmitted(
  request: QuoteRequestDto,
  store: QuoteRequestStore,
  now: () => Date = () => new Date(),
): Promise<void> {
  const state = { ...request.notifications };
  const errors: string[] = [];

  const recipients = getOrderNotificationRecipients();
  const adminResult = await sendEmail(
    buildAdminQuoteRequestEmail(request, recipients),
  );
  if (adminResult.sent) state.adminSentAt = now();
  else errors.push(`admin: ${adminResult.detail}`);

  const customerResult = await sendEmail(
    buildCustomerQuoteRequestEmail(request),
  );
  if (customerResult.sent) state.customerSentAt = now();
  else errors.push(`customer: ${customerResult.detail}`);

  state.lastError =
    errors.length > 0 ? errors.join(" | ").slice(0, 1_000) : null;

  try {
    await store.recordNotification({
      requestId: request.id,
      notifications: state,
    });
  } catch (error) {
    console.error(
      "[quote-requests] could not record notification state",
      error,
    );
  }
}
