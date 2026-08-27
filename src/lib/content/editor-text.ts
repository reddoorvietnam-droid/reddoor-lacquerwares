import type { StructuredBlock } from "@/lib/content/contracts";

/**
 * Renders stored structured blocks back into the plain text the admin
 * editors work in: paragraphs separated by blank lines, list items as
 * dash-prefixed lines.
 *
 * The editors author paragraphs (and, for care instructions, one list), so
 * for content created through them this is a faithful round trip. Content
 * that carries other block types is flattened to its text — a deliberate
 * ceiling until the editors grow a real block palette.
 */
export function blocksToEditorText(
  blocks: readonly StructuredBlock[] | null | undefined,
): string {
  if (!blocks) return "";

  const chunks: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
      case "heading":
      case "quote": {
        if (block.text?.trim()) chunks.push(block.text.trim());
        break;
      }
      case "richText": {
        if (block.html) {
          const text = block.html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (text) chunks.push(text);
        }
        break;
      }
      case "list": {
        const items = (block.items ?? [])
          .map((item) => item.trim())
          .filter(Boolean);
        if (items.length > 0) {
          chunks.push(items.map((item) => `- ${item}`).join("\n"));
        }
        break;
      }
      default:
        break;
    }
  }
  return chunks.join("\n\n");
}

/** List items only, one per line — the care-instructions field. */
export function blocksToLines(
  blocks: readonly StructuredBlock[] | null | undefined,
): string {
  if (!blocks) return "";
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.type === "list") {
      for (const item of block.items ?? []) {
        if (item.trim()) lines.push(item.trim());
      }
    } else if (block.type === "paragraph" && block.text?.trim()) {
      lines.push(block.text.trim());
    }
  }
  return lines.join("\n");
}
