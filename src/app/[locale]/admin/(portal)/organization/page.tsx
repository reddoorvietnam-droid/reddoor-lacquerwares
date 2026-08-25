import { notFound } from "next/navigation";

import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";
import {
  operationalForms,
  organizationPositions,
} from "@/domains/organization/responsibilities";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).organization;

  const positionLabels = new Map(
    organizationPositions.map((position) => [
      position.key,
      position.labels[locale],
    ]),
  );

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>

      <section className="border-lacquer/25 bg-lacquer/5 mt-8 max-w-3xl rounded-2xl border p-6">
        <h2 className="text-burgundy font-serif text-2xl">
          {copy.visibilityTitle}
        </h2>
        <p className="text-charcoal/70 mt-3 text-sm leading-6">
          {copy.visibilityDescription}
        </p>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {organizationPositions.map((position) => (
          <section
            key={position.key}
            className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]"
          >
            <h2 className="text-burgundy font-serif text-2xl">
              {position.labels[locale]}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {position.roleKeys.map((roleKey) => (
                <li
                  key={roleKey}
                  className="border-gold/40 bg-gold/10 text-charcoal/75 rounded-full border px-3 py-1 text-xs font-semibold"
                >
                  {getRoleDefinitionSeed(roleKey)?.labels[locale] ?? roleKey}
                </li>
              ))}
            </ul>

            <h3 className="text-charcoal/50 mt-6 text-xs font-semibold tracking-[0.12em] uppercase">
              {copy.responsibilitiesColumn}
            </h3>
            <ul className="text-charcoal/65 mt-3 space-y-1.5 text-sm leading-6">
              {position.responsibilities[locale].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="text-gold-ink">
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-charcoal/50 mt-6 text-xs font-semibold tracking-[0.12em] uppercase">
              {copy.dataColumn}
            </h3>
            <ul className="text-charcoal/65 mt-3 space-y-1.5 text-sm leading-6">
              {position.ownedData[locale].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="text-gold-ink">
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <h2 className="text-burgundy mt-14 font-serif text-3xl">
        {copy.formsTitle}
      </h2>
      <p className="text-charcoal/65 mt-3 max-w-3xl text-base leading-7">
        {copy.formsDescription}
      </p>

      <div className="border-burgundy/15 mt-6 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <caption className="sr-only">{copy.formsTitle}</caption>
          <thead>
            <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.formColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.ownerColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.statusColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {operationalForms.map((form) => (
              <tr key={form.key} className="border-burgundy/8 border-b">
                <th
                  scope="row"
                  className="text-burgundy px-5 py-4 text-left font-semibold"
                >
                  {form.labels[locale]}
                  <span className="text-charcoal/40 mt-1 block font-mono text-xs font-normal">
                    {form.permission}
                  </span>
                </th>
                <td className="text-charcoal/70 px-5 py-4">
                  {positionLabels.get(form.ownerPositionKey) ??
                    form.ownerPositionKey}
                </td>
                <td className="px-5 py-4">
                  {form.status === "available" ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {copy.statusAvailable}
                    </span>
                  ) : (
                    <span className="text-charcoal/55 bg-charcoal/6 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                      {copy.statusPlanned}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
