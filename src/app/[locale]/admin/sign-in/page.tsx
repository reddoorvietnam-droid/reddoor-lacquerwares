import { notFound } from "next/navigation";

import {
  AdminSetupRequired,
  AdminShell,
  GoogleSignIn,
} from "@/components/admin";
import { inspectAuthEnv, inspectMongoEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export default async function AdminSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const configured =
    inspectMongoEnv().configured && inspectAuthEnv().configured;

  return (
    <AdminShell locale={locale}>
      {configured ? (
        <GoogleSignIn locale={locale} />
      ) : (
        <AdminSetupRequired locale={locale} />
      )}
    </AdminShell>
  );
}
