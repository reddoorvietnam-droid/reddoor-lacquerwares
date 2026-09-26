import { describe, expect, it } from "vitest";

import { locales, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** The product noun buyers search for in each market; the home H1 must name it. */
const HEAD_TERMS: Record<Locale, string> = {
  vi: "sơn mài",
  en: "lacquerware",
  fr: "laque",
  de: "Lack",
  ja: "漆器",
  "zh-CN": "漆器",
};

const MAX_DESCRIPTION_CODE_POINTS = 160;
const MAX_HEADING_CHARACTERS = 48;

function codePoints(value: string): number {
  return [...value].length;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(strings);
}

function headings(pages: PublicDictionary["pages"]): [string, string][] {
  return Object.entries(pages).filter(([key]) => key.endsWith("Heading"));
}

async function loadAll(): Promise<[Locale, PublicDictionary][]> {
  return Promise.all(
    locales.map(
      async (locale) => [locale, await getDictionary(locale)] as const,
    ),
  );
}

describe("dictionary SEO copy", () => {
  it("keeps every meta description non-empty and within 160 code points", async () => {
    for (const [locale, dictionary] of await loadAll()) {
      const entries = Object.entries(dictionary.meta.pageDescriptions);
      expect(entries.length, locale).toBeGreaterThan(0);

      for (const [page, description] of entries) {
        expect(description.trim().length, `${locale} ${page}`).toBeGreaterThan(
          0,
        );
        expect(
          codePoints(description),
          `${locale} ${page}`,
        ).toBeLessThanOrEqual(MAX_DESCRIPTION_CODE_POINTS);
      }
    }
  });

  it("keeps every section heading within 48 characters", async () => {
    for (const [locale, dictionary] of await loadAll()) {
      const entries = headings(dictionary.pages);
      expect(entries.length, locale).toBe(7);

      for (const [key, heading] of entries) {
        expect(heading.trim().length, `${locale} ${key}`).toBeGreaterThan(0);
        expect(codePoints(heading), `${locale} ${key}`).toBeLessThanOrEqual(
          MAX_HEADING_CHARACTERS,
        );
      }
    }
  });

  it("uses one spelling of the Hạ Thái village in Chinese", async () => {
    const chinese = JSON.stringify(await getDictionary("zh-CN"));

    expect(chinese).not.toContain("河泰");
    expect(chinese).toContain("下泰");
  });

  it("leads the Japanese site title with the head term", async () => {
    const japanese = await getDictionary("ja");

    expect(japanese.meta.siteTitle).toContain("ベトナム漆器");
  });

  it("never names the retired lacquerware.vn host", async () => {
    for (const [locale, dictionary] of await loadAll()) {
      const offenders = strings(dictionary).filter((value) =>
        value.includes("lacquerware.vn"),
      );
      expect(offenders, locale).toEqual([]);
    }
  });

  it("names the product in every home title", async () => {
    for (const [locale, dictionary] of await loadAll()) {
      expect(dictionary.home.title, locale).toContain(HEAD_TERMS[locale]);
    }
  });

  it("points the legal intros at reddoor.vn", async () => {
    for (const [locale, dictionary] of await loadAll()) {
      expect(dictionary.legal.privacyIntro, locale).toContain("reddoor.vn");
      expect(dictionary.legal.termsIntro, locale).toContain("reddoor.vn");
    }
  });
});
