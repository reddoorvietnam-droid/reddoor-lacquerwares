"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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

import { LocaleFlag } from "./locale-flags";

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

/**
 * Language switcher.
 *
 * A native `select` cannot render a flag inside an option, so this is a listbox
 * built from a button and a list. That means the keyboard contract is ours to
 * honour: arrows move, Home/End jump, Enter or Space selects, Escape closes and
 * returns focus, Tab or an outside click dismisses.
 *
 * The trigger shows only the flag, but every option keeps its language name in
 * text, and the button is labelled with the current language. A flag identifies
 * a country rather than a language, so it never carries the meaning alone.
 */
export function LocaleSwitcher({
  locale,
  label,
  className,
  showLabel = false,
  onNavigate,
}: LocaleSwitcherProps) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(locales.indexOf(locale), 0),
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const selectLocale = useCallback(
    (nextLocale: Locale) => {
      close(true);
      if (nextLocale === locale) return;

      const currentUrl = new URL(window.location.href);
      currentUrl.pathname = replaceLocale(currentUrl.pathname, nextLocale);
      onNavigate?.();
      router.push(
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}` as Route,
      );
    },
    [close, locale, onNavigate, router],
  );

  // Dismiss on an outside pointer press. Registered only while open so the
  // listener does not outlive the menu.
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Move real focus onto the active option so screen readers announce it.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openAt(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function handleButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = Math.max(locales.indexOf(locale), 0);

    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openAt(currentIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(locales.length - 1);
    }
  }

  function handleOptionKeyDown(event: React.KeyboardEvent<HTMLLIElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % locales.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(
          (index) => (index - 1 + locales.length) % locales.length,
        );
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(locales.length - 1);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const option = locales[activeIndex];
        if (option) selectLocale(option);
        break;
      }
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        break;
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-flex items-center gap-2", className)}
    >
      {showLabel ? (
        <span className="text-charcoal/70 text-xs font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={`${label}: ${localeConfig[locale].label}`}
        onClick={() =>
          open ? close(false) : openAt(Math.max(locales.indexOf(locale), 0))
        }
        onKeyDown={handleButtonKeyDown}
        className="border-charcoal/15 bg-ivory hover:border-gold/60 focus-visible:outline-gold inline-flex min-h-11 items-center gap-1.5 rounded-full border py-2 pr-2.5 pl-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <LocaleFlag locale={locale} className="w-6" />
        <ChevronDown
          className={cn(
            "text-charcoal/55 size-3.5 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`${listboxId}-${activeIndex}`}
          className="border-charcoal/12 bg-ivory absolute top-full right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border py-1.5 shadow-[0_1.25rem_3rem_rgb(61_13_16/0.18)]"
        >
          {locales.map((option, index) => {
            const selected = option === locale;

            return (
              <li
                key={option}
                id={`${listboxId}-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => selectLocale(option)}
                onKeyDown={handleOptionKeyDown}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm outline-none",
                  selected ? "text-burgundy font-semibold" : "text-charcoal/75",
                  activeIndex === index && "bg-lacquer/8 text-burgundy",
                )}
              >
                <LocaleFlag locale={option} className="w-6" />
                <span>{localeConfig[option].label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
