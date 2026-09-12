import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import {
  AdminNav,
  type AdminNavGroup,
  type AdminNavRoleGroup,
} from "@/components/admin/admin-nav";
import {
  adminNavSeeds,
  groupNavByRole,
  type NavGroupSeed,
} from "@/components/admin/admin-nav-model";
import { BrandPlaque } from "@/components/public/logo";
import type { Permission } from "@/domains/identity/permissions";
import { roleDefinitionSeeds } from "@/domains/identity/role-definitions";
import { resolveActiveRoleKeys, resolvePermissionCoverages } from "@/lib/auth";
import { canSeeSampleProgress } from "@/domains/sample-progress/access";
import { canSeeMaterials } from "@/domains/materials/access";
import { canSeeReceivables } from "@/domains/receivables/access";
import { canSeeAssignedTasks } from "@/domains/tasks/access";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

type AdminShellProps = {
  locale: AdminLocale;
  children: ReactNode;
  userLabel?: string;
  /** False on screens outside a session (sign-in): no sidebar, full width. */
  withNav?: boolean;
};

export async function AdminShell({
  locale,
  children,
  userLabel,
  withNav = true,
}: AdminShellProps) {
  const copy = getAdminDictionary(locale);
  const basePath = `/${locale}/admin` as Route;
  const groups = adminNavSeeds(locale, basePath);

  let visibleGroups: AdminNavGroup[] = [];
  let roleGroups: AdminNavRoleGroup[] = [];
  if (withNav) {
    const requested = [
      ...new Set(
        groups.flatMap(({ items }) => items.flatMap((i) => i.anyOf ?? [])),
      ),
    ] as Permission[];
    const coverages = await resolvePermissionCoverages(requested);
    const sampleProgressVisible = await canSeeSampleProgress();
    const materialsVisible = await canSeeMaterials();
    const receivablesVisible = await canSeeReceivables();
    const assignedTasksVisible = await canSeeAssignedTasks();

    const covered = (permission: Permission): boolean => {
      const coverage = coverages[permission as keyof typeof coverages];
      return coverage.global || coverage.businessUnitIds.length > 0;
    };
    const anyGranted = requested.some(covered);

    // An unauthenticated or fully unauthorized reader gets no menu at all; the
    // always-visible items only make sense alongside at least one granted area.
    const granted: NavGroupSeed[] = anyGranted
      ? groups
          .map(({ label, items }) => ({
            label,
            items: items
              .filter(
                ({ href }) =>
                  !href.endsWith("/sample-progress") || sampleProgressVisible,
              )
              .filter(
                ({ href }) => !href.endsWith("/materials") || materialsVisible,
              )
              .filter(
                ({ href }) =>
                  !href.endsWith("/receivables") || receivablesVisible,
              )
              // The personal task inbox is granted at `own`, which reports no
              // coverage; its own guard decides whether the entry shows.
              .filter(({ href, anyOf }) =>
                href.endsWith("/my-tasks")
                  ? assignedTasksVisible
                  : anyOf === null || anyOf.some(covered),
              ),
          }))
          .filter(({ items }) => items.length > 0)
      : [];

    // The Director holds every role's screens, so their menu is laid out by
    // role to show who works where; everyone else keeps their own flat menu.
    if (
      granted.length > 0 &&
      (await resolveActiveRoleKeys()).includes("DIRECTOR")
    ) {
      const arranged = groupNavByRole(granted, roleDefinitionSeeds, locale);
      visibleGroups = [arranged.standalone];
      roleGroups = arranged.roleGroups;
    } else {
      visibleGroups = granted.map(({ label, items }) => ({
        label,
        items: items.map(({ href, label: itemLabel }) => ({
          href,
          label: itemLabel,
        })),
      }));
    }
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
        <div className="admin-portal-grid mx-auto grid max-w-[100rem] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <AdminNav
            navigationLabel={copy.navigationLabel}
            basePath={basePath}
            groups={visibleGroups}
            roleGroups={roleGroups}
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
