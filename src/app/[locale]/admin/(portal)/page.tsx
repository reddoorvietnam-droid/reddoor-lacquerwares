import { notFound } from "next/navigation";

import { AccessSummary } from "@/components/admin";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).overview;

  // The landing page carries nothing role-specific beyond the session's own
  // access summary — every working area is reached through the sidebar, which
  // is already filtered to the reader's permissions.
  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>
      <AccessSummary locale={locale} />
    </div>
  );
}
