import "server-only";

import { Types } from "mongoose";

import type {
  AttachmentDto,
  AttachmentFormat,
  AttachmentKind,
} from "@/domains/assistant/attachments/contracts";
import type {
  ConversationDto,
  ConversationListFilter,
  ConversationMessageDto,
  ConversationRole,
  ConversationSource,
  ConversationStore,
  ConversationTraceEntry,
  NewConversationMessageRecord,
  NewConversationRecord,
} from "@/domains/assistant/conversations/contracts";
import {
  getAssistantConversationMessageModel,
  getAssistantConversationModel,
} from "@/domains/assistant/conversations/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Every method here takes the owner id and filters on it. There is no scope
 * parameter, no list-all and no Director override, because a permission
 * scope cannot express "not even the Director" — the Director is seeded with
 * the whole catalogue at `all`, so the restriction has to live in the
 * queries themselves.
 *
 * The header and the messages are two collections with no transaction
 * between them (this repo has none), so the writes that touch both
 * compensate by hand, as the sheet-check store does.
 */

type ConversationDocument = {
  _id: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  title: string;
  messageCount: number;
  lastMessageAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

type MessageAttachmentDocument = {
  id: string;
  fileName: string;
  format: AttachmentFormat;
  kind: AttachmentKind;
  byteSize: number;
  preview: string | null;
  notes: string[];
  truncated: boolean;
  createdAt: Date;
};

type MessageDocument = {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  index: number;
  role: ConversationRole;
  text: string;
  attachments: MessageAttachmentDocument[];
  trace: ConversationTraceEntry[];
  sources: ConversationSource[];
  proposalIds: Types.ObjectId[];
  truncated: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** Used only when a caller asks for a page without saying how large. */
const DEFAULT_LIST_LIMIT = 20;

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function attachmentToDocument(attachment: AttachmentDto) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    format: attachment.format,
    kind: attachment.kind,
    byteSize: attachment.byteSize,
    preview: attachment.preview,
    notes: [...attachment.notes],
    truncated: attachment.truncated,
    createdAt: attachment.createdAt,
  };
}

function attachmentToDto(attachment: MessageAttachmentDocument): AttachmentDto {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    format: attachment.format,
    kind: attachment.kind,
    byteSize: attachment.byteSize,
    preview: attachment.preview ?? null,
    notes: [...(attachment.notes ?? [])],
    truncated: attachment.truncated ?? false,
    createdAt: attachment.createdAt,
  };
}

function traceToDto(entry: ConversationTraceEntry): ConversationTraceEntry {
  return { tool: entry.tool, ok: entry.ok, code: entry.code ?? null };
}

function sourceToDto(source: ConversationSource): ConversationSource {
  return { label: source.label, href: source.href };
}

function toDto(document: ConversationDocument): ConversationDto {
  return {
    id: document._id.toHexString(),
    ownerUserId: document.ownerUserId.toHexString(),
    title: document.title,
    messageCount: document.messageCount,
    lastMessageAt: document.lastMessageAt,
    expiresAt: document.expiresAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function messageToDto(document: MessageDocument): ConversationMessageDto {
  return {
    id: document._id.toHexString(),
    conversationId: document.conversationId.toHexString(),
    index: document.index,
    role: document.role,
    text: document.text,
    attachments: (document.attachments ?? []).map(attachmentToDto),
    trace: (document.trace ?? []).map(traceToDto),
    sources: (document.sources ?? []).map(sourceToDto),
    proposalIds: (document.proposalIds ?? []).map((id) => id.toHexString()),
    truncated: document.truncated ?? false,
    createdAt: document.createdAt,
  };
}

export class MongoConversationStore implements ConversationStore {
  async create(record: NewConversationRecord): Promise<ConversationDto> {
    await connectToDatabase();
    const created = await getAssistantConversationModel().create({
      ownerUserId: new Types.ObjectId(record.ownerUserId),
      title: record.title,
      messageCount: 0,
      lastMessageAt: record.lastMessageAt,
      expiresAt: record.expiresAt,
    });
    return toDto(created.toObject() as ConversationDocument);
  }

  async findForOwner(
    ownerUserId: string,
    conversationId: string,
  ): Promise<ConversationDto | null> {
    if (
      !Types.ObjectId.isValid(ownerUserId) ||
      !Types.ObjectId.isValid(conversationId)
    ) {
      return null;
    }
    await connectToDatabase();
    const document = await getAssistantConversationModel()
      .findOne({
        _id: new Types.ObjectId(conversationId),
        ownerUserId: new Types.ObjectId(ownerUserId),
      })
      .lean<ConversationDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async listForOwner(
    ownerUserId: string,
    filter: ConversationListFilter,
  ): Promise<ConversationDto[]> {
    if (!Types.ObjectId.isValid(ownerUserId)) return [];
    await connectToDatabase();
    const documents = await getAssistantConversationModel()
      .find({ ownerUserId: new Types.ObjectId(ownerUserId) })
      .sort({ lastMessageAt: -1, _id: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? DEFAULT_LIST_LIMIT)
      .lean<ConversationDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async deleteForOwner(
    ownerUserId: string,
    conversationId: string,
  ): Promise<boolean> {
    if (
      !Types.ObjectId.isValid(ownerUserId) ||
      !Types.ObjectId.isValid(conversationId)
    ) {
      return false;
    }
    await connectToDatabase();
    const owner = new Types.ObjectId(ownerUserId);
    const id = new Types.ObjectId(conversationId);
    // Messages go first: the header is the only handle the owner has, so a
    // failure between the two leaves a conversation that can simply be
    // deleted again, rather than messages nobody can reach.
    await getAssistantConversationMessageModel()
      .deleteMany({ conversationId: id, ownerUserId: owner })
      .exec();
    const deleted = await getAssistantConversationModel()
      .deleteOne({ _id: id, ownerUserId: owner })
      .exec();
    return deleted.deletedCount === 1;
  }

  async appendMessages(
    records: readonly NewConversationMessageRecord[],
  ): Promise<ConversationMessageDto[]> {
    if (records.length === 0) return [];
    await connectToDatabase();
    // The ids are minted here so the compensation below can delete exactly
    // what this call inserted; deleting by position would remove whatever
    // already occupied that position and made the insert fail.
    const documents = records.map((record) => ({
      _id: new Types.ObjectId(),
      conversationId: new Types.ObjectId(record.conversationId),
      ownerUserId: new Types.ObjectId(record.ownerUserId),
      index: record.index,
      role: record.role,
      text: record.text,
      attachments: record.attachments.map(attachmentToDocument),
      trace: record.trace.map(traceToDto),
      sources: record.sources.map(sourceToDto),
      proposalIds: toObjectIds(record.proposalIds),
      truncated: record.truncated,
      expiresAt: record.expiresAt,
    }));

    try {
      const created = await getAssistantConversationMessageModel().insertMany(
        documents,
        { ordered: true },
      );
      return created.map((document) =>
        messageToDto(document.toObject() as MessageDocument),
      );
    } catch (error) {
      // Half a turn is worse than none: the question would stand in the
      // transcript with no answer under it, and the next turn would fight
      // the unique position index. The caller retries the whole turn.
      await getAssistantConversationMessageModel()
        .deleteMany({ _id: { $in: documents.map((document) => document._id) } })
        .exec()
        .catch(() => undefined);
      throw error;
    }
  }

  async listMessages(
    ownerUserId: string,
    conversationId: string,
    limit: number,
  ): Promise<ConversationMessageDto[]> {
    if (
      !Types.ObjectId.isValid(ownerUserId) ||
      !Types.ObjectId.isValid(conversationId)
    ) {
      return [];
    }
    await connectToDatabase();
    // Newest first, then reversed into reading order: when a transcript
    // outgrows the window it is the opening turns that fall away, never the
    // ones the model and the reader are working with.
    const documents = await getAssistantConversationMessageModel()
      .find({
        conversationId: new Types.ObjectId(conversationId),
        ownerUserId: new Types.ObjectId(ownerUserId),
      })
      .sort({ index: -1 })
      .limit(limit)
      .lean<MessageDocument[]>()
      .exec();
    return documents.reverse().map(messageToDto);
  }

  async touch(input: {
    ownerUserId: string;
    conversationId: string;
    lastMessageAt: Date;
    expiresAt: Date;
    messageCount: number;
  }): Promise<ConversationDto | null> {
    if (
      !Types.ObjectId.isValid(input.ownerUserId) ||
      !Types.ObjectId.isValid(input.conversationId)
    ) {
      return null;
    }
    await connectToDatabase();
    const owner = new Types.ObjectId(input.ownerUserId);
    const id = new Types.ObjectId(input.conversationId);
    // The header moves first, and only for its owner: a conversation that
    // does not answer to this owner is never reached, so the message write
    // below can only ever land on a transcript this owner holds.
    const document = await getAssistantConversationModel()
      .findOneAndUpdate(
        { _id: id, ownerUserId: owner },
        {
          $set: {
            lastMessageAt: input.lastMessageAt,
            expiresAt: input.expiresAt,
            messageCount: input.messageCount,
          },
          $inc: { revision: 1 },
        },
        { new: true },
      )
      .lean<ConversationDocument>()
      .exec();
    if (!document) return null;

    // A TTL delete does not cascade, so the messages have to be given the
    // same new deadline or the transcript would empty itself underneath a
    // conversation that is still listed.
    await getAssistantConversationMessageModel()
      .updateMany(
        { conversationId: id, ownerUserId: owner },
        { $set: { expiresAt: input.expiresAt } },
      )
      .exec();

    return toDto(document);
  }
}

export const mongoConversationStore = new MongoConversationStore();
