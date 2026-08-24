import type { Locale } from "@/lib/i18n/config";

export interface PublicCollectionCover {
  readonly assetKey: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly isDemo: true;
  readonly replacementHint: string;
}

export interface PublicFlipbookPreview {
  readonly status: "notConfigured";
  readonly pdfUrl: null;
  readonly pageCount: null;
  readonly downloadAllowed: false;
}

export interface PublicCollection {
  readonly id: string;
  readonly marker: "DEMO";
  readonly isDemo: true;
  readonly locale: Locale;
  readonly slug: string;
  readonly title: string;
  readonly editionLabel: string;
  readonly year: number | null;
  readonly summary: string;
  readonly cover: PublicCollectionCover;
  readonly productIds: readonly string[];
  readonly flipbook: PublicFlipbookPreview;
  readonly featured: boolean;
  readonly sortOrder: number;
}

export interface PublicCollectionListOptions {
  readonly featuredOnly?: boolean;
  readonly limit?: number;
}

export interface PublicCollectionRepository {
  list(
    locale: Locale,
    options?: PublicCollectionListOptions,
  ): Promise<readonly PublicCollection[]>;
  getById(locale: Locale, id: string): Promise<PublicCollection | null>;
  getBySlug(locale: Locale, slug: string): Promise<PublicCollection | null>;
}
