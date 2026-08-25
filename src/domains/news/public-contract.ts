import type { Locale } from "@/lib/i18n/config";

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
}

export interface PublicNewsParagraph {
  readonly type: "paragraph";
  readonly text: string;
}

export type PublicNewsContentBlock = PublicNewsParagraph;

export interface PublicNewsArticle {
  readonly id: string;
  readonly marker: PublicNewsMarker;
  readonly isDemo: boolean;
  readonly locale: Locale;
  readonly slug: string;
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
  /** ISO `YYYY-MM-DD`, or `null` while the date is unconfirmed. */
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
