import type { PublicDictionary } from "@/lib/i18n/dictionary";

import {
  ActionLink,
  MediaFrame,
  PageFrame,
  PageHero,
  PageNotices,
  PaginationNav,
  SectionHeading,
  type PublicPageLink,
  type PublicPageMedia,
  type PublicPageNotice,
  type PublicPagePagination,
} from "./shared";

export interface CollectionCardView {
  cover: PublicPageMedia;
  excerpt: string;
  href: string;
  id: string;
  localeLabel: string | null;
  pageCountLabel: string | null;
  statusLabel: string | null;
  title: string;
  yearLabel: string;
}

export interface CollectionListingPageData {
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
  return (
    <article className="group border-burgundy/12 relative overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
      <a href={collection.href} className="block overflow-hidden">
        <MediaFrame
          media={collection.cover}
          sizes="(min-width: 1280px) 31vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-3/4 rounded-none border-0"
        />
      </a>
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs tracking-[0.12em] uppercase">
          <span className="text-gold-ink font-bold">
            {collection.yearLabel}
          </span>
          {collection.localeLabel ? (
            <span className="text-charcoal/64">{collection.localeLabel}</span>
          ) : null}
          {collection.statusLabel ? (
            <span className="border-lacquer/20 bg-lacquer/8 text-lacquer rounded-full border px-2.5 py-1 font-semibold tracking-normal normal-case">
              {collection.statusLabel}
            </span>
          ) : null}
        </div>
        <h2 className="text-burgundy mt-4 font-serif text-3xl leading-tight tracking-[-0.025em]">
          <a href={collection.href} className="hover:text-lacquer">
            {collection.title}
          </a>
        </h2>
        <p className="text-charcoal/62 mt-4 line-clamp-3 leading-7">
          {collection.excerpt}
        </p>
        <div className="mt-6 flex items-center justify-between gap-4">
          <a
            href={collection.href}
            className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
          >
            <span aria-hidden="true">▱</span>
            <span>{dictionary.collection.openBook}</span>
          </a>
          {collection.pageCountLabel ? (
            <span className="text-charcoal/64 text-xs">
              {collection.pageCountLabel}
            </span>
          ) : null}
        </div>
      </div>
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

export interface CollectionChapterView {
  href: string;
  id: string;
  pageLabel: string;
  title: string;
}

export interface CollectionFactView {
  id: string;
  label: string;
  value: string;
}

export interface CollectionProductLinkView {
  href: string;
  id: string;
  media: PublicPageMedia;
  meta: string;
  title: string;
}

export interface CollectionLandingPageData {
  backLink: PublicPageLink;
  chapters: readonly CollectionChapterView[];
  chaptersLabel: string;
  cover: PublicPageMedia;
  downloadLink: PublicPageLink | null;
  facts: readonly CollectionFactView[];
  fallbackDescription: string;
  fallbackPages: readonly PublicPageMedia[];
  fallbackTitle: string;
  flipbookDescription: string;
  flipbookLink: PublicPageLink | null;
  flipbookUnavailableLabel: string;
  heroEyebrow: string;
  intro: string;
  products: readonly CollectionProductLinkView[];
  productsDescription: string;
  title: string;
}

export interface CollectionLandingPageProps {
  data: CollectionLandingPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function CollectionLandingPage({
  data,
  dictionary,
  isDemo,
  notices,
}: CollectionLandingPageProps) {
  const heroActions: PublicPageLink[] = [];
  if (data.flipbookLink) {
    heroActions.push(data.flipbookLink);
  }
  if (data.downloadLink) {
    heroActions.push(data.downloadLink);
  }

  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <div className="mx-auto max-w-7xl px-[var(--space-page)] pt-8">
        <a
          href={data.backLink.href}
          className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          <span aria-hidden="true">←</span>
          {data.backLink.label}
        </a>
      </div>
      <PageHero
        eyebrow={data.heroEyebrow}
        title={data.title}
        intro={data.intro}
        media={data.cover}
        actions={heroActions}
      />

      <section className="mx-auto grid max-w-7xl gap-10 px-[var(--space-page)] py-20 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-16 lg:py-28">
        <div className="lg:sticky lg:top-24">
          <MediaFrame
            media={data.cover}
            sizes="(min-width: 1024px) 36vw, 100vw"
            className="aspect-3/4 shadow-[var(--shadow-lacquer)]"
          />
        </div>
        <div>
          <p className="eyebrow">{dictionary.collection.openBook}</p>
          <h2 className="text-burgundy mt-4 font-serif text-4xl leading-tight tracking-[-0.035em] sm:text-5xl">
            {data.title}
          </h2>
          <p className="text-charcoal/66 mt-6 max-w-2xl text-lg leading-8">
            {data.flipbookDescription}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {data.flipbookLink ? (
              <ActionLink link={data.flipbookLink} variant="primary" />
            ) : (
              <span
                className="border-burgundy/15 text-charcoal/64 inline-flex min-h-11 cursor-not-allowed items-center rounded-full border px-5 py-2.5 text-sm"
                aria-disabled="true"
              >
                {data.flipbookUnavailableLabel}
              </span>
            )}
            {data.downloadLink ? (
              <ActionLink link={data.downloadLink} variant="quiet" />
            ) : (
              <span className="text-charcoal/64 inline-flex min-h-11 items-center px-2 text-sm">
                {dictionary.collection.downloadDisabled}
              </span>
            )}
          </div>

          {data.facts.length > 0 ? (
            <dl className="border-burgundy/12 bg-burgundy/10 mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border sm:grid-cols-2">
              {data.facts.map((fact) => (
                <div key={fact.id} className="bg-ivory p-5">
                  <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                    {fact.label}
                  </dt>
                  <dd className="text-burgundy mt-2 font-semibold">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {data.chapters.length > 0 ? (
            <nav className="mt-10" aria-label={data.chaptersLabel}>
              <p className="text-burgundy text-sm font-semibold">
                {data.chaptersLabel}
              </p>
              <ol className="border-burgundy/12 divide-burgundy/10 mt-4 divide-y border-y">
                {data.chapters.map((chapter, index) => (
                  <li key={chapter.id}>
                    <a
                      href={chapter.href}
                      className="group/link grid min-h-16 grid-cols-[2rem_1fr_auto] items-center gap-3 py-3"
                    >
                      <span className="text-gold-ink text-xs font-bold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-burgundy group-hover/link:text-lacquer font-semibold">
                        {chapter.title}
                      </span>
                      <span className="text-charcoal/64 text-xs">
                        {chapter.pageLabel}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </div>
      </section>

      <section className="bg-[var(--surface-raised)] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-[var(--space-page)]">
          <SectionHeading
            eyebrow={data.heroEyebrow}
            title={data.fallbackTitle}
            description={data.fallbackDescription}
          />
          <div className="mt-10 flex snap-x gap-5 overflow-x-auto pb-6">
            {data.fallbackPages.map((page, index) => (
              <div
                key={page.id}
                id={`collection-page-${index + 1}`}
                className="w-[76vw] max-w-sm shrink-0 snap-start"
              >
                <MediaFrame
                  media={page}
                  sizes="(min-width: 640px) 384px, 76vw"
                  className="aspect-3/4"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {data.products.length > 0 ? (
        <section className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28">
          <SectionHeading
            eyebrow={dictionary.collection.viewProducts}
            title={dictionary.collection.viewProducts}
            description={data.productsDescription}
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((product) => (
              <article
                key={product.id}
                className="group border-burgundy/12 overflow-hidden rounded-[var(--radius-lg)] border bg-white/50"
              >
                <a href={product.href} className="block">
                  <MediaFrame
                    media={product.media}
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="aspect-4/3 rounded-none border-0"
                  />
                  <div className="p-6">
                    <p className="text-gold-ink text-xs font-semibold tracking-[0.12em] uppercase">
                      {product.meta}
                    </p>
                    <h3 className="text-burgundy group-hover:text-lacquer mt-2 font-serif text-2xl leading-tight">
                      {product.title}
                    </h3>
                  </div>
                </a>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}
