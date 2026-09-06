import "server-only";

import { AttachmentError } from "@/domains/assistant/attachments/contracts";
import { attachmentLimits as limits } from "@/domains/assistant/attachments/limits";
import { readZipEntry } from "@/domains/assistant/attachments/zip";

/**
 * The readable text of a .docx.
 *
 * WordprocessingML is not stripped with a regular expression. Two things
 * would be lost by that: the structure, because a quotation, a table row
 * and a line break all disappear into one run-on paragraph that no reader
 * can quote back accurately; and the safety, because a `&lt;` that a person
 * typed in their document would be turned into a real `<` by the entity
 * decoder and then read as markup by the next pass. So the document is
 * walked once, tags are turned into the whitespace they stand for, and
 * entities are decoded only afterwards — text that arrives as an escaped
 * angle bracket stays text forever.
 *
 * Paragraph and table properties are skipped whole: `w:pPr` carries
 * `<w:tab/>` elements that define tab *stops*, which are not tabs in the
 * text, and `w:instrText` carries field codes that are instructions to
 * Word, not something the author wrote.
 *
 * Node-only (`node:zlib` through the zip reader): never import this, or
 * anything that imports it, from a client component.
 */

const DOCUMENT_PART = "word/document.xml";

/** Elements whose entire contents are machine settings, not the author's text. */
const skippedElements: readonly string[] = [
  "ppr",
  "rpr",
  "sectpr",
  "tblpr",
  "trpr",
  "tcpr",
  "tblgrid",
  "numpr",
  "instrtext",
  "deltext",
];

/** Tags that stand for whitespace once the markup is gone. */
const inlineMarkers: Readonly<Record<string, string>> = {
  tab: "\t",
  br: "\n",
  cr: "\n",
};

const closingMarkers: Readonly<Record<string, string>> = {
  p: "\n",
  tr: "\n",
  tc: "\t",
};

/**
 * A table cell holds paragraphs too, and ending each of them with a line
 * break would tear every row apart into one line per cell. Inside a cell a
 * paragraph ends with a space instead, and the cell itself is what ends
 * with the tab that separates two columns.
 */
const IN_CELL_PARAGRAPH = " ";

/** A closing tag that ends one countable block: a paragraph or a table row. */
const blockEndings: readonly string[] = ["p", "tr"];

const XML_ENTITY = /&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos);/g;

const namedEntities: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(XML_ENTITY, (match, body: string) => {
    const named = namedEntities[body];
    if (named !== undefined) return named;
    const code = body.startsWith("#x")
      ? Number.parseInt(body.slice(2), 16)
      : Number.parseInt(body.slice(1), 10);
    // A lone surrogate or an out-of-range code point would corrupt the
    // string; the escape is left as the author wrote it instead.
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
    if (code >= 0xd800 && code <= 0xdfff) return match;
    return String.fromCodePoint(code);
  });
}

type Tag = { name: string; closing: boolean; selfClosing: boolean };

/** `w:tab w:val="left"` → tab; the namespace prefix is dropped, not trusted. */
function parseTag(source: string): Tag {
  const closing = source.startsWith("/");
  const selfClosing = source.endsWith("/");
  const body = source.slice(closing ? 1 : 0, selfClosing ? -1 : undefined);
  const raw = body.split(/[\s/]/, 1)[0] ?? "";
  const colon = raw.indexOf(":");
  return {
    name: (colon < 0 ? raw : raw.slice(colon + 1)).toLowerCase(),
    closing,
    selfClosing,
  };
}

type Walked = { raw: string; blockCapped: boolean };

function walkDocument(xml: string): Walked {
  const parts: string[] = [];
  let skipUntil: string | null = null;
  let cellDepth = 0;
  let blocks = 0;
  let blockCapped = false;
  let index = 0;

  while (index < xml.length) {
    const open = xml.indexOf("<", index);
    const text = xml.slice(index, open < 0 ? xml.length : open);
    if (skipUntil === null && text !== "") parts.push(text);
    if (open < 0) break;
    if (xml.startsWith("<!--", open)) {
      const end = xml.indexOf("-->", open + 4);
      if (end < 0) break;
      index = end + 3;
      continue;
    }
    const close = xml.indexOf(">", open + 1);
    if (close < 0) break;
    const tag = parseTag(xml.slice(open + 1, close));
    index = close + 1;

    if (skipUntil !== null) {
      if (tag.closing && tag.name === skipUntil) skipUntil = null;
      continue;
    }
    if (
      !tag.closing &&
      !tag.selfClosing &&
      skippedElements.includes(tag.name)
    ) {
      skipUntil = tag.name;
      continue;
    }
    if (!tag.closing && !tag.selfClosing && tag.name === "tc") {
      cellDepth += 1;
      continue;
    }
    if (tag.closing) {
      if (tag.name === "tc" && cellDepth > 0) cellDepth -= 1;
      const marker =
        tag.name === "p" && cellDepth > 0
          ? IN_CELL_PARAGRAPH
          : closingMarkers[tag.name];
      if (marker !== undefined) parts.push(marker);
      if (blockEndings.includes(tag.name)) {
        blocks += 1;
        if (blocks >= limits.maxDocxBlocks) {
          blockCapped = true;
          break;
        }
      }
      continue;
    }
    const marker = inlineMarkers[tag.name];
    if (marker !== undefined) parts.push(marker);
  }

  return { raw: parts.join(""), blockCapped };
}

/** Word writes a line break per paragraph; nobody wants forty of them in a row. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ +\t/g, "\t")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDocxText(bytes: Uint8Array): {
  text: string;
  notes: string[];
  truncated: boolean;
} {
  const part = readZipEntry(bytes, DOCUMENT_PART);
  if (!part) {
    throw new AttachmentError(
      "NO_TEXT_FOUND",
      "The file carries no Word document part.",
    );
  }
  const xml = new TextDecoder("utf-8").decode(part).replace(/^\ufeff/, "");
  const walked = walkDocument(xml);
  let text = tidy(decodeEntities(walked.raw));
  if (text === "") {
    throw new AttachmentError(
      "NO_TEXT_FOUND",
      "The document holds no readable text.",
    );
  }

  const notes: string[] = [];
  let truncated = false;
  if (walked.blockCapped) {
    notes.push(
      `Chỉ đọc ${limits.maxDocxBlocks} đoạn/dòng bảng đầu tiên của tài liệu; phần còn lại đã bị bỏ qua.`,
    );
    truncated = true;
  }
  if (text.length > limits.maxTextChars) {
    text = text.slice(0, limits.maxTextChars);
    notes.push(`Văn bản đã bị cắt ở ${limits.maxTextChars} ký tự.`);
    truncated = true;
  }
  return { text, notes, truncated };
}
