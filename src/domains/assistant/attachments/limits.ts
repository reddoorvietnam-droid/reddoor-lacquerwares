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
  /** Total bytes of one upload request, across its files. */
  maxTotalBytes: 8 * 1024 * 1024,
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
} as const;

export type AttachmentLimits = typeof attachmentLimits;
