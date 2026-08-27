import type { Locale } from "@/lib/i18n/config";

/**
 * The newsroom's category catalogue.
 *
 * Persistence reserves `categoryId` for a future taxonomy collection; until
 * an administrator needs to manage categories, a fixed editorial set serves
 * better than a management screen. The chosen category rides in `tagKeys`
 * under the reserved `cat-` prefix — the one field the command schemas
 * already accept — and the public reader lifts it back out, so no schema in
 * the versioned workflow had to move.
 */

export const NEWS_CATEGORY_TAG_PREFIX = "cat-";

export type NewsCategory = {
  readonly slug: string;
  readonly labels: Readonly<Record<Locale, string>>;
};

export const newsCategories: readonly NewsCategory[] = [
  {
    slug: "tin-tuc",
    labels: {
      vi: "Tin tức",
      en: "News",
      fr: "Actualités",
      de: "Neuigkeiten",
      ja: "ニュース",
      "zh-CN": "新闻",
    },
  },
  {
    slug: "xuong",
    labels: {
      vi: "Từ xưởng",
      en: "From the workshop",
      fr: "Depuis l'atelier",
      de: "Aus der Werkstatt",
      ja: "工房から",
      "zh-CN": "来自工坊",
    },
  },
  {
    slug: "trien-lam",
    labels: {
      vi: "Triển lãm & hội chợ",
      en: "Exhibitions & fairs",
      fr: "Expositions & salons",
      de: "Ausstellungen & Messen",
      ja: "展示会・見本市",
      "zh-CN": "展会与博览",
    },
  },
  {
    slug: "huong-dan",
    labels: {
      vi: "Hướng dẫn & bảo quản",
      en: "Guides & care",
      fr: "Guides & entretien",
      de: "Anleitungen & Pflege",
      ja: "ガイドとお手入れ",
      "zh-CN": "指南与保养",
    },
  },
] as const;

export function categoryTag(slug: string): string {
  return `${NEWS_CATEGORY_TAG_PREFIX}${slug}`;
}

export function findNewsCategory(slug: string): NewsCategory | null {
  return newsCategories.find((category) => category.slug === slug) ?? null;
}

/** Splits stored tag keys into the category (if any) and the public tags. */
export function splitCategoryFromTags(tagKeys: readonly string[]): {
  category: NewsCategory | null;
  tags: readonly string[];
} {
  let category: NewsCategory | null = null;
  const tags: string[] = [];
  for (const key of tagKeys) {
    if (key.startsWith(NEWS_CATEGORY_TAG_PREFIX)) {
      category ??= findNewsCategory(key.slice(NEWS_CATEGORY_TAG_PREFIX.length));
    } else {
      tags.push(key);
    }
  }
  return { category, tags };
}
