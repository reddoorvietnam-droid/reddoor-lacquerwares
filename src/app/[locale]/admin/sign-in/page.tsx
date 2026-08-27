import { notFound } from "next/navigation";

import {
  AdminSetupRequired,
  AdminShell,
  DevSignIn,
  GoogleSignIn,
} from "@/components/admin";
import { devPreviewAccounts } from "@/domains/identity/dev-login";
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
  const authEnv = inspectAuthEnv();
  const configured = inspectMongoEnv().configured && authEnv.configured;
  const devLoginEnabled =
    authEnv.configured && Boolean(authEnv.value.DEV_LOGIN_PASSWORD);
  const googleEnabled =
    authEnv.configured &&
    Boolean(authEnv.value.AUTH_GOOGLE_ID) &&
    Boolean(authEnv.value.AUTH_GOOGLE_SECRET);

  return (
    <AdminShell locale={locale}>
      {configured ? (
        <>
          {googleEnabled ? <GoogleSignIn locale={locale} /> : null}
          {devLoginEnabled ? (
            <DevSignIn
              locale={locale}
              accounts={devPreviewAccounts.map((account) => ({
                username: account.username,
                label: account.labels[locale],
                summary: account.summary[locale],
              }))}
            />
          ) : null}
        </>
      ) : (
        <AdminSetupRequired locale={locale} />
      )}
    </AdminShell>
  );
}
