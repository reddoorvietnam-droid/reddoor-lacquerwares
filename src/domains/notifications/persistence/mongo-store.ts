import "server-only";

import { Types } from "mongoose";

import type {
  ChannelLinkDto,
  ChannelLinkStatus,
  ChannelLinkStore,
  DeliveryMode,
  NewNotificationIntent,
  NotificationChannel,
  NotificationIntentDto,
  NotificationIntentStore,
  NotificationKind,
  NotificationStatus,
  WebhookEventStore,
} from "@/domains/notifications/contracts";
import { notificationStatuses } from "@/domains/notifications/contracts";
import {
  getChannelLinkModel,
  getNotificationIntentModel,
  getProcessedWebhookEventModel,
} from "@/domains/notifications/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type IntentDocument = {
  _id: Types.ObjectId;
  kind: NotificationKind;
  channel: NotificationChannel;
  recipientUserId: Types.ObjectId;
  dedupeKey: string;
  subject: string;
  body: string;
  link: string | null;
  resourceType: string;
  resourceId: string;
  businessUnitIds: Types.ObjectId[];
  status: NotificationStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lockedAt: Date | null;
  lastError: string | null;
  providerMessageId: string | null;
  redirectedTo: string | null;
  deliveryMode: DeliveryMode | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function intentToDto(document: IntentDocument): NotificationIntentDto {
  return {
    id: document._id.toHexString(),
    kind: document.kind,
    channel: document.channel,
    recipientUserId: document.recipientUserId.toHexString(),
    dedupeKey: document.dedupeKey,
    subject: document.subject,
    body: document.body,
    link: document.link ?? null,
    resourceType: document.resourceType,
    resourceId: document.resourceId,
    businessUnitIds: document.businessUnitIds.map((id) => id.toHexString()),
    status: document.status,
    attempts: document.attempts,
    nextAttemptAt: document.nextAttemptAt ?? null,
    lastError: document.lastError ?? null,
    providerMessageId: document.providerMessageId ?? null,
    redirectedTo: document.redirectedTo ?? null,
    deliveryMode: document.deliveryMode ?? null,
    sentAt: document.sentAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11_000
  );
}

export class MongoNotificationIntentStore implements NotificationIntentStore {
  async upsertPending(
    record: NewNotificationIntent,
  ): Promise<{ intent: NotificationIntentDto; created: boolean }> {
    await connectToDatabase();
    const Model = getNotificationIntentModel();
    try {
      const document = await Model.create({
        kind: record.kind,
        channel: record.channel,
        recipientUserId: new Types.ObjectId(record.recipientUserId),
        dedupeKey: record.dedupeKey,
        subject: record.subject,
        body: record.body,
        link: record.link,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        businessUnitIds: record.businessUnitIds
          .filter(Types.ObjectId.isValid)
          .map((id) => new Types.ObjectId(id)),
        status: "pending",
        attempts: 0,
        nextAttemptAt: record.nextAttemptAt,
        lockedAt: null,
        lastError: null,
        providerMessageId: null,
        redirectedTo: null,
        deliveryMode: null,
        sentAt: null,
      });
      return {
        intent: intentToDto(document.toObject() as IntentDocument),
        created: true,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await Model.findOne({ dedupeKey: record.dedupeKey })
        .lean<IntentDocument>()
        .exec();
      if (!existing) throw error;
      return { intent: intentToDto(existing), created: false };
    }
  }

  async claimDue(input: {
    now: Date;
    limit: number;
    staleAfterMs: number;
  }): Promise<NotificationIntentDto[]> {
    await connectToDatabase();
    const Model = getNotificationIntentModel();
    const staleBefore = new Date(input.now.getTime() - input.staleAfterMs);
    const claimed: NotificationIntentDto[] = [];
    for (let index = 0; index < input.limit; index += 1) {
      const document = await Model.findOneAndUpdate(
        {
          $or: [
            { status: "pending", nextAttemptAt: { $lte: input.now } },
            { status: "processing", lockedAt: { $lte: staleBefore } },
          ],
        },
        { $set: { status: "processing", lockedAt: input.now } },
        { new: true, sort: { nextAttemptAt: 1 } },
      )
        .lean<IntentDocument>()
        .exec();
      if (!document) break;
      claimed.push(intentToDto(document));
    }
    return claimed;
  }

  async markSent(input: {
    intentId: string;
    providerMessageId: string | null;
    redirectedTo: string | null;
    deliveryMode: DeliveryMode;
    at: Date;
  }): Promise<void> {
    await connectToDatabase();
    await getNotificationIntentModel()
      .updateOne(
        { _id: new Types.ObjectId(input.intentId) },
        {
          $set: {
            status: "sent",
            sentAt: input.at,
            providerMessageId: input.providerMessageId,
            redirectedTo: input.redirectedTo,
            deliveryMode: input.deliveryMode,
            lockedAt: null,
            nextAttemptAt: null,
            lastError: null,
          },
          $inc: { attempts: 1 },
        },
      )
      .exec();
  }

  async markFailed(input: {
    intentId: string;
    error: string;
    retryAt: Date | null;
    at: Date;
  }): Promise<void> {
    await connectToDatabase();
    await getNotificationIntentModel()
      .updateOne(
        { _id: new Types.ObjectId(input.intentId) },
        {
          $set: {
            status: input.retryAt ? "failed" : "deadLetter",
            lastError: input.error.slice(0, 1_000),
            nextAttemptAt: input.retryAt,
            lockedAt: null,
          },
          $inc: { attempts: 1 },
        },
      )
      .exec();
    // A retryable failure goes back to the queue with its backoff.
    if (input.retryAt) {
      await getNotificationIntentModel()
        .updateOne(
          { _id: new Types.ObjectId(input.intentId), status: "failed" },
          { $set: { status: "pending" } },
        )
        .exec();
    }
  }

  async markSkipped(input: {
    intentId: string;
    reason: string;
    deliveryMode: DeliveryMode;
    at: Date;
  }): Promise<void> {
    await connectToDatabase();
    await getNotificationIntentModel()
      .updateOne(
        { _id: new Types.ObjectId(input.intentId) },
        {
          $set: {
            status: "skipped",
            lastError: input.reason.slice(0, 1_000),
            deliveryMode: input.deliveryMode,
            nextAttemptAt: null,
            lockedAt: null,
          },
        },
      )
      .exec();
  }

  async requeue(
    intentId: string,
    at: Date,
  ): Promise<NotificationIntentDto | null> {
    if (!Types.ObjectId.isValid(intentId)) return null;
    await connectToDatabase();
    const document = await getNotificationIntentModel()
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(intentId),
          status: { $in: ["failed", "deadLetter", "skipped"] },
        },
        { $set: { status: "pending", nextAttemptAt: at, lockedAt: null } },
        { new: true },
      )
      .lean<IntentDocument>()
      .exec();
    return document ? intentToDto(document) : null;
  }

  async listForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<NotificationIntentDto[]> {
    await connectToDatabase();
    const documents = await getNotificationIntentModel()
      .find({ resourceType, resourceId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<IntentDocument[]>()
      .exec();
    return documents.map(intentToDto);
  }

  async listRecent(filter: {
    status?: NotificationStatus;
    limit?: number;
  }): Promise<NotificationIntentDto[]> {
    await connectToDatabase();
    const documents = await getNotificationIntentModel()
      .find(filter.status ? { status: filter.status } : {})
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 100)
      .lean<IntentDocument[]>()
      .exec();
    return documents.map(intentToDto);
  }

  async countByStatus(): Promise<Record<NotificationStatus, number>> {
    await connectToDatabase();
    const rows = await getNotificationIntentModel()
      .aggregate<{ _id: NotificationStatus; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .exec();
    const counts = Object.fromEntries(
      notificationStatuses.map((status) => [status, 0]),
    ) as Record<NotificationStatus, number>;
    for (const row of rows) counts[row._id] = row.count;
    return counts;
  }
}

type LinkDocument = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  channel: "zalo";
  externalId: string | null;
  status: ChannelLinkStatus;
  verificationCode: string | null;
  verificationExpiresAt: Date | null;
  linkedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function linkToDto(document: LinkDocument): ChannelLinkDto {
  return {
    id: document._id.toHexString(),
    userId: document.userId.toHexString(),
    channel: document.channel,
    externalId: document.externalId ?? null,
    status: document.status,
    verificationCode: document.verificationCode ?? null,
    verificationExpiresAt: document.verificationExpiresAt ?? null,
    linkedAt: document.linkedAt ?? null,
    revokedAt: document.revokedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export class MongoChannelLinkStore implements ChannelLinkStore {
  async createPending(input: {
    userId: string;
    channel: "zalo";
    verificationCode: string;
    expiresAt: Date;
    at: Date;
  }): Promise<ChannelLinkDto> {
    await connectToDatabase();
    const Model = getChannelLinkModel();
    const userId = new Types.ObjectId(input.userId);
    await Model.deleteMany({
      userId,
      channel: input.channel,
      status: "pending",
    }).exec();
    const document = await Model.create({
      userId,
      channel: input.channel,
      externalId: null,
      status: "pending",
      verificationCode: input.verificationCode,
      verificationExpiresAt: input.expiresAt,
      linkedAt: null,
      revokedAt: null,
    });
    return linkToDto(document.toObject() as LinkDocument);
  }

  async findActive(
    userId: string,
    channel: "zalo",
  ): Promise<ChannelLinkDto | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await connectToDatabase();
    const document = await getChannelLinkModel()
      .findOne({
        userId: new Types.ObjectId(userId),
        channel,
        status: "active",
      })
      .lean<LinkDocument>()
      .exec();
    return document ? linkToDto(document) : null;
  }

  async findPending(
    userId: string,
    channel: "zalo",
    now: Date,
  ): Promise<ChannelLinkDto | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    await connectToDatabase();
    const document = await getChannelLinkModel()
      .findOne({
        userId: new Types.ObjectId(userId),
        channel,
        status: "pending",
        verificationExpiresAt: { $gt: now },
      })
      .sort({ createdAt: -1 })
      .lean<LinkDocument>()
      .exec();
    return document ? linkToDto(document) : null;
  }

  async findActiveByUsers(
    userIds: readonly string[],
    channel: "zalo",
  ): Promise<ReadonlyMap<string, ChannelLinkDto>> {
    const ids = userIds
      .filter(Types.ObjectId.isValid)
      .map((id) => new Types.ObjectId(id));
    if (ids.length === 0) return new Map();
    await connectToDatabase();
    const documents = await getChannelLinkModel()
      .find({ userId: { $in: ids }, channel, status: "active" })
      .lean<LinkDocument[]>()
      .exec();
    return new Map(
      documents.map((document) => [
        document.userId.toHexString(),
        linkToDto(document),
      ]),
    );
  }

  async findPendingByCode(
    code: string,
    now: Date,
    channel: "zalo",
  ): Promise<ChannelLinkDto | null> {
    await connectToDatabase();
    const document = await getChannelLinkModel()
      .findOne({
        channel,
        status: "pending",
        verificationCode: code,
        verificationExpiresAt: { $gt: now },
      })
      .lean<LinkDocument>()
      .exec();
    return document ? linkToDto(document) : null;
  }

  async activate(input: {
    linkId: string;
    externalId: string;
    at: Date;
  }): Promise<ChannelLinkDto | null> {
    if (!Types.ObjectId.isValid(input.linkId)) return null;
    await connectToDatabase();
    const Model = getChannelLinkModel();
    const pending = await Model.findById(input.linkId)
      .lean<LinkDocument>()
      .exec();
    if (!pending || pending.status !== "pending") return null;
    // A new verification replaces the user's previous active link.
    await Model.updateMany(
      { userId: pending.userId, channel: pending.channel, status: "active" },
      { $set: { status: "revoked", revokedAt: input.at } },
    ).exec();
    try {
      const document = await Model.findOneAndUpdate(
        { _id: pending._id, status: "pending" },
        {
          $set: {
            status: "active",
            externalId: input.externalId,
            linkedAt: input.at,
            verificationCode: null,
            verificationExpiresAt: null,
          },
        },
        { new: true },
      )
        .lean<LinkDocument>()
        .exec();
      return document ? linkToDto(document) : null;
    } catch (error) {
      // The external id is already linked to another active account.
      if (isDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async revoke(userId: string, channel: "zalo", at: Date): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await connectToDatabase();
    await getChannelLinkModel()
      .updateMany(
        {
          userId: new Types.ObjectId(userId),
          channel,
          status: { $in: ["active", "pending"] },
        },
        { $set: { status: "revoked", revokedAt: at } },
      )
      .exec();
  }
}

export class MongoWebhookEventStore implements WebhookEventStore {
  async recordOnce(
    provider: string,
    eventId: string,
    at: Date,
  ): Promise<boolean> {
    await connectToDatabase();
    try {
      await getProcessedWebhookEventModel().create({
        provider,
        eventId,
        receivedAt: at,
      });
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  }
}

export const mongoNotificationIntentStore = new MongoNotificationIntentStore();
export const mongoChannelLinkStore = new MongoChannelLinkStore();
export const mongoWebhookEventStore = new MongoWebhookEventStore();
