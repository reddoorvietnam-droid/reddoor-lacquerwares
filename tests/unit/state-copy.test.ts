import { describe, expect, it } from "vitest";

import {
  localeFromPathname,
  stateCopy,
  type LocalizedStateCopy,
} from "@/app/[locale]/state-copy";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }

  return [];
}

describe("localized route-state copy", () => {
  it("covers every supported locale with non-empty copy", () => {
    expect(Object.keys(stateCopy).sort()).toEqual([...locales].sort());

    for (const locale of locales) {
      const copy: LocalizedStateCopy = stateCopy[locale];
      expect(collectStrings(copy).every((text) => text.trim().length > 0)).toBe(
        true,
      );
    }
  });

  it("provides locale-specific loading, recovery, and not-found labels", () => {
    const fields = locales.map((locale) => ({
      loading: stateCopy[locale].loading,
      retry: stateCopy[locale].error.retry,
      notFound: stateCopy[locale].notFound.title,
    }));

    expect(new Set(fields.map(({ loading }) => loading))).toHaveLength(
      locales.length,
    );
    expect(new Set(fields.map(({ retry }) => retry))).toHaveLength(
      locales.length,
    );
    expect(new Set(fields.map(({ notFound }) => notFound))).toHaveLength(
      locales.length,
    );
  });
});

describe("route-state locale resolution", () => {
  it.each<[string, Locale]>([
    ["/vi", "vi"],
    ["/en/products/demo-vase", "en"],
    ["/fr/news", "fr"],
    ["/de/about", "de"],
    ["/ja/collections/demo", "ja"],
    ["/zh-CN/search?q=demo", "zh-CN"],
  ])("resolves %s to %s", (pathname, locale) => {
    expect(localeFromPathname(pathname)).toBe(locale);
  });

  it.each([undefined, null, "", "/", "/unsupported", "/EN/products"])(
    "falls back safely for %s",
    (pathname) => {
      expect(localeFromPathname(pathname)).toBe(defaultLocale);
    },
  );
});
