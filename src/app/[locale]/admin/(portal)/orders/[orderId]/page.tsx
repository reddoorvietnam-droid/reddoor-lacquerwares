import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  recordQcPassAction,
  requestStageApprovalAction,
  setSellingPriceAction,
  transitionOrderAction,
} from "@/app/[locale]/admin/(portal)/orders/actions";
import { approvalService } from "@/domains/approvals/runtime";
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
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { formatMoney, supportedCurrencies } from "@/lib/money";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

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
    "production.approveQc",
    "approvals.request",
    definition.advancePermission,
  ] as const);

  const priceVisible = coverageReaches(
    coverages["orders.readSellingPrice"],
    raw.businessUnitIds,
  );
  const order = (await orderCommandService.findById(orderId, priceVisible))!;

  const canAdvance = coverageReaches(
    coverages[definition.advancePermission],
    order.businessUnitIds,
  );
  const canRequestApproval = coverageReaches(
    coverages["approvals.request"],
    order.businessUnitIds,
  );
  const canRecordQc = coverageReaches(
    coverages["production.approveQc"],
    order.businessUnitIds,
  );
  const canEditPrice =
    coverageReaches(coverages["orders.updateDraft"], order.businessUnitIds) &&
    (order.stage === "received" || order.stage === "fileOpened");

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

  const currentIndex = orderProgressStages.indexOf(order.stage);
  const cardClass =
    "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
  const buttonClass =
    "bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold";
  const fieldClass =
    "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none";

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
          <p className="text-charcoal/75 mt-3 text-lg">{order.customerName}</p>
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
      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.errorLead} {text.errors[error] ?? text.errors.UNAVAILABLE}
        </p>
      ) : null}

      {/* Progress rail */}
      <section className={`${cardClass} mt-8`}>
        <h2 className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
          {text.progressTitle}
        </h2>
        <ol className="mt-4 flex flex-wrap gap-2">
          {orderProgressStages.map((stage, index) => {
            const stageDef = orderStageDefinitions[stage];
            const state = isTerminalStage(order.stage)
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
          {isTerminalStage(order.stage) ? (
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
                  <label
                    htmlFor="price-amount"
                    className="text-charcoal/60 mb-1 block text-xs"
                  >
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
                  <label
                    htmlFor="price-currency"
                    className="text-charcoal/60 mb-1 block text-xs"
                  >
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

        {/* Quality control */}
        {order.stage === "qualityControl" ? (
          <section className={cardClass}>
            <h2 className="text-burgundy font-serif text-2xl">
              {text.qcTitle}
            </h2>
            <p
              className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
                order.qcPassed
                  ? "bg-gold/15 text-gold-ink"
                  : "bg-lacquer/5 text-lacquer"
              }`}
            >
              {order.qcPassed ? text.qcPassed : text.qcNotPassed}
            </p>
            {!order.qcPassed && canRecordQc ? (
              <form action={recordQcPassAction} className="mt-5">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderId" value={order.id} />
                <input
                  type="hidden"
                  name="expectedRevision"
                  value={order.revision}
                />
                <button type="submit" className={buttonClass}>
                  {text.qcPassButton}
                </button>
              </form>
            ) : null}
          </section>
        ) : null}
      </div>

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
                        className="text-charcoal/60 mb-1 block text-xs"
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
