import type { Locale } from "@/lib/i18n/config";

/**
 * `"DEMO"` marks copy that is a stand-in and must not be read as a company
 * statement; `null` marks copy the company stands behind. Mirrors
 * `PublicContentMarker` in the content domain, but is declared here so the two
 * domains stay independent of each other.
 */
export type PublicProductMarker = "DEMO" | null;

/** Mirrors `ProductGroup` in the content contracts, kept local by design. */
export type PublicProductGroup = "processing" | "develop";

export interface PublicProductImage {
  /** Stable file name the final photograph should be saved as. */
  readonly assetKey: string;
  /** Delivered image, or `null` while the photograph is still outstanding. */
  readonly src: string | null;
  readonly alt: string;
  /** Intended pixel size; the layout reserves this box either way. */
  readonly width: number;
  readonly height: number;
  readonly isPrimary: boolean;
  /** True until a real photograph replaces the reserved slot. */
  readonly assetPending: boolean;
  readonly replacementHint: string;
}

export interface PublicProductDimensions {
  readonly width: string;
  readonly height: string;
  readonly depth: string;
  readonly unit: "mm" | "cm";
}

export interface PublicProductPrice {
  readonly amountMinor: string;
  readonly currency: "VND" | "USD" | "EUR";
}

/**
 * Unlike a still, a video has no "reserved slot" state: the player needs a real
 * source or nothing at all, so `PublicProduct.video` is `null` until a file
 * exists and `src` stays a required string.
 */
export interface PublicProductVideo {
  readonly assetKey: string;
  readonly src: string;
  readonly mimeType: "video/mp4" | "video/webm";
  readonly title: string;
  readonly poster: PublicProductImage | null;
  readonly captionsSrc: string | null;
  readonly captionsLanguage: Locale;
  readonly replacementHint: string;
}

export interface PublicProductVariant {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface PublicProductProcessStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface PublicProduct {
  readonly id: string;
  readonly marker: PublicProductMarker;
  readonly isDemo: boolean;
  readonly locale: Locale;
  readonly slug: string;
  /**
   * `null` until the company confirms its own catalogue references. A public
   * page must never show an invented SKU.
   */
  readonly internalReference: string | null;
  readonly name: string;
  /**
   * Which part of the catalogue the piece sits in. Distinct from the CMS
   * workflow status: everything reaching this contract is already published.
   */
  readonly group: PublicProductGroup;
  /** True when the piece ships from stock rather than being made to order. */
  readonly isAvailable: boolean;
  readonly categorySlug: string;
  readonly categoryLabel: string;
  readonly summary: string;
  /**
   * The long description as one string, kept so consumers written before
   * `storyParagraphs` existed keep rendering the whole text rather than a
   * truncated version of it.
   */
  readonly story: string;
  /** The same description split at its paragraph breaks. Prefer this. */
  readonly storyParagraphs: readonly string[];
  readonly materialLabels: readonly string[];
  readonly finishLabel: string;
  /** One instruction per entry, written to be shown as a list. */
  readonly careNotes: readonly string[];
  readonly quoteCallToAction: string;
  /** `null` unless the company has confirmed the measurements. */
  readonly dimensions: PublicProductDimensions | null;
  readonly leadTime: string | null;
  /** Every catalogue product is quoted against a specification. */
  readonly showPrice: false;
  readonly price: PublicProductPrice | null;
  readonly images: readonly PublicProductImage[];
  readonly video: PublicProductVideo | null;
  readonly variants: readonly PublicProductVariant[];
  readonly processSteps: readonly PublicProductProcessStep[];
  readonly tags: readonly string[];
  readonly collectionIds: readonly string[];
  readonly featured: boolean;
  readonly sortOrder: number;
}

export interface PublicProductListOptions {
  readonly featuredOnly?: boolean;
  readonly group?: PublicProductGroup;
  readonly availableOnly?: boolean;
  readonly collectionId?: string;
  readonly categorySlug?: string;
  readonly limit?: number;
}

export interface PublicProductRepository {
  list(
    locale: Locale,
    options?: PublicProductListOptions,
  ): Promise<readonly PublicProduct[]>;
  getById(locale: Locale, id: string): Promise<PublicProduct | null>;
  getBySlug(locale: Locale, slug: string): Promise<PublicProduct | null>;
}
