import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { resolveAdminNavigation } from "@/components/admin/admin-nav-access";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { BrandPlaque } from "@/components/public/logo";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

type AdminShellProps = {
  locale: AdminLocale;
  children: ReactNode;
  /** The signed-in person, shown with a sign-out button; absent before sign-in. */
  account?: { name: string; email: string } | null;
  /** False on screens outside a session (sign-in): no sidebar, full width. */
  withNav?: boolean;
};

export async function AdminShell({
  locale,
  children,
  account = null,
  withNav = true,
}: AdminShellProps) {
  const copy = getAdminDictionary(locale);
  const basePath = `/${locale}/admin` as Route;
  const navigation = withNav
    ? await resolveAdminNavigation(locale, basePath)
    : null;

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
            <BrandPlaque
              className="ring-gold/30 w-14 shrink-0 rounded-sm ring-1"
              sizes="3.5rem"
            />
            <span>
              <span className="block font-serif text-lg leading-none">
                {copy.productName}
              </span>
              <span className="text-ivory/65 mt-1 block text-[0.65rem] tracking-[0.18em] uppercase">
                {copy.consoleLabel}
              </span>
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {account ? (
              <span
                className="text-ivory/75 hidden max-w-56 truncate md:inline"
                title={account.email}
              >
                {account.name}
              </span>
            ) : null}
            <Link
              href={`/${locale}` as Route}
              className="border-ivory/25 hover:border-gold/60 hover:bg-ivory/10 inline-flex min-h-10 items-center rounded-full border px-4 font-semibold transition-colors"
            >
              {copy.openPublicSite}
            </Link>
            {account ? <SignOutButton locale={locale} /> : null}
          </div>
        </div>
      </header>
      {navigation ? (
        <div className="admin-portal-grid mx-auto grid max-w-[100rem] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <AdminNav
            navigationLabel={copy.navigationLabel}
            basePath={basePath}
            groups={navigation.groups}
            roleGroups={navigation.roleGroups}
          />
          <main
            id="admin-main"
            className="min-w-0 px-[var(--space-page)] py-8 lg:py-12"
          >
            {children}
          </main>
        </div>
      ) : (
        <main
          id="admin-main"
          className="mx-auto max-w-[100rem] min-w-0 px-[var(--space-page)] py-8 lg:py-12"
        >
          {children}
        </main>
      )}
    </div>
  );
}
