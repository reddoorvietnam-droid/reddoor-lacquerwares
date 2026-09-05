import type { PublicDictionary } from "@/lib/i18n/dictionary";

import {
  MediaFrame,
  PageFrame,
  PageHero,
  PageNotices,
  SectionHeading,
  type PublicPageLink,
  type PublicPageMedia,
  type PublicPageNotice,
} from "./shared";
import { ShopOrderForm, type ShopOrderFormProps } from "./shop-order-form";

export interface ShopItemCardView {
  href: string;
  id: string;
  inStock: boolean;
  media: PublicPageMedia;
  name: string;
  priceLabel: string;
  summary: string;
}

export interface ShopListingPageData {
  contentIsDemo: boolean;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  items: readonly ShopItemCardView[];
}

export interface ShopListingPageProps {
  data: ShopListingPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function ShopItemCard({
  dictionary,
  item,
}: {
  dictionary: PublicDictionary;
  item: ShopItemCardView;
}) {
  return (
    <article className="group border-burgundy/12 overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]">
      <a href={item.href} className="block overflow-hidden">
        <MediaFrame
          media={item.media}
          sizes="(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw"
          className="aspect-4/5 rounded-none border-0"
        />
      </a>
      <div className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-burgundy text-lg font-semibold tabular-nums">
            {item.priceLabel}
          </p>
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${
              item.inStock
                ? "border-lacquer/20 bg-lacquer/8 text-lacquer"
                : "border-charcoal/15 bg-charcoal/6 text-charcoal/60"
            }`}
          >
            {item.inStock ? dictionary.shop.inStock : dictionary.shop.soldOut}
          </span>
        </div>
        <h2 className="text-burgundy mt-3 font-serif text-2xl leading-tight tracking-[-0.02em]">
          <a href={item.href} className="hover:text-lacquer">
            {item.name}
          </a>
        </h2>
        <p className="text-charcoal/62 mt-3 line-clamp-3 leading-7">
          {item.summary}
        </p>
        <a
          href={item.href}
          className="text-burgundy hover:text-lacquer mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
        >
          {dictionary.shop.viewItem}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  );
}

export function ShopListingPage({
  data,
  dictionary,
  isDemo,
  notices,
}: ShopListingPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.shopTitle}
        intro={dictionary.pages.shopIntro}
        media={data.heroMedia}
      />

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-16 lg:py-24">
        {data.items.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item) => (
              <ShopItemCard key={item.id} item={item} dictionary={dictionary} />
            ))}
          </div>
        ) : (
          <div className="border-burgundy/12 rounded-[var(--radius-lg)] border border-dashed px-6 py-20 text-center">
            <h2 className="text-burgundy font-serif text-3xl">
              {dictionary.shop.emptyTitle}
            </h2>
            <p className="text-charcoal/64 mx-auto mt-4 max-w-xl leading-7">
              {dictionary.shop.emptyDescription}
            </p>
          </div>
        )}
      </section>
    </PageFrame>
  );
}

export interface ShopItemPageData {
  contentIsDemo: boolean;
  backLink: PublicPageLink;
  descriptionParagraphs: readonly string[];
  gallery: readonly PublicPageMedia[];
  inStock: boolean;
  itemId: string;
  locale: string;
  name: string;
  priceLabel: string;
  stockQuantity: number;
  summary: string;
}

export interface ShopItemPageProps {
  data: ShopItemPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
  submitOrder: ShopOrderFormProps["submit"];
}

export function ShopItemPage({
  data,
  dictionary,
  isDemo,
  notices,
  submitOrder,
}: ShopItemPageProps) {
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
            <div className="grid gap-4 sm:grid-cols-2">
              {data.gallery.map((media, index) => (
                <div
                  key={media.id}
                  className={index === 0 ? "group sm:col-span-2" : "group"}
                >
                  <MediaFrame
                    media={media}
                    sizes="(min-width: 1024px) 36vw, (min-width: 640px) 50vw, 100vw"
                    className={
                      index === 0 ? "aspect-4/5 sm:aspect-4/3" : "aspect-square"
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="self-start lg:sticky lg:top-24">
          <p className="eyebrow">{dictionary.pages.shopTitle}</p>
          <h1 className="text-burgundy mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.045em] text-balance sm:text-6xl">
            {data.name}
          </h1>
          <p className="text-charcoal/68 mt-6 text-lg leading-8 text-pretty">
            {data.summary}
          </p>
          <dl className="border-burgundy/12 divide-burgundy/10 mt-8 divide-y border-y">
            <div className="grid grid-cols-[8rem_1fr] gap-4 py-4">
              <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                {dictionary.shop.price}
              </dt>
              <dd className="text-burgundy text-xl font-semibold tabular-nums">
                {data.priceLabel}
              </dd>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-4 py-4">
              <dt className="text-charcoal/64 text-xs tracking-[0.12em] uppercase">
                {dictionary.shop.inStock}
              </dt>
              <dd className="text-sm font-medium">
                {data.inStock
                  ? dictionary.shop.inStock
                  : dictionary.shop.soldOut}
              </dd>
            </div>
          </dl>
          <p className="text-charcoal/64 mt-5 text-sm leading-6">
            {dictionary.shop.shippingNote}
          </p>
        </div>
      </section>

      {data.descriptionParagraphs.length > 0 ? (
        <section className="bg-[var(--surface-raised)] py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-[var(--space-page)]">
            <div className="text-charcoal/68 max-w-3xl space-y-5 text-lg leading-8">
              {data.descriptionParagraphs.map((paragraph, index) => (
                <p key={`description-${index}`}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="order"
        className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <SectionHeading
            eyebrow={dictionary.pages.shopTitle}
            title={dictionary.shop.orderTitle}
            description={dictionary.shop.orderDescription}
          />
          <div className="border-burgundy/12 rounded-[var(--radius-lg)] border bg-white/70 p-6 shadow-[var(--shadow-soft)] sm:p-8">
            {data.inStock ? (
              <ShopOrderForm
                dictionary={dictionary}
                itemId={data.itemId}
                locale={data.locale}
                maxQuantity={Math.min(data.stockQuantity, 999)}
                submit={submitOrder}
              />
            ) : (
              <p role="status" className="text-charcoal/68 leading-7">
                {dictionary.shop.soldOut}
              </p>
            )}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
