import type {
  ProductStatus,
  RevisionWorkflowStatus,
  SeoFields,
  StructuredBlock,
  TranslationStatus,
} from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

export interface ProductDto {
  id: string;
  internalId: string;
  sku: string;
  categoryId: string | null;
  collectionIds: string[];
  materialKeys: string[];
  finishKeys: string[];
  searchTokens: string[];
  status: ProductStatus;
  currentDraftVersionId: string | null;
  currentPublishedVersionId: string | null;
  deletedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ProductVersionDto {
  id: string;
  productId: string;
  version: number;
  status: RevisionWorkflowStatus;
  dimensions: {
    length: string | null;
    width: string | null;
    height: string | null;
    unit: "mm" | "cm" | "m" | "in";
  } | null;
  weight: {
    value: string;
    unit: "g" | "kg" | "lb";
  } | null;
  materials: string[];
  colors: string[];
  finishes: string[];
  leadTimeDays: number | null;
  mediaIds: string[];
  showPrice: boolean;
  publicPrice: {
    amount: string;
    currency: "VND" | "USD" | "EUR";
  } | null;
  relatedProductIds: string[];
  bomVersionId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ProductTranslationDto {
  id: string;
  productId: string;
  versionId: string;
  locale: Locale;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: StructuredBlock[];
  story: StructuredBlock[];
  careInstructions: StructuredBlock[];
  translationStatus: TranslationStatus;
  sourceRevision: number;
  reviewedBy: string | null;
  publishedAt: string | null;
  seo: SeoFields;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface PublishedProductDto {
  product: ProductDto;
  version: ProductVersionDto;
  translation: ProductTranslationDto;
}
