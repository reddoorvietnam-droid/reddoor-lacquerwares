import type { Locale, LocalizedSlug } from "@/lib/i18n/config";

/**
 * `"DEMO"` marks copy that is a stand-in and must not be read as a company
 * statement; `null` marks copy the company stands behind. Mirrors
 * `PublicContentMarker` in the content domain, but is declared here so the two
 * domains stay independent of each other.
 */
export type PublicNewsMarker = "DEMO" | null;

export interface PublicNewsImage {
  /** Stable file name the final photograph should be saved as. */
  readonly assetKey: string;
  /** Delivered image, or `null` while the photograph is still outstanding. */
  readonly src: string | null;
  readonly alt: string;
  /** Intended pixel size; the layout reserves this box either way. */
  readonly width: number;
  readonly height: number;
  /** True until a real photograph replaces the reserved slot. */
  readonly assetPending: boolean;
  readonly replacementHint: string;
  /**
   * Same photograph cropped to the 16:9, 4:3 and 1:1 frames search engines
   * ask for on article results. Absent for reserved slots and demo copy.
   */
  readonly variants?: readonly string[];
}

export interface PublicNewsParagraph {
  readonly type: "paragraph";
  readonly text: string;
}

export interface PublicNewsHeading {
  readonly type: "heading";
  readonly level: 2 | 3;
  readonly text: string;
}

export interface PublicNewsQuote {
  readonly type: "quote";
  readonly text: string;
  readonly attribution: string | null;
}

export interface PublicNewsList {
  readonly type: "list";
  readonly style: "ordered" | "unordered";
  readonly items: readonly string[];
}

export interface PublicNewsInlineImage {
  readonly type: "image";
  readonly src: string;
  readonly alt: string;
  readonly caption: string | null;
  readonly width: number;
  readonly height: number;
}

export interface PublicNewsDivider {
  readonly type: "divider";
}

export interface PublicNewsEmbed {
  readonly type: "embed";
  /** YouTube video id, extracted from the stored link. */
  readonly youtubeId: string;
}

export interface PublicNewsCallToAction {
  readonly type: "callToAction";
  readonly label: string;
  readonly href: string;
}

export type PublicNewsContentBlock =
  | PublicNewsParagraph
  | PublicNewsHeading
  | PublicNewsQuote
  | PublicNewsList
  | PublicNewsInlineImage
  | PublicNewsDivider
  | PublicNewsEmbed
  | PublicNewsCallToAction;

export interface PublicNewsArticle {
  readonly id: string;
  readonly marker: PublicNewsMarker;
  readonly isDemo: boolean;
  readonly locale: Locale;
  readonly slug: string;
  /**
   * The locale the copy is written in. Differs from `locale` when this locale
   * has no translation and the page falls back to another one.
   */
  readonly contentLocale: Locale;
  /** Every published translation and its slug, for hreflang and the sitemap. */
  readonly translations: readonly LocalizedSlug[];
  /** ISO timestamp of the last change, `null` when unknown. */
  readonly updatedAt: string | null;
  readonly title: string;
  readonly excerpt: string;
  readonly content: readonly PublicNewsContentBlock[];
  readonly categorySlug: string;
  readonly categoryLabel: string;
  readonly tags: readonly string[];
  /**
   * Attributed to the company rather than to a person: no individual byline has
   * been confirmed for any of this editorial.
   */
  readonly author: string | null;
  /**
   * ISO 8601 timestamp with the newsroom's `+07:00` offset (or `YYYY-MM-DD`
   * for demo copy), or `null` while the date is unconfirmed.
   */
  readonly publishedAt: string | null;
  readonly image: PublicNewsImage;
  readonly featured: boolean;
  readonly sortOrder: number;
}

export interface PublicNewsListOptions {
  readonly categorySlug?: string;
  readonly featuredOnly?: boolean;
  readonly offset?: number;
  readonly limit?: number;
}

export interface PublicNewsRepository {
  list(
    locale: Locale,
    options?: PublicNewsListOptions,
  ): Promise<readonly PublicNewsArticle[]>;
  getById(locale: Locale, id: string): Promise<PublicNewsArticle | null>;
  getBySlug(locale: Locale, slug: string): Promise<PublicNewsArticle | null>;
}
