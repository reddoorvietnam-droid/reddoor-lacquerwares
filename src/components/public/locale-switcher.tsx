"use client";

import type { ChangeEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

import {
  isLocale,
  localeConfig,
  locales,
  type Locale,
} from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

export type LocaleSwitcherProps = {
  locale: Locale;
  label: string;
  className?: string;
  showLabel?: boolean;
  onNavigate?: () => void;
};

function replaceLocale(pathname: string, nextLocale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  const currentLocale = segments[0];

  if (currentLocale && isLocale(decodeURIComponent(currentLocale))) {
    segments[0] = nextLocale;
  } else {
    segments.unshift(nextLocale);
  }

  return `/${segments.join("/")}`;
}

export function LocaleSwitcher({
  locale,
  label,
  className,
  showLabel = false,
  onNavigate,
}: LocaleSwitcherProps) {
  const router = useRouter();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    if (!isLocale(nextLocale) || nextLocale === locale) return;

    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = replaceLocale(currentUrl.pathname, nextLocale);
    onNavigate?.();
    router.push(
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` as Route,
    );
  }

  return (
    <label
      className={cn(
        "text-charcoal/70 inline-flex min-h-11 items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase",
        className,
      )}
    >
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
      <span className="relative inline-flex items-center">
        <select
          value={locale}
          onChange={handleChange}
          className="border-charcoal/15 bg-ivory text-burgundy min-h-10 appearance-none rounded-full border py-2 pr-8 pl-3 text-xs font-bold tracking-[0.08em] uppercase"
          aria-label={label}
        >
          {locales.map((option) => (
            <option key={option} value={option}>
              {localeConfig[option].label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 size-3.5"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}
