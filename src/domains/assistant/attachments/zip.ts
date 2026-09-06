import "server-only";

import { inflateRawSync } from "node:zlib";

import { AttachmentError } from "@/domains/assistant/attachments/contracts";
import { SheetCheckError } from "@/domains/sheet-checks/contracts";
import { inspectZipContainer } from "@/domains/sheet-checks/parsing/intake";

/**
 * One entry out of a zip container, read by hand.
 *
 * A .docx is a zip, and the only part of it worth reading is a single XML
 * file. Pulling in a zip library to get it would add a parser this project
 * does not control to the path a stranger's file travels; instead the
 * container is first handed to `inspectZipContainer` — the guard already
 * hardened for spreadsheet checks, which refuses ZIP64, too many entries,
 * declared sizes that betray a zip bomb, paths that escape the container
 * and an Excel VBA project — and only then is the central directory walked
 * for the one entry the caller asked for.
 *
 * What the guard cannot know is that a Word macro lives at a different path
 * from an Excel one, so `word/vbaProject.bin` is refused here.
 *
 * Node-only (`node:zlib`): never import this, or anything that imports it,
 * from a client component.
 */

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_LENGTH = 22;
const LOCAL_HEADER_LENGTH = 30;
const CENTRAL_HEADER_LENGTH = 46;
const MAX_COMMENT_LENGTH = 0xffff;
/** General-purpose bit 0: the entry is encrypted. */
const ENCRYPTED_FLAG = 0x0001;
const METHOD_STORED = 0;
const METHOD_DEFLATED = 8;
/** The Word counterpart of `xl/vbaproject`, which the shared guard misses. */
const WORD_VBA_PROJECT = "word/vbaproject.bin";

type CentralEntry = {
  name: string;
  flags: number;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
};

function damaged(reason: string): AttachmentError {
  return new AttachmentError("FILE_PARSE_FAILED", `Zip entry ${reason}.`);
}

/**
 * The shared guard speaks `SheetCheckError`; the assistant speaks
 * `AttachmentError`. Only two codes can come out of it, and both have an
 * exact counterpart, so nothing is flattened into a vaguer refusal.
 */
function guardContainer(bytes: Uint8Array): void {
  try {
    inspectZipContainer(bytes);
  } catch (error) {
    if (error instanceof SheetCheckError) {
      throw new AttachmentError(
        error.code === "FILE_MACRO_REJECTED"
          ? "FILE_MACRO_REJECTED"
          : "FILE_ZIP_SUSPICIOUS",
        error.message,
      );
    }
    throw error;
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const last = view.byteLength - EOCD_LENGTH;
  const floor = Math.max(0, last - MAX_COMMENT_LENGTH);
  for (let offset = last; offset >= floor; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

/**
 * Re-walks the directory the guard has already validated. The bounds are
 * checked a second time regardless: this reader indexes into the bytes, and
 * a raw `RangeError` from a DataView is not an answer anyone can act on.
 */
function readCentralDirectory(
  bytes: Uint8Array,
  view: DataView,
): CentralEntry[] {
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw damaged("directory has no end record");
  const totalEntries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  const directoryEnd = directoryOffset + directorySize;
  if (directoryEnd > eocd) throw damaged("directory overruns its end record");

  const names = new TextDecoder("utf-8");
  const entries: CentralEntry[] = [];
  let position = directoryOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (position + CENTRAL_HEADER_LENGTH > directoryEnd) {
      throw damaged("directory is truncated");
    }
    if (view.getUint32(position, true) !== CENTRAL_SIGNATURE) {
      throw damaged("header is not a directory record");
    }
    const nameLength = view.getUint16(position + 28, true);
    const nameStart = position + CENTRAL_HEADER_LENGTH;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > directoryEnd) throw damaged("name overruns the directory");
    entries.push({
      name: names.decode(bytes.subarray(nameStart, nameEnd)),
      flags: view.getUint16(position + 8, true),
      method: view.getUint16(position + 10, true),
      compressedSize: view.getUint32(position + 20, true),
      uncompressedSize: view.getUint32(position + 24, true),
      localOffset: view.getUint32(position + 42, true),
    });
    position =
      nameEnd +
      view.getUint16(position + 30, true) +
      view.getUint16(position + 32, true);
  }
  return entries;
}

/**
 * The local header repeats the name and carries its own extra field, whose
 * length rarely matches the directory's — the payload starts after both, so
 * they are read from the local record and never assumed.
 */
function readEntryData(
  bytes: Uint8Array,
  view: DataView,
  entry: CentralEntry,
): Uint8Array {
  const header = entry.localOffset;
  if (header + LOCAL_HEADER_LENGTH > bytes.length) {
    throw damaged("points past the end of the file");
  }
  if (view.getUint32(header, true) !== LOCAL_SIGNATURE) {
    throw damaged("has no local header");
  }
  const flags = entry.flags | view.getUint16(header + 6, true);
  if ((flags & ENCRYPTED_FLAG) !== 0) {
    throw new AttachmentError(
      "FILE_ENCRYPTED",
      "The document is password-protected.",
    );
  }
  const start =
    header +
    LOCAL_HEADER_LENGTH +
    view.getUint16(header + 26, true) +
    view.getUint16(header + 28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw damaged("runs past the end of the file");

  if (entry.uncompressedSize === 0) return new Uint8Array(0);
  const payload = bytes.subarray(start, end);
  if (entry.method === METHOD_STORED) {
    // Stored entries declare the same size twice; the smaller one wins so a
    // lying header cannot hand back more than the guard accounted for.
    return payload.slice(0, Math.min(payload.length, entry.uncompressedSize));
  }
  if (entry.method !== METHOD_DEFLATED) {
    throw damaged(`uses compression method ${entry.method}`);
  }
  try {
    // `maxOutputLength` is the zip-bomb stop: the entry gets exactly the
    // space its directory record declared, and inflation aborts past it.
    const inflated = inflateRawSync(payload, {
      maxOutputLength: entry.uncompressedSize,
    });
    return new Uint8Array(
      inflated.buffer,
      inflated.byteOffset,
      inflated.byteLength,
    );
  } catch {
    throw damaged("could not be decompressed");
  }
}

/** The entry's bytes, or null when the container does not carry it. */
export function readZipEntry(
  bytes: Uint8Array,
  entryName: string,
): Uint8Array | null {
  guardContainer(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = readCentralDirectory(bytes, view);

  for (const entry of entries) {
    if (entry.name.toLowerCase() === WORD_VBA_PROJECT) {
      throw new AttachmentError(
        "FILE_MACRO_REJECTED",
        "The document carries a VBA project.",
      );
    }
  }
  // Word writes the canonical lower-case paths, but a file produced by
  // another tool may not; the exact name is preferred and case is the
  // fallback rather than the rule.
  const wanted =
    entries.find((entry) => entry.name === entryName) ??
    entries.find(
      (entry) => entry.name.toLowerCase() === entryName.toLowerCase(),
    );
  if (!wanted) return null;
  return readEntryData(bytes, view, wanted);
}
