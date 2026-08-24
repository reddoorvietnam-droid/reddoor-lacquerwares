import type { AuditRepository } from "@/domains/audit/contracts";
import type {
  ArticleDto,
  ArticleRevisionDto,
  ArticleTranslationDto,
} from "@/domains/news/persistence/dto";
import type {
  CreateArticleDraftInput,
  CreateArticleRevisionDraftInput,
  ListArticlesInput,
  PublishArticleInput,
  ReturnArticleToDraftInput,
  SubmitArticleForReviewInput,
  UpdateArticleDraftInput,
} from "@/domains/news/commands/schemas";
import type { TranslationStatus } from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

export type ArticleStoreAccessScope =
  { kind: "all" } | { kind: "own"; ownerUserId: string } | { kind: "none" };

export type ArticleRevisionBundleDto = {
  revision: ArticleRevisionDto;
  translations: readonly ArticleTranslationDto[];
};

export type ArticleAdminAggregateDto = {
  article: ArticleDto;
  draft: ArticleRevisionBundleDto | null;
  published: ArticleRevisionBundleDto | null;
};

export type ArticleListDto = {
  items: readonly {
    article: ArticleDto;
    draftVersion: number | null;
    publishedVersion: number | null;
    translations: readonly {
      locale: Locale;
      title: string;
      status: TranslationStatus;
    }[];
  }[];
  offset: number;
  limit: number;
  total: number;
};

type StoreMutationMetadata = { actorId: string; occurredAt: Date };
export type CreateArticleDraftStoreInput = CreateArticleDraftInput &
  StoreMutationMetadata;
export type CreateArticleRevisionDraftStoreInput =
  CreateArticleRevisionDraftInput & StoreMutationMetadata;
export type UpdateArticleDraftStoreInput = UpdateArticleDraftInput &
  StoreMutationMetadata;
export type SubmitArticleForReviewStoreInput = SubmitArticleForReviewInput &
  StoreMutationMetadata;
export type ReturnArticleToDraftStoreInput = ReturnArticleToDraftInput &
  StoreMutationMetadata;
export type PublishArticleStoreInput = PublishArticleInput &
  StoreMutationMetadata & {
    requestId: string;
    permissionScope: "own" | "assignedBusinessUnits" | "all";
    businessUnitIds: readonly string[];
  };

export interface ArticleCommandStore {
  readonly publishesAuditAtomically?: boolean;
  listArticles(
    scope: ArticleStoreAccessScope,
    input: ListArticlesInput,
  ): Promise<ArticleListDto>;
  readArticle(
    scope: ArticleStoreAccessScope,
    articleId: string,
  ): Promise<ArticleAdminAggregateDto | null>;
  createDraft(
    input: CreateArticleDraftStoreInput,
  ): Promise<ArticleAdminAggregateDto>;
  createRevisionDraft(
    scope: ArticleStoreAccessScope,
    input: CreateArticleRevisionDraftStoreInput,
  ): Promise<ArticleAdminAggregateDto>;
  updateDraft(
    scope: ArticleStoreAccessScope,
    input: UpdateArticleDraftStoreInput,
  ): Promise<ArticleAdminAggregateDto>;
  submitForReview(
    scope: ArticleStoreAccessScope,
    input: SubmitArticleForReviewStoreInput,
  ): Promise<ArticleAdminAggregateDto>;
  returnToDraft(
    input: ReturnArticleToDraftStoreInput,
  ): Promise<ArticleAdminAggregateDto>;
  publish(input: PublishArticleStoreInput): Promise<ArticleAdminAggregateDto>;
}

export type ArticleMutationKind =
  | "draftCreated"
  | "revisionDraftCreated"
  | "draftUpdated"
  | "reviewSubmitted"
  | "reviewReturned"
  | "published";

export type ArticlePostCommitEvent = {
  entityType: "article";
  kind: ArticleMutationKind;
  articleId: string;
  internalId: string;
  locales: readonly Locale[];
  paths: readonly string[];
  tags: readonly string[];
  requestId: string;
  occurredAt: Date;
};

export type ArticleCommandServiceDependencies = {
  store: ArticleCommandStore;
  auditRepository: AuditRepository;
  now?: () => Date;
  postCommit?: (event: ArticlePostCommitEvent) => void | Promise<void>;
};

export type ArticleCommandStoreErrorCode =
  | "NOT_FOUND"
  | "IDENTIFIER_CONFLICT"
  | "DRAFT_EXISTS"
  | "DRAFT_NOT_FOUND"
  | "PUBLISHED_IMMUTABLE"
  | "STALE_REVISION"
  | "ROUTE_UNAVAILABLE"
  | "PERSISTENCE_FAILURE";

export class ArticleCommandStoreError extends Error {
  readonly code: ArticleCommandStoreErrorCode;
  constructor(code: ArticleCommandStoreErrorCode, message: string) {
    super(message);
    this.name = "ArticleCommandStoreError";
    this.code = code;
  }
}

export class ArticlePostCommitError extends Error {
  readonly committed = true;
  readonly failures: readonly ("audit" | "postCommit")[];
  constructor(failures: readonly ("audit" | "postCommit")[]) {
    super(
      `The article write committed, but post-commit work failed: ${failures.join(
        ", ",
      )}.`,
    );
    this.name = "ArticlePostCommitError";
    this.failures = failures;
  }
}
