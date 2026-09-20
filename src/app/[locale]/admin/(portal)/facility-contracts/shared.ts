import type {
  FacilityContractDocumentKind,
  FacilityContractStatus,
  FacilityPaymentStatus,
  PaymentNextActor,
} from "@/domains/facility-contracts/contracts";
import { formatMoney, money } from "@/lib/money";

/** Shared classes, so the site-contract screens read like the order file. */
export const cardClass =
  "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
export const buttonClass =
  "bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold";
export const ghostButtonClass =
  "border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-9 items-center rounded-full border px-4 text-xs font-semibold";
export const dangerButtonClass =
  "text-lacquer border-lacquer/30 hover:bg-lacquer/5 inline-flex min-h-9 items-center rounded-full border px-4 text-xs font-semibold";
export const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none";
export const labelClass = "text-charcoal/60 mb-1 block text-xs";
export const headingClass = "text-burgundy font-serif text-2xl";
export const okBadgeClass =
  "bg-gold/15 text-gold-ink inline-flex rounded-full px-3 py-1 text-xs font-semibold";
export const warnBadgeClass =
  "bg-lacquer/5 text-lacquer inline-flex rounded-full px-3 py-1 text-xs font-semibold";
export const mutedBadgeClass =
  "bg-burgundy/5 text-charcoal/60 inline-flex rounded-full px-3 py-1 text-xs font-semibold";
export const tableWrapClass =
  "border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
export const theadRowClass =
  "border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase";
export const thClass = "px-5 py-4 text-left font-semibold";
export const tdClass = "px-5 py-4 align-top";

export type AdminLocale = "vi" | "en";

export const contractStatusLabels: Record<
  FacilityContractStatus,
  { vi: string; en: string }
> = {
  draft: { vi: "Nháp", en: "Draft" },
  active: { vi: "Đang thực hiện", en: "Active" },
  cancelled: { vi: "Đã hủy", en: "Cancelled" },
};

export const contractStatusBadge: Record<FacilityContractStatus, string> = {
  draft: mutedBadgeClass,
  active: okBadgeClass,
  cancelled: warnBadgeClass,
};

export const paymentStatusLabels: Record<
  FacilityPaymentStatus,
  { vi: string; en: string }
> = {
  proposed: { vi: "Chờ kiểm tra", en: "Awaiting check" },
  checked: { vi: "Chờ kế toán công ty duyệt", en: "Awaiting accountant" },
  accountantApproved: {
    vi: "Chờ Giám đốc duyệt / chờ chi",
    en: "Awaiting Director / payment",
  },
  paid: { vi: "Đã chi", en: "Paid" },
  rejected: { vi: "Bị từ chối", en: "Rejected" },
};

export const paymentStatusBadge: Record<FacilityPaymentStatus, string> = {
  proposed: mutedBadgeClass,
  checked: mutedBadgeClass,
  accountantApproved: mutedBadgeClass,
  paid: okBadgeClass,
  rejected: warnBadgeClass,
};

export const nextActorLabels: Record<
  Exclude<PaymentNextActor, null>,
  { vi: string; en: string }
> = {
  factoryAccountantCheck: {
    vi: "Kế toán nhà máy kiểm tra",
    en: "Factory Accountant checks",
  },
  companyAccountantApprove: {
    vi: "Kế toán công ty duyệt",
    en: "Company Accountant approves",
  },
  directorThenPay: {
    vi: "Giám đốc duyệt, rồi Kế toán nhà máy chi",
    en: "Director approves, then the Factory Accountant pays",
  },
};

export const documentKindLabels: Record<
  FacilityContractDocumentKind,
  { vi: string; en: string }
> = {
  signedContract: { vi: "Hợp đồng đã ký", en: "Signed contract" },
  other: { vi: "Tài liệu khác", en: "Other document" },
};

export const errorMessages: Record<string, { vi: string; en: string }> = {
  FORBIDDEN: {
    vi: "Bạn không có quyền làm việc này.",
    en: "You are not allowed to do this.",
  },
  NOT_FOUND: { vi: "Không tìm thấy hồ sơ.", en: "Record not found." },
  FACILITY_NOT_FOUND: {
    vi: "Không tìm thấy cơ sở sản xuất.",
    en: "Production site not found.",
  },
  FACILITY_INACTIVE: {
    vi: "Cơ sở này đã ngừng hoạt động.",
    en: "This production site is no longer active.",
  },
  ORDER_NOT_FOUND: { vi: "Không tìm thấy đơn hàng.", en: "Order not found." },
  ORDER_CLOSED: {
    vi: "Đơn hàng đã đóng hoặc đã hủy, không gắn được.",
    en: "The order is closed or cancelled and cannot be linked.",
  },
  DUPLICATE_CODE: {
    vi: "Mã hợp đồng này đã có. Chọn mã khác hoặc để trống.",
    en: "This contract code is taken. Pick another or leave it blank.",
  },
  REVISION_CONFLICT: {
    vi: "Hồ sơ vừa được người khác thay đổi. Tải lại trang rồi làm lại.",
    en: "Someone changed the record meanwhile. Reload and try again.",
  },
  STATUS_MISMATCH: {
    vi: "Hồ sơ không còn ở bước cho phép việc này.",
    en: "The record is no longer at a step that allows this.",
  },
  INVALID_INPUT: {
    vi: "Thông tin chưa hợp lệ: kiểm tra cơ sở, các dòng hàng (mã, chủng loại, đơn giá), ngày giao không trước ngày bắt đầu, và lý do khi hủy hoặc từ chối.",
    en: "Invalid input: check the site, the lines (code, kind, unit price), a delivery date not before the start date, and a reason when cancelling or rejecting.",
  },
  INVALID_PRICE: {
    vi: "Số tiền không hợp lệ.",
    en: "The amount is invalid.",
  },
  NO_PRICE_INCREASE: {
    vi: "Không có dòng nào cao hơn giá cũ, không cần Giám đốc duyệt.",
    en: "No line is above the previous price; no Director approval is needed.",
  },
  HAS_OPEN_PAYMENTS: {
    vi: "Hợp đồng còn đề nghị thanh toán chưa bị từ chối, không hủy được.",
    en: "A payment request on this contract has not been rejected; it cannot be cancelled.",
  },
  AMOUNT_EXCEEDS_CONTRACT: {
    vi: "Tổng các đề nghị thanh toán vượt giá trị hợp đồng.",
    en: "The payment requests would exceed the contract value.",
  },
  SELF_CHECK: {
    vi: "Người đề nghị không tự kiểm tra đề nghị của mình.",
    en: "The proposer cannot check their own request.",
  },
  SELF_APPROVAL: {
    vi: "Người đề nghị hoặc người kiểm tra không tự duyệt.",
    en: "The proposer or the checker cannot approve.",
  },
  APPROVAL_ALREADY_VALID: {
    vi: "Giám đốc đã duyệt rồi.",
    en: "The Director has already approved.",
  },
  APPROVAL_MISSING: {
    vi: "Chưa có quyết định duyệt của Giám đốc.",
    en: "No approved Director decision yet.",
  },
  ALREADY_PENDING: {
    vi: "Đã có một yêu cầu đang chờ Giám đốc.",
    en: "A request is already waiting for the Director.",
  },
  UNAVAILABLE: {
    vi: "Hệ thống đang bận. Thử lại sau.",
    en: "The system is unavailable. Try again later.",
  },
};

export const noticeMessages: Record<string, { vi: string; en: string }> = {
  created: { vi: "Đã tạo hợp đồng nháp.", en: "Draft contract created." },
  saved: { vi: "Đã lưu hợp đồng.", en: "Contract saved." },
  approvalRequested: {
    vi: "Đã gửi Giám đốc duyệt.",
    en: "Sent to the Director.",
  },
  activated: {
    vi: "Hợp đồng đã có hiệu lực.",
    en: "The contract is now active.",
  },
  cancelled: { vi: "Đã hủy hợp đồng.", en: "Contract cancelled." },
  documentRemoved: { vi: "Đã gỡ tài liệu.", en: "Document removed." },
  proposed: {
    vi: "Đã gửi đề nghị thanh toán.",
    en: "Payment request sent.",
  },
  checked: { vi: "Đã kiểm tra đề nghị.", en: "Request checked." },
  approved: {
    vi: "Đã duyệt và gửi Giám đốc.",
    en: "Approved and sent to the Director.",
  },
  reRequested: {
    vi: "Đã trình lại Giám đốc.",
    en: "Sent to the Director again.",
  },
  rejected: { vi: "Đã từ chối đề nghị.", en: "Request rejected." },
  paid: { vi: "Đã ghi đã chi.", en: "Marked paid." },
};

export function messageFor(
  table: Record<string, { vi: string; en: string }>,
  code: string,
  locale: AdminLocale,
): string {
  return (table[code] ?? errorMessages.UNAVAILABLE!)[locale];
}

export function formatVnd(amount: string, locale: AdminLocale): string {
  return formatMoney(money(amount, "VND"), locale);
}
