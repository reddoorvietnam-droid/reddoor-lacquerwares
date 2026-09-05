import "server-only";

import type { Locale } from "@/lib/i18n/config";

/**
 * Shared mapping helpers for the Mongo-backed public repositories.
 *
 * The public contracts were designed against the DEMO fixtures, which carry
 * finished editorial assets. Real records published through the CMS reference
 * media by id, and no media pipeline delivers URLs yet — so every image maps
 * to the reserved-slot state (`src: null`, `assetPending: true`) the layouts
 * were built to render. When the media pipeline lands, only these helpers
 * change.
 */

export type PendingImageSlot = {
  readonly assetKey: string;
  readonly src: null;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly assetPending: true;
  readonly replacementHint: string;
};

export function pendingImage(
  assetKey: string,
  alt: string,
  width: number,
  height: number,
): PendingImageSlot {
  return {
    assetKey,
    src: null,
    alt,
    width,
    height,
    assetPending: true,
    replacementHint: "",
  };
}

export type DeliveredImageSlot = {
  readonly assetKey: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly assetPending: false;
  readonly replacementHint: string;
};

/** A photograph that has landed under `public/` and no longer needs a slot. */
export function deliveredImage(
  assetKey: string,
  src: string,
  alt: string,
  width: number,
  height: number,
): DeliveredImageSlot {
  return {
    assetKey,
    src,
    alt,
    width,
    height,
    assetPending: false,
    replacementHint: "",
  };
}

/**
 * The structured block subset that carries running text. Block payloads are
 * validated by the CMS at write time; reading tolerates anything and keeps
 * only what it can render.
 */
type TextBearingBlock = {
  type?: string;
  text?: string | null;
  html?: string | null;
  items?: readonly (string | null)[] | null;
};

function decodeBasicEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function stripHtml(html: string): string {
  return decodeBasicEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Flattens published structured blocks into displayable paragraphs. */
export function blocksToParagraphs(
  blocks: readonly TextBearingBlock[] | null | undefined,
): string[] {
  if (!blocks) return [];

  const paragraphs: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "paragraph":
      case "quote":
      case "heading": {
        const text = block.text?.trim();
        if (text) paragraphs.push(text);
        break;
      }
      case "richText": {
        if (!block.html) break;
        for (const fragment of block.html.split(/<\/p>/i)) {
          const text = stripHtml(fragment);
          if (text) paragraphs.push(text);
        }
        break;
      }
      case "list": {
        for (const item of block.items ?? []) {
          const text = item?.trim();
          if (text) paragraphs.push(text);
        }
        break;
      }
      default:
        break;
    }
  }
  return paragraphs;
}

/** Splits sanitized landing HTML into plain-text paragraphs. */
export function htmlToParagraphs(html: string): string[] {
  const matches = [
    ...html.matchAll(/<(?:p|h2|h3|li)[^>]*>([\s\S]*?)<\/(?:p|h2|h3|li)>/gi),
  ]
    .map(([, inner]) => stripHtml(inner ?? ""))
    .filter((text) => text.length > 0);

  if (matches.length > 0) return matches;

  const whole = stripHtml(html);
  return whole ? [whole] : [];
}

/**
 * Picks the translation a visitor should see: their locale first, then the
 * company's source locale, then English, then whatever exists. Returning a
 * neighbouring locale beats hiding a published record from five of the six
 * markets while its translations catch up.
 */
export function pickTranslation<T extends { locale: Locale }>(
  translations: readonly T[],
  locale: Locale,
): T | null {
  const byLocale = new Map(translations.map((entry) => [entry.locale, entry]));
  return (
    byLocale.get(locale) ??
    byLocale.get("vi") ??
    byLocale.get("en") ??
    translations[0] ??
    null
  );
}
