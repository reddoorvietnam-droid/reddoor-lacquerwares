import { notFound } from "next/navigation";

import {
  orderProgressStages,
  orderStageDefinitions,
  stageDefinition,
} from "@/domains/orders/workflow";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";
import { isLocale } from "@/lib/i18n/config";
import { getAdminDictionary, resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: requestedLocale } = await params;
  if (!isLocale(requestedLocale)) notFound();

  const locale = resolveAdminLocale(requestedLocale);
  const copy = getAdminDictionary(locale).operations;

  // The process definition is static configuration, not persisted business
  // data, so this page reads no DAL and needs no per-record authorization.
  const stages = orderProgressStages.map((stage) => {
    const definition = stageDefinition(stage);
    const role = getRoleDefinitionSeed(definition.ownerRole);

    return {
      stage,
      step: definition.step,
      label: definition.labels[locale],
      owner: role?.labels[locale] ?? definition.ownerRole,
      permission: definition.advancePermission,
      approval: definition.approvalSubject,
    };
  });

  return (
    <div>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {copy.description}
      </p>

      <p className="border-gold/40 bg-gold/10 text-charcoal/75 mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm leading-6">
        {copy.notImplemented}
      </p>

      <div className="border-burgundy/15 mt-10 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead>
            <tr className="border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase">
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.stepColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.stageColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.ownerColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.permissionColumn}
              </th>
              <th scope="col" className="px-5 py-4 font-semibold">
                {copy.approvalColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((row) => (
              <tr key={row.stage} className="border-burgundy/8 border-b">
                <td className="text-gold-ink px-5 py-4 font-mono text-xs">
                  {row.step === null ? "—" : String(row.step).padStart(2, "0")}
                </td>
                <th
                  scope="row"
                  className="text-burgundy px-5 py-4 text-left font-semibold"
                >
                  {row.label}
                </th>
                <td className="text-charcoal/70 px-5 py-4">{row.owner}</td>
                <td className="text-charcoal/60 px-5 py-4 font-mono text-xs">
                  {row.permission}
                </td>
                <td className="px-5 py-4">
                  {row.approval ? (
                    <span className="bg-lacquer/10 text-lacquer inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                      {copy.approvalRequired}
                    </span>
                  ) : (
                    <span className="text-charcoal/45 text-xs">
                      {copy.approvalNone}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="border-burgundy/15 rounded-2xl border bg-white p-6">
          <h2 className="text-burgundy font-serif text-2xl">{copy.branches}</h2>
          <p className="text-charcoal/60 mt-3 text-sm leading-6">
            {copy.branchesDescription}
          </p>
          <dl className="text-charcoal/70 mt-5 space-y-3 font-mono text-xs">
            <div>
              <dt className="text-charcoal/45">
                {orderStageDefinitions.inventoryCheck.labels[locale]}
              </dt>
              <dd>
                inventoryCheck → materialProcurement → inventoryCheck →
                materialIssued
              </dd>
            </div>
            <div>
              <dt className="text-charcoal/45">
                {orderStageDefinitions.qualityControl.labels[locale]}
              </dt>
              <dd>qualityControl → inProduction → qualityControl → packing</dd>
            </div>
          </dl>
        </section>
        <section className="border-burgundy/15 rounded-2xl border bg-white p-6">
          <h2 className="text-burgundy font-serif text-2xl">{copy.guards}</h2>
          <ul className="text-charcoal/60 mt-4 space-y-2 text-sm leading-6">
            {copy.guardList.map((guard) => (
              <li key={guard} className="flex gap-3">
                <span aria-hidden="true" className="text-gold-ink">
                  —
                </span>
                <span>{guard}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
