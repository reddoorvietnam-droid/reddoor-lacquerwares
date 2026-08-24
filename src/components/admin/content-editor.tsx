"use client";

import { useActionState, type FormEvent, useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import type {
  RevisionWorkflowStatus,
  TranslationStatus,
} from "@/lib/content/contracts";
import { localeConfig, locales, type Locale } from "@/lib/i18n/config";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

export type ContentEditorActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
};

export type ContentEditorTranslation = {
  locale: Locale;
  status: TranslationStatus;
  translationId: string;
  expectedRevision: number;
  title: string;
  slug: string;
  summary: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  noIndex: boolean;
};

export type ContentEditorValues = {
  entryId: string;
  revisionId: string;
  expectedEntryRevision: number;
  expectedRevision: number;
  code: string;
  type: "page" | "section" | "processStage" | "global";
  placement: string;
  sourceLocale: Locale;
  translations: ContentEditorTranslation[];
};

type ContentEditorProps = {
  adminLocale: AdminLocale;
  mode: "create" | "edit";
  workflowStatus: RevisionWorkflowStatus;
  initialValues: ContentEditorValues;
  readOnly?: boolean;
  saveAction: (
    previousState: ContentEditorActionState,
    formData: FormData,
  ) => Promise<ContentEditorActionState>;
};

const initialActionState: ContentEditorActionState = {
  status: "idle",
  message: "",
};

function badgeVariant(
  status: RevisionWorkflowStatus | TranslationStatus,
): "lacquer" | "gold" | "neutral" {
  if (status === "published") return "lacquer";
  if (status === "inReview" || status === "needsUpdate") return "gold";
  return "neutral";
}

export function ContentEditor({
  adminLocale,
  mode,
  workflowStatus,
  initialValues,
  readOnly = false,
  saveAction,
}: ContentEditorProps) {
  const copy = getAdminDictionary(adminLocale);
  const [activeLocale, setActiveLocale] = useState<Locale>(
    initialValues.sourceLocale,
  );
  const [serverState, dispatchSave, isActionPending] = useActionState(
    saveAction,
    initialActionState,
  );
  const [isTransitionPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContentEditorValues>({ defaultValues: initialValues });
  const isPending = isActionPending || isTransitionPending;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    void handleSubmit(() => {
      const payload = new FormData(form);
      startTransition(() => dispatchSave(payload));
    })(event);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      <input type="hidden" {...register("entryId")} />
      <input type="hidden" {...register("revisionId")} />
      <input
        type="hidden"
        {...register("expectedEntryRevision", { valueAsNumber: true })}
      />
      <input
        type="hidden"
        {...register("expectedRevision", { valueAsNumber: true })}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {mode === "create"
              ? copy.editor.createEyebrow
              : copy.editor.editEyebrow}
          </p>
          <h1 className="text-burgundy mt-3 font-serif text-4xl tracking-[-0.035em] md:text-5xl">
            {mode === "create"
              ? copy.editor.createTitle
              : copy.editor.editTitle}
          </h1>
        </div>
        <Badge variant={badgeVariant(workflowStatus)}>
          {copy.workflow[workflowStatus]}
        </Badge>
      </div>

      <fieldset className="border-burgundy/15 grid gap-5 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] md:grid-cols-2">
        <legend className="text-burgundy px-2 font-serif text-2xl">
          {copy.editor.detailsLegend}
        </legend>
        <label className="text-burgundy block text-sm font-semibold">
          {copy.editor.code}
          <input
            {...register("code", {
              required: copy.editor.required,
              pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            })}
            readOnly={mode === "edit"}
            aria-invalid={Boolean(errors.code)}
            className="border-burgundy/20 read-only:bg-charcoal/5 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 font-mono text-sm"
          />
          <span className="text-charcoal/55 mt-2 block text-xs leading-5 font-normal">
            {errors.code?.message ?? copy.editor.codeHelp}
          </span>
        </label>
        <label className="text-burgundy block text-sm font-semibold">
          {copy.editor.placement}
          <input
            {...register("placement", { required: copy.editor.required })}
            aria-invalid={Boolean(errors.placement)}
            className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 text-sm"
          />
        </label>
        <label className="text-burgundy block text-sm font-semibold">
          {copy.editor.type}
          <select
            {...register("type")}
            className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 text-sm"
          >
            {Object.entries(copy.editor.types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-burgundy block text-sm font-semibold">
          {copy.editor.sourceLocale}
          <select
            {...register("sourceLocale")}
            className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 text-sm"
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {localeConfig[locale].label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="border-burgundy/15 rounded-2xl border bg-white p-5 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] md:p-7">
        <legend className="text-burgundy px-2 font-serif text-2xl">
          {copy.editor.translationsLegend}
        </legend>
        <p className="text-charcoal/60 mb-5 text-sm leading-6">
          {copy.editor.translationHelp}
        </p>
        <div
          role="tablist"
          aria-label={copy.editor.translationsLegend}
          className="border-burgundy/10 flex gap-2 overflow-x-auto border-b pb-3"
        >
          {initialValues.translations.map((translation) => (
            <button
              key={translation.locale}
              id={`translation-tab-${translation.locale}`}
              type="button"
              role="tab"
              aria-selected={activeLocale === translation.locale}
              aria-controls={`translation-panel-${translation.locale}`}
              onClick={() => setActiveLocale(translation.locale)}
              className="border-burgundy/15 text-burgundy aria-selected:border-burgundy aria-selected:bg-burgundy aria-selected:text-ivory min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold"
            >
              {localeConfig[translation.locale].shortLabel}
            </button>
          ))}
        </div>

        {initialValues.translations.map((translation, index) => {
          const isActive = activeLocale === translation.locale;
          return (
            <section
              key={translation.locale}
              id={`translation-panel-${translation.locale}`}
              role="tabpanel"
              aria-labelledby={`translation-tab-${translation.locale}`}
              hidden={!isActive}
              className="pt-6"
            >
              <input
                type="hidden"
                {...register(`translations.${index}.locale`)}
              />
              <input
                type="hidden"
                {...register(`translations.${index}.status`)}
              />
              <input
                type="hidden"
                {...register(`translations.${index}.translationId`)}
              />
              <input
                type="hidden"
                {...register(`translations.${index}.expectedRevision`, {
                  valueAsNumber: true,
                })}
              />
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-burgundy font-serif text-2xl">
                  {localeConfig[translation.locale].label}
                </h2>
                <Badge variant={badgeVariant(translation.status)}>
                  {copy.workflow[translation.status]}
                </Badge>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="text-burgundy block text-sm font-semibold">
                  {copy.editor.title}
                  <input
                    {...register(`translations.${index}.title`)}
                    className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 text-sm"
                  />
                </label>
                <label className="text-burgundy block text-sm font-semibold">
                  {copy.editor.slug}
                  <input
                    {...register(`translations.${index}.slug`, {
                      pattern: /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u,
                    })}
                    className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 font-mono text-sm"
                  />
                  <span className="text-charcoal/55 mt-2 block text-xs leading-5 font-normal">
                    {copy.editor.slugHelp}
                  </span>
                </label>
                <label className="text-burgundy block text-sm font-semibold md:col-span-2">
                  {copy.editor.summary}
                  <textarea
                    {...register(`translations.${index}.summary`)}
                    rows={3}
                    className="border-burgundy/20 mt-2 w-full rounded-xl border bg-[#fffdf9] px-4 py-3 text-sm leading-6"
                  />
                </label>
                <label className="text-burgundy block text-sm font-semibold md:col-span-2">
                  {copy.editor.body}
                  <textarea
                    {...register(`translations.${index}.body`)}
                    rows={10}
                    className="border-burgundy/20 mt-2 w-full rounded-xl border bg-[#fffdf9] px-4 py-3 text-sm leading-6"
                  />
                  <span className="text-charcoal/55 mt-2 block text-xs leading-5 font-normal">
                    {copy.editor.bodyHelp}
                  </span>
                </label>
              </div>

              <fieldset className="border-burgundy/10 mt-7 grid gap-5 border-t pt-6 md:grid-cols-2">
                <legend className="text-burgundy pr-3 font-serif text-xl">
                  {copy.editor.seoLegend}
                </legend>
                <label className="text-burgundy block text-sm font-semibold">
                  {copy.editor.seoTitle}
                  <input
                    {...register(`translations.${index}.seoTitle`)}
                    maxLength={70}
                    className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 text-sm"
                  />
                </label>
                <label className="text-burgundy block text-sm font-semibold">
                  {copy.editor.seoDescription}
                  <input
                    {...register(`translations.${index}.seoDescription`)}
                    maxLength={180}
                    className="border-burgundy/20 mt-2 min-h-11 w-full rounded-xl border bg-[#fffdf9] px-4 text-sm"
                  />
                </label>
                <label className="text-burgundy flex items-start gap-3 text-sm font-semibold md:col-span-2">
                  <input
                    type="checkbox"
                    {...register(`translations.${index}.noIndex`)}
                    className="mt-0.5 size-5 accent-[var(--lacquer-red)]"
                  />
                  {copy.editor.noIndex}
                </label>
              </fieldset>
            </section>
          );
        })}
      </fieldset>

      {serverState.message ? (
        <p
          role={serverState.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            serverState.status === "error"
              ? "border-lacquer/30 bg-lacquer/8 text-lacquer"
              : "border-green-800/20 bg-green-800/8 text-green-900"
          }`}
        >
          {serverState.message}
        </p>
      ) : null}

      {readOnly ? (
        <p
          role="status"
          className="border-gold/35 bg-gold/8 text-burgundy rounded-xl border px-4 py-3 text-sm font-semibold"
        >
          {copy.editor.unsupportedBlocks}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isPending ||
            readOnly ||
            workflowStatus === "published" ||
            workflowStatus === "archived"
          }
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)] transition-colors disabled:pointer-events-none disabled:opacity-45"
        >
          {isPending ? copy.editor.saving : copy.editor.save}
        </button>
      </div>
    </form>
  );
}
