import "server-only";

import type { Locale } from "./config";
import type { PublicDictionary } from "./dictionary";

type DictionaryLoader = () => Promise<PublicDictionary>;

const dictionaryLoaders = {
  vi: () =>
    import("./dictionaries/vi").then(({ default: dictionary }) => dictionary),
  en: () =>
    import("./dictionaries/en").then(({ default: dictionary }) => dictionary),
  fr: () =>
    import("./dictionaries/fr").then(({ default: dictionary }) => dictionary),
  de: () =>
    import("./dictionaries/de").then(({ default: dictionary }) => dictionary),
  ja: () =>
    import("./dictionaries/ja").then(({ default: dictionary }) => dictionary),
  "zh-CN": () =>
    import("./dictionaries/zh-CN").then(
      ({ default: dictionary }) => dictionary,
    ),
} satisfies Record<Locale, DictionaryLoader>;

export async function getDictionary(locale: Locale): Promise<PublicDictionary> {
  return dictionaryLoaders[locale]();
}
