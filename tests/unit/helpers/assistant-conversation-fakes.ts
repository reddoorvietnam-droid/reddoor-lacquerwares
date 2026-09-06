import type { AttachmentDto } from "@/domains/assistant/attachments/contracts";
import type {
  ConversationDto,
  ConversationListFilter,
  ConversationMessageDto,
  ConversationStore,
  NewConversationMessageRecord,
  NewConversationRecord,
} from "@/domains/assistant/conversations/contracts";

/**
 * An in-memory conversation store for the service tests. Mongoose is never
 * mocked in this project, so the service is tested against a store that
 * keeps the same promises as the Mongo one: owner-only reads and writes, the
 * newest conversation first with the id as the tiebreaker, one message per
 * position, and a `touch` that slides the deadline of every message, not
 * just the header.
 *
 * Nothing here reads the wall clock or the random source: ids come from a
 * counter and every date comes from the caller or from the fixed clock
 * below, so a test can assert exact values.
 */

export const conversationFakeNow = new Date("2026-09-06T02:00:00.000Z");

let sequence = 0;

/** Counter ids in ObjectId shape: ordered, 24 hex characters, repeatable. */
function nextHexId(prefix: string): string {
  sequence += 1;
  return `${prefix}${sequence.toString(16).padStart(24 - prefix.length, "0")}`;
}

/** Lets a test that asserts literal ids start from a known point. */
export function resetConversationFakeIds(): void {
  sequence = 0;
}

/**
 * What the message DTO deliberately leaves out but the store has to keep:
 * whose message it is, and when MongoDB would remove it.
 */
export type FakeStoredMessage = {
  message: ConversationMessageDto;
  ownerUserId: string;
  expiresAt: Date;
};

function copyAttachment(attachment: AttachmentDto): AttachmentDto {
  return { ...attachment, notes: [...attachment.notes] };
}

export class FakeConversationStore implements ConversationStore {
  readonly conversations = new Map<string, ConversationDto>();
  /** Keyed by conversation id, in the order the messages were appended. */
  readonly messages = new Map<string, FakeStoredMessage[]>();
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => conversationFakeNow) {
    this.clock = clock;
  }

  async create(record: NewConversationRecord): Promise<ConversationDto> {
    const id = nextHexId("a");
    const conversation: ConversationDto = {
      id,
      ownerUserId: record.ownerUserId,
      title: record.title,
      messageCount: 0,
      lastMessageAt: record.lastMessageAt,
      expiresAt: record.expiresAt,
      createdAt: this.clock(),
      updatedAt: this.clock(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async findForOwner(
    ownerUserId: string,
    conversationId: string,
  ): Promise<ConversationDto | null> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.ownerUserId !== ownerUserId) return null;
    return conversation;
  }

  async listForOwner(
    ownerUserId: string,
    filter: ConversationListFilter,
  ): Promise<ConversationDto[]> {
    const matching = [...this.conversations.values()]
      .filter((conversation) => conversation.ownerUserId === ownerUserId)
      .sort(
        (left, right) =>
          right.lastMessageAt.getTime() - left.lastMessageAt.getTime() ||
          right.id.localeCompare(left.id),
      );
    const offset = filter.offset ?? 0;
    return matching.slice(offset, offset + (filter.limit ?? 20));
  }

  async deleteForOwner(
    ownerUserId: string,
    conversationId: string,
  ): Promise<boolean> {
    const kept = (this.messages.get(conversationId) ?? []).filter(
      (entry) => entry.ownerUserId !== ownerUserId,
    );
    if (kept.length === 0) this.messages.delete(conversationId);
    else this.messages.set(conversationId, kept);
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.ownerUserId !== ownerUserId) return false;
    this.conversations.delete(conversationId);
    return true;
  }

  async appendMessages(
    records: readonly NewConversationMessageRecord[],
  ): Promise<ConversationMessageDto[]> {
    // Every position is checked before anything is stored, because the Mongo
    // store removes what it inserted when one of the writes is refused: half
    // a turn is never left behind.
    const taken = new Set<string>();
    for (const record of records) {
      const position = `${record.conversationId}#${record.index}`;
      const occupied =
        taken.has(position) ||
        (this.messages.get(record.conversationId) ?? []).some(
          (entry) => entry.message.index === record.index,
        );
      if (occupied) {
        throw new Error(
          `A message already occupies position ${record.index} of conversation ${record.conversationId}.`,
        );
      }
      taken.add(position);
    }

    const created: ConversationMessageDto[] = [];
    for (const record of records) {
      const message: ConversationMessageDto = {
        id: nextHexId("b"),
        conversationId: record.conversationId,
        index: record.index,
        role: record.role,
        text: record.text,
        attachments: record.attachments.map(copyAttachment),
        trace: record.trace.map((entry) => ({ ...entry })),
        sources: record.sources.map((source) => ({ ...source })),
        proposalIds: [...record.proposalIds],
        truncated: record.truncated,
        createdAt: this.clock(),
      };
      const stored = this.messages.get(record.conversationId) ?? [];
      stored.push({
        message,
        ownerUserId: record.ownerUserId,
        expiresAt: record.expiresAt,
      });
      this.messages.set(record.conversationId, stored);
      created.push(message);
    }
    return created;
  }

  async listMessages(
    ownerUserId: string,
    conversationId: string,
    limit: number,
  ): Promise<ConversationMessageDto[]> {
    const stored = (this.messages.get(conversationId) ?? [])
      .filter((entry) => entry.ownerUserId === ownerUserId)
      .sort((left, right) => left.message.index - right.message.index)
      .map((entry) => entry.message);
    // The tail, as the Mongo store reads it: an overgrown transcript loses
    // its opening turns, never its latest ones.
    return limit >= stored.length
      ? stored
      : stored.slice(stored.length - limit);
  }

  async touch(input: {
    ownerUserId: string;
    conversationId: string;
    lastMessageAt: Date;
    expiresAt: Date;
    messageCount: number;
  }): Promise<ConversationDto | null> {
    const conversation = this.conversations.get(input.conversationId);
    if (!conversation || conversation.ownerUserId !== input.ownerUserId) {
      return null;
    }
    const updated: ConversationDto = {
      ...conversation,
      lastMessageAt: input.lastMessageAt,
      expiresAt: input.expiresAt,
      messageCount: input.messageCount,
      updatedAt: this.clock(),
    };
    this.conversations.set(conversation.id, updated);
    // The messages carry their own deadline; leaving them behind would empty
    // the transcript under a conversation that is still listed.
    this.messages.set(
      conversation.id,
      (this.messages.get(conversation.id) ?? []).map((entry) =>
        entry.ownerUserId === input.ownerUserId
          ? { ...entry, expiresAt: input.expiresAt }
          : entry,
      ),
    );
    return updated;
  }
}
