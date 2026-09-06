import "server-only";

import { type InferSchemaType, Schema } from "mongoose";

import {
  attachmentFormats,
  attachmentKinds,
} from "@/domains/assistant/attachments/contracts";
import { conversationRoles } from "@/domains/assistant/conversations/contracts";
import {
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";

/**
 * A conversation is stored as one header document plus one document per
 * message, the same split the sheet checks use: the list of conversations is
 * read constantly and must not drag a whole transcript with it, and a
 * transcript is paged.
 *
 * Both collections carry their own `expiresAt` and their own TTL index. A
 * TTL delete is performed by MongoDB itself and bypasses Mongoose middleware
 * entirely, so a TTL on the header alone would delete the header and leave
 * every message of that conversation behind forever. The retention slides:
 * `touch` re-stamps the header and, in the same turn, every one of its
 * messages, so the seven days run from the last message rather than from
 * creation.
 *
 * What is kept is the transcript as the person saw it. An attachment is
 * stored here as a copy of the chip — file name, size, what the reader had
 * to leave out — never as the original bytes and never as the extracted
 * text, which lives with the attachment and expires on its own schedule.
 */

/**
 * The attachment as the turn showed it. `id` stays a plain string handle:
 * the attachment document it names expires by itself, so this is a snapshot
 * to render, not a reference to follow.
 */
const messageAttachmentSchema = new Schema(
  {
    id: { type: String, required: true, match: /^[a-f0-9]{24}$/ },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    format: { type: String, required: true, enum: attachmentFormats },
    kind: { type: String, required: true, enum: attachmentKinds },
    byteSize: { type: Number, required: true, min: 0 },
    preview: { type: String, maxlength: 500, default: null },
    notes: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      required: true,
      default: [],
    },
    truncated: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

/** Which tools the turn called and whether they answered; never their output. */
const messageTraceSchema = new Schema(
  {
    tool: { type: String, required: true, trim: true, maxlength: 80 },
    ok: { type: Boolean, required: true },
    code: { type: String, trim: true, maxlength: 80, default: null },
  },
  nestedSchemaOptions,
);

const messageSourceSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    href: { type: String, required: true, trim: true, maxlength: 2_048 },
  },
  nestedSchemaOptions,
);

export const assistantConversationSchema = new Schema(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    messageCount: { type: Number, required: true, min: 0, default: 0 },
    lastMessageAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  rootSchemaOptions,
);

// The `_id` tiebreaker is not decoration: two conversations touched inside
// the same millisecond would otherwise page in an unstable order and repeat
// a row on the next page.
assistantConversationSchema.index(
  { ownerUserId: 1, lastMessageAt: -1, _id: -1 },
  { name: "assistant_conversation_by_owner" },
);
// TTL: MongoDB removes the header once `expiresAt` has passed.
assistantConversationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "assistant_conversation_ttl" },
);

/**
 * A message is written once and never updated in place, so it drops the
 * version key and optimistic concurrency that `rootSchemaOptions` sets —
 * the same reasoning as `sheetCheckRowSchema`. Timestamps stay on, unlike
 * that row schema, because the transcript shows when each turn was said.
 *
 * `ownerUserId` is repeated from the header on purpose: every query in the
 * store filters on it, so a message can never be read through a
 * conversation id alone.
 */
export const assistantConversationMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "AssistantConversation",
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    index: { type: Number, required: true, min: 0 },
    role: { type: String, required: true, enum: conversationRoles },
    text: { type: String, required: true, maxlength: 8_000 },
    attachments: {
      type: [messageAttachmentSchema],
      required: true,
      default: [],
    },
    trace: { type: [messageTraceSchema], required: true, default: [] },
    sources: { type: [messageSourceSchema], required: true, default: [] },
    proposalIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "AssistantProposal" }],
      required: true,
      default: [],
    },
    truncated: { type: Boolean, required: true, default: false },
    expiresAt: { type: Date, required: true },
  },
  { strict: "throw", timestamps: true, minimize: false, versionKey: false },
);

// A retry that re-sends the same turn cannot double the transcript: the
// position inside a conversation is the message's identity.
assistantConversationMessageSchema.index(
  { conversationId: 1, index: 1 },
  { unique: true, name: "assistant_conversation_message_position_unique" },
);
// TTL: MongoDB removes each message once `expiresAt` has passed, whether or
// not its header is still there.
assistantConversationMessageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "assistant_conversation_message_ttl" },
);

export type AssistantConversationRecord = InferSchemaType<
  typeof assistantConversationSchema
>;

export type AssistantConversationMessageRecord = InferSchemaType<
  typeof assistantConversationMessageSchema
>;

export const getAssistantConversationModel = () =>
  getOrCreateModel("AssistantConversation", assistantConversationSchema);

export const getAssistantConversationMessageModel = () =>
  getOrCreateModel(
    "AssistantConversationMessage",
    assistantConversationMessageSchema,
  );
