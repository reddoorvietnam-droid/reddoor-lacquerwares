import type { AuditRepository } from "@/domains/audit/contracts";
import type { UserDirectory } from "@/domains/identity/user-directory";
import type {
  ChannelLinkStore,
  DeliveryMode,
  EmailChannel,
  NotificationIntentDto,
  NotificationIntentStore,
  ZaloChannel,
} from "@/domains/notifications/contracts";
import {
  dedupeKeyFor,
  isQuietHour,
  nextDeliveryInstant,
  nextRetryAt,
  parseQuietHours,
  planReminders,
  reminderStillApplies,
} from "@/domains/notifications/scheduler";
import { reminderMessage } from "@/domains/notifications/templates";
import type { TaskStore } from "@/domains/tasks/contracts";

/**
 * The reminder job, in two halves that are each safe to repeat:
 *
 * 1. Scan: read open tasks with a deadline inside the reminder horizon,
 *    decide which reminders belong to today, and upsert one intent per
 *    (task, kind, day, channel). Running the scan twice, or on two
 *    workers, creates nothing the second time — the dedupe key is unique.
 * 2. Drain: claim due intents one by one (an atomic status flip), check
 *    the task still warrants the reminder, resolve the recipient through
 *    the delivery policy, send, and record the outcome with a bounded
 *    retry schedule. A worker that dies mid-way leaves the row in
 *    `processing`; the next drain reclaims it after `staleAfterMs`.
 *
 * `NOTIFICATION_DELIVERY=off` still runs both halves so the outbox shows
 * what would go out; every row is then marked skipped with the reason.
 */

export type ReminderJobDependencies = {
  taskStore: TaskStore;
  intentStore: NotificationIntentStore;
  channelLinks: ChannelLinkStore;
  userDirectory: UserDirectory;
  auditRepository: AuditRepository;
  email: EmailChannel;
  zalo: ZaloChannel | null;
  settings: {
    timeZone: string;
    delivery: DeliveryMode;
    testRecipient: string | null;
    leadDays: number;
    quietHours: string;
    siteUrl: string;
  };
  now?: () => Date;
};

export type ReminderJobSummary = {
  ranAt: string;
  delivery: DeliveryMode;
  quietHours: boolean;
  scannedTasks: number;
  plannedReminders: number;
  intentsCreated: number;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  deadLettered: number;
  errors: string[];
};

const scanLimit = 500;
const drainLimit = 100;
const staleAfterMs = 10 * 60_000;

export async function runReminderJob(
  dependencies: ReminderJobDependencies,
  options: { trigger: "cron" | "manual"; actorUserId?: string } = {
    trigger: "cron",
  },
): Promise<ReminderJobSummary> {
  const now = dependencies.now?.() ?? new Date();
  const { settings } = dependencies;
  const quiet = parseQuietHours(settings.quietHours);
  const summary: ReminderJobSummary = {
    ranAt: now.toISOString(),
    delivery: settings.delivery,
    quietHours: isQuietHour(now, settings.timeZone, quiet),
    scannedTasks: 0,
    plannedReminders: 0,
    intentsCreated: 0,
    claimed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    deadLettered: 0,
    errors: [],
  };

  // 1. Scan.
  const horizon = new Date(
    now.getTime() + (settings.leadDays + 1) * 86_400_000,
  );
  const tasks = await dependencies.taskStore.listOpenDue(horizon, scanLimit);
  summary.scannedTasks = tasks.length;
  const plans = planReminders({
    tasks,
    now,
    timeZone: settings.timeZone,
    leadDays: settings.leadDays,
  });
  summary.plannedReminders = plans.length;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const recipientIds = [...new Set(plans.map((plan) => plan.recipientUserId))];
  const [users, zaloLinks] = await Promise.all([
    dependencies.userDirectory.findActiveUsers(recipientIds),
    dependencies.channelLinks.findActiveByUsers(recipientIds, "zalo"),
  ]);
  const deliverAt = nextDeliveryInstant(now, settings.timeZone, quiet);

  for (const plan of plans) {
    const task = taskById.get(plan.taskId);
    const user = users.get(plan.recipientUserId);
    if (!task || !user) continue;
    const link = `${settings.siteUrl.replace(/\/$/, "")}/vi/admin/tasks?task=${task.id}`;
    const message = reminderMessage({
      kind: plan.kind,
      task,
      dueDay: plan.dueDay,
      daysLate: plan.daysLate,
      link,
    });
    const channels: ("email" | "zalo")[] = ["email"];
    if (zaloLinks.has(user.id)) channels.push("zalo");
    for (const channel of channels) {
      try {
        const { created } = await dependencies.intentStore.upsertPending({
          kind: plan.kind,
          channel,
          recipientUserId: user.id,
          dedupeKey: dedupeKeyFor(plan, channel),
          subject: message.subject,
          body: channel === "email" ? message.text : message.chat,
          link,
          resourceType: "task",
          resourceId: task.id,
          businessUnitIds: task.businessUnitIds,
          nextAttemptAt: deliverAt,
        });
        if (created) summary.intentsCreated += 1;
      } catch (error) {
        summary.errors.push(
          `scan ${task.id}/${channel}: ${error instanceof Error ? error.message : "error"}`,
        );
      }
    }
  }

  // 2. Drain.
  const claimed = await dependencies.intentStore.claimDue({
    now,
    limit: drainLimit,
    staleAfterMs,
  });
  summary.claimed = claimed.length;
  for (const intent of claimed) {
    try {
      await deliver(dependencies, intent, now, summary);
    } catch (error) {
      summary.errors.push(
        `deliver ${intent.id}: ${error instanceof Error ? error.message : "error"}`,
      );
      await dependencies.intentStore.markFailed({
        intentId: intent.id,
        error: error instanceof Error ? error.message : "Unexpected error",
        retryAt: nextRetryAt(intent.attempts + 1, now),
        at: now,
      });
      summary.failed += 1;
    }
  }

  try {
    await dependencies.auditRepository.append({
      actor: options.actorUserId
        ? { type: "user", userId: options.actorUserId }
        : { type: "system", systemName: "reminder-job" },
      action: "notifications.reminderJobRan",
      resourceType: "notificationJob",
      resourceId: null,
      requestId: globalThis.crypto.randomUUID(),
      metadata: {
        trigger: options.trigger,
        ...summary,
        errors: summary.errors.length,
      },
      occurredAt: now,
    });
  } catch {
    // The job outcome is returned to the caller even if audit storage is down.
  }

  return summary;
}

async function deliver(
  dependencies: ReminderJobDependencies,
  intent: NotificationIntentDto,
  now: Date,
  summary: ReminderJobSummary,
): Promise<void> {
  const { settings } = dependencies;

  // Is the reminder still warranted?
  const task =
    intent.resourceType === "task"
      ? await dependencies.taskStore.findById(intent.resourceId)
      : null;
  const check = reminderStillApplies(task, intent, now, settings.timeZone);
  if (!check.applies) {
    await dependencies.intentStore.markSkipped({
      intentId: intent.id,
      reason: check.reason,
      deliveryMode: settings.delivery,
      at: now,
    });
    summary.skipped += 1;
    return;
  }

  if (settings.delivery === "off") {
    await dependencies.intentStore.markSkipped({
      intentId: intent.id,
      reason: "DELIVERY_OFF",
      deliveryMode: "off",
      at: now,
    });
    summary.skipped += 1;
    return;
  }

  const users = await dependencies.userDirectory.findActiveUsers([
    intent.recipientUserId,
  ]);
  const user = users.get(intent.recipientUserId);
  if (!user) {
    await dependencies.intentStore.markSkipped({
      intentId: intent.id,
      reason: "RECIPIENT_INACTIVE",
      deliveryMode: settings.delivery,
      at: now,
    });
    summary.skipped += 1;
    return;
  }

  let result;
  let redirectedTo: string | null = null;
  if (intent.channel === "email") {
    const to =
      settings.delivery === "test" ? settings.testRecipient! : user.email;
    if (settings.delivery === "test") redirectedTo = to;
    // Dev-preview and other non-routable addresses are skipped, not
    // attempted: a bounce would only burn a retry.
    if (!to.includes("@") || to.endsWith(".local")) {
      await dependencies.intentStore.markSkipped({
        intentId: intent.id,
        reason: "INVALID_RECIPIENT",
        deliveryMode: settings.delivery,
        at: now,
      });
      summary.skipped += 1;
      return;
    }
    const message = reminderMessage({
      kind: intent.kind,
      task: task!,
      dueDay: intent.dedupeKey.split(":")[3] ?? "",
      daysLate: 0,
      link: intent.link ?? settings.siteUrl,
    });
    result = await dependencies.email.send({
      to,
      subject: intent.subject,
      text: intent.body,
      html: message.html,
      idempotencyKey: intent.dedupeKey,
    });
  } else {
    if (!dependencies.zalo) {
      await dependencies.intentStore.markSkipped({
        intentId: intent.id,
        reason: "ZALO_NOT_CONFIGURED",
        deliveryMode: settings.delivery,
        at: now,
      });
      summary.skipped += 1;
      return;
    }
    if (settings.delivery === "test") {
      // There is no Zalo test recipient: a test run proves the pipeline
      // through email only and leaves the Zalo row visible as skipped.
      await dependencies.intentStore.markSkipped({
        intentId: intent.id,
        reason: "TEST_MODE_EMAIL_ONLY",
        deliveryMode: "test",
        at: now,
      });
      summary.skipped += 1;
      return;
    }
    const link = await dependencies.channelLinks.findActive(user.id, "zalo");
    if (!link?.externalId) {
      await dependencies.intentStore.markSkipped({
        intentId: intent.id,
        reason: "ZALO_NOT_LINKED",
        deliveryMode: settings.delivery,
        at: now,
      });
      summary.skipped += 1;
      return;
    }
    result = await dependencies.zalo.send({
      externalUserId: link.externalId,
      text: intent.body,
    });
  }

  if (result.ok) {
    await dependencies.intentStore.markSent({
      intentId: intent.id,
      providerMessageId: result.providerMessageId,
      redirectedTo,
      deliveryMode: settings.delivery,
      at: now,
    });
    summary.sent += 1;
    return;
  }

  const retryAt = result.retryable
    ? nextRetryAt(intent.attempts + 1, now)
    : null;
  await dependencies.intentStore.markFailed({
    intentId: intent.id,
    error: `${result.code}: ${result.message}`,
    retryAt,
    at: now,
  });
  if (retryAt) summary.failed += 1;
  else summary.deadLettered += 1;
}
