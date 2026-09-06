import type { NotificationKind } from "@/domains/notifications/contracts";
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
