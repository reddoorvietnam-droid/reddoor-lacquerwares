/**
 * Reminders as durable records.
 *
 * A NotificationIntent is the outbox row for one message to one person on
 * one channel: what it says, why (the task and the reminder kind), a dedupe
 * key so a job that runs twice or two workers at once cannot queue the same
 * reminder twice, and the delivery history. Nothing is sent from inside a
 * request: the reminder job creates intents from the task list and drains
 * them with bounded retries, and every attempt leaves its outcome on the
 * row — including "skipped" when delivery is switched off, so an operator
 * can see what would have gone out.
 */

export const notificationChannels = ["email", "zalo"] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationKinds = [
  "taskDueSoon",
  "taskDue",
  "taskOverdue",
] as const;
export type NotificationKind = (typeof notificationKinds)[number];

export const notificationStatuses = [
  "pending",
  "processing",
  "sent",
  "failed",
  "skipped",
  "deadLetter",
] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];

export type DeliveryMode = "off" | "test" | "live";

export type NotificationIntentDto = {
  id: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  recipientUserId: string;
  /** Business dedupe key, unique: `task:<taskId>:<kind>:<day>:<channel>`. */
  dedupeKey: string;
  subject: string;
  body: string;
  link: string | null;
  resourceType: string;
  resourceId: string;
  businessUnitIds: readonly string[];
  status: NotificationStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  /** The provider's id when it accepted the message; evidence of "accepted", not "read". */
  providerMessageId: string | null;
  /** Where a `test`-mode message really went. */
  redirectedTo: string | null;
  deliveryMode: DeliveryMode | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewNotificationIntent = {
  kind: NotificationKind;
  channel: NotificationChannel;
  recipientUserId: string;
  dedupeKey: string;
  subject: string;
  body: string;
  link: string | null;
  resourceType: string;
  resourceId: string;
  businessUnitIds: readonly string[];
  nextAttemptAt: Date;
};

export interface NotificationIntentStore {
  /** Inserts unless the dedupe key exists; returns the stored row either way. */
  upsertPending(
    record: NewNotificationIntent,
  ): Promise<{ intent: NotificationIntentDto; created: boolean }>;
  /**
   * Atomically moves due pending rows to `processing` for this worker, one
   * conditional update per row, so two concurrent drains never both take
   * the same intent. A row stuck in `processing` longer than `staleAfterMs`
   * is reclaimed.
   */
  claimDue(input: {
    now: Date;
    limit: number;
    staleAfterMs: number;
  }): Promise<NotificationIntentDto[]>;
  markSent(input: {
    intentId: string;
    providerMessageId: string | null;
    redirectedTo: string | null;
    deliveryMode: DeliveryMode;
    at: Date;
  }): Promise<void>;
  markFailed(input: {
    intentId: string;
    error: string;
    /** Null = give up (dead letter). */
    retryAt: Date | null;
    at: Date;
  }): Promise<void>;
  markSkipped(input: {
    intentId: string;
    reason: string;
    deliveryMode: DeliveryMode;
    at: Date;
  }): Promise<void>;
  /** Re-queues a failed or dead-lettered row for a manual retry. */
  requeue(intentId: string, at: Date): Promise<NotificationIntentDto | null>;
  listForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<NotificationIntentDto[]>;
  listRecent(filter: {
    status?: NotificationStatus;
    limit?: number;
  }): Promise<NotificationIntentDto[]>;
  countByStatus(): Promise<Record<NotificationStatus, number>>;
}

/* ------------------------------------------------------------------ */
/* Channel identity links (Zalo)                                       */
/* ------------------------------------------------------------------ */

export const channelLinkStatuses = ["pending", "active", "revoked"] as const;
export type ChannelLinkStatus = (typeof channelLinkStatuses)[number];

export type ChannelLinkDto = {
  id: string;
  userId: string;
  channel: "zalo";
  /** The provider's user id once verified; never a display name. */
  externalId: string | null;
  status: ChannelLinkStatus;
  /** Short code the staff member sends to the Official Account to prove ownership. */
  verificationCode: string | null;
  verificationExpiresAt: Date | null;
  linkedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface ChannelLinkStore {
  /** Replaces any pending link of the user with a fresh code. */
  createPending(input: {
    userId: string;
    channel: "zalo";
    verificationCode: string;
    expiresAt: Date;
    at: Date;
  }): Promise<ChannelLinkDto>;
  findActive(userId: string, channel: "zalo"): Promise<ChannelLinkDto | null>;
  /** The user's unexpired pending link, so the portal can show the code again. */
  findPending(
    userId: string,
    channel: "zalo",
    now: Date,
  ): Promise<ChannelLinkDto | null>;
  findActiveByUsers(
    userIds: readonly string[],
    channel: "zalo",
  ): Promise<ReadonlyMap<string, ChannelLinkDto>>;
  findPendingByCode(
    code: string,
    now: Date,
    channel: "zalo",
  ): Promise<ChannelLinkDto | null>;
  /** Activates a pending link; fails when the external id is already linked to someone else. */
  activate(input: {
    linkId: string;
    externalId: string;
    at: Date;
  }): Promise<ChannelLinkDto | null>;
  revoke(userId: string, channel: "zalo", at: Date): Promise<void>;
}

/** Replay protection for provider webhooks: one row per processed event id. */
export interface WebhookEventStore {
  /** True when the event id was not seen before (and is now recorded). */
  recordOnce(provider: string, eventId: string, at: Date): Promise<boolean>;
}

/* ------------------------------------------------------------------ */
/* Channel adapters                                                    */
/* ------------------------------------------------------------------ */

export type ChannelSendResult =
  | { ok: true; providerMessageId: string | null }
  | {
      ok: false;
      code: "NOT_CONFIGURED" | "INVALID_RECIPIENT" | "SEND_FAILED" | "UNKNOWN";
      message: string;
      /** Whether a later attempt could succeed (network, rate limit) or not (bad credential, bad address). */
      retryable: boolean;
    };

export interface EmailChannel {
  send(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    idempotencyKey: string;
  }): Promise<ChannelSendResult>;
}

export interface ZaloChannel {
  send(input: {
    externalUserId: string;
    text: string;
  }): Promise<ChannelSendResult>;
}

export const notificationErrorCodes = [
  "NOT_FOUND",
  "NOT_CONFIGURED",
  "LINK_EXPIRED",
  "LINK_CONFLICT",
  "INVALID_INPUT",
] as const;

export type NotificationErrorCode = (typeof notificationErrorCodes)[number];

export class NotificationError extends Error {
  readonly code: NotificationErrorCode;

  constructor(code: NotificationErrorCode, message: string) {
    super(message);
    this.name = "NotificationError";
    this.code = code;
  }
}
