import Link from "next/link";
import { notFound } from "next/navigation";

import { mongoUserDirectory } from "@/domains/identity/user-directory";
import {
  sheetCheckReadPermissions,
  sheetCheckStatuses,
  sheetCheckTemplates,
  type SheetCheckStatus,
  type SheetCheckTemplate,
} from "@/domains/sheet-checks/contracts";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { sheetCheckService } from "@/domains/sheet-checks/runtime";
import { formatBusinessDay } from "@/domains/tasks/policy";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getNotificationEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import {
  buttonClass,
  cardClass,
  CheckBanner,
  checkCopy,
  checksHref,
  StatusBadge,
  tableWrapClass,
  tdClass,
  templateAllowed,
  thClass,
  theadClass,
} from "./shared";

export const dynamic = "force-dynamic";

function templateFilter(value: string | undefined): SheetCheckTemplate | null {
  return value && (sheetCheckTemplates as readonly string[]).includes(value)
    ? (value as SheetCheckTemplate)
    : null;
}

function statusFilter(value: string | undefined): SheetCheckStatus | null {
  return value && (sheetCheckStatuses as readonly string[]).includes(value)
    ? (value as SheetCheckStatus)
    : null;
}

function pageNumber(value: string | undefined): number {
  return value && /^\d{1,4}$/.test(value) ? Math.max(1, Number(value)) : 1;
}

export default async function SheetChecksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    template?: string;
    status?: string;
    page?: string;
    error?: string;
    notice?: string;
  }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = checkCopy[locale];

  let context;
  try {
    ({ context } = await requireListAccess("documents.read"));
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  // The reader's coverage for every permission a check may stamp: the
  // service drops checks whose stamped permissions this coverage does not
  // reach, so a money check never appears to someone who cannot open it.
  const coverages = await resolvePermissionCoverages([
    ...sheetCheckReadPermissions,
    "documents.import",
  ] as const);
  const importCoverage = coverages["documents.import"];
  const canUpload =
    (importCoverage.global || importCoverage.businessUnitIds.length > 0) &&
    sheetCheckTemplates.some((template) =>
      templateAllowed(template, coverages),
    );

  const template = templateFilter(query.template);
  const status = statusFilter(query.status);
  const page = pageNumber(query.page);
  const pageSize = sheetCheckLimits.listPageSize;

  const checks = await sheetCheckService.listForReader(context, coverages, {
    ...(template ? { template } : {}),
    ...(status ? { status } : {}),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const creators = await mongoUserDirectory.findActiveUsers([
    ...new Set(checks.map((check) => check.createdByUserId)),
  ]);
  const timeZone = getNotificationEnv().BUSINESS_TIMEZONE;

  const filterQuery = (overrides: {
    template?: SheetCheckTemplate | null;
    status?: SheetCheckStatus | null;
    page?: number;
  }) => {
    const search = new URLSearchParams();
    const nextTemplate =
      overrides.template === undefined ? template : overrides.template;
    const nextStatus =
      overrides.status === undefined ? status : overrides.status;
    if (nextTemplate) search.set("template", nextTemplate);
    if (nextStatus) search.set("status", nextStatus);
    if (overrides.page && overrides.page > 1) {
      search.set("page", String(overrides.page));
    }
    return search.toString();
  };
  const chipClass = (active: boolean) =>
    active
      ? "bg-burgundy text-ivory rounded-full px-4 py-2 text-sm font-semibold"
      : "text-burgundy border-burgundy/20 hover:bg-ivory/70 rounded-full border px-4 py-2 text-sm font-semibold";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em] md:text-6xl">
            {text.listTitle}
          </h1>
          <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
            {text.listDescription}
          </p>
        </div>
        {canUpload ? (
          <Link href={checksHref(locale, "/new")} className={buttonClass}>
            {text.newButton}
          </Link>
        ) : null}
      </div>

      <CheckBanner locale={locale} error={query.error} notice={query.notice} />

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.explainerTitle}
          </h2>
          <ul className="text-charcoal/70 mt-3 list-disc pl-5 text-sm leading-6">
            {text.explainerDoes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className={`${cardClass} border-dashed`}>
          <ul className="text-charcoal/70 list-disc pl-5 text-sm leading-6">
            {text.explainerDoesNot.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>

      <nav
        className="mt-8 flex flex-wrap items-center gap-2"
        aria-label={text.filterTemplate}
      >
        <span className="text-charcoal/50 mr-1 text-xs tracking-[0.12em] uppercase">
          {text.filterTemplate}
        </span>
        <Link
          href={checksHref(locale, "", filterQuery({ template: null }))}
          className={chipClass(template === null)}
        >
          {text.filterAll}
        </Link>
        {sheetCheckTemplates.map((entry) => (
          <Link
            key={entry}
            href={checksHref(locale, "", filterQuery({ template: entry }))}
            className={chipClass(template === entry)}
          >
            {text.template[entry]}
          </Link>
        ))}
      </nav>
      <nav
        className="mt-3 flex flex-wrap items-center gap-2"
        aria-label={text.filterStatus}
      >
        <span className="text-charcoal/50 mr-1 text-xs tracking-[0.12em] uppercase">
          {text.filterStatus}
        </span>
        <Link
          href={checksHref(locale, "", filterQuery({ status: null }))}
          className={chipClass(status === null)}
        >
          {text.filterAll}
        </Link>
        {sheetCheckStatuses.map((entry) => (
          <Link
            key={entry}
            href={checksHref(locale, "", filterQuery({ status: entry }))}
            className={chipClass(status === entry)}
          >
            {text.status[entry]}
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        {checks.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.emptyList}
          </p>
        ) : (
          <div className={tableWrapClass}>
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.listTitle}</caption>
              <thead>
                <tr className={theadClass}>
                  <th scope="col" className={thClass}>
                    {text.fileColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.templateColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.statusColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.createdColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.rowsColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.findingsColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.creatorColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">{text.openLink}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check) => {
                  const summary = check.result?.summary ?? null;
                  return (
                    <tr key={check.id} className="border-burgundy/8 border-b">
                      <th
                        scope="row"
                        className={`${tdClass} text-left font-semibold`}
                      >
                        <Link
                          href={checksHref(locale, `/${check.id}`)}
                          className="text-burgundy hover:underline"
                        >
                          {check.fileName}
                        </Link>
                        <span className="text-charcoal/45 block font-mono text-xs font-normal">
                          {check.fileFormat} · {check.sheetName}
                        </span>
                      </th>
                      <td className={tdClass}>
                        {text.template[check.template]}
                      </td>
                      <td className={tdClass}>
                        <StatusBadge status={check.status} locale={locale} />
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {formatBusinessDay(check.createdAt, timeZone)}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {check.dataRowCount}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {summary ? (
                          <>
                            <span
                              className={
                                summary.errors > 0
                                  ? "text-lacquer font-semibold"
                                  : "text-charcoal/60"
                              }
                            >
                              {summary.errors}
                            </span>
                            {" / "}
                            <span
                              className={
                                summary.warnings > 0
                                  ? "text-gold-ink font-semibold"
                                  : "text-charcoal/60"
                              }
                            >
                              {summary.warnings}
                            </span>
                          </>
                        ) : (
                          <span className="text-charcoal/35">—</span>
                        )}
                      </td>
                      <td className={`${tdClass} text-charcoal/70`}>
                        {creators.get(check.createdByUserId)?.displayName ??
                          "…"}
                      </td>
                      <td className={tdClass}>
                        <Link
                          href={checksHref(locale, `/${check.id}`)}
                          className="text-burgundy text-xs font-semibold hover:underline"
                        >
                          {text.openLink} →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {page > 1 || checks.length === pageSize ? (
        <nav
          className="mt-4 flex items-center gap-4 text-sm"
          aria-label={text.page}
        >
          {page > 1 ? (
            <Link
              href={checksHref(locale, "", filterQuery({ page: page - 1 }))}
              className="text-burgundy font-semibold hover:underline"
            >
              {text.previous}
            </Link>
          ) : null}
          <span className="text-charcoal/50 font-mono text-xs">
            {text.page} {page}
          </span>
          {checks.length === pageSize ? (
            <Link
              href={checksHref(locale, "", filterQuery({ page: page + 1 }))}
              className="text-burgundy font-semibold hover:underline"
            >
              {text.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
