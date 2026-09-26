import type { Locale } from "@/lib/i18n/config";

/**
 * Brand text is hard-coded on purpose: the signboard name and the one-line
 * tagline shown above every page title are display copy that must not follow
 * the MongoDB settings document. Both the demo and the Mongo repositories
 * read from here, so the six locales cannot drift apart again.
 */

export const BRAND_DISPLAY_NAME = "RED DOOR VIET NAM";

export type BrandCopy = {
  /** Short line above the page title, e.g. "Handcrafted lacquer · Hanoi". */
  readonly eyebrow: string;
  /** The brand tagline shown beside the display name. */
  readonly tagline: string;
};

export const BRAND_COPY: Readonly<Record<Locale, BrandCopy>> = Object.freeze({
  vi: Object.freeze({
    eyebrow: "Nghệ thuật sơn mài Việt Nam",
    tagline: "Nghệ thuật sơn mài Việt Nam",
  }),
  en: Object.freeze({
    eyebrow: "Handcrafted lacquer · Hanoi",
    tagline: "Vietnamese handcrafted lacquer",
  }),
  fr: Object.freeze({
    eyebrow: "Laque artisanale · Hanoï",
    tagline: "Laque artisanale du Vietnam",
  }),
  de: Object.freeze({
    eyebrow: "Handgefertigte Lackkunst · Hanoi",
    tagline: "Handgefertigte Lackkunst",
  }),
  ja: Object.freeze({
    eyebrow: "手仕事の漆 · ハノイ",
    tagline: "ベトナムの手仕事の漆",
  }),
  "zh-CN": Object.freeze({
    eyebrow: "手工漆艺 · 河内",
    tagline: "越南手工漆艺",
  }),
});
