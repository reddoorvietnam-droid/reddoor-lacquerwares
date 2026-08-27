"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ApprovalError } from "@/domains/approvals/contracts";
import { OrderCommandError } from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  OrderTransitionError,
  stageDefinition,
} from "@/domains/orders/workflow";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { MoneyError } from "@/lib/money";

/**
 * Server actions behind the order board.
 *
 * Every action re-authorizes on the server against the exact record and its
 * business units, then hands the request to `OrderCommandService`, which
 * re-judges the process (state machine) and the Director approval gate.
 * Results travel back as a query parameter so the pages stay server-rendered.
 */

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof OrderCommandError) return error.code;
  if (error instanceof OrderTransitionError) return error.code;
  if (error instanceof ApprovalError) return error.code;
  if (error instanceof MoneyError) return "INVALID_PRICE";
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

function backToList(locale: string, code?: string): never {
  const suffix = code ? `?error=${code}` : "";
  redirect(`/${locale}/admin/orders${suffix}` as Route);
}

function backToOrder(
  locale: string,
  orderId: string,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`/${locale}/admin/orders/${orderId}${query}` as Route);
}

export async function createOrderAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  const businessUnitIds = formData
    .getAll("businessUnitIds")
    .map(String)
    .filter((value) => idSchema.safeParse(value).success);

  const amount = String(formData.get("sellingPriceAmount") ?? "").trim();
  const currency = String(formData.get("sellingPriceCurrency") ?? "").trim();
  const orderCode = String(formData.get("orderCode") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  let createdId: string | null = null;
  let code: string | null = null;

  try {
    const context = await requirePermission("orders.create", {
      businessUnitIds,
    });
    const record = await orderCommandService.create(context, {
      ...(orderCode ? { orderCode } : {}),
      customerName: String(formData.get("customerName") ?? ""),
      businessUnitIds,
      sellingPrice: amount ? { amount, currency } : null,
      notes: notes || null,
    });
    createdId = record.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (createdId) backToOrder(locale, createdId, { notice: "created" });
  redirect(
    `/${locale}/admin/orders/new?error=${code ?? "UNAVAILABLE"}` as Route,
  );
}

export async function transitionOrderAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backToList(locale, "NOT_FOUND");

    // The permission that leaves the current stage, judged against this exact
    // record and its business units.
    const context = await requirePermission(
      stageDefinition(order.stage).advancePermission,
      { resourceId: order.id, businessUnitIds: order.businessUnitIds },
    );

    await orderCommandService.transition(context, {
      orderId,
      to: String(formData.get("to") ?? ""),
      expectedRevision: String(formData.get("expectedRevision") ?? ""),
      reason: String(formData.get("reason") ?? "").trim() || null,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(locale, orderId, code ? { error: code } : { notice: "moved" });
}

export async function recordQcPassAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backToList(locale, "NOT_FOUND");

    const context = await requirePermission("production.approveQc", {
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
    });

    await orderCommandService.recordQcPass(context, {
      orderId,
      expectedRevision: z.coerce
        .number()
        .int()
        .min(0)
        .parse(formData.get("expectedRevision")),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(locale, orderId, code ? { error: code } : { notice: "qcPassed" });
}

export async function setSellingPriceAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backToList(locale, "NOT_FOUND");

    const context = await requirePermission("orders.updateDraft", {
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
    });

    await orderCommandService.setSellingPrice(context, {
      orderId,
      expectedRevision: z.coerce
        .number()
        .int()
        .min(0)
        .parse(formData.get("expectedRevision")),
      amount: String(formData.get("amount") ?? ""),
      currency: String(formData.get("currency") ?? ""),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(locale, orderId, code ? { error: code } : { notice: "priceSet" });
}

export async function requestStageApprovalAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backToList(locale, "NOT_FOUND");

    const context = await requirePermission("approvals.request", {
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
    });

    await orderCommandService.requestStageApproval(context, { orderId });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "approvalRequested" },
  );
}
