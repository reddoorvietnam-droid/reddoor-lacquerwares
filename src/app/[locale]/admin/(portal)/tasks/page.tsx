import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createTaskAction,
  decideExtensionAction,
  decideProposalFormAction,
  retryIntentAction,
  revokeZaloLinkAction,
  runRemindersAction,
  setTaskStatusAction,
  startZaloLinkAction,
  updateTaskAction,
} from "@/app/[locale]/admin/(portal)/tasks/actions";
import type { AssistantProposalDto } from "@/domains/assistant/contracts";
import { assistantProposalService } from "@/domains/assistant/runtime";
import {
  mongoUserDirectory,
  type UserSummary,
} from "@/domains/identity/user-directory";
import type { NotificationIntentDto } from "@/domains/notifications/contracts";
import {
  channelLinkStore,
  notificationIntentStore,
} from "@/domains/notifications/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import { orderStageDefinitions } from "@/domains/orders/workflow";
import {
  taskStatuses,
  type TaskRecordDto,
  type TaskStatus,
} from "@/domains/tasks/contracts";
import { formatBusinessDay, isOverdue } from "@/domains/tasks/policy";
import { taskCommandService } from "@/domains/tasks/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import {
  getNotificationEnv,
  inspectCronEnv,
  inspectZaloEnv,
} from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Công việc",
    title: "Giao việc",
    description:
      "Giao việc cho từng người kèm hạn hoàn thành (cuối ngày làm việc, giờ Việt Nam), theo dõi ai đang làm gì, ai quá hạn, và trả lời các yêu cầu xin gia hạn. Người được giao thấy việc của mình ở mục Công việc được giao.",
    filterOpen: "Đang mở",
    filterDone: "Đã xong",
    filterCancelled: "Đã hủy",
    filterAll: "Tất cả",
    empty: "Không có việc nào trong bộ lọc này.",
    createTitle: "Giao việc mới",
    editTitle: "Sửa việc",
    save: "Lưu thay đổi",
    extensionsTitle: "Xin gia hạn chờ duyệt",
    extensionsHint:
      "Người được giao xin dời hạn và ghi lý do. Duyệt thì hạn đổi ngay và nhắc việc tính lại theo hạn mới; từ chối thì hạn giữ nguyên. Người xin nhận được câu trả lời qua email và Zalo.",
    extensionsEmpty: "Không có yêu cầu nào đang chờ.",
    extensionCurrent: "Hạn hiện tại",
    extensionRequested: "Xin dời sang",
    extensionReason: "Lý do",
    extensionNote: "Ghi chú cho người xin (tùy chọn)",
    extensionApprove: "Duyệt gia hạn",
    extensionReject: "Từ chối",
    fieldTitle: "Việc",
    fieldNote: "Ghi chú",
    fieldDue: "Hạn (ngày)",
    fieldOrder: "Mã đơn (tùy chọn)",
    fieldAssignee: "Người làm",
    fieldPriority: "Ưu tiên",
    priorityNormal: "Bình thường",
    priorityHigh: "Cao",
    self: "Tôi",
    create: "Lưu việc",
    done: "Xong",
    reopen: "Mở lại",
    cancel: "Hủy",
    cancelReason: "Lý do hủy…",
    overdue: "Quá hạn",
    dueToday: "Hôm nay",
    noDue: "Không hạn",
    unassigned: "Chưa gán",
    order: "Đơn",
    stage: "Bước",
    fromProposal: "Từ đề xuất AI",
    completedAt: "Xong lúc",
    proposalsTitle: "Đề xuất của trợ lý chờ duyệt",
    proposalsHint:
      "Trợ lý chỉ nháp; việc chỉ được tạo khi bạn duyệt ở đây. Kế hoạch dựa trên các bước còn lại của đơn; giả định được liệt kê để bạn kiểm tra.",
    proposalsEmpty: "Không có đề xuất nào đang chờ.",
    assumptions: "Giả định",
    approve: "Duyệt và tạo việc",
    reject: "Từ chối",
    rejectReason: "Lý do từ chối (bắt buộc)",
    cannotDecide: "Bạn không giữ quyền duyệt đề xuất này.",
    remindersTitle: "Nhắc việc",
    remindersHint:
      "Nhắc trước hạn, đến hạn và quá hạn cho người được gán, qua email và Zalo (nếu đã liên kết). Trạng thái gửi bên dưới là bằng chứng từ hệ thống, không suy đoán.",
    runNow: "Chạy nhắc việc ngay",
    deliveryMode: "Chế độ gửi",
    cronConfigured: "Lịch tự động: đã cấu hình",
    cronMissing: "Lịch tự động: chưa cấu hình (chỉ chạy bằng tay)",
    intentEmpty: "Chưa có nhắc việc nào được ghi nhận.",
    retry: "Gửi lại",
    intentStatus: {
      pending: "Chờ gửi",
      processing: "Đang gửi",
      sent: "Nhà cung cấp đã nhận",
      failed: "Lỗi, sẽ thử lại",
      skipped: "Bỏ qua",
      deadLetter: "Thất bại hẳn",
    } as Record<string, string>,
    zaloTitle: "Zalo của tôi",
    zaloHint:
      "Nhận nhắc việc qua Zalo: lấy mã rồi gửi mã đó cho Zalo OA của công ty từ tài khoản Zalo của bạn. Hệ thống chỉ liên kết theo mã, không theo tên hiển thị.",
    zaloLinked: "Đã liên kết Zalo",
    zaloNotLinked: "Chưa liên kết",
    zaloGetCode: "Lấy mã liên kết",
    zaloRevoke: "Gỡ liên kết",
    zaloCode: "Mã của bạn (hết hạn sau 15 phút):",
    zaloNotConfigured:
      "Zalo OA chưa được cấu hình trên máy chủ; mã có thể lấy nhưng chưa xác minh được.",
    notices: {
      created: "Đã lưu việc.",
      done: "Đã đánh dấu xong.",
      reopened: "Đã mở lại việc.",
      cancelled: "Đã hủy việc.",
      updated: "Đã cập nhật.",
      extensionApproved: "Đã duyệt gia hạn; hạn mới đã có hiệu lực.",
      extensionRejected: "Đã từ chối gia hạn; hạn cũ giữ nguyên.",
      proposalApproved: "Đã duyệt đề xuất và tạo việc.",
      proposalRejected: "Đã từ chối đề xuất.",
      remindersRan: "Đã chạy nhắc việc.",
      requeued: "Đã xếp lại để gửi.",
      zaloCode: "Đã tạo mã liên kết Zalo.",
      zaloRevoked: "Đã gỡ liên kết Zalo.",
    } as Record<string, string>,
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy bản ghi.",
      ORDER_NOT_FOUND: "Không tìm thấy đơn hàng với mã này.",
      ORDER_CLOSED: "Đơn hàng đã đóng hoặc đã hủy.",
      ASSIGNEE_NOT_FOUND: "Người được gán không phải tài khoản đang hoạt động.",
      NOT_ASSIGNEE: "Chỉ người được giao việc mới xin gia hạn được.",
      EXTENSION_PENDING: "Việc này đã có một yêu cầu đang chờ duyệt.",
      EXTENSION_NOT_FOUND: "Yêu cầu gia hạn đã được xử lý trước đó.",
      INVALID_DUE_DATE:
        "Hạn mới phải là một ngày trong tương lai và khác hạn cũ.",
      INVALID_TRANSITION: "Trạng thái hiện tại không cho phép thao tác này.",
      REASON_REQUIRED: "Thao tác này bắt buộc ghi lý do.",
      REVISION_CONFLICT:
        "Bản ghi đã thay đổi; trang đã tải lại, kiểm tra rồi thử lại.",
      ALREADY_DECIDED: "Đề xuất đã được quyết định trước đó.",
      SOURCE_CHANGED:
        "Đơn hàng đã thay đổi sau khi đề xuất; hãy yêu cầu trợ lý lập kế hoạch mới.",
      INVALID_PLAN:
        "Kế hoạch không còn hợp lệ (hạn đã qua hoặc phụ thuộc sai); hãy lập lại.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ.",
      NOT_CONFIGURED: "Chức năng chưa được cấu hình trên máy chủ.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "Work",
    title: "Assign work",
    description:
      "Hand work to a person with a deadline (end of business day, Vietnam time), follow who is doing what and who is late, and answer requests for more time. The assignee sees their own list under My assigned work.",
    filterOpen: "Open",
    filterDone: "Done",
    filterCancelled: "Cancelled",
    filterAll: "All",
    empty: "No tasks match this filter.",
    createTitle: "Assign new work",
    editTitle: "Edit task",
    save: "Save changes",
    extensionsTitle: "Extension requests awaiting an answer",
    extensionsHint:
      "The assignee asks to move a deadline and says why. Approving moves it at once and the reminders follow the new date; declining leaves it where it was. Either way the asker is told by email and Zalo.",
    extensionsEmpty: "No request is waiting.",
    extensionCurrent: "Current deadline",
    extensionRequested: "Asked to move to",
    extensionReason: "Reason",
    extensionNote: "Note back to the asker (optional)",
    extensionApprove: "Approve",
    extensionReject: "Decline",
    fieldTitle: "Task",
    fieldNote: "Note",
    fieldDue: "Due (day)",
    fieldOrder: "Order code (optional)",
    fieldAssignee: "Assignee",
    fieldPriority: "Priority",
    priorityNormal: "Normal",
    priorityHigh: "High",
    self: "Me",
    create: "Save task",
    done: "Done",
    reopen: "Reopen",
    cancel: "Cancel",
    cancelReason: "Reason…",
    overdue: "Overdue",
    dueToday: "Today",
    noDue: "No deadline",
    unassigned: "Unassigned",
    order: "Order",
    stage: "Stage",
    fromProposal: "From AI proposal",
    completedAt: "Done at",
    proposalsTitle: "Assistant proposals awaiting approval",
    proposalsHint:
      "The assistant only drafts; tasks are created when you approve here. A plan follows the order's remaining stages; assumptions are listed for you to check.",
    proposalsEmpty: "No proposal is waiting.",
    assumptions: "Assumptions",
    approve: "Approve and create tasks",
    reject: "Reject",
    rejectReason: "Rejection reason (required)",
    cannotDecide: "You do not hold the permission to decide this proposal.",
    remindersTitle: "Reminders",
    remindersHint:
      "Due-soon, due and overdue reminders go to the assignee by email and Zalo (when linked). The statuses below are the system's evidence, not a guess.",
    runNow: "Run reminders now",
    deliveryMode: "Delivery mode",
    cronConfigured: "Schedule: configured",
    cronMissing: "Schedule: not configured (manual runs only)",
    intentEmpty: "No reminder has been recorded yet.",
    retry: "Retry",
    intentStatus: {
      pending: "Queued",
      processing: "Sending",
      sent: "Accepted by provider",
      failed: "Failed, will retry",
      skipped: "Skipped",
      deadLetter: "Failed permanently",
    } as Record<string, string>,
    zaloTitle: "My Zalo",
    zaloHint:
      "Receive reminders on Zalo: get a code and send it to the company's Zalo OA from your own Zalo. Linking is by code only, never by display name.",
    zaloLinked: "Zalo linked",
    zaloNotLinked: "Not linked",
    zaloGetCode: "Get a link code",
    zaloRevoke: "Unlink",
    zaloCode: "Your code (expires in 15 minutes):",
    zaloNotConfigured:
      "The Zalo OA is not configured on the server; a code can be issued but not verified yet.",
    notices: {
      created: "Task saved.",
      done: "Marked done.",
      reopened: "Task reopened.",
      cancelled: "Task cancelled.",
      updated: "Updated.",
      extensionApproved: "Extension approved; the new deadline is in force.",
      extensionRejected: "Extension declined; the deadline stands.",
      proposalApproved: "Proposal approved and tasks created.",
      proposalRejected: "Proposal rejected.",
      remindersRan: "Reminders ran.",
      requeued: "Queued again.",
      zaloCode: "Zalo link code issued.",
      zaloRevoked: "Zalo unlinked.",
    } as Record<string, string>,
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The record was not found.",
      ORDER_NOT_FOUND: "No order carries this code.",
      ORDER_CLOSED: "The order is closed or cancelled.",
      ASSIGNEE_NOT_FOUND: "The assignee is not an active account.",
      NOT_ASSIGNEE: "Only the assignee may ask for more time.",
      EXTENSION_PENDING: "A request is already waiting on this task.",
      EXTENSION_NOT_FOUND: "That request was already decided.",
      INVALID_DUE_DATE:
        "The new deadline must be a future day other than the current one.",
      INVALID_TRANSITION: "The current status does not allow this action.",
      REASON_REQUIRED: "This action must record a reason.",
      REVISION_CONFLICT:
        "The record changed; the page reloaded — review and retry.",
      ALREADY_DECIDED: "This proposal was already decided.",
      SOURCE_CHANGED:
        "The order changed after the proposal; ask the assistant for a new plan.",
      INVALID_PLAN:
        "The plan is no longer valid (past dates or bad dependencies); draft it again.",
      INVALID_INPUT: "The submitted data is not valid.",
      NOT_CONFIGURED: "This feature is not configured on the server.",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

const cardClass =
  "border-burgundy/15 rounded-2xl border bg-white p-5 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
const buttonClass =
  "bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold disabled:opacity-50";
const ghostButtonClass =
  "text-burgundy border-burgundy/30 hover:bg-ivory/70 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold";
const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none";
const labelClass = "text-charcoal/60 mb-1 block text-xs";

function statusFilter(value: string | undefined): TaskStatus | "all" {
  return value === "all" ||
    (taskStatuses as readonly string[]).includes(value ?? "")
    ? (value as TaskStatus | "all")
    : "open";
}

export default async function AdminTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    order?: string;
    task?: string;
    notice?: string;
    error?: string;
    created?: string;
    sent?: string;
    skipped?: string;
    failed?: string;
  }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let access;
  try {
    access = await requireListAccess("tasks.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }
  const { context, scope } = access;
  const userId = context.userId;
  const now = new Date();
  const timeZone = getNotificationEnv().BUSINESS_TIMEZONE;
  const today = formatBusinessDay(now, timeZone);

  const coverages = await resolvePermissionCoverages([
    "tasks.create",
    "tasks.assign",
    "tasks.approvePlan",
    "notifications.retry",
    "notifications.manageOwnChannels",
  ] as const);
  const canCreate =
    coverages["tasks.create"].global ||
    coverages["tasks.create"].businessUnitIds.length > 0;
  const canAssign =
    coverages["tasks.assign"].global ||
    coverages["tasks.assign"].businessUnitIds.length > 0;
  const canApprovePlans =
    coverages["tasks.approvePlan"].global ||
    coverages["tasks.approvePlan"].businessUnitIds.length > 0;
  // Handing work out is what this screen is for. A reader who may only do
  // their own work has "Công việc được giao" instead, so there is no page
  // here for them to land on.
  if (!canAssign) notFound();
  const canRunReminders = coverages["notifications.retry"].global;
  const canLinkZalo =
    coverages["notifications.manageOwnChannels"].global ||
    coverages["notifications.manageOwnChannels"].businessUnitIds.length > 0;

  // A reminder link names one task; it must be found whatever its status.
  const highlight =
    query.task && /^[a-f0-9]{24}$/.test(query.task) ? query.task : null;
  const filter = statusFilter(query.status ?? (highlight ? "all" : undefined));
  let orderId: string | undefined;
  if (query.order) {
    const order = await orderCommandService.findByCodeForAuthorization(
      query.order,
    );
    if (order) orderId = order.id;
  }
  const taskScope =
    scope.kind === "all"
      ? ({ kind: "all" } as const)
      : scope.kind === "businessUnits"
        ? ({
            kind: "businessUnits",
            businessUnitIds: scope.businessUnitIds,
            userId,
          } as const)
        : ({ kind: "own", userId } as const);
  const tasks = await taskCommandService.list({
    scope: taskScope,
    ...(filter === "all" ? {} : { status: filter }),
    ...(orderId ? { orderId } : {}),
    limit: 300,
  });

  // The queue of people waiting for an answer about a deadline.
  const pendingExtensions = await taskCommandService.listPendingExtensions(50);

  const userIds = [
    ...new Set(
      [...tasks, ...pendingExtensions].flatMap((task) =>
        [
          task.assigneeUserId,
          task.createdBy,
          task.extensionRequest?.requestedBy ?? null,
        ].filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const [users, assignable, proposals] = await Promise.all([
    mongoUserDirectory.findActiveUsers(userIds),
    canAssign ? mongoUserDirectory.listActiveUsers() : Promise.resolve([]),
    canApprovePlans || canCreate
      ? assistantProposalService.listPending({
          ...(scope.kind === "all"
            ? {}
            : canApprovePlans && scope.kind === "businessUnits"
              ? { businessUnitIds: scope.businessUnitIds }
              : { proposedByUserId: userId }),
          limit: 20,
        })
      : Promise.resolve([] as AssistantProposalDto[]),
  ]);
  // Unit-scoped approvers still see their own ad-hoc proposals.
  const visibleProposals =
    scope.kind === "all"
      ? proposals
      : [
          ...proposals,
          ...(await assistantProposalService.listPending({
            proposedByUserId: userId,
            limit: 20,
          })),
        ].filter(
          (proposal, index, list) =>
            list.findIndex((p) => p.id === proposal.id) === index,
        );

  let intents: NotificationIntentDto[] = [];
  if (canRunReminders) {
    intents = await notificationIntentStore.listRecent({ limit: 20 });
  }
  const notificationEnv = getNotificationEnv();
  const cronConfigured = inspectCronEnv().configured;
  const zaloConfigured = inspectZaloEnv().configured;
  const [zaloLink, zaloPending] = canLinkZalo
    ? await Promise.all([
        channelLinkStore.findActive(userId, "zalo"),
        channelLinkStore.findPending(userId, "zalo", now),
      ])
    : [null, null];

  const nameOf = (id: string | null) =>
    id
      ? (users.get(id)?.displayName ?? (id === userId ? text.self : "…"))
      : text.unassigned;

  const filters: { key: TaskStatus | "all"; label: string }[] = [
    { key: "open", label: text.filterOpen },
    { key: "done", label: text.filterDone },
    { key: "cancelled", label: text.filterCancelled },
    { key: "all", label: text.filterAll },
  ];

  const decideAllowed = (proposal: AssistantProposalDto) =>
    proposal.kind === "orderPlan"
      ? coverages["tasks.approvePlan"].global ||
        proposal.businessUnitIds.every((id) =>
          coverages["tasks.approvePlan"].businessUnitIds.includes(id),
        )
      : proposal.proposedByUserId === userId ||
        coverages["tasks.create"].global;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
            {text.title}
          </h1>
          <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
            {text.description}
          </p>
        </div>
      </div>

      {query.notice && text.notices[query.notice] ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.notices[query.notice]}
          {query.notice === "remindersRan"
            ? ` · ${locale === "vi" ? "tạo" : "created"} ${query.created ?? 0}, ${locale === "vi" ? "gửi" : "sent"} ${query.sent ?? 0}, ${locale === "vi" ? "bỏ qua" : "skipped"} ${query.skipped ?? 0}, ${locale === "vi" ? "lỗi" : "failed"} ${query.failed ?? 0}`
            : ""}
        </p>
      ) : null}
      {query.error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.errorLead} {text.errors[query.error] ?? text.errors.UNAVAILABLE}
        </p>
      ) : null}

      {/* Extension requests */}
      <section id="extensions" className={`${cardClass} mt-8`}>
        <h2 className="text-burgundy font-serif text-2xl">
          {text.extensionsTitle}
        </h2>
        <p className="text-charcoal/60 mt-2 text-sm">{text.extensionsHint}</p>
        {pendingExtensions.length === 0 ? (
          <p className="text-charcoal/55 mt-4 text-sm">
            {text.extensionsEmpty}
          </p>
        ) : (
          <ul className="mt-4 grid gap-4">
            {pendingExtensions.map((task) => {
              const request = task.extensionRequest!;
              return (
                <li
                  key={task.id}
                  className="border-burgundy/10 rounded-xl border p-4"
                >
                  <p className="text-charcoal font-semibold">{task.title}</p>
                  <p className="text-charcoal/55 mt-1 flex flex-wrap gap-x-3 text-xs">
                    <span>{nameOf(request.requestedBy)}</span>
                    <span>
                      {text.extensionCurrent}:{" "}
                      {task.dueAt
                        ? formatBusinessDay(task.dueAt, timeZone)
                        : text.noDue}
                    </span>
                    <span className="text-burgundy font-semibold">
                      {text.extensionRequested}:{" "}
                      {formatBusinessDay(request.requestedDueAt, timeZone)}
                    </span>
                    {task.orderCode && task.orderId ? (
                      <Link
                        href={
                          `/${locale}/admin/orders/${task.orderId}` as Route
                        }
                        className="text-burgundy font-mono hover:underline"
                      >
                        {task.orderCode}
                      </Link>
                    ) : null}
                  </p>
                  <p className="text-charcoal/70 mt-2 text-sm">
                    {text.extensionReason}: “{request.reason}”
                  </p>
                  <form
                    action={decideExtensionAction}
                    className="border-burgundy/10 mt-3 border-t pt-3"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <input
                      type="hidden"
                      name="expectedRevision"
                      value={task.revision}
                    />
                    <label
                      htmlFor={`ext-note-${task.id}`}
                      className={labelClass}
                    >
                      {text.extensionNote}
                    </label>
                    <input
                      id={`ext-note-${task.id}`}
                      name="note"
                      maxLength={2000}
                      className={fieldClass}
                    />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        name="outcome"
                        value="approved"
                        className={buttonClass}
                      >
                        {text.extensionApprove}
                      </button>
                      <button
                        type="submit"
                        name="outcome"
                        value="rejected"
                        className={ghostButtonClass}
                      >
                        {text.extensionReject}
                      </button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Filters */}
      <nav className="mt-8 flex flex-wrap gap-2" aria-label={text.title}>
        {filters.map((entry) => (
          <Link
            key={entry.key}
            href={
              `/${locale}/admin/tasks?status=${entry.key}${query.order ? `&order=${encodeURIComponent(query.order)}` : ""}` as Route
            }
            className={
              entry.key === filter
                ? "bg-burgundy text-ivory rounded-full px-4 py-2 text-sm font-semibold"
                : "text-burgundy border-burgundy/20 hover:bg-ivory/70 rounded-full border px-4 py-2 text-sm font-semibold"
            }
          >
            {entry.label}
          </Link>
        ))}
        {query.order ? (
          <span className="text-charcoal/60 self-center font-mono text-xs">
            {text.order} {query.order}
          </span>
        ) : null}
      </nav>

      {/* Task list */}
      <section className="mt-6">
        {tasks.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="grid gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                locale={locale}
                text={text}
                now={now}
                today={today}
                timeZone={timeZone}
                highlighted={task.id === highlight}
                assigneeName={nameOf(task.assigneeUserId)}
                assignable={assignable}
                canUpdate={
                  task.assigneeUserId === userId ||
                  task.createdBy === userId ||
                  scope.kind !== "own"
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Create */}
      {canCreate ? (
        <section className={`${cardClass} mt-8`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.createTitle}
          </h2>
          <form action={createTaskAction} className="mt-4 grid gap-3">
            <input type="hidden" name="locale" value={locale} />
            <div>
              <label htmlFor="task-title" className={labelClass}>
                {text.fieldTitle}
              </label>
              <input
                id="task-title"
                name="title"
                required
                maxLength={200}
                className={fieldClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="task-due" className={labelClass}>
                  {text.fieldDue}
                </label>
                <input
                  id="task-due"
                  name="dueDate"
                  type="date"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="task-order" className={labelClass}>
                  {text.fieldOrder}
                </label>
                <input
                  id="task-order"
                  name="orderCode"
                  maxLength={40}
                  className={`${fieldClass} font-mono`}
                  defaultValue={query.order ?? ""}
                />
              </div>
              <div>
                <label htmlFor="task-priority" className={labelClass}>
                  {text.fieldPriority}
                </label>
                <select
                  id="task-priority"
                  name="priority"
                  defaultValue="normal"
                  className={fieldClass}
                >
                  <option value="normal">{text.priorityNormal}</option>
                  <option value="high">{text.priorityHigh}</option>
                </select>
              </div>
            </div>
            {canAssign ? (
              <div>
                <label htmlFor="task-assignee" className={labelClass}>
                  {text.fieldAssignee}
                </label>
                <select
                  id="task-assignee"
                  name="assigneeUserId"
                  defaultValue={userId}
                  className={fieldClass}
                >
                  {assignable.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.id === userId ? `${text.self} · ` : ""}
                      {user.displayName} ({user.roleKeys.join(", ")})
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label htmlFor="task-note" className={labelClass}>
                {text.fieldNote}
              </label>
              <textarea
                id="task-note"
                name="note"
                rows={2}
                maxLength={2000}
                className={fieldClass}
              />
            </div>
            <div>
              <button type="submit" className={buttonClass}>
                {text.create}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {/* Proposals */}
      {canApprovePlans || canCreate ? (
        <section id="proposals" className={`${cardClass} mt-8`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.proposalsTitle}
          </h2>
          <p className="text-charcoal/60 mt-2 text-sm">{text.proposalsHint}</p>
          {visibleProposals.length === 0 ? (
            <p className="text-charcoal/55 mt-4 text-sm">
              {text.proposalsEmpty}
            </p>
          ) : (
            <ul className="mt-4 grid gap-4">
              {visibleProposals.map((proposal) => (
                <li
                  key={proposal.id}
                  className="border-burgundy/10 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-burgundy font-semibold">
                      {proposal.kind === "orderPlan"
                        ? locale === "vi"
                          ? "Kế hoạch đơn "
                          : "Order plan "
                        : locale === "vi"
                          ? "Việc đề xuất"
                          : "Proposed tasks"}
                      {proposal.orderCode ? (
                        <span className="font-mono">{proposal.orderCode}</span>
                      ) : null}
                    </p>
                    <p className="text-charcoal/45 text-xs">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(proposal.proposedAt)}
                    </p>
                  </div>
                  <ol className="mt-3 grid gap-1 text-sm">
                    {proposal.items.map((item) => (
                      <li key={item.index} className="flex flex-wrap gap-x-3">
                        <span className="text-charcoal/80">{item.title}</span>
                        {item.dueDate ? (
                          <span className="text-charcoal/50 font-mono text-xs">
                            {item.dueDate}
                          </span>
                        ) : null}
                        {item.ownerRole ? (
                          <span className="text-charcoal/45 text-xs">
                            {item.ownerRole}
                          </span>
                        ) : null}
                        {item.assigneeUserId ? (
                          <span className="text-charcoal/45 text-xs">
                            → {nameOf(item.assigneeUserId)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {proposal.assumptions.length > 0 ? (
                    <details className="mt-3 text-xs">
                      <summary className="text-charcoal/60 cursor-pointer font-semibold">
                        {text.assumptions} ({proposal.assumptions.length})
                      </summary>
                      <ul className="text-charcoal/60 mt-2 list-disc pl-5">
                        {proposal.assumptions.map((assumption, index) => (
                          <li key={index}>{assumption}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {decideAllowed(proposal) ? (
                    <form
                      action={decideProposalFormAction}
                      className="border-burgundy/10 mt-4 border-t pt-3"
                    >
                      <input type="hidden" name="locale" value={locale} />
                      <input
                        type="hidden"
                        name="proposalId"
                        value={proposal.id}
                      />
                      <input
                        type="hidden"
                        name="expectedRevision"
                        value={proposal.revision}
                      />
                      <label
                        htmlFor={`reason-${proposal.id}`}
                        className={labelClass}
                      >
                        {text.rejectReason}
                      </label>
                      <input
                        id={`reason-${proposal.id}`}
                        name="reason"
                        maxLength={2000}
                        className={fieldClass}
                      />
                      <div className="mt-3 flex flex-wrap gap-3">
                        <button
                          type="submit"
                          name="decision"
                          value="approved"
                          className={buttonClass}
                        >
                          {text.approve}
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="rejected"
                          className={ghostButtonClass}
                        >
                          {text.reject}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-charcoal/45 mt-3 text-xs">
                      {text.cannotDecide}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Reminders */}
      {canRunReminders ? (
        <section className={`${cardClass} mt-8`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.remindersTitle}
          </h2>
          <p className="text-charcoal/60 mt-2 text-sm">{text.remindersHint}</p>
          <p className="text-charcoal/60 mt-3 text-xs">
            {text.deliveryMode}:{" "}
            <span className="font-mono">
              {notificationEnv.NOTIFICATION_DELIVERY}
            </span>{" "}
            · {cronConfigured ? text.cronConfigured : text.cronMissing}
          </p>
          <form action={runRemindersAction} className="mt-3">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={buttonClass}>
              {text.runNow}
            </button>
          </form>
          {intents.length === 0 ? (
            <p className="text-charcoal/55 mt-4 text-sm">{text.intentEmpty}</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-160 border-collapse text-left text-sm">
                <tbody>
                  {intents.map((intent) => (
                    <tr
                      key={intent.id}
                      className="border-burgundy/8 border-b align-top"
                    >
                      <td className="text-charcoal/50 px-2 py-2 text-xs">
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(intent.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {intent.channel} · {intent.kind}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {nameOf(intent.recipientUserId)}
                      </td>
                      <td className="px-2 py-2 text-xs font-semibold">
                        {text.intentStatus[intent.status] ?? intent.status}
                        {intent.redirectedTo ? ` → ${intent.redirectedTo}` : ""}
                        {intent.lastError ? (
                          <span className="text-charcoal/50 block font-normal">
                            {intent.lastError}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        {intent.status === "failed" ||
                        intent.status === "deadLetter" ||
                        intent.status === "skipped" ? (
                          <form action={retryIntentAction}>
                            <input type="hidden" name="locale" value={locale} />
                            <input
                              type="hidden"
                              name="intentId"
                              value={intent.id}
                            />
                            <button
                              type="submit"
                              className="text-burgundy text-xs font-semibold hover:underline"
                            >
                              {text.retry}
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* Zalo */}
      {canLinkZalo ? (
        <section className={`${cardClass} mt-8`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.zaloTitle}
          </h2>
          <p className="text-charcoal/60 mt-2 text-sm">{text.zaloHint}</p>
          {!zaloConfigured ? (
            <p className="text-charcoal/55 mt-2 text-xs">
              {text.zaloNotConfigured}
            </p>
          ) : null}
          <p className="mt-3 text-sm font-semibold">
            {zaloLink ? text.zaloLinked : text.zaloNotLinked}
          </p>
          {zaloPending ? (
            <p className="mt-2 text-sm">
              {text.zaloCode}{" "}
              <span className="text-burgundy font-mono text-lg font-semibold">
                {zaloPending.verificationCode}
              </span>
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3">
            <form action={startZaloLinkAction}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className={ghostButtonClass}>
                {text.zaloGetCode}
              </button>
            </form>
            {zaloLink ? (
              <form action={revokeZaloLinkAction}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className={ghostButtonClass}>
                  {text.zaloRevoke}
                </button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TaskCard({
  task,
  locale,
  text,
  now,
  today,
  timeZone,
  highlighted,
  assigneeName,
  assignable,
  canUpdate,
}: {
  task: TaskRecordDto;
  locale: "vi" | "en";
  text: (typeof copy)["vi"] | (typeof copy)["en"];
  now: Date;
  today: string;
  timeZone: string;
  highlighted: boolean;
  assigneeName: string;
  assignable: readonly UserSummary[];
  canUpdate: boolean;
}) {
  const overdue = isOverdue(task, now);
  const dueDay = task.dueAt ? formatBusinessDay(task.dueAt, timeZone) : null;
  return (
    <li
      id={`task-${task.id}`}
      className={`${cardClass} ${highlighted ? "ring-gold ring-2" : ""} ${task.status !== "open" ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-charcoal font-semibold">
            {task.priority === "high" ? (
              <span className="text-lacquer mr-1">!</span>
            ) : null}
            {task.title}
          </p>
          <p className="text-charcoal/55 mt-1 flex flex-wrap gap-x-3 text-xs">
            <span
              className={
                overdue
                  ? "text-lacquer font-semibold"
                  : dueDay === today
                    ? "text-gold-ink font-semibold"
                    : ""
              }
            >
              {dueDay
                ? overdue
                  ? `${text.overdue} · ${dueDay}`
                  : dueDay === today
                    ? `${text.dueToday} · ${dueDay}`
                    : dueDay
                : text.noDue}
            </span>
            <span>{assigneeName}</span>
            {task.orderCode && task.orderId ? (
              <Link
                href={`/${locale}/admin/orders/${task.orderId}` as Route}
                className="text-burgundy font-mono hover:underline"
              >
                {task.orderCode}
              </Link>
            ) : null}
            {task.stage ? (
              <span>
                {text.stage} {orderStageDefinitions[task.stage].step ?? ""}
              </span>
            ) : null}
            {task.source.kind === "proposal" ? (
              <span>{text.fromProposal}</span>
            ) : null}
            {task.completedAt ? (
              <span>
                {text.completedAt}{" "}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(task.completedAt)}
              </span>
            ) : null}
          </p>
          {task.note ? (
            <p className="text-charcoal/65 mt-2 text-sm whitespace-pre-wrap">
              {task.note}
            </p>
          ) : null}
          {task.cancelReason ? (
            <p className="text-charcoal/55 mt-2 text-xs italic">
              “{task.cancelReason}”
            </p>
          ) : null}
          {task.extensionRequest ? (
            <p className="text-burgundy mt-2 text-xs font-semibold">
              <a href="#extensions" className="hover:underline">
                {text.extensionRequested}:{" "}
                {formatBusinessDay(
                  task.extensionRequest.requestedDueAt,
                  timeZone,
                )}
              </a>
            </p>
          ) : null}
        </div>
        {canUpdate ? (
          <div className="flex flex-wrap items-center gap-2">
            {task.status === "open" ? (
              <>
                <form action={setTaskStatusAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input
                    type="hidden"
                    name="expectedRevision"
                    value={task.revision}
                  />
                  <input type="hidden" name="status" value="done" />
                  <button type="submit" className={buttonClass}>
                    {text.done}
                  </button>
                </form>
                <form
                  action={setTaskStatusAction}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <input
                    type="hidden"
                    name="expectedRevision"
                    value={task.revision}
                  />
                  <input type="hidden" name="status" value="cancelled" />
                  <input
                    name="reason"
                    required
                    placeholder={text.cancelReason}
                    className="border-burgundy/20 w-32 rounded-lg border bg-white px-2 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    className="text-lacquer border-lacquer/30 hover:bg-lacquer/5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  >
                    {text.cancel}
                  </button>
                </form>
              </>
            ) : task.status === "done" ? (
              <form action={setTaskStatusAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="taskId" value={task.id} />
                <input
                  type="hidden"
                  name="expectedRevision"
                  value={task.revision}
                />
                <input type="hidden" name="status" value="open" />
                <button type="submit" className={ghostButtonClass}>
                  {text.reopen}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      {canUpdate && task.status === "open" ? (
        <details className="border-burgundy/10 mt-4 border-t pt-3">
          <summary className="text-burgundy cursor-pointer text-sm font-semibold">
            {text.editTitle}
          </summary>
          <form action={updateTaskAction} className="mt-3 grid gap-3">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="taskId" value={task.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={task.revision}
            />
            <div>
              <label htmlFor={`edit-title-${task.id}`} className={labelClass}>
                {text.fieldTitle}
              </label>
              <input
                id={`edit-title-${task.id}`}
                name="title"
                required
                maxLength={200}
                defaultValue={task.title}
                className={fieldClass}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor={`edit-due-${task.id}`} className={labelClass}>
                  {text.fieldDue}
                </label>
                <input
                  id={`edit-due-${task.id}`}
                  name="dueDate"
                  type="date"
                  defaultValue={dueDay ?? ""}
                  className={fieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor={`edit-priority-${task.id}`}
                  className={labelClass}
                >
                  {text.fieldPriority}
                </label>
                <select
                  id={`edit-priority-${task.id}`}
                  name="priority"
                  defaultValue={task.priority}
                  className={fieldClass}
                >
                  <option value="normal">{text.priorityNormal}</option>
                  <option value="high">{text.priorityHigh}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor={`edit-assignee-${task.id}`}
                  className={labelClass}
                >
                  {text.fieldAssignee}
                </label>
                <select
                  id={`edit-assignee-${task.id}`}
                  name="assigneeUserId"
                  defaultValue={task.assigneeUserId ?? ""}
                  className={fieldClass}
                >
                  {assignable.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} ({user.roleKeys.join(", ")})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor={`edit-note-${task.id}`} className={labelClass}>
                {text.fieldNote}
              </label>
              <textarea
                id={`edit-note-${task.id}`}
                name="note"
                rows={2}
                maxLength={2000}
                defaultValue={task.note ?? ""}
                className={fieldClass}
              />
            </div>
            <div>
              <button type="submit" className={ghostButtonClass}>
                {text.save}
              </button>
            </div>
          </form>
        </details>
      ) : null}
    </li>
  );
}
