import { notFound } from "next/navigation";

import { zaloTokenStatus } from "@/domains/notifications/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import {
  inspectAiEnv,
  inspectAuthEnv,
  inspectCloudinaryEnv,
  inspectCronEnv,
  inspectEmailEnv,
  inspectMongoEnv,
  inspectNotificationEnv,
  inspectZaloEnv,
  isDevOpenAccessEnabled,
} from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";
import { zaloCallbackUrl } from "@/lib/zalo/oauth-consent";

export const dynamic = "force-dynamic";

type FeatureRow = {
  key: string;
  label: string;
  configured: boolean;
  statusLabel: string;
  detail: string | null;
  note: string | null;
  warn: boolean;
  action?: { href: string; label: string } | null;
};

export default async function AdminSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ zalo?: string; reason?: string }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).settings;

  try {
    await requirePermission("settings.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }
  const canManageSystem = await requirePermission("settings.manageSystem")
    .then(() => true)
    .catch((cause) => {
      if (cause instanceof ContentAccessDeniedError) return false;
      throw cause;
    });

  const mongo = inspectMongoEnv();
  const auth = inspectAuthEnv();
  const cloudinary = inspectCloudinaryEnv();
  const email = inspectEmailEnv();
  const ai = inspectAiEnv();
  const notifications = inspectNotificationEnv();
  const cron = inspectCronEnv();
  const zalo = inspectZaloEnv();
  const zaloToken = zalo.configured
    ? await zaloTokenStatus().catch(() => null)
    : null;
  const timeZone = notifications.configured
    ? notifications.value.BUSINESS_TIMEZONE
    : "Asia/Ho_Chi_Minh";
  const formatInstant = (value: Date | null): string =>
    value
      ? value.toLocaleString(locale === "vi" ? "vi-VN" : "en-GB", {
          timeZone,
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";
  const fill = (template: string, values: Record<string, string>): string =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
  const zaloNote = ((): string | null => {
    if (!zaloToken) return null;
    const values = {
      connectedAt: formatInstant(zaloToken.connectedAt),
      accessUntil: formatInstant(zaloToken.accessTokenExpiresAt),
      refreshUntil: formatInstant(zaloToken.refreshTokenExpiresAt),
      count: String(zaloToken.refreshCount),
      error: zaloToken.lastRefreshError ?? "",
    };
    const main =
      zaloToken.state === "not_connected"
        ? copy.noteZaloNotConnected
        : zaloToken.state === "ok"
          ? fill(copy.noteZaloOk, values)
          : zaloToken.state === "renewal_failed"
            ? fill(copy.noteZaloRenewalFailed, values)
            : fill(copy.noteZaloExpired, values);
    const aging =
      zaloToken.refreshTokenAging && zaloToken.state !== "not_connected"
        ? ` ${fill(copy.noteZaloRefreshAging, values)}`
        : "";
    const callback = canManageSystem
      ? ` ${fill(copy.noteZaloCallback, { url: zaloCallbackUrl() })}`
      : "";
    return `${main}${aging}${callback}`;
  })();
  const zaloConnected =
    zaloToken !== null && zaloToken.state !== "not_connected";
  const zaloWarn =
    zaloToken !== null &&
    (zaloToken.state === "renewal_failed" ||
      zaloToken.state === "expired" ||
      (zaloToken.refreshTokenAging && zaloConnected));
  const zaloAction =
    zalo.configured && canManageSystem
      ? {
          href: `/api/zalo/oauth/start?locale=${locale}`,
          label: zaloConnected ? copy.zaloReconnect : copy.zaloConnect,
        }
      : null;
  const googleConfigured =
    auth.configured && Boolean(auth.value.AUTH_GOOGLE_ID);
  const openAccess = isDevOpenAccessEnabled();

  const missingDetail = (feature: {
    configured: boolean;
    invalidKeys?: readonly string[];
  }): string | null =>
    !feature.configured && feature.invalidKeys?.length
      ? `${copy.missingPrefix}: ${feature.invalidKeys.join(", ")}`
      : null;

  const rows: FeatureRow[] = [
    {
      key: "mongo",
      label: copy.featureMongo,
      configured: mongo.configured,
      statusLabel: mongo.configured
        ? copy.statusConfigured
        : copy.statusMissing,
      detail: missingDetail(mongo),
      note: null,
      warn: false,
    },
    {
      key: "auth",
      label: copy.featureAuth,
      configured: auth.configured,
      statusLabel: auth.configured ? copy.statusConfigured : copy.statusMissing,
      detail: missingDetail(auth),
      note: null,
      warn: false,
    },
    {
      key: "google",
      label: copy.featureGoogle,
      configured: googleConfigured,
      statusLabel: googleConfigured
        ? copy.statusConfigured
        : copy.statusMissing,
      detail: null,
      note: googleConfigured ? null : copy.noteGoogle,
      warn: false,
    },
    {
      key: "openAccess",
      label: copy.featureOpenAccess,
      configured: openAccess,
      statusLabel: openAccess ? copy.statusEnabled : copy.statusDisabled,
      detail: null,
      note: openAccess ? copy.noteOpenAccess : null,
      warn: openAccess,
    },
    {
      key: "cloudinary",
      label: copy.featureCloudinary,
      configured: cloudinary.configured,
      statusLabel: cloudinary.configured
        ? copy.statusConfigured
        : copy.statusMissing,
      detail: missingDetail(cloudinary),
      note: null,
      warn: false,
    },
    {
      key: "email",
      label: copy.featureEmail,
      configured: email.configured,
      statusLabel: email.configured
        ? copy.statusConfigured
        : copy.statusMissing,
      detail: missingDetail(email),
      note: null,
      warn: false,
    },
    {
      key: "ai",
      label: copy.featureAi,
      configured: ai.configured,
      statusLabel: ai.configured
        ? `${copy.statusConfigured} · ${ai.value.AI_PROVIDER === "mock" ? "mock" : `${ai.value.AI_PROVIDER} · ${ai.value.AI_MODEL}`}`
        : copy.statusMissing,
      detail: missingDetail(ai),
      note:
        ai.configured && ai.value.AI_PROVIDER === "mock"
          ? copy.noteAiMock
          : null,
      warn: ai.configured && ai.value.AI_PROVIDER === "mock",
    },
    {
      key: "notifications",
      label: copy.featureNotifications,
      configured:
        notifications.configured &&
        notifications.value.NOTIFICATION_DELIVERY === "live",
      statusLabel: notifications.configured
        ? `${notifications.value.NOTIFICATION_DELIVERY} · ${notifications.value.BUSINESS_TIMEZONE}`
        : copy.statusMissing,
      detail: missingDetail(notifications),
      note: notifications.configured
        ? notifications.value.NOTIFICATION_DELIVERY === "off"
          ? copy.noteNotificationsOff
          : notifications.value.NOTIFICATION_DELIVERY === "test"
            ? copy.noteNotificationsTest
            : null
        : null,
      warn:
        notifications.configured &&
        notifications.value.NOTIFICATION_DELIVERY === "test",
    },
    {
      key: "cron",
      label: copy.featureCron,
      configured: cron.configured,
      statusLabel: cron.configured ? copy.statusConfigured : copy.statusMissing,
      detail: missingDetail(cron),
      note: cron.configured ? null : copy.noteCron,
      warn: false,
    },
    {
      key: "zalo",
      label: copy.featureZalo,
      configured: zalo.configured && zaloConnected,
      statusLabel: !zalo.configured
        ? copy.statusMissing
        : zaloConnected
          ? copy.statusConfigured
          : copy.statusMissing,
      detail: missingDetail(zalo),
      note: zaloNote,
      warn: zaloWarn,
      action: zaloAction,
    },
  ];
  const zaloFlash =
    query.zalo === "connected"
      ? { tone: "ok" as const, text: copy.zaloConnected }
      : query.zalo === "error"
        ? {
            tone: "error" as const,
            text: `${copy.zaloErrorLead} ${copy.zaloErrors[query.reason ?? ""] ?? copy.zaloErrors.UNAVAILABLE}`,
          }
        : null;

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>
      {zaloFlash ? (
        <p
          className={
            zaloFlash.tone === "ok"
              ? "border-gold/40 bg-gold/10 text-charcoal/80 mt-6 max-w-3xl rounded-2xl border px-5 py-3 text-sm"
              : "border-lacquer/40 bg-lacquer/5 text-lacquer mt-6 max-w-3xl rounded-2xl border px-5 py-3 text-sm"
          }
        >
          {zaloFlash.text}
        </p>
      ) : null}

      <div className="border-burgundy/15 mt-8 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead>
            <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.featureColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.statusColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.noteColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-burgundy/8 border-b">
                <th
                  scope="row"
                  className="text-burgundy px-5 py-4 text-left font-semibold"
                >
                  {row.label}
                </th>
                <td className="px-5 py-4">
                  {row.warn ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                      {row.statusLabel}
                    </span>
                  ) : row.configured ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {row.statusLabel}
                    </span>
                  ) : (
                    <span className="text-charcoal/55 bg-charcoal/6 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                      {row.statusLabel}
                    </span>
                  )}
                </td>
                <td className="text-charcoal/65 px-5 py-4 leading-6">
                  {row.detail ? (
                    <span className="block font-mono text-xs">
                      {row.detail}
                    </span>
                  ) : null}
                  {row.note}
                  {row.action ? (
                    <a
                      href={row.action.href}
                      className="bg-lacquer text-ivory hover:bg-burgundy mt-3 inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold"
                    >
                      {row.action.label}
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="border-lacquer/25 bg-lacquer/5 mt-10 max-w-3xl rounded-2xl border p-6">
        <h2 className="text-burgundy font-serif text-2xl">
          {copy.plannedTitle}
        </h2>
        <p className="text-charcoal/70 mt-3 text-sm leading-6">
          {copy.plannedDescription}
        </p>
      </section>
    </div>
  );
}
