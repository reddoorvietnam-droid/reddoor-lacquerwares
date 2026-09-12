"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AdminNavItem = {
  href: Route;
  label: string;
};

export type AdminNavGroup = {
  /** Section heading above the group; null for the main ungrouped items. */
  label: string | null;
  items: readonly AdminNavItem[];
};

/**
 * One role's menu inside the Director's sidebar, opened and closed from its
 * heading. An entry several roles share is listed under each of them.
 */
export type AdminNavRoleGroup = {
  key: string;
  label: string;
  sections: readonly AdminNavGroup[];
};

type AdminNavProps = {
  navigationLabel: string;
  basePath: string;
  groups: readonly AdminNavGroup[];
  /** The Director's role groups, below `groups`; empty for everyone else. */
  roleGroups?: readonly AdminNavRoleGroup[];
};

function NavList({
  items,
  isActive,
  onPick,
}: {
  items: readonly AdminNavItem[];
  isActive: (href: string) => boolean;
  onPick?: () => void;
}) {
  return (
    <ul className="flex gap-2 lg:flex-col">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              {...(onPick && { onClick: onPick })}
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
  );
}

export function AdminNav({
  navigationLabel,
  basePath,
  groups,
  roleGroups = [],
}: AdminNavProps) {
  const pathname = usePathname();
  // Open or closed as the reader last set it; a group they never touched is
  // open exactly while it holds the current page.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  // The role group of the last menu click, so an entry shared by several
  // roles lights up only under the role it was picked from.
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  // Overview lives at the base path itself, so it only matches exactly. Every
  // other section owns its nested routes (e.g. /orders/123) — the longest
  // matching href wins, so /finance/payments lights "payments", not "finance".
  const activeHref =
    [
      ...groups.flatMap(({ items }) => items),
      ...roleGroups.flatMap(({ sections }) =>
        sections.flatMap(({ items }) => items),
      ),
    ]
      .map(({ href }): string => href)
      .filter((href) =>
        href === basePath
          ? pathname === basePath
          : pathname === href || pathname.startsWith(`${href}/`),
      )
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const holdsActive = ({ sections }: AdminNavRoleGroup) =>
    sections.some(({ items }) => items.some(({ href }) => href === activeHref));
  const currentKey =
    (
      roleGroups.find(
        (group) => group.key === pickedKey && holdsActive(group),
      ) ?? roleGroups.find(holdsActive)
    )?.key ?? null;

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
            <NavList
              items={group.items}
              isActive={(href) => href === activeHref}
            />
          </section>
        ))}
        {roleGroups.map((group, index) => {
          const open = toggled.get(group.key) ?? group.key === currentKey;
          const listId = `admin-nav-${group.key}`;
          return (
            // Below lg the menu is one scrolling row, so an open group's
            // entries run on beside its heading instead of stacking under it.
            <section
              key={group.key}
              className={`flex shrink-0 items-center gap-2 lg:block ${
                index === 0
                  ? "lg:border-burgundy/10 lg:mt-4 lg:border-t lg:pt-4"
                  : "lg:mt-1"
              }`}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() =>
                  setToggled((previous) =>
                    new Map(previous).set(group.key, !open),
                  )
                }
                className={`hover:bg-ivory/70 flex shrink-0 items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-[0.7rem] font-semibold tracking-[0.14em] whitespace-nowrap uppercase transition-colors lg:w-full lg:whitespace-normal ${
                  open
                    ? "text-burgundy"
                    : "text-charcoal/60 hover:text-burgundy"
                }`}
              >
                <span>{group.label}</span>
                <ChevronRight
                  aria-hidden="true"
                  className={`size-3.5 shrink-0 transition-transform ${
                    open ? "rotate-90" : ""
                  }`}
                />
              </button>
              <div
                id={listId}
                hidden={!open}
                className="lg:border-burgundy/15 flex items-center gap-2 lg:mt-1 lg:ml-4 lg:block lg:border-l lg:pl-2"
              >
                {group.sections.map((section) => (
                  <div
                    key={section.label ?? "main"}
                    className="flex items-center gap-2 lg:block"
                  >
                    {section.label ? (
                      <p className="text-charcoal/45 px-2 text-[0.6rem] font-semibold tracking-[0.18em] whitespace-nowrap uppercase lg:px-4 lg:pt-3 lg:pb-1">
                        {section.label}
                      </p>
                    ) : null}
                    <NavList
                      items={section.items}
                      isActive={(href) =>
                        group.key === currentKey && href === activeHref
                      }
                      onPick={() => setPickedKey(group.key)}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </nav>
  );
}
