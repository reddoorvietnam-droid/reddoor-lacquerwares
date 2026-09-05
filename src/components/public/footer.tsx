import type { Route } from "next";
import Link from "next/link";

import { localePath, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils/cn";

import { Container } from "../ui/container";
import { LogoWordmark } from "./logo";
import type { PublicNavigationItem } from "./navigation";

export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type PublicFooterProps = {
  locale: Locale;
  dictionary: PublicDictionary;
  brandName: string;
  brandDescriptor?: string;
  addressLines?: readonly string[];
  contactLinks?: readonly FooterLink[];
  socialLinks?: readonly FooterLink[];
  className?: string;
};

function footerNavigation(
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
      href: localePath(locale, "/shop") as Route,
      label: dictionary.nav.shop,
    },
    {
      href: localePath(locale, "/contact") as Route,
      label: dictionary.nav.contact,
    },
  ];
}

function legalNavigation(
  locale: Locale,
  dictionary: PublicDictionary,
): PublicNavigationItem[] {
  return [
    {
      href: localePath(locale, "/privacy") as Route,
      label: dictionary.footer.privacy,
    },
    {
      href: localePath(locale, "/terms") as Route,
      label: dictionary.footer.terms,
    },
    {
      href: localePath(locale, "/accessibility") as Route,
      label: dictionary.footer.accessibility,
    },
  ];
}

export function PublicFooter({
  locale,
  dictionary,
  brandName,
  brandDescriptor,
  addressLines = [],
  contactLinks = [],
  socialLinks = [],
  className,
}: PublicFooterProps) {
  const navigation = footerNavigation(locale, dictionary);
  const legal = legalNavigation(locale, dictionary);
  const showContact =
    addressLines.length > 0 ||
    contactLinks.length > 0 ||
    socialLinks.length > 0;

  return (
    <footer
      className={cn(
        "bg-burgundy text-ivory border-gold/40 border-t",
        className,
      )}
    >
      <Container size="wide" className="relative py-14 sm:py-18 lg:py-22">
        <div className="grid gap-12 border-b border-white/12 pb-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link
              href={localePath(locale) as Route}
              aria-label={dictionary.nav.home}
            >
              <LogoWordmark
                name={brandName}
                inverse
                {...(brandDescriptor ? { descriptor: brandDescriptor } : {})}
              />
            </Link>
            <p className="text-ivory/68 mt-6 text-sm leading-7">
              {dictionary.footer.description}
            </p>
          </div>

          <FooterColumn title={dictionary.footer.navigate} links={navigation} />
          <FooterColumn title={dictionary.footer.legal} links={legal} />

          {showContact ? (
            <div>
              <h2 className="text-gold text-xs font-semibold tracking-[0.18em] uppercase">
                {dictionary.nav.contact}
              </h2>
              {addressLines.length > 0 ? (
                <address className="text-ivory/68 mt-5 text-sm leading-7 not-italic">
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : null}
              <ul className="mt-4 space-y-2">
                {[...contactLinks, ...socialLinks].map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <a
                      href={link.href}
                      className="text-ivory/68 hover:text-gold text-sm transition-colors"
                      {...(link.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/*
          The mark already appears in the wordmark above; repeating it here
          would show the same logo twice in one footer.
        */}
        <p className="text-ivory/52 pt-7 text-center text-xs leading-6">
          {dictionary.footer.copyright}
        </p>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly PublicNavigationItem[];
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-gold text-xs font-semibold tracking-[0.18em] uppercase">
        {title}
      </h2>
      <ul className="mt-5 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-ivory/68 hover:text-gold text-sm transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
