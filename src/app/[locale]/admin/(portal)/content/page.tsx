import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAccessState, ContentTable } from "@/components/admin";
import { contentCommandService } from "@/domains/content/runtime";
import type { AccessDenialCode } from "@/lib/auth/authorization";
import { isLocale, locales } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";
import { resolveLeafContentAccess } from "@/app/[locale]/admin/(portal)/content/access";

function LeafDenial({
  locale,
  code,
}: {
  locale: "vi" | "en";
  code: AccessDenialCode | "LAYOUT_HANDLES_SETUP";
}) {
  if (
    code === "LAYOUT_HANDLES_SETUP" ||
    code === "UNAUTHENTICATED" ||
    code === "AUTH_NOT_CONFIGURED"
  ) {
    return null;
  }

  return <AdminAccessState locale={locale} code={code} />;
}

export default async function AdminContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale);
  const access = await resolveLeafContentAccess("content.read");
  if (!access.allowed) {
    return <LeafDenial locale={locale} code={access.code} />;
  }

  const result = await contentCommandService.listEntries(access.context, {
    offset: 0,
    limit: 100,
  });
  const rows = result.items.map((item) => {
    const translation =
      item.translations.find(
        ({ locale: itemLocale }) => itemLocale === locale,
      ) ?? item.translations[0];

    return {
      id: item.entry.id,
      code: item.entry.code,
      title: translation?.title || item.entry.code,
      type: item.entry.type,
      placement: item.entry.placement,
      status: item.entry.status,
      translations: locales.map((translationLocale) => {
        const current = item.translations.find(
          ({ locale: itemLocale }) => itemLocale === translationLocale,
        );
        return {
          locale: translationLocale,
          status: current?.status ?? ("draft" as const),
        };
      }),
      updatedAt: item.entry.updatedAt,
      editHref: `/${locale}/admin/content/${item.entry.id}` as Route,
    };
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{copy.content.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
            {copy.content.title}
          </h1>
          <p className="text-charcoal/65 mt-4 max-w-3xl text-base leading-7">
            {copy.content.description}
          </p>
        </div>
        <Link
          href={`/${locale}/admin/content/new` as Route}
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold"
        >
          {copy.content.create}
        </Link>
      </div>
      {query.published === "1" ? (
        <p
          role="status"
          className="mt-7 rounded-xl border border-green-800/20 bg-green-800/8 px-4 py-3 text-sm font-semibold text-green-900"
        >
          {copy.actions.published}
        </p>
      ) : null}
      <div className="mt-8">
        <ContentTable locale={locale} rows={rows} />
      </div>
    </div>
  );
}
