import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
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
import { orderProfit, type OrderProfit } from "@/domains/finance/profit";
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
import { readLookups } from "@/domains/materials/service";
import {
  deliveryLateness,
  orderDocumentKinds,
  orderDocumentPermissions,
  orderReadiness,
  stageEnteredAt,
  type OrderDocumentKind,
} from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  isTerminalStage,
  orderProgressStages,
  orderStageDefinitions,
  stageDefinition,
  transitionNeedsReason,
  type OrderStage,
} from "@/domains/orders/workflow";
import { setTaskStatusAction } from "@/app/[locale]/admin/(portal)/tasks/actions";
import type { TaskRecordDto } from "@/domains/tasks/contracts";
import { formatBusinessDay, isOverdue } from "@/domains/tasks/policy";
import { taskCommandService } from "@/domains/tasks/runtime";
import { getNotificationEnv } from "@/lib/env/server";
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

import { DocumentsSection } from "./sections/documents";
import { LabelsSection } from "./sections/labels";
import { OrderInfoSection } from "./sections/order-info";
import { PackingSection } from "./sections/packing";
import { ProductionSection } from "./sections/production";
import { ProfitSection } from "./sections/profit";
import {
  buttonClass,
  cardClass,
  fieldClass,
  labelClass,
  okBadgeClass,
  warnBadgeClass,
} from "./sections/styles";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    back: "← Sổ đơn hàng",
    eyebrow: "Đơn hàng",
    currentStage: "Bước hiện tại",
    sinceDays: (date: string, days: number) => `Từ ${date} · ${days} ngày`,
    deliveryDue: (date: string) => `Hạn giao ${date}`,
    deliveryDueIn: (days: number) => `còn ${days} ngày`,
    deliveryDuePast: (days: number) => `quá ${days} ngày`,
    deliveredOnTime: "Giao đúng hạn",
    deliveredLate: (days: number) => `Giao trễ ${days} ngày`,
    priceTitle: "Giá bán",
    priceHidden: "Bạn không có quyền xem giá bán của đơn này.",
    priceUnset: "Chưa nhập giá bán.",
    priceFormTitle: "Cập nhật giá bán (trước khi Giám đốc xác nhận)",
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
    tasksTitle: "Việc liên quan",
    noTasks: "Chưa có việc nào cho đơn này.",
    taskDone: "Xong",
    taskOverdue: "Quá hạn",
    allTasks: "Tất cả việc của đơn →",
    planWithAssistant: "Lập kế hoạch với trợ lý →",
    moveTitle: "Chuyển bước",
    moveHint:
      "Chỉ các bước quy trình cho phép mới hiện ở đây. Quyền của bạn được kiểm tra lại trên máy chủ khi bấm.",
    blockedLead: "Chưa rời được bước này:",
    blockers: {
      planned: "chưa lưu kế hoạch sản xuất",
      productionComplete: "chưa tới công đoạn Hoàn thiện",
      qcPassed: "chưa ghi kiểm hoàn thiện đạt",
      packingReady: "chưa có phiếu đóng gói hoặc kiểm đóng gói chưa đạt",
      labelsReady:
        "chưa có mẫu tem của khách hoặc mẫu tem công ty chưa được Giám đốc duyệt",
      exportDocumentsReady: "chưa tải INV và PKL",
      customsDeclared: "chưa tải tờ khai hải quan",
    },
    reasonLabel: "Lý do (bắt buộc)",
    moveTo: "Chuyển sang",
    noMoves: "Đơn hàng đã ở trạng thái kết thúc.",
    notYourMove:
      "Bước hiện tại thuộc vị trí khác — bạn không giữ quyền chuyển bước này.",
    historyTitle: "Nhật ký chuyển bước",
    historyEmpty: "Chưa có lần chuyển bước nào.",
    progressTitle: "Tiến trình mười một bước",
    unitsTitle: "Đơn vị thực hiện",
    notices: {
      created: "Đã ghi nhận đơn hàng.",
      moved: "Đã chuyển bước.",
      qcChecked: "Đã ghi kết quả kiểm.",
      productionStageSet: "Đã chuyển công đoạn.",
      planSaved: "Đã lưu kế hoạch sản xuất.",
      packingSaved: "Đã lưu phiếu đóng gói.",
      linesSaved: "Đã lưu hàng đặt.",
      detailsSaved: "Đã lưu shipping mark, ngày giao và chỉ tiêu.",
      priceSet: "Đã lưu giá bán.",
      approvalRequested: "Đã trình Giám đốc.",
      exportSaved: "Đã lưu tiến độ xuất hàng.",
      documentRemoved: "Đã gỡ tệp.",
      labelApproved: "Đã duyệt mẫu tem.",
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
      QC_NOT_PASSED: "Chưa ghi kiểm hoàn thiện đạt thì không được đóng gói.",
      PLAN_MISSING: "Phải lưu kế hoạch sản xuất trước khi rời bước 3.",
      PRODUCTION_INCOMPLETE:
        "Đơn phải ở công đoạn Hoàn thiện mới sang kiểm tra chất lượng.",
      PACKING_NOT_READY:
        "Cần phiếu đóng gói của Thủ kho và kiểm đóng gói đạt trước khi rời bước 7.",
      LABELS_NOT_APPROVED:
        "Cần mẫu tem, shipping mark của khách, hoặc mẫu công ty đã được Giám đốc duyệt, trước khi rời bước 7.",
      SELF_APPROVAL: "Người tải mẫu tem lên không tự duyệt được mẫu đó.",
      EXPORT_DOCUMENTS_MISSING: "Phải tải INV và PKL lên trước khi rời bước 8.",
      CUSTOMS_DECLARATION_MISSING:
        "Phải tải tờ khai hải quan lên trước khi rời bước 9.",
      WOODWORK_NOT_PASSED: "Kiểm mộc phải đạt thì mới chuyển sang Sơn.",
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
    sinceDays: (date: string, days: number) => `Since ${date} · ${days} days`,
    deliveryDue: (date: string) => `Due ${date}`,
    deliveryDueIn: (days: number) => `${days} days left`,
    deliveryDuePast: (days: number) => `${days} days past`,
    deliveredOnTime: "Delivered on time",
    deliveredLate: (days: number) => `Delivered ${days} days late`,
    priceTitle: "Selling price",
    priceHidden: "You do not hold the permission to read this order's price.",
    priceUnset: "No selling price recorded yet.",
    priceFormTitle: "Update the selling price (before the Director confirms)",
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
    exportTitle: "Export progress",
    expectedReadyAt: "Expected ready date",
    bookingNumber: "Booking number",
    bookingDate: "Booking / loading date",
    exportSave: "Save progress",
    notSet: "Not set",
    documentsTitle: "Payment documents",
    documentsHint:
      "Remittance advice, credit note, L/C… uploaded and kept with the order.",
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
    tasksTitle: "Related tasks",
    noTasks: "No task for this order yet.",
    taskDone: "Done",
    taskOverdue: "Overdue",
    allTasks: "All tasks of this order →",
    planWithAssistant: "Plan with the assistant →",
    moveTitle: "Advance the order",
    moveHint:
      "Only moves the process allows appear here. Your permission is re-checked on the server.",
    blockedLead: "This stage cannot be left yet:",
    blockers: {
      planned: "the production plan is not saved",
      productionComplete: "the finishing stage has not been reached",
      qcPassed: "the finishing inspection has not passed",
      packingReady: "no packing slip, or the packing inspection has not passed",
      labelsReady:
        "no customer label spec, or the company label proof is not approved by the Director",
      exportDocumentsReady: "INV and PKL are not on file",
      customsDeclared: "the customs declaration is not on file",
    },
    reasonLabel: "Reason (required)",
    moveTo: "Move to",
    noMoves: "The order is in a terminal stage.",
    notYourMove:
      "The current stage belongs to another position — you do not hold its advance permission.",
    historyTitle: "Stage history",
    historyEmpty: "No transitions yet.",
    progressTitle: "The eleven-step progress",
    unitsTitle: "Executing units",
    notices: {
      created: "The order has been recorded.",
      moved: "The order moved on.",
      qcChecked: "Inspection recorded.",
      productionStageSet: "Workshop stage changed.",
      planSaved: "Production plan saved.",
      packingSaved: "Packing slip saved.",
      linesSaved: "Items saved.",
      detailsSaved: "Shipping mark, delivery date and targets saved.",
      priceSet: "Selling price saved.",
      approvalRequested: "Submitted to the Director.",
      exportSaved: "Export progress saved.",
      documentRemoved: "File removed.",
      labelApproved: "Label proof approved.",
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
      QC_NOT_PASSED:
        "Packing is blocked until the finishing inspection passes.",
      PLAN_MISSING: "Save the production plan before leaving step 3.",
      PRODUCTION_INCOMPLETE:
        "The order must be at the finishing stage before quality control.",
      PACKING_NOT_READY:
        "The Storekeeper's packing slip and a passed packing inspection are needed before leaving step 7.",
      LABELS_NOT_APPROVED:
        "The customer's label and shipping-mark spec, or a company proof the Director approved, is needed before leaving step 7.",
      SELF_APPROVAL: "Whoever uploaded the label proof cannot approve it.",
      EXPORT_DOCUMENTS_MISSING: "Upload the INV and PKL before leaving step 8.",
      CUSTOMS_DECLARATION_MISSING:
        "Upload the customs declaration before leaving step 9.",
      WOODWORK_NOT_PASSED: "The raw-body inspection must pass before lacquer.",
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

/** One rail pill per SOP step; the first stage of a step names it. */
const sopSteps = orderProgressStages.reduce<
  { step: number; stage: OrderStage }[]
>((steps, stage) => {
  const step = orderStageDefinitions[stage].step;
  if (step !== null && !steps.some((entry) => entry.step === step)) {
    steps.push({ step, stage });
  }
  return steps;
}, []);

/** Stages of the production story, where the plan / workshop / QC card shows. */
const productionStory: readonly OrderStage[] = [
  "productionPlanning",
  "inventoryCheck",
  "materialProcurement",
  "inProduction",
  "qualityControl",
  "packing",
];

async function facilityNames(): Promise<string[]> {
  try {
    const { facilities } = await readLookups();
    return facilities
      .filter((facility) => facility.active)
      .map((facility) => facility.name)
      .filter((name) => name.length > 0);
  } catch {
    return [];
  }
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

  let currentUserId: string;
  try {
    ({ userId: currentUserId } = await requirePermission("orders.read", {
      resourceId: raw.id,
      businessUnitIds: raw.businessUnitIds,
    }));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const definition = stageDefinition(raw.stage);
  const coverages = await resolvePermissionCoverages([
    "orders.readSellingPrice",
    "orders.updateDraft",
    "orders.updateExportProgress",
    "production.createPlan",
    "production.updateProgress",
    "production.approveQc",
    "packing.update",
    "tradeDocuments.manage",
    "samples.update",
    "inventory.issue",
    "approvals.request",
    "approvals.decide",
    "customers.read",
    "invoices.read",
    "invoices.manage",
    "payments.read",
    "payments.record",
    "payments.reverse",
    "payments.refund",
    "expenses.read",
    "finance.readProfit",
    "tasks.read",
    "tasks.create",
    "assistant.use",
    definition.advancePermission,
  ] as const);
  const reaches = (permission: keyof typeof coverages) =>
    coverageReaches(coverages[permission], raw.businessUnitIds);

  const priceVisible = reaches("orders.readSellingPrice");
  const order = (await orderCommandService.findById(orderId, priceVisible))!;
  const terminal = isTerminalStage(order.stage);
  const now = new Date();

  const canAdvance = reaches(definition.advancePermission);
  const canRequestApproval = reaches("approvals.request");
  const canEditOrder = reaches("orders.updateDraft") && !terminal;
  const canEditPrice =
    reaches("orders.updateDraft") &&
    priceVisible &&
    (order.stage === "received" || order.stage === "awaitingDirectorApproval");
  const canPlan = reaches("production.createPlan") && !terminal;
  const canProgress = reaches("production.updateProgress");
  const canInspect = reaches("production.approveQc");
  const canPack = reaches("packing.update") && order.stage === "packing";
  const canEditExport = reaches("orders.updateExportProgress") && !terminal;
  const canReadPayments = reaches("payments.read");
  const canRecordPayment = reaches("payments.record");
  const canReadInvoices = reaches("invoices.read");
  const canManageInvoices = reaches("invoices.manage") && !terminal;
  const canReadCosts = reaches("expenses.read");
  const canReadProfit = reaches("finance.readProfit");

  // Per document kind, whether the reader files and removes it. The
  // permission map is the same one the upload signature and the action use.
  const canAttach = Object.fromEntries(
    orderDocumentKinds.map((kind) => [
      kind,
      coverageReaches(
        coverages[orderDocumentPermissions[kind] as keyof typeof coverages] ?? {
          global: false,
          businessUnitIds: [],
        },
        raw.businessUnitIds,
      ),
    ]),
  ) as Record<OrderDocumentKind, boolean>;

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

  // Invoices for whoever reads them (the Factory Accountant writes the INV);
  // what the customer paid only for `payments.read`.
  let invoices: InvoiceRecordDto[] = [];
  let todayRate: string | null = null;
  if (canReadInvoices) {
    invoices = await invoiceCommandService.list({ orderId: order.id });
    if (canManageInvoices) {
      todayRate = (await fxRateService.rateOn(now))?.rate ?? null;
    }
  }

  let report: ReceivablesReport | null = null;
  let invoiceRows = new Map<string, InvoiceReceivableRow>();
  let orderRows: OrderReceivableRow[] = [];
  let receipts: FinanceEntryRecordDto[] = [];
  if (canReadPayments) {
    report = order.customerId
      ? await financeCommandService.customerReceivables(order.customerId)
      : await financeCommandService.receivables({ kind: "all" });
    invoiceRows = new Map(
      report.invoices
        .filter((row) => row.invoice.orderId === order.id)
        .map((row) => [row.invoice.id, row]),
    );
    orderRows = report.orders.filter((row) => row.orderId === order.id);

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

  // The Director's profit line: invoices minus the costs on the order.
  let profit: OrderProfit | null = null;
  if (canReadProfit) {
    const expenses = await financeCommandService.list({
      scope: { kind: "all" },
      entryKind: "expense",
      orderId: order.id,
      limit: 500,
    });
    profit = orderProfit(invoices, expenses);
  }

  // Work items on this order, narrowed like the task list.
  let orderTasks: TaskRecordDto[] = [];
  const canReadTasks = reaches("tasks.read");
  const canPlanWithAssistant =
    !terminal && reaches("assistant.use") && reaches("tasks.create");
  if (canReadTasks) {
    const { scope: taskScope } = await requireListAccess("tasks.read");
    orderTasks = await taskCommandService.list({
      scope:
        taskScope.kind === "all"
          ? { kind: "all" }
          : taskScope.kind === "businessUnits"
            ? {
                kind: "businessUnits",
                businessUnitIds: taskScope.businessUnitIds,
                userId: currentUserId,
              }
            : { kind: "own", userId: currentUserId },
      orderId: order.id,
      limit: 50,
    });
  }
  const timeZone = getNotificationEnv().BUSINESS_TIMEZONE;

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

  const facilities = canEditOrder ? await facilityNames() : [];

  const orderCurrency: Currency =
    order.sellingPrice?.currency ??
    invoices.find((invoice) => invoice.status === "active")?.amount.currency ??
    "USD";

  // Header facts: how long the order has sat in its stage, and the promise.
  const enteredAt = stageEnteredAt(order);
  const daysInStage = Math.max(
    0,
    Math.floor((now.getTime() - enteredAt.getTime()) / 86_400_000),
  );
  const lateness = deliveryLateness(order);
  const daysToDue = order.deliveryDueAt
    ? Math.ceil((order.deliveryDueAt.getTime() - now.getTime()) / 86_400_000)
    : null;

  // Why the forward move is refused, for the position that would make it.
  const readiness = orderReadiness(order);
  const blockers: string[] = [];
  if (order.stage === "productionPlanning" && !readiness.planned)
    blockers.push(text.blockers.planned);
  if (order.stage === "inProduction" && !readiness.productionComplete)
    blockers.push(text.blockers.productionComplete);
  if (order.stage === "qualityControl" && !order.qcPassed)
    blockers.push(text.blockers.qcPassed);
  if (order.stage === "packing" && !readiness.packingReady)
    blockers.push(text.blockers.packingReady);
  if (order.stage === "packing" && !readiness.labelsReady)
    blockers.push(text.blockers.labelsReady);
  if (order.stage === "exportDocuments" && !readiness.exportDocumentsReady)
    blockers.push(text.blockers.exportDocumentsReady);
  if (order.stage === "tradeDocumentation" && !readiness.customsDeclared)
    blockers.push(text.blockers.customsDeclared);

  const currentStep = definition.step;
  const showProduction =
    productionStory.includes(order.stage) ||
    order.productionPlan !== null ||
    order.qcChecks.length > 0;
  const showPacking = order.stage === "packing" || order.packingRecord !== null;
  // Labels matter from planning on (they print before packing ends); an
  // earlier order shows the card only once such a file exists.
  const canAttachLabels =
    canAttach.customerLabelSpec && canAttach.labelProof && !terminal;
  // A Director decision: global `approvals.decide` only, never unit-narrowed.
  const canApproveLabels = coverages["approvals.decide"].global && !terminal;
  const showLabels =
    order.documents.some(
      (document) =>
        document.kind === "customerLabelSpec" || document.kind === "labelProof",
    ) ||
    (currentStep !== null && currentStep >= 3);

  const financeNotice = notice && !text.notices[notice] ? notice : undefined;
  const financeError = error && !text.errors[error] ? error : undefined;
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

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
          {order.deliveryDueAt ? (
            <p className="mt-2">
              <span
                className={
                  lateness !== null
                    ? lateness <= 0
                      ? okBadgeClass
                      : warnBadgeClass
                    : daysToDue !== null && daysToDue < 0 && !terminal
                      ? warnBadgeClass
                      : okBadgeClass
                }
              >
                {lateness !== null
                  ? lateness <= 0
                    ? text.deliveredOnTime
                    : text.deliveredLate(lateness)
                  : `${text.deliveryDue(formatDate(order.deliveryDueAt, locale))}${
                      daysToDue !== null && !terminal
                        ? ` · ${
                            daysToDue >= 0
                              ? text.deliveryDueIn(daysToDue)
                              : text.deliveryDuePast(-daysToDue)
                          }`
                        : ""
                    }`}
              </span>
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
            {text.currentStage}
          </p>
          <p className="text-gold-ink mt-1 text-lg font-semibold">
            {currentStep !== null ? `${currentStep} · ` : ""}
            {definition.labels[locale]}
          </p>
          {!terminal ? (
            <p className="text-charcoal/50 mt-1 text-xs">
              {text.sinceDays(dateTime.format(enteredAt), daysInStage)}
            </p>
          ) : null}
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
        <FinanceBanner
          locale={locale}
          notice={financeNotice}
          error={financeError}
        />
      ) : null}

      {/* Progress rail */}
      <section className={`${cardClass} mt-8`}>
        <h2 className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
          {text.progressTitle}
        </h2>
        <ol className="mt-4 flex flex-wrap gap-2">
          {sopSteps.map(({ step, stage }) => {
            const state = terminal
              ? "past"
              : currentStep !== null && step < currentStep
                ? "past"
                : step === currentStep
                  ? "current"
                  : "future";
            return (
              <li
                key={step}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  state === "current"
                    ? "border-lacquer bg-lacquer text-ivory font-semibold"
                    : state === "past"
                      ? "border-gold/50 bg-gold/10 text-charcoal/70"
                      : "border-burgundy/15 text-charcoal/40"
                }`}
              >
                {step} · {orderStageDefinitions[stage].labels[locale]}
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

      {/* Step 01 on file */}
      <div className="mt-6">
        <OrderInfoSection
          locale={locale}
          order={order}
          canEdit={canEditOrder}
          facilityNames={facilities}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Selling price */}
        <section className={cardClass}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.priceTitle}
          </h2>
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
              <input
                type="hidden"
                name="expectedRevision"
                value={order.revision}
              />
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
        {canEditExport ||
        order.expectedReadyAt ||
        order.bookingNumber ||
        order.bookingDate ? (
          <section className={cardClass}>
            <h2 className="text-burgundy font-serif text-2xl">
              {text.exportTitle}
            </h2>
            {canEditExport ? (
              <form
                action={setExportProgressAction}
                className="mt-4 grid gap-3"
              >
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderId" value={order.id} />
                <input
                  type="hidden"
                  name="expectedRevision"
                  value={order.revision}
                />
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
                  {order.expectedReadyAt
                    ? formatDate(order.expectedReadyAt, locale)
                    : text.notSet}
                </dd>
                <dt className="text-charcoal/50">{text.bookingNumber}</dt>
                <dd className="font-mono sm:col-span-2">
                  {order.bookingNumber ?? text.notSet}
                </dd>
                <dt className="text-charcoal/50">{text.bookingDate}</dt>
                <dd className="sm:col-span-2">
                  {order.bookingDate
                    ? formatDate(order.bookingDate, locale)
                    : text.notSet}
                </dd>
              </dl>
            )}
          </section>
        ) : null}

        {/* Director approval gate */}
        {definition.approvalSubject ? (
          <section className={cardClass}>
            <h2 className="text-burgundy font-serif text-2xl">
              {text.approvalTitle}
            </h2>
            <p className="text-charcoal/60 mt-2 text-sm">
              {text.approvalNeeded}
            </p>
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
      </div>

      {/* Steps 03–07 */}
      {showProduction ? (
        <div className="mt-6">
          <ProductionSection
            locale={locale}
            order={order}
            canPlan={canPlan}
            canProgress={canProgress}
            canInspect={canInspect}
          />
        </div>
      ) : null}
      {showPacking ? (
        <div className="mt-6">
          <PackingSection locale={locale} order={order} canPack={canPack} />
        </div>
      ) : null}
      {showLabels ? (
        <div className="mt-6">
          <LabelsSection
            locale={locale}
            order={order}
            currentUserId={currentUserId}
            canAttach={canAttachLabels}
            canApprove={canApproveLabels}
            maxBytes={maxBytes}
          />
        </div>
      ) : null}

      {/* Files of every step */}
      <div className="mt-6">
        <DocumentsSection
          locale={locale}
          order={order}
          now={now}
          canAttach={canAttach}
          maxBytes={maxBytes}
        />
      </div>

      {/* Invoices */}
      {canReadInvoices ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.invoicesTitle}
          </h2>
          {invoices.length === 0 ? (
            <p className="text-charcoal/55 mt-3 text-sm">{text.noInvoices}</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {text.invoiceNumber}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {text.invoiceDue}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {text.invoiceAmount}
                  </th>
                  {canReadPayments ? (
                    <th scope="col" className="px-3 py-2 font-semibold">
                      {text.invoiceRemaining}
                    </th>
                  ) : null}
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
                          href={
                            `/${locale}/admin/finance/invoices/${invoice.id}` as Route
                          }
                          className="text-burgundy font-mono text-xs font-semibold hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {formatDate(invoice.dueAt, locale)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatMoney(invoice.amount, locale)}
                      </td>
                      {canReadPayments ? (
                        <td className="px-3 py-2 font-mono text-xs font-semibold">
                          {invoice.status === "voided" ? (
                            <span className="text-charcoal/50">
                              {text.invoiceVoided}
                            </span>
                          ) : row && isPositive(row.remaining) ? (
                            <span className="text-lacquer">
                              {formatMoney(row.remaining, locale)}
                              {row.overdue ? ` · ${text.invoiceOverdue}` : ""}
                            </span>
                          ) : (
                            <span className="text-emerald-700">
                              {text.invoiceSettled}
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        {invoice.status === "active" && canManageInvoices ? (
                          <form
                            action={voidInvoiceAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="locale" value={locale} />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={`order:${order.id}`}
                            />
                            <input
                              type="hidden"
                              name="invoiceId"
                              value={invoice.id}
                            />
                            <input
                              type="hidden"
                              name="expectedRevision"
                              value={invoice.revision}
                            />
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
                        ) : invoice.status === "voided" && !canReadPayments ? (
                          <span className="text-charcoal/50 text-xs">
                            {text.invoiceVoided}
                          </span>
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
          <h2 className="text-burgundy font-serif text-2xl">
            {text.moneyTitle}
          </h2>
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
                  <dd className="text-right font-mono">
                    {formatMoney(row.invoiced, locale)}
                  </dd>
                  <dt className="text-charcoal/60">{text.paid}</dt>
                  <dd className="text-right font-mono text-emerald-700">
                    {formatMoney(row.paid, locale)}
                  </dd>
                  <dt className="text-charcoal/60">{text.deposits}</dt>
                  <dd className="text-right font-mono text-emerald-700">
                    {formatMoney(row.deposits, locale)}
                  </dd>
                  <dt className="text-charcoal/80 font-semibold">
                    {isPositive(row.remaining)
                      ? text.remaining
                      : text.inAdvance}
                  </dt>
                  <dd
                    className={`text-right font-mono font-semibold ${
                      isPositive(row.remaining)
                        ? "text-lacquer"
                        : "text-emerald-700"
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

      {/* Costs and the Director's profit */}
      {canReadCosts || profit ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {canReadCosts ? (
            <section className={cardClass}>
              <h2 className="text-burgundy font-serif text-2xl">
                {text.costsTitle}
              </h2>
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
          {profit ? <ProfitSection locale={locale} profit={profit} /> : null}
        </div>
      ) : null}

      {/* Tasks */}
      {canReadTasks || canPlanWithAssistant ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.tasksTitle}
          </h2>
          {orderTasks.length === 0 ? (
            <p className="text-charcoal/55 mt-3 text-sm">{text.noTasks}</p>
          ) : (
            <ul className="mt-4 grid gap-2">
              {orderTasks.map((task) => {
                const overdue = isOverdue(task, now);
                return (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span
                      className={
                        task.status !== "open"
                          ? "text-charcoal/45 line-through"
                          : "text-charcoal/85"
                      }
                    >
                      {task.title}
                      {task.dueAt ? (
                        <span
                          className={`ml-2 font-mono text-xs ${overdue ? "text-lacquer font-semibold" : "text-charcoal/50"}`}
                        >
                          {overdue ? `${text.taskOverdue} · ` : ""}
                          {formatBusinessDay(task.dueAt, timeZone)}
                        </span>
                      ) : null}
                    </span>
                    {task.status === "open" &&
                    (task.assigneeUserId === currentUserId ||
                      task.createdBy === currentUserId) ? (
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="taskId" value={task.id} />
                        <input
                          type="hidden"
                          name="expectedRevision"
                          value={task.revision}
                        />
                        <input type="hidden" name="status" value="done" />
                        <input
                          type="hidden"
                          name="returnTo"
                          value={`order:${order.id}`}
                        />
                        <button
                          type="submit"
                          className="text-burgundy border-burgundy/30 hover:bg-ivory/70 rounded-full border px-3 py-1 text-xs font-semibold"
                        >
                          {text.taskDone}
                        </button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {canReadTasks ? (
              <Link
                href={
                  `/${locale}/admin/tasks?status=all&order=${encodeURIComponent(order.orderCode)}` as Route
                }
                className="text-burgundy font-semibold hover:underline"
              >
                {text.allTasks}
              </Link>
            ) : null}
            {canPlanWithAssistant ? (
              <Link
                href={
                  `/${locale}/admin/assistant?q=${encodeURIComponent(locale === "vi" ? `Lập kế hoạch cho đơn ${order.orderCode}` : `Plan order ${order.orderCode}`)}` as Route
                }
                className="text-burgundy font-semibold hover:underline"
              >
                {text.planWithAssistant}
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Payment documents */}
      {canReadPayments ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.documentsTitle}
          </h2>
          <p className="text-charcoal/55 mt-2 text-sm">{text.documentsHint}</p>
          {order.paymentDocuments.length === 0 ? (
            <p className="text-charcoal/55 mt-4 text-sm">{text.noDocuments}</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {order.paymentDocuments.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center gap-3"
                >
                  <a
                    href={storedDocumentUrl(document)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-burgundy font-semibold hover:underline"
                  >
                    {document.label}
                  </a>
                  <span className="text-charcoal/45 text-xs">
                    {document.format.toUpperCase()} ·{" "}
                    {formatBytes(document.bytes)} ·{" "}
                    {formatDate(document.uploadedAt, locale)}
                  </span>
                  {canRecordPayment ? (
                    <form action={removePaymentDocumentAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input
                        type="hidden"
                        name="expectedRevision"
                        value={order.revision}
                      />
                      <input
                        type="hidden"
                        name="documentId"
                        value={document.id}
                      />
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
          <>
            {blockers.length > 0 ? (
              <p className="border-lacquer/30 bg-lacquer/5 text-lacquer mt-5 rounded-xl border px-4 py-3 text-sm">
                {text.blockedLead} {blockers.join("; ")}.
              </p>
            ) : null}
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
                    <input
                      type="hidden"
                      name="expectedRevision"
                      value={order.revision}
                    />
                    <p className="text-charcoal/80 text-sm font-semibold">
                      {text.moveTo}:{" "}
                      {targetDef.step !== null ? `${targetDef.step} · ` : ""}
                      {targetDef.labels[locale]}
                    </p>
                    {needsReason ? (
                      <div className="mt-3">
                        <label
                          htmlFor={`reason-${target}`}
                          className={labelClass}
                        >
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
          </>
        )}
      </section>

      {/* History */}
      <section className={`${cardClass} mt-6`}>
        <h2 className="text-burgundy font-serif text-2xl">
          {text.historyTitle}
        </h2>
        {order.stageHistory.length === 0 ? (
          <p className="text-charcoal/55 mt-4 text-sm">{text.historyEmpty}</p>
        ) : (
          <ol className="border-burgundy/10 divide-burgundy/8 mt-4 divide-y">
            {[...order.stageHistory].reverse().map((entry, index) => (
              <li key={index} className="flex flex-wrap gap-x-6 gap-y-1 py-3">
                <span className="text-charcoal/45 w-40 shrink-0 text-xs">
                  {dateTime.format(entry.at)}
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
