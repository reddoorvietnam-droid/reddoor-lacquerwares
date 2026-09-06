import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  channelLinkStatuses,
  notificationChannels,
  notificationKinds,
  notificationStatuses,
} from "@/domains/notifications/contracts";
import { getOrCreateModel } from "@/lib/content/mongoose";

const timestamps = {
  strict: "throw" as const,
  timestamps: true,
  minimize: false,
  versionKey: false as const,
};

/** The reminder outbox. One row per (task, kind, day, channel), unique. */
export const notificationIntentSchema = new Schema(
  {
    kind: { type: String, required: true, enum: notificationKinds },
    channel: { type: String, required: true, enum: notificationChannels },
    recipientUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    dedupeKey: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, required: true, maxlength: 4_000 },
    link: { type: String, trim: true, maxlength: 2_048, default: null },
    resourceType: { type: String, required: true, trim: true, maxlength: 80 },
    resourceId: { type: String, required: true, trim: true, maxlength: 80 },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: notificationStatuses,
      default: "pending",
    },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    nextAttemptAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, maxlength: 1_000, default: null },
    providerMessageId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    redirectedTo: { type: String, trim: true, maxlength: 320, default: null },
    deliveryMode: {
      type: String,
      enum: ["off", "test", "live", null],
      default: null,
    },
    sentAt: { type: Date, default: null },
  },
  timestamps,
);

notificationIntentSchema.index(
  { dedupeKey: 1 },
  { unique: true, name: "notification_intent_dedupe_unique" },
);
notificationIntentSchema.index(
  { status: 1, nextAttemptAt: 1 },
  { name: "notification_intent_queue" },
);
notificationIntentSchema.index(
  { resourceType: 1, resourceId: 1, createdAt: -1 },
  { name: "notification_intent_resource" },
);
notificationIntentSchema.index(
  { createdAt: -1 },
  { name: "notification_intent_recent" },
);

export type NotificationIntentRecord = InferSchemaType<
  typeof notificationIntentSchema
>;

export const getNotificationIntentModel = () =>
  getOrCreateModel("NotificationIntent", notificationIntentSchema);

/** A verified link between a staff account and a chat identity. */
export const channelLinkSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    channel: { type: String, required: true, enum: ["zalo"] },
    externalId: { type: String, trim: true, maxlength: 120, default: null },
    status: {
      type: String,
      required: true,
      enum: channelLinkStatuses,
      default: "pending",
    },
    verificationCode: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },
    verificationExpiresAt: { type: Date, default: null },
    linkedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  timestamps,
);

// One chat identity belongs to at most one active staff account.
channelLinkSchema.index(
  { channel: 1, externalId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "active",
      externalId: { $type: "string" },
    },
    name: "channel_link_external_active_unique",
  },
);
channelLinkSchema.index(
  { userId: 1, channel: 1, status: 1 },
  { name: "channel_link_user" },
);
channelLinkSchema.index(
  { channel: 1, verificationCode: 1, status: 1 },
  { name: "channel_link_code" },
);

export type ChannelLinkRecord = InferSchemaType<typeof channelLinkSchema>;

export const getChannelLinkModel = () =>
  getOrCreateModel("ChannelLink", channelLinkSchema);

/** Processed webhook event ids, kept a week, for replay protection. */
export const processedWebhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true, maxlength: 40 },
    eventId: { type: String, required: true, trim: true, maxlength: 200 },
    receivedAt: { type: Date, required: true },
  },
  { strict: "throw", timestamps: false, minimize: false, versionKey: false },
);

processedWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true, name: "webhook_event_unique" },
);
processedWebhookEventSchema.index(
  { receivedAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60, name: "webhook_event_ttl" },
);

export const getProcessedWebhookEventModel = () =>
  getOrCreateModel("ProcessedWebhookEvent", processedWebhookEventSchema);

/**
 * The Zalo OA credential the platform renews itself: a single row keyed
 * `"oa"`. See `ZaloTokenProvider` for the renewal rules.
 */
export const zaloCredentialSchema = new Schema(
  {
    key: { type: String, required: true, enum: ["oa"] },
    accessToken: { type: String, required: true, maxlength: 2_048 },
    accessTokenExpiresAt: { type: Date, required: true },
    refreshToken: { type: String, required: true, maxlength: 2_048 },
    refreshTokenIssuedAt: { type: Date, required: true },
    connectedAt: { type: Date, required: true },
    connectedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastRefreshAt: { type: Date, default: null },
    lastRefreshError: {
      type: String,
      trim: true,
      maxlength: 1_000,
      default: null,
    },
    refreshCount: { type: Number, required: true, min: 0, default: 0 },
  },
  timestamps,
);

zaloCredentialSchema.index(
  { key: 1 },
  { unique: true, name: "zalo_credential_key_unique" },
);

export type ZaloCredentialRecord = InferSchemaType<typeof zaloCredentialSchema>;

export const getZaloCredentialModel = () =>
  getOrCreateModel("ZaloCredential", zaloCredentialSchema);
