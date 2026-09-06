import { z } from "zod";

/**
 * What the assistant accepts as an attachment, and what it turns into.
 *
 * The rule the whole module exists to keep: a file the staff member uploads
 * is never handed to the model as an opaque blob to interpret however it
 * likes. It is read here, on the server, by a parser this project controls,
 * capped, and handed over as text inside the same "data, not instructions"
 * envelope tool results use — with one exception, images, which no parser
 * can turn into text and which therefore travel as an image block to a
 * model that can see them.
 *
 * Nothing here stores the original bytes (ADR-005, as for spreadsheet
 * checks): the extracted text is the evidence, and it expires with the
 * conversation that carries it.
 */

/* ------------------------------------------------------------------ */
/* Formats                                                             */
/* ------------------------------------------------------------------ */

/** The exclusive list agreed with the customer: nothing else is accepted. */
export const attachmentFormats = [
  "xlsx",
  "xls",
  "csv",
  "pdf",
  "docx",
  "png",
  "jpeg",
  "webp",
  "gif",
] as const;

export type AttachmentFormat = (typeof attachmentFormats)[number];

/** How a format is read: the branch of the extractor that handles it. */
export const attachmentKinds = [
  "spreadsheet",
  "pdf",
  "document",
  "image",
] as const;

export type AttachmentKind = (typeof attachmentKinds)[number];

export const kindOfFormat: Readonly<Record<AttachmentFormat, AttachmentKind>> =
  {
    xlsx: "spreadsheet",
    xls: "spreadsheet",
    csv: "spreadsheet",
    pdf: "pdf",
    docx: "document",
    png: "image",
    jpeg: "image",
    webp: "image",
    gif: "image",
  };

export const imageMediaTypes: Readonly<Record<string, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Every code is a fixed identifier. None of them ever carries a piece of
 * the file: an error message is shown to a person who may not be allowed
 * to see what the file contains, and it travels through query strings.
 */
export const attachmentErrorCodes = [
  "FILE_TYPE_REJECTED",
  "FILE_TOO_LARGE",
  /** Distinct from size: a sheet whose row count is past what a read allows. */
  "FILE_TOO_MANY_ROWS",
  "FILE_EMPTY",
  "TOO_MANY_FILES",
  "FILE_ENCRYPTED",
  "FILE_MACRO_REJECTED",
  "FILE_ZIP_SUSPICIOUS",
  "FILE_PARSE_FAILED",
  "NO_TEXT_FOUND",
  "IMAGE_NOT_SUPPORTED",
  "NOT_FOUND",
  "PERMISSION_DENIED",
] as const;

export type AttachmentErrorCode = (typeof attachmentErrorCodes)[number];

export class AttachmentError extends Error {
  readonly code: AttachmentErrorCode;

  constructor(code: AttachmentErrorCode, message: string) {
    super(message);
    this.name = "AttachmentError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

/** One file, as the parsers hand it back. */
export type ExtractedAttachment = {
  fileName: string;
  format: AttachmentFormat;
  kind: AttachmentKind;
  byteSize: number;
  /**
   * The readable content, already capped. Null only for an image, whose
   * content the model reads for itself.
   */
  text: string | null;
  /** Base64 payload for a vision block; null for everything else. */
  image: { mediaType: string; base64: string } | null;
  /**
   * What the reader had to leave out (pages beyond the cap, hidden sheets,
   * a truncated cell). Shown to the person and told to the model, so a
   * partial read is never mistaken for a complete one.
   */
  notes: readonly string[];
  truncated: boolean;
};

export type AttachmentInput = {
  bytes: Uint8Array;
  fileName: string;
};

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/**
 * What the browser gets after an upload and sends back with the next chat
 * turn. The extracted text stays on the server; the browser only ever
 * holds the handle and enough metadata to draw the chip.
 */
export type AttachmentDto = {
  id: string;
  fileName: string;
  format: AttachmentFormat;
  kind: AttachmentKind;
  byteSize: number;
  /** First lines of the extracted text, for the "what was read" preview. */
  preview: string | null;
  notes: readonly string[];
  truncated: boolean;
  createdAt: Date;
};

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

export const attachmentIdListSchema = z
  .array(objectIdSchema)
  .max(3)
  .default([]);

/** A stored attachment, as the chat turn reads it back. */
export type StoredAttachment = {
  id: string;
  ownerUserId: string;
  conversationId: string | null;
  fileName: string;
  format: AttachmentFormat;
  kind: AttachmentKind;
  byteSize: number;
  text: string | null;
  /**
   * Image bytes live here only until the turn that carries them is
   * answered; see `AttachmentStore.dropImage`. Persisting them for the life
   * of the conversation would put a copy of a customer's document in a
   * second place and defeat the seven-day promise.
   */
  image: { mediaType: string; base64: string } | null;
  notes: readonly string[];
  truncated: boolean;
  expiresAt: Date;
  createdAt: Date;
};

export type NewAttachmentRecord = Omit<
  StoredAttachment,
  "id" | "createdAt" | "conversationId"
>;

/**
 * Owner-only by construction: every method takes the owner's id and the
 * store filters on it. There is no scope parameter and no override, because
 * a permission scope cannot express "not even the Director" — the Director
 * holds the whole catalogue at `all`.
 */
export interface AttachmentStore {
  insert(record: NewAttachmentRecord): Promise<StoredAttachment>;
  findManyForOwner(
    ownerUserId: string,
    ids: readonly string[],
  ): Promise<StoredAttachment[]>;
  attachToConversation(
    ownerUserId: string,
    ids: readonly string[],
    conversationId: string,
    expiresAt: Date,
  ): Promise<number>;
  /** Clears the image payload once its turn has been answered. */
  dropImages(ownerUserId: string, ids: readonly string[]): Promise<number>;
  /**
   * Moves every attachment of a conversation to the transcript's new expiry.
   * Without it a file attached on day 0 would be deleted on day 7 out from
   * under a conversation whose own window kept sliding, leaving a chip in
   * the transcript with nothing behind it.
   */
  slideExpiry(
    ownerUserId: string,
    conversationId: string,
    expiresAt: Date,
  ): Promise<number>;
  deleteForConversation(
    ownerUserId: string,
    conversationId: string,
  ): Promise<number>;
}

/** The first lines of extracted text, for the browser's preview chip. */
export function previewOf(text: string | null, maxChars = 240): string | null {
  if (!text) return null;
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxChars) return collapsed || null;
  return `${collapsed.slice(0, maxChars)}…`;
}

export function toAttachmentDto(record: StoredAttachment): AttachmentDto {
  return {
    id: record.id,
    fileName: record.fileName,
    format: record.format,
    kind: record.kind,
    byteSize: record.byteSize,
    preview: previewOf(record.text),
    notes: [...record.notes],
    truncated: record.truncated,
    createdAt: record.createdAt,
  };
}
