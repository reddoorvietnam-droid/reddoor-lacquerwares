import { notFound } from "next/navigation";

import { AdminAccessState, ContentEditor } from "@/components/admin";
import { isLocale, locales } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";
import { resolveLeafContentAccess } from "@/app/[locale]/admin/(portal)/content/access";
import { saveContentDraftAction } from "@/app/[locale]/admin/(portal)/content/actions";

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const access = await resolveLeafContentAccess("content.create");
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

  const action = saveContentDraftAction.bind(null, locale);

  return (
    <ContentEditor
      adminLocale={locale}
      mode="create"
      workflowStatus="draft"
      saveAction={action}
      initialValues={{
        entryId: "",
        revisionId: "",
        expectedEntryRevision: 0,
        expectedRevision: 0,
        code: "",
        type: "section",
        placement: "",
        sourceLocale: locale,
        translations: locales.map((translationLocale) => ({
          locale: translationLocale,
          status: "draft",
          translationId: "",
          expectedRevision: 0,
          title: "",
          slug: "",
          summary: "",
          body: "",
          seoTitle: "",
          seoDescription: "",
          noIndex: true,
        })),
      }}
    />
  );
}
