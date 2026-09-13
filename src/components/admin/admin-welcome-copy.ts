import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * Words for the welcome page every role lands on after signing in. Kept apart
 * from the page so tests can check that each role and each menu entry has
 * its line in both languages.
 */

type Localized = Record<AdminLocale, string>;

export const welcomeCopy = {
  vi: {
    startHeading: "Bắt đầu làm việc",
    pendingStaff: "đang chờ duyệt",
    fallbackName: "bạn",
    noRole: "Chưa có vai trò",
  },
  en: {
    startHeading: "Start working",
    pendingStaff: "awaiting approval",
    fallbackName: "there",
    noRole: "No role yet",
  },
} as const satisfies Record<AdminLocale, Record<string, string>>;

/** One welcoming line per position, in the voice of that person's work. */
export const roleWelcome: Record<SystemRoleKey, Localized> = {
  DIRECTOR: {
    vi: "Mọi mảng của Red Door hội tụ ở đây. Duyệt người mới, giao việc và nắm tình hình từng bộ phận chỉ trong vài lượt nhấn.",
    en: "Every part of Red Door comes together here. Approve newcomers, hand out work and follow each team in a few clicks.",
  },
  WAREHOUSE_MANAGER: {
    vi: "Kho sơn, nguyên vật liệu, phiếu bán hàng và công nợ quầy — mỗi lần nhập, xuất đều bắt đầu từ đây.",
    en: "Paint stock, raw materials, sales slips and counter debt — every receipt and issue starts here.",
  },
  FACTORY_MANAGER: {
    vi: "Theo sát đơn hàng qua từng bước sản xuất, cùng bảng biểu và chi phí của nhà máy.",
    en: "Follow orders through each production step, alongside the factory's spreadsheets and costs.",
  },
  FACTORY_ACCOUNTANT: {
    vi: "Chi phí đơn hàng, nhà cung cấp và bảng biểu mua hàng của nhà máy, gọn trong một chỗ.",
    en: "Order costs, suppliers and the factory's purchasing spreadsheets, all in one place.",
  },
  COMPANY_ACCOUNTANT: {
    vi: "Hoá đơn, tiền khách trả, công nợ và tỷ giá — bức tranh tài chính của công ty nằm ở đây.",
    en: "Invoices, customer payments, receivables and exchange rates — the company's finances at a glance.",
  },
  CONTENT_CREATOR: {
    vi: "Tin tức, sản phẩm, bộ sưu tập và cửa hàng — nơi câu chuyện sơn mài Red Door đến với khách hàng.",
    en: "News, products, collections and the shop — where the Red Door lacquer story reaches customers.",
  },
};

/** What each menu entry is for, keyed by its path below `/[locale]/admin`. */
const navDescriptions: Record<string, Localized> = {
  "/paint-warehouse": {
    vi: "Ghi và tra cứu các lần xuất kho sơn.",
    en: "Record and look up paint issues.",
  },
  "/materials": {
    vi: "Tồn kho, nhập và xuất nguyên vật liệu.",
    en: "Stock, receipts and issues of raw materials.",
  },
  "/sales-slips": {
    vi: "Lập, in và theo dõi phiếu bán hàng.",
    en: "Write, print and track sales slips.",
  },
  "/receivables": {
    vi: "Công nợ của khách mua sơn tại quầy.",
    en: "What paint-counter customers still owe.",
  },
  "/assistant": {
    vi: "Hỏi nhanh về đơn hàng, số liệu và công việc.",
    en: "Ask about orders, figures and work.",
  },
  "/tasks": {
    vi: "Giao việc kèm hạn và trả lời xin gia hạn.",
    en: "Hand out work with deadlines and answer extensions.",
  },
  "/my-tasks": {
    vi: "Việc được giao cho bạn và hạn hoàn thành.",
    en: "Work handed to you and its deadlines.",
  },
  "/orders": {
    vi: "Danh sách đơn hàng và tiến độ từng đơn.",
    en: "Orders and where each one stands.",
  },
  "/customers": {
    vi: "Hồ sơ khách hàng và thông tin xuất hoá đơn.",
    en: "Customer records and billing details.",
  },
  "/suppliers": {
    vi: "Danh bạ nhà cung cấp và thông tin liên hệ.",
    en: "Supplier directory and contacts.",
  },
  "/operations": {
    vi: "Mười lăm bước của một đơn hàng.",
    en: "The fifteen steps of an order.",
  },
  "/approvals": {
    vi: "Các nghiệp vụ đang chờ bạn quyết định.",
    en: "Operations awaiting your decision.",
  },
  "/organization": {
    vi: "Vị trí, trách nhiệm và dữ liệu phụ trách.",
    en: "Positions, responsibilities and owned data.",
  },
  "/staff": {
    vi: "Duyệt Gmail mới, chọn role, khoá hoặc mở khoá.",
    en: "Approve new Gmail sign-ins, pick roles, lock or unlock.",
  },
  "/content": {
    vi: "Nội dung các trang của website.",
    en: "Copy for the website's pages.",
  },
  "/sample-progress": {
    vi: "Báo cáo tiến độ mẫu hằng tuần.",
    en: "Weekly sample progress reports.",
  },
  "/products": {
    vi: "Sản phẩm giới thiệu trên website.",
    en: "Products presented on the website.",
  },
  "/news": {
    vi: "Viết và xuất bản bài mới.",
    en: "Write and publish articles.",
  },
  "/collections": {
    vi: "Bộ sưu tập và catalogue.",
    en: "Collections and catalogues.",
  },
  "/shop": {
    vi: "Mặt hàng bán lẻ trên cửa hàng online.",
    en: "Retail items in the online shop.",
  },
  "/shop/orders": {
    vi: "Đơn khách đặt từ cửa hàng online.",
    en: "Orders placed in the online shop.",
  },
  "/quote-requests": {
    vi: "Yêu cầu báo giá gửi từ website.",
    en: "Quote requests sent from the website.",
  },
  "/settings": {
    vi: "Trạng thái cấu hình các dịch vụ.",
    en: "Configuration status of the services.",
  },
  "/finance": {
    vi: "Toàn cảnh thu, chi và công nợ.",
    en: "Income, spending and receivables at a glance.",
  },
  "/finance/invoices": {
    vi: "Hoá đơn bán hàng theo từng đơn.",
    en: "Sales invoices per order.",
  },
  "/finance/payments": {
    vi: "Tiền khách trả và phân bổ vào hoá đơn.",
    en: "Customer payments and their allocation.",
  },
  "/finance/receivables": {
    vi: "Khách còn nợ theo từng hoá đơn.",
    en: "What customers still owe per invoice.",
  },
  "/checks": {
    vi: "Đối chiếu file Excel với dữ liệu hệ thống.",
    en: "Check spreadsheets against system data.",
  },
  "/finance/ledger": {
    vi: "Sổ tiền vào, tiền ra.",
    en: "Money in and money out.",
  },
  "/finance/expenses": {
    vi: "Chi phí phát sinh theo đơn hàng.",
    en: "Costs incurred per order.",
  },
  "/finance/fx": {
    vi: "Tỷ giá USD dùng cho sổ sách.",
    en: "USD rates used in the books.",
  },
};

export function describeNavHref(
  href: string,
  basePath: string,
  locale: AdminLocale,
): string | null {
  const path = href.startsWith(basePath) ? href.slice(basePath.length) : href;
  return Object.hasOwn(navDescriptions, path)
    ? navDescriptions[path]![locale]
    : null;
}

/** A greeting for the hour of day, in the company's time zone. */
export function greetingFor(hour: number, locale: AdminLocale): string {
  if (locale === "vi") {
    if (hour >= 4 && hour < 11) return "Chào buổi sáng";
    if (hour >= 11 && hour < 13) return "Chào buổi trưa";
    if (hour >= 13 && hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}
