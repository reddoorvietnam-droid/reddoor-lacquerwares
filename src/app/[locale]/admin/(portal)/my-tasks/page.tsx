import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  requestExtensionAction,
  revokeZaloLinkAction,
  setTaskStatusAction,
  startZaloLinkAction,
} from "@/app/[locale]/admin/(portal)/tasks/actions";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import { channelLinkStore } from "@/domains/notifications/runtime";
import { type TaskRecordDto } from "@/domains/tasks/contracts";
import { formatBusinessDay, isOverdue } from "@/domains/tasks/policy";
import { taskCommandService } from "@/domains/tasks/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getNotificationEnv, inspectZaloEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

/**
 * "Công việc được giao": one person's own inbox of work the Director handed
 * them. It shows what was asked, when it is due, and offers exactly two
 * moves — mark it done, or ask for more time with a reason. Nothing here
 * creates work, assigns it, or reads anyone else's list (confirmed with the
 * client on 2026-09-12).
 */
export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Công việc",
    title: "Công việc được giao",
    description:
      "Việc Giám đốc giao cho bạn, kèm hạn hoàn thành (cuối ngày làm việc, giờ Việt Nam). Xong thì bấm “Xong”; không kịp hạn thì bấm “Xin gia hạn” và ghi lý do — hạn chỉ đổi khi Giám đốc duyệt.",
    filterOpen: "Đang làm",
    filterDone: "Đã xong",
    filterAll: "Tất cả",
    empty: "Không có việc nào trong mục này.",
    overdue: "Quá hạn",
    dueToday: "Hạn hôm nay",
    noDue: "Không hạn",
    order: "Đơn",
    assignedBy: "Người giao",
    completedAt: "Xong lúc",
    done: "Xong",
    extendTitle: "Xin gia hạn",
    extendDue: "Hạn mới",
    extendReason: "Lý do",
    extendSubmit: "Gửi yêu cầu",
    extendPending: "Đang chờ Giám đốc duyệt: xin dời sang",
    extendPendingReason: "Lý do đã gửi",
    extendApproved: "Giám đốc đã duyệt gia hạn tới",
    extendRejected: "Giám đốc không duyệt gia hạn tới",
    extendNote: "Ghi chú",
    zaloTitle: "Zalo của tôi",
    zaloHint:
      "Nhận việc mới và nhắc hạn qua Zalo: lấy mã rồi gửi mã đó cho Zalo OA của công ty từ chính tài khoản Zalo của bạn. Hệ thống chỉ liên kết theo mã, không theo tên hiển thị.",
    zaloLinked: "Đã liên kết Zalo",
    zaloNotLinked: "Chưa liên kết",
    zaloGetCode: "Lấy mã liên kết",
    zaloRevoke: "Gỡ liên kết",
    zaloCode: "Mã của bạn (hết hạn sau 15 phút):",
    zaloNotConfigured:
      "Zalo OA chưa được cấu hình trên máy chủ; mã có thể lấy nhưng chưa xác minh được.",
    notices: {
      done: "Đã đánh dấu xong.",
      updated: "Đã cập nhật.",
      extensionRequested: "Đã gửi yêu cầu gia hạn cho Giám đốc.",
      zaloCode: "Đã tạo mã liên kết Zalo.",
      zaloRevoked: "Đã gỡ liên kết Zalo.",
    } as Record<string, string>,
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy bản ghi.",
      NOT_ASSIGNEE: "Chỉ người được giao việc mới xin gia hạn được.",
      EXTENSION_PENDING: "Việc này đã có một yêu cầu đang chờ duyệt.",
      INVALID_DUE_DATE:
        "Hạn mới phải là một ngày trong tương lai và khác hạn cũ.",
      INVALID_TRANSITION: "Trạng thái hiện tại không cho phép thao tác này.",
      REVISION_CONFLICT:
        "Bản ghi đã thay đổi; trang đã tải lại, kiểm tra rồi thử lại.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ.",
      NOT_CONFIGURED: "Chức năng chưa được cấu hình trên máy chủ.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "Work",
    title: "My assigned work",
    description:
      "Work the Director assigned to you, with its deadline (end of business day, Vietnam time). Mark it done here; if you cannot make the date, ask for more time with a reason — the deadline only moves once the Director approves.",
    filterOpen: "In progress",
    filterDone: "Done",
    filterAll: "All",
    empty: "Nothing here.",
    overdue: "Overdue",
    dueToday: "Due today",
    noDue: "No deadline",
    order: "Order",
    assignedBy: "Assigned by",
    completedAt: "Done at",
    done: "Done",
    extendTitle: "Ask for more time",
    extendDue: "New deadline",
    extendReason: "Reason",
    extendSubmit: "Send request",
    extendPending: "Waiting for the Director: asked to move to",
    extendPendingReason: "Reason sent",
    extendApproved: "The Director approved a move to",
    extendRejected: "The Director declined a move to",
    extendNote: "Note",
    zaloTitle: "My Zalo",
    zaloHint:
      "Receive new work and deadline reminders on Zalo: get a code and send it to the company's Zalo OA from your own Zalo. Linking is by code only, never by display name.",
    zaloLinked: "Zalo linked",
    zaloNotLinked: "Not linked",
    zaloGetCode: "Get a link code",
    zaloRevoke: "Unlink",
    zaloCode: "Your code (expires in 15 minutes):",
    zaloNotConfigured:
      "The Zalo OA is not configured on the server; a code can be issued but not verified yet.",
    notices: {
      done: "Marked done.",
      updated: "Updated.",
      extensionRequested: "The request went to the Director.",
      zaloCode: "Zalo link code issued.",
      zaloRevoked: "Zalo unlinked.",
    } as Record<string, string>,
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The record was not found.",
      NOT_ASSIGNEE: "Only the assignee may ask for more time.",
      EXTENSION_PENDING: "A request is already waiting on this task.",
      INVALID_DUE_DATE:
        "The new deadline must be a future day other than the current one.",
      INVALID_TRANSITION: "The current status does not allow this action.",
      REVISION_CONFLICT:
        "The record changed; the page reloaded — review and retry.",
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

type Filter = "open" | "done" | "all";

function readFilter(value: string | undefined): Filter {
  return value === "done" || value === "all" ? value : "open";
}

export default async function AdminMyTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    task?: string;
    notice?: string;
    error?: string;
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
  const tomorrow = formatBusinessDay(
    new Date(now.getTime() + 86_400_000),
    timeZone,
  );

  const highlight =
    query.task && /^[a-f0-9]{24}$/.test(query.task) ? query.task : null;
  const filter = readFilter(query.status ?? (highlight ? "all" : undefined));

  // Whatever the grant's scope, this screen is one person's own list: the
  // query is narrowed to the tasks assigned to the reader.
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
    assigneeUserId: userId,
    ...(filter === "all" ? {} : { status: filter }),
    limit: 200,
  });

  const coverages = await resolvePermissionCoverages([
    "notifications.manageOwnChannels",
  ] as const);
  const canLinkZalo =
    coverages["notifications.manageOwnChannels"].global ||
    coverages["notifications.manageOwnChannels"].businessUnitIds.length > 0;

  const assignerIds = [
    ...new Set(
      tasks.map((task) => task.createdBy).filter((id) => id !== userId),
    ),
  ];
  const [assigners, zaloLink, zaloPending] = await Promise.all([
    mongoUserDirectory.findActiveUsers(assignerIds),
    canLinkZalo ? channelLinkStore.findActive(userId, "zalo") : null,
    canLinkZalo ? channelLinkStore.findPending(userId, "zalo", now) : null,
  ]);
  const zaloConfigured = inspectZaloEnv().configured;

  const filters: { key: Filter; label: string }[] = [
    { key: "open", label: text.filterOpen },
    { key: "done", label: text.filterDone },
    { key: "all", label: text.filterAll },
  ];

  return (
    <div>
      <div>
        <p className="eyebrow">{text.eyebrow}</p>
        <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
          {text.title}
        </h1>
        <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
          {text.description}
        </p>
      </div>

      {query.notice && text.notices[query.notice] ? (
        <p className="border-gold/40 bg-gold/10 text-charcoal/80 mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.notices[query.notice]}
        </p>
      ) : null}
      {query.error ? (
        <p className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-5 py-3 text-sm">
          {text.errorLead} {text.errors[query.error] ?? text.errors.UNAVAILABLE}
        </p>
      ) : null}

      <nav className="mt-8 flex flex-wrap gap-2" aria-label={text.title}>
        {filters.map((entry) => (
          <Link
            key={entry.key}
            href={`/${locale}/admin/my-tasks?status=${entry.key}` as Route}
            className={
              entry.key === filter
                ? "bg-burgundy text-ivory rounded-full px-4 py-2 text-sm font-semibold"
                : "text-burgundy border-burgundy/20 hover:bg-ivory/70 rounded-full border px-4 py-2 text-sm font-semibold"
            }
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        {tasks.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="grid gap-3">
            {tasks.map((task) => (
              <AssignedTaskCard
                key={task.id}
                task={task}
                locale={locale}
                text={text}
                now={now}
                today={today}
                tomorrow={tomorrow}
                timeZone={timeZone}
                highlighted={task.id === highlight}
                assignerName={
                  task.createdBy === userId
                    ? null
                    : (assigners.get(task.createdBy)?.displayName ?? null)
                }
              />
            ))}
          </ul>
        )}
      </section>

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
              <input type="hidden" name="returnTo" value="my-tasks" />
              <button type="submit" className={ghostButtonClass}>
                {text.zaloGetCode}
              </button>
            </form>
            {zaloLink ? (
              <form action={revokeZaloLinkAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="returnTo" value="my-tasks" />
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

function AssignedTaskCard({
  task,
  locale,
  text,
  now,
  today,
  tomorrow,
  timeZone,
  highlighted,
  assignerName,
}: {
  task: TaskRecordDto;
  locale: "vi" | "en";
  text: (typeof copy)["vi"] | (typeof copy)["en"];
  now: Date;
  today: string;
  tomorrow: string;
  timeZone: string;
  highlighted: boolean;
  assignerName: string | null;
}) {
  const overdue = isOverdue(task, now);
  const dueDay = task.dueAt ? formatBusinessDay(task.dueAt, timeZone) : null;
  const request = task.extensionRequest;
  const decision = task.lastExtensionDecision;
  const day = (value: Date) => formatBusinessDay(value, timeZone);

  return (
    <li
      id={`task-${task.id}`}
      className={`${cardClass} ${highlighted ? "ring-gold ring-2" : ""} ${
        task.status !== "open" ? "opacity-70" : ""
      }`}
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
            {assignerName ? (
              <span>
                {text.assignedBy}: {assignerName}
              </span>
            ) : null}
            {task.orderCode && task.orderId ? (
              <Link
                href={`/${locale}/admin/orders/${task.orderId}` as Route}
                className="text-burgundy font-mono hover:underline"
              >
                {task.orderCode}
              </Link>
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
          {request ? (
            <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-3 rounded-xl border px-3 py-2 text-xs">
              {text.extendPending}{" "}
              <strong>{day(request.requestedDueAt)}</strong>
              {request.reason ? (
                <span className="mt-1 block">
                  {text.extendPendingReason}: “{request.reason}”
                </span>
              ) : null}
            </p>
          ) : decision ? (
            <p className="text-charcoal/55 mt-3 text-xs">
              {decision.outcome === "approved"
                ? text.extendApproved
                : text.extendRejected}{" "}
              <strong>{day(decision.requestedDueAt)}</strong>
              {decision.note ? ` · ${text.extendNote}: “${decision.note}”` : ""}
            </p>
          ) : null}
        </div>

        {task.status === "open" ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={setTaskStatusAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="taskId" value={task.id} />
              <input
                type="hidden"
                name="expectedRevision"
                value={task.revision}
              />
              <input type="hidden" name="status" value="done" />
              <input type="hidden" name="returnTo" value="my-tasks" />
              <button type="submit" className={buttonClass}>
                {text.done}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {task.status === "open" && !request ? (
        <details className="border-burgundy/10 mt-4 border-t pt-3">
          <summary className="text-burgundy cursor-pointer text-sm font-semibold">
            {text.extendTitle}
          </summary>
          <form
            action={requestExtensionAction}
            className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="taskId" value={task.id} />
            <input
              type="hidden"
              name="expectedRevision"
              value={task.revision}
            />
            <div>
              <label htmlFor={`due-${task.id}`} className={labelClass}>
                {text.extendDue}
              </label>
              <input
                id={`due-${task.id}`}
                name="requestedDueDate"
                type="date"
                required
                min={tomorrow}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`reason-${task.id}`} className={labelClass}>
                {text.extendReason}
              </label>
              <input
                id={`reason-${task.id}`}
                name="reason"
                required
                maxLength={2000}
                className={fieldClass}
              />
            </div>
            <button type="submit" className={ghostButtonClass}>
              {text.extendSubmit}
            </button>
          </form>
        </details>
      ) : null}
    </li>
  );
}
