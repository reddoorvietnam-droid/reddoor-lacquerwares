import type { Locale } from "@/lib/i18n/config";

/**
 * `"DEMO"` marks copy that is a stand-in and must not be read as a company
 * statement; `null` marks copy the company stands behind. Mirrors
 * `PublicContentMarker` in the content domain, but is declared here so the two
 * domains stay independent of each other.
 */
export type PublicCollectionMarker = "DEMO" | null;

export interface PublicCollectionCover {
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

/**
 * `"availableOnRequest"` says the catalogue exists but is not yet hosted here;
 * `"notConfigured"` says no catalogue has been published for this collection at
 * all. The two must not be collapsed — one is a fact about the company, the
 * other is a fact about this site.
 */
export type PublicFlipbookStatus = "notConfigured" | "availableOnRequest";

export interface PublicFlipbookPreview {
  readonly status: PublicFlipbookStatus;
  readonly pdfUrl: string | null;
  readonly pageCount: number | null;
  readonly downloadAllowed: boolean;
  /** Localized sentence explaining how a reader actually gets the catalogue. */
  readonly availabilityNote: string;
}

export interface PublicCollection {
  readonly id: string;
  readonly marker: PublicCollectionMarker;
  readonly isDemo: boolean;
  readonly locale: Locale;
  readonly slug: string;
  readonly title: string;
  readonly editionLabel: string;
  /** `null` unless the company has confirmed the edition year. */
  readonly year: number | null;
  readonly summary: string;
  /** Editorial introduction, split at its paragraph breaks. */
  readonly introParagraphs: readonly string[];
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
