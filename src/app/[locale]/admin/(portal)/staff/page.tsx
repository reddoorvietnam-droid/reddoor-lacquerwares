import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { runStaffCommandAction } from "@/app/[locale]/admin/(portal)/staff/actions";
import {
  buttonClass,
  dangerButtonClass,
  fieldClass,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { userStatuses, type UserStatus } from "@/domains/identity/contracts";
import { roleDefinitionSeeds } from "@/domains/identity/role-definitions";
import { listStaffMembers } from "@/domains/identity/staff-directory";
import {
  allowedStaffCommands,
  assignableRoleKeys,
  isAssignableRoleKey,
  protectedReason,
  singleRoleKey,
  type StaffCommandKind,
  type StaffMember,
} from "@/domains/identity/staff-policy";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { getNotificationEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale, type AdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Nhân sự",
    title: "Danh sách nhân sự",
    description:
      "Ai đăng nhập bằng Gmail lần đầu sẽ nằm ở Chờ duyệt. Chọn role rồi bấm Duyệt để người đó vào được hệ thống. Mỗi người giữ một role; role Giám đốc không cấp ở đây.",
    tabsLabel: "Trạng thái tài khoản",
    tabs: {
      pending: "Chờ duyệt",
      active: "Đang làm việc",
      suspended: "Đã khoá",
    } satisfies Record<UserStatus, string>,
    colName: "Tên",
    colEmail: "Gmail",
    colRole: "Role",
    colTime: {
      pending: "Đăng nhập lúc",
      active: "Đăng nhập lần cuối",
      suspended: "Khoá lúc",
    } satisfies Record<UserStatus, string>,
    colActions: "Thao tác",
    empty: {
      pending: "Không có ai đang chờ duyệt.",
      active: "Chưa có ai đang làm việc.",
      suspended: "Không có tài khoản nào bị khoá.",
    } satisfies Record<UserStatus, string>,
    noName: "(chưa có tên)",
    you: "bạn",
    noRole: "Chưa có role",
    never: "—",
    chooseRole: "Chọn role…",
    actions: {
      approve: "Duyệt",
      changeRole: "Lưu role",
      unlock: "Mở khoá",
    } as Partial<Record<StaffCommandKind, string>>,
    reject: "Từ chối",
    rejectConfirm:
      "Xoá yêu cầu này. Nếu người này đăng nhập lại, họ sẽ quay lại hàng chờ.",
    confirmReject: "Xác nhận từ chối",
    suspend: "Khoá",
    suspendConfirm:
      "Người này không vào được hệ thống từ lần tải trang kế tiếp. Role được giữ lại để mở khoá sau.",
    confirmSuspend: "Xác nhận khoá",
    protected: {
      SELF: "Tài khoản của bạn",
      DIRECTOR_PROTECTED: "Giám đốc",
      TEST_ACCOUNT: "Tài khoản kiểm thử",
    },
    notices: {
      approved: "Đã duyệt tài khoản.",
      rejected:
        "Đã từ chối. Nếu người này đăng nhập lại, họ sẽ quay lại hàng chờ.",
      roleChanged:
        "Đã đổi role. Quyền mới có hiệu lực từ lần tải trang kế tiếp.",
      suspended: "Đã khoá tài khoản.",
      unlocked: "Đã mở khoá tài khoản.",
    } as Record<string, string>,
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy tài khoản (có thể đã bị từ chối).",
      SELF: "Không thể thao tác trên tài khoản của chính mình.",
      DIRECTOR_PROTECTED:
        "Tài khoản Giám đốc không thể khoá, đổi role hay từ chối.",
      TEST_ACCOUNT: "Tài khoản kiểm thử không quản lý ở đây.",
      INVALID_STATE: "Trạng thái tài khoản không cho phép thao tác này.",
      INVALID_ROLE: "Hãy chọn một role hợp lệ.",
      ROLE_REQUIRED: "Tài khoản này chưa có role; hãy chọn role trước.",
      ROLE_UNCHANGED: "Role không thay đổi.",
      ROLE_UNAVAILABLE:
        "Role này chưa được khởi tạo trong hệ thống (cần chạy npm run seed).",
      REVISION_CONFLICT:
        "Tài khoản vừa thay đổi ở nơi khác; trang đã tải lại, kiểm tra rồi thử lại.",
      INVALID_INPUT: "Dữ liệu gửi lên chưa hợp lệ.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "People",
    title: "Staff",
    description:
      "Anyone signing in with Google for the first time waits under Pending. Pick a role and press Approve to let them in. Each person holds one role; the Director role is not handed out here.",
    tabsLabel: "Account status",
    tabs: {
      pending: "Pending",
      active: "Working",
      suspended: "Locked",
    } satisfies Record<UserStatus, string>,
    colName: "Name",
    colEmail: "Gmail",
    colRole: "Role",
    colTime: {
      pending: "Signed in at",
      active: "Last sign-in",
      suspended: "Locked at",
    } satisfies Record<UserStatus, string>,
    colActions: "Actions",
    empty: {
      pending: "Nobody is waiting for approval.",
      active: "Nobody is working yet.",
      suspended: "No account is locked.",
    } satisfies Record<UserStatus, string>,
    noName: "(no name)",
    you: "you",
    noRole: "No role",
    never: "—",
    chooseRole: "Choose a role…",
    actions: {
      approve: "Approve",
      changeRole: "Save role",
      unlock: "Unlock",
    } as Partial<Record<StaffCommandKind, string>>,
    reject: "Reject",
    rejectConfirm:
      "Deletes this request. If the person signs in again they queue up again.",
    confirmReject: "Confirm rejection",
    suspend: "Lock",
    suspendConfirm:
      "This person is shut out from their next page load. The role is kept so the account can be unlocked later.",
    confirmSuspend: "Confirm lock",
    protected: {
      SELF: "Your account",
      DIRECTOR_PROTECTED: "Director",
      TEST_ACCOUNT: "Test account",
    },
    notices: {
      approved: "Account approved.",
      rejected: "Rejected. If this person signs in again they queue up again.",
      roleChanged:
        "Role changed. The new access applies from the next page load.",
      suspended: "Account locked.",
      unlocked: "Account unlocked.",
    } as Record<string, string>,
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      NOT_FOUND: "The account was not found (it may have been rejected).",
      SELF: "You cannot act on your own account.",
      DIRECTOR_PROTECTED:
        "The Director account cannot be locked, re-roled or rejected.",
      TEST_ACCOUNT: "Test accounts are not managed here.",
      INVALID_STATE: "The account's status does not allow this action.",
      INVALID_ROLE: "Choose a valid role.",
      ROLE_REQUIRED: "This account has no role; choose one first.",
      ROLE_UNCHANGED: "The role did not change.",
      ROLE_UNAVAILABLE:
        "This role has not been set up in the system (run npm run seed).",
      REVISION_CONFLICT:
        "The account changed elsewhere; the page reloaded — review and retry.",
      INVALID_INPUT: "The submitted data is not valid.",
      UNAVAILABLE: "The system is temporarily unavailable.",
    } as Record<string, string>,
  },
} as const;

type Copy = (typeof copy)[AdminLocale];

function isUserStatus(value: string | undefined): value is UserStatus {
  return (userStatuses as readonly string[]).includes(value ?? "");
}

function roleLabel(key: string, locale: AdminLocale): string {
  return (
    roleDefinitionSeeds.find((seed) => seed.key === key)?.labels[locale] ?? key
  );
}

export default async function AdminStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; notice?: string; error?: string }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let context;
  try {
    context = await requirePermission("users.manageRoles");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const members = await listStaffMembers();
  const counts = {
    pending: members.filter(({ status }) => status === "pending").length,
    active: members.filter(({ status }) => status === "active").length,
    suspended: members.filter(({ status }) => status === "suspended").length,
  } satisfies Record<UserStatus, number>;
  const tab: UserStatus = isUserStatus(query.tab)
    ? query.tab
    : counts.pending > 0
      ? "pending"
      : "active";

  const collator = new Intl.Collator("vi");
  const rows = members
    .filter(({ status }) => status === tab)
    .sort((a, b) =>
      tab === "pending"
        ? (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
        : collator.compare(a.displayName ?? a.email, b.displayName ?? b.email),
    );

  const dateTime = new Intl.DateTimeFormat(
    locale === "vi" ? "vi-VN" : "en-GB",
    {
      timeZone: getNotificationEnv().BUSINESS_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );
  const timeOf = (member: StaffMember) => {
    const value =
      tab === "pending"
        ? member.createdAt
        : tab === "active"
          ? member.lastLoginAt
          : member.suspendedAt;
    return value ? dateTime.format(value) : text.never;
  };

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      {/* Own keys only: `?error=constructor` must not render Object.prototype. */}
      {query.notice && Object.hasOwn(text.notices, query.notice) ? (
        <p
          role="status"
          className="border-gold/40 bg-gold/10 text-charcoal/80 mt-6 rounded-2xl border px-5 py-3 text-sm"
        >
          {text.notices[query.notice]}
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-5 py-3 text-sm"
        >
          {text.errorLead}{" "}
          {Object.hasOwn(text.errors, query.error)
            ? text.errors[query.error]
            : text.errors.UNAVAILABLE}
        </p>
      ) : null}

      <nav aria-label={text.tabsLabel} className="mt-8 flex flex-wrap gap-2">
        {userStatuses.map((status) => (
          <Link
            key={status}
            href={`/${locale}/admin/staff?tab=${status}` as Route}
            aria-current={status === tab ? "page" : undefined}
            className={
              status === tab
                ? "bg-burgundy text-ivory rounded-full px-4 py-2 text-sm font-semibold"
                : "text-burgundy border-burgundy/20 hover:bg-ivory/70 rounded-full border px-4 py-2 text-sm font-semibold"
            }
          >
            {text.tabs[status]} ({counts[status]})
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="border-burgundy/15 text-charcoal/60 mt-6 max-w-3xl rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
          {text.empty[tab]}
        </p>
      ) : (
        <div className={`${tableWrapClass} mt-6`}>
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={thClass}>
                  {text.colName}
                </th>
                <th scope="col" className={thClass}>
                  {text.colEmail}
                </th>
                <th scope="col" className={thClass}>
                  {text.colRole}
                </th>
                <th scope="col" className={thClass}>
                  {text.colTime[tab]}
                </th>
                <th scope="col" className={thClass}>
                  {text.colActions}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <StaffRow
                  key={member.id}
                  member={member}
                  actorUserId={context.userId}
                  locale={locale}
                  tab={tab}
                  text={text}
                  time={timeOf(member)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommandFields({
  member,
  locale,
  tab,
  kind,
}: {
  member: StaffMember;
  locale: AdminLocale;
  tab: UserStatus;
  kind: StaffCommandKind;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="userId" value={member.id} />
      <input
        type="hidden"
        name="expectedAuthzVersion"
        value={member.authzVersion}
      />
      <input type="hidden" name="kind" value={kind} />
    </>
  );
}

/** A destructive action behind an inline confirmation, not a browser dialog. */
function ConfirmAction({
  member,
  locale,
  tab,
  kind,
  label,
  message,
  submit,
}: {
  member: StaffMember;
  locale: AdminLocale;
  tab: UserStatus;
  kind: "reject" | "suspend";
  label: string;
  message: string;
  submit: string;
}) {
  return (
    <details>
      <summary
        className={`${dangerButtonClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        {label}
      </summary>
      <form
        action={runStaffCommandAction}
        className="border-lacquer/25 bg-lacquer/5 mt-2 grid w-64 gap-2 rounded-xl border p-3"
      >
        <CommandFields member={member} locale={locale} tab={tab} kind={kind} />
        <p className="text-charcoal/75 text-xs leading-5">{message}</p>
        <button type="submit" className={dangerButtonClass}>
          {submit}
        </button>
      </form>
    </details>
  );
}

function StaffRow({
  member,
  actorUserId,
  locale,
  tab,
  text,
  time,
}: {
  member: StaffMember;
  actorUserId: string;
  locale: AdminLocale;
  tab: UserStatus;
  text: Copy;
  time: string;
}) {
  const allowed = allowedStaffCommands(member, actorUserId);
  const reason = protectedReason(member, actorUserId);
  const kept = singleRoleKey(member);
  const keptRole = kept && isAssignableRoleKey(kept) ? kept : null;
  const primaryKind: StaffCommandKind | null = allowed.includes("approve")
    ? "approve"
    : allowed.includes("changeRole")
      ? "changeRole"
      : allowed.includes("unlock")
        ? "unlock"
        : null;
  // Unlocking keeps the role the account had; a picker appears only when
  // there is no single role left to keep.
  const picksRole =
    primaryKind === "approve" ||
    primaryKind === "changeRole" ||
    (primaryKind === "unlock" && !keptRole);
  const formId = `staff-${member.id}`;
  const name = member.displayName ?? text.noName;

  return (
    <tr className="border-burgundy/8 border-b last:border-b-0">
      <td className={`${tdClass} text-charcoal font-semibold`}>
        {name}
        {member.id === actorUserId ? (
          <span className="text-charcoal/50 font-normal"> ({text.you})</span>
        ) : null}
      </td>
      <td className={`${tdClass} text-charcoal/75 break-all`}>
        {member.email}
      </td>
      <td className={tdClass}>
        {picksRole && member.roleKeys.length > 1 ? (
          // An older account holding several roles: show what it holds, since
          // the picker cannot preselect one of them.
          <span className="mb-2 flex flex-wrap gap-1.5">
            {member.roleKeys.map((key) => (
              <span
                key={key}
                className="bg-burgundy/8 text-burgundy rounded-full px-3 py-1 text-xs font-semibold"
              >
                {roleLabel(key, locale)}
              </span>
            ))}
          </span>
        ) : null}
        {picksRole ? (
          <select
            form={formId}
            name="roleKey"
            required
            defaultValue={keptRole ?? ""}
            aria-label={`${text.colRole}: ${name}`}
            className={`${fieldClass} min-w-52`}
          >
            <option value="" disabled>
              {text.chooseRole}
            </option>
            {assignableRoleKeys.map((key) => (
              <option key={key} value={key}>
                {roleLabel(key, locale)}
              </option>
            ))}
          </select>
        ) : member.roleKeys.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {member.roleKeys.map((key) => (
              <span
                key={key}
                className="bg-burgundy/8 text-burgundy rounded-full px-3 py-1 text-xs font-semibold"
              >
                {roleLabel(key, locale)}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-charcoal/45">{text.noRole}</span>
        )}
      </td>
      <td className={`${tdClass} text-charcoal/65 whitespace-nowrap`}>
        {time}
      </td>
      <td className={tdClass}>
        {reason ? (
          <span className="text-charcoal/50 text-xs">
            {text.protected[reason]}
          </span>
        ) : (
          <div className="flex flex-wrap items-start gap-2">
            {primaryKind ? (
              <form id={formId} action={runStaffCommandAction}>
                <CommandFields
                  member={member}
                  locale={locale}
                  tab={tab}
                  kind={primaryKind}
                />
                <button
                  type="submit"
                  className={
                    primaryKind === "changeRole"
                      ? ghostButtonClass
                      : buttonClass
                  }
                >
                  {text.actions[primaryKind]}
                </button>
              </form>
            ) : null}
            {allowed.includes("reject") ? (
              <ConfirmAction
                member={member}
                locale={locale}
                tab={tab}
                kind="reject"
                label={text.reject}
                message={text.rejectConfirm}
                submit={text.confirmReject}
              />
            ) : null}
            {allowed.includes("suspend") ? (
              <ConfirmAction
                member={member}
                locale={locale}
                tab={tab}
                kind="suspend"
                label={text.suspend}
                message={text.suspendConfirm}
                submit={text.confirmSuspend}
              />
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}
