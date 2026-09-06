import type {
  AttachmentStore,
  NewAttachmentRecord,
  StoredAttachment,
} from "@/domains/assistant/attachments/contracts";

/**
 * In-memory attachment store for the upload and chat-turn tests. Mongoose is
 * never mocked: the service is exercised against this Map, which mimics the
 * two behaviours the real store's callers depend on — the owner filter that
 * makes another person's id useless, and `findManyForOwner` answering in the
 * order the ids were asked for rather than in storage order.
 *
 * Ids come from a counter, not from a clock or a random source, so a failing
 * assertion always names the same attachment on the next run.
 */

let sequence = 0;

/** A 24-char hex id, the shape `attachmentIdListSchema` accepts. */
export function nextAttachmentId(): string {
  sequence += 1;
  return `a7${String(sequence).padStart(22, "0")}`;
}

export const attachmentOwnerId = "d1d1d1d1d1d1d1d1d1d1d1d1";
export const attachmentUploadedAt = new Date("2026-09-06T02:00:00.000Z");
export const attachmentExpiresAt = new Date("2026-09-13T02:00:00.000Z");

function clone(record: StoredAttachment): StoredAttachment {
  return {
    ...record,
    image: record.image ? { ...record.image } : null,
    notes: [...record.notes],
  };
}

export class FakeAttachmentStore implements AttachmentStore {
  readonly records = new Map<string, StoredAttachment>();
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => attachmentUploadedAt) {
    this.clock = clock;
  }

  /** Puts a record in as if it had already been uploaded. */
  seed(record: Partial<StoredAttachment> = {}): StoredAttachment {
    const stored: StoredAttachment = {
      id: record.id ?? nextAttachmentId(),
      ownerUserId: record.ownerUserId ?? attachmentOwnerId,
      conversationId: record.conversationId ?? null,
      fileName: record.fileName ?? "bang-gia.xlsx",
      format: record.format ?? "xlsx",
      kind: record.kind ?? "spreadsheet",
      byteSize: record.byteSize ?? 2_048,
      text: record.text === undefined ? "Mã | SL\nSP-1 | 10" : record.text,
      image: record.image ?? null,
      notes: [...(record.notes ?? [])],
      truncated: record.truncated ?? false,
      expiresAt: record.expiresAt ?? attachmentExpiresAt,
      createdAt: record.createdAt ?? this.clock(),
    };
    this.records.set(stored.id, clone(stored));
    return stored;
  }

  async insert(record: NewAttachmentRecord): Promise<StoredAttachment> {
    const stored: StoredAttachment = {
      ...record,
      id: nextAttachmentId(),
      conversationId: null,
      image: record.image ? { ...record.image } : null,
      notes: [...record.notes],
      createdAt: this.clock(),
    };
    this.records.set(stored.id, clone(stored));
    return stored;
  }

  async findManyForOwner(
    ownerUserId: string,
    ids: readonly string[],
  ): Promise<StoredAttachment[]> {
    return ids.flatMap((id) => {
      const found = this.records.get(id);
      return found && found.ownerUserId === ownerUserId ? [clone(found)] : [];
    });
  }

  async attachToConversation(
    ownerUserId: string,
    ids: readonly string[],
    conversationId: string,
    expiresAt: Date,
  ): Promise<number> {
    let modified = 0;
    for (const id of ids) {
      const found = this.records.get(id);
      if (!found || found.ownerUserId !== ownerUserId) continue;
      // Counted like Mongo's `modifiedCount`: re-sending the same file to the
      // same conversation changes nothing and reports nothing.
      if (
        found.conversationId !== conversationId ||
        found.expiresAt.getTime() !== expiresAt.getTime()
      ) {
        modified += 1;
      }
      this.records.set(id, { ...found, conversationId, expiresAt });
    }
    return modified;
  }

  async dropImages(
    ownerUserId: string,
    ids: readonly string[],
  ): Promise<number> {
    let modified = 0;
    for (const id of ids) {
      const found = this.records.get(id);
      if (!found || found.ownerUserId !== ownerUserId || !found.image) continue;
      this.records.set(id, { ...found, image: null });
      modified += 1;
    }
    return modified;
  }

  async deleteForConversation(
    ownerUserId: string,
    conversationId: string,
  ): Promise<number> {
    let deleted = 0;
    for (const [id, record] of this.records) {
      if (
        record.ownerUserId !== ownerUserId ||
        record.conversationId !== conversationId
      ) {
        continue;
      }
      this.records.delete(id);
      deleted += 1;
    }
    return deleted;
  }
}
