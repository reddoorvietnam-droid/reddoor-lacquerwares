"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ContentEditorActionState } from "@/components/admin";
import {
  ContentCommandStoreError,
  ContentPostCommitError,
  expectedTranslationRevisionSchema,
} from "@/domains/content/commands";
import { contentCommandService } from "@/domains/content/runtime";
import { ContentWorkflowError } from "@/domains/content/workflow";
import {
  ContentAccessDeniedError,
  requireContentPermission,
  type AccessContext,
} from "@/lib/auth";
import { objectIdStringSchema } from "@/lib/content/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";
import { parseContentEditorFormData } from "@/app/[locale]/admin/(portal)/content/form-data";

const optimisticRevisionSchema = z.coerce.number().int().min(0);

const workflowFormSchema = z
  .object({
    entryId: objectIdStringSchema,
    revisionId: objectIdStringSchema,
    expectedEntryRevision: optimisticRevisionSchema,
    expectedRevision: optimisticRevisionSchema,
    expectedTranslations: z.array(expectedTranslationRevisionSchema).min(1),
  })
  .strict();

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseWorkflowForm(formData: FormData) {
  return workflowFormSchema.parse({
    entryId: text(formData, "entryId"),
    revisionId: text(formData, "revisionId"),
    expectedEntryRevision: text(formData, "expectedEntryRevision"),
    expectedRevision: text(formData, "expectedRevision"),
    expectedTranslations: parseJson(text(formData, "expectedTranslations")),
  });
}

function zodFieldErrors(error: z.ZodError): Record<string, readonly string[]> {
  const grouped = new Map<string, string[]>();

  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    grouped.set(path, [...(grouped.get(path) ?? []), issue.message]);
  }

  return Object.fromEntries(grouped);
}

function actionError(
  locale: AdminLocale,
  error: unknown,
): ContentEditorActionState {
  const copy = getAdminDictionary(locale).actions;

  if (error instanceof z.ZodError) {
    return {
      status: "error",
      message: copy.invalid,
      fieldErrors: zodFieldErrors(error),
    };
  }

  if (error instanceof ContentAccessDeniedError) {
    return { status: "error", message: copy.denied };
  }

  if (error instanceof ContentPostCommitError) {
    return { status: "error", message: copy.committedWarning };
  }

  if (error instanceof ContentWorkflowError) {
    return {
      status: "error",
      message: error.code === "STALE_REVISION" ? copy.conflict : copy.invalid,
    };
  }

  if (error instanceof ContentCommandStoreError) {
    if (error.code === "NOT_FOUND" || error.code === "DRAFT_NOT_FOUND") {
      return { status: "error", message: copy.notFound };
    }

    if (
      error.code === "STALE_REVISION" ||
      error.code === "DRAFT_EXISTS" ||
      error.code === "CODE_CONFLICT"
    ) {
      return { status: "error", message: copy.conflict };
    }

    return { status: "error", message: copy.invalid };
  }

  return { status: "error", message: copy.unexpected };
}

async function readForMutation(entryId: string): Promise<{
  readContext: AccessContext;
  aggregate: NonNullable<
    Awaited<ReturnType<typeof contentCommandService.readEntry>>
  >;
}> {
  const readContext = await requireContentPermission("content.read");
  const aggregate = await contentCommandService.readEntry(readContext, {
    entryId,
  });

  if (!aggregate) {
    throw new ContentCommandStoreError(
      "NOT_FOUND",
      "The requested content entry was not found.",
    );
  }

  return { readContext, aggregate };
}

async function mutationContext(
  permission: "content.update" | "content.review" | "content.publish",
  entryId: string,
  ownerUserId: string,
): Promise<AccessContext> {
  return requireContentPermission(permission, {
    resourceId: entryId,
    ownerUserId,
  });
}

export async function saveContentDraftAction(
  locale: AdminLocale,
  previousState: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  void previousState;
  let destination: Route;

  try {
    const command = parseContentEditorFormData(formData);

    if (command.mode === "create") {
      const context = await requireContentPermission("content.create");
      const aggregate = await contentCommandService.createEntryDraft(
        context,
        command.input,
      );
      destination =
        `/${locale}/admin/content/${aggregate.entry.id}?saved=1` as Route;
    } else {
      const { aggregate } = await readForMutation(command.input.entryId);
      const context = await mutationContext(
        "content.update",
        aggregate.entry.id,
        aggregate.entry.createdBy,
      );
      await contentCommandService.updateDraft(context, command.input);
      destination =
        `/${locale}/admin/content/${aggregate.entry.id}?saved=1` as Route;
    }
  } catch (error) {
    return actionError(locale, error);
  }

  redirect(destination);
}

export async function submitContentForReviewAction(
  locale: AdminLocale,
  previousState: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  void previousState;
  let destination: Route;

  try {
    const input = parseWorkflowForm(formData);
    const { aggregate } = await readForMutation(input.entryId);
    const context = await mutationContext(
      "content.update",
      aggregate.entry.id,
      aggregate.entry.createdBy,
    );
    await contentCommandService.submitForReview(context, input);
    destination =
      `/${locale}/admin/content/${input.entryId}?submitted=1` as Route;
  } catch (error) {
    return actionError(locale, error);
  }

  redirect(destination);
}

export async function createContentRevisionAction(
  locale: AdminLocale,
  previousState: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  void previousState;
  let destination: Route;

  try {
    const workflow = parseWorkflowForm(formData);
    const { aggregate } = await readForMutation(workflow.entryId);
    if (!aggregate.published || aggregate.draft) {
      throw new ContentCommandStoreError(
        aggregate.draft ? "DRAFT_EXISTS" : "NOT_FOUND",
        "A new revision requires one published version and no existing draft.",
      );
    }

    const context = await mutationContext(
      "content.update",
      aggregate.entry.id,
      aggregate.entry.createdBy,
    );
    const published = aggregate.published;
    await contentCommandService.createRevisionDraft(context, {
      entryId: aggregate.entry.id,
      expectedEntryRevision: workflow.expectedEntryRevision,
      sourceLocale: published.revision.sourceLocale,
      blocks: published.revision.blocks,
      translations: published.translations.map((translation) => ({
        locale: translation.locale,
        ...(translation.slug ? { slug: translation.slug } : {}),
        title: translation.title,
        ...(translation.summary ? { summary: translation.summary } : {}),
        blocks: translation.blocks,
        seo: translation.seo,
      })),
    });
    destination =
      `/${locale}/admin/content/${aggregate.entry.id}?revision=1` as Route;
  } catch (error) {
    return actionError(locale, error);
  }

  redirect(destination);
}

export async function returnContentToDraftAction(
  locale: AdminLocale,
  previousState: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  void previousState;
  let destination: Route;

  try {
    const input = {
      ...parseWorkflowForm(formData),
      reason: z
        .string()
        .trim()
        .min(1)
        .max(2_000)
        .parse(text(formData, "reason")),
    };
    const { aggregate } = await readForMutation(input.entryId);
    const context = await mutationContext(
      "content.review",
      aggregate.entry.id,
      aggregate.entry.createdBy,
    );
    await contentCommandService.returnToDraft(context, input);
    destination =
      `/${locale}/admin/content/${input.entryId}?returned=1` as Route;
  } catch (error) {
    return actionError(locale, error);
  }

  redirect(destination);
}

export async function publishContentAction(
  locale: AdminLocale,
  previousState: ContentEditorActionState,
  formData: FormData,
): Promise<ContentEditorActionState> {
  void previousState;
  let destination: Route;

  try {
    const input = parseWorkflowForm(formData);
    const { aggregate } = await readForMutation(input.entryId);
    const draft = aggregate.draft;
    if (!draft || draft.revision.id !== input.revisionId) {
      throw new ContentCommandStoreError(
        "DRAFT_NOT_FOUND",
        "The requested content draft was not found.",
      );
    }

    const context = await mutationContext(
      "content.publish",
      aggregate.entry.id,
      aggregate.entry.createdBy,
    );
    const requiresRoute =
      aggregate.entry.type === "page" ||
      aggregate.entry.type === "processStage";
    const routes = requiresRoute
      ? draft.translations.map((translation) => {
          if (!translation.slug) {
            throw new ContentWorkflowError(
              "ROUTE_UNAVAILABLE",
              "A published page translation requires a slug.",
            );
          }

          return {
            locale: translation.locale,
            path:
              aggregate.entry.type === "processStage"
                ? `/${translation.locale}/process/${translation.slug}`
                : `/${translation.locale}/${translation.slug}`,
          };
        })
      : [];

    await contentCommandService.publish(context, { ...input, routes });
    destination = `/${locale}/admin/content?published=1` as Route;
  } catch (error) {
    return actionError(locale, error);
  }

  redirect(destination);
}
