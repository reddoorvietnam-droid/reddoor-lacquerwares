import "server-only";

import type {
  PublicSocialLink,
  PublicSocialPlatform,
} from "@/domains/content/public-contract";
import type { Locale, LocalizedSlug } from "@/lib/i18n/config";

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

/** The published translations as one locale + slug pair per locale. */
export function translationSlugs(
  translations: readonly { locale: Locale; slug: string }[],
): LocalizedSlug[] {
  const byLocale = new Map<Locale, string>();
  for (const entry of translations) {
    if (!byLocale.has(entry.locale)) byLocale.set(entry.locale, entry.slug);
  }
  return [...byLocale].map(([locale, slug]) => ({ locale, slug }));
}

/**
 * Whether a record answers a slug lookup. Any published translation counts:
 * the locale switcher rewrites only the locale segment, so a URL often
 * carries another language's slug. Finding the record lets the route
 * redirect to this locale's own slug instead of answering 404.
 */
export function hasTranslationSlug(
  translations: readonly { slug: string }[],
  slug: string,
): boolean {
  return translations.some((entry) => entry.slug === slug);
}

/**
 * Orders slug-lookup hits so a record whose own slug matches comes first; a
 * different record that merely shares the slug in another language must not
 * shadow it.
 */
export function preferExactSlug<T extends { slug: string }>(
  records: readonly T[],
  slug: string | undefined,
): T[] {
  if (!slug) return [...records];
  return [
    ...records.filter((record) => record.slug === slug),
    ...records.filter((record) => record.slug !== slug),
  ];
}

/**
 * Platforms whose links reach the footer and the Organization's `sameAs`.
 * Mirrors `PublicSocialPlatform`; the admin form also accepts `whatsapp`,
 * which is dropped here because a chat link is not a profile.
 */
const SOCIAL_PLATFORMS: readonly PublicSocialPlatform[] = [
  "facebook",
  "instagram",
  "linkedin",
  "pinterest",
  "youtube",
  "x",
  "tiktok",
];

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Published social links → the public contract. Unknown platforms and
 * anything that is not an https URL are dropped rather than rendered: a
 * broken or unexpected link in the footer is worse than no link.
 */
export function toPublicSocialLinks(
  raw: readonly { platform: string; label: string; url: string }[],
): PublicSocialLink[] {
  return raw.flatMap((link, index) => {
    const platform = link.platform.trim().toLowerCase();
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
      return [];
    }
    const href = link.url.trim();
    if (!isHttpsUrl(href)) return [];
    return [
      {
        id: `social-${platform}-${index}`,
        platform: platform as PublicSocialPlatform,
        label: link.label,
        href,
        isDemo: false,
      },
    ];
  });
}
