import { notFound } from "next/navigation";

import { decideApprovalAction } from "@/app/[locale]/admin/(portal)/approvals/actions";
import {
  approvalDecisionPermission,
  approvalSubjects,
  type ApprovalRequest,
} from "@/domains/approvals/contracts";
import { approvalService } from "@/domains/approvals/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/** Presentation labels for each gated subject, in the two admin languages. */
const subjectLabels: Record<
  (typeof approvalSubjects)[number],
  { vi: string; en: string }
> = {
  "order.confirm": {
    vi: "Xác nhận đơn hàng",
    en: "Order confirmation",
  },
  "order.sellingPrice": {
    vi: "Giá bán của đơn hàng",
    en: "Order selling price",
  },
  "order.priceAdjustment": {
    vi: "Điều chỉnh giá đơn hàng",
    en: "Order price adjustment",
  },
  "order.cancel": { vi: "Hủy đơn hàng", en: "Order cancellation" },
  "order.dispatch": { vi: "Xuất hàng", en: "Dispatch" },
  "quote.send": { vi: "Gửi báo giá cho khách", en: "Sending a quote" },
  "quote.priceAdjustment": {
    vi: "Điều chỉnh giá báo giá",
    en: "Quote price adjustment",
  },
  "procurement.purchase": {
    vi: "Mua nguyên liệu",
    en: "Material purchase",
  },
  "procurement.priceChange": {
    vi: "Thay đổi đơn giá nhà cung cấp",
    en: "Supplier unit-price change",
  },
  "procurement.advance": {
    vi: "Tạm ứng cho nhà cung cấp",
    en: "Supplier advance",
  },
  "expense.incurred": { vi: "Chi phí phát sinh", en: "Incurred expense" },
  "inventory.adjustment": {
    vi: "Điều chỉnh tồn kho",
    en: "Inventory adjustment",
  },
  "production.plan": { vi: "Kế hoạch sản xuất", en: "Production plan" },
  "sample.approval": { vi: "Duyệt mẫu", en: "Sample approval" },
  "content.publication": {
    vi: "Xuất bản nội dung website",
    en: "Website content publication",
  },
  "collection.publication": {
    vi: "Xuất bản bộ sưu tập",
    en: "Collection publication",
  },
  "payroll.confirmation": { vi: "Xác nhận lương", en: "Payroll confirmation" },
};

const queueCopy = {
  vi: {
    queueTitle: "Hàng đợi đang chờ quyết định",
    queueEmpty: "Không có yêu cầu nào đang chờ trong phạm vi của bạn.",
    requestedAt: "Trình lúc",
    reasonLabel: "Lý do (bắt buộc khi từ chối)",
    approve: "Phê duyệt",
    reject: "Từ chối",
    cannotDecide: "Bạn không giữ quyền quyết định yêu cầu này.",
    noticeDecided: "Đã ghi nhận quyết định.",
    errorLead: "Không ghi nhận được quyết định:",
    errors: {
      FORBIDDEN: "Bạn không có quyền quyết định yêu cầu này.",
      NOT_FOUND: "Không tìm thấy yêu cầu.",
      ALREADY_DECIDED: "Yêu cầu đã được quyết định trước đó.",
      SELF_APPROVAL: "Người trình không thể tự quyết định yêu cầu của mình.",
      REASON_REQUIRED: "Từ chối bắt buộc phải ghi lý do.",
      REVISION_CONFLICT:
        "Bản ghi gốc đã thay đổi sau khi trình — yêu cầu phải được trình lại.",
      INVALID_INPUT: "Dữ liệu gửi lên chưa hợp lệ.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
    referenceTitle: "Danh mục các loại phê duyệt",
  },
  en: {
    queueTitle: "Pending decisions",
    queueEmpty: "Nothing is waiting inside your scope.",
    requestedAt: "Requested",
    reasonLabel: "Reason (required for a rejection)",
    approve: "Approve",
    reject: "Reject",
    cannotDecide: "You do not hold the permission to decide this request.",
    noticeDecided: "The decision has been recorded.",
    errorLead: "The decision was not recorded:",
    errors: {
      FORBIDDEN: "You are not permitted to decide this request.",
      NOT_FOUND: "The request was not found.",
      ALREADY_DECIDED: "This request has already been decided.",
      SELF_APPROVAL: "The requester can never decide their own request.",
      REASON_REQUIRED: "A rejection must record a reason.",
      REVISION_CONFLICT:
        "The underlying record changed — the request must be raised again.",
      INVALID_INPUT: "The submitted data is not valid.",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
    referenceTitle: "Catalog of gated subjects",
  },
} as const;

export default async function AdminApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale: requestedLocale }, { error, notice }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).approvals;
  const queueText = queueCopy[locale];

  // The queue narrows to the reader's granted units; a global reader sees all.
  let pending: ApprovalRequest[] = [];
  let queueVisible = false;
  try {
    const { context, scope } = await requireListAccess("approvals.read");
    queueVisible = true;
    pending = await approvalService.listPending(
      context,
      scope.kind === "all"
        ? null
        : scope.kind === "businessUnits"
          ? scope.businessUnitIds
          : [],
    );
  } catch (cause) {
    if (!(cause instanceof ContentAccessDeniedError)) throw cause;
  }

  // Decision affordance: most decision permissions demand a global grant, so
  // the probe checks global coverage per subject present in the queue.
  const decisionPermissions = [
    ...new Set(
      pending.map((request) => approvalDecisionPermission[request.subject]),
    ),
  ];
  const coverages = await resolvePermissionCoverages(decisionPermissions);

  const fieldClass =
    "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none";

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>

      <blockquote className="border-lacquer text-burgundy mt-8 max-w-3xl border-l-4 pl-5 font-serif text-xl leading-8">
        {copy.rule}
      </blockquote>

      {notice === "decided" ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-8 max-w-3xl rounded-2xl border px-5 py-3 text-sm">
          {queueText.noticeDecided}
        </p>
      ) : null}
      {error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-3 text-sm">
          {queueText.errorLead}{" "}
          {queueText.errors[error] ?? queueText.errors.UNAVAILABLE}
        </p>
      ) : null}

      {queueVisible ? (
        <section className="mt-10">
          <h2 className="text-burgundy font-serif text-3xl">
            {queueText.queueTitle}
          </h2>
          {pending.length === 0 ? (
            <p className="border-burgundy/15 text-charcoal/60 mt-5 max-w-3xl rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
              {queueText.queueEmpty}
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              {pending.map((request) => {
                const decisionPermission =
                  approvalDecisionPermission[request.subject];
                const canDecide =
                  coverages[decisionPermission]?.global ?? false;
                return (
                  <li
                    key={request.id}
                    className="border-burgundy/15 rounded-2xl border bg-white p-5 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="text-burgundy font-semibold">
                        {subjectLabels[request.subject][locale]}
                        <span className="text-charcoal/40 ml-2 font-mono text-xs font-normal">
                          {request.subject}
                        </span>
                      </p>
                      <p className="text-charcoal/45 text-xs">
                        {queueText.requestedAt}{" "}
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(request.requestedAt)}
                      </p>
                    </div>
                    <p className="text-charcoal/75 mt-2 text-sm">
                      {request.summary}
                    </p>

                    {canDecide ? (
                      <form
                        action={decideApprovalAction}
                        className="border-burgundy/10 mt-4 border-t pt-4"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />
                        <input
                          type="hidden"
                          name="expectedRevision"
                          value={request.expectedRevision}
                        />
                        <label
                          htmlFor={`reason-${request.id}`}
                          className="text-charcoal/60 mb-1 block text-xs"
                        >
                          {queueText.reasonLabel}
                        </label>
                        <textarea
                          id={`reason-${request.id}`}
                          name="decisionReason"
                          rows={2}
                          maxLength={2000}
                          className={fieldClass}
                        />
                        <div className="mt-3 flex gap-3">
                          <button
                            type="submit"
                            name="decision"
                            value="approved"
                            className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-10 items-center rounded-full px-6 text-sm font-semibold"
                          >
                            {queueText.approve}
                          </button>
                          <button
                            type="submit"
                            name="decision"
                            value="rejected"
                            className="border-lacquer/40 text-lacquer hover:bg-lacquer/5 inline-flex min-h-10 items-center rounded-full border px-6 text-sm font-semibold"
                          >
                            {queueText.reject}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="text-charcoal/45 mt-3 text-xs">
                        {queueText.cannotDecide}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="mt-12">
        <h2 className="text-burgundy font-serif text-3xl">
          {queueText.referenceTitle}
        </h2>
        <div className="border-burgundy/15 mt-5 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">{copy.title}</caption>
            <thead>
              <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
                <th scope="col" className="px-5 py-4 font-semibold">
                  {copy.subjectColumn}
                </th>
                <th scope="col" className="px-5 py-4 font-semibold">
                  {copy.deciderColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {approvalSubjects.map((subject) => (
                <tr key={subject} className="border-burgundy/8 border-b">
                  <th
                    scope="row"
                    className="text-burgundy px-5 py-4 text-left font-semibold"
                  >
                    {subjectLabels[subject][locale]}
                    <span className="text-charcoal/40 mt-1 block font-mono text-xs font-normal">
                      {subject}
                    </span>
                  </th>
                  <td className="text-charcoal/60 px-5 py-4 font-mono text-xs">
                    {approvalDecisionPermission[subject]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-burgundy/15 mt-10 max-w-3xl rounded-2xl border bg-white p-6">
        <h2 className="text-burgundy font-serif text-2xl">
          {copy.separationTitle}
        </h2>
        <p className="text-charcoal/60 mt-3 text-sm leading-6">
          {copy.separationDescription}
        </p>
      </section>
    </div>
  );
}
