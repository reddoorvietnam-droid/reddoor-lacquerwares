import "server-only";

import {
  toAttachmentDto,
  type AttachmentStore,
  type StoredAttachment,
} from "@/domains/assistant/attachments/contracts";
import { attachmentLimits } from "@/domains/assistant/attachments/limits";
import {
  ConversationError,
  titleFrom,
  type ConversationDto,
  type ConversationListFilter,
  type ConversationMessageDto,
  type ConversationSource,
  type ConversationStore,
  type ConversationTraceEntry,
  type NewConversationMessageRecord,
} from "@/domains/assistant/conversations/contracts";

/**
 * The transcript, as the assistant keeps it: one method per thing the chat
 * page does, and nothing else.
 *
 * The service is deliberately blind to who is asking. It never reads a
 * session, never calls a permission guard and never touches mongoose — every
 * method takes the owner's id and hands it to a store that filters on it, so
 * there is no path that reaches a conversation by knowing its id alone, and
 * no scope a Director could hold that would widen the query. A conversation
 * belonging to someone else is reported as NOT_FOUND, exactly like one that
 * has expired: which of the two it is, is not the caller's business.
 *
 * Time is a parameter, never a fact this file reads. `now` arrives with the
 * turn, so the retention window is stamped from the request's own clock and
 * a test can step a week forward without waiting for one.
 */

const DAY_MS = 86_400_000;

/**
 * The window the customer agreed to is clamped rather than trusted: the
 * number reaches the constructor from configuration, and a mistyped one
 * would otherwise either delete a live conversation or keep it forever.
 */
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 90;

/** Only reached by a turn that carries neither a question nor a file name. */
const UNTITLED_CONVERSATION = "Hội thoại";

export type ConversationServiceDependencies = {
  store: ConversationStore;
  attachments: AttachmentStore;
  retentionDays?: number;
};

export type RecordTurnInput = {
  ownerUserId: string;
  /** Null starts a conversation; an id continues one the owner holds. */
  conversationId: string | null;
  now: Date;
  userText: string;
  attachmentIds: readonly string[];
  assistantText: string;
  trace: readonly ConversationTraceEntry[];
  sources: readonly ConversationSource[];
  proposalIds: readonly string[];
  truncated: boolean;
};

export type RecordedTurn = {
  conversation: ConversationDto;
  userMessage: ConversationMessageDto;
  assistantMessage: ConversationMessageDto;
};

function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}

function clampRetention(days: number | undefined): number {
  if (days === undefined || !Number.isFinite(days)) {
    return attachmentLimits.retentionDays;
  }
  return Math.min(
    MAX_RETENTION_DAYS,
    Math.max(MIN_RETENTION_DAYS, Math.trunc(days)),
  );
}

export class ConversationService {
  private readonly dependencies: ConversationServiceDependencies;
  private readonly retentionDays: number;

  constructor(dependencies: ConversationServiceDependencies) {
    this.dependencies = dependencies;
    this.retentionDays = clampRetention(dependencies.retentionDays);
  }

  async list(
    ownerUserId: string,
    filter: ConversationListFilter = {},
  ): Promise<ConversationDto[]> {
    return this.dependencies.store.listForOwner(ownerUserId, filter);
  }

  async read(
    ownerUserId: string,
    conversationId: string,
    limit: number,
  ): Promise<{
    conversation: ConversationDto;
    messages: ConversationMessageDto[];
  }> {
    const conversation = await this.dependencies.store.findForOwner(
      ownerUserId,
      conversationId,
    );
    if (!conversation) {
      throw new ConversationError("NOT_FOUND", "Conversation not found.");
    }
    const messages = await this.dependencies.store.listMessages(
      ownerUserId,
      conversationId,
      limit,
    );
    return { conversation, messages };
  }

  /**
   * The header goes first: deleting it is the ownership check, so nothing is
   * written for an id the caller does not hold. If the attachment delete
   * then fails, what survives is extracted text under its own TTL rather
   * than a readable transcript — the repo has no transactions, and this is
   * the compensation order that errs on the safe side.
   */
  async remove(ownerUserId: string, conversationId: string): Promise<void> {
    const deleted = await this.dependencies.store.deleteForOwner(
      ownerUserId,
      conversationId,
    );
    if (!deleted) {
      throw new ConversationError("NOT_FOUND", "Conversation not found.");
    }
    await this.dependencies.attachments.deleteForConversation(
      ownerUserId,
      conversationId,
    );
  }

  /**
   * Writes one exchange: the question and the answer, in that order, at the
   * next two indexes. The attachments are resolved before anything is
   * written, so a turn naming a file the person may not read leaves no
   * half-started conversation behind.
   */
  async recordTurn(input: RecordTurnInput): Promise<RecordedTurn> {
    const expiresAt = addDays(input.now, this.retentionDays);
    const attachments = await this.resolveAttachments(
      input.ownerUserId,
      input.attachmentIds,
    );

    const conversation = await this.openConversation(
      input,
      attachments,
      expiresAt,
    );
    const index = conversation.messageCount;
    const shared = {
      conversationId: conversation.id,
      ownerUserId: input.ownerUserId,
      expiresAt,
    };
    const records: NewConversationMessageRecord[] = [
      {
        ...shared,
        index,
        role: "user",
        text: input.userText,
        attachments: attachments.map(toAttachmentDto),
        trace: [],
        sources: [],
        proposalIds: [],
        truncated: false,
      },
      {
        ...shared,
        index: index + 1,
        role: "assistant",
        text: input.assistantText,
        attachments: [],
        trace: [...input.trace],
        sources: [...input.sources],
        proposalIds: [...input.proposalIds],
        truncated: input.truncated,
      },
    ];
    const appended = await this.dependencies.store.appendMessages(records);
    const userMessage = appended[0];
    const assistantMessage = appended[1];
    if (!userMessage || !assistantMessage) {
      throw new ConversationError(
        "UNAVAILABLE",
        "The transcript could not be written.",
      );
    }

    if (attachments.length > 0) {
      const ids = attachments.map((attachment) => attachment.id);
      await this.dependencies.attachments.attachToConversation(
        input.ownerUserId,
        ids,
        conversation.id,
        expiresAt,
      );
      // The image bytes were needed by the turn that carried them and by
      // nothing after it; what the transcript keeps is the extracted text
      // and the reader's notes.
      await this.dependencies.attachments.dropImages(input.ownerUserId, ids);
    }

    const touched = await this.dependencies.store.touch({
      ownerUserId: input.ownerUserId,
      conversationId: conversation.id,
      lastMessageAt: input.now,
      expiresAt,
      messageCount: index + 2,
    });
    return {
      // A null touch means the conversation expired or was deleted while the
      // model was still answering. Both messages are written and expire with
      // it, so the answer is handed back instead of being thrown away.
      conversation: touched ?? {
        ...conversation,
        messageCount: index + 2,
        lastMessageAt: input.now,
        expiresAt,
      },
      userMessage,
      assistantMessage,
    };
  }

  /**
   * Reads the attachments a turn names, owner-filtered, and refuses the turn
   * when any of them is missing: answering with fewer files than the person
   * attached reads as an answer about all of them.
   */
  async resolveAttachments(
    ownerUserId: string,
    ids: readonly string[],
  ): Promise<StoredAttachment[]> {
    const wanted = [...new Set(ids)];
    if (wanted.length === 0) return [];
    const found = await this.dependencies.attachments.findManyForOwner(
      ownerUserId,
      wanted,
    );
    const byId = new Map(found.map((record) => [record.id, record]));
    return wanted.map((id) => {
      const record = byId.get(id);
      if (!record) {
        throw new ConversationError(
          "NOT_FOUND",
          "An attachment is no longer available.",
        );
      }
      return record;
    });
  }

  private async openConversation(
    input: RecordTurnInput,
    attachments: readonly StoredAttachment[],
    expiresAt: Date,
  ): Promise<ConversationDto> {
    if (input.conversationId === null) {
      return this.dependencies.store.create({
        ownerUserId: input.ownerUserId,
        // The opening question names the conversation; a turn that carries
        // only files borrows the first file's name instead.
        title: titleFrom(
          input.userText,
          attachments[0]?.fileName ?? UNTITLED_CONVERSATION,
        ),
        lastMessageAt: input.now,
        expiresAt,
      });
    }
    const existing = await this.dependencies.store.findForOwner(
      input.ownerUserId,
      input.conversationId,
    );
    // Starting a fresh conversation here would answer into a transcript the
    // person cannot see, and hide from them that theirs is gone.
    if (!existing) {
      throw new ConversationError("NOT_FOUND", "Conversation not found.");
    }
    return existing;
  }
}
