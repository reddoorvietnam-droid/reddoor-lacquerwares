import { z } from "zod";

import type { AttachmentDto } from "@/domains/assistant/attachments/contracts";

/**
 * Stored assistant conversations.
 *
 * This reverses an earlier decision (docs/AI_ASSISTANT.md §4 used to read
 * "no server-side conversation storage"), so the two rules that replace it
 * are written into the types themselves:
 *
 * 1. **Owner only.** Every store method takes the owner's id and filters on
 *    it. There is no scope parameter, no list-all, and no Director
 *    override — a permission scope cannot express "not even the Director",
 *    because the Director is seeded with the entire catalogue at `all`, so
 *    the restriction has to be structural.
 * 2. **Seven days, sliding.** The header and every message carry their own
 *    `expiresAt`, re-stamped on each turn, and MongoDB deletes them. A TTL
 *    delete bypasses Mongoose middleware, so each collection has to expire
 *    itself rather than rely on a cascade from the header.
 *
 * What is stored is the transcript, not the model's working state: tool
 * blocks are never persisted, and an attachment is kept as its extracted
 * text, never as the original file.
 */

export const conversationRoles = ["user", "assistant"] as const;
export type ConversationRole = (typeof conversationRoles)[number];

/** A tool the turn called, as the transcript remembers it. */
export type ConversationTraceEntry = {
  tool: string;
  ok: boolean;
  code: string | null;
};

export type ConversationSource = { label: string; href: string };

export type ConversationMessageDto = {
  id: string;
  conversationId: string;
  index: number;
  role: ConversationRole;
  text: string;
  /** Attachments carried by a user turn; empty for an assistant turn. */
  attachments: readonly AttachmentDto[];
  trace: readonly ConversationTraceEntry[];
  sources: readonly ConversationSource[];
  proposalIds: readonly string[];
  truncated: boolean;
  createdAt: Date;
};

export type ConversationDto = {
  id: string;
  ownerUserId: string;
  /** Taken from the first user turn; never written by the model. */
  title: string;
  messageCount: number;
  lastMessageAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type NewConversationRecord = {
  ownerUserId: string;
  title: string;
  lastMessageAt: Date;
  expiresAt: Date;
};

export type NewConversationMessageRecord = {
  conversationId: string;
  ownerUserId: string;
  index: number;
  role: ConversationRole;
  text: string;
  attachments: readonly AttachmentDto[];
  trace: readonly ConversationTraceEntry[];
  sources: readonly ConversationSource[];
  proposalIds: readonly string[];
  truncated: boolean;
  expiresAt: Date;
};

export type ConversationListFilter = {
  limit?: number;
  offset?: number;
};

export interface ConversationStore {
  create(record: NewConversationRecord): Promise<ConversationDto>;
  findForOwner(
    ownerUserId: string,
    conversationId: string,
  ): Promise<ConversationDto | null>;
  listForOwner(
    ownerUserId: string,
    filter: ConversationListFilter,
  ): Promise<ConversationDto[]>;
  deleteForOwner(ownerUserId: string, conversationId: string): Promise<boolean>;
  appendMessages(
    records: readonly NewConversationMessageRecord[],
  ): Promise<ConversationMessageDto[]>;
  listMessages(
    ownerUserId: string,
    conversationId: string,
    limit: number,
  ): Promise<ConversationMessageDto[]>;
  /** Slides the retention window and records the new tail of the transcript. */
  touch(input: {
    ownerUserId: string;
    conversationId: string;
    lastMessageAt: Date;
    expiresAt: Date;
    messageCount: number;
  }): Promise<ConversationDto | null>;
}

export const conversationErrorCodes = [
  "NOT_FOUND",
  "INVALID_INPUT",
  "UNAVAILABLE",
] as const;

export type ConversationErrorCode = (typeof conversationErrorCodes)[number];

export class ConversationError extends Error {
  readonly code: ConversationErrorCode;

  constructor(code: ConversationErrorCode, message: string) {
    super(message);
    this.name = "ConversationError";
    this.code = code;
  }
}

export const conversationIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

/** The title shown in the list: the opening question, trimmed to one line. */
export function titleFrom(message: string, fallback: string): string {
  const line = message.replace(/\s+/g, " ").trim();
  if (!line) return fallback;
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}
