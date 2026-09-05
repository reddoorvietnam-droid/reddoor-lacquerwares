import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  recordQcPassAction,
  removePaymentDocumentAction,
  requestStageApprovalAction,
  setExportProgressAction,
  setSellingPriceAction,
  transitionOrderAction,
} from "@/app/[locale]/admin/(portal)/orders/actions";
import { voidInvoiceAction } from "@/app/[locale]/admin/(portal)/finance/actions";
import { FinanceEntryForm } from "@/app/[locale]/admin/(portal)/finance/entry-form";
import { InvoiceForm } from "@/app/[locale]/admin/(portal)/finance/invoice-form";
import {
  dateInputValue,
  EntryTable,
  formatDate,
  formatTotals,
  OutcomeBanner as FinanceBanner,
} from "@/app/[locale]/admin/(portal)/finance/shared";
import { DocumentUpload } from "@/components/admin/document-upload";
import { approvalService } from "@/domains/approvals/runtime";
import type {
  FinanceEntryRecordDto,
  InvoiceRecordDto,
} from "@/domains/finance/contracts";
import {
  financeCommandService,
  fxRateService,
  invoiceCommandService,
} from "@/domains/finance/runtime";
import type {
  InvoiceReceivableRow,
  OrderReceivableRow,
  ReceivablesReport,
} from "@/domains/finance/receivables";
import { customerKeyOf, customerCredit } from "@/domains/finance/receivables";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  isTerminalStage,
  orderProgressStages,
  orderStageDefinitions,
  stageDefinition,
  transitionNeedsReason,
} from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatBytes, storedDocumentUrl } from "@/lib/media/document-url";
import {
  formatMoney,
  supportedCurrencies,
  type Currency,
  type Money,
} from "@/lib/money";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Sổ đơn hàng",
    eyebrow: "Đơn hàng",
    currentStage: "Bước hiện tại",
    priceTitle: "Giá bán",
    priceHidden: "Bạn không có quyền xem giá bán của đơn này.",
    priceUnset: "Chưa nhập giá bán.",
    priceFormTitle: "Cập nhật giá bán (khi hồ sơ còn mở)",
    priceAmount: "Số tiền",
    priceCurrency: "Tiền tệ",
    priceSubmit: "Lưu giá bán",
    approvalTitle: "Phê duyệt của Giám đốc",
    approvalNeeded:
      "Rời bước này bắt buộc có quyết định phê duyệt còn hiệu lực của Giám đốc.",
    approvalPending: "Đang chờ Giám đốc quyết định.",
    approvalPendingStale:
      "Yêu cầu đang chờ được tạo trên phiên bản cũ của đơn — sau khi Giám đốc từ chối hoặc xử lý, hãy trình lại.",
    approvalGranted: "Đã được phê duyệt và còn hiệu lực.",
    approvalStale:
      "Đã có phê duyệt nhưng đơn hàng đã thay đổi sau đó — phải trình duyệt lại.",
    approvalMissing: "Chưa có yêu cầu phê duyệt nào cho bước này.",
    approvalRequest: "Trình Giám đốc phê duyệt",
    approvalQueue: "Mở hàng đợi phê duyệt →",
    qcTitle: "Kiểm soát chất lượng",
    qcPassed: "Đã đạt kiểm tra chất lượng.",
    qcNotPassed:
      "Chưa đạt kiểm tra. Ghi nhận đạt để mở đường sang đóng gói, hoặc trả về sản xuất kèm lý do.",
    qcPassButton: "Ghi nhận QC đạt",
    exportTitle: "Tiến độ xuất hàng",
    expectedReadyAt: "Ngày dự kiến sẵn hàng",
    bookingNumber: "Số booking",
    bookingDate: "Ngày booking / đóng hàng",
    exportSave: "Lưu tiến độ",
    notSet: "Chưa đặt",
    documentsTitle: "Chứng từ thanh toán",
    documentsHint: "Ủy nhiệm chi, giấy báo có, L/C… tải lên để lưu cùng đơn.",
    noDocuments: "Chưa có chứng từ nào.",
    removeDocument: "Gỡ",
    invoicesTitle: "Hóa đơn (INV)",
    noInvoices: "Chưa lập hóa đơn nào cho đơn này.",
    invoiceNumber: "Số HĐ",
    invoiceDue: "Hạn",
    invoiceAmount: "Giá trị",
    invoiceRemaining: "Còn thiếu",
    invoiceSettled: "Đã đủ",
    invoiceVoided: "Đã hủy",
    invoiceOverdue: "Quá hạn",
    invoiceFormTitle: "Lập hóa đơn cho đơn này",
    voidReasonPlaceholder: "Lý do hủy…",
    voidButton: "Hủy",
    moneyTitle: "Tiền của đơn",
    invoiced: "Đã xuất hóa đơn",
    paid: "Đã trả vào hóa đơn",
    deposits: "Đã cọc",
    remaining: "Còn thiếu",
    inAdvance: "Khách trả dư",
    noMoney: "Chưa có tiền nào ghi cho đơn này.",
    receiptsTitle: "Phiếu thu gắn với đơn",
    depositFormTitle: "Ghi tiền cọc cho đơn này",
    refundTitle: "Hoàn tiền cho khách",
    refundHint:
      "Đơn đã hủy, tiền khách đã trả vẫn nằm trong sổ. Chỉ ghi hoàn khi thực sự chuyển trả.",
    costsTitle: "Chi phí đã ghi",
    noCosts: "Chưa có phiếu chi nào.",
    viewCosts: "Ghi / xem phiếu chi →",
    moveTitle: "Chuyển bước",
    moveHint:
      "Chỉ các bước quy trình cho phép mới hiện ở đây. Quyền của bạn được kiểm tra lại trên máy chủ khi bấm.",
    reasonLabel: "Lý do (bắt buộc)",
    moveTo: "Chuyển sang",
    noMoves: "Đơn hàng đã ở trạng thái kết thúc.",
    notYourMove:
      "Bước hiện tại thuộc vị trí khác — bạn không giữ quyền chuyển bước này.",
    historyTitle: "Nhật ký chuyển bước",
    historyEmpty: "Chưa có lần chuyển bước nào.",
    progressTitle: "Tiến trình mười lăm bước",
    unitsTitle: "Đơn vị thực hiện",
    notices: {
      created: "Đã ghi nhận đơn hàng.",
      moved: "Đã chuyển bước.",
      qcPassed: "Đã ghi nhận QC đạt.",
      priceSet: "Đã lưu giá bán.",
      approvalRequested: "Đã trình Giám đốc.",
      exportSaved: "Đã lưu tiến độ xuất hàng.",
    } as Record<string, string>,
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy bản ghi.",
      REVISION_CONFLICT:
        "Đơn hàng đã thay đổi trong lúc bạn thao tác. Trang đã tải lại — kiểm tra rồi thử lại.",
      STAGE_MISMATCH: "Bước hiện tại của đơn không cho phép thao tác này.",
      INVALID_TRANSITION: "Quy trình không cho phép chuyển tới bước này.",
      TERMINAL_STAGE: "Đơn đã đóng hoặc đã hủy.",
      APPROVAL_REQUIRED: "Bước này cần quyết định phê duyệt của Giám đốc.",
      APPROVAL_MISSING: "Chưa có phê duyệt hợp lệ của Giám đốc.",
      QC_NOT_PASSED: "Chưa đạt kiểm tra chất lượng thì không được đóng gói.",
      REASON_REQUIRED: "Thao tác này bắt buộc ghi lý do.",
      ALREADY_PENDING: "Đã có một yêu cầu phê duyệt đang chờ.",
      INVALID_PRICE: "Giá bán không hợp lệ.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    back: "← Order book",
    eyebrow: "Order",
    currentStage: "Current stage",
    priceTitle: "Selling price",
    priceHidden: "You do not hold the permission to read this order's price.",
    priceUnset: "No selling price recorded yet.",
    priceFormTitle: "Update the selling price (while the file is open)",
    priceAmount: "Amount",
    priceCurrency: "Currency",
    priceSubmit: "Save price",
    approvalTitle: "Director approval",
    approvalNeeded:
      "Leaving this stage requires a still-valid Director decision.",
    approvalPending: "Waiting for the Director's decision.",
    approvalPendingStale:
      "The pending request was raised against an older revision — once decided, submit it again.",
    approvalGranted: "Approved and still valid.",
    approvalStale:
      "An approval exists but the order changed afterwards — request it again.",
    approvalMissing: "No approval request exists for this stage yet.",
    approvalRequest: "Submit for Director approval",
    approvalQueue: "Open the approval queue →",
    qcTitle: "Quality control",
    qcPassed: "The quality check has passed.",
    qcNotPassed:
      "Not passed yet. Record a pass to unlock packing, or return to production with a reason.",
    qcPassButton: "Record QC pass",
    exportTitle: "Export progress",
    expectedReadyAt: "Expected ready date",
    bookingNumber: "Booking number",
    bookingDate: "Booking / loading date",
    exportSave: "Save progress",
    notSet: "Not set",
    documentsTitle: "Payment documents",
    documentsHint: "Remittance advice, credit note, L/C… uploaded and kept with the order.",
    noDocuments: "No documents yet.",
    removeDocument: "Remove",
    invoicesTitle: "Invoices (INV)",
    noInvoices: "No invoice issued for this order yet.",
    invoiceNumber: "Number",
    invoiceDue: "Due",
    invoiceAmount: "Amount",
    invoiceRemaining: "Open",
    invoiceSettled: "Settled",
    invoiceVoided: "Voided",
    invoiceOverdue: "Overdue",
    invoiceFormTitle: "Issue an invoice for this order",
    voidReasonPlaceholder: "Reason…",
    voidButton: "Void",
    moneyTitle: "Money on this order",
    invoiced: "Invoiced",
    paid: "Paid on invoices",
    deposits: "Deposited",
    remaining: "Open",
    inAdvance: "Customer in advance",
    noMoney: "No money recorded for this order yet.",
    receiptsTitle: "Receipts linked to the order",
    depositFormTitle: "Record a deposit for this order",
    refundTitle: "Refund the customer",
    refundHint:
      "The order is cancelled; the money received stays in the book. Record a refund only when it is actually returned.",
    costsTitle: "Costs recorded",
    noCosts: "No cost entries yet.",
    viewCosts: "Record / view cost entries →",
    moveTitle: "Advance the order",
    moveHint:
      "Only moves the process allows appear here. Your permission is re-checked on the server.",
    reasonLabel: "Reason (required)",
    moveTo: "Move to",
    noMoves: "The order is in a terminal stage.",
    notYourMove:
      "The current stage belongs to another position — you do not hold its advance permission.",
    historyTitle: "Stage history",
    historyEmpty: "No transitions yet.",
    progressTitle: "The fifteen-step progress",
    unitsTitle: "Executing units",
    notices: {
      created: "The order has been recorded.",
      moved: "The order moved on.",
      qcPassed: "QC pass recorded.",
      priceSet: "Selling price saved.",
      approvalRequested: "Submitted to the Director.",
      exportSaved: "Export progress saved.",
    } as Record<string, string>,
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The record was not found.",
      REVISION_CONFLICT:
        "The order changed while you were acting. The page has reloaded — review and retry.",
      STAGE_MISMATCH: "The order's current stage does not allow this action.",
      INVALID_TRANSITION: "The process does not allow this move.",
      TERMINAL_STAGE: "The order is closed or cancelled.",
      APPROVAL_REQUIRED: "This stage needs a Director decision.",
      APPROVAL_MISSING: "No valid Director approval exists.",
      QC_NOT_PASSED: "Packing is blocked until the quality check passes.",
      REASON_REQUIRED: "This move must record a reason.",
      ALREADY_PENDING: "An approval request is already pending.",
      INVALID_PRICE: "The price is not valid.",
      INVALID_INPUT: "The submitted data is not valid.",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

function isPositive(value: Money): boolean {
  return !value.amount.startsWith("-") && Number(value.amount) !== 0;
}

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, orderId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  if (!/^[a-f0-9]{24}$/.test(orderId)) notFound();

  const raw = await orderCommandService.findForAuthorization(orderId);
  if (!raw) notFound();

  try {
    await requirePermission("orders.read", {
      resourceId: raw.id,
      businessUnitIds: raw.businessUnitIds,
    });
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const definition = stageDefinition(raw.stage);
  const coverages = await resolvePermissionCoverages([
    "orders.readSellingPrice",
    "orders.updateDraft",
    "orders.updateExportProgress",
    "production.approveQc",
    "approvals.request",
    "customers.read",
    "invoices.read",
    "invoices.manage",
    "payments.read",
    "payments.record",
    "payments.reverse",
    "payments.refund",
    "expenses.read",
    definition.advancePermission,
  ] as const);
  const reaches = (permission: keyof typeof coverages) =>
    coverageReaches(coverages[permission], raw.businessUnitIds);

  const priceVisible = reaches("orders.readSellingPrice");
  const order = (await orderCommandService.findById(orderId, priceVisible))!;
  const terminal = isTerminalStage(order.stage);

  const canAdvance = reaches(definition.advancePermission);
  const canRequestApproval = reaches("approvals.request");
  const canRecordQc = reaches("production.approveQc");
  const canEditPrice =
    reaches("orders.updateDraft") &&
    (order.stage === "received" || order.stage === "fileOpened");
  const canEditExport = reaches("orders.updateExportProgress") && !terminal;
  const canReadPayments = reaches("payments.read");
  const canRecordPayment = reaches("payments.record");
  const canReadInvoices = reaches("invoices.read");
  const canManageInvoices = reaches("invoices.manage") && !terminal;
  const canReadCosts = reaches("expenses.read");

  const approval = definition.approvalSubject
    ? await approvalService.findForResource(
        "salesOrder",
        order.id,
        definition.approvalSubject,
      )
    : null;
  const approvalValid =
    approval?.approved != null &&
    approval.approved.expectedRevision === order.revision;
  const approvalPendingStale =
    approval?.pending != null &&
    approval.pending.expectedRevision !== order.revision;

  // Money and invoices, only for readers entitled to them.
  let report: ReceivablesReport | null = null;
  let invoices: InvoiceRecordDto[] = [];
  let invoiceRows = new Map<string, InvoiceReceivableRow>();
  let orderRows: OrderReceivableRow[] = [];
  let todayRate: string | null = null;
  if (canReadInvoices) {
    [report, invoices] = await Promise.all([
      order.customerId
        ? financeCommandService.customerReceivables(order.customerId)
        : financeCommandService.receivables({ kind: "all" }),
      invoiceCommandService.list({ orderId: order.id }),
    ]);
    invoiceRows = new Map(
      report.invoices
        .filter((row) => row.invoice.orderId === order.id)
        .map((row) => [row.invoice.id, row]),
    );
    orderRows = report.orders.filter((row) => row.orderId === order.id);
    if (canManageInvoices) {
      todayRate = (await fxRateService.rateOn(new Date()))?.rate ?? null;
    }
  }

  let receipts: FinanceEntryRecordDto[] = [];
  if (canReadPayments) {
    const { scope } = await requireListAccess("payments.read");
    receipts = (
      await financeCommandService.list({
        scope,
        entryKind: "receipt",
        orderId: order.id,
        limit: 100,
      })
    ).filter((entry) => entry.category === "orderPayment");
  }

  let costTotals: readonly Money[] = [];
  if (canReadCosts) {
    const totals = await financeCommandService.sumActiveByOrder(
      [order.id],
      "expense",
    );
    costTotals = totals.get(order.id) ?? [];
  }

  const refundCredits: Money[] =
    order.stage === "cancelled" &&
    reaches("payments.refund") &&
    report &&
    order.customerId
      ? (["VND", "USD"] as const satisfies readonly Currency[])
          .map((currency) =>
            customerCredit(
              report,
              customerKeyOf(order.customerId, order.customerName),
              currency,
            ),
          )
          .filter(isPositive)
      : [];

  let maxBytes: number | null = null;
  try {
    maxBytes = getCloudinaryEnv().MAX_PDF_UPLOAD_MB * 1024 * 1024;
  } catch {
    maxBytes = null;
  }

  const orderCurrency: Currency =
    order.sellingPrice?.currency ??
    invoices.find((invoice) => invoice.status === "active")?.amount.currency ??
    "USD";

  const currentIndex = orderProgressStages.indexOf(order.stage);
  const cardClass =
    "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
  const buttonClass =
    "bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold";
  const fieldClass =
    "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none";
  const labelClass = "text-charcoal/60 mb-1 block text-xs";

  const financeNotice = notice && !text.notices[notice] ? notice : undefined;
  const financeError = error && !text.errors[error] ? error : undefined;

  return (
    <div>
      <Link
        href={`/${locale}/admin/orders` as Route}
        className="text-charcoal/55 hover:text-burgundy text-sm"
      >
        {text.back}
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
            <span className="font-mono text-4xl">{order.orderCode}</span>
          </h1>
          <p className="text-charcoal/75 mt-3 text-lg">
            {order.customerId && coverages["customers.read"].global ? (
              <Link
                href={`/${locale}/admin/customers/${order.customerId}` as Route}
                className="hover:underline"
              >
                {order.customerName}
              </Link>
            ) : (
              order.customerName
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
            {text.currentStage}
          </p>
          <p className="text-gold-ink mt-1 text-lg font-semibold">
            {definition.step !== null ? `${definition.step} · ` : ""}
            {definition.labels[locale]}
          </p>
        </div>
      </div>

      {notice && text.notices[notice] ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.notices[notice]}
        </p>
      ) : null}
      {error && text.errors[error] ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.errorLead} {text.errors[error]}
        </p>
      ) : null}
      {financeNotice || financeError ? (
        <FinanceBanner locale={locale} notice={financeNotice} error={financeError} />
      ) : null}

      {/* Progress rail */}
      <section className={`${cardClass} mt-8`}>
        <h2 className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
          {text.progressTitle}
        </h2>
        <ol className="mt-4 flex flex-wrap gap-2">
          {orderProgressStages.map((stage, index) => {
            const stageDef = orderStageDefinitions[stage];
            const state = terminal
              ? "past"
              : index < currentIndex
                ? "past"
                : index === currentIndex
                  ? "current"
                  : "future";
            return (
              <li
                key={stage}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  state === "current"
                    ? "border-lacquer bg-lacquer text-ivory font-semibold"
                    : state === "past"
                      ? "border-gold/50 bg-gold/10 text-charcoal/70"
                      : "border-burgundy/15 text-charcoal/40"
                }`}
              >
                {stageDef.step !== null ? `${stageDef.step} · ` : ""}
                {stageDef.labels[locale]}
              </li>
            );
          })}
          {terminal ? (
            <li className="border-lacquer bg-lacquer text-ivory rounded-full border px-3 py-1.5 text-xs font-semibold">
              {orderStageDefinitions[order.stage].labels[locale]}
            </li>
          ) : null}
        </ol>
        <p className="text-charcoal/50 mt-4 text-xs">
          {text.unitsTitle}:{" "}
          <span className="font-mono">{order.businessUnitIds.length}</span>
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Selling price */}
        <section className={cardClass}>
          <h2 className="text-burgundy font-serif text-2xl">{text.priceTitle}</h2>
          {order.sellingPriceVisible ? (
            <p className="text-charcoal/80 mt-3 font-mono text-xl">
              {order.sellingPrice
                ? formatMoney(order.sellingPrice, locale)
                : text.priceUnset}
            </p>
          ) : (
            <p className="text-charcoal/55 mt-3 text-sm">{text.priceHidden}</p>
          )}

          {canEditPrice ? (
            <form
              action={setSellingPriceAction}
              className="border-burgundy/10 mt-5 border-t pt-5"
            >
              <p className="text-charcoal/60 mb-3 text-sm font-semibold">
                {text.priceFormTitle}
              </p>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="expectedRevision" value={order.revision} />
              <div className="grid grid-cols-[1fr_7rem_auto] items-end gap-3">
                <div>
                  <label htmlFor="price-amount" className={labelClass}>
                    {text.priceAmount}
                  </label>
                  <input
                    id="price-amount"
                    name="amount"
                    required
                    inputMode="decimal"
                    maxLength={40}
                    className={`${fieldClass} font-mono`}
                  />
                </div>
                <div>
                  <label htmlFor="price-currency" className={labelClass}>
                    {text.priceCurrency}
                  </label>
                  <select
                    id="price-currency"
                    name="currency"
                    defaultValue={order.sellingPrice?.currency ?? "USD"}
                    className={fieldClass}
                  >
                    {supportedCurrencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className={buttonClass}>
                  {text.priceSubmit}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {/* Export progress */}
        {canEditExport || order.expectedReadyAt || order.bookingNumber || order.bookingDate ? (
          <section className={cardClass}>
            <h2 className="text-burgundy font-serif text-2xl">{text.exportTitle}</h2>
            {canEditExport ? (
              <form action={setExportProgressAction} className="mt-4 grid gap-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="expectedRevision" value={order.revision} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="export-ready" className={labelClass}>
                      {text.expectedReadyAt}
                    </label>
                    <input
                      id="export-ready"
                      type="date"
                      name="expectedReadyAt"
                      defaultValue={dateInputValue(order.expectedReadyAt)}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="export-booking-date" className={labelClass}>
                      {text.bookingDate}
                    </label>
                    <input
                      id="export-booking-date"
                      type="date"
                      name="bookingDate"
                      defaultValue={dateInputValue(order.bookingDate)}
                      className={fieldClass}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="export-booking" className={labelClass}>
                    {text.bookingNumber}
                  </label>
                  <input
                    id="export-booking"
                    type="text"
                    name="bookingNumber"
                    maxLength={120}
                    defaultValue={order.bookingNumber ?? ""}
                    className={`${fieldClass} font-mono`}
                  />
                </div>
                <div>
                  <button type="submit" className={buttonClass}>
                    {text.exportSave}
                  </button>
                </div>
              </form>
            ) : (
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <dt className="text-charcoal/50">{text.expectedReadyAt}</dt>
                <dd className="sm:col-span-2">
                  {order.expectedReadyAt ? formatDate(order.expectedReadyAt, locale) : text.notSet}
                </dd>
                <dt className="text-charcoal/50">{text.bookingNumber}</dt>
                <dd className="font-mono sm:col-span-2">{order.bookingNumber ?? text.notSet}</dd>
                <dt className="text-charcoal/50">{text.bookingDate}</dt>
                <dd className="sm:col-span-2">
                  {order.bookingDate ? formatDate(order.bookingDate, locale) : text.notSet}
                </dd>
              </dl>
            )}
          </section>
        ) : null}

        {/* Director approval gate */}
        {definition.approvalSubject ? (
          <section className={cardClass}>
            <h2 className="text-burgundy font-serif text-2xl">{text.approvalTitle}</h2>
            <p className="text-charcoal/60 mt-2 text-sm">{text.approvalNeeded}</p>
            <p
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                approvalValid
                  ? "bg-gold/15 text-gold-ink"
                  : approval?.pending
                    ? "bg-burgundy/5 text-charcoal/70"
                    : "bg-lacquer/5 text-lacquer"
              }`}
            >
              {approvalValid
                ? text.approvalGranted
                : approval?.pending
                  ? approvalPendingStale
                    ? text.approvalPendingStale
                    : text.approvalPending
                  : approval?.approved
                    ? text.approvalStale
                    : text.approvalMissing}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {!approval?.pending && !approvalValid && canRequestApproval ? (
                <form action={requestStageApprovalAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="orderId" value={order.id} />
                  <button type="submit" className={buttonClass}>
                    {text.approvalRequest}
                  </button>
                </form>
              ) : null}
              <Link
                href={`/${locale}/admin/approvals` as Route}
                className="text-burgundy text-sm font-semibold hover:underline"
              >
                {text.approvalQueue}
              </Link>
            </div>
          </section>
        ) : null}

        {/* Quality control */}
        {order.stage === "qualityControl" ? (
          <section className={cardClass}>
            <h2 className="text-burgundy font-serif text-2xl">{text.qcTitle}</h2>
            <p
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                order.qcPassed ? "bg-gold/15 text-gold-ink" : "bg-lacquer/5 text-lacquer"
              }`}
            >
              {order.qcPassed ? text.qcPassed : text.qcNotPassed}
            </p>
            {!order.qcPassed && canRecordQc ? (
              <form action={recordQcPassAction} className="mt-5">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="expectedRevision" value={order.revision} />
                <button type="submit" className={buttonClass}>
                  {text.qcPassButton}
                </button>
              </form>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* Invoices */}
      {canReadInvoices ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.invoicesTitle}</h2>
          {invoices.length === 0 ? (
            <p className="text-charcoal/55 mt-3 text-sm">{text.noInvoices}</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-3 py-2 font-semibold">{text.invoiceNumber}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{text.invoiceDue}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{text.invoiceAmount}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{text.invoiceRemaining}</th>
                  <th scope="col" className="px-3 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => {
                  const row = invoiceRows.get(invoice.id);
                  return (
                    <tr
                      key={invoice.id}
                      className={
                        invoice.status === "voided"
                          ? "border-burgundy/8 border-b opacity-45"
                          : "border-burgundy/8 border-b"
                      }
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/${locale}/admin/finance/invoices/${invoice.id}` as Route}
                          className="text-burgundy font-mono text-xs font-semibold hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">{formatDate(invoice.dueAt, locale)}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatMoney(invoice.amount, locale)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold">
                        {invoice.status === "voided" ? (
                          <span className="text-charcoal/50">{text.invoiceVoided}</span>
                        ) : row && isPositive(row.remaining) ? (
                          <span className="text-lacquer">
                            {formatMoney(row.remaining, locale)}
                            {row.overdue ? ` · ${text.invoiceOverdue}` : ""}
                          </span>
                        ) : (
                          <span className="text-emerald-700">{text.invoiceSettled}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {invoice.status === "active" && canManageInvoices ? (
                          <form action={voidInvoiceAction} className="flex items-center gap-2">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="returnTo" value={`order:${order.id}`} />
                            <input type="hidden" name="invoiceId" value={invoice.id} />
                            <input type="hidden" name="expectedRevision" value={invoice.revision} />
                            <input
                              type="text"
                              name="reason"
                              required
                              placeholder={text.voidReasonPlaceholder}
                              className="border-burgundy/20 w-28 rounded-lg border bg-white px-2 py-1.5 text-xs"
                            />
                            <button
                              type="submit"
                              className="text-lacquer border-lacquer/30 hover:bg-lacquer/5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                            >
                              {text.voidButton}
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {canManageInvoices ? (
            <div className="mt-5">
              <InvoiceForm
                locale={locale}
                title={text.invoiceFormTitle}
                returnTo={`order:${order.id}`}
                fixedOrderId={order.id}
                defaultCurrency={orderCurrency}
                todayRate={todayRate}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Money */}
      {canReadPayments ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.moneyTitle}</h2>
          {orderRows.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {orderRows.map((row) => (
                <dl
                  key={row.currency}
                  className="border-burgundy/10 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border p-4 text-sm"
                >
                  <dt className="text-charcoal/50 col-span-2 font-mono text-xs font-semibold">
                    {row.currency}
                  </dt>
                  <dt className="text-charcoal/60">{text.invoiced}</dt>
                  <dd className="text-right font-mono">{formatMoney(row.invoiced, locale)}</dd>
                  <dt className="text-charcoal/60">{text.paid}</dt>
                  <dd className="text-right font-mono text-emerald-700">{formatMoney(row.paid, locale)}</dd>
                  <dt className="text-charcoal/60">{text.deposits}</dt>
                  <dd className="text-right font-mono text-emerald-700">{formatMoney(row.deposits, locale)}</dd>
                  <dt className="text-charcoal/80 font-semibold">
                    {isPositive(row.remaining) ? text.remaining : text.inAdvance}
                  </dt>
                  <dd
                    className={`text-right font-mono font-semibold ${
                      isPositive(row.remaining) ? "text-lacquer" : "text-emerald-700"
                    }`}
                  >
                    {formatMoney(row.remaining, locale)}
                  </dd>
                </dl>
              ))}
            </div>
          ) : canReadInvoices ? (
            <p className="text-charcoal/55 mt-3 text-sm">{text.noMoney}</p>
          ) : null}

          <h3 className="text-charcoal/60 mt-6 text-xs font-semibold tracking-[0.12em] uppercase">
            {text.receiptsTitle}
          </h3>
          <div className="mt-3">
            <EntryTable
              locale={locale}
              entries={receipts}
              returnTo={`order:${order.id}`}
              showKind={false}
              showAllocation
              canVoid={() => reaches("payments.reverse")}
            />
          </div>

          {canRecordPayment && !terminal ? (
            <div className="mt-5">
              <FinanceEntryForm
                locale={locale}
                title={text.depositFormTitle}
                returnTo={`order:${order.id}`}
                categories={["orderPayment"]}
                hidden={{ allocateTo: `order:${order.id}` }}
                defaultCurrency={orderCurrency}
                idPrefix="order-deposit"
              />
            </div>
          ) : null}

          {refundCredits.length > 0 && order.customerId ? (
            <div className="mt-5">
              <FinanceEntryForm
                locale={locale}
                title={text.refundTitle}
                returnTo={`order:${order.id}`}
                categories={["refund"]}
                hidden={{ customerId: order.customerId, orderId: order.id }}
                defaultCurrency={refundCredits[0]!.currency}
                defaultAmount={refundCredits[0]!.amount}
                submitLabel={text.refundTitle}
                idPrefix="order-refund"
              />
              <p className="text-charcoal/50 mt-2 text-xs">{text.refundHint}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Costs */}
      {canReadCosts ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.costsTitle}</h2>
          <p className="mt-3 text-sm">
            {costTotals.length > 0 ? (
              <span className="text-lacquer font-mono font-semibold">
                {formatTotals(costTotals, locale)}
              </span>
            ) : (
              <span className="text-charcoal/55">{text.noCosts}</span>
            )}
          </p>
          <Link
            href={`/${locale}/admin/finance/expenses` as Route}
            className="text-burgundy mt-3 inline-block text-sm font-semibold hover:underline"
          >
            {text.viewCosts}
          </Link>
        </section>
      ) : null}

      {/* Payment documents */}
      {canReadPayments ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">{text.documentsTitle}</h2>
          <p className="text-charcoal/55 mt-2 text-sm">{text.documentsHint}</p>
          {order.paymentDocuments.length === 0 ? (
            <p className="text-charcoal/55 mt-4 text-sm">{text.noDocuments}</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {order.paymentDocuments.map((document) => (
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
                  {canRecordPayment ? (
                    <form action={removePaymentDocumentAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="expectedRevision" value={order.revision} />
                      <input type="hidden" name="documentId" value={document.id} />
                      <button
                        type="submit"
                        className="text-lacquer border-lacquer/30 hover:bg-lacquer/5 rounded-full border px-3 py-1 text-xs font-semibold"
                      >
                        {text.removeDocument}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canRecordPayment && maxBytes ? (
            <div className="mt-5">
              <DocumentUpload
                locale={locale}
                target={{ kind: "orderDocument", id: order.id }}
                expectedRevision={order.revision}
                maxBytes={maxBytes}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Transitions */}
      <section className={`${cardClass} mt-6`}>
        <h2 className="text-burgundy font-serif text-2xl">{text.moveTitle}</h2>
        <p className="text-charcoal/60 mt-2 text-sm">{text.moveHint}</p>

        {definition.next.length === 0 ? (
          <p className="text-charcoal/55 mt-5 text-sm">{text.noMoves}</p>
        ) : !canAdvance ? (
          <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-5 rounded-xl border px-4 py-3 text-sm">
            {text.notYourMove}
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {definition.next.map((target) => {
              const targetDef = orderStageDefinitions[target];
              const needsReason = transitionNeedsReason(order.stage, target);
              return (
                <form
                  key={target}
                  action={transitionOrderAction}
                  className="border-burgundy/10 rounded-xl border p-4"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="to" value={target} />
                  <input type="hidden" name="expectedRevision" value={order.revision} />
                  <p className="text-charcoal/80 text-sm font-semibold">
                    {text.moveTo}:{" "}
                    {targetDef.step !== null ? `${targetDef.step} · ` : ""}
                    {targetDef.labels[locale]}
                  </p>
                  {needsReason ? (
                    <div className="mt-3">
                      <label htmlFor={`reason-${target}`} className={labelClass}>
                        {text.reasonLabel}
                      </label>
                      <textarea
                        id={`reason-${target}`}
                        name="reason"
                        required
                        rows={2}
                        maxLength={2000}
                        className={fieldClass}
                      />
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    className={`${buttonClass} mt-4 ${
                      target === "cancelled"
                        ? "text-lacquer border-lacquer/40 hover:bg-lacquer/5 border bg-transparent"
                        : ""
                    }`}
                  >
                    {targetDef.labels[locale]}
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </section>

      {/* History */}
      <section className={`${cardClass} mt-6`}>
        <h2 className="text-burgundy font-serif text-2xl">{text.historyTitle}</h2>
        {order.stageHistory.length === 0 ? (
          <p className="text-charcoal/55 mt-4 text-sm">{text.historyEmpty}</p>
        ) : (
          <ol className="border-burgundy/10 divide-burgundy/8 mt-4 divide-y">
            {[...order.stageHistory].reverse().map((entry, index) => (
              <li key={index} className="flex flex-wrap gap-x-6 gap-y-1 py-3">
                <span className="text-charcoal/45 w-40 shrink-0 text-xs">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(entry.at)}
                </span>
                <span className="text-charcoal/80 text-sm">
                  {orderStageDefinitions[entry.from].labels[locale]}
                  {" → "}
                  <span className="font-semibold">
                    {orderStageDefinitions[entry.to].labels[locale]}
                  </span>
                </span>
                {entry.reason ? (
                  <span className="text-charcoal/55 w-full text-xs italic">
                    “{entry.reason}”
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
