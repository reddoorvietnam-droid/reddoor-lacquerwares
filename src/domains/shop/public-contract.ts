import type { ShopCurrency } from "@/domains/shop/contracts";
import type { Locale } from "@/lib/i18n/config";

/**
 * What the public site sees of the shop. Vietnamese pages read the Vietnamese
 * copy and the VND price; every other locale reads the English copy (falling
 * back to Vietnamese where the English is empty) and the USD price.
 */

export interface PublicShopImage {
  readonly id: string;
  readonly src: string | null;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface PublicShopPrice {
  /** Decimal string rounded to the currency scale. */
  readonly amount: string;
  readonly currency: ShopCurrency;
}

export interface PublicShopItem {
  readonly id: string;
  readonly locale: Locale;
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly descriptionParagraphs: readonly string[];
  readonly price: PublicShopPrice;
  readonly stockQuantity: number;
  readonly inStock: boolean;
  readonly images: readonly PublicShopImage[];
  readonly updatedAt: Date;
}

export interface PublicShopRepository {
  list(locale: Locale): Promise<readonly PublicShopItem[]>;
  getBySlug(locale: Locale, slug: string): Promise<PublicShopItem | null>;
}
