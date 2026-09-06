import {
  AttachmentError,
  type AttachmentFormat,
} from "@/domains/assistant/attachments/contracts";

/**
 * What kind of file the bytes actually are.
 *
 * The magic number decides and the extension must agree — the same rule
 * `detectFileFormat` applies to spreadsheet checks, for the same reason: a
 * file renamed to get past an accept list (a PNG called `.xlsx`, a macro
 * workbook called `.xlsx`) is refused rather than guessed at, and the
 * refusal happens before any parser, zip reader or model ever sees a byte.
 *
 * The extension alone is never enough, but it is still load-bearing in one
 * place: a zip container is both an .xlsx and a .docx, and CSV has no magic
 * number at all. That is why the map below is the single source of truth
 * for both directions — `isAcceptedExtension` answers the accept-list
 * question on the server with exactly the list the detector can satisfy.
 */

/**
 * Extensions the upload accepts, each with the format its bytes must prove.
 * `.txt` reads as CSV: exports shared in the Zalo group are routinely saved
 * that way, and the CSV reader is text-only anyway.
 */
const acceptedExtensions: Readonly<Record<string, AttachmentFormat>> = {
  xlsx: "xlsx",
  xls: "xls",
  csv: "csv",
  txt: "csv",
  pdf: "pdf",
  docx: "docx",
  png: "png",
  jpg: "jpeg",
  jpeg: "jpeg",
  webp: "webp",
  gif: "gif",
};

/** Macro-enabled containers: refused by name, never opened. */
const macroExtensions: readonly string[] = ["xlsm", "xltm", "docm", "dotm"];

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38] as const;
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50] as const;
const UTF16_BOMS: readonly (readonly number[])[] = [
  [0xff, 0xfe],
  [0xfe, 0xff],
];
const TEXT_PROBE_BYTES = 4096;

function hasPrefix(
  bytes: Uint8Array,
  prefix: readonly number[],
  at = 0,
): boolean {
  if (bytes.length < at + prefix.length) return false;
  return prefix.every((value, index) => bytes[at + index] === value);
}

function extensionOf(fileName: string): string {
  const base = fileName.trim().toLowerCase();
  const dot = base.lastIndexOf(".");
  return dot < 0 ? "" : base.slice(dot + 1);
}

/**
 * The extension is repeated back in a refusal so the person knows which of
 * three uploads was wrong. It comes from a name the browser supplied, and
 * the message travels through query strings, so only letters and digits
 * survive and only a plausible length of them.
 */
function safeExtension(extension: string): string {
  const cleaned = extension.replace(/[^a-z0-9]/g, "").slice(0, 10);
  return cleaned === "" ? "(no extension)" : `.${cleaned}`;
}

function looksBinary(bytes: Uint8Array): boolean {
  if (UTF16_BOMS.some((bom) => hasPrefix(bytes, bom))) return false;
  return bytes.subarray(0, TEXT_PROBE_BYTES).includes(0);
}

function rejected(extension: string, expected: string): AttachmentError {
  return new AttachmentError(
    "FILE_TYPE_REJECTED",
    `${expected} does not match ${safeExtension(extension)}.`,
  );
}

/** Whether the accept list would let this name through at all. */
export function isAcceptedExtension(fileName: string): boolean {
  return extensionOf(fileName) in acceptedExtensions;
}

export function detectAttachmentFormat(
  bytes: Uint8Array,
  fileName: string,
): AttachmentFormat {
  const extension = extensionOf(fileName);
  const claimed = acceptedExtensions[extension] ?? null;

  if (hasPrefix(bytes, ZIP_MAGIC)) {
    if (macroExtensions.includes(extension)) {
      throw new AttachmentError(
        "FILE_MACRO_REJECTED",
        "Macro-enabled documents are not accepted.",
      );
    }
    // Both formats are the same container; only the name separates them,
    // and the reader that opens it refuses whatever it cannot understand.
    if (claimed === "xlsx" || claimed === "docx") return claimed;
    throw rejected(extension, "A zip container must be .xlsx or .docx");
  }
  if (hasPrefix(bytes, OLE2_MAGIC)) {
    if (claimed === "xls") return "xls";
    throw rejected(extension, "An OLE2 container must be .xls");
  }
  if (hasPrefix(bytes, PDF_MAGIC)) {
    if (claimed === "pdf") return "pdf";
    throw rejected(extension, "A PDF must be .pdf");
  }
  if (hasPrefix(bytes, PNG_MAGIC)) {
    if (claimed === "png") return "png";
    throw rejected(extension, "A PNG must be .png");
  }
  if (hasPrefix(bytes, JPEG_MAGIC)) {
    if (claimed === "jpeg") return "jpeg";
    throw rejected(extension, "A JPEG must be .jpg or .jpeg");
  }
  if (hasPrefix(bytes, GIF_MAGIC)) {
    if (claimed === "gif") return "gif";
    throw rejected(extension, "A GIF must be .gif");
  }
  if (hasPrefix(bytes, RIFF_MAGIC) && hasPrefix(bytes, WEBP_TAG, 8)) {
    if (claimed === "webp") return "webp";
    throw rejected(extension, "A WebP must be .webp");
  }
  // CSV is the only accepted format with no signature of its own, so the
  // extension carries it — with the one check bytes can still fail.
  if (claimed === "csv" && !looksBinary(bytes)) return "csv";

  throw new AttachmentError(
    "FILE_TYPE_REJECTED",
    "Only spreadsheets, CSV, PDF, Word documents and images are accepted.",
  );
}
