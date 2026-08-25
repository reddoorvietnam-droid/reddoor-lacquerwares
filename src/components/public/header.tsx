import type { Route } from "next";
import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils/cn";

import { buttonVariants } from "../ui/button";
import { Container } from "../ui/container";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoWordmark } from "./logo";
import { MobileNavigation } from "./mobile-navigation";
import type { PublicNavigationItem } from "./navigation";

export type PublicHeaderProps = {
  locale: Locale;
  dictionary: PublicDictionary;
  brandName: string;
  brandDescriptor?: string;
  className?: string;
};

function createNavigation(
  locale: Locale,
  dictionary: PublicDictionary,
): PublicNavigationItem[] {
  return [
    { href: localePath(locale) as Route, label: dictionary.nav.home },
    {
      href: localePath(locale, "/about") as Route,
      label: dictionary.nav.about,
    },
    {
      href: localePath(locale, "/products") as Route,
      label: dictionary.nav.products,
    },
    {
      href: localePath(locale, "/collections") as Route,
      label: dictionary.nav.collections,
    },
    {
      href: localePath(locale, "/process") as Route,
      label: dictionary.nav.process,
    },
    {
      href: localePath(locale, "/news") as Route,
      label: dictionary.nav.news,
    },
    {
      href: localePath(locale, "/contact") as Route,
      label: dictionary.nav.contact,
    },
  ];
}

export function PublicHeader({
  locale,
  dictionary,
  brandName,
  brandDescriptor,
  className,
}: PublicHeaderProps) {
  const navigation = createNavigation(locale, dictionary);
  const homeHref = localePath(locale) as Route;
  const searchHref = localePath(locale, "/search") as Route;
  const quoteHref = `${localePath(locale, "/contact")}#request-quote` as Route;

  return (
    <header
      className={cn(
        "border-b-burgundy/10 bg-ivory/92 sticky top-0 z-40 border-b backdrop-blur-xl",
        className,
      )}
    >
      <a
        href="#main-content"
        className="bg-burgundy text-ivory sr-only z-50 rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {dictionary.common.skipToContent}
      </a>
      <Container
        size="wide"
        className="flex min-h-[4.75rem] items-center justify-between gap-5 py-3"
      >
        <Link href={homeHref} aria-label={dictionary.nav.home}>
          <LogoWordmark
            name={brandName}
            priority
            {...(brandDescriptor ? { descriptor: brandDescriptor } : {})}
          />
        </Link>

        <nav
          className="hidden min-w-0 items-center xl:flex"
          aria-label={dictionary.footer.navigate}
        >
          <ul className="flex items-center">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-charcoal/72 hover:text-lacquer relative flex min-h-11 items-center px-2.5 text-[0.7rem] font-semibold tracking-[0.06em] whitespace-nowrap uppercase transition-colors 2xl:px-3.5 2xl:text-[0.72rem]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          The search entry point was removed from the header bar to keep it
          uncluttered; search stays reachable from the mobile menu and the
          `/search` route itself.
        */}
        <div className="hidden shrink-0 items-center gap-1 xl:flex">
          <LocaleSwitcher locale={locale} label={dictionary.common.language} />
          <Link
            href={quoteHref}
            className={cn(
              buttonVariants({ variant: "primary", size: "sm" }),
              "ml-2",
            )}
          >
            {dictionary.common.requestQuote}
          </Link>
        </div>

        <MobileNavigation
          locale={locale}
          items={navigation}
          navigationLabel={dictionary.footer.navigate}
          openMenuLabel={dictionary.common.openMenu}
          closeMenuLabel={dictionary.common.closeMenu}
          searchLabel={dictionary.common.search}
          searchHref={searchHref}
          quoteLabel={dictionary.common.requestQuote}
          quoteHref={quoteHref}
          languageLabel={dictionary.common.language}
          brandName={brandName}
          {...(brandDescriptor ? { brandDescriptor } : {})}
          brandHomeHref={homeHref}
          brandHomeLabel={dictionary.nav.home}
        />
      </Container>
    </header>
  );
}
