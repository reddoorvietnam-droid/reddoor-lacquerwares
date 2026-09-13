import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  AdminAccessState,
  AdminSetupRequired,
  AdminShell,
} from "@/components/admin";
import { resolvePortalEntry, resolveSignedInProfile } from "@/lib/auth";
import { inspectAuthEnv, inspectMongoEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) return null;

  const locale = resolveAdminLocale(requestedLocale);
  const configured =
    inspectMongoEnv().configured && inspectAuthEnv().configured;

  if (!configured) {
    return (
      <AdminShell locale={locale} withNav={false}>
        <AdminSetupRequired locale={locale} />
      </AdminShell>
    );
  }

  // The portal admits anyone holding at least one admin-facing read: content
  // staff enter through `content.read`, operational roles through their
  // shared operational reads. Each page still guards its own permission —
  // this gate only decides whether the shell renders, so it is auditless and
  // reuses the request-cached session and snapshot.
  const entry = await resolvePortalEntry([
    "content.read",
    "orders.read",
    "shop.read",
    "shopOrders.read",
  ]);

  if (entry.kind === "unauthenticated") {
    redirect(`/${locale}/admin/sign-in` as Route);
  }

  if (entry.kind === "unconfigured") {
    return (
      <AdminShell locale={locale} withNav={false}>
        <AdminSetupRequired locale={locale} />
      </AdminShell>
    );
  }

  // Every signed-in screen offers a way out (and, from tablet width, names the
  // person), including the waiting and locked screens, where signing out is
  // how someone switches to another Gmail.
  const profile = await resolveSignedInProfile();
  const account = profile
    ? { name: profile.displayName ?? profile.email, email: profile.email }
    : null;

  if (entry.kind === "denied") {
    return (
      <AdminShell locale={locale} withNav={false} account={account}>
        <AdminAccessState
          locale={locale}
          code={entry.code}
          email={profile?.email ?? null}
        />
      </AdminShell>
    );
  }

  return (
    <AdminShell locale={locale} account={account}>
      {children}
    </AdminShell>
  );
}
