import "server-only";

import sanitizeHtml from "sanitize-html";

import {
  structuredBlocksSchema,
  type StructuredBlock,
} from "@/lib/content/contracts";

const richTextPolicy: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "h2",
    "h3",
    "h4",
    "br",
    "strong",
    "em",
    "b",
    "i",
    "ul",
    "ol",
    "li",
    "a",
    "blockquote",
    "sub",
    "sup",
  ],
  allowedAttributes: {
    a: ["href", "title"],
  },
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesByTag: {
    a: ["https", "mailto", "tel"],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  enforceHtmlBoundary: true,
};

export function sanitizeRichTextHtml(value: string): string {
  return sanitizeHtml(value, richTextPolicy).trim();
}

/**
 * Persistence boundary for structured editor input. Callers receive a parsed,
 * allowlisted value and can never pass an unknown block key to Mongoose.
 */
export function sanitizeStructuredBlocksForPersistence(
  value: unknown,
): StructuredBlock[] {
  const blocks = structuredBlocksSchema.parse(value);

  return blocks.map((block) =>
    block.type === "richText"
      ? { ...block, html: sanitizeRichTextHtml(block.html) }
      : block,
  );
}

/** Renderers intentionally apply the same policy again as defense in depth. */
export const sanitizeStructuredBlocksForRender =
  sanitizeStructuredBlocksForPersistence;
