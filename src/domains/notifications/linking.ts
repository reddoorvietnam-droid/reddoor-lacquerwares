import { randomInt } from "node:crypto";

import type { AuditRepository } from "@/domains/audit/contracts";
import type {
  ChannelLinkDto,
  ChannelLinkStore,
  NotificationIntentStore,
} from "@/domains/notifications/contracts";
import { NotificationError } from "@/domains/notifications/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

/**
 * Linking a staff account to a Zalo identity, server-controlled.
 *
 * The staff member asks for a code in the portal (signed in, so the user
 * id is the session's). They send that code to the Official Account from
 * their own Zalo. The webhook receives the message with Zalo's user id for
 * the sender; the code proves which portal account it belongs to. A
 * display name or a self-declared phone number never takes part: only the
 * provider's sender id, only through a code that was issued to a signed-in
 * user, only while the code is fresh.
 */

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeTtlMs = 15 * 60_000;

export function generateVerificationCode(): string {
  let code = "RD-";
  for (let index = 0; index < 6; index += 1) {
    code += codeAlphabet[randomInt(codeAlphabet.length)];
  }
  return code;
}

export type ChannelLinkServiceDependencies = {
  links: ChannelLinkStore;
  intents: NotificationIntentStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export class ChannelLinkService {
  private readonly dependencies: ChannelLinkServiceDependencies;

  constructor(dependencies: ChannelLinkServiceDependencies) {
    this.dependencies = dependencies;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const holds = context.permissions.some(
      (candidate) => candidate.permission === permission,
    );
    if (!holds || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  /** Issues a fresh code for the signed-in user; never for another user. */
  async startZaloLink(context: AccessContext): Promise<ChannelLinkDto> {
    this.assertHolds(context, "notifications.manageOwnChannels");
    const at = this.now();
    const link = await this.dependencies.links.createPending({
      userId: context.userId,
      channel: "zalo",
      verificationCode: generateVerificationCode(),
      expiresAt: new Date(at.getTime() + codeTtlMs),
      at,
    });
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "notifications.zaloLinkStarted",
      resourceType: "channelLink",
      resourceId: link.id,
      requestId: context.requestId,
      occurredAt: at,
    });
    return link;
  }

  async revokeZaloLink(context: AccessContext): Promise<void> {
    this.assertHolds(context, "notifications.manageOwnChannels");
    const at = this.now();
    await this.dependencies.links.revoke(context.userId, "zalo", at);
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "notifications.zaloLinkRevoked",
      resourceType: "channelLink",
      resourceId: context.userId,
      requestId: context.requestId,
      occurredAt: at,
    });
  }

  async currentZaloLink(userId: string): Promise<ChannelLinkDto | null> {
    return this.dependencies.links.findActive(userId, "zalo");
  }

  /**
   * Called by the webhook with the provider's sender id and the code the
   * sender typed. Returns the activated link, or the reason it was not.
   */
  async completeZaloLink(input: {
    code: string;
    externalId: string;
    requestId: string;
  }): Promise<
    | { ok: true; link: ChannelLinkDto }
    | { ok: false; reason: "LINK_EXPIRED" | "LINK_CONFLICT" }
  > {
    const at = this.now();
    const pending = await this.dependencies.links.findPendingByCode(
      input.code,
      at,
      "zalo",
    );
    if (!pending) return { ok: false, reason: "LINK_EXPIRED" };
    const activated = await this.dependencies.links.activate({
      linkId: pending.id,
      externalId: input.externalId,
      at,
    });
    if (!activated) return { ok: false, reason: "LINK_CONFLICT" };
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: pending.userId },
      action: "notifications.zaloLinkVerified",
      resourceType: "channelLink",
      resourceId: activated.id,
      requestId: input.requestId,
      metadata: { channel: "zalo" },
      occurredAt: at,
    });
    return { ok: true, link: activated };
  }

  /** Manual retry of a failed reminder, held by `notifications.retry`. */
  async retryIntent(context: AccessContext, intentId: string): Promise<void> {
    this.assertHolds(context, "notifications.retry");
    const at = this.now();
    const intent = await this.dependencies.intents.requeue(intentId, at);
    if (!intent) {
      throw new NotificationError("NOT_FOUND", "Nothing to retry.");
    }
    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "notifications.intentRequeued",
      resourceType: "notificationIntent",
      resourceId: intent.id,
      businessUnitIds: intent.businessUnitIds,
      requestId: context.requestId,
      occurredAt: at,
    });
  }
}
