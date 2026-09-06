import { notFound } from "next/navigation";

import {
  sheetCheckTemplates,
  type SheetCheckTemplate,
} from "@/domains/sheet-checks/contracts";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

import {
  BackLink,
  buttonClass,
  cardClass,
  CheckBanner,
  checkCopy,
  fieldClass,
  issueCodesFromQuery,
  labelClass,
  templateAllowed,
} from "../shared";

export const dynamic = "force-dynamic";

function requestedTemplate(
  value: string | undefined,
): SheetCheckTemplate | null {
  return value && (sheetCheckTemplates as readonly string[]).includes(value)
    ? (value as SheetCheckTemplate)
    : null;
}

export default async function NewSheetCheckPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string;
    template?: string;
    line?: string;
    issues?: string;
  }>;
}) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = checkCopy[locale];

  try {
    await requireListAccess("documents.import");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  // Only templates whose gate this uploader passes are offered; the route
  // handler re-judges the gate when the file arrives.
  const coverages = await resolvePermissionCoverages([
    "payments.read",
    "receivables.read",
    "invoices.read",
    "orders.read",
  ] as const);
  const templates = sheetCheckTemplates.filter((template) =>
    templateAllowed(template, coverages),
  );
  if (templates.length === 0) notFound();

  const preferred = requestedTemplate(query.template);
  const selected =
    preferred && templates.includes(preferred) ? preferred : templates[0];

  return (
    <div>
      <BackLink locale={locale} />

      <div className="mt-6">
        <p className="eyebrow">{text.eyebrow}</p>
        <h1 className="text-burgundy mt-3 font-serif text-5xl tracking-[-0.045em]">
          {text.newTitle}
        </h1>
        <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
          {text.newDescription}
        </p>
      </div>

      <CheckBanner
        locale={locale}
        error={query.error}
        csvLine={query.line}
        issueCodes={issueCodesFromQuery(query.issues)}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <form
          method="post"
          encType="multipart/form-data"
          // The locale rides in the query so the route can redirect a
          // denial or an oversized upload before it reads the body.
          action={`/api/sheet-checks?locale=${locale}`}
          className={`${cardClass} grid gap-5`}
        >
          <input type="hidden" name="locale" value={locale} />

          <fieldset>
            <legend className={labelClass}>{text.templateLabel}</legend>
            <div className="mt-1 grid gap-2">
              {templates.map((template) => (
                <label
                  key={template}
                  className="border-burgundy/15 has-checked:border-burgundy/50 has-checked:bg-ivory/60 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3"
                >
                  <input
                    type="radio"
                    name="template"
                    value={template}
                    defaultChecked={template === selected}
                    required
                    className="mt-1"
                  />
                  <span>
                    <span className="text-charcoal block font-semibold">
                      {text.template[template]}
                    </span>
                    <span className="text-charcoal/60 block text-xs leading-5">
                      {text.templateHint[template]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="check-file" className={labelClass}>
              {text.fileLabel}
            </label>
            <input
              id="check-file"
              name="file"
              type="file"
              required
              accept=".xlsx,.xls,.csv"
              className={`${fieldClass} file:text-burgundy file:mr-3 file:rounded-full file:border-0 file:bg-transparent file:font-semibold`}
            />
          </div>

          <div>
            <label htmlFor="check-sheet" className={labelClass}>
              {text.sheetLabel}
            </label>
            <input
              id="check-sheet"
              name="sheet"
              maxLength={120}
              className={fieldClass}
              placeholder="1"
            />
            <p className="text-charcoal/50 mt-1 text-xs">{text.sheetHint}</p>
          </div>

          <div>
            <button type="submit" className={buttonClass}>
              {text.upload}
            </button>
          </div>
        </form>

        <aside className={`${cardClass} border-dashed`}>
          <h2 className="text-burgundy font-serif text-2xl">
            {text.rulesTitle}
          </h2>
          <ul className="text-charcoal/70 mt-3 list-disc pl-5 text-sm leading-6">
            {text.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
