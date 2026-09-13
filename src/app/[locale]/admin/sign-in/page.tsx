import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import {
  AdminSetupRequired,
  AdminShell,
  GoogleSignIn,
  type GoogleSignInError,
} from "@/components/admin";
import { resolveSessionIdentity } from "@/lib/auth/session";
import { inspectAuthEnv, inspectMongoEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

/**
 * The error a Google round trip comes back with: next-auth's own codes, plus
 * `Unavailable` when the sign-in callback itself failed on the server.
 */
function signInError(code: string | undefined): GoogleSignInError | null {
  if (!code) return null;
  return code === "AccessDenied" ||
    code === "Configuration" ||
    code === "Unavailable"
    ? code
    : "default";
}

export default async function AdminSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const configured =
    inspectMongoEnv().configured && inspectAuthEnv().configured;

  if (configured) {
    // Someone already signed in has nothing to do here: the portal decides
    // whether they are waiting for approval, locked, or at work.
    const resolution = await resolveSessionIdentity();
    if (resolution.configured && resolution.identity) {
      redirect(`/${locale}/admin` as Route);
    }
  }

  return (
    <AdminShell locale={locale} withNav={false}>
      {configured ? (
        <GoogleSignIn locale={locale} error={signInError(query.error)} />
      ) : (
        <AdminSetupRequired locale={locale} />
      )}
    </AdminShell>
  );
}
