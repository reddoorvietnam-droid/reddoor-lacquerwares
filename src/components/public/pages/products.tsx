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

export interface ProductCardView {
  badges: readonly string[];
  categoryLabel: string;
  excerpt: string;
  href: string;
  id: string;
  materialLabel: string | null;
  media: PublicPageMedia;
  name: string;
  statusLabel: string | null;
}

export interface ProductFilterOptionView {
  label: string;
  value: string;
}

export interface ProductFilterGroupView {
  currentValue: string;
  id: string;
  label: string;
  name: string;
  options: readonly ProductFilterOptionView[];
}

export interface ProductListingPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  applyFiltersLabel: string;
  clearFiltersLink: PublicPageLink | null;
  emptyDescription: string;
  emptyTitle: string;
  filterAction: string;
  filterGroups: readonly ProductFilterGroupView[];
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  pagination: PublicPagePagination | null;
  products: readonly ProductCardView[];
  query: string;
  resultSummary: string;
  searchPlaceholder: string;
  sortCurrentValue: string;
  sortName: string;
  sortOptions: readonly ProductFilterOptionView[];
}

export interface ProductListingPageProps {
  data: ProductListingPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

interface ProductCardProps {
  dictionary: PublicDictionary;
  headingLevel?: "h2" | "h3";
  product: ProductCardView;
}

export function ProductCard({
  dictionary,
  headingLevel = "h2",
  product,
}: ProductCardProps) {
  const Heading = headingLevel;

  return (
    <article className="group border-burgundy/12 overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
      <a href={product.href} className="block overflow-hidden">
        <MediaFrame
          media={product.media}
          sizes="(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw"
          className="aspect-4/5 rounded-none border-0"
        />
      </a>
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-gold-ink text-xs font-semibold tracking-[0.14em] uppercase">
            {product.categoryLabel}
          </p>
          {product.statusLabel ? (
            <span className="border-lacquer/20 bg-lacquer/8 text-lacquer rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold">
              {product.statusLabel}
            </span>
          ) : null}
        </div>
        <Heading className="text-burgundy mt-3 font-serif text-2xl leading-tight tracking-[-0.02em]">
          <a href={product.href} className="hover:text-lacquer">
            {product.name}
          </a>
        </Heading>
        <p className="text-charcoal/62 mt-3 line-clamp-3 leading-7">
          {product.excerpt}
        </p>
        {product.materialLabel ? (
          <p className="text-charcoal/64 mt-4 text-xs tracking-[0.1em] uppercase">
            {dictionary.product.material}: {product.materialLabel}
          </p>
        ) : null}
        {product.badges.length > 0 ? (
          <ul className="mt-5 flex flex-wrap gap-2" aria-label={product.name}>
            {product.badges.map((badge) => (
              <li
                key={badge}
                className="border-burgundy/12 text-charcoal/64 rounded-full border px-3 py-1 text-xs"
              >
                {badge}
              </li>
            ))}
          </ul>
        ) : null}
        <a
          href={product.href}
          className="text-burgundy hover:text-lacquer mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          {dictionary.common.explore}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export function ProductListingPage({
  data,
  dictionary,
  isDemo,
  notices,
}: ProductListingPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.productsTitle}
        intro={dictionary.pages.productsIntro}
        media={data.heroMedia}
      />

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-16 lg:py-24">
        <form
          action={data.filterAction}
          method="get"
          className="border-burgundy/12 rounded-[var(--radius-lg)] border bg-white/55 p-5 shadow-[var(--shadow-soft)] sm:p-7"
          aria-label={dictionary.product.filters}
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(14rem,1.4fr)_repeat(5,minmax(9rem,1fr))]">
            <label className="text-burgundy grid gap-2 text-sm font-semibold">
              <span>{dictionary.common.search}</span>
              <input
                type="search"
                name="q"
                defaultValue={data.query}
                placeholder={data.searchPlaceholder}
                className="border-burgundy/18 bg-ivory text-charcoal placeholder:text-charcoal/64 focus:border-lacquer min-h-12 rounded-[var(--radius-sm)] border px-4 font-normal"
              />
            </label>
            {data.filterGroups.map((group) => (
              <label
                key={group.id}
                className="text-burgundy grid gap-2 text-sm font-semibold"
              >
                <span>{group.label}</span>
                <select
                  name={group.name}
                  defaultValue={group.currentValue}
                  className="border-burgundy/18 bg-ivory text-charcoal min-h-12 rounded-[var(--radius-sm)] border px-4 font-normal"
                >
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="text-burgundy grid gap-2 text-sm font-semibold">
              <span>{dictionary.product.sort}</span>
              <select
                name={data.sortName}
                defaultValue={data.sortCurrentValue}
                className="border-burgundy/18 bg-ivory text-charcoal min-h-12 rounded-[var(--radius-sm)] border px-4 font-normal"
              >
                {data.sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="bg-lacquer hover:bg-burgundy min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition"
            >
              {data.applyFiltersLabel}
            </button>
            {data.clearFiltersLink ? (
              <a
                href={data.clearFiltersLink.href}
                className="text-burgundy hover:text-lacquer min-h-11 rounded-full px-4 py-3 text-sm font-semibold"
              >
                {data.clearFiltersLink.label}
              </a>
            ) : null}
          </div>
        </form>

        <div className="mt-10 flex items-center justify-between gap-5">
          <p className="text-charcoal/64 text-sm" role="status">
            {data.resultSummary}
          </p>
          <span
            className="bg-gold h-px min-w-12 flex-1 opacity-35"
            aria-hidden="true"
          />
        </div>

        {data.products.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
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

export interface ProductSpecificationView {
  id: string;
  label: string;
  value: string;
}

export interface ProductVideoView {
  captionsLanguage: string;
  captionsSrc: string | null;
  mimeType: "video/mp4" | "video/webm";
  poster: PublicPageMedia | null;
  src: string;
  title: string;
}

export interface ProductVariantView {
  description: string;
  id: string;
  label: string;
}

export interface ProductProcessStepView {
  description: string;
  id: string;
  title: string;
}

export interface ProductDetailPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  backLink: PublicPageLink;
  badges: readonly string[];
  categoryLabel: string;
  dimensions: string | null;
  finish: string | null;
  gallery: readonly PublicPageMedia[];
  galleryLabel: string;
  intro: string;
  leadTime: string | null;
  madeToOrder: boolean;
  material: string | null;
  name: string;
  primaryActions: readonly PublicPageLink[];
  processSteps: readonly ProductProcessStepView[];
  relatedProducts: readonly ProductCardView[];
  specifications: readonly ProductSpecificationView[];
  storyParagraphs: readonly string[];
  variants: readonly ProductVariantView[];
  video: ProductVideoView | null;
}

export interface ProductDetailPageProps {
  data: ProductDetailPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function ProductDetailPage({
  data,
  dictionary,
  isDemo,
  notices,
}: ProductDetailPageProps) {
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

      <section className="mx-auto grid max-w-7xl gap-10 px-[var(--space-page)] py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:gap-16 lg:py-16">
        <div>
          {data.gallery.length > 0 ? (
            <div
              className="grid gap-4 sm:grid-cols-2"
              aria-label={data.galleryLabel}
            >
              {data.gallery.map((media, index) => (
                <div
                  key={media.id}
                  className={
                    index === 0
                      ? "group relative sm:col-span-2"
                      : "group relative"
                  }
                >
                  <MediaFrame
                    media={media}
                    sizes="(min-width: 1024px) 36vw, (min-width: 640px) 50vw, 100vw"
                    className={
                      index === 0 ? "aspect-4/5 sm:aspect-4/3" : "aspect-square"
                    }
                  />
                  {media.src ? (
                    <a
                      href={media.src}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${dictionary.product.zoomImage}: ${media.alt}`}
                      className="bg-burgundy/92 text-ivory hover:bg-lacquer absolute top-4 right-4 inline-flex min-h-11 items-center rounded-full px-4 py-2 text-xs font-semibold shadow-lg transition"
                    >
                      {dictionary.product.zoomImage}
                    </a>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="bg-ivory/92 text-charcoal/68 absolute top-4 right-4 inline-flex min-h-11 max-w-[12rem] items-center rounded-full px-4 py-2 text-right text-xs font-semibold shadow-sm"
                    >
                      {dictionary.product.zoomUnavailable}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="self-start lg:sticky lg:top-24">
          <p className="eyebrow">{data.categoryLabel}</p>
          <h1 className="text-burgundy mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.045em] text-balance sm:text-6xl">
            {data.name}
          </h1>
          <p className="text-charcoal/68 mt-6 text-lg leading-8 text-pretty">
            {data.intro}
          </p>
          {data.badges.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={data.name}>
              {data.badges.map((badge) => (
                <li
                  key={badge}
                  className="border-gold/45 bg-gold/10 text-burgundy rounded-full border px-3 py-1.5 text-xs font-semibold"
                >
                  {badge}
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="border-burgundy/12 divide-burgundy/10 mt-8 divide-y border-y">
            {data.material ? (
              <div className="grid grid-cols-[8rem_1fr] gap-4 py-4">
                <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                  {dictionary.product.material}
                </dt>
                <dd className="text-sm font-medium">{data.material}</dd>
              </div>
            ) : null}
            {data.finish ? (
              <div className="grid grid-cols-[8rem_1fr] gap-4 py-4">
                <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                  {dictionary.product.finish}
                </dt>
                <dd className="text-sm font-medium">{data.finish}</dd>
              </div>
            ) : null}
            {data.dimensions ? (
              <div className="grid grid-cols-[8rem_1fr] gap-4 py-4">
                <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                  {dictionary.product.dimensions}
                </dt>
                <dd className="text-sm font-medium">{data.dimensions}</dd>
              </div>
            ) : null}
            {data.leadTime ? (
              <div className="grid grid-cols-[8rem_1fr] gap-4 py-4">
                <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                  {dictionary.product.leadTime}
                </dt>
                <dd className="text-sm font-medium">{data.leadTime}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-charcoal/64 mt-5 text-sm leading-6">
            {data.madeToOrder
              ? dictionary.product.madeToOrder
              : dictionary.product.noPrice}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {data.primaryActions.map((action, index) => (
              <ActionLink
                key={`${action.href}-${action.label}`}
                link={action}
                variant={index === 0 ? "primary" : "quiet"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[var(--surface-raised)] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-[var(--space-page)] lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              eyebrow={data.categoryLabel}
              title={dictionary.product.story}
              description={null}
            />
            <div className="text-charcoal/68 mt-7 space-y-5 text-lg leading-8">
              {data.storyParagraphs.map((paragraph, index) => (
                <p key={`story-${index}`}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div>
            <SectionHeading
              eyebrow={dictionary.product.category}
              title={dictionary.product.specifications}
              description={null}
            />
            <dl className="border-burgundy/12 divide-burgundy/10 mt-7 divide-y rounded-[var(--radius-lg)] border bg-white/60 px-6">
              {data.specifications.map((specification) => (
                <div
                  key={specification.id}
                  className="grid gap-2 py-5 sm:grid-cols-[11rem_1fr] sm:gap-5"
                >
                  <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                    {specification.label}
                  </dt>
                  <dd className="text-sm leading-6 font-medium">
                    {specification.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-3">
          <article className="border-burgundy/12 rounded-[var(--radius-lg)] border bg-white/55 p-6 shadow-[var(--shadow-soft)] sm:p-8">
            {data.contentIsDemo ? (
              <p className="eyebrow">{dictionary.common.updatingLabel}</p>
            ) : null}
            <h2 className="text-burgundy mt-4 font-serif text-3xl">
              {dictionary.product.video}
            </h2>
            {data.video ? (
              <video
                controls
                preload="metadata"
                aria-label={data.video.title}
                className="bg-burgundy mt-6 aspect-video w-full rounded-[var(--radius-md)]"
                {...(data.video.poster?.src
                  ? { poster: data.video.poster.src }
                  : {})}
              >
                <source src={data.video.src} type={data.video.mimeType} />
                {data.video.captionsSrc ? (
                  <track
                    default
                    kind="captions"
                    src={data.video.captionsSrc}
                    srcLang={data.video.captionsLanguage}
                    label={data.video.title}
                  />
                ) : null}
              </video>
            ) : (
              <p className="text-charcoal/64 mt-5 leading-7" role="note">
                {dictionary.product.videoUnavailable}
              </p>
            )}
          </article>

          <article className="border-burgundy/12 rounded-[var(--radius-lg)] border bg-white/55 p-6 shadow-[var(--shadow-soft)] sm:p-8">
            {data.contentIsDemo ? (
              <p className="eyebrow">{dictionary.common.updatingLabel}</p>
            ) : null}
            <h2 className="text-burgundy mt-4 font-serif text-3xl">
              {dictionary.product.variants}
            </h2>
            {data.variants.length > 0 ? (
              <ul className="border-burgundy/12 divide-burgundy/10 mt-6 divide-y border-y">
                {data.variants.map((variant) => (
                  <li key={variant.id} className="py-4">
                    <h3 className="text-burgundy font-semibold">
                      {variant.label}
                    </h3>
                    <p className="text-charcoal/64 mt-2 text-sm leading-6">
                      {variant.description}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-charcoal/64 mt-5 leading-7" role="note">
                {dictionary.product.variantsUnavailable}
              </p>
            )}
          </article>

          <article className="border-burgundy/12 rounded-[var(--radius-lg)] border bg-white/55 p-6 shadow-[var(--shadow-soft)] sm:p-8">
            {data.contentIsDemo ? (
              <p className="eyebrow">{dictionary.common.updatingLabel}</p>
            ) : null}
            <h2 className="text-burgundy mt-4 font-serif text-3xl">
              {dictionary.product.process}
            </h2>
            {data.processSteps.length > 0 ? (
              <ol className="border-burgundy/12 divide-burgundy/10 mt-6 divide-y border-y">
                {data.processSteps.map((step, index) => (
                  <li
                    key={step.id}
                    className="grid grid-cols-[2rem_1fr] gap-3 py-4"
                  >
                    <span className="text-gold-ink text-xs font-bold">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-burgundy font-semibold">
                        {step.title}
                      </h3>
                      <p className="text-charcoal/64 mt-2 text-sm leading-6">
                        {step.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-charcoal/64 mt-5 leading-7" role="note">
                {dictionary.product.processUnavailable}
              </p>
            )}
          </article>
        </div>
      </section>

      {data.relatedProducts.length > 0 ? (
        <section className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28">
          <SectionHeading
            eyebrow={data.categoryLabel}
            title={dictionary.product.related}
            description={null}
          />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.relatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                dictionary={dictionary}
                headingLevel="h3"
              />
            ))}
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}
