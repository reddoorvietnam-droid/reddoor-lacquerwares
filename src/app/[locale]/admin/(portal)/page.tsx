import type { Route } from "next";
import { notFound } from "next/navigation";

import { resolveAdminNavigation } from "@/components/admin/admin-nav-access";
import {
  AdminWelcome,
  type WelcomeShortcut,
} from "@/components/admin/admin-welcome";
import {
  describeNavHref,
  greetingFor,
  roleWelcome,
  welcomeCopy,
} from "@/components/admin/admin-welcome-copy";
import {
  roleDefinitionSeeds,
  systemRoleKeys,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";
import { countPendingStaff } from "@/domains/identity/staff-directory";
import {
  resolveActiveRoleKeys,
  resolvePermissionCoverages,
  resolveSignedInProfile,
} from "@/lib/auth";
import { inspectNotificationEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

function isSystemRoleKey(value: string): value is SystemRoleKey {
  return (systemRoleKeys as readonly string[]).includes(value);
}

function businessHour(now: Date): number {
  // Only picks a greeting: a broken reminder configuration must not take
  // down the page every sign-in lands on.
  const notifications = inspectNotificationEnv();
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: notifications.configured
        ? notifications.value.BUSINESS_TIMEZONE
        : "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
}

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const basePath = `/${locale}/admin` as Route;
  const text = welcomeCopy[locale];

  const [profile, roleKeys, navigation, coverages] = await Promise.all([
    resolveSignedInProfile(),
    resolveActiveRoleKeys(),
    resolveAdminNavigation(locale, basePath),
    resolvePermissionCoverages(["users.manageRoles"] as const),
  ]);

  // One role per person; the Director is welcomed as the Director even though
  // their grant opens every other role's screens too.
  const roleKey = roleKeys.includes("DIRECTOR")
    ? "DIRECTOR"
    : (roleKeys.find(isSystemRoleKey) ?? null);
  const seed = roleKey
    ? roleDefinitionSeeds.find((entry) => entry.key === roleKey)
    : undefined;

  // The shortcuts are the reader's own menu. The Director's sidebar lists
  // every role's screens by role; their welcome keeps to the entries on top
  // and the Director's own desk.
  const items = [
    ...navigation.groups.flatMap(({ items }) => items),
    ...(navigation.roleGroups
      .find(({ key }) => key === "DIRECTOR")
      ?.sections.flatMap(({ items }) => items) ?? []),
  ].filter(
    (item, index, all) =>
      item.href !== basePath &&
      all.findIndex((other) => other.href === item.href) === index,
  );

  const staffHref = `${basePath}/staff`;
  const pendingStaff =
    coverages["users.manageRoles"].global &&
    items.some(({ href }) => href === staffHref)
      ? await countPendingStaff()
      : 0;

  const shortcuts: WelcomeShortcut[] = items.map(({ href, label }) => ({
    href,
    label,
    description: describeNavHref(href, basePath, locale),
    badge:
      href === staffHref && pendingStaff > 0
        ? `${pendingStaff} ${text.pendingStaff}`
        : null,
  }));

  return (
    <AdminWelcome
      greeting={greetingFor(businessHour(new Date()), locale)}
      name={
        profile?.displayName ??
        profile?.email.split("@")[0] ??
        text.fallbackName
      }
      roleKey={roleKey}
      roleLabel={seed?.labels[locale] ?? text.noRole}
      tagline={roleKey ? roleWelcome[roleKey][locale] : null}
      startHeading={text.startHeading}
      shortcuts={shortcuts}
    />
  );
}
