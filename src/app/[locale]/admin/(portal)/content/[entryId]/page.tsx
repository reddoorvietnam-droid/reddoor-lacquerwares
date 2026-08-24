import { notFound } from "next/navigation";

import {
  AdminAccessState,
  ContentEditor,
  ContentWorkflowActions,
} from "@/components/admin";
import { contentCommandService } from "@/domains/content/runtime";
import type { StructuredBlock } from "@/lib/content/contracts";
import { isLocale, locales } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";
import { resolveLeafContentAccess } from "@/app/[locale]/admin/(portal)/content/access";
import {
  createContentRevisionAction,
  publishContentAction,
  returnContentToDraftAction,
  saveContentDraftAction,
  submitContentForReviewAction,
} from "@/app/[locale]/admin/(portal)/content/actions";

function blocksToEditorText(blocks: readonly StructuredBlock[]): string {
  return blocks
    .flatMap((block) => {
      if (block.type === "paragraph" || block.type === "heading") {
        return [block.text];
      }
      if (block.type === "quote") return [block.text];
      if (block.type === "list") return [block.items.join("\n")];
      return [];
    })
    .join("\n\n");
}

function supportsPlainTextEditor(blocks: readonly StructuredBlock[]): boolean {
  return blocks.every((block) => block.type === "paragraph");
}

export default async function EditContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; entryId: string }>;
  searchParams: Promise<{
    saved?: string;
    submitted?: string;
    returned?: string;
  }>;
}) {
  const [{ locale: requestedLocale, entryId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale);
  const access = await resolveLeafContentAccess("content.read");
  if (!access.allowed) {
    if (
      access.code === "LAYOUT_HANDLES_SETUP" ||
      access.code === "UNAUTHENTICATED" ||
      access.code === "AUTH_NOT_CONFIGURED"
    ) {
      return null;
    }
    return <AdminAccessState locale={locale} code={access.code} />;
  }

  const aggregate = await contentCommandService.readEntry(access.context, {
    entryId,
  });
  if (!aggregate) notFound();

  const active = aggregate.draft ?? aggregate.published;
  if (!active) notFound();
  const readOnly =
    !supportsPlainTextEditor(active.revision.blocks) ||
    active.translations.some(
      (translation) => !supportsPlainTextEditor(translation.blocks),
    );
  const savedMessage =
    query.saved === "1"
      ? copy.actions.saved
      : query.submitted === "1"
        ? copy.actions.submitted
        : query.returned === "1"
          ? copy.actions.returned
          : null;

  return (
    <div className="space-y-8">
      {savedMessage ? (
        <p
          role="status"
          className="rounded-xl border border-green-800/20 bg-green-800/8 px-4 py-3 text-sm font-semibold text-green-900"
        >
          {savedMessage}
        </p>
      ) : null}
      <ContentEditor
        adminLocale={locale}
        mode="edit"
        workflowStatus={active.revision.status}
        saveAction={saveContentDraftAction.bind(null, locale)}
        readOnly={readOnly}
        initialValues={{
          entryId: aggregate.entry.id,
          revisionId: active.revision.id,
          expectedEntryRevision: aggregate.entry.revision,
          expectedRevision: active.revision.revision,
          code: aggregate.entry.code,
          type: aggregate.entry.type,
          placement: aggregate.entry.placement,
          sourceLocale: active.revision.sourceLocale,
          translations: locales.map((translationLocale) => {
            const translation = active.translations.find(
              ({ locale: currentLocale }) =>
                currentLocale === translationLocale,
            );
            return {
              locale: translationLocale,
              status: translation?.translationStatus ?? ("draft" as const),
              translationId: translation?.id ?? "",
              expectedRevision: translation?.revision ?? 0,
              title: translation?.title ?? "",
              slug: translation?.slug ?? "",
              summary: translation?.summary ?? "",
              body: translation ? blocksToEditorText(translation.blocks) : "",
              seoTitle: translation?.seo.title ?? "",
              seoDescription: translation?.seo.description ?? "",
              noIndex: translation?.seo.noIndex ?? true,
            };
          }),
        }}
      />
      <ContentWorkflowActions
        locale={locale}
        status={active.revision.status}
        entryId={aggregate.entry.id}
        revisionId={active.revision.id}
        expectedEntryRevision={aggregate.entry.revision}
        expectedRevision={active.revision.revision}
        expectedTranslations={active.translations.map((translation) => ({
          locale: translation.locale,
          expectedRevision: translation.revision,
        }))}
        submitAction={submitContentForReviewAction.bind(null, locale)}
        returnAction={returnContentToDraftAction.bind(null, locale)}
        publishAction={publishContentAction.bind(null, locale)}
        createRevisionAction={createContentRevisionAction.bind(null, locale)}
      />
    </div>
  );
}
