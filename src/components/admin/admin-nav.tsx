"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

export type AdminNavItem = {
  href: Route;
  label: string;
};

export type AdminNavGroup = {
  /** Section heading above the group; null for the main ungrouped items. */
  label: string | null;
  items: readonly AdminNavItem[];
};

type AdminNavProps = {
  navigationLabel: string;
  basePath: string;
  groups: readonly AdminNavGroup[];
};

export function AdminNav({ navigationLabel, basePath, groups }: AdminNavProps) {
  const pathname = usePathname();
  const allItems = groups.flatMap(({ items }) => items);

  // Overview lives at the base path itself, so it only matches exactly. Every
  // other section owns its nested routes (e.g. /orders/123) — the longest
  // matching href wins, so /finance/payments lights "payments", not "finance".
  const isActive = (href: string) => {
    if (href === basePath) return pathname === basePath;
    if (pathname !== href && !pathname.startsWith(`${href}/`)) return false;
    return !allItems.some(
      (other) =>
        other.href !== href &&
        other.href.length > href.length &&
        (pathname === other.href || pathname.startsWith(`${other.href}/`)),
    );
  };

  return (
    <nav
      aria-label={navigationLabel}
      className="border-burgundy/10 bg-[#e9dfd0] px-[var(--space-page)] py-4 lg:min-h-[calc(100vh-4.5rem)] lg:border-r lg:px-5 lg:py-8"
    >
      <div className="flex gap-5 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible">
        {groups.map((group, index) => (
          <section key={group.label ?? "main"} className="shrink-0">
            {group.label ? (
              <p className="text-charcoal/45 lg:border-burgundy/10 px-4 pt-1 pb-2 text-[0.65rem] font-semibold tracking-[0.18em] uppercase lg:mt-6 lg:border-t lg:pt-5">
                {group.label}
              </p>
            ) : index > 0 ? (
              <div className="lg:border-burgundy/10 lg:mt-4 lg:border-t lg:pt-4" />
            ) : null}
            <ul className="flex gap-2 lg:flex-col">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={
                        active
                          ? "bg-burgundy text-ivory block rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
                          : "text-burgundy hover:bg-ivory/70 block rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
                      }
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
