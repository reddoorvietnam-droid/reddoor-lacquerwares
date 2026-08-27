/**
 * The article editor's block model and its two pure conversions:
 *
 * - stored per-locale block lists → one editor list with VI and EN side by
 *   side (paired by `blockId`, which the editor keeps identical across
 *   locales);
 * - one editor block → the stored block for one locale, with English text
 *   falling back to the Vietnamese so both lists keep the same structure.
 *
 * Isomorphic on purpose: the editor uses the types and the id helper in the
 * browser, the server action uses the conversions. Anything that needs
 * server secrets (minting an image delivery URL) is injected by the caller.
 */

export type ArticleEditorBlockType =
  | "heading"
  | "paragraph"
  | "quote"
  | "list"
  | "image"
  | "divider"
  | "embed"
  | "callToAction";

export type ArticleEditorImage = {
  publicId: string;
  assetVersion: number;
  width: number;
  height: number;
  previewUrl: string;
};

export type ArticleEditorBlock = {
  id: string;
  type: ArticleEditorBlockType;
  /** Main text: paragraph/heading/quote body, list lines, caption, CTA label. */
  vi: string;
  en: string;
  level: 2 | 3;
  attribution: string;
  href: string;
  alt: string;
  image: ArticleEditorImage | null;
};

export function emptyEditorBlock(
  id: string,
  type: ArticleEditorBlockType,
): ArticleEditorBlock {
  return {
    id,
    type,
    vi: "",
    en: "",
    level: 2,
    attribution: "",
    href: "",
    alt: "",
    image: null,
  };
}

type StoredBlockShape = {
  blockId?: string | undefined;
  type?: string | undefined;
  text?: string | null | undefined;
  html?: string | null | undefined;
  level?: number | undefined;
  attribution?: string | null | undefined;
  style?: string | undefined;
  items?: readonly (string | null)[] | null | undefined;
  src?: string | null | undefined;
  alt?: string | null | undefined;
  caption?: string | null | undefined;
  width?: number | null | undefined;
  height?: number | null | undefined;
  label?: string | null | undefined;
  href?: string | null | undefined;
};

/** Recovers the provider handle from a delivery URL minted at save time. */
export function parseCloudinarySrc(
  src: string,
): { publicId: string; assetVersion: number } | null {
  const match = src.match(/\/image\/upload\/[^/]+\/v(\d+)\/(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { publicId: match[2], assetVersion: Number(match[1]) };
}

function mainText(block: StoredBlockShape): string {
  switch (block.type) {
    case "list":
      return (block.items ?? [])
        .map((item) => item?.trim() ?? "")
        .filter(Boolean)
        .join("\n");
    case "image":
      return block.caption ?? "";
    case "callToAction":
      return block.label ?? "";
    case "richText":
      return (block.html ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    default:
      return block.text ?? "";
  }
}

export function storedToEditorBlocks(
  viBlocks: readonly StoredBlockShape[],
  enBlocks: readonly StoredBlockShape[],
): ArticleEditorBlock[] {
  const enById = new Map(enBlocks.map((block) => [block.blockId, block]));

  return viBlocks
    .map((block): ArticleEditorBlock | null => {
      const type: ArticleEditorBlockType | null =
        block.type === "richText"
          ? "paragraph"
          : block.type === "heading" ||
              block.type === "paragraph" ||
              block.type === "quote" ||
              block.type === "list" ||
              block.type === "image" ||
              block.type === "divider" ||
              block.type === "embed" ||
              block.type === "callToAction"
            ? block.type
            : null;
      if (!type || !block.blockId) return null;

      const en = enById.get(block.blockId);
      const parsed = block.src ? parseCloudinarySrc(block.src) : null;

      return {
        id: block.blockId,
        type,
        vi: mainText(block),
        en: en ? mainText(en) : "",
        level: block.level === 3 || block.level === 4 ? 3 : 2,
        attribution: block.attribution ?? "",
        href: block.href ?? "",
        alt: block.alt ?? "",
        image:
          type === "image" && block.src && parsed
            ? {
                publicId: parsed.publicId,
                assetVersion: parsed.assetVersion,
                width: block.width ?? 1600,
                height: block.height ?? 1000,
                previewUrl: block.src,
              }
            : null,
      };
    })
    .filter((block): block is ArticleEditorBlock => block !== null);
}

/**
 * One editor block → the stored block for one locale, or null when the block
 * has nothing to say in any locale. English falls back to Vietnamese so the
 * two stored lists always share their structure and block ids.
 */
export function editorBlockToStored(
  block: ArticleEditorBlock,
  locale: "vi" | "en",
  buildImageSrc: (publicId: string, assetVersion: number) => string,
): Record<string, unknown> | null {
  const text =
    locale === "en" ? block.en.trim() || block.vi.trim() : block.vi.trim();

  switch (block.type) {
    case "paragraph":
      return text ? { blockId: block.id, type: "paragraph", text } : null;
    case "heading":
      return text
        ? {
            blockId: block.id,
            type: "heading",
            level: block.level,
            text: text.slice(0, 300),
          }
        : null;
    case "quote":
      return text
        ? {
            blockId: block.id,
            type: "quote",
            text: text.slice(0, 2_000),
            ...(block.attribution.trim()
              ? { attribution: block.attribution.trim() }
              : {}),
          }
        : null;
    case "list": {
      const items = text
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 50);
      return items.length > 0
        ? { blockId: block.id, type: "list", style: "unordered", items }
        : null;
    }
    case "image": {
      if (!block.image) return null;
      return {
        blockId: block.id,
        type: "image",
        src: buildImageSrc(block.image.publicId, block.image.assetVersion),
        width: block.image.width,
        height: block.image.height,
        alt: block.alt.trim() || "—",
        ...(text ? { caption: text.slice(0, 500) } : {}),
      };
    }
    case "divider":
      return { blockId: block.id, type: "divider" };
    case "embed":
      return block.href.trim()
        ? { blockId: block.id, type: "embed", href: block.href.trim() }
        : null;
    case "callToAction":
      return text && block.href.trim()
        ? {
            blockId: block.id,
            type: "callToAction",
            label: text.slice(0, 120),
            href: block.href.trim(),
          }
        : null;
    default:
      return null;
  }
}
