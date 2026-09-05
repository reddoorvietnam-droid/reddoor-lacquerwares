"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  allocationTargetSchema,
  categoryKind,
  FinanceCommandError,
  financeEntryCategories,
  type AllocationTargetInput,
} from "@/domains/finance/contracts";
import {
  financeCommandService,
  fxRateService,
  invoiceCommandService,
} from "@/domains/finance/runtime";
import { OrderCommandError } from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { MoneyError } from "@/lib/money";

/**
 * Server actions behind the finance screens. Every action re-authorizes on
 * the server against the record it touches — an order-linked entry against
 * the order's business units — then hands the request to the finance
 * services, which re-assert the permission and the ledger rules. Results
 * travel back as query parameters so the pages stay server-rendered.
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

/**
 * Where an action returns to. Finance screens by name, or the record the
 * form was embedded on: `order:<id>`, `customer:<id>`, `invoice:<id>`,
 * `receipt:<id>`.
 */
const returnToSchema = z
  .string()
  .regex(
    /^(?:|payments|ledger|expenses|receivables|invoices|fx|(?:order|customer|invoice|receipt):[a-f0-9]{24})$/,
  );

function returnPath(locale: string, returnTo: string): string {
  const base = `/${locale}/admin`;
  if (returnTo.startsWith("order:")) return `${base}/orders/${returnTo.slice(6)}`;
  if (returnTo.startsWith("customer:")) {
    return `${base}/customers/${returnTo.slice(9)}`;
  }
  if (returnTo.startsWith("invoice:")) {
    return `${base}/finance/invoices/${returnTo.slice(8)}`;
  }
  if (returnTo.startsWith("receipt:")) {
    return `${base}/finance/payments/${returnTo.slice(8)}`;
  }
  return `${base}/finance${returnTo ? `/${returnTo}` : ""}`;
}

function backTo(
  locale: string,
  returnTo: string,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`${returnPath(locale, returnTo)}${query}` as Route);
}

function optionalId(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  return raw ? idSchema.parse(raw) : null;
}

function parseAllocateTo(
  value: FormDataEntryValue | null,
): AllocationTargetInput | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const [target, id] = raw.split(":");
  return allocationTargetSchema.parse(
    target === "invoice"
      ? { target: "invoice", invoiceId: id }
      : { target: "order", orderId: id },
  );
}

export async function recordFinanceEntryAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const returnTo = returnToSchema.parse(String(formData.get("returnTo") ?? ""));

  let code: string | null = null;
  let recordedId: string | null = null;
  let recordedCategory: string | null = null;

  try {
    const category = z
      .enum(financeEntryCategories)
      .parse(formData.get("category"));
    const kind = categoryKind[category];
    const allocateTo = parseAllocateTo(formData.get("allocateTo"));
    const explicitOrderId = optionalId(formData.get("orderId"));
    const permission =
      kind === "receipt"
        ? "payments.record"
        : category === "refund"
          ? "payments.refund"
          : "expenses.create";

    // Judge the permission against the order the money is recorded on, when
    // there is one; the service re-derives and re-checks the same order.
    let orderId = explicitOrderId;
    if (allocateTo?.target === "invoice") {
      const invoice = await financeCommandService.findInvoiceForAuthorization(
        allocateTo.invoiceId,
      );
      if (!invoice) backTo(locale, returnTo, { error: "INVOICE_NOT_FOUND" });
      orderId = invoice.orderId;
    } else if (allocateTo?.target === "order") {
      orderId = allocateTo.orderId;
    }

    let context;
    if (orderId) {
      const order =
        await financeCommandService.findOrderForAuthorization(orderId);
      if (!order) backTo(locale, returnTo, { error: "ORDER_NOT_FOUND" });
      context = await requirePermission(permission, {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
      });
    } else {
      context = await requirePermission(permission);
    }

    const record = await financeCommandService.createEntry(context, {
      kind,
      category,
      orderId: explicitOrderId,
      customerId: optionalId(formData.get("customerId")),
      supplierId: optionalId(formData.get("supplierId")),
      counterparty: String(formData.get("counterparty") ?? ""),
      amount: {
        amount: String(formData.get("amount") ?? ""),
        currency: String(formData.get("currency") ?? ""),
      },
      method: String(formData.get("method") ?? ""),
      occurredAt: String(formData.get("occurredAt") ?? ""),
      note: String(formData.get("note") ?? "").trim() || null,
      allocateTo,
    });
    recordedId = record.id;
    recordedCategory = record.category;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (code) backTo(locale, returnTo, { error: code });

  // A customer payment recorded from the payments desk opens its allocation
  // page right away, so the accountant can spread it over invoices.
  if (recordedCategory === "orderPayment" && recordedId && returnTo === "payments") {
    backTo(locale, `receipt:${recordedId}`, { notice: "recorded" });
  }
  backTo(locale, returnTo, {
    notice: recordedCategory === "refund" ? "refunded" : "recorded",
  });
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

/**
 * Saves how a customer payment is spread over invoices and orders. Inputs are
 * named `alloc:invoice:<id>` and `alloc:order:<id>`; a blank or zero amount
 * drops that target.
 */
export async function setAllocationsAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const entryId = idSchema.parse(formData.get("entryId"));
  const returnTo = `receipt:${entryId}`;

  let code: string | null = null;

  try {
    const entry = await financeCommandService.findForAuthorization(entryId);
    if (!entry) backTo(locale, "payments", { error: "NOT_FOUND" });

    const context = await requirePermission("payments.allocate", {
      resourceId: entry.id,
      ...(entry.businessUnitIds.length > 0
        ? { businessUnitIds: entry.businessUnitIds }
        : {}),
    });

    const allocations: unknown[] = [];
    for (const [name, value] of formData.entries()) {
      const match = /^alloc:(invoice|order):([a-f0-9]{24})$/.exec(name);
      if (!match) continue;
      const amount = String(value).trim();
      if (!amount || /^0+(?:\.0+)?$/.test(amount)) continue;
      allocations.push(
        match[1] === "invoice"
          ? { target: "invoice", invoiceId: match[2], amount }
          : { target: "order", orderId: match[2], amount },
      );
    }

    await financeCommandService.setAllocations(context, {
      entryId,
      expectedRevision: String(formData.get("expectedRevision") ?? ""),
      allocations,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(locale, returnTo, code ? { error: code } : { notice: "allocated" });
}

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const returnTo = returnToSchema.parse(String(formData.get("returnTo") ?? ""));

  let code: string | null = null;
  let invoiceId: string | null = null;

  try {
    const orderId = idSchema.parse(formData.get("orderId"));
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backTo(locale, returnTo, { error: "ORDER_NOT_FOUND" });

    const context = await requirePermission("invoices.manage", {
      resourceId: order.id,
      businessUnitIds: order.businessUnitIds,
    });

    const invoice = await invoiceCommandService.createInvoice(context, {
      orderId,
      invoiceNumber: String(formData.get("invoiceNumber") ?? ""),
      issuedAt: String(formData.get("issuedAt") ?? ""),
      dueAt: String(formData.get("dueAt") ?? ""),
      amount: {
        amount: String(formData.get("amount") ?? ""),
        currency: String(formData.get("currency") ?? ""),
      },
      fxRateToVnd: String(formData.get("fxRateToVnd") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim() || null,
    });
    invoiceId = invoice.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (code) backTo(locale, returnTo, { error: code });
  // The new invoice opens so the INV file can be attached right away.
  backTo(locale, `invoice:${invoiceId}`, { notice: "invoiceIssued" });
}

export async function voidInvoiceAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const returnTo = returnToSchema.parse(String(formData.get("returnTo") ?? ""));
  const invoiceId = idSchema.parse(formData.get("invoiceId"));

  let code: string | null = null;

  try {
    const invoice = await invoiceCommandService.findForAuthorization(invoiceId);
    if (!invoice) backTo(locale, returnTo, { error: "NOT_FOUND" });

    const context = await requirePermission("invoices.manage", {
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
    });

    await invoiceCommandService.voidInvoice(context, {
      invoiceId,
      expectedRevision: String(formData.get("expectedRevision") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(locale, returnTo, code ? { error: code } : { notice: "invoiceVoided" });
}

export async function removeInvoiceDocumentAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const invoiceId = idSchema.parse(formData.get("invoiceId"));
  const returnTo = `invoice:${invoiceId}`;

  let code: string | null = null;

  try {
    const invoice = await invoiceCommandService.findForAuthorization(invoiceId);
    if (!invoice) backTo(locale, "invoices", { error: "NOT_FOUND" });

    const context = await requirePermission("invoices.manage", {
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
    });

    await invoiceCommandService.removeDocument(context, {
      invoiceId,
      expectedRevision: z.coerce
        .number()
        .int()
        .min(0)
        .parse(formData.get("expectedRevision")),
      documentId: idSchema.parse(formData.get("documentId")),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(
    locale,
    returnTo,
    code ? { error: code } : { notice: "documentRemoved" },
  );
}

export async function setFxRateAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  let code: string | null = null;

  try {
    const context = await requirePermission("finance.manageFxSnapshot");
    await fxRateService.setRate(context, {
      date: String(formData.get("date") ?? ""),
      rate: String(formData.get("rate") ?? ""),
      source: String(formData.get("source") ?? ""),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backTo(locale, "fx", code ? { error: code } : { notice: "rateSaved" });
}
