import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  discardSheetCheckAction,
  rerunSheetCheckAction,
  runSheetCheckAction,
} from "@/app/[locale]/admin/(portal)/checks/actions";
import {
  canonicalFields,
  columnLabel,
  SheetCheckError,
  type ColumnMapping,
  type ColumnProposal,
  type SheetCheckDto,
  type SheetRowDto,
} from "@/domains/sheet-checks/contracts";
import { renderIssue, worstSeverity } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { sheetCheckService } from "@/domains/sheet-checks/runtime";
import { formatBusinessDay } from "@/domains/tasks/policy";
import {
  ContentAccessDeniedError,
  coverageReaches,
  requirePermission,
  resolvePermissionCoverages,
  type AccessContext,
} from "@/lib/auth";
import { getNotificationEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale, type AdminLocale } from "@/lib/i18n/admin";
import { supportedCurrencies } from "@/lib/money";

import {
  BackLink,
  buttonClass,
  cardClass,
  cellText,
  CheckBanner,
  checkCopy,
  checksHref,
  columnHeader,
  dangerButtonClass,
  fieldClass,
  fieldLabel,
  formatAmount,
  formatBusinessMoment,
  formatBytes,
  formatMoneyValue,
  ghostButtonClass,
  issueCodesFromQuery,
  IssueList,
  keyColumns,
  labelClass,
  OutcomeBadge,
  SeverityBadge,
  StatusBadge,
  SystemViewBlock,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
  type CheckCopy,
} from "../shared";

export const dynamic = "force-dynamic";

function merge(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

function pageNumber(value: string | undefined): number {
  return value && /^\d{1,4}$/.test(value) ? Math.max(1, Number(value)) : 1;
}

export default async function SheetCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; checkId: string }>;
  searchParams: Promise<{
    error?: string;
    issues?: string;
    notice?: string;
    page?: string;
    filter?: string;
  }>;
}) {
  const [{ locale: requestedLocale, checkId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = checkCopy[locale];

  if (!/^[a-f0-9]{24}$/.test(checkId)) notFound();
  const view = await sheetCheckService.findForAuthorization(checkId);
  if (!view) notFound();

  // The read rule: documents.read on the check target AND every permission
  // the run exercised, each judged against the same target. Any denial is
  // a 404 — there is no partial view of a check.
  let context: AccessContext;
  let check: SheetCheckDto;
  try {
    context = await requirePermission("documents.read", {
      resourceId: view.id,
      ownerUserId: view.createdByUserId,
      businessUnitIds: view.businessUnitIds,
    });
    for (const permission of view.requiredPermissions) {
      context = merge(
        context,
        await requirePermission(permission, {
          resourceId: view.id,
          businessUnitIds: view.businessUnitIds,
        }),
      );
    }
    check = await sheetCheckService.get(context, checkId);
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    if (cause instanceof SheetCheckError && cause.code === "NOT_FOUND") {
      notFound();
    }
    throw cause;
  }

  const coverages = await resolvePermissionCoverages([
    "documents.import",
    "documents.export",
    "orders.readSellingPrice",
    "tasks.create",
    "assistant.use",
  ] as const);
  const userId = context.userId;
  const isCreator = check.createdByUserId === userId;
  const anyCoverage = (coverage: {
    global: boolean;
    businessUnitIds: readonly string[];
  }) => coverage.global || coverage.businessUnitIds.length > 0;
  // Affordances only: every action re-authorizes on the server.
  const canImport =
    coverageReaches(coverages["documents.import"], check.businessUnitIds) ||
    isCreator;
  const canDiscard = isCreator || coverages["documents.import"].global;
  const canExport =
    coverageReaches(coverages["documents.export"], check.businessUnitIds) ||
    (isCreator && anyCoverage(coverages["documents.export"]));
  const canProposeFollowUps =
    anyCoverage(coverages["tasks.create"]) &&
    anyCoverage(coverages["assistant.use"]);
  const sellingPriceOffered =
    check.template === "generic" && coverages["orders.readSellingPrice"].global;

  const timeZone = getNotificationEnv().BUSINESS_TIMEZONE;

  // The rows table is paged and, by default, narrowed to rows with at least
  // a warning; the full grid is one click away.
  const page = pageNumber(query.page);
  const filter = query.filter === "all" ? "all" : "issues";
  const rowsPage =
    check.status === "checked"
      ? await sheetCheckService.listRows(context, check.id, {
          offset: (page - 1) * sheetCheckLimits.rowsPageSize,
          limit: sheetCheckLimits.rowsPageSize,
          ...(filter === "issues" ? { minSeverity: "warn" as const } : {}),
        })
      : null;

  return (
    <div>
      <BackLink locale={locale} />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="text-burgundy mt-3 font-serif text-4xl tracking-[-0.045em] break-words md:text-5xl">
            {check.fileName}
          </h1>
          <p className="text-charcoal/60 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span>{text.template[check.template]}</span>
            <StatusBadge status={check.status} locale={locale} />
            <span className="font-mono text-xs">
              {check.fileFormat} · {formatBytes(check.fileBytes)} ·{" "}
              {check.sheetName}
            </span>
            {check.rerunOf ? (
              <Link
                href={checksHref(locale, `/${check.rerunOf}`)}
                className="text-burgundy text-xs hover:underline"
              >
                {text.rerunOf} {check.rerunOf.slice(-6)} →
              </Link>
            ) : null}
          </p>
        </div>
      </div>

      <CheckBanner
        locale={locale}
        error={query.error}
        notice={query.notice}
        issueCodes={issueCodesFromQuery(query.issues)}
      />

      {check.status === "mapping" || rowsPage === null ? (
        <MappingView
          check={check}
          locale={locale}
          text={text}
          timeZone={timeZone}
          canDiscard={canDiscard}
          sellingPriceOffered={sellingPriceOffered}
        />
      ) : (
        <ResultView
          check={check}
          rows={rowsPage}
          page={page}
          filter={filter}
          locale={locale}
          text={text}
          timeZone={timeZone}
          canExport={canExport}
          canRerun={canImport}
          canProposeFollowUps={canProposeFollowUps}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mapping                                                             */
/* ------------------------------------------------------------------ */

function MappingView({
  check,
  locale,
  text,
  timeZone,
  canDiscard,
  sellingPriceOffered,
}: {
  check: SheetCheckDto;
  locale: AdminLocale;
  text: CheckCopy;
  timeZone: string;
  canDiscard: boolean;
  sellingPriceOffered: boolean;
}) {
  const proposalByIndex = new Map<number, ColumnProposal>(
    check.proposal.columns.map((column) => [column.columnIndex, column]),
  );
  const mappingByIndex = new Map<number, ColumnMapping>(
    check.mapping.columns.map((column) => [column.columnIndex, column]),
  );
  const columns = Array.from({ length: check.columnCount }, (_, index) => ({
    index,
    proposal: proposalByIndex.get(index) ?? null,
    mapping: mappingByIndex.get(index) ?? null,
  }));
  const period = check.mapping.period ?? check.proposal.periodHint;
  const selectClass = `${fieldClass} min-w-36`;

  return (
    <>
      <section className={`${cardClass} mt-8`}>
        <h2 className="text-burgundy font-serif text-2xl">
          {text.mappingTitle}
        </h2>
        <p className="text-charcoal/60 mt-2 text-sm">
          {text.mappingDescription}
        </p>
        <dl className="text-charcoal/70 mt-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-charcoal/50 inline">{text.sheetsInfo}: </dt>
            <dd className="inline">
              {check.sheets.map((sheet, position) => (
                <span key={sheet.index}>
                  {position > 0 ? ", " : ""}
                  <span
                    className={
                      sheet.index === check.sheetIndex
                        ? "text-burgundy font-semibold"
                        : ""
                    }
                  >
                    {sheet.name}
                  </span>
                  <span className="text-charcoal/45 font-mono text-xs">
                    {" "}
                    ({sheet.rowCount} {text.sheetRows})
                  </span>
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-charcoal/50 inline">{text.headerRowInfo}: </dt>
            <dd className="inline">
              {check.proposal.headerFound && check.proposal.headerSheetRowNumber
                ? `#${check.proposal.headerSheetRowNumber}`
                : text.headerNotFound}
            </dd>
          </div>
          <div>
            <dt className="text-charcoal/50 inline">{text.rowsInfo}: </dt>
            <dd className="inline font-mono">{check.dataRowCount}</dd>
          </div>
          <div>
            <dt className="text-charcoal/50 inline">{text.draftExpires}: </dt>
            <dd className="inline font-mono">
              {formatBusinessDay(check.expiresAt, timeZone)}
            </dd>
          </div>
          {check.proposal.titleLines.length > 0 ? (
            <div className="sm:col-span-2">
              <dt className="text-charcoal/50 inline">
                {text.titleLinesInfo}:{" "}
              </dt>
              <dd className="inline italic">
                {check.proposal.titleLines.join(" / ")}
              </dd>
            </div>
          ) : null}
        </dl>
        {check.intakeIssues.length > 0 ? (
          <div className="border-burgundy/10 mt-4 border-t pt-4">
            <p className="text-charcoal/60 mb-2 text-xs font-semibold tracking-[0.12em] uppercase">
              {text.intakeIssuesTitle}
            </p>
            <IssueList
              issues={check.intakeIssues}
              locale={locale}
              check={check}
            />
          </div>
        ) : null}
      </section>

      <form action={runSheetCheckAction} className="mt-6 grid gap-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="checkId" value={check.id} />
        <input type="hidden" name="expectedRevision" value={check.revision} />

        <div className={tableWrapClass}>
          <table className="w-full min-w-[72rem] border-collapse text-left text-sm">
            <caption className="sr-only">{text.mappingTitle}</caption>
            <thead>
              <tr className={theadClass}>
                <th scope="col" className={thClass}>
                  {text.columnHeading}
                </th>
                <th scope="col" className={thClass}>
                  {text.headerHeading}
                </th>
                <th scope="col" className={thClass}>
                  {text.samplesHeading}
                </th>
                <th scope="col" className={thClass}>
                  {text.fieldHeading}
                </th>
                <th scope="col" className={thClass}>
                  {text.multiplierLabel}
                </th>
                <th scope="col" className={thClass}>
                  {text.styleLabel}
                </th>
                <th scope="col" className={thClass}>
                  {text.currencyLabel}
                </th>
                <th scope="col" className={thClass}>
                  {text.dateOrderLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {columns.map(({ index, proposal, mapping }) => {
                const field = mapping?.field ?? proposal?.field ?? "ignore";
                const multiplier =
                  mapping && mapping.unitMultiplier !== "1"
                    ? mapping.unitMultiplier
                    : (proposal?.suggestedMultiplier ?? "1");
                return (
                  <tr key={index} className="border-burgundy/8 border-b">
                    <th
                      scope="row"
                      className={`${tdClass} text-left font-mono text-xs`}
                    >
                      {columnLabel(index)}
                    </th>
                    <td className={`${tdClass} max-w-[14rem]`}>
                      {proposal?.header ? (
                        <span className="font-semibold break-words">
                          {proposal.header}
                        </span>
                      ) : (
                        <span className="text-charcoal/45">
                          {text.noHeader}
                        </span>
                      )}
                      {proposal ? (
                        <span className="text-charcoal/45 block text-xs">
                          {text.confidence[proposal.confidence]}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`${tdClass} text-charcoal/70 max-w-[16rem] font-mono text-xs break-words`}
                    >
                      {proposal && proposal.sampleValues.length > 0
                        ? proposal.sampleValues.join(" · ")
                        : text.noSamples}
                    </td>
                    <td className={tdClass}>
                      <label className="sr-only" htmlFor={`field-${index}`}>
                        {text.fieldHeading} {columnLabel(index)}
                      </label>
                      <select
                        id={`field-${index}`}
                        name={`field.${index}`}
                        defaultValue={field}
                        className={selectClass}
                      >
                        {canonicalFields.map((candidate) => (
                          <option key={candidate} value={candidate}>
                            {fieldLabel(candidate, locale)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <label
                        className="sr-only"
                        htmlFor={`multiplier-${index}`}
                      >
                        {text.multiplierLabel} {columnLabel(index)}
                      </label>
                      <select
                        id={`multiplier-${index}`}
                        name={`multiplier.${index}`}
                        defaultValue={multiplier}
                        className={selectClass}
                      >
                        <option value="1">{text.multiplier["1"]}</option>
                        <option value="1000">{text.multiplier["1000"]}</option>
                        <option value="1000000">
                          {text.multiplier["1000000"]}
                        </option>
                      </select>
                      {proposal && proposal.suggestedMultiplier !== "1" ? (
                        <span className="text-gold-ink block text-xs">
                          {text.suggestedMultiplier}
                        </span>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      <label className="sr-only" htmlFor={`style-${index}`}>
                        {text.styleLabel} {columnLabel(index)}
                      </label>
                      <select
                        id={`style-${index}`}
                        name={`style.${index}`}
                        defaultValue={mapping?.numberStyle ?? ""}
                        className={selectClass}
                      >
                        <option value="">{text.styleAuto}</option>
                        <option value="vi">{text.styleVi}</option>
                        <option value="en">{text.styleEn}</option>
                      </select>
                      {proposal?.inferredStyle ? (
                        <span
                          className={
                            proposal.inferredStyle === "mixed"
                              ? "text-lacquer block text-xs"
                              : "text-charcoal/45 block text-xs"
                          }
                        >
                          {text.styleInferred[proposal.inferredStyle]}
                        </span>
                      ) : null}
                    </td>
                    <td className={tdClass}>
                      <label className="sr-only" htmlFor={`currency-${index}`}>
                        {text.currencyLabel} {columnLabel(index)}
                      </label>
                      <select
                        id={`currency-${index}`}
                        name={`currency.${index}`}
                        defaultValue={mapping?.fixedCurrency ?? ""}
                        className={selectClass}
                      >
                        <option value="">{text.currencyAuto}</option>
                        {supportedCurrencies.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <label className="sr-only" htmlFor={`dateOrder-${index}`}>
                        {text.dateOrderLabel} {columnLabel(index)}
                      </label>
                      <select
                        id={`dateOrder-${index}`}
                        name={`dateOrder.${index}`}
                        defaultValue={mapping?.dateOrder ?? ""}
                        className={selectClass}
                      >
                        <option value="">{text.dateOrderAuto}</option>
                        <option value="dmy">{text.dateOrderDmy}</option>
                        <option value="mdy">{text.dateOrderMdy}</option>
                      </select>
                      {proposal?.inferredDateOrder ? (
                        <span
                          className={
                            proposal.inferredDateOrder === "conflict"
                              ? "text-lacquer block text-xs"
                              : "text-charcoal/45 block text-xs"
                          }
                        >
                          {text.dateInferred[proposal.inferredDateOrder]}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className={cardClass}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.defaultsTitle}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="defaultCurrency" className={labelClass}>
                {text.defaultCurrencyLabel}
              </label>
              <select
                id="defaultCurrency"
                name="defaultCurrency"
                defaultValue={check.mapping.defaultCurrency}
                className={fieldClass}
              >
                {supportedCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="periodFrom" className={labelClass}>
                {text.periodFromLabel}
              </label>
              <input
                id="periodFrom"
                name="periodFrom"
                type="date"
                defaultValue={period?.from ?? ""}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="periodTo" className={labelClass}>
                {text.periodToLabel}
              </label>
              <input
                id="periodTo"
                name="periodTo"
                type="date"
                defaultValue={period?.to ?? ""}
                className={fieldClass}
              />
            </div>
          </div>
          <p className="text-charcoal/50 mt-2 text-xs">{text.periodHint}</p>
          {sellingPriceOffered ? (
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="compareSellingPrice"
                value="on"
                defaultChecked={check.mapping.compareSellingPrice}
                className="mt-1"
              />
              <span>{text.compareSellingPriceLabel}</span>
            </label>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass}>
            {text.run}
          </button>
          <span className="text-charcoal/50 text-xs">{text.noWrites}</span>
        </div>
      </form>

      {canDiscard ? (
        <form
          action={discardSheetCheckAction}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="checkId" value={check.id} />
          <input type="hidden" name="expectedRevision" value={check.revision} />
          <button type="submit" className={dangerButtonClass}>
            {text.discard}
          </button>
          <span className="text-charcoal/50 text-xs">{text.discardHint}</span>
        </form>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

function ResultView({
  check,
  rows,
  page,
  filter,
  locale,
  text,
  timeZone,
  canExport,
  canRerun,
  canProposeFollowUps,
}: {
  check: SheetCheckDto;
  rows: { rows: SheetRowDto[]; issueRowCount: number };
  page: number;
  filter: "issues" | "all";
  locale: AdminLocale;
  text: CheckCopy;
  timeZone: string;
  canExport: boolean;
  canRerun: boolean;
  canProposeFollowUps: boolean;
}) {
  const result = check.result;
  if (!result) {
    // A checked record always carries its result; a missing one is a
    // storage inconsistency the reader should not silently browse.
    notFound();
  }
  const summary = result.summary;
  const keys = keyColumns(check);
  const pageSize = sheetCheckLimits.rowsPageSize;
  const total = filter === "issues" ? rows.issueRowCount : check.rowCount;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rowsQuery = (nextFilter: "issues" | "all", nextPage: number) => {
    const search = new URLSearchParams();
    if (nextFilter === "all") search.set("filter", "all");
    if (nextPage > 1) search.set("page", String(nextPage));
    return search.toString();
  };
  const chipClass = (active: boolean) =>
    active
      ? "bg-burgundy text-ivory rounded-full px-4 py-2 text-sm font-semibold"
      : "text-burgundy border-burgundy/20 hover:bg-ivory/70 rounded-full border px-4 py-2 text-sm font-semibold";
  const followUpHref =
    `/${locale}/admin/assistant?q=${encodeURIComponent(`${text.followUpPrompt} ${check.id}`)}` as Route;
  const systemTotalsShown = result.summary.totals.some(
    (line) => line.system !== null,
  );

  const cards: { label: string; value: number; tone: string }[] = [
    { label: text.dataRows, value: summary.dataRows, tone: "text-charcoal" },
    {
      label: text.skippedRows,
      value: summary.skippedRows,
      tone: "text-charcoal/60",
    },
    {
      label: text.outcome.matched,
      value: summary.outcomes.matched,
      tone: "text-emerald-700",
    },
    {
      label: text.outcome.mismatch,
      value: summary.outcomes.mismatch,
      tone: "text-lacquer",
    },
    {
      label: text.outcome.notFound,
      value: summary.outcomes.notFound,
      tone: "text-lacquer",
    },
    {
      label: text.outcome.notCompared,
      value: summary.outcomes.notCompared,
      tone: "text-charcoal/60",
    },
    {
      label: text.outcome.invalid,
      value: summary.outcomes.invalid,
      tone: "text-gold-ink",
    },
    { label: text.errorsCard, value: summary.errors, tone: "text-lacquer" },
    {
      label: text.warningsCard,
      value: summary.warnings,
      tone: "text-gold-ink",
    },
    { label: text.infosCard, value: summary.infos, tone: "text-charcoal/60" },
  ];

  return (
    <>
      <div className="text-charcoal/60 mt-6 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {check.checkedAt ? (
          <span>
            {text.checkedAt}{" "}
            <span className="font-mono">
              {formatBusinessMoment(check.checkedAt, timeZone)}
            </span>
          </span>
        ) : null}
        <span>
          {text.dataAt}{" "}
          <span className="font-mono">
            {formatBusinessMoment(result.dataAt, timeZone)}
          </span>
        </span>
        <span>
          {text.resultExpires}{" "}
          <span className="font-mono">
            {formatBusinessDay(check.expiresAt, timeZone)}
          </span>
        </span>
        <span>
          {text.requiredPermissions}{" "}
          <span className="font-mono text-xs">
            {check.requiredPermissions.join(", ")}
          </span>
        </span>
      </div>
      <p className="text-charcoal/55 mt-2 text-xs">
        {text.notBankReconciliation} {text.noWrites}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canExport ? (
          <a
            href={`/api/sheet-checks/${check.id}/export?locale=${locale}`}
            className={ghostButtonClass}
          >
            {text.exportCsv}
          </a>
        ) : null}
        {canRerun ? (
          <form
            action={rerunSheetCheckAction}
            className="flex items-center gap-3"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="checkId" value={check.id} />
            <button type="submit" className={ghostButtonClass}>
              {text.rerun}
            </button>
          </form>
        ) : null}
        {canProposeFollowUps ? (
          <Link href={followUpHref} className={ghostButtonClass}>
            {text.proposeFollowUps}
          </Link>
        ) : null}
      </div>
      {canRerun ? (
        <p className="text-charcoal/50 mt-2 max-w-3xl text-xs">
          {text.rerunHint}
        </p>
      ) : null}

      {/* Summary */}
      <section className="mt-8">
        <h2 className="text-burgundy font-serif text-3xl">
          {text.summaryTitle}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <div key={card.label} className={`${cardClass} p-4`}>
              <p className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
                {card.label}
              </p>
              <p
                className={`${card.tone} mt-1 font-mono text-2xl font-semibold`}
              >
                {card.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Totals */}
      <section className="mt-10">
        <h2 className="text-burgundy font-serif text-3xl">
          {text.totalsTitle}
        </h2>
        <p className="text-charcoal/55 mt-2 max-w-3xl text-sm">
          {text.totalsNote}
        </p>
        {summary.totals.length === 0 ? (
          <p className="text-charcoal/55 mt-4 text-sm">{text.totalsEmpty}</p>
        ) : (
          <div className={`${tableWrapClass} mt-4`}>
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.totalsTitle}</caption>
              <thead>
                <tr className={theadClass}>
                  <th scope="col" className={thClass}>
                    {text.totalsField}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.totalsColumn}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.totalsCurrency}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.totalsComputed}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.totalsSheet}
                  </th>
                  {systemTotalsShown ? (
                    <th scope="col" className={thClass}>
                      {text.totalsSystem}
                    </th>
                  ) : null}
                  <th scope="col" className={thClass}>
                    {text.totalsRows}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.totals.map((line) => {
                  const differs =
                    line.sheetTotal !== null &&
                    line.sheetTotal !== line.computed;
                  return (
                    <tr
                      key={`${line.field}-${line.columnIndex}-${line.currency}`}
                      className="border-burgundy/8 border-b"
                    >
                      <th
                        scope="row"
                        className={`${tdClass} text-left font-semibold`}
                      >
                        {fieldLabel(line.field, locale)}
                      </th>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {columnLabel(line.columnIndex)} ·{" "}
                        {columnHeader(check, line.columnIndex)}
                      </td>
                      <td className={`${tdClass} font-mono text-xs`}>
                        {line.currency}
                      </td>
                      <td
                        className={`${tdClass} font-mono text-xs font-semibold`}
                      >
                        {formatAmount(line.computed, line.currency, locale)}
                      </td>
                      <td
                        className={`${tdClass} font-mono text-xs ${differs ? "text-lacquer font-semibold" : ""}`}
                      >
                        {line.sheetTotal !== null
                          ? formatAmount(line.sheetTotal, line.currency, locale)
                          : "—"}
                      </td>
                      {systemTotalsShown ? (
                        <td className={`${tdClass} font-mono text-xs`}>
                          {line.system !== null
                            ? formatAmount(line.system, line.currency, locale)
                            : "—"}
                        </td>
                      ) : null}
                      <td className={`${tdClass} font-mono text-xs`}>
                        {line.rowsCounted} / {line.rowsSkipped}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sheet-level findings */}
      <section className={`${cardClass} mt-10`}>
        <h2 className="text-burgundy font-serif text-2xl">
          {text.sheetIssuesTitle}
        </h2>
        <div className="mt-3">
          <IssueList
            issues={[...check.intakeIssues, ...result.sheetIssues]}
            locale={locale}
            check={check}
            emptyText={text.sheetIssuesEmpty}
          />
        </div>
      </section>

      {/* System-only */}
      <section className={`${cardClass} mt-6`}>
        <h2 className="text-burgundy font-serif text-2xl">
          {text.systemOnlyTitle}
        </h2>
        {result.systemOnly.length === 0 ? (
          <p className="text-charcoal/55 mt-3 text-sm">
            {text.systemOnlyEmpty}
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm">
            {result.systemOnly.map((item, index) => (
              <li
                key={`${item.kind}-${item.label}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <span className="text-charcoal/50 text-xs tracking-[0.12em] uppercase">
                  {text.systemOnlyKind[item.kind]}
                </span>
                <span className="font-semibold">{item.label}</span>
                {item.day ? (
                  <span className="font-mono text-xs">{item.day}</span>
                ) : null}
                {item.amount ? (
                  <span className="font-mono text-xs">
                    {formatMoneyValue(item.amount, locale)}
                  </span>
                ) : null}
                <span className="text-charcoal/70 basis-full">
                  <SeverityBadge
                    severity={item.issue.severity}
                    locale={locale}
                  />{" "}
                  {renderIssue(item.issue, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Rows */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-burgundy font-serif text-3xl">
            {text.rowsTitle}
          </h2>
          <nav className="flex flex-wrap gap-2" aria-label={text.rowsTitle}>
            <Link
              href={checksHref(locale, `/${check.id}`, rowsQuery("issues", 1))}
              className={chipClass(filter === "issues")}
            >
              {text.rowsFilterIssues}
              {filter === "issues" ? ` (${rows.issueRowCount})` : ""}
            </Link>
            <Link
              href={checksHref(locale, `/${check.id}`, rowsQuery("all", 1))}
              className={chipClass(filter === "all")}
            >
              {text.rowsFilterAll} ({check.rowCount})
            </Link>
          </nav>
        </div>

        {rows.rows.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 mt-5 max-w-3xl rounded-2xl border border-dashed px-6 py-10 text-center text-sm">
            {text.rowsEmpty}
          </p>
        ) : (
          <div className={`${tableWrapClass} mt-5`}>
            <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
              <caption className="sr-only">{text.rowsTitle}</caption>
              <thead>
                <tr className={theadClass}>
                  <th scope="col" className={thClass}>
                    {text.rowNo}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.rowKind}
                  </th>
                  {keys.date !== null ? (
                    <th scope="col" className={thClass}>
                      {text.rowDate}
                    </th>
                  ) : null}
                  {keys.identity.length > 0 ? (
                    <th scope="col" className={thClass}>
                      {text.rowIdentity}
                    </th>
                  ) : null}
                  {keys.amount !== null ? (
                    <th scope="col" className={thClass}>
                      {text.rowAmount}
                    </th>
                  ) : null}
                  <th scope="col" className={thClass}>
                    {text.rowOutcome}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.rowSeverity}
                  </th>
                  <th scope="col" className={thClass}>
                    {text.rowDetails}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.rows.map((row) => (
                  <RowLine
                    key={row.index}
                    row={row}
                    check={check}
                    keys={keys}
                    locale={locale}
                    text={text}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 || page > 1 ? (
          <nav
            className="mt-4 flex items-center gap-4 text-sm"
            aria-label={text.page}
          >
            {page > 1 ? (
              <Link
                href={checksHref(
                  locale,
                  `/${check.id}`,
                  rowsQuery(filter, page - 1),
                )}
                className="text-burgundy font-semibold hover:underline"
              >
                {text.previous}
              </Link>
            ) : null}
            <span className="text-charcoal/50 font-mono text-xs">
              {text.page} {page} / {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={checksHref(
                  locale,
                  `/${check.id}`,
                  rowsQuery(filter, page + 1),
                )}
                className="text-burgundy font-semibold hover:underline"
              >
                {text.next}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}

function RowLine({
  row,
  check,
  keys,
  locale,
  text,
}: {
  row: SheetRowDto;
  check: SheetCheckDto;
  keys: ReturnType<typeof keyColumns>;
  locale: AdminLocale;
  text: CheckCopy;
}) {
  const result = row.result;
  const issues = result?.issues ?? [];
  const worst = worstSeverity(issues);
  const identity = keys.identity
    .map((index) => cellText(row, index))
    .filter((value) => value.length > 0)
    .join(" · ");
  const filledCells = row.cells
    .map((cell, index) => ({ index, text: cell.text }))
    .filter((cell) => cell.text.length > 0);
  const muted = row.kind !== "data";

  return (
    <tr className={`border-burgundy/8 border-b ${muted ? "opacity-70" : ""}`}>
      <th scope="row" className={`${tdClass} text-left font-mono text-xs`}>
        {row.sheetRowNumber}
        {row.hidden ? (
          <span className="text-charcoal/45 block text-[0.65rem]">
            {text.rowHidden}
          </span>
        ) : null}
      </th>
      <td className={`${tdClass} text-charcoal/70 text-xs`}>
        {text.kind[row.kind]}
      </td>
      {keys.date !== null ? (
        <td className={`${tdClass} font-mono text-xs`}>
          {result?.parsed.date ?? cellText(row, keys.date)}
        </td>
      ) : null}
      {keys.identity.length > 0 ? (
        <td className={`${tdClass} max-w-[16rem] break-words`}>{identity}</td>
      ) : null}
      {keys.amount !== null ? (
        <td className={`${tdClass} font-mono text-xs`}>
          {cellText(row, keys.amount)}
        </td>
      ) : null}
      <td className={tdClass}>
        {result ? (
          <OutcomeBadge outcome={result.outcome} locale={locale} />
        ) : (
          <span className="text-charcoal/35">—</span>
        )}
      </td>
      <td className={tdClass}>
        <SeverityBadge severity={worst} locale={locale} />
      </td>
      <td className={`${tdClass} min-w-[20rem]`}>
        <details>
          <summary className="text-burgundy cursor-pointer text-xs font-semibold">
            {text.rowDetails} ({issues.length})
          </summary>
          <div className="mt-2">
            <p className="text-charcoal/60 mb-1 text-xs font-semibold tracking-[0.12em] uppercase">
              {text.rowIssuesTitle}
            </p>
            <IssueList
              issues={issues}
              locale={locale}
              check={check}
              emptyText={text.rowNoIssues}
            />
            {result?.system ? (
              <SystemViewBlock system={result.system} locale={locale} />
            ) : null}
            {filledCells.length > 0 ? (
              <details className="border-burgundy/10 mt-3 border-t pt-3">
                <summary className="text-charcoal/60 cursor-pointer text-xs font-semibold tracking-[0.12em] uppercase">
                  {text.rowCellsTitle}
                </summary>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  {filledCells.map((cell) => (
                    <div key={cell.index} className="flex gap-2">
                      <dt className="text-charcoal/50 shrink-0 font-mono">
                        {columnLabel(cell.index)}
                        <span className="ml-1 font-sans">
                          {columnHeader(check, cell.index)}
                        </span>
                        :
                      </dt>
                      <dd className="min-w-0 break-words">{cell.text}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ) : null}
          </div>
        </details>
      </td>
    </tr>
  );
}
