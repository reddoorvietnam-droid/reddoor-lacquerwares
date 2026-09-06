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
  mongoZaloCredentialStore,
} from "@/domains/notifications/persistence/mongo-store";
import {
  ZaloTokenProvider,
  type ZaloTokenStatus,
} from "@/domains/notifications/zalo-token";
import { mongoTaskStore } from "@/domains/tasks/persistence/mongo-store";
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

/** Runs the reminder job with the platform's stores and the environment's policy. */
export async function runScheduledReminderJob(options: {
  trigger: "cron" | "manual";
  actorUserId?: string;
}): Promise<ReminderJobSummary> {
  const env = getNotificationEnv();
  // Renew the Zalo token ahead of expiry on every run, whatever the
  // delivery mode, so the channel is ready the moment it is switched on.
  const tokens = zaloTokenProvider();
  if (tokens) {
    await tokens.ensureFresh().catch((error) => {
      console.error("[zalo] token renewal threw", error);
    });
  }
  return runReminderJob(
    {
      taskStore: mongoTaskStore,
      intentStore: mongoNotificationIntentStore,
      channelLinks: mongoChannelLinkStore,
      userDirectory: mongoUserDirectory,
      auditRepository: mongoAuditRepository,
      email: resendEmailChannel,
      zalo: tokens ? createZaloChannel(tokens) : null,
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
