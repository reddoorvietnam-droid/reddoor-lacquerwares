/**
 * Hard limits of assistant attachments. Every cap is a deliberate ceiling:
 * the bytes are read into the request's memory, PDF parsing runs on the
 * request thread (pdfjs disables real workers under Node), and whatever is
 * extracted is re-sent to the model on every tool round of the turn. The
 * numbers below are what keeps one uploaded file from exhausting the
 * function, the model's context, or a free-tier quota.
 *
 * `maxFileBytes` deliberately matches `sheetCheckLimits.maxFileBytes`: a
 * spreadsheet attachment is parsed by the same hardened reader, so raising
 * it here alone would only move the refusal further down.
 */
export const attachmentLimits = {
  /** Upload size per file, bytes. Route handlers reject more before parsing. */
  maxFileBytes: 4 * 1024 * 1024,
  /** Files accepted in one upload request and carried by one chat turn. */
  maxFilesPerTurn: 3,
  /**
   * Total bytes of one upload request, across its files.
   *
   * It matches `maxFileBytes` rather than being a multiple of it because the
   * platform decides this one: Vercel rejects any function request body over
   * 4.5 MB with `FUNCTION_PAYLOAD_TOO_LARGE` before a line of this code runs,
   * so a larger ceiling here would only produce a failure nobody can explain.
   * Three files are still allowed — they just have to fit in one request
   * together, and the browser is told so before it uploads anything.
   */
  maxTotalBytes: 4 * 1024 * 1024,
  /** Characters of extracted text kept per attachment; the rest is cut. */
  maxTextChars: 20_000,
  /** Characters of extracted text kept across one turn's attachments. */
  maxTurnTextChars: 40_000,
  /** Pages read from a PDF; later pages are dropped with a note. */
  maxPdfPages: 40,
  /** Paragraphs/rows read from a Word document before the text is cut. */
  maxDocxBlocks: 4_000,
  /** Data rows rendered from a spreadsheet attachment. */
  maxSheetRows: 200,
  /** Columns rendered from a spreadsheet attachment. */
  maxSheetColumns: 20,
  /** Characters kept per rendered spreadsheet cell. */
  maxSheetCellChars: 120,
  /**
   * Image bytes handed to the model. Smaller than `maxFileBytes` because an
   * image travels base64-encoded (about 4/3 of its size) inside the request
   * body, and unlike text it cannot be summarised on the way in.
   */
  maxImageBytes: 2 * 1024 * 1024,
  /** Uploads per user inside the window. */
  uploadsPerWindow: 20,
  uploadWindowMs: 10 * 60_000,
  /**
   * How long an extracted attachment stays readable before its conversation
   * carries it. Matches the conversation retention so nothing outlives the
   * transcript it belongs to.
   */
  retentionDays: 7,
  /**
   * Characters kept per stored message. The user side is already bounded by
   * the request schema; the assistant side is raw model output, so the
   * transcript clamps it rather than letting a long answer fail the write
   * and throw away a reply the person has already been shown.
   */
  maxMessageChars: 8_000,
  /**
   * Characters kept of a file name. The transcript stores a snapshot of the
   * name beside the message, so the two schemas have to agree; clamping at
   * ingest is what keeps them from drifting apart.
   */
  maxFileNameChars: 200,
  /** Characters kept per reader note, in the record and in its snapshot. */
  maxNoteChars: 500,
  /** Conversations returned by one list read, and the ceiling on a request. */
  conversationPageSize: 20,
  maxConversationPageSize: 50,
  /** Messages returned when a conversation is opened. */
  messagePageSize: 100,
  maxMessagePageSize: 200,
} as const;

export type AttachmentLimits = typeof attachmentLimits;
