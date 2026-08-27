import type { Route } from "next";
import Link from "next/link";
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

  // This page contains no persisted or user-specific data. Pages that touch a
  // DAL recheck authorization at the leaf because layouts are not a boundary.
  const cards = [
    {
      title: copy.secureBoundary,
      description: copy.secureBoundaryDescription,
    },
    { title: copy.workflow, description: copy.workflowDescription },
    {
      title: copy.translations,
      description: copy.translationsDescription,
    },
  ];

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {cards.map((card, index) => (
          <section
            key={card.title}
            className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]"
          >
            <span className="text-gold-ink font-mono text-xs">
              0{index + 1}
            </span>
            <h2 className="text-burgundy mt-4 font-serif text-2xl">
              {card.title}
            </h2>
            <p className="text-charcoal/60 mt-3 text-sm leading-6">
              {card.description}
            </p>
          </section>
        ))}
      </div>
      <AccessSummary locale={locale} />
      <Link
        href={`/${locale}/admin/content` as Route}
        className="bg-lacquer text-ivory hover:bg-burgundy mt-8 inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)]"
      >
        {copy.openContent}
      </Link>
    </div>
  );
}
