import "server-only";

import { AttachmentError } from "@/domains/assistant/attachments/contracts";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";

/**
 * The text layer of a PDF, read with pdf.js on the server.
 *
 * Three things about running pdf.js under Node decide the shape of this
 * file, and all three were found by running it:
 *
 * 1. The modern build reaches for `DOMMatrix` on load and dies with a
 *    ReferenceError; only `legacy/build/pdf.mjs` survives outside a
 *    browser. It is imported inside the function, never at the top of the
 *    module — it is a large library, and a conversation that attaches a
 *    spreadsheet should not pay to load a PDF engine.
 * 2. The worker specifier inside that build is annotated `webpackIgnore`,
 *    so under the bundler it would be resolved relative to the emitted
 *    chunk and never found. Deriving the package directory instead does
 *    not work either: under Turbopack `createRequire(...).resolve` answers
 *    with a virtual path ("[externals]\pdfjs-dist\package.json [external] …"),
 *    and pdf.js then reports "Setting up fake worker failed". The fix is to
 *    hand it the worker module itself — pdf.js looks for `globalThis.pdfjsWorker`
 *    before it ever reads `workerSrc`, and a static import is something the
 *    bundler can resolve. No file path is computed anywhere in this file.
 * 3. Teardown lives on the loading task: `doc.destroy` does not exist.
 *
 * No decoder-asset URLs are passed for the same reason. They are only
 * needed to draw glyphs; the text layer is read from the page's own
 * encoding and `toUnicode` map, so extraction is unaffected.
 *
 * A scanned PDF has no text layer at all. That is not a parse failure and
 * must not be reported as one: it is answered with NO_TEXT_FOUND so the
 * caller can tell the person to send a photograph of the page instead,
 * which the model can actually read.
 */

/** Set once per process, before the first document is opened. */
let workerConfigured = false;

async function configureWorker(): Promise<void> {
  if (workerConfigured) return;
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  workerConfigured = true;
}

function failed(error: unknown): AttachmentError {
  if (error instanceof AttachmentError) return error;
  if (error instanceof Error && error.name === "PasswordException") {
    return new AttachmentError(
      "FILE_ENCRYPTED",
      "The PDF is password-protected.",
    );
  }
  // The reason stays in the server log: the uploader is told only the code,
  // because a parser message can quote the file it failed on.
  console.error("[assistant] pdf read failed", error);
  return new AttachmentError(
    "FILE_PARSE_FAILED",
    error instanceof Error ? error.message : "The PDF could not be read.",
  );
}

type TextPiece = { str: string; hasEOL: boolean };

/**
 * pdf.js hands back positioned fragments, not lines. They are concatenated
 * in reading order and broken where the layout engine says a line ended;
 * joining them with spaces instead would split every Vietnamese word that
 * happens to be drawn in two runs.
 */
function joinPieces(items: readonly unknown[]): string {
  const lines: string[] = [];
  let line = "";
  for (const item of items) {
    if (typeof item !== "object" || item === null || !("str" in item)) continue;
    const piece = item as TextPiece;
    line += piece.str;
    if (piece.hasEOL) {
      lines.push(line.trimEnd());
      line = "";
    }
  }
  if (line.trim() !== "") lines.push(line.trimEnd());
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfText(bytes: Uint8Array): Promise<{
  text: string;
  notes: string[];
  truncated: boolean;
}> {
  await configureWorker();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const task = pdfjs.getDocument({
    // A copy: pdf.js takes ownership of the buffer it is handed, and the
    // caller still needs the original bytes for the image branch and size.
    data: new Uint8Array(bytes),
    useWorkerFetch: false,
    // There is deliberately no `isEvalSupported: false` here: pdf.js 6
    // removed the option along with the last of its `eval` use, and passing
    // one it no longer declares would not typecheck.
    useSystemFonts: false,
    disableFontFace: true,
    // Errors only. Reading text needs no font programme, but pdf.js still
    // announces every font it would have substituted, which would put a
    // warning in the server log for every font of every uploaded file.
    verbosity: 0,
  });

  try {
    const document = await task.promise;
    const pageCount = document.numPages;
    const readable = Math.min(pageCount, limits.maxPdfPages);
    const notes: string[] = [];
    const blocks: string[] = [];
    let characters = 0;
    let lastPage = 0;
    let anyText = false;

    for (let number = 1; number <= readable; number += 1) {
      const page = await document.getPage(number);
      let pageText: string;
      try {
        pageText = joinPieces((await page.getTextContent()).items);
      } finally {
        page.cleanup();
      }
      if (pageText !== "") anyText = true;
      const block =
        pageText === ""
          ? `[Trang ${number}]`
          : `[Trang ${number}]\n${pageText}`;
      blocks.push(block);
      characters += block.length + 2;
      lastPage = number;
      if (characters >= limits.maxTextChars) break;
    }

    if (!anyText) {
      throw new AttachmentError(
        "NO_TEXT_FOUND",
        "The PDF has no text layer; it is a scan or a set of images.",
      );
    }

    let text = blocks.join("\n\n");
    let truncated = false;
    if (pageCount > readable) {
      notes.push(
        `Tệp PDF có ${pageCount} trang; chỉ đọc ${readable} trang đầu.`,
      );
      truncated = true;
    }
    if (text.length > limits.maxTextChars) {
      text = text.slice(0, limits.maxTextChars);
      notes.push(
        `Văn bản đã bị cắt ở ${limits.maxTextChars} ký tự (đọc đến trang ${lastPage}).`,
      );
      truncated = true;
    } else if (lastPage < readable) {
      notes.push(`Chỉ đọc đến trang ${lastPage} vì văn bản đã đạt giới hạn.`);
      truncated = true;
    }
    return { text, notes, truncated };
  } catch (error) {
    throw failed(error);
  } finally {
    // Teardown is on the loading task; the document proxy has no destroy.
    await task.destroy();
  }
}
