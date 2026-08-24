import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

type AdminShellProps = {
  locale: AdminLocale;
  children: ReactNode;
  userLabel?: string;
};

export function AdminShell({ locale, children, userLabel }: AdminShellProps) {
  const copy = getAdminDictionary(locale);
  const basePath = `/${locale}/admin` as Route;
  const navigation = [
    { href: basePath, label: copy.navigation.overview },
    {
      href: `${basePath}/content` as Route,
      label: copy.navigation.content,
    },
    {
      href: `${basePath}/products` as Route,
      label: copy.navigation.products,
    },
    { href: `${basePath}/news` as Route, label: copy.navigation.news },
    {
      href: `${basePath}/collections` as Route,
      label: copy.navigation.collections,
    },
    {
      href: `${basePath}/settings` as Route,
      label: copy.navigation.settings,
    },
  ];

  return (
    <div className="text-charcoal min-h-screen bg-[#f2ede4]">
      <a
        href="#admin-main"
        className="bg-ivory text-burgundy sr-only z-50 rounded px-4 py-3 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {locale === "vi" ? "Bỏ qua đến nội dung" : "Skip to content"}
      </a>
      <header className="border-burgundy/15 bg-burgundy text-ivory lg:sticky lg:top-0 lg:z-30">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-center justify-between gap-4 px-[var(--space-page)] py-4">
          <Link href={basePath} className="group flex items-center gap-3">
            <span
              aria-hidden="true"
              className="border-gold/35 bg-lacquer text-gold grid size-10 place-items-center rounded-xl border font-serif text-xl"
            >
              R
            </span>
            <span>
              <span className="block font-serif text-lg leading-none">
                {copy.productName}
              </span>
              <span className="text-ivory/65 mt-1 block text-[0.65rem] tracking-[0.18em] uppercase">
                {copy.consoleLabel}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {userLabel ? (
              <span className="text-ivory/70 hidden sm:inline">
                {userLabel}
              </span>
            ) : null}
            <Link
              href={`/${locale}` as Route}
              className="border-ivory/25 hover:border-gold/60 hover:bg-ivory/10 rounded-full border px-4 py-2 font-semibold transition-colors"
            >
              {copy.openPublicSite}
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[100rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label={copy.navigationLabel}
          className="border-burgundy/10 bg-[#e9dfd0] px-[var(--space-page)] py-4 lg:min-h-[calc(100vh-4.5rem)] lg:border-r lg:px-5 lg:py-8"
        >
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {navigation.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="text-burgundy hover:bg-ivory/70 block rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main
          id="admin-main"
          className="min-w-0 px-[var(--space-page)] py-8 lg:py-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
