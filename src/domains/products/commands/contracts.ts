import type { AuditRepository } from "@/domains/audit/contracts";
import type {
  ProductDto,
  ProductTranslationDto,
  ProductVersionDto,
} from "@/domains/products/persistence/dto";
import type {
  CreateProductDraftInput,
  CreateProductRevisionDraftInput,
  ListProductsInput,
  PublishProductInput,
  ReturnProductToDraftInput,
  SubmitProductForReviewInput,
  UpdateProductDraftInput,
} from "@/domains/products/commands/schemas";
import type { TranslationStatus } from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

export type ProductStoreAccessScope =
  { kind: "all" } | { kind: "own"; ownerUserId: string } | { kind: "none" };

export type ProductVersionBundleDto = {
  version: ProductVersionDto;
  translations: readonly ProductTranslationDto[];
};

export type ProductAdminAggregateDto = {
  product: ProductDto;
  draft: ProductVersionBundleDto | null;
  published: ProductVersionBundleDto | null;
};

export type ProductTranslationStatusSummaryDto = {
  locale: Locale;
  title: string;
  status: TranslationStatus;
};

export type ProductListItemDto = {
  product: ProductDto;
  draftVersion: number | null;
  publishedVersion: number | null;
  translations: readonly ProductTranslationStatusSummaryDto[];
};

export type ProductListDto = {
  items: readonly ProductListItemDto[];
  offset: number;
  limit: number;
  total: number;
};

type StoreMutationMetadata = { actorId: string; occurredAt: Date };

export type CreateProductDraftStoreInput = CreateProductDraftInput &
  StoreMutationMetadata;
export type CreateProductRevisionDraftStoreInput =
  CreateProductRevisionDraftInput & StoreMutationMetadata;
export type UpdateProductDraftStoreInput = UpdateProductDraftInput &
  StoreMutationMetadata;
export type SubmitProductForReviewStoreInput = SubmitProductForReviewInput &
  StoreMutationMetadata;
export type ReturnProductToDraftStoreInput = ReturnProductToDraftInput &
  StoreMutationMetadata;
export type PublishProductStoreInput = PublishProductInput &
  StoreMutationMetadata & {
    requestId: string;
    permissionScope: "own" | "assignedBusinessUnits" | "all";
    businessUnitIds: readonly string[];
  };

export interface ProductCommandStore {
  readonly publishesAuditAtomically?: boolean;
  listProducts(
    scope: ProductStoreAccessScope,
    input: ListProductsInput,
  ): Promise<ProductListDto>;
  readProduct(
    scope: ProductStoreAccessScope,
    productId: string,
  ): Promise<ProductAdminAggregateDto | null>;
  createDraft(
    input: CreateProductDraftStoreInput,
  ): Promise<ProductAdminAggregateDto>;
  createRevisionDraft(
    scope: ProductStoreAccessScope,
    input: CreateProductRevisionDraftStoreInput,
  ): Promise<ProductAdminAggregateDto>;
  updateDraft(
    scope: ProductStoreAccessScope,
    input: UpdateProductDraftStoreInput,
  ): Promise<ProductAdminAggregateDto>;
  submitForReview(
    scope: ProductStoreAccessScope,
    input: SubmitProductForReviewStoreInput,
  ): Promise<ProductAdminAggregateDto>;
  returnToDraft(
    input: ReturnProductToDraftStoreInput,
  ): Promise<ProductAdminAggregateDto>;
  publish(input: PublishProductStoreInput): Promise<ProductAdminAggregateDto>;
}

export type ProductMutationKind =
  | "draftCreated"
  | "revisionDraftCreated"
  | "draftUpdated"
  | "reviewSubmitted"
  | "reviewReturned"
  | "published";

export type ProductPostCommitEvent = {
  entityType: "product";
  kind: ProductMutationKind;
  productId: string;
  sku: string;
  locales: readonly Locale[];
  paths: readonly string[];
  tags: readonly string[];
  requestId: string;
  occurredAt: Date;
};

export type ProductCommandServiceDependencies = {
  store: ProductCommandStore;
  auditRepository: AuditRepository;
  now?: () => Date;
  postCommit?: (event: ProductPostCommitEvent) => void | Promise<void>;
};

export const productCommandStoreErrorCodes = [
  "NOT_FOUND",
  "IDENTIFIER_CONFLICT",
  "DRAFT_EXISTS",
  "DRAFT_NOT_FOUND",
  "PUBLISHED_IMMUTABLE",
  "STALE_REVISION",
  "ROUTE_UNAVAILABLE",
  "PERSISTENCE_FAILURE",
] as const;

export type ProductCommandStoreErrorCode =
  (typeof productCommandStoreErrorCodes)[number];

export class ProductCommandStoreError extends Error {
  readonly code: ProductCommandStoreErrorCode;

  constructor(code: ProductCommandStoreErrorCode, message: string) {
    super(message);
    this.name = "ProductCommandStoreError";
    this.code = code;
  }
}

export class ProductPostCommitError extends Error {
  readonly committed = true;
  readonly failures: readonly ("audit" | "postCommit")[];

  constructor(failures: readonly ("audit" | "postCommit")[]) {
    super(
      `The product write committed, but post-commit work failed: ${failures.join(
        ", ",
      )}.`,
    );
    this.name = "ProductPostCommitError";
    this.failures = failures;
  }
}
