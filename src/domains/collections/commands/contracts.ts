import type { AuditRepository } from "@/domains/audit/contracts";
import type {
  CollectionDto,
  CollectionTranslationDto,
} from "@/domains/collections/persistence/dto";
import type {
  CreateCollectionDraftInput,
  CreateCollectionRevisionDraftInput,
  ListCollectionsInput,
  PublishCollectionInput,
  ReturnCollectionToDraftInput,
  SubmitCollectionForReviewInput,
  UpdateCollectionDraftInput,
} from "@/domains/collections/commands/schemas";
import type { Locale } from "@/lib/i18n/config";

export type CollectionStoreAccessScope =
  { kind: "all" } | { kind: "own"; ownerUserId: string } | { kind: "none" };

export type CollectionAdminAggregateDto = {
  collection: CollectionDto;
  draftTranslations: readonly CollectionTranslationDto[];
  publishedTranslations: readonly CollectionTranslationDto[];
};

export type CollectionListDto = {
  items: readonly CollectionAdminAggregateDto[];
  offset: number;
  limit: number;
  total: number;
};

type StoreMutationMetadata = { actorId: string; occurredAt: Date };
export type CreateCollectionDraftStoreInput = CreateCollectionDraftInput &
  StoreMutationMetadata;
export type CreateCollectionRevisionDraftStoreInput =
  CreateCollectionRevisionDraftInput & StoreMutationMetadata;
export type UpdateCollectionDraftStoreInput = UpdateCollectionDraftInput &
  StoreMutationMetadata;
export type SubmitCollectionForReviewStoreInput =
  SubmitCollectionForReviewInput & StoreMutationMetadata;
export type ReturnCollectionToDraftStoreInput = ReturnCollectionToDraftInput &
  StoreMutationMetadata;
export type PublishCollectionStoreInput = PublishCollectionInput &
  StoreMutationMetadata & {
    requestId: string;
    permissionScope: "own" | "assignedBusinessUnits" | "all";
    businessUnitIds: readonly string[];
  };

export interface CollectionCommandStore {
  readonly publishesAuditAtomically?: boolean;
  listCollections(
    scope: CollectionStoreAccessScope,
    input: ListCollectionsInput,
  ): Promise<CollectionListDto>;
  readCollection(
    scope: CollectionStoreAccessScope,
    collectionId: string,
  ): Promise<CollectionAdminAggregateDto | null>;
  createDraft(
    input: CreateCollectionDraftStoreInput,
  ): Promise<CollectionAdminAggregateDto>;
  createRevisionDraft(
    scope: CollectionStoreAccessScope,
    input: CreateCollectionRevisionDraftStoreInput,
  ): Promise<CollectionAdminAggregateDto>;
  updateDraft(
    scope: CollectionStoreAccessScope,
    input: UpdateCollectionDraftStoreInput,
  ): Promise<CollectionAdminAggregateDto>;
  submitForReview(
    scope: CollectionStoreAccessScope,
    input: SubmitCollectionForReviewStoreInput,
  ): Promise<CollectionAdminAggregateDto>;
  returnToDraft(
    input: ReturnCollectionToDraftStoreInput,
  ): Promise<CollectionAdminAggregateDto>;
  publish(
    input: PublishCollectionStoreInput,
  ): Promise<CollectionAdminAggregateDto>;
}

export type CollectionMutationKind =
  | "draftCreated"
  | "revisionDraftCreated"
  | "draftUpdated"
  | "reviewSubmitted"
  | "reviewReturned"
  | "published";

export type CollectionPostCommitEvent = {
  entityType: "collection";
  kind: CollectionMutationKind;
  collectionId: string;
  code: string;
  locales: readonly Locale[];
  paths: readonly string[];
  tags: readonly string[];
  requestId: string;
  occurredAt: Date;
};

export type CollectionCommandServiceDependencies = {
  store: CollectionCommandStore;
  auditRepository: AuditRepository;
  now?: () => Date;
  postCommit?: (event: CollectionPostCommitEvent) => void | Promise<void>;
};

export type CollectionCommandStoreErrorCode =
  | "NOT_FOUND"
  | "IDENTIFIER_CONFLICT"
  | "DRAFT_EXISTS"
  | "DRAFT_NOT_FOUND"
  | "PUBLISHED_IMMUTABLE"
  | "STALE_REVISION"
  | "ROUTE_UNAVAILABLE"
  | "PERSISTENCE_FAILURE";

export class CollectionCommandStoreError extends Error {
  readonly code: CollectionCommandStoreErrorCode;
  constructor(code: CollectionCommandStoreErrorCode, message: string) {
    super(message);
    this.name = "CollectionCommandStoreError";
    this.code = code;
  }
}

export class CollectionPostCommitError extends Error {
  readonly committed = true;
  readonly failures: readonly ("audit" | "postCommit")[];
  constructor(failures: readonly ("audit" | "postCommit")[]) {
    super(
      `The collection write committed, but post-commit work failed: ${failures.join(
        ", ",
      )}.`,
    );
    this.name = "CollectionPostCommitError";
    this.failures = failures;
  }
}
