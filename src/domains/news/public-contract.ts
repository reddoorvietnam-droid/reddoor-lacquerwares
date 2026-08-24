import type { Locale } from "@/lib/i18n/config";

export interface PublicNewsImage {
  readonly assetKey: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly isDemo: true;
  readonly replacementHint: string;
}

export interface PublicNewsParagraph {
  readonly type: "paragraph";
  readonly text: string;
}

export type PublicNewsContentBlock = PublicNewsParagraph;

export interface PublicNewsArticle {
  readonly id: string;
  readonly marker: "DEMO";
  readonly isDemo: true;
  readonly locale: Locale;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly content: readonly PublicNewsContentBlock[];
  readonly categorySlug: string;
  readonly categoryLabel: string;
  readonly tags: readonly string[];
  readonly author: string | null;
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
