import type { Locale } from "@/lib/i18n/config";

/**
 * The catalogue's product families.
 *
 * Persistence reserves `categoryId` for a taxonomy collection that does not
 * exist yet. Rather than build a management screen nobody asked for, this
 * mirrors `@/domains/news/categories`: a fixed set held in code, referenced by
 * slug. The slug is what the product document stores and what the listing
 * filter puts in the URL, so nothing here needs a database round trip.
 *
 * Adding a family means adding an entry with all six locales. Removing one
 * means the products carrying it fall back to no category — check first.
 */

export type ProductCategory = {
  readonly slug: string;
  readonly labels: Readonly<Record<Locale, string>>;
};

export const productCategories: readonly ProductCategory[] = [
  {
    slug: "khay-mam",
    labels: {
      vi: "Khay & mâm",
      en: "Trays & platters",
      fr: "Plateaux",
      de: "Tabletts",
      ja: "トレイ・盆",
      "zh-CN": "托盘与果盘",
    },
  },
  {
    slug: "do-ban-an",
    labels: {
      vi: "Đồ bàn ăn",
      en: "Tableware",
      fr: "Arts de la table",
      de: "Tischgeschirr",
      ja: "食器",
      "zh-CN": "餐桌用品",
    },
  },
  {
    slug: "binh-lo",
    labels: {
      vi: "Bình & lọ",
      en: "Vases & vessels",
      fr: "Vases & contenants",
      de: "Vasen & Gefäße",
      ja: "花器・器",
      "zh-CN": "花瓶与器皿",
    },
  },
  {
    slug: "hop-trap",
    labels: {
      vi: "Hộp & tráp",
      en: "Boxes & caskets",
      fr: "Boîtes & coffrets",
      de: "Schatullen & Dosen",
      ja: "箱・小物入れ",
      "zh-CN": "盒与匣",
    },
  },
  {
    slug: "tranh-panel",
    labels: {
      vi: "Tranh & panel trang trí",
      en: "Panels & wall art",
      fr: "Panneaux & art mural",
      de: "Paneele & Wandkunst",
      ja: "パネル・壁面装飾",
      "zh-CN": "画屏与壁饰",
    },
  },
  {
    slug: "noi-that",
    labels: {
      vi: "Đồ nội thất nhỏ",
      en: "Small furniture",
      fr: "Petit mobilier",
      de: "Kleinmöbel",
      ja: "小家具",
      "zh-CN": "小型家具",
    },
  },
] as const;

export function findProductCategory(slug: string): ProductCategory | null {
  return productCategories.find((category) => category.slug === slug) ?? null;
}

/** The display name for a stored slug, or `""` when a product has no family. */
export function productCategoryLabel(slug: string, locale: Locale): string {
  return findProductCategory(slug)?.labels[locale] ?? "";
}
