import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  dateInputValue,
  formatDate,
} from "@/app/[locale]/admin/(portal)/finance/shared";
import { DocumentUpload } from "@/components/admin/document-upload";
import {
  contractValue,
  countsAgainstContract,
  deliversAfterOrderDue,
  exceedingLineCount,
  facilityContractDocumentKinds,
  lineExceedsPrevious,
  type DirectorDecisionState,
  type FacilityPaymentRecordDto,
} from "@/domains/facility-contracts/contracts";
import { listActiveFacilities } from "@/domains/facility-contracts/persistence/mongo-store";
import { facilityContractService } from "@/domains/facility-contracts/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import { isTerminalStage } from "@/domains/orders/workflow";
import {
  ContentAccessDeniedError,
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { formatBytes, storedDocumentUrl } from "@/lib/media/document-url";
import { formatMoney, money, multiply, subtract, sum } from "@/lib/money";

import {
  activateFacilityContractAction,
  attachFacilityContractDocumentAction,
  cancelFacilityContractAction,
  facilityPaymentStepAction,
  proposeFacilityPaymentAction,
  removeFacilityContractDocumentAction,
  requestContractPriceApprovalAction,
  updateFacilityContractAction,
} from "../actions";
import { ContractForm, type OrderOption } from "../contract-form";
import {
  buttonClass,
  cardClass,
  contractStatusBadge,
  contractStatusLabels,
  dangerButtonClass,
  documentKindLabels,
  errorMessages,
  fieldClass,
  formatVnd,
  ghostButtonClass,
  headingClass,
  labelClass,
  messageFor,
  mutedBadgeClass,
  noticeMessages,
  paymentStatusBadge,
  paymentStatusLabels,
  warnBadgeClass,
  type AdminLocale,
} from "../shared";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Hợp đồng cơ sở",
    back: "← Danh sách hợp đồng",
    site: "Cơ sở",
    order: "Đơn hàng",
    noOrder: "Không gắn đơn hàng",
    lateBadge: "Giao sau hạn giao của đơn",
    infoTitle: "Thông tin hợp đồng",
    startDate: "Ngày bắt đầu làm hàng",
    deliveryDate: "Ngày giao hàng",
    orderDue: "Hạn giao của đơn",
    value: "Giá trị hợp đồng",
    valueUnknown: "Chưa tính được giá trị vì thiếu số lượng",
    activatedAt: "Ngày có hiệu lực",
    note: "Ghi chú",
    cancelReason: "Lý do hủy",
    notSet: "—",
    linesTitle: "Hàng hóa và đơn giá",
    linesDraftHint:
      "Giá lần trước lấy từ hợp đồng đang thực hiện có hiệu lực gần nhất cùng mã hàng, ở bất kỳ cơ sở nào, và được tính lại mỗi lần mở trang.",
    codeColumn: "Mã hàng",
    descriptionColumn: "Chủng loại hàng hóa",
    quantityColumn: "Số lượng",
    unitColumn: "ĐVT",
    priceColumn: "Đơn giá",
    previousColumn: "Giá lần trước",
    amountColumn: "Thành tiền",
    higherBadge: "Cao hơn giá cũ",
    neverBought: "Chưa mua lần nào",
    editTitle: "Sửa hợp đồng",
    approvalTitle: "Giám đốc duyệt giá tăng",
    approvalNeeded: (count: number) =>
      `${count} dòng có đơn giá cao hơn giá lần trước. Hợp đồng chỉ có hiệu lực sau khi Giám đốc duyệt.`,
    approvalRequest: "Gửi Giám đốc duyệt",
    handleTitle: "Xử lý hợp đồng",
    activate: "Cho hợp đồng có hiệu lực",
    activateBlocked: "Cần Giám đốc duyệt giá tăng trước.",
    cancel: "Hủy hợp đồng",
    cancelReasonLabel: "Lý do hủy",
    cancelConfirm: "Xác nhận hủy",
    cancelHint:
      "Chỉ hủy được khi mọi đề nghị thanh toán của hợp đồng đã bị từ chối.",
    documentsTitle: "Tài liệu hợp đồng",
    noDocuments: "Chưa có tệp nào.",
    uploadSigned: "Tải hợp đồng đã ký lên",
    uploadOther: "Tải tài liệu khác lên",
    remove: "Gỡ",
    removeConfirm: "Xác nhận gỡ",
    paymentsTitle: "Thanh toán cho cơ sở",
    committed: "Đã đề nghị (chưa bị từ chối)",
    proposable: "Còn được đề nghị",
    proposeTitle: "Đề nghị thanh toán",
    amount: "Số tiền (VND)",
    paymentNote: "Ghi chú",
    propose: "Gửi đề nghị",
    noPayments: "Chưa có đề nghị thanh toán nào.",
    proposedAt: "Đề nghị ngày",
    checkedAt: "Kiểm tra ngày",
    accountantApprovedAt: "Kế toán công ty duyệt ngày",
    paidOn: "Đã chi ngày",
    paidNoteLabel: "Ghi chú chi",
    rejectedStage: "Bị từ chối ở bước",
    rejectReason: "Lý do từ chối",
    directorTitle: "Giám đốc duyệt chi",
    check: "Đã kiểm tra",
    approve: "Duyệt và gửi Giám đốc",
    reRequest: "Trình lại Giám đốc",
    reject: "Từ chối",
    rejectReasonLabel: "Lý do từ chối",
    rejectConfirm: "Xác nhận từ chối",
    paidOnLabel: "Ngày chi",
    markPaid: "Ghi đã chi",
    decision: {
      none: "Chưa có yêu cầu gửi Giám đốc.",
      pending: "Đang chờ Giám đốc duyệt.",
      pendingStale:
        "Yêu cầu đang chờ được gửi trước khi hồ sơ thay đổi. Sau khi Giám đốc quyết định, gửi lại.",
      approved: "Giám đốc đã duyệt.",
      stale:
        "Giám đốc đã duyệt một bản cũ; hồ sơ đã thay đổi sau đó, cần gửi duyệt lại.",
      rejected: "Giám đốc không duyệt. Lý do:",
    },
    stageNames: {
      proposed: "Chờ kiểm tra",
      checked: "Chờ kế toán công ty duyệt",
      accountantApproved: "Chờ Giám đốc duyệt / chờ chi",
      paid: "Đã chi",
      rejected: "Bị từ chối",
    },
  },
  en: {
    eyebrow: "Site contract",
    back: "← Contract list",
    site: "Site",
    order: "Order",
    noOrder: "No order linked",
    lateBadge: "Delivers after the order's due date",
    infoTitle: "Contract details",
    startDate: "Start date",
    deliveryDate: "Delivery date",
    orderDue: "Order due date",
    value: "Contract value",
    valueUnknown: "No value yet: a line has no quantity",
    activatedAt: "Active since",
    note: "Note",
    cancelReason: "Cancellation reason",
    notSet: "—",
    linesTitle: "Goods and unit prices",
    linesDraftHint:
      "The previous price comes from the most recently activated active contract with the same item code, at any site, and is recomputed each time the page opens.",
    codeColumn: "Item code",
    descriptionColumn: "Kind of goods",
    quantityColumn: "Quantity",
    unitColumn: "Unit",
    priceColumn: "Unit price",
    previousColumn: "Previous price",
    amountColumn: "Amount",
    higherBadge: "Above previous price",
    neverBought: "Never bought",
    editTitle: "Edit contract",
    approvalTitle: "Director approval of the price increase",
    approvalNeeded: (count: number) =>
      `${count} line(s) are priced above the previous price. The contract becomes active only after the Director approves.`,
    approvalRequest: "Send to the Director",
    handleTitle: "Contract actions",
    activate: "Make the contract active",
    activateBlocked: "The Director must approve the price increase first.",
    cancel: "Cancel contract",
    cancelReasonLabel: "Cancellation reason",
    cancelConfirm: "Confirm cancellation",
    cancelHint:
      "A contract can be cancelled only when every payment request on it was rejected.",
    documentsTitle: "Contract documents",
    noDocuments: "No file yet.",
    uploadSigned: "Upload signed contract",
    uploadOther: "Upload other document",
    remove: "Remove",
    removeConfirm: "Confirm removal",
    paymentsTitle: "Payments to the site",
    committed: "Requested (not rejected)",
    proposable: "Still requestable",
    proposeTitle: "Payment request",
    amount: "Amount (VND)",
    paymentNote: "Note",
    propose: "Send request",
    noPayments: "No payment requests yet.",
    proposedAt: "Requested on",
    checkedAt: "Checked on",
    accountantApprovedAt: "Accountant approved on",
    paidOn: "Paid on",
    paidNoteLabel: "Payment note",
    rejectedStage: "Rejected at",
    rejectReason: "Rejection reason",
    directorTitle: "Director approval of the payment",
    check: "Checked",
    approve: "Approve and send to the Director",
    reRequest: "Send to the Director again",
    reject: "Reject",
    rejectReasonLabel: "Rejection reason",
    rejectConfirm: "Confirm rejection",
    paidOnLabel: "Payment date",
    markPaid: "Mark paid",
    decision: {
      none: "Nothing has been sent to the Director.",
      pending: "Waiting for the Director.",
      pendingStale:
        "The waiting request predates a change to the record. Once decided, send it again.",
      approved: "The Director approved.",
      stale:
        "The Director approved an older version; the record changed since and needs approval again.",
      rejected: "The Director did not approve. Reason:",
    },
    stageNames: {
      proposed: "Awaiting check",
      checked: "Awaiting accountant",
      accountantApproved: "Awaiting Director / payment",
      paid: "Paid",
      rejected: "Rejected",
    },
  },
} as const;

function decisionClass(state: DirectorDecisionState): string {
  if (state.kind === "approved") return "bg-gold/15 text-gold-ink";
  if (state.kind === "pending") return "bg-burgundy/5 text-charcoal/70";
  return "bg-lacquer/5 text-lacquer";
}

function DecisionLine({
  locale,
  state,
}: {
  locale: AdminLocale;
  state: DirectorDecisionState;
}) {
  const text = copy[locale].decision;
  return (
    <p
      className={`mt-3 rounded-xl px-4 py-3 text-sm font-semibold ${decisionClass(state)}`}
    >
      {state.kind === "rejected"
        ? `${text.rejected} ${state.reason ?? "—"}`
        : text[state.kind]}
    </p>
  );
}

export default async function FacilityContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; contractId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale, contractId }, { error, notice }] =
    await Promise.all([params, searchParams]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("facilityContracts.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const contract = await facilityContractService.findContract(
    context,
    contractId,
  );
  if (!contract) notFound();

  const coverages = await resolvePermissionCoverages([
    "facilityContracts.manage",
    "facilityPayments.propose",
    "facilityPayments.check",
    "facilityPayments.approve",
    "facilityPayments.markPaid",
    "orders.read",
  ] as const);
  const canManage = coverages["facilityContracts.manage"].global;
  const canPropose = coverages["facilityPayments.propose"].global;
  const canCheck = coverages["facilityPayments.check"].global;
  const canApprove = coverages["facilityPayments.approve"].global;
  const canMarkPaid = coverages["facilityPayments.markPaid"].global;
  const canReadOrders =
    coverages["orders.read"].global ||
    coverages["orders.read"].businessUnitIds.length > 0;

  const isDraft = contract.status === "draft";
  const isActive = contract.status === "active";
  const isCancelled = contract.status === "cancelled";

  const lines = await facilityContractService.currentLines(context, contract);
  const exceeding = exceedingLineCount(lines);
  const value = contractValue(lines);

  const order = contract.orderId
    ? await orderCommandService.findById(contract.orderId, false)
    : null;
  const late = deliversAfterOrderDue(contract, order?.deliveryDueAt ?? null);

  const priceDecision =
    isDraft && exceeding > 0
      ? await facilityContractService.contractDecision(contract)
      : null;

  const payments = await facilityContractService.listPayments(context, {
    contractId: contract.id,
  });
  const paymentDecisions = new Map<string, DirectorDecisionState>();
  for (const payment of payments) {
    if (payment.status === "accountantApproved") {
      paymentDecisions.set(
        payment.id,
        await facilityContractService.paymentDecision(payment),
      );
    }
  }
  const committed = sum(
    payments
      .filter(countsAgainstContract)
      .map((payment) => money(payment.amount, "VND")),
    "VND",
  );

  let maxBytes: number | null = null;
  try {
    maxBytes = getCloudinaryEnv().MAX_PDF_UPLOAD_MB * 1024 * 1024;
  } catch {
    maxBytes = null;
  }

  let facilities: Awaited<ReturnType<typeof listActiveFacilities>> = [];
  let orders: OrderOption[] = [];
  if (canManage && isDraft) {
    facilities = await listActiveFacilities();
    try {
      const { scope } = await requireListAccess("orders.read");
      const filter =
        scope.kind === "all"
          ? ({ kind: "all" } as const)
          : scope.kind === "businessUnits"
            ? ({
                kind: "businessUnits",
                businessUnitIds: scope.businessUnitIds,
              } as const)
            : ({ kind: "own", userId: scope.userId } as const);
      orders = (await orderCommandService.list(filter, false))
        .filter((candidate) => !isTerminalStage(candidate.stage))
        .map((candidate) => ({
          id: candidate.id,
          orderCode: candidate.orderCode,
          customerName: candidate.customerName,
        }));
    } catch (cause) {
      if (!(cause instanceof ContentAccessDeniedError)) throw cause;
    }
  }

  const activateBlocked = exceeding > 0 && priceDecision?.kind !== "approved";
  const base = `/${locale}/admin/facility-contracts`;

  const hidden = (name: string, fieldValue: string | number) => (
    <input type="hidden" name={name} value={fieldValue} />
  );
  const contractHidden = (
    <>
      {hidden("locale", locale)}
      {hidden("contractId", contract.id)}
      {hidden("expectedRevision", contract.revision)}
    </>
  );

  return (
    <div>
      <Link
        href={base as Route}
        className="text-burgundy text-sm font-semibold hover:underline"
      >
        {text.back}
      </Link>
      <p className="eyebrow mt-6">{text.eyebrow}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-burgundy font-mono text-4xl tracking-[-0.02em] md:text-5xl">
          {contract.code}
        </h1>
        <span className={contractStatusBadge[contract.status]}>
          {contractStatusLabels[contract.status][locale]}
        </span>
        {late ? <span className={warnBadgeClass}>{text.lateBadge}</span> : null}
      </div>
      <p className="text-charcoal/70 mt-4 text-base">
        {text.site}: <strong>{contract.facilityName}</strong>
        {" · "}
        {text.order}:{" "}
        {contract.orderId && contract.orderCode ? (
          canReadOrders ? (
            <Link
              href={`/${locale}/admin/orders/${contract.orderId}` as Route}
              className="text-burgundy font-mono font-semibold hover:underline"
            >
              {contract.orderCode}
            </Link>
          ) : (
            <span className="font-mono">{contract.orderCode}</span>
          )
        ) : (
          text.noOrder
        )}
      </p>

      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {messageFor(errorMessages, error, locale)}
        </p>
      ) : notice && noticeMessages[notice] ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-6 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
          {messageFor(noticeMessages, notice, locale)}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className={headingClass}>{text.infoTitle}</h2>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <dt className="text-charcoal/50">{text.startDate}</dt>
            <dd className="sm:col-span-2">
              {formatDate(contract.startDate, locale)}
            </dd>
            <dt className="text-charcoal/50">{text.deliveryDate}</dt>
            <dd className="sm:col-span-2">
              {formatDate(contract.deliveryDate, locale)}
            </dd>
            {order?.deliveryDueAt ? (
              <>
                <dt className="text-charcoal/50">{text.orderDue}</dt>
                <dd className="sm:col-span-2">
                  {formatDate(order.deliveryDueAt, locale)}
                </dd>
              </>
            ) : null}
            <dt className="text-charcoal/50">{text.value}</dt>
            <dd className="font-mono sm:col-span-2">
              {value ? formatMoney(value, locale) : text.valueUnknown}
            </dd>
            {contract.activatedAt ? (
              <>
                <dt className="text-charcoal/50">{text.activatedAt}</dt>
                <dd className="sm:col-span-2">
                  {formatDate(contract.activatedAt, locale)}
                </dd>
              </>
            ) : null}
            <dt className="text-charcoal/50">{text.note}</dt>
            <dd className="whitespace-pre-line sm:col-span-2">
              {contract.note ?? text.notSet}
            </dd>
            {contract.cancelReason ? (
              <>
                <dt className="text-charcoal/50">{text.cancelReason}</dt>
                <dd className="text-lacquer sm:col-span-2">
                  {contract.cancelReason}
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        {canManage && !isCancelled ? (
          <section className={cardClass}>
            <h2 className={headingClass}>{text.handleTitle}</h2>
            {isDraft ? (
              <div className="mt-4">
                {activateBlocked ? (
                  <p className="text-charcoal/60 mb-3 text-sm">
                    {text.activateBlocked}
                  </p>
                ) : null}
                <form action={activateFacilityContractAction}>
                  {contractHidden}
                  <button
                    type="submit"
                    className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-50`}
                    disabled={activateBlocked}
                  >
                    {text.activate}
                  </button>
                </form>
              </div>
            ) : null}
            <details className="mt-5">
              <summary className={`${dangerButtonClass} cursor-pointer`}>
                {text.cancel}
              </summary>
              <form
                action={cancelFacilityContractAction}
                className="border-lacquer/20 mt-3 grid gap-3 rounded-xl border p-4"
              >
                {contractHidden}
                <p className="text-charcoal/60 text-xs">{text.cancelHint}</p>
                <div>
                  <label htmlFor="cancel-reason" className={labelClass}>
                    {text.cancelReasonLabel}
                  </label>
                  <textarea
                    id="cancel-reason"
                    name="reason"
                    required
                    rows={2}
                    maxLength={2_000}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <button type="submit" className={dangerButtonClass}>
                    {text.cancelConfirm}
                  </button>
                </div>
              </form>
            </details>
          </section>
        ) : null}
      </div>

      <section className={`${cardClass} mt-6`}>
        <h2 className={headingClass}>{text.linesTitle}</h2>
        {isDraft ? (
          <p className="text-charcoal/55 mt-2 text-xs">{text.linesDraftHint}</p>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.codeColumn}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.descriptionColumn}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.quantityColumn}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.unitColumn}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.priceColumn}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.previousColumn}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {text.amountColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr
                  key={line.id}
                  className="border-burgundy/8 border-b align-top"
                >
                  <td className="px-3 py-3 font-mono text-xs">
                    {line.productCode}
                  </td>
                  <td className="px-3 py-3">{line.description}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {line.quantity ?? text.notSet}
                  </td>
                  <td className="px-3 py-3">{line.unit}</td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {formatVnd(line.unitPrice, locale)}
                    {lineExceedsPrevious(line) ? (
                      <span className={`${warnBadgeClass} mt-1 block w-fit`}>
                        {text.higherBadge}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {line.previousUnitPrice ? (
                      <>
                        {formatVnd(line.previousUnitPrice, locale)}
                        <span className="text-charcoal/50 block">
                          {line.previousContractCode}
                        </span>
                      </>
                    ) : (
                      <span className="text-charcoal/50">
                        {text.neverBought}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">
                    {line.quantity
                      ? formatMoney(
                          multiply(money(line.unitPrice, "VND"), line.quantity),
                          locale,
                        )
                      : text.notSet}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {priceDecision ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className={headingClass}>{text.approvalTitle}</h2>
          <p className="text-charcoal/60 mt-2 text-sm">
            {text.approvalNeeded(exceeding)}
          </p>
          <DecisionLine locale={locale} state={priceDecision} />
          {canManage &&
          (priceDecision.kind === "none" ||
            priceDecision.kind === "rejected" ||
            priceDecision.kind === "stale") ? (
            <form action={requestContractPriceApprovalAction} className="mt-4">
              {contractHidden}
              <button type="submit" className={buttonClass}>
                {text.approvalRequest}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {canManage && isDraft ? (
        <section className={`${cardClass} mt-6`}>
          <h2 className={headingClass}>{text.editTitle}</h2>
          <div className="mt-5">
            <ContractForm
              locale={locale}
              action={updateFacilityContractAction}
              facilities={facilities}
              orders={orders}
              contract={contract}
            />
          </div>
        </section>
      ) : null}

      <section className={`${cardClass} mt-6`}>
        <h2 className={headingClass}>{text.documentsTitle}</h2>
        {contract.documents.length === 0 ? (
          <p className="text-charcoal/55 mt-3 text-sm">{text.noDocuments}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {contract.documents.map((document) => (
              <li
                key={document.id}
                className="border-burgundy/10 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm"
              >
                <span className={mutedBadgeClass}>
                  {documentKindLabels[document.kind][locale]}
                </span>
                <a
                  href={storedDocumentUrl(document)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-burgundy font-semibold hover:underline"
                >
                  {document.label}
                </a>
                <span className="text-charcoal/50 text-xs">
                  {formatBytes(document.bytes)} ·{" "}
                  {formatDate(document.uploadedAt, locale)}
                </span>
                {canManage && !isCancelled ? (
                  <details className="ml-auto">
                    <summary className={`${dangerButtonClass} cursor-pointer`}>
                      {text.remove}
                    </summary>
                    <form
                      action={removeFacilityContractDocumentAction}
                      className="mt-2"
                    >
                      {contractHidden}
                      {hidden("documentId", document.id)}
                      <button type="submit" className={dangerButtonClass}>
                        {text.removeConfirm}
                      </button>
                    </form>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage && !isCancelled && maxBytes ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {facilityContractDocumentKinds.map((kind) => (
              <DocumentUpload
                key={kind}
                locale={locale}
                target={{ kind: "facilityContractDocument", id: contract.id }}
                expectedRevision={contract.revision}
                maxBytes={maxBytes}
                label={
                  kind === "signedContract"
                    ? text.uploadSigned
                    : text.uploadOther
                }
                attachAction={attachFacilityContractDocumentAction.bind(
                  null,
                  kind,
                )}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section id="payments" className={`${cardClass} mt-6`}>
        <h2 className={headingClass}>{text.paymentsTitle}</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <dt className="text-charcoal/50">{text.value}</dt>
          <dd className="font-mono sm:col-span-2">
            {value ? formatMoney(value, locale) : text.valueUnknown}
          </dd>
          <dt className="text-charcoal/50">{text.committed}</dt>
          <dd className="font-mono sm:col-span-2">
            {formatMoney(committed, locale)}
          </dd>
          {value ? (
            <>
              <dt className="text-charcoal/50">{text.proposable}</dt>
              <dd className="font-mono sm:col-span-2">
                {formatMoney(subtract(value, committed), locale)}
              </dd>
            </>
          ) : null}
        </dl>

        {canPropose && isActive ? (
          <form
            action={proposeFacilityPaymentAction}
            className="border-burgundy/10 mt-5 grid gap-3 rounded-xl border p-4 md:grid-cols-[1fr_2fr_auto] md:items-end"
          >
            {hidden("locale", locale)}
            {hidden("contractId", contract.id)}
            <p className="text-charcoal/80 text-sm font-semibold md:col-span-3">
              {text.proposeTitle}
            </p>
            <div>
              <label htmlFor="payment-amount" className={labelClass}>
                {text.amount}
              </label>
              <input
                id="payment-amount"
                name="amount"
                required
                inputMode="numeric"
                maxLength={24}
                className={`${fieldClass} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="payment-note" className={labelClass}>
                {text.paymentNote}
              </label>
              <input
                id="payment-note"
                name="note"
                maxLength={2_000}
                className={fieldClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                {text.propose}
              </button>
            </div>
          </form>
        ) : null}

        {payments.length === 0 ? (
          <p className="text-charcoal/55 mt-5 text-sm">{text.noPayments}</p>
        ) : (
          <ul className="mt-5 grid gap-4">
            {payments.map((payment) => (
              <PaymentItem
                key={payment.id}
                locale={locale}
                payment={payment}
                contractId={contract.id}
                readerId={context.userId}
                decision={paymentDecisions.get(payment.id) ?? null}
                can={{
                  check: canCheck,
                  approve: canApprove,
                  markPaid: canMarkPaid,
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PaymentItem({
  locale,
  payment,
  contractId,
  readerId,
  decision,
  can,
}: {
  locale: AdminLocale;
  payment: FacilityPaymentRecordDto;
  contractId: string;
  readerId: string;
  decision: DirectorDecisionState | null;
  can: { check: boolean; approve: boolean; markPaid: boolean };
}) {
  const text = copy[locale];
  const hiddenFields = (step: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="paymentId" value={payment.id} />
      <input type="hidden" name="expectedRevision" value={payment.revision} />
      <input type="hidden" name="step" value={step} />
    </>
  );

  const involved =
    payment.proposedBy === readerId || payment.checkedBy === readerId;
  const showCheck =
    can.check &&
    payment.status === "proposed" &&
    payment.proposedBy !== readerId;
  const showApprove = can.approve && payment.status === "checked" && !involved;
  const showReRequest =
    can.approve &&
    payment.status === "accountantApproved" &&
    !involved &&
    decision !== null &&
    (decision.kind === "none" ||
      decision.kind === "rejected" ||
      decision.kind === "stale");
  const showMarkPaid =
    can.markPaid &&
    payment.status === "accountantApproved" &&
    decision?.kind === "approved";
  const showReject =
    (payment.status === "proposed" && can.check) ||
    ((payment.status === "checked" ||
      payment.status === "accountantApproved") &&
      can.approve);

  const facts: [string, string][] = [
    [text.proposedAt, formatDate(payment.proposedAt, locale)],
    ...(payment.checkedAt
      ? ([[text.checkedAt, formatDate(payment.checkedAt, locale)]] as [
          string,
          string,
        ][])
      : []),
    ...(payment.accountantApprovedAt
      ? ([
          [
            text.accountantApprovedAt,
            formatDate(payment.accountantApprovedAt, locale),
          ],
        ] as [string, string][])
      : []),
    ...(payment.paidOn
      ? ([[text.paidOn, formatDate(payment.paidOn, locale)]] as [
          string,
          string,
        ][])
      : []),
    ...(payment.paidNote
      ? ([[text.paidNoteLabel, payment.paidNote]] as [string, string][])
      : []),
    ...(payment.rejectedAtStage
      ? ([[text.rejectedStage, text.stageNames[payment.rejectedAtStage]]] as [
          string,
          string,
        ][])
      : []),
    ...(payment.rejectReason
      ? ([[text.rejectReason, payment.rejectReason]] as [string, string][])
      : []),
    ...(payment.note
      ? ([[text.paymentNote, payment.note]] as [string, string][])
      : []),
  ];

  return (
    <li className="border-burgundy/10 rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-burgundy font-mono text-sm font-semibold">
          {payment.code}
        </span>
        <span className="font-mono text-sm">
          {formatVnd(payment.amount, locale)}
        </span>
        <span className={paymentStatusBadge[payment.status]}>
          {paymentStatusLabels[payment.status][locale]}
        </span>
      </div>
      <dl className="mt-3 grid gap-1 text-xs sm:grid-cols-4">
        {facts.map(([label, factValue]) => (
          <div key={label} className="contents">
            <dt className="text-charcoal/50">{label}</dt>
            <dd className="sm:col-span-3">{factValue}</dd>
          </div>
        ))}
      </dl>

      {decision ? (
        <div className="mt-3">
          <p className="text-charcoal/60 text-xs font-semibold tracking-[0.12em] uppercase">
            {text.directorTitle}
          </p>
          <DecisionLine locale={locale} state={decision} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start gap-3">
        {showCheck ? (
          <form action={facilityPaymentStepAction}>
            {hiddenFields("check")}
            <button type="submit" className={buttonClass}>
              {text.check}
            </button>
          </form>
        ) : null}
        {showApprove ? (
          <form action={facilityPaymentStepAction}>
            {hiddenFields("approve")}
            <button type="submit" className={buttonClass}>
              {text.approve}
            </button>
          </form>
        ) : null}
        {showReRequest ? (
          <form action={facilityPaymentStepAction}>
            {hiddenFields("reRequest")}
            <button type="submit" className={ghostButtonClass}>
              {text.reRequest}
            </button>
          </form>
        ) : null}
        {showMarkPaid ? (
          <form
            action={facilityPaymentStepAction}
            className="flex flex-wrap items-end gap-3"
          >
            {hiddenFields("markPaid")}
            <div>
              <label htmlFor={`paid-on-${payment.id}`} className={labelClass}>
                {text.paidOnLabel}
              </label>
              <input
                id={`paid-on-${payment.id}`}
                type="date"
                name="paidOn"
                required
                defaultValue={dateInputValue(new Date())}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`paid-note-${payment.id}`} className={labelClass}>
                {text.paidNoteLabel}
              </label>
              <input
                id={`paid-note-${payment.id}`}
                name="paidNote"
                maxLength={2_000}
                className={fieldClass}
              />
            </div>
            <button type="submit" className={buttonClass}>
              {text.markPaid}
            </button>
          </form>
        ) : null}
        {showReject ? (
          <details>
            <summary className={`${dangerButtonClass} cursor-pointer`}>
              {text.reject}
            </summary>
            <form
              action={facilityPaymentStepAction}
              className="border-lacquer/20 mt-3 grid gap-3 rounded-xl border p-4"
            >
              {hiddenFields("reject")}
              <input type="hidden" name="stage" value={payment.status} />
              <div>
                <label
                  htmlFor={`reject-reason-${payment.id}`}
                  className={labelClass}
                >
                  {text.rejectReasonLabel}
                </label>
                <textarea
                  id={`reject-reason-${payment.id}`}
                  name="reason"
                  required
                  rows={2}
                  maxLength={2_000}
                  className={fieldClass}
                />
              </div>
              <div>
                <button type="submit" className={dangerButtonClass}>
                  {text.rejectConfirm}
                </button>
              </div>
            </form>
          </details>
        ) : null}
      </div>
    </li>
  );
}
