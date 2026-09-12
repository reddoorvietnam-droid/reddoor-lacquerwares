import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import {
  createZaloChannel,
  resendEmailChannel,
} from "@/domains/notifications/channels";
import type { TaskEventKind } from "@/domains/notifications/contracts";
import {
  drainIntents,
  queueTaskEvent,
  runReminderJob,
  type ReminderJobSummary,
} from "@/domains/notifications/dispatcher";
import { taskEventMessage } from "@/domains/notifications/templates";
import { ChannelLinkService } from "@/domains/notifications/linking";
import {
  mongoChannelLinkStore,
  mongoNotificationIntentStore,
  mongoWebhookEventStore,
  mongoZaloCredentialStore,
} from "@/domains/notifications/persistence/mongo-store";
import {
  ZaloTokenProvider,
  type ZaloTokenStatus,
} from "@/domains/notifications/zalo-token";
import type { TaskRecordDto } from "@/domains/tasks/contracts";
import { mongoTaskStore } from "@/domains/tasks/persistence/mongo-store";
import { formatBusinessDay } from "@/domains/tasks/policy";
import { getNotificationEnv, inspectZaloEnv } from "@/lib/env/server";
import { getSiteUrl } from "@/lib/seo/urls";
import { refreshZaloAccessToken } from "@/lib/zalo/oauth";

export const notificationIntentStore = mongoNotificationIntentStore;
export const channelLinkStore = mongoChannelLinkStore;
export const webhookEventStore = mongoWebhookEventStore;

export const channelLinkService = new ChannelLinkService({
  links: mongoChannelLinkStore,
  intents: mongoNotificationIntentStore,
  auditRepository: mongoAuditRepository,
});

/**
 * One token provider per process, so concurrent sends share a renewal.
 * Rebuilt if the app credentials change (a dev server reload).
 */
let tokenProvider: { key: string; provider: ZaloTokenProvider } | null = null;

export function zaloTokenProvider(): ZaloTokenProvider | null {
  const env = inspectZaloEnv();
  if (!env.configured) return null;
  const { ZALO_APP_ID, ZALO_APP_SECRET_KEY } = env.value;
  const key = `${ZALO_APP_ID}:${ZALO_APP_SECRET_KEY}`;
  if (!tokenProvider || tokenProvider.key !== key) {
    tokenProvider = {
      key,
      provider: new ZaloTokenProvider({
        store: mongoZaloCredentialStore,
        refresh: (input) => refreshZaloAccessToken(input),
        credentials: { appId: ZALO_APP_ID, appSecretKey: ZALO_APP_SECRET_KEY },
        log: (message) => console.info(message),
      }),
    };
  }
  return tokenProvider.provider;
}

/** Null until all Zalo variables are present. */
export function zaloChannel() {
  const tokens = zaloTokenProvider();
  return tokens ? createZaloChannel(tokens) : null;
}

/** Token state for the settings page; null when Zalo is not configured. */
export async function zaloTokenStatus(): Promise<ZaloTokenStatus | null> {
  const tokens = zaloTokenProvider();
  return tokens ? tokens.status() : null;
}

/** The platform's stores and the environment's delivery policy in one place. */
function reminderDependencies(zalo: ZaloTokenProvider | null) {
  const env = getNotificationEnv();
  return {
    taskStore: mongoTaskStore,
    intentStore: mongoNotificationIntentStore,
    channelLinks: mongoChannelLinkStore,
    userDirectory: mongoUserDirectory,
    auditRepository: mongoAuditRepository,
    email: resendEmailChannel,
    zalo: zalo ? createZaloChannel(zalo) : null,
    settings: {
      timeZone: env.BUSINESS_TIMEZONE,
      delivery: env.NOTIFICATION_DELIVERY,
      testRecipient: env.NOTIFICATION_TEST_RECIPIENT ?? null,
      leadDays: env.REMINDER_LEAD_DAYS,
      quietHours: env.REMINDER_QUIET_HOURS,
      siteUrl: getSiteUrl().toString(),
    },
  };
}

/** Runs the reminder job with the platform's stores and the environment's policy. */
export async function runScheduledReminderJob(options: {
  trigger: "cron" | "manual";
  actorUserId?: string;
}): Promise<ReminderJobSummary> {
  // Renew the Zalo token ahead of expiry on every run, whatever the
  // delivery mode, so the channel is ready the moment it is switched on.
  const tokens = zaloTokenProvider();
  if (tokens) {
    await tokens.ensureFresh().catch((error) => {
      console.error("[zalo] token renewal threw", error);
    });
  }
  return runReminderJob(reminderDependencies(tokens), options);
}

/**
 * Sends one event message the moment the action that raised it succeeds:
 * work handed to someone, a plea for more time, the answer to it. The
 * message is queued as an ordinary outbox row — same delivery policy, same
 * evidence on the settings screen — and then drained straight away instead
 * of waiting for the nightly job. A failure here never fails the action:
 * the row stays queued and the next run picks it up.
 */
export async function notifyTaskEvent(input: {
  kind: TaskEventKind;
  task: TaskRecordDto;
  recipientUserId: string;
  /** Who assigned the work, asked for more time, or gave the answer. */
  actorName: string;
  requestedDueAt?: Date | null;
  reason?: string | null;
  outcome?: "approved" | "rejected";
}): Promise<void> {
  const dependencies = reminderDependencies(zaloTokenProvider());
  const { timeZone, siteUrl } = dependencies.settings;
  const base = siteUrl.replace(/\/$/, "");
  const link =
    input.kind === "taskExtensionRequested"
      ? `${base}/vi/admin/tasks?task=${input.task.id}`
      : `${base}/vi/admin/my-tasks?task=${input.task.id}`;

  const message = taskEventMessage({
    kind: input.kind,
    task: input.task,
    actorName: input.actorName,
    currentDueDay: input.task.dueAt
      ? formatBusinessDay(input.task.dueAt, timeZone)
      : null,
    requestedDueDay: input.requestedDueAt
      ? formatBusinessDay(input.requestedDueAt, timeZone)
      : null,
    reason: input.reason ?? null,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    link,
  });

  await queueTaskEvent(dependencies, {
    kind: input.kind,
    task: input.task,
    recipientUserId: input.recipientUserId,
    // The revision the action produced: a repeated submit reuses the key
    // and sends nothing, a genuinely new event carries a new one.
    eventKey: String(input.task.revision),
    message,
    link,
  });
  await drainIntents(dependencies, { limit: 10 });
}
