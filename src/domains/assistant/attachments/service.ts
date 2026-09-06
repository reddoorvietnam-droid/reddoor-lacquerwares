import {
  attachmentLimits,
  type AttachmentLimits,
} from "@/domains/assistant/attachments/limits";
import {
  AttachmentError,
  toAttachmentDto,
  type AttachmentDto,
  type AttachmentInput,
  type AttachmentStore,
} from "@/domains/assistant/attachments/contracts";
import { extractAttachments } from "@/domains/assistant/attachments/extract";

/**
 * The one gated way an uploaded file becomes something the assistant can
 * read. It parses the bytes here and stores only what the parser produced;
 * the original file is never written anywhere (ADR-005, as for spreadsheet
 * checks), so there is no second copy of a customer's document to protect
 * and nothing to leak when the conversation expires.
 *
 * Ownership is stamped at ingest and every later read is filtered by it.
 * The service takes `now` from the caller so retention is testable without
 * a clock.
 */
export class AttachmentService {
  private readonly store: AttachmentStore;
  private readonly limits: AttachmentLimits;

  constructor(dependencies: {
    store: AttachmentStore;
    limits?: AttachmentLimits;
  }) {
    this.store = dependencies.store;
    this.limits = dependencies.limits ?? attachmentLimits;
  }

  /**
   * Reads the files and records what was read. A failure to parse any one
   * file fails the whole upload: a person who attached three files and got
   * two back would not notice which answer was missing its evidence.
   */
  async ingest(input: {
    ownerUserId: string;
    now: Date;
    files: readonly AttachmentInput[];
  }): Promise<AttachmentDto[]> {
    if (input.files.length === 0) {
      throw new AttachmentError("FILE_EMPTY", "No file was uploaded.");
    }
    const extracted = await extractAttachments(input.files);
    const expiresAt = new Date(
      input.now.getTime() + this.limits.retentionDays * 24 * 60 * 60 * 1_000,
    );

    const stored: AttachmentDto[] = [];
    for (const file of extracted) {
      const record = await this.store.insert({
        ownerUserId: input.ownerUserId,
        fileName: file.fileName,
        format: file.format,
        kind: file.kind,
        byteSize: file.byteSize,
        text: file.text,
        image: file.image,
        notes: file.notes,
        truncated: file.truncated,
        expiresAt,
      });
      stored.push(toAttachmentDto(record));
    }
    return stored;
  }
}
