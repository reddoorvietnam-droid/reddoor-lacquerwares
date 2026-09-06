import "server-only";

import { Types } from "mongoose";

import type {
  AttachmentFormat,
  AttachmentKind,
  AttachmentStore,
  NewAttachmentRecord,
  StoredAttachment,
} from "@/domains/assistant/attachments/contracts";
import { getAssistantAttachmentModel } from "@/domains/assistant/attachments/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Every method takes the owner's id and puts it in the filter, including the
 * ones that already address documents by `_id`: an id that leaked into a
 * request body must not be enough to read someone else's file. There is no
 * scope parameter and no override on purpose — the Director holds the whole
 * permission catalogue at `all`, so a scope could never say "not even you".
 *
 * An unreadable id is not an error here: an unknown attachment simply is not
 * found, and the caller decides whether a turn that lost its file is worth
 * refusing. Nothing in this file ever puts file content into a thrown message.
 */

type AttachmentDocument = {
  _id: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  conversationId: Types.ObjectId | null;
  fileName: string;
  format: AttachmentFormat;
  kind: AttachmentKind;
  byteSize: number;
  text: string | null;
  image: { mediaType: string; base64: string } | null;
  notes: string[];
  truncated: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function toDto(document: AttachmentDocument): StoredAttachment {
  return {
    id: document._id.toHexString(),
    ownerUserId: document.ownerUserId.toHexString(),
    conversationId: document.conversationId
      ? document.conversationId.toHexString()
      : null,
    fileName: document.fileName,
    format: document.format,
    kind: document.kind,
    byteSize: document.byteSize,
    text: document.text ?? null,
    image: document.image
      ? { mediaType: document.image.mediaType, base64: document.image.base64 }
      : null,
    notes: [...(document.notes ?? [])],
    truncated: document.truncated,
    expiresAt: document.expiresAt,
    createdAt: document.createdAt,
  };
}

export class MongoAttachmentStore implements AttachmentStore {
  async insert(record: NewAttachmentRecord): Promise<StoredAttachment> {
    await connectToDatabase();
    const created = await getAssistantAttachmentModel().create({
      ownerUserId: new Types.ObjectId(record.ownerUserId),
      conversationId: null,
      fileName: record.fileName,
      format: record.format,
      kind: record.kind,
      byteSize: record.byteSize,
      text: record.text,
      image: record.image
        ? { mediaType: record.image.mediaType, base64: record.image.base64 }
        : null,
      notes: [...record.notes],
      truncated: record.truncated,
      expiresAt: record.expiresAt,
    });
    return toDto(created.toObject() as AttachmentDocument);
  }

  async findManyForOwner(
    ownerUserId: string,
    ids: readonly string[],
  ): Promise<StoredAttachment[]> {
    if (!Types.ObjectId.isValid(ownerUserId)) return [];
    const wanted = ids.filter(Types.ObjectId.isValid);
    if (wanted.length === 0) return [];
    await connectToDatabase();
    const documents = await getAssistantAttachmentModel()
      .find({
        _id: { $in: wanted.map((id) => new Types.ObjectId(id)) },
        ownerUserId: new Types.ObjectId(ownerUserId),
      })
      .lean<AttachmentDocument[]>()
      .exec();
    const byId = new Map<string, StoredAttachment>(
      documents.map((document) => [
        document._id.toHexString(),
        toDto(document),
      ]),
    );
    // `$in` returns index order, not list order, and the turn re-sends the
    // files in the order the person attached them.
    return wanted.flatMap((id) => {
      const found = byId.get(id);
      return found ? [found] : [];
    });
  }

  async attachToConversation(
    ownerUserId: string,
    ids: readonly string[],
    conversationId: string,
    expiresAt: Date,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(ownerUserId)) return 0;
    if (!Types.ObjectId.isValid(conversationId)) return 0;
    const wanted = toObjectIds(ids);
    if (wanted.length === 0) return 0;
    await connectToDatabase();
    const result = await getAssistantAttachmentModel()
      .updateMany(
        { _id: { $in: wanted }, ownerUserId: new Types.ObjectId(ownerUserId) },
        {
          $set: {
            conversationId: new Types.ObjectId(conversationId),
            // The retention restarts from the transcript the file now belongs
            // to, so an attachment never outlives — nor predeceases — it.
            expiresAt,
          },
        },
      )
      .exec();
    return result.modifiedCount;
  }

  async dropImages(
    ownerUserId: string,
    ids: readonly string[],
  ): Promise<number> {
    if (!Types.ObjectId.isValid(ownerUserId)) return 0;
    const wanted = toObjectIds(ids);
    if (wanted.length === 0) return 0;
    await connectToDatabase();
    const result = await getAssistantAttachmentModel()
      .updateMany(
        { _id: { $in: wanted }, ownerUserId: new Types.ObjectId(ownerUserId) },
        { $set: { image: null } },
      )
      .exec();
    return result.modifiedCount;
  }

  async slideExpiry(
    ownerUserId: string,
    conversationId: string,
    expiresAt: Date,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(ownerUserId)) return 0;
    if (!Types.ObjectId.isValid(conversationId)) return 0;
    await connectToDatabase();
    const result = await getAssistantAttachmentModel()
      .updateMany(
        {
          ownerUserId: new Types.ObjectId(ownerUserId),
          conversationId: new Types.ObjectId(conversationId),
        },
        { $set: { expiresAt } },
      )
      .exec();
    return result.modifiedCount;
  }

  async deleteForConversation(
    ownerUserId: string,
    conversationId: string,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(ownerUserId)) return 0;
    if (!Types.ObjectId.isValid(conversationId)) return 0;
    await connectToDatabase();
    const result = await getAssistantAttachmentModel()
      .deleteMany({
        ownerUserId: new Types.ObjectId(ownerUserId),
        conversationId: new Types.ObjectId(conversationId),
      })
      .exec();
    return result.deletedCount;
  }
}

export const mongoAttachmentStore = new MongoAttachmentStore();
