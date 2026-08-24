"use client";

import { useActionState } from "react";

import type { ContentEditorActionState } from "@/components/admin/content-editor";
import type { RevisionWorkflowStatus } from "@/lib/content/contracts";
import type { Locale } from "@/lib/i18n/config";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

type WorkflowAction = (
  previousState: ContentEditorActionState,
  formData: FormData,
) => Promise<ContentEditorActionState>;

type ContentWorkflowActionsProps = {
  locale: AdminLocale;
  status: RevisionWorkflowStatus;
  entryId: string;
  revisionId: string;
  expectedEntryRevision: number;
  expectedRevision: number;
  expectedTranslations: readonly {
    locale: Locale;
    expectedRevision: number;
  }[];
  submitAction: WorkflowAction;
  returnAction: WorkflowAction;
  publishAction: WorkflowAction;
  createRevisionAction: WorkflowAction;
};

const initialState: ContentEditorActionState = {
  status: "idle",
  message: "",
};

function HiddenWorkflowFields({
  entryId,
  revisionId,
  expectedEntryRevision,
  expectedRevision,
  expectedTranslations,
}: Pick<
  ContentWorkflowActionsProps,
  | "entryId"
  | "revisionId"
  | "expectedEntryRevision"
  | "expectedRevision"
  | "expectedTranslations"
>) {
  return (
    <>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input
        type="hidden"
        name="expectedEntryRevision"
        value={expectedEntryRevision}
      />
      <input type="hidden" name="expectedRevision" value={expectedRevision} />
      <input
        type="hidden"
        name="expectedTranslations"
        value={JSON.stringify(expectedTranslations)}
      />
    </>
  );
}

function ActionMessage({ state }: { state: ContentEditorActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
        state.status === "error"
          ? "border-lacquer/30 bg-lacquer/8 text-lacquer"
          : "border-green-800/20 bg-green-800/8 text-green-900"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitReviewForm(
  props: Omit<ContentWorkflowActionsProps, "returnAction" | "publishAction">,
) {
  const copy = getAdminDictionary(props.locale).workflowActions;
  const [state, action, pending] = useActionState(
    props.submitAction,
    initialState,
  );

  return (
    <form action={action}>
      <HiddenWorkflowFields {...props} />
      <button
        type="submit"
        disabled={pending}
        className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
      >
        {pending ? copy.submitting : copy.submitReview}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function ReturnToDraftForm(
  props: Omit<ContentWorkflowActionsProps, "submitAction" | "publishAction">,
) {
  const copy = getAdminDictionary(props.locale).workflowActions;
  const [state, action, pending] = useActionState(
    props.returnAction,
    initialState,
  );

  return (
    <form action={action} className="border-burgundy/10 rounded-xl border p-4">
      <HiddenWorkflowFields {...props} />
      <label className="text-burgundy block text-sm font-semibold">
        {copy.returnReason}
        <textarea
          name="reason"
          required
          maxLength={2_000}
          rows={3}
          placeholder={copy.returnReasonPlaceholder}
          className="border-burgundy/20 mt-2 w-full rounded-xl border bg-[#fffdf9] px-4 py-3 text-sm leading-6"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="border-burgundy/25 text-burgundy hover:bg-burgundy hover:text-ivory mt-3 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
      >
        {pending ? copy.returning : copy.returnDraft}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function PublishForm(
  props: Omit<
    ContentWorkflowActionsProps,
    "submitAction" | "returnAction" | "createRevisionAction"
  >,
) {
  const copy = getAdminDictionary(props.locale).workflowActions;
  const [state, action, pending] = useActionState(
    props.publishAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="border-gold/35 bg-gold/8 rounded-xl border p-4"
    >
      <HiddenWorkflowFields {...props} />
      <button
        type="submit"
        disabled={pending}
        className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
      >
        {pending ? copy.publishing : copy.publish}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

function CreateRevisionForm(
  props: Omit<
    ContentWorkflowActionsProps,
    "submitAction" | "returnAction" | "publishAction"
  >,
) {
  const copy = getAdminDictionary(props.locale).workflowActions;
  const [state, action, pending] = useActionState(
    props.createRevisionAction,
    initialState,
  );

  return (
    <form action={action}>
      <HiddenWorkflowFields {...props} />
      <button
        type="submit"
        disabled={pending}
        className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
      >
        {pending ? copy.creatingRevision : copy.createRevision}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function ContentWorkflowActions(props: ContentWorkflowActionsProps) {
  const copy = getAdminDictionary(props.locale).workflowActions;

  return (
    <section className="border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)]">
      <h2 className="text-burgundy font-serif text-2xl">{copy.title}</h2>
      <p className="text-charcoal/60 mt-2 max-w-3xl text-sm leading-6">
        {copy.description}
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {props.status === "draft" ? <SubmitReviewForm {...props} /> : null}
        {props.status === "inReview" ? (
          <>
            <ReturnToDraftForm {...props} />
            <PublishForm {...props} />
          </>
        ) : null}
        {props.status === "published" ? (
          <CreateRevisionForm {...props} />
        ) : null}
        {props.status === "archived" ? (
          <p className="border-burgundy/10 bg-charcoal/5 text-charcoal/60 rounded-xl border p-4 text-sm lg:col-span-2">
            {copy.immutable}
          </p>
        ) : null}
      </div>
    </section>
  );
}
