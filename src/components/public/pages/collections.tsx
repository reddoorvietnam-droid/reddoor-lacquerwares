import type { PublicDictionary } from "@/lib/i18n/dictionary";

import {
  MediaFrame,
  PageFrame,
  PageHero,
  PageNotices,
  PaginationNav,
  type PublicPageLink,
  type PublicPageMedia,
  type PublicPageNotice,
  type PublicPagePagination,
} from "./shared";

export interface CollectionCardView {
  cover: PublicPageMedia;
  excerpt: string;
  /** The catalogue reader, or null while no catalogue is attached yet. */
  href: string | null;
  id: string;
  localeLabel: string | null;
  pageCountLabel: string | null;
  statusLabel: string | null;
  title: string;
  yearLabel: string;
}

export interface CollectionListingPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  collections: readonly CollectionCardView[];
  emptyDescription: string;
  emptyTitle: string;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  pagination: PublicPagePagination | null;
  resultSummary: string;
  yearLinks: readonly PublicPageLink[];
  yearNavigationLabel: string;
}

export interface CollectionListingPageProps {
  data: CollectionListingPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

function CollectionCard({
  collection,
  dictionary,
}: {
  collection: CollectionCardView;
  dictionary: PublicDictionary;
}) {
  const body = (
    <>
      {/*
        The cover IS the card: full-bleed, nothing framing it. The catalogue
        artwork carries its own composition.
      */}
      <div className="relative overflow-hidden rounded-[var(--radius-md)] shadow-[0_1rem_2.5rem_rgb(61_13_16/0.18)] transition-all duration-[var(--duration-medium)] ease-[var(--ease-brand)] group-hover:-translate-y-1.5 group-hover:shadow-[0_1.75rem_3.5rem_rgb(61_13_16/0.28)]">
        <MediaFrame
          media={collection.cover}
          sizes="(min-width: 1280px) 28vw, (min-width: 640px) 45vw, 90vw"
          className="aspect-3/4 rounded-none border-0"
        />
      </div>
      <div className="mt-5 flex items-baseline justify-between gap-4 px-1">
        <h2 className="text-burgundy group-hover:text-lacquer font-serif text-2xl leading-tight tracking-[-0.02em] transition-colors">
          {collection.title}
        </h2>
        <span className="text-gold-ink shrink-0 text-sm font-semibold tracking-[0.08em]">
          {collection.yearLabel}
        </span>
      </div>
      {collection.pageCountLabel ? (
        <p className="text-charcoal/55 mt-1 px-1 text-xs tracking-[0.06em]">
          {collection.pageCountLabel}
        </p>
      ) : null}
    </>
  );

  return (
    <article className="group">
      {/*
        The catalogue is the object, so the card is the catalogue: the cover
        on a lacquer-red mat, the way a printed book is presented on cloth.
        Copy is held to name and year. Until a catalogue is attached there is
        nowhere to go, so the card presents without pretending to be a link.
      */}
      {collection.href ? (
        <a
          href={collection.href}
          aria-label={`${collection.title} — ${dictionary.collection.openBook}`}
          className="block focus-visible:outline-offset-8"
        >
          {body}
        </a>
      ) : (
        <div>{body}</div>
      )}
    </article>
  );
}

export function CollectionListingPage({
  data,
  dictionary,
  isDemo,
  notices,
}: CollectionListingPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.collectionsTitle}
        intro={dictionary.pages.collectionsIntro}
        media={data.heroMedia}
      />

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-16 lg:py-24">
        {data.yearLinks.length > 0 ? (
          <nav
            aria-label={data.yearNavigationLabel}
            className="flex gap-2 overflow-x-auto pb-3"
          >
            {data.yearLinks.map((link) => (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="border-burgundy/16 hover:border-lacquer hover:bg-lacquer text-burgundy shrink-0 rounded-full border bg-white/50 px-4 py-2.5 text-sm font-semibold transition hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
        <div className="mt-8 flex items-center gap-5">
          <p className="text-charcoal/64 text-sm" role="status">
            {data.resultSummary}
          </p>
          <span className="bg-gold h-px flex-1 opacity-35" aria-hidden="true" />
        </div>

        {data.collections.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                dictionary={dictionary}
              />
            ))}
          </div>
        ) : (
          <div className="border-burgundy/12 mt-8 rounded-[var(--radius-lg)] border border-dashed px-6 py-20 text-center">
            <h2 className="text-burgundy font-serif text-3xl">
              {data.emptyTitle}
            </h2>
            <p className="text-charcoal/64 mx-auto mt-4 max-w-xl leading-7">
              {data.emptyDescription}
            </p>
          </div>
        )}

        <PaginationNav dictionary={dictionary} pagination={data.pagination} />
      </section>
    </PageFrame>
  );
}
