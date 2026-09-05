import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { AdminNav, type AdminNavGroup } from "@/components/admin/admin-nav";
import { BrandPlaque } from "@/components/public/logo";
import type { Permission } from "@/domains/identity/permissions";
import { resolvePermissionCoverages } from "@/lib/auth";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

type AdminShellProps = {
  locale: AdminLocale;
  children: ReactNode;
  userLabel?: string;
  /** False on screens outside a session (sign-in): no sidebar, full width. */
  withNav?: boolean;
};

type NavItemSeed = {
  href: Route;
  label: string;
  /** Visible when ANY of these is granted; null = visible to every signed-in reader. */
  anyOf: readonly Permission[] | null;
};

type NavGroupSeed = {
  label: string | null;
  items: readonly NavItemSeed[];
};

export async function AdminShell({
  locale,
  children,
  userLabel,
  withNav = true,
}: AdminShellProps) {
  const copy = getAdminDictionary(locale);
  const basePath = `/${locale}/admin` as Route;

  // Each entry mirrors the permission its page actually guards with, so the
  // menu never links to a section the reader would 404 on.
  const groups: NavGroupSeed[] = [
    {
      label: null,
      items: [
        { href: basePath, label: copy.navigation.overview, anyOf: null },
        {
          href: `${basePath}/orders` as Route,
          label: copy.navigation.orders,
          anyOf: ["orders.read"],
        },
        {
          // The customer list belongs to the people who invoice and collect
          // money; other roles see the customer name on the order.
          href: `${basePath}/customers` as Route,
          label: copy.navigation.customers,
          anyOf: ["customers.read"],
        },
        {
          // The supplier list is kept by whoever records factory cost; other
          // roles only pick from it inside the cost form.
          href: `${basePath}/suppliers` as Route,
          label: copy.navigation.suppliers,
          anyOf: ["suppliers.update"],
        },
        {
          // The workflow reference is for the people who move orders through
          // it, not for every role that can read the order book.
          href: `${basePath}/operations` as Route,
          label: copy.navigation.operations,
          anyOf: ["orders.transitionOperational"],
        },
        {
          // The approvals queue is the Director's decision desk; requesters
          // raise and track approvals from the record they concern.
          href: `${basePath}/approvals` as Route,
          label: copy.navigation.approvals,
          anyOf: ["approvals.decide"],
        },
        {
          href: `${basePath}/organization` as Route,
          label: copy.navigation.organization,
          anyOf: ["users.read"],
        },
        {
          href: `${basePath}/content` as Route,
          label: copy.navigation.content,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/products` as Route,
          label: copy.navigation.products,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/news` as Route,
          label: copy.navigation.news,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/collections` as Route,
          label: copy.navigation.collections,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/shop` as Route,
          label: copy.navigation.shop,
          anyOf: ["shop.read"],
        },
        {
          // Guest orders are handled by the accountant and the Director;
          // the content creator never sees them.
          href: `${basePath}/shop/orders` as Route,
          label: copy.navigation.shopOrders,
          anyOf: ["shopOrders.read"],
        },
        {
          href: `${basePath}/settings` as Route,
          label: copy.navigation.settings,
          anyOf: ["settings.read"],
        },
      ],
    },
    {
      label: copy.navigation.financeGroup,
      items: [
        {
          href: `${basePath}/finance` as Route,
          label: copy.navigation.financeOverview,
          anyOf: ["payments.read"],
        },
        {
          href: `${basePath}/finance/invoices` as Route,
          label: copy.navigation.invoices,
          anyOf: ["invoices.read"],
        },
        {
          href: `${basePath}/finance/payments` as Route,
          label: copy.navigation.payments,
          anyOf: ["payments.read"],
        },
        {
          href: `${basePath}/finance/receivables` as Route,
          label: copy.navigation.receivables,
          anyOf: ["receivables.read"],
        },
        {
          // The ledger page reads receipts, so it guards on payments.read;
          // expense-only readers get the order-costs screen instead.
          href: `${basePath}/finance/ledger` as Route,
          label: copy.navigation.ledger,
          anyOf: ["payments.read"],
        },
        {
          href: `${basePath}/finance/expenses` as Route,
          label: copy.navigation.expenses,
          anyOf: ["expenses.read"],
        },
        {
          href: `${basePath}/finance/fx` as Route,
          label: copy.navigation.fxRates,
          anyOf: ["finance.manageFxSnapshot"],
        },
      ],
    },
  ];

  let visibleGroups: AdminNavGroup[] = [];
  if (withNav) {
    const requested = [
      ...new Set(
        groups.flatMap(({ items }) => items.flatMap((i) => i.anyOf ?? [])),
      ),
    ] as Permission[];
    const coverages = await resolvePermissionCoverages(requested);

    const covered = (permission: Permission): boolean => {
      const coverage = coverages[permission as keyof typeof coverages];
      return coverage.global || coverage.businessUnitIds.length > 0;
    };
    const anyGranted = requested.some(covered);

    // An unauthenticated or fully unauthorized reader gets no menu at all; the
    // always-visible items only make sense alongside at least one granted area.
    visibleGroups = anyGranted
      ? groups
          .map(({ label, items }) => ({
            label,
            items: items
              .filter(({ anyOf }) => anyOf === null || anyOf.some(covered))
              .map(({ href, label: itemLabel }) => ({
                href,
                label: itemLabel,
              })),
          }))
          .filter(({ items }) => items.length > 0)
      : [];
  }

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
      {withNav ? (
        <div className="mx-auto grid max-w-[100rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
          <AdminNav
            navigationLabel={copy.navigationLabel}
            basePath={basePath}
            groups={visibleGroups}
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
