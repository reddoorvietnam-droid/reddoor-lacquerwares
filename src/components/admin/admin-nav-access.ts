import "server-only";

import type { Route } from "next";
import { cache } from "react";

import type {
  AdminNavGroup,
  AdminNavRoleGroup,
} from "@/components/admin/admin-nav";
import {
  adminNavSeeds,
  groupNavByRole,
  type NavGroupSeed,
} from "@/components/admin/admin-nav-model";
import type { Permission } from "@/domains/identity/permissions";
import { roleDefinitionSeeds } from "@/domains/identity/role-definitions";
import { canSeeMaterials } from "@/domains/materials/access";
import { canSeeReceivables } from "@/domains/receivables/access";
import { canSeeSampleProgress } from "@/domains/sample-progress/access";
import { canSeeAssignedTasks } from "@/domains/tasks/access";
import { resolveActiveRoleKeys, resolvePermissionCoverages } from "@/lib/auth";
import type { AdminLocale } from "@/lib/i18n/admin";

export type AdminNavigation = {
  groups: AdminNavGroup[];
  /** The Director's menu laid out by role; empty for everyone else. */
  roleGroups: AdminNavRoleGroup[];
};

/**
 * The menu this session may open. The sidebar and the welcome page's
 * shortcuts both read it, so a shortcut never opens a screen the sidebar
 * hides. Showing an entry decides nothing: every page still guards itself.
 */
export const resolveAdminNavigation = cache(
  async (locale: AdminLocale, basePath: Route): Promise<AdminNavigation> => {
    const groups = adminNavSeeds(locale, basePath);
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

    // An unauthenticated or fully unauthorized reader gets no menu at all;
    // the always-visible items only make sense alongside a granted area.
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
      return {
        groups: [arranged.standalone],
        roleGroups: arranged.roleGroups,
      };
    }

    return {
      groups: granted.map(({ label, items }) => ({
        label,
        items: items.map(({ href, label: itemLabel }) => ({
          href,
          label: itemLabel,
        })),
      })),
      roleGroups: [],
    };
  },
);
