import type { Route } from "next";
import { notFound } from "next/navigation";

import { AdminGuide } from "@/components/admin/admin-guide";
import { resolveAdminNavigation } from "@/components/admin/admin-nav-access";
import { guideFor } from "@/components/admin/guide";
import {
  roleDefinitionSeeds,
  systemRoleKeys,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";
import { resolveActiveRoleKeys } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

function isSystemRoleKey(value: string): value is SystemRoleKey {
  return (systemRoleKeys as readonly string[]).includes(value);
}

/**
 * "Hướng dẫn sử dụng website": fixed copy, one role at a time. Each person
 * reads the guide of their own role only — the Director included, whose guide
 * keeps to the entries on top of their menu and the Director's own desk, not
 * the other roles' screens they can also open (confirmed 2026-09-14).
 */
export default async function AdminGuidePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const basePath = `/${locale}/admin` as Route;

  const [roleKeys, navigation] = await Promise.all([
    resolveActiveRoleKeys(),
    resolveAdminNavigation(locale, basePath),
  ]);

  const roleKey = roleKeys.includes("DIRECTOR")
    ? "DIRECTOR"
    : (roleKeys.find(isSystemRoleKey) ?? null);
  const seed = roleKey
    ? roleDefinitionSeeds.find((entry) => entry.key === roleKey)
    : undefined;
  if (!roleKey || !seed) notFound();

  // The sections follow the reader's own menu, so the guide never explains a
  // screen the sidebar does not offer them.
  const menuPaths = [
    ...navigation.groups.flatMap(({ items }) => items),
    ...(navigation.roleGroups
      .find(({ key }) => key === "DIRECTOR")
      ?.sections.flatMap(({ items }) => items) ?? []),
  ].map(({ href }) => (href === basePath ? "" : href.slice(basePath.length)));

  return (
    <AdminGuide
      locale={locale}
      basePath={basePath}
      roleKey={roleKey}
      roleLabel={seed.labels[locale]}
      guide={guideFor(roleKey, menuPaths)}
    />
  );
}
