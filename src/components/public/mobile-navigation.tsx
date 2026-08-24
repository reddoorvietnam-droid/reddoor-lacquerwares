"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";

import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

import { Button, buttonVariants } from "../ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoWordmark } from "./logo";
import type { PublicNavigationItem } from "./navigation";

export type MobileNavigationProps = {
  locale: Locale;
  items: readonly PublicNavigationItem[];
  navigationLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  searchLabel: string;
  searchHref: Route;
  quoteLabel: string;
  quoteHref: Route;
  languageLabel: string;
  brandName: string;
  brandDescriptor?: string;
  brandHomeHref: Route;
  brandHomeLabel: string;
  className?: string;
};

export function MobileNavigation({
  locale,
  items,
  navigationLabel,
  openMenuLabel,
  closeMenuLabel,
  searchLabel,
  searchHref,
  quoteLabel,
  quoteHref,
  languageLabel,
  brandName,
  brandDescriptor,
  brandHomeHref,
  brandHomeLabel,
  className,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const titleId = useId();

  const restoreFocus = useCallback(() => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const closeMenu = useCallback(() => {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
      return;
    }

    setIsOpen(false);
    restoreFocus();
  }, [restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 80rem)");

    function closeAtDesktop(event: MediaQueryListEvent) {
      if (event.matches && dialogRef.current?.open) {
        closeMenu();
      }
    }

    desktopBreakpoint.addEventListener("change", closeAtDesktop);
    return () =>
      desktopBreakpoint.removeEventListener("change", closeAtDesktop);
  }, [closeMenu]);

  return (
    <div className={cn("xl:hidden", className)}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-label={openMenuLabel}
        aria-expanded={isOpen}
        aria-controls={dialogId}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        className="bg-ivory text-charcoal backdrop:bg-charcoal/72 m-0 ml-auto h-dvh max-h-none w-[min(30rem,100%)] max-w-none border-0 border-l border-black/10 p-0 shadow-[-2rem_0_6rem_rgb(27_25_23/0.22)] backdrop:backdrop-blur-sm"
        onClose={() => {
          setIsOpen(false);
          restoreFocus();
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className="flex min-h-full flex-col px-6 py-5 sm:px-8 sm:py-7">
          <h2 id={titleId} className="sr-only">
            {openMenuLabel}
          </h2>
          <div className="flex items-center justify-between gap-4">
            <Link
              href={brandHomeHref}
              aria-label={brandHomeLabel}
              onClick={closeMenu}
            >
              <LogoWordmark
                name={brandName}
                {...(brandDescriptor ? { descriptor: brandDescriptor } : {})}
              />
            </Link>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              aria-label={closeMenuLabel}
              onClick={closeMenu}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <nav className="mt-12" aria-label={navigationLabel}>
            <ul className="divide-burgundy/10 divide-y">
              {items.map((item, index) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    className="text-burgundy group flex min-h-14 items-center justify-between py-3 font-serif text-2xl tracking-[-0.02em]"
                  >
                    <span>{item.label}</span>
                    <span
                      className="text-gold-ink font-sans text-xs tracking-[0.12em] transition-transform motion-safe:group-hover:translate-x-1"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto grid gap-3 pt-10">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={searchHref}
                onClick={closeMenu}
                className={buttonVariants({ variant: "outline", size: "icon" })}
                aria-label={searchLabel}
              >
                <Search className="size-4" aria-hidden="true" />
              </Link>
              <LocaleSwitcher
                locale={locale}
                label={languageLabel}
                showLabel
                onNavigate={closeMenu}
              />
            </div>
            <Link
              href={quoteHref}
              onClick={closeMenu}
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              {quoteLabel}
            </Link>
          </div>
        </div>
      </dialog>
    </div>
  );
}
