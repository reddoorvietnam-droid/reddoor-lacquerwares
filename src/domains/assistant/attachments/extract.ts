import "server-only";

import {
  AttachmentError,
  imageMediaTypes,
  kindOfFormat,
  type AttachmentInput,
  type ExtractedAttachment,
} from "@/domains/assistant/attachments/contracts";
import { detectAttachmentFormat } from "@/domains/assistant/attachments/detect";
import { extractDocxText } from "@/domains/assistant/attachments/docx";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";
import { extractPdfText } from "@/domains/assistant/attachments/pdf";
import { extractSheetText } from "@/domains/assistant/attachments/spreadsheet";

/**
 * The one door every uploaded file goes through.
 *
 * Order matters here and is the whole design: size before type, type before
 * parser. A file is refused for being empty or too big without anything
 * having looked at its contents, then typed by magic number, and only then
 * handed to the reader that format deserves. Nothing downstream chooses a
 * parser from a file name.
 *
 * Images are the exception the module exists to make explicit: no parser
 * can turn a photograph of a delivery note into text, so the bytes travel
 * to the model as an image block. They carry a tighter byte cap than every
 * other format because base64 inflates them by a third inside a request
 * body that also has to carry the conversation.
 *
 * The turn-wide text budget is enforced across files, not per file: three
 * attachments each within their own cap can still add up to more context
 * than a turn should spend, so later attachments are trimmed and told so.
 *
 * Node-only: never import this, or anything that imports it, from a client
 * component.
 */

type ReadText = { text: string; notes: string[]; truncated: boolean };

async function readAsText(
  bytes: Uint8Array,
  fileName: string,
  kind: "spreadsheet" | "document" | "pdf",
): Promise<ReadText> {
  if (kind === "spreadsheet") return extractSheetText(bytes, fileName);
  if (kind === "document") return extractDocxText(bytes);
  return extractPdfText(bytes);
}

/**
 * The name is clamped here, once, because it is copied twice more — into
 * the attachment record and into the snapshot the transcript keeps beside
 * the message — and a name longer than either schema allows would fail the
 * write of a turn whose answer has already been produced and paid for.
 */
function clampFileName(fileName: string): string {
  const trimmed = fileName.trim() || "file";
  if (trimmed.length <= limits.maxFileNameChars) return trimmed;
  // The extension has to survive: it is half of the format decision, and a
  // name cut from the left would arrive at the detector as an unknown type.
  const dot = trimmed.lastIndexOf(".");
  const extension = dot > 0 ? trimmed.slice(dot) : "";
  const keep = limits.maxFileNameChars - extension.length;
  // An extension long enough to fill the budget on its own is not a real
  // one; cutting the whole name is then the only way to stay inside the cap.
  return keep > 0
    ? `${trimmed.slice(0, keep)}${extension}`
    : trimmed.slice(0, limits.maxFileNameChars);
}

function clampNotes(notes: readonly string[]): string[] {
  return notes.map((note) =>
    note.length > limits.maxNoteChars
      ? note.slice(0, limits.maxNoteChars)
      : note,
  );
}

export async function extractAttachment(
  input: AttachmentInput,
): Promise<ExtractedAttachment> {
  const { bytes } = input;
  const fileName = clampFileName(input.fileName);
  const byteSize = bytes.length;
  if (byteSize === 0) {
    throw new AttachmentError("FILE_EMPTY", "The file carries no bytes.");
  }
  if (byteSize > limits.maxFileBytes) {
    throw new AttachmentError(
      "FILE_TOO_LARGE",
      `${byteSize} bytes exceed the ${limits.maxFileBytes}-byte limit.`,
    );
  }

  const format = detectAttachmentFormat(bytes, fileName);
  const kind = kindOfFormat[format];

  if (kind === "image") {
    if (byteSize > limits.maxImageBytes) {
      throw new AttachmentError(
        "FILE_TOO_LARGE",
        `${byteSize} bytes exceed the ${limits.maxImageBytes}-byte image limit.`,
      );
    }
    const mediaType = imageMediaTypes[format];
    if (!mediaType) {
      throw new AttachmentError(
        "IMAGE_NOT_SUPPORTED",
        "That image format cannot be shown to the model.",
      );
    }
    return {
      fileName,
      format,
      kind,
      byteSize,
      text: null,
      image: { mediaType, base64: Buffer.from(bytes).toString("base64") },
      notes: [],
      truncated: false,
    };
  }

  const read = await readAsText(bytes, fileName, kind);
  return {
    fileName,
    format,
    kind,
    byteSize,
    text: read.text,
    image: null,
    notes: clampNotes(read.notes),
    truncated: read.truncated,
  };
}

export async function extractAttachments(
  inputs: readonly AttachmentInput[],
): Promise<ExtractedAttachment[]> {
  if (inputs.length > limits.maxFilesPerTurn) {
    throw new AttachmentError(
      "TOO_MANY_FILES",
      `${inputs.length} files exceed the ${limits.maxFilesPerTurn} accepted in one turn.`,
    );
  }
  const totalBytes = inputs.reduce((sum, input) => sum + input.bytes.length, 0);
  if (totalBytes > limits.maxTotalBytes) {
    throw new AttachmentError(
      "FILE_TOO_LARGE",
      `${totalBytes} bytes exceed the ${limits.maxTotalBytes}-byte total limit.`,
    );
  }

  const extracted: ExtractedAttachment[] = [];
  let budget: number = limits.maxTurnTextChars;
  for (const input of inputs) {
    // Sequentially, not in parallel: a PDF read holds a whole document and
    // its fonts in the request's memory, and three at once is three times
    // the peak for no gain on a single-threaded parse.
    const one = await extractAttachment(input);
    if (one.text === null || one.text.length <= budget) {
      budget -= one.text?.length ?? 0;
      extracted.push(one);
      continue;
    }
    extracted.push({
      ...one,
      text: one.text.slice(0, Math.max(budget, 0)),
      notes: [
        ...one.notes,
        `Đã cắt bớt vì tổng văn bản đính kèm của lượt này vượt ${limits.maxTurnTextChars} ký tự.`,
      ],
      truncated: true,
    });
    budget = 0;
  }
  return extracted;
}
