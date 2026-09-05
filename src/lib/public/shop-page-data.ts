import "server-only";

import type {
  ShopItemCardView,
  ShopItemPageData,
  ShopListingPageData,
} from "@/components/public/pages/shop";
import type { PublicPageMedia } from "@/components/public/pages/shared";
import type {
  PublicShopImage,
  PublicShopItem,
} from "@/domains/shop/public-contract";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { formatMoney } from "@/lib/money";
import {
  getPublicContentRepository,
  getPublicShopRepository,
} from "@/lib/public/repositories";
import { encodeSeoSlug, isSafeSeoSlug } from "@/lib/seo/urls";

const contentRepository = getPublicContentRepository();
const shopRepository = getPublicShopRepository();

function displayLocale(locale: Locale): string {
  return locale === "vi" ? "vi-VN" : locale === "zh-CN" ? "zh-CN" : locale;
}

function toMedia(image: PublicShopImage): PublicPageMedia {
  return {
    id: image.id,
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
  };
}

function itemHref(locale: Locale, item: PublicShopItem): string {
  return localePath(locale, `/shop/${encodeSeoSlug(item.slug)}`);
}

function toCard(locale: Locale, item: PublicShopItem): ShopItemCardView {
  const primary = item.images[0];
  return {
    href: itemHref(locale, item),
    id: item.id,
    inStock: item.inStock,
    media: primary
      ? toMedia(primary)
      : {
          id: `${item.id}-slot`,
          src: null,
          alt: item.name,
          width: 1200,
          height: 1500,
        },
    name: item.name,
    priceLabel: formatMoney(item.price, displayLocale(locale)),
    summary: item.summary,
  };
}

export async function getShopListingPageData(
  locale: Locale,
  dictionary: PublicDictionary,
): Promise<ShopListingPageData> {
  const [content, items] = await Promise.all([
    contentRepository.getSnapshot(locale),
    shopRepository.list(locale),
  ]);
  return {
    contentIsDemo: content.isDemo,
    heroEyebrow: dictionary.shop.heroEyebrow,
    items: items
      .filter((item) => isSafeSeoSlug(item.slug))
      .map((item) => toCard(locale, item)),
  };
}

export async function getShopItemPageData(
  locale: Locale,
  dictionary: PublicDictionary,
  slug: string,
): Promise<ShopItemPageData | null> {
  const [content, item] = await Promise.all([
    contentRepository.getSnapshot(locale),
    shopRepository.getBySlug(locale, slug),
  ]);
  if (!item) return null;

  return {
    contentIsDemo: content.isDemo,
    backLink: {
      href: localePath(locale, "/shop"),
      label: dictionary.shop.backToShop,
    },
    descriptionParagraphs: item.descriptionParagraphs,
    gallery: item.images.map(toMedia),
    inStock: item.inStock,
    itemId: item.id,
    locale,
    name: item.name,
    priceLabel: formatMoney(item.price, displayLocale(locale)),
    stockQuantity: item.stockQuantity,
    summary: item.summary,
  };
}
