import "server-only";

import { unstable_cache } from "next/cache";

import {
  shopCurrencyForLocale,
  shopTextLocaleFor,
  type ShopItemDto,
} from "@/domains/shop/contracts";
import { MongoShopItemStore } from "@/domains/shop/mongo-store";
import type {
  PublicShopImage,
  PublicShopItem,
  PublicShopRepository,
} from "@/domains/shop/public-contract";
import type { Locale } from "@/lib/i18n/config";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";

/**
 * Reads what the shop has put on sale. Only `live` items are visible; drafts,
 * hidden, and deleted items never reach a visitor. The listing is cached per
 * locale under the `shop` tag, which the service's post-commit hook clears.
 */

export const SHOP_CACHE_TAG = "shop";

const store = new MongoShopItemStore();

function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim().replace(/\s*\r?\n\s*/g, " "))
    .filter(Boolean);
}

function mapImages(item: ShopItemDto, name: string): PublicShopImage[] {
  let storage: CloudinaryMediaStorage | null = null;
  try {
    storage = CloudinaryMediaStorage.fromEnvironment();
  } catch {
    storage = null;
  }
  if (item.images.length === 0) {
    return [
      {
        id: `${item.id}-slot`,
        src: null,
        alt: name,
        width: 1200,
        height: 1500,
      },
    ];
  }
  return item.images.map((image, index) => ({
    id: `${item.id}-${index + 1}`,
    src: storage
      ? storage.buildImageUrl(image.publicId, image.assetVersion, 1600)
      : null,
    alt: image.alt ?? name,
    width: image.width,
    height: image.height,
  }));
}

function mapItem(item: ShopItemDto, locale: Locale): PublicShopItem {
  const textLocale = shopTextLocaleFor(locale);
  const preferred = item.text[textLocale];
  const fallback = item.text.vi;
  const name = preferred.name.trim() || fallback.name;
  const summary = preferred.summary.trim() || fallback.summary;
  const description = preferred.description.trim() || fallback.description;
  const currency = shopCurrencyForLocale(locale);

  return {
    id: item.id,
    locale,
    slug: item.slug,
    name,
    summary,
    descriptionParagraphs: paragraphs(description),
    price: {
      amount: currency === "VND" ? item.priceVnd : item.priceUsd,
      currency,
    },
    stockQuantity: item.stockQuantity,
    inStock: item.stockQuantity > 0,
    images: mapImages(item, name),
    updatedAt: item.updatedAt,
  };
}

const listLive = unstable_cache(
  async () => store.list({ status: "live" }),
  ["shop-live-items"],
  { tags: [SHOP_CACHE_TAG], revalidate: 300 },
);

export const mongoPublicShopRepository: PublicShopRepository = {
  async list(locale: Locale): Promise<readonly PublicShopItem[]> {
    const items = await listLive();
    return items.map((item) => mapItem(item, locale));
  },

  async getBySlug(
    locale: Locale,
    slug: string,
  ): Promise<PublicShopItem | null> {
    const items = await listLive();
    const item = items.find((candidate) => candidate.slug === slug);
    return item ? mapItem(item, locale) : null;
  },
};
