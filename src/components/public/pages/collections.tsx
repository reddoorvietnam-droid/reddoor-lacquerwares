import type { PublicDictionary } from "@/lib/i18n/dictionary";

import { ProductCard, type ProductCardView } from "./products";
import {
  ActionLink,
  Breadcrumbs,
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
  /** The collection's landing page. */
  href: string;
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

function CollectionCard({ collection }: { collection: CollectionCardView }) {
  return (
    <article className="group">
      {/*
        The catalogue is the object, so the card is the catalogue: the cover
        on a lacquer-red mat, the way a printed book is presented on cloth.
        Copy is held to name and year. The card always opens the collection's
        landing page; the reader, when a catalogue exists, is one step on.
      */}
      <a
        href={collection.href}
        className="block focus-visible:outline-offset-8"
      >
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
      </a>
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
        title={dictionary.pages.collectionsHeading}
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
              <CollectionCard key={collection.id} collection={collection} />
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

export interface CollectionLandingPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  /** Home → collections → this collection; the same labels as the JSON-LD trail. */
  breadcrumbs: readonly PublicPageLink[];
  title: string;
  editionLabel: string;
  summary: string;
  introParagraphs: readonly string[];
  cover: PublicPageMedia;
  /** The flipbook reader, or null while no catalogue is attached. */
  catalogueLink: PublicPageLink | null;
  /** How a reader gets the catalogue while none is hosted here. */
  availabilityNote: string | null;
  productsHeading: string;
  products: readonly ProductCardView[];
  allProductsLink: PublicPageLink;
}

export interface CollectionLandingPageProps {
  data: CollectionLandingPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

/**
 * The collection's own page: what the flipbook cannot say in text. The cover
 * sits on the left as on the listing card; the copy, the reader link and the
 * pieces in the collection follow, each product linked by name so the
 * catalogue pages have a way in from the collection they belong to.
 */
export function CollectionLandingPage({
  data,
  dictionary,
  isDemo,
  notices,
}: CollectionLandingPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <div className="mx-auto max-w-7xl px-[var(--space-page)] pt-8">
        <Breadcrumbs
          items={data.breadcrumbs}
          label={dictionary.common.breadcrumbs}
        />
      </div>

      <section className="mx-auto grid max-w-7xl gap-10 px-[var(--space-page)] py-10 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:gap-16 lg:py-16">
        <div className="mx-auto w-full max-w-md lg:sticky lg:top-24 lg:mx-0">
          <div className="overflow-hidden rounded-[var(--radius-md)] shadow-[0_1rem_2.5rem_rgb(61_13_16/0.18)]">
            <MediaFrame
              media={data.cover}
              sizes="(min-width: 1024px) 36vw, (min-width: 640px) 28rem, 90vw"
              className="aspect-3/4 rounded-none border-0"
              preload
            />
          </div>
        </div>

        <div>
          <p className="eyebrow">{data.editionLabel}</p>
          <h1 className="text-burgundy mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.045em] text-balance sm:text-6xl">
            {data.title}
          </h1>
          <p className="text-charcoal/68 mt-6 text-lg leading-8 text-pretty">
            {data.summary}
          </p>
          {data.introParagraphs.length > 0 ? (
            <div className="text-charcoal/68 mt-6 max-w-2xl space-y-5 leading-8">
              {data.introParagraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {data.catalogueLink ? (
              <ActionLink link={data.catalogueLink} variant="primary" />
            ) : data.availabilityNote ? (
              <p className="text-charcoal/64 text-sm leading-6" role="note">
                {data.availabilityNote}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-raised)] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-[var(--space-page)]">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              eyebrow={data.title}
              title={data.productsHeading}
              description={null}
            />
            <ActionLink link={data.allProductsLink} variant="quiet" />
          </div>
          {data.products.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  dictionary={dictionary}
                  headingLevel="h3"
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </PageFrame>
  );
}
