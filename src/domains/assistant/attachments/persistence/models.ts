import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  attachmentFormats,
  attachmentKinds,
} from "@/domains/assistant/attachments/contracts";
import {
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * One document per uploaded attachment, holding what the extractor read and
 * never the original bytes (ADR-005, as for spreadsheet checks): the file is
 * parsed in the request that received it and then dropped.
 *
 * The document belongs to the person who uploaded it, not to a conversation:
 * it exists from the upload, before any turn has been sent, and is bound to a
 * conversation only when a turn carries it. `expiresAt` is therefore set at
 * upload already, so a file nobody ever sent still disappears on its own.
 *
 * Owner-only is enforced in the store, by filtering on `ownerUserId` in every
 * query — deliberately NOT by a permission scope, which cannot express "not
 * even the Director".
 */

const attachmentImageSchema = new Schema(
  {
    mediaType: { type: String, required: true, trim: true, maxlength: 40 },
    /**
     * Emptied by `dropImages` as soon as the turn carrying it has been
     * answered: the payload is here only so the tool rounds of one turn can
     * re-send the same image, never as storage. The cap is explicit because
     * base64 inflates an image by about a third — a 2 MB picture lands near
     * 2.7 MB — and a BSON document may not exceed 16 MB.
     */
    base64: { type: String, required: true, maxlength: 4_000_000 },
  },
  nestedSchemaOptions,
);

export const assistantAttachmentSchema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AssistantConversation",
      default: null,
    },
    fileName: { type: String, required: true, trim: true, maxlength: 300 },
    format: { type: String, required: true, enum: attachmentFormats },
    kind: { type: String, required: true, enum: attachmentKinds },
    byteSize: { type: Number, required: true, min: 0 },
    text: { type: String, default: null, maxlength: 20_000 },
    image: { type: attachmentImageSchema, default: null },
    notes: { type: [String], required: true, default: [] },
    truncated: { type: Boolean, required: true, default: false },
    expiresAt: { type: Date, required: true },
  },
  rootSchemaOptions,
);

assistantAttachmentSchema.index(
  { ownerUserId: 1, createdAt: -1 },
  { name: "assistant_attachment_by_owner" },
);
// TTL: MongoDB removes the extracted attachment once `expiresAt` has passed.
assistantAttachmentSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "assistant_attachment_ttl" },
);

export type AssistantAttachmentRecord = InferSchemaType<
  typeof assistantAttachmentSchema
>;

export const getAssistantAttachmentModel = () =>
  getOrCreateModel("AssistantAttachment", assistantAttachmentSchema);
