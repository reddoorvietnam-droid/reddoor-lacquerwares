import { crc32, deflateRawSync, deflateSync } from "node:zlib";
import * as XLSX from "xlsx";

/**
 * Attachment fixtures built in code.
 *
 * This repository commits no binary test files: a checked-in .docx or .png
 * is opaque in review, drifts from what the parser expects and cannot be
 * varied (an encrypted entry, a macro part, a missing document part) without
 * adding another opaque file. Every container here is therefore assembled
 * byte by byte — a zip with real local headers, central directory and end
 * record, a PNG with real chunk CRCs — so a test can say exactly which byte
 * it is testing.
 */

const encoder = new TextEncoder();

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Zip                                                                 */
/* ------------------------------------------------------------------ */

export type ZipEntry = {
  name: string;
  text?: string;
  bytes?: Uint8Array;
  /** Stored entries keep their bytes verbatim; deflated ones go through zlib. */
  stored?: boolean;
  /** Sets general-purpose bit 0, which marks the entry as encrypted. */
  encrypted?: boolean;
};

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const EOCD = 22;

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const files: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const raw = entry.bytes ?? encoder.encode(entry.text ?? "");
    const stored = entry.stored === true;
    const payload = stored ? raw : new Uint8Array(deflateRawSync(raw));
    const flags = entry.encrypted === true ? 0x0001 : 0;
    const checksum = crc32(raw);

    const local = new Uint8Array(LOCAL_HEADER + name.length + payload.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, flags, true);
    localView.setUint16(8, stored ? 0 : 8, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, payload.length, true);
    localView.setUint32(22, raw.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, LOCAL_HEADER);
    local.set(payload, LOCAL_HEADER + name.length);
    files.push(local);

    const central = new Uint8Array(CENTRAL_HEADER + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, flags, true);
    centralView.setUint16(10, stored ? 0 : 8, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, payload.length, true);
    centralView.setUint32(24, raw.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, CENTRAL_HEADER);
    directory.push(central);

    offset += local.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(EOCD);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, directorySize, true);
  endView.setUint32(16, offset, true);
  return concat([...files, ...directory, end]);
}

/* ------------------------------------------------------------------ */
/* Word                                                                */
/* ------------------------------------------------------------------ */

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  "</Types>";

const RELATIONSHIPS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The WordprocessingML envelope around a body written by the test itself. */
export function buildDocxBody(
  bodyXml: string,
  extra: readonly ZipEntry[] = [],
): Uint8Array {
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${bodyXml}</w:body></w:document>`;
  return buildZip([
    { name: "[Content_Types].xml", text: CONTENT_TYPES },
    { name: "_rels/.rels", text: RELATIONSHIPS },
    { name: "word/document.xml", text: document },
    ...extra,
  ]);
}

/** One paragraph per string, escaped exactly the way Word escapes text. */
export function buildDocx(paragraphs: readonly string[]): Uint8Array {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="720"/></w:tabs></w:pPr>` +
        `<w:r><w:t xml:space="preserve">${escapeXml(paragraph)}</w:t></w:r></w:p>`,
    )
    .join("");
  return buildDocxBody(body);
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const label = encoder.encode(type);
  const body = concat([label, data]);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set(body, 4);
  view.setUint32(8 + data.length, crc32(body), false);
  return chunk;
}

/** A real 1×1 PNG; `padBytes` inflates it through a comment chunk. */
export function buildPng(padBytes = 0): Uint8Array {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, 1, false);
  headerView.setUint32(4, 1, false);
  header[8] = 8;
  header[9] = 2;
  const pixel = new Uint8Array([0x00, 0xc0, 0x20, 0x20]);
  const chunks = [
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array(deflateSync(pixel))),
  ];
  if (padBytes > 0) {
    chunks.push(
      pngChunk(
        "tEXt",
        concat([encoder.encode("pad\0"), new Uint8Array(padBytes)]),
      ),
    );
  }
  chunks.push(pngChunk("IEND", new Uint8Array(0)));
  return concat(chunks);
}

/* ------------------------------------------------------------------ */
/* Spreadsheets                                                        */
/* ------------------------------------------------------------------ */

export function buildCsv(text: string): Uint8Array {
  return encoder.encode(text);
}

export function buildWorkbook(
  sheets: readonly { name: string; rows: readonly (readonly string[])[] }[],
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(sheet.rows.map((row) => [...row])),
      sheet.name,
    );
  }
  const written: unknown = XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
  });
  return new Uint8Array(written as ArrayBuffer);
}

export function buildXlsx(
  rows: readonly (readonly string[])[],
  sheetName = "Sheet1",
): Uint8Array {
  return buildWorkbook([{ name: sheetName, rows }]);
}
