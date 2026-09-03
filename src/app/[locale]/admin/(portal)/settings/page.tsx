import { notFound } from "next/navigation";

import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import {
  inspectAuthEnv,
  inspectCloudinaryEnv,
  inspectEmailEnv,
  inspectMongoEnv,
  isDevOpenAccessEnabled,
} from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

type FeatureRow = {
  key: string;
  label: string;
  configured: boolean;
  statusLabel: string;
  detail: string | null;
  note: string | null;
  warn: boolean;
};

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).settings;

  try {
    await requirePermission("settings.read");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const mongo = inspectMongoEnv();
  const auth = inspectAuthEnv();
  const cloudinary = inspectCloudinaryEnv();
  const email = inspectEmailEnv();
  const googleConfigured =
    auth.configured && Boolean(auth.value.AUTH_GOOGLE_ID);
  const devLoginEnabled =
    auth.configured && Boolean(auth.value.DEV_LOGIN_PASSWORD);
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
      key: "devLogin",
      label: copy.featureDevLogin,
      configured: devLoginEnabled,
      statusLabel: devLoginEnabled ? copy.statusEnabled : copy.statusDisabled,
      detail: null,
      note: devLoginEnabled ? copy.noteDevLogin : null,
      warn: devLoginEnabled,
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
  ];

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>

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
