import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import type {
  LocalizedSiteSettingsDto,
  PersistenceMetadataDto,
} from "@/domains/content/persistence/dto";
import type {
  CreateSiteSettingsDraftInput,
  PublishSiteSettingsInput,
  ReturnSiteSettingsToDraftInput,
  SiteSettingsSocialLinkInput,
  SubmitSiteSettingsForReviewInput,
  UpdateSiteSettingsDraftInput,
} from "@/domains/content/settings/schemas";
import type { RevisionWorkflowStatus } from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";

export type SiteSettingsTranslationWorkflowStatus =
  "missing" | "draft" | "inReview" | "published";

export type SiteSettingsTranslationQualityDto = {
  locale: Locale;
  status: SiteSettingsTranslationWorkflowStatus;
  quality: "missing" | "ready";
};

export interface SiteSettingsAdminTranslationDto extends LocalizedSiteSettingsDto {
  status: Exclude<SiteSettingsTranslationWorkflowStatus, "missing">;
}

export interface SiteSettingsVersionDto extends PersistenceMetadataDto {
  version: number;
  status: RevisionWorkflowStatus;
  translations: readonly SiteSettingsAdminTranslationDto[];
  translationQuality: readonly SiteSettingsTranslationQualityDto[];
  publicEmail: string | null;
  publicPhone: string | null;
  socialLinks: readonly SiteSettingsSocialLinkInput[];
  publishedAt: string | null;
}

export type SiteSettingsAdminAggregateDto = {
  draft: SiteSettingsVersionDto | null;
  published: SiteSettingsVersionDto | null;
};

export type SiteSettingsStoreAccessScope = { kind: "all" } | { kind: "none" };

type StoreMutationMetadata = {
  actorId: string;
  occurredAt: Date;
};

export type CreateSiteSettingsDraftStoreInput = CreateSiteSettingsDraftInput &
  StoreMutationMetadata;
export type UpdateSiteSettingsDraftStoreInput = UpdateSiteSettingsDraftInput &
  StoreMutationMetadata;
export type SubmitSiteSettingsForReviewStoreInput =
  SubmitSiteSettingsForReviewInput & StoreMutationMetadata;
export type ReturnSiteSettingsToDraftStoreInput =
  ReturnSiteSettingsToDraftInput & StoreMutationMetadata;
export type PublishSiteSettingsStoreInput = PublishSiteSettingsInput &
  StoreMutationMetadata & {
    /** Persisted atomically with publication by the transactional store. */
    auditEvent: AuditEventInput;
  };

export interface SiteSettingsCommandStore {
  readCurrent(
    scope: SiteSettingsStoreAccessScope,
  ): Promise<SiteSettingsAdminAggregateDto>;
  createDraft(
    input: CreateSiteSettingsDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto>;
  updateDraft(
    scope: SiteSettingsStoreAccessScope,
    input: UpdateSiteSettingsDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto>;
  submitForReview(
    scope: SiteSettingsStoreAccessScope,
    input: SubmitSiteSettingsForReviewStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto>;
  returnToDraft(
    input: ReturnSiteSettingsToDraftStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto>;
  publish(
    input: PublishSiteSettingsStoreInput,
  ): Promise<SiteSettingsAdminAggregateDto>;
}

export type SiteSettingsMutationKind =
  | "draftCreated"
  | "draftUpdated"
  | "reviewSubmitted"
  | "reviewReturned"
  | "published";

export type SiteSettingsPostCommitEvent = {
  kind: SiteSettingsMutationKind;
  settingsId: string;
  version: number;
  locales: readonly Locale[];
  tags: readonly string[];
  requestId: string;
  occurredAt: Date;
};

export type SiteSettingsCommandServiceDependencies = {
  store: SiteSettingsCommandStore;
  auditRepository: AuditRepository;
  now?: () => Date;
  postCommit?: (event: SiteSettingsPostCommitEvent) => void | Promise<void>;
};

export const siteSettingsCommandStoreErrorCodes = [
  "NOT_FOUND",
  "DRAFT_EXISTS",
  "DRAFT_NOT_FOUND",
  "PUBLISHED_VERSION_IMMUTABLE",
  "STALE_REVISION",
  "INCOMPLETE_TRANSLATIONS",
  "PERSISTENCE_FAILURE",
] as const;

export type SiteSettingsCommandStoreErrorCode =
  (typeof siteSettingsCommandStoreErrorCodes)[number];

export class SiteSettingsCommandStoreError extends Error {
  readonly code: SiteSettingsCommandStoreErrorCode;

  constructor(code: SiteSettingsCommandStoreErrorCode, message: string) {
    super(message);
    this.name = "SiteSettingsCommandStoreError";
    this.code = code;
  }
}

/** The database write committed, but audit or revalidation work failed. */
export class SiteSettingsPostCommitError extends Error {
  readonly committed = true;
  readonly failures: readonly ("audit" | "postCommit")[];

  constructor(failures: readonly ("audit" | "postCommit")[]) {
    super(
      `The site-settings write committed, but post-commit work failed: ${failures.join(
        ", ",
      )}.`,
    );
    this.name = "SiteSettingsPostCommitError";
    this.failures = failures;
  }
}
