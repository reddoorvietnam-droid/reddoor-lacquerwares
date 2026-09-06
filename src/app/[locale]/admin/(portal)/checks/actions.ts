"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  discardSheetCheckInputSchema,
  opportunisticPermissions,
  rerunSheetCheckInputSchema,
  runSheetCheckInputSchema,
  SheetCheckError,
  templateGates,
  type SheetCheckAuthorizationView,
} from "@/domains/sheet-checks/contracts";
import { sheetCheckService } from "@/domains/sheet-checks/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import type { AccessContext } from "@/lib/auth/authorization";

import { readMappingForm } from "./shared";

/**
 * Server actions behind the mapping and result pages of a sheet check.
 *
 * Every action re-authorizes against the exact check on the server —
 * `documents.import` on the check target plus the template's gate
 * permissions — and hands one merged context to the service, which
 * re-asserts the same permissions before touching any data. Outcomes travel
 * back as query parameters so the pages stay server-rendered; a redirect
 * never carries cell text, only codes.
 */

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof SheetCheckError) return error.code;
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

/** Blocking finding codes of a MAPPING_INVALID error, for the banner (codes only). */
function issueCodesOf(error: unknown): string[] {
  if (!(error instanceof SheetCheckError)) return [];
  return [...new Set(error.issues.map((issue) => issue.code))];
}

function merge(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

function importTarget(view: SheetCheckAuthorizationView) {
  return {
    resourceId: view.id,
    ownerUserId: view.createdByUserId,
    businessUnitIds: view.businessUnitIds,
  };
}

/**
 * The template gate on top of `documents.import`: money templates name
 * their finance permissions without a target (the service demands global
 * scope on the context); the order list takes the runner's own
 * `orders.read` list scope, which the run then uses for every lookup.
 */
async function gateContext(
  view: SheetCheckAuthorizationView,
  base: AccessContext,
): Promise<AccessContext> {
  let context = base;
  if (view.template === "generic") {
    context = merge(context, (await requireListAccess("orders.read")).context);
    // Extra comparisons run only with global coverage; each one the run
    // exercises is stamped into the check for later readers.
    const coverages = await resolvePermissionCoverages(
      opportunisticPermissions,
    );
    for (const permission of opportunisticPermissions) {
      if (coverages[permission].global) {
        context = merge(context, await requirePermission(permission));
      }
    }
    return context;
  }
  for (const permission of templateGates[view.template]) {
    context = merge(context, await requirePermission(permission));
  }
  // Resolving a customer by name or code needs the directory, and the cash
  // engine reads invoices as an identity fallback. Both are opportunistic:
  // held globally they join the context, otherwise the run compares without.
  const coverages = await resolvePermissionCoverages([
    "customers.read",
    "invoices.read",
  ] as const);
  for (const permission of ["customers.read", "invoices.read"] as const) {
    if (coverages[permission].global) {
      context = merge(context, await requirePermission(permission));
    }
  }
  return context;
}

function backToCheck(
  locale: string,
  checkId: string,
  outcome: { error?: string; notice?: string; issues?: readonly string[] },
): never {
  const params = new URLSearchParams();
  if (outcome.error) {
    params.set("error", outcome.error);
    if (outcome.issues && outcome.issues.length > 0) {
      params.set("issues", outcome.issues.join(","));
    }
  } else if (outcome.notice) {
    params.set("notice", outcome.notice);
  }
  const query = params.toString();
  redirect(
    `/${locale}/admin/checks/${checkId}${query ? `?${query}` : ""}` as Route,
  );
}

function backToList(
  locale: string,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`/${locale}/admin/checks${query}` as Route);
}

export async function runSheetCheckAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const checkId = idSchema.safeParse(formData.get("checkId"));
  if (!checkId.success) backToList(locale, { error: "INVALID_INPUT" });

  let code: string | null = null;
  let issues: string[] = [];
  try {
    const input = runSheetCheckInputSchema.parse({
      checkId: checkId.data,
      expectedRevision: formData.get("expectedRevision"),
      mapping: readMappingForm(formData),
    });
    const view = await sheetCheckService.findForAuthorization(input.checkId);
    if (!view) throw new SheetCheckError("NOT_FOUND", "Check not found.");

    const context = await gateContext(
      view,
      await requirePermission("documents.import", importTarget(view)),
    );
    await sheetCheckService.run(context, input);
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
    issues = issueCodesOf(error);
  }

  if (code === "NOT_FOUND") backToList(locale, { error: code });
  backToCheck(
    locale,
    checkId.data,
    code ? { error: code, issues } : { notice: "checked" },
  );
}

export async function discardSheetCheckAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const checkId = idSchema.safeParse(formData.get("checkId"));
  if (!checkId.success) backToList(locale, { error: "INVALID_INPUT" });

  let code: string | null = null;
  try {
    const input = discardSheetCheckInputSchema.parse({
      checkId: checkId.data,
      expectedRevision: formData.get("expectedRevision"),
    });
    const view = await sheetCheckService.findForAuthorization(input.checkId);
    if (!view) throw new SheetCheckError("NOT_FOUND", "Check not found.");

    // The service decides who may discard (creator, or a global importer);
    // the guard only establishes that the actor may import on this target.
    const context = await requirePermission(
      "documents.import",
      importTarget(view),
    );
    await sheetCheckService.discard(context, input);
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  // A discarded draft no longer has a page to go back to.
  if (code && code !== "NOT_FOUND") {
    backToCheck(locale, checkId.data, { error: code });
  }
  backToList(locale, code ? { error: code } : { notice: "discarded" });
}

export async function rerunSheetCheckAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const checkId = idSchema.safeParse(formData.get("checkId"));
  if (!checkId.success) backToList(locale, { error: "INVALID_INPUT" });

  let code: string | null = null;
  let newCheckId: string | null = null;
  try {
    const input = rerunSheetCheckInputSchema.parse({ checkId: checkId.data });
    const view = await sheetCheckService.findForAuthorization(input.checkId);
    if (!view) throw new SheetCheckError("NOT_FOUND", "Check not found.");

    // Cloning a result reads it, so the full read rule applies on top of
    // the import permission: documents.read and every permission the
    // original run exercised, each judged against the check target.
    const target = importTarget(view);
    let context = await requirePermission("documents.import", target);
    context = merge(context, await requirePermission("documents.read", target));
    for (const permission of view.requiredPermissions) {
      context = merge(
        context,
        await requirePermission(permission, {
          resourceId: view.id,
          businessUnitIds: view.businessUnitIds,
        }),
      );
    }
    const created = await sheetCheckService.rerun(context, input);
    newCheckId = created.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (code === "NOT_FOUND") backToList(locale, { error: code });
  if (code || !newCheckId) {
    backToCheck(locale, checkId.data, { error: code ?? "UNAVAILABLE" });
  }
  backToCheck(locale, newCheckId, { notice: "rerun" });
}
