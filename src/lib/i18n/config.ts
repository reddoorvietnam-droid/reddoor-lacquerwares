export const localeConfig = {
  vi: { label: "Tiếng Việt", shortLabel: "VI", direction: "ltr" },
  en: { label: "English", shortLabel: "EN", direction: "ltr" },
  fr: { label: "Français", shortLabel: "FR", direction: "ltr" },
  de: { label: "Deutsch", shortLabel: "DE", direction: "ltr" },
  ja: { label: "日本語", shortLabel: "JA", direction: "ltr" },
  "zh-CN": { label: "简体中文", shortLabel: "中文", direction: "ltr" },
} as const;

export type Locale = keyof typeof localeConfig;

export const locales = Object.keys(localeConfig) as Locale[];
export const defaultLocale: Locale = "vi";

export function isLocale(value: string): value is Locale {
  return Object.hasOwn(localeConfig, value);
}

export function localePath(locale: Locale, path = ""): string {
  const normalizedPath = path === "/" ? "" : path;
  return `/${locale}${normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`}`.replace(
    /\/$/,
    "",
  );
}
