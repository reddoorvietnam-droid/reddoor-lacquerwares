"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  categoryKind,
  FinanceCommandError,
  financeEntryCategories,
} from "@/domains/finance/contracts";
import { financeCommandService } from "@/domains/finance/runtime";
import { OrderCommandError } from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { MoneyError } from "@/lib/money";

/**
 * Server actions behind the finance screens. Every action re-authorizes on
 * the server against the record it touches — an order-linked entry against
 * the order's business units — then hands the request to
 * `FinanceCommandService`, which re-asserts the permission and the ledger
 * rules. Results travel back as query parameters so the pages stay
 * server-rendered.
 */

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof FinanceCommandError) return error.code;
  if (error instanceof OrderCommandError) return error.code;
  if (error instanceof MoneyError) return "INVALID_AMOUNT";
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
const returnToSchema = z.enum([
  "",
  "payments",
  "ledger",
  "expenses",
  "receivables",
]);

function backTo(
  locale: string,
  returnTo: string,
  outcome: { error?: string; notice?: string },
): never {
  const suffix = returnTo ? `/${returnTo}` : "";
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`/${locale}/admin/finance${suffix}${query}` as Route);
}

export async function recordFinanceEntryAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const returnTo = returnToSchema.parse(String(formData.get("returnTo") ?? ""));

  let code: string | null = null;

  try {
    const category = z
      .enum(financeEntryCategories)
      .parse(formData.get("category"));
    const kind = categoryKind[category];
    const orderIdRaw = String(formData.get("orderId") ?? "").trim();
    const orderId = orderIdRaw ? idSchema.parse(orderIdRaw) : null;
    const permission =
      kind === "receipt" ? "payments.record" : "expenses.create";

    let context;
    if (orderId) {
      const order =
        await financeCommandService.findOrderForAuthorization(orderId);
      if (!order) {
        backTo(locale, returnTo, { error: "ORDER_NOT_FOUND" });
      }
      context = await requirePermission(permission, {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
      });
    } else {
      context = await requirePermission(permission);
    }

    await financeCommandService.createEntry(context, {
      kind,
      category,
      orderId,
      counterparty: String(formData.get("counterparty") ?? ""),
      amount: {
        amount: String(formData.get("amount") ?? ""),
        currency: String(formData.get("currency") ?? ""),
      },
      method: String(formData.get("method") ?? ""),
      occurredAt: String(formData.get("occurredAt") ?? ""),
      note: String(formData.get("note") ?? "").trim() || null,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(locale, returnTo, code ? { error: code } : { notice: "recorded" });
}

export async function voidFinanceEntryAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const returnTo = returnToSchema.parse(String(formData.get("returnTo") ?? ""));
  const entryId = idSchema.parse(formData.get("entryId"));

  let code: string | null = null;

  try {
    const entry = await financeCommandService.findForAuthorization(entryId);
    if (!entry) backTo(locale, returnTo, { error: "NOT_FOUND" });

    const context = await requirePermission(
      entry.kind === "receipt" ? "payments.reverse" : "expenses.reverse",
      {
        resourceId: entry.id,
        ...(entry.businessUnitIds.length > 0
          ? { businessUnitIds: entry.businessUnitIds }
          : {}),
      },
    );

    await financeCommandService.voidEntry(context, {
      entryId,
      expectedRevision: String(formData.get("expectedRevision") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(locale, returnTo, code ? { error: code } : { notice: "voided" });
}

export async function setPaymentDueAtAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backTo(locale, "receivables", { error: "NOT_FOUND" });

    const context = await requirePermission("payments.record", {
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
    });

    const dueRaw = String(formData.get("paymentDueAt") ?? "").trim();
    await orderCommandService.setPaymentDueAt(context, {
      orderId,
      expectedRevision: z.coerce
        .number()
        .int()
        .min(0)
        .parse(formData.get("expectedRevision")),
      paymentDueAt: dueRaw ? z.coerce.date().parse(dueRaw) : null,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(
    locale,
    "receivables",
    code ? { error: code } : { notice: "dueDateSet" },
  );
}
