import type { PublicDictionary } from "@/lib/i18n/dictionary";

import { NewsShareActions } from "./news-share-actions";

import {
  MediaFrame,
  PageFrame,
  PageHero,
  PageNotices,
  PaginationNav,
  RichContent,
  SectionHeading,
  type PublicContentBlock,
  type PublicPageLink,
  type PublicPageMedia,
  type PublicPageNotice,
  type PublicPagePagination,
} from "./shared";

export interface NewsCardView {
  authorName: string | null;
  categoryLabel: string;
  excerpt: string;
  href: string;
  id: string;
  media: PublicPageMedia;
  publishedAt: string;
  publishedLabel: string;
  title: string;
}

export interface NewsListingPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  categoryLinks: readonly PublicPageLink[];
  categoryNavigationLabel: string;
  emptyDescription: string;
  emptyTitle: string;
  featured: NewsCardView | null;
  featuredLabel: string;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  items: readonly NewsCardView[];
  pagination: PublicPagePagination | null;
  resultSummary: string;
}

export interface NewsListingPageProps {
  data: NewsListingPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

interface NewsCardProps {
  dictionary: PublicDictionary;
  headingLevel?: "h2" | "h3";
  item: NewsCardView;
}

function NewsCard({ dictionary, headingLevel = "h2", item }: NewsCardProps) {
  const Heading = headingLevel;

  return (
    <article className="group border-burgundy/12 overflow-hidden rounded-[var(--radius-lg)] border bg-white/50">
      <a href={item.href} className="block overflow-hidden">
        <MediaFrame
          media={item.media}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="aspect-4/3 rounded-none border-0"
        />
      </a>
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-gold-ink font-bold tracking-[0.12em] uppercase">
            {item.categoryLabel}
          </span>
          <span className="text-charcoal/35" aria-hidden="true">
            ·
          </span>
          <time className="text-charcoal/64" dateTime={item.publishedAt}>
            {item.publishedLabel}
          </time>
        </div>
        <Heading className="text-burgundy mt-4 font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
          <a href={item.href} className="group-hover:text-lacquer">
            {item.title}
          </a>
        </Heading>
        <p className="text-charcoal/62 mt-4 line-clamp-3 leading-7">
          {item.excerpt}
        </p>
        {item.authorName ? (
          <p className="text-charcoal/64 mt-5 text-xs">
            {dictionary.news.by} {item.authorName}
          </p>
        ) : null}
        <a
          href={item.href}
          className="text-burgundy hover:text-lacquer mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          {dictionary.common.readStory}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export function NewsListingPage({
  data,
  dictionary,
  isDemo,
  notices,
}: NewsListingPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.newsTitle}
        intro={dictionary.pages.newsIntro}
        media={data.heroMedia}
      />

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-16 lg:py-24">
        {data.categoryLinks.length > 0 ? (
          <nav
            aria-label={data.categoryNavigationLabel}
            className="flex gap-2 overflow-x-auto pb-3"
          >
            {data.categoryLinks.map((link) => (
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

        {data.featured ? (
          <article className="border-burgundy/12 mt-10 grid overflow-hidden rounded-[var(--radius-display)] border bg-[var(--surface-raised)] shadow-[var(--shadow-soft)] lg:grid-cols-[1.2fr_0.8fr]">
            <a
              href={data.featured.href}
              className="group block overflow-hidden"
            >
              <MediaFrame
                media={data.featured.media}
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="h-full min-h-80 rounded-none border-0"
              />
            </a>
            <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
              <p className="text-gold-ink text-xs font-bold tracking-[0.16em] uppercase">
                {data.featuredLabel}
              </p>
              <h2 className="text-burgundy mt-4 font-serif text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">
                <a href={data.featured.href} className="hover:text-lacquer">
                  {data.featured.title}
                </a>
              </h2>
              <p className="text-charcoal/64 mt-5 leading-8">
                {data.featured.excerpt}
              </p>
              <div className="text-charcoal/64 mt-6 flex flex-wrap items-center gap-2 text-xs">
                <time dateTime={data.featured.publishedAt}>
                  {data.featured.publishedLabel}
                </time>
                {data.featured.authorName ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {dictionary.news.by} {data.featured.authorName}
                    </span>
                  </>
                ) : null}
              </div>
              <a
                href={data.featured.href}
                className="text-burgundy hover:text-lacquer mt-7 inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold"
              >
                {dictionary.common.readStory}
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </article>
        ) : null}

        <div className="mt-12 flex items-center gap-5">
          <p className="text-charcoal/64 text-sm" role="status">
            {data.resultSummary}
          </p>
          <span className="bg-gold h-px flex-1 opacity-35" aria-hidden="true" />
        </div>

        {data.items.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => (
              <NewsCard key={item.id} item={item} dictionary={dictionary} />
            ))}
          </div>
        ) : data.featured ? null : (
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

export interface NewsArticleTocItemView {
  href: string;
  id: string;
  label: string;
}

export interface NewsArticlePageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  authorName: string | null;
  backLink: PublicPageLink;
  blocks: readonly PublicContentBlock[];
  categoryLabel: string;
  excerpt: string;
  heroMedia: PublicPageMedia | null;
  publishedAt: string;
  publishedLabel: string;
  relatedItems: readonly NewsCardView[];
  title: string;
  tocItems: readonly NewsArticleTocItemView[];
  tocLabel: string;
}

export interface NewsArticlePageProps {
  data: NewsArticlePageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function NewsArticlePage({
  data,
  dictionary,
  isDemo,
  notices,
}: NewsArticlePageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <article>
        <header className="mx-auto max-w-5xl px-[var(--space-page)] pt-10 pb-12 text-center sm:pt-16 sm:pb-16">
          <a
            href={data.backLink.href}
            className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
          >
            <span aria-hidden="true">←</span>
            {data.backLink.label}
          </a>
          <p className="eyebrow mt-8">{data.categoryLabel}</p>
          <h1 className="text-burgundy mt-5 font-serif text-5xl leading-[0.96] tracking-[-0.045em] text-balance sm:text-7xl">
            {data.title}
          </h1>
          <p className="text-charcoal/64 mx-auto mt-7 max-w-3xl text-lg leading-8 text-pretty sm:text-xl">
            {data.excerpt}
          </p>
          <div className="text-charcoal/64 mt-7 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs tracking-[0.08em] uppercase">
            <span>{dictionary.news.published}</span>
            <time dateTime={data.publishedAt}>{data.publishedLabel}</time>
            {data.authorName ? (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {dictionary.news.by} {data.authorName}
                </span>
              </>
            ) : null}
          </div>
        </header>

        {data.heroMedia ? (
          <div className="mx-auto max-w-[96rem] px-4 sm:px-6">
            <MediaFrame
              media={data.heroMedia}
              sizes="100vw"
              className="max-h-[48rem] min-h-72 rounded-[var(--radius-display)]"
            />
          </div>
        ) : null}

        <div className="mx-auto grid max-w-6xl gap-12 px-[var(--space-page)] py-16 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-24">
          {data.tocItems.length > 0 ? (
            <aside className="self-start lg:sticky lg:top-24">
              <nav aria-label={data.tocLabel}>
                <p className="text-burgundy text-xs font-bold tracking-[0.14em] uppercase">
                  {data.tocLabel}
                </p>
                <ol className="border-burgundy/12 mt-4 space-y-1 border-l pl-4">
                  {data.tocItems.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        className="text-charcoal/64 hover:text-lacquer block rounded-r-md px-2 py-2 text-sm leading-5"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="max-w-3xl min-w-0">
            <RichContent blocks={data.blocks} />
            <NewsShareActions dictionary={dictionary} title={data.title} />
          </div>
        </div>
      </article>

      {data.relatedItems.length > 0 ? (
        <section className="bg-[var(--surface-raised)] py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-[var(--space-page)]">
            <SectionHeading
              eyebrow={dictionary.pages.newsTitle}
              title={dictionary.news.related}
              description={null}
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.relatedItems.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  dictionary={dictionary}
                  headingLevel="h3"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}
