import { describe, expect, it } from "vitest";

import { locales } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";

function dictionaryShape(value: unknown): unknown {
  if (typeof value === "string") return "string";
  if (!value || typeof value !== "object") return typeof value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, dictionaryShape(child)]),
  );
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(strings);
}

describe("typed public dictionaries", () => {
  it("loads all configured locales with an identical shape", async () => {
    const dictionaries = await Promise.all(locales.map(getDictionary));
    const referenceShape = dictionaryShape(dictionaries[0] satisfies PublicDictionary);

    for (const dictionary of dictionaries) {
      expect(dictionaryShape(dictionary)).toEqual(referenceShape);
      expect(strings(dictionary).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("provides locale-specific navigation copy", async () => {
    const [vietnamese, japanese, chinese] = await Promise.all([
      getDictionary("vi"),
      getDictionary("ja"),
      getDictionary("zh-CN"),
    ]);

    expect(vietnamese.nav.home).not.toBe(japanese.nav.home);
    expect(japanese.nav.home).not.toBe(chinese.nav.home);
  });
});
