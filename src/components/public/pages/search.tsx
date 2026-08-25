import type { PublicDictionary } from "@/lib/i18n/dictionary";

import {
  PageFrame,
  PageHero,
  PageNotices,
  PaginationNav,
  type PublicPageLink,
  type PublicPageNotice,
  type PublicPagePagination,
} from "./shared";

export interface SearchResultView {
  excerpt: string;
  href: string;
  id: string;
  meta: readonly string[];
  title: string;
  typeLabel: string;
}

export interface SearchPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  action: string;
  emptyDescription: string;
  emptyTitle: string;
  heroEyebrow: string;
  intro: string;
  pagination: PublicPagePagination | null;
  placeholder: string;
  query: string;
  resultSummary: string;
  results: readonly SearchResultView[];
  scopeLabel: string;
  scopeLinks: readonly PublicPageLink[];
  suggestions: readonly PublicPageLink[];
  suggestionsLabel: string;
}

export interface SearchPageProps {
  data: SearchPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function SearchPage({
  data,
  dictionary,
  isDemo,
  notices,
}: SearchPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.searchTitle}
        intro={data.intro}
      />

      <section className="mx-auto max-w-5xl px-[var(--space-page)] py-16 lg:py-24">
        <form
          action={data.action}
          method="get"
          role="search"
          className="border-burgundy/12 flex flex-col gap-3 rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-soft)] sm:flex-row"
        >
          <label className="sr-only" htmlFor="public-search-query">
            {dictionary.common.search}
          </label>
          <input
            id="public-search-query"
            type="search"
            name="q"
            defaultValue={data.query}
            placeholder={data.placeholder}
            className="text-charcoal placeholder:text-charcoal/64 min-h-13 min-w-0 flex-1 rounded-[var(--radius-md)] bg-transparent px-4 text-lg"
          />
          <button
            type="submit"
            className="bg-lacquer hover:bg-burgundy min-h-13 rounded-[var(--radius-md)] px-7 py-3 text-sm font-semibold text-white transition"
          >
            {dictionary.common.search}
          </button>
        </form>

        {data.scopeLinks.length > 0 ? (
          <nav
            aria-label={data.scopeLabel}
            className="mt-5 flex gap-2 overflow-x-auto pb-2"
          >
            {data.scopeLinks.map((link) => (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                className="border-burgundy/14 text-burgundy hover:border-lacquer hover:bg-lacquer shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="mt-10 flex items-center gap-5">
          <p
            className="text-charcoal/64 text-sm"
            role="status"
            aria-live="polite"
          >
            {data.resultSummary}
          </p>
          <span className="bg-gold h-px flex-1 opacity-35" aria-hidden="true" />
        </div>

        {data.results.length > 0 ? (
          <ol className="border-burgundy/12 divide-burgundy/10 mt-6 divide-y border-y">
            {data.results.map((result, index) => (
              <li key={result.id}>
                <article className="grid gap-4 py-8 sm:grid-cols-[3rem_1fr_auto] sm:gap-6">
                  <span
                    className="text-gold-ink font-serif text-2xl"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-gold-ink text-xs font-bold tracking-[0.14em] uppercase">
                      {result.typeLabel}
                    </p>
                    <h2 className="text-burgundy mt-2 font-serif text-2xl leading-tight sm:text-3xl">
                      <a href={result.href} className="hover:text-lacquer">
                        {result.title}
                      </a>
                    </h2>
                    <p className="text-charcoal/62 mt-3 max-w-3xl leading-7">
                      {result.excerpt}
                    </p>
                    {result.meta.length > 0 ? (
                      <ul className="text-charcoal/64 mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {result.meta.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <a
                    href={result.href}
                    className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 self-center text-sm font-semibold"
                    aria-label={`${dictionary.common.explore}: ${result.title}`}
                  >
                    <span className="sm:hidden">
                      {dictionary.common.explore}
                    </span>
                    <span aria-hidden="true">→</span>
                  </a>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="border-burgundy/12 mt-6 rounded-[var(--radius-lg)] border border-dashed px-6 py-16 text-center">
            <h2 className="text-burgundy font-serif text-3xl">
              {data.emptyTitle}
            </h2>
            <p className="text-charcoal/64 mx-auto mt-4 max-w-xl leading-7">
              {data.emptyDescription}
            </p>
            {data.suggestions.length > 0 ? (
              <div className="mt-7">
                <p className="text-charcoal/64 text-xs font-semibold tracking-[0.12em] uppercase">
                  {data.suggestionsLabel}
                </p>
                <ul className="mt-3 flex flex-wrap justify-center gap-2">
                  {data.suggestions.map((suggestion) => (
                    <li key={`${suggestion.href}-${suggestion.label}`}>
                      <a
                        href={suggestion.href}
                        className="border-burgundy/14 hover:border-lacquer hover:text-lacquer text-burgundy inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold"
                      >
                        {suggestion.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <PaginationNav dictionary={dictionary} pagination={data.pagination} />
      </section>
    </PageFrame>
  );
}
