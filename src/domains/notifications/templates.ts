import type {
  NotificationKind,
  TaskEventKind,
} from "@/domains/notifications/contracts";
import type { TaskRecordDto } from "@/domains/tasks/contracts";

/**
 * Reminder wording. Vietnamese only for now: every staff member reads
 * Vietnamese and the reminder must be understood at a glance on a phone.
 * Nothing commercial goes in: no price, no invoice amount, no customer
 * contact — the link opens the task in the portal, behind sign-in, where
 * the permission check decides what the reader sees.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type ReminderMessage = {
  subject: string;
  text: string;
  html: string;
  /** Short single-message form for chat channels. */
  chat: string;
};

/**
 * The house letter: a heading, the lines of the message as written for the
 * plain-text body, and one link back into the portal. Every notification
 * mail is this shell, so wording lives in one place per message and the
 * markup in one place for all of them.
 */
export function letterHtml(input: {
  heading: string;
  lines: readonly string[];
  link: string;
  linkLabel: string;
  footer: string;
}): string {
  const body = input.lines
    .filter((line) => line.length > 0)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;line-height:1.6">${escapeHtml(line)}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f0e8;font-family:Georgia,serif;color:#1b1917"><div style="max-width:600px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8a1c1c">Red Door Viet Nam</p><h1 style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#3d0d10">${escapeHtml(input.heading)}</h1>${body}<p style="margin:0 0 16px"><a href="${escapeHtml(input.link)}" style="color:#8a1c1c">${escapeHtml(input.linkLabel)}</a> (cần đăng nhập)</p><p style="margin:0;font-size:13px;color:#6b5f57">${escapeHtml(input.footer)}</p></div></body></html>`;
}

export function reminderMessage(input: {
  kind: NotificationKind;
  task: Pick<TaskRecordDto, "title" | "orderCode" | "priority">;
  dueDay: string;
  daysLate: number;
  link: string;
}): ReminderMessage {
  const orderPart = input.task.orderCode
    ? ` (đơn ${input.task.orderCode})`
    : "";
  const lead =
    input.kind === "taskDueSoon"
      ? `Sắp đến hạn ${input.dueDay}`
      : input.kind === "taskDue"
        ? `Đến hạn hôm nay (${input.dueDay})`
        : `Quá hạn ${input.daysLate} ngày (hạn ${input.dueDay})`;
  const priority = input.task.priority === "high" ? " · Ưu tiên cao" : "";
  const subject = `[Red Door] ${lead}: ${input.task.title}${orderPart}`;
  const text = [
    `${lead}${priority}`,
    `Việc: ${input.task.title}${orderPart}`,
    "",
    `Mở việc trong cổng quản trị (cần đăng nhập): ${input.link}`,
    "",
    "Đánh dấu hoàn thành hoặc đổi hạn trên cổng quản trị; tin nhắn này không cập nhật được trạng thái.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f5f0e8;font-family:Georgia,serif;color:#1b1917"><div style="max-width:600px;margin:0 auto;padding:32px 24px"><p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#8a1c1c">Red Door Viet Nam</p><h1 style="margin:0 0 16px;font-size:22px;font-weight:normal;color:#3d0d10">${escapeHtml(lead)}${escapeHtml(priority)}</h1><p style="margin:0 0 16px;line-height:1.6"><strong>${escapeHtml(input.task.title)}</strong>${escapeHtml(orderPart)}</p><p style="margin:0 0 16px"><a href="${escapeHtml(input.link)}" style="color:#8a1c1c">Mở việc trong cổng quản trị</a> (cần đăng nhập)</p><p style="margin:0;font-size:13px;color:#6b5f57">Đánh dấu hoàn thành hoặc đổi hạn trên cổng quản trị; tin nhắn này không cập nhật được trạng thái.</p></div></body></html>`;
  const chat = `${lead}${priority}\n${input.task.title}${orderPart}\n${input.link}`;
  return { subject, text, html, chat };
}

/**
 * The messages a person's action raises at once, as opposed to the daily
 * reminders: work handed over, a plea for more time, and the answer. Same
 * discretion as the reminders — the title, the deadline and the link, never
 * a price or a customer detail.
 */
export function taskEventMessage(input: {
  kind: TaskEventKind;
  task: Pick<TaskRecordDto, "title" | "orderCode" | "priority">;
  /** Who assigned the work, asked for more time, or gave the answer. */
  actorName: string;
  currentDueDay: string | null;
  requestedDueDay?: string | null;
  reason?: string | null;
  outcome?: "approved" | "rejected";
  link: string;
}): ReminderMessage {
  const orderPart = input.task.orderCode
    ? ` (đơn ${input.task.orderCode})`
    : "";
  const priority = input.task.priority === "high" ? " · Ưu tiên cao" : "";
  const due = input.currentDueDay ?? "không hạn";

  const heading =
    input.kind === "taskAssigned"
      ? "Bạn được giao một việc mới"
      : input.kind === "taskExtensionRequested"
        ? "Có người xin gia hạn"
        : input.outcome === "approved"
          ? "Đã duyệt xin gia hạn"
          : "Không duyệt xin gia hạn";

  const lines =
    input.kind === "taskAssigned"
      ? [
          `Việc: ${input.task.title}${orderPart}${priority}`,
          `Hạn: ${due}`,
          `Người giao: ${input.actorName}`,
        ]
      : input.kind === "taskExtensionRequested"
        ? [
            `Việc: ${input.task.title}${orderPart}`,
            `Người làm: ${input.actorName}`,
            `Hạn hiện tại: ${due}`,
            `Xin dời sang: ${input.requestedDueDay ?? "—"}`,
            `Lý do: ${input.reason ?? "—"}`,
          ]
        : [
            `Việc: ${input.task.title}${orderPart}`,
            input.outcome === "approved"
              ? `Hạn mới: ${due}`
              : `Hạn giữ nguyên: ${due}`,
            `Người quyết định: ${input.actorName}`,
            ...(input.reason ? [`Ghi chú: ${input.reason}`] : []),
          ];

  const footer =
    input.kind === "taskExtensionRequested"
      ? "Duyệt hoặc từ chối trên cổng quản trị; tin nhắn này không quyết định được."
      : "Đánh dấu hoàn thành hoặc xin gia hạn trên cổng quản trị; tin nhắn này không cập nhật được trạng thái.";
  const linkLabel =
    input.kind === "taskExtensionRequested"
      ? "Mở yêu cầu trong cổng quản trị"
      : "Mở việc trong cổng quản trị";

  const subject = `[Red Door] ${heading}: ${input.task.title}${orderPart}`;
  const text = [...lines, "", `${linkLabel}: ${input.link}`, "", footer].join(
    "\n",
  );
  const html = letterHtml({
    heading,
    lines,
    link: input.link,
    linkLabel,
    footer,
  });
  const chat = [heading, ...lines, input.link].join("\n");
  return { subject, text, html, chat };
}
