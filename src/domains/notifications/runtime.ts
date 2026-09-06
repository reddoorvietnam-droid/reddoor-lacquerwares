import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import {
  createZaloChannel,
  resendEmailChannel,
} from "@/domains/notifications/channels";
import {
  runReminderJob,
  type ReminderJobSummary,
} from "@/domains/notifications/dispatcher";
import { ChannelLinkService } from "@/domains/notifications/linking";
import {
  mongoChannelLinkStore,
  mongoNotificationIntentStore,
  mongoWebhookEventStore,
} from "@/domains/notifications/persistence/mongo-store";
import { mongoTaskStore } from "@/domains/tasks/persistence/mongo-store";
import { getNotificationEnv } from "@/lib/env/server";
import { getSiteUrl } from "@/lib/seo/urls";

export const notificationIntentStore = mongoNotificationIntentStore;
export const channelLinkStore = mongoChannelLinkStore;
export const webhookEventStore = mongoWebhookEventStore;

export const channelLinkService = new ChannelLinkService({
  links: mongoChannelLinkStore,
  intents: mongoNotificationIntentStore,
  auditRepository: mongoAuditRepository,
});

export const zaloChannel = createZaloChannel;

/** Runs the reminder job with the platform's stores and the environment's policy. */
export async function runScheduledReminderJob(options: {
  trigger: "cron" | "manual";
  actorUserId?: string;
}): Promise<ReminderJobSummary> {
  const env = getNotificationEnv();
  return runReminderJob(
    {
      taskStore: mongoTaskStore,
      intentStore: mongoNotificationIntentStore,
      channelLinks: mongoChannelLinkStore,
      userDirectory: mongoUserDirectory,
      auditRepository: mongoAuditRepository,
      email: resendEmailChannel,
      zalo: createZaloChannel(),
      settings: {
        timeZone: env.BUSINESS_TIMEZONE,
        delivery: env.NOTIFICATION_DELIVERY,
        testRecipient: env.NOTIFICATION_TEST_RECIPIENT ?? null,
        leadDays: env.REMINDER_LEAD_DAYS,
        quietHours: env.REMINDER_QUIET_HOURS,
        siteUrl: getSiteUrl().toString(),
      },
    },
    options,
  );
}
