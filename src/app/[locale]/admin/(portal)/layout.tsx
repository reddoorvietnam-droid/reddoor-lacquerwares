import type { Route } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  AdminAccessState,
  AdminSetupRequired,
  AdminShell,
} from "@/components/admin";
import {
  ContentAccessDeniedError,
  requireContentPermission,
  requireListAccess,
} from "@/lib/auth";
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
      <AdminShell locale={locale}>
        <AdminSetupRequired locale={locale} />
      </AdminShell>
    );
  }

  // The portal admits anyone holding at least one admin-facing read: content
  // staff enter through `content.read`, operational roles through their
  // shared operational reads. Each page still guards its own permission.
  try {
    try {
      await requireContentPermission("content.read");
    } catch (error) {
      if (
        error instanceof ContentAccessDeniedError &&
        error.code === "PERMISSION_DENIED"
      ) {
        await requireListAccess("orders.read");
      } else {
        throw error;
      }
    }
  } catch (error) {
    if (!(error instanceof ContentAccessDeniedError)) throw error;

    if (error.code === "UNAUTHENTICATED") {
      redirect(`/${locale}/admin/sign-in` as Route);
    }

    if (error.code === "AUTH_NOT_CONFIGURED") {
      return (
        <AdminShell locale={locale}>
          <AdminSetupRequired locale={locale} />
        </AdminShell>
      );
    }

    return (
      <AdminShell locale={locale}>
        <AdminAccessState locale={locale} code={error.code} />
      </AdminShell>
    );
  }

  return <AdminShell locale={locale}>{children}</AdminShell>;
}
