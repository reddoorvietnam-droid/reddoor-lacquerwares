import type { Locale } from "@/lib/i18n/config";

export interface PublicProductImage {
  readonly assetKey: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly isPrimary: boolean;
  readonly isDemo: true;
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

export interface PublicProductVideo {
  readonly assetKey: string;
  readonly src: string;
  readonly mimeType: "video/mp4" | "video/webm";
  readonly title: string;
  readonly poster: PublicProductImage | null;
  readonly captionsSrc: string | null;
  readonly captionsLanguage: Locale;
  readonly isDemo: true;
  readonly replacementHint: string;
}

export interface PublicProductVariant {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly isDemo: true;
}

export interface PublicProductProcessStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly isDemo: true;
}

export interface PublicProduct {
  readonly id: string;
  readonly marker: "DEMO";
  readonly isDemo: true;
  readonly locale: Locale;
  readonly slug: string;
  readonly internalReference: string;
  readonly name: string;
  readonly categorySlug: string;
  readonly categoryLabel: string;
  readonly summary: string;
  readonly story: string;
  readonly materialLabels: readonly string[];
  readonly finishLabel: string;
  readonly dimensions: PublicProductDimensions | null;
  readonly leadTime: string | null;
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
