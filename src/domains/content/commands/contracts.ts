import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import type {
  ContentEntryDto,
  ContentRevisionDto,
  ContentTranslationDto,
} from "@/domains/content/persistence/dto";
import type {
  CreateEntryDraftInput,
  CreateRevisionDraftInput,
  ListContentEntriesInput,
  PublishContentInput,
  ReturnToDraftInput,
  SubmitForReviewInput,
  UpdateDraftInput,
} from "@/domains/content/commands/schemas";
import type { TranslationStatus } from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

export type ContentStoreAccessScope =
  { kind: "all" } | { kind: "own"; ownerUserId: string } | { kind: "none" };

export type ContentRevisionBundleDto = {
  revision: ContentRevisionDto;
  translations: readonly ContentTranslationDto[];
};

export type ContentAdminAggregateDto = {
  entry: ContentEntryDto;
  draft: ContentRevisionBundleDto | null;
  published: ContentRevisionBundleDto | null;
};

export type ContentTranslationStatusSummaryDto = {
  locale: Locale;
  title: string;
  status: TranslationStatus;
};

export type ContentEntryListItemDto = {
  entry: ContentEntryDto;
  draftVersion: number | null;
  publishedVersion: number | null;
  translations: readonly ContentTranslationStatusSummaryDto[];
};

export type ContentEntryListDto = {
  items: readonly ContentEntryListItemDto[];
  offset: number;
  limit: number;
  total: number;
};

type StoreMutationMetadata = {
  actorId: string;
  occurredAt: Date;
};

export type CreateEntryDraftStoreInput = CreateEntryDraftInput &
  StoreMutationMetadata;
export type CreateRevisionDraftStoreInput = CreateRevisionDraftInput &
  StoreMutationMetadata;
export type UpdateDraftStoreInput = UpdateDraftInput & StoreMutationMetadata;
export type SubmitForReviewStoreInput = SubmitForReviewInput &
  StoreMutationMetadata;
export type ReturnToDraftStoreInput = ReturnToDraftInput &
  StoreMutationMetadata;
export type PublishContentStoreInput = PublishContentInput &
  StoreMutationMetadata & {
    /** Must be appended in the same transaction as routes and pointers. */
    auditEvent: AuditEventInput;
  };

export interface ContentCommandStore {
  listEntries(
    scope: ContentStoreAccessScope,
    input: ListContentEntriesInput,
  ): Promise<ContentEntryListDto>;
  readEntry(
    scope: ContentStoreAccessScope,
    entryId: string,
  ): Promise<ContentAdminAggregateDto | null>;
  createEntryDraft(
    input: CreateEntryDraftStoreInput,
  ): Promise<ContentAdminAggregateDto>;
  createRevisionDraft(
    scope: ContentStoreAccessScope,
    input: CreateRevisionDraftStoreInput,
  ): Promise<ContentAdminAggregateDto>;
  updateDraft(
    scope: ContentStoreAccessScope,
    input: UpdateDraftStoreInput,
  ): Promise<ContentAdminAggregateDto>;
  submitForReview(
    scope: ContentStoreAccessScope,
    input: SubmitForReviewStoreInput,
  ): Promise<ContentAdminAggregateDto>;
  returnToDraft(
    input: ReturnToDraftStoreInput,
  ): Promise<ContentAdminAggregateDto>;
  publish(input: PublishContentStoreInput): Promise<ContentAdminAggregateDto>;
}

export type ContentMutationKind =
  | "entryDraftCreated"
  | "revisionDraftCreated"
  | "draftUpdated"
  | "reviewSubmitted"
  | "reviewReturned"
  | "published";

export type ContentPostCommitEvent = {
  kind: ContentMutationKind;
  entryId: string;
  code: string;
  locales: readonly Locale[];
  paths: readonly string[];
  tags: readonly string[];
  requestId: string;
  occurredAt: Date;
};

export type ContentCommandServiceDependencies = {
  store: ContentCommandStore;
  auditRepository: AuditRepository;
  now?: () => Date;
  postCommit?: (event: ContentPostCommitEvent) => void | Promise<void>;
};

export const contentCommandStoreErrorCodes = [
  "NOT_FOUND",
  "CODE_CONFLICT",
  "DRAFT_EXISTS",
  "DRAFT_NOT_FOUND",
  "PUBLISHED_REVISION_IMMUTABLE",
  "STALE_REVISION",
  "ROUTE_UNAVAILABLE",
  "PERSISTENCE_FAILURE",
] as const;

export type ContentCommandStoreErrorCode =
  (typeof contentCommandStoreErrorCodes)[number];

export class ContentCommandStoreError extends Error {
  readonly code: ContentCommandStoreErrorCode;

  constructor(code: ContentCommandStoreErrorCode, message: string) {
    super(message);
    this.name = "ContentCommandStoreError";
    this.code = code;
  }
}

/** A write committed, but audit persistence or cache invalidation failed. */
export class ContentPostCommitError extends Error {
  readonly committed = true;
  readonly failures: readonly ("audit" | "postCommit")[];

  constructor(failures: readonly ("audit" | "postCommit")[]) {
    super(
      `The content write committed, but post-commit work failed: ${failures.join(
        ", ",
      )}.`,
    );
    this.name = "ContentPostCommitError";
    this.failures = failures;
  }
}
