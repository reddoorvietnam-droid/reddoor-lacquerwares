"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ApprovalError } from "@/domains/approvals/contracts";
import {
  OrderCommandError,
  lineItemsInputSchema,
  orderDocumentPermissions,
} from "@/domains/orders/contracts";
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
const revisionSchema = z.coerce.number().int().min(0);

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

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

/**
 * The line-item editor posts its rows as one JSON field. Anything that is
 * not an array of rows is treated as invalid input, never as "no lines".
 */
function parseLineItems(raw: string): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function createOrderAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  const businessUnitIds = formData
    .getAll("businessUnitIds")
    .map(String)
    .filter((value) => idSchema.safeParse(value).success);

  const amount = field(formData, "sellingPriceAmount");
  const currency = field(formData, "sellingPriceCurrency");
  const orderCode = field(formData, "orderCode");
  const notes = field(formData, "notes");

  let createdId: string | null = null;
  let code: string | null = null;

  try {
    const context = await requirePermission("orders.create", {
      businessUnitIds,
    });
    const record = await orderCommandService.create(context, {
      ...(orderCode ? { orderCode } : {}),
      customerId: field(formData, "customerId"),
      businessUnitIds,
      sellingPrice: amount ? { amount, currency } : null,
      lineItems: lineItemsInputSchema.parse(
        parseLineItems(field(formData, "lineItemsJson")),
      ),
      shippingMark: field(formData, "shippingMark"),
      deliveryDueAt: field(formData, "deliveryDueAt"),
      targets: field(formData, "targets"),
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

/** Loads the record and guards `permission` against it, or redirects. */
async function guarded(
  locale: string,
  orderId: string,
  permission: Parameters<typeof requirePermission>[0],
) {
  const order = await orderCommandService.findForAuthorization(orderId);
  if (!order) backToList(locale, "NOT_FOUND");
  const context = await requirePermission(permission, {
    resourceId: order.id,
    businessUnitIds: order.businessUnitIds,
  });
  return { order, context };
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
      to: field(formData, "to"),
      expectedRevision: field(formData, "expectedRevision"),
      reason: field(formData, "reason") || null,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(locale, orderId, code ? { error: code } : { notice: "moved" });
}

export async function recordQcCheckAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "production.approveQc");
    await orderCommandService.recordQcCheck(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      checkpoint: field(formData, "checkpoint"),
      result: field(formData, "result"),
      defectCount: field(formData, "defectCount"),
      note: field(formData, "note"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "qcChecked" },
  );
}

export async function setProductionStageAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(
      locale,
      orderId,
      "production.updateProgress",
    );
    await orderCommandService.setProductionStage(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      productionStage: field(formData, "productionStage"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "productionStageSet" },
  );
}

export async function saveProductionPlanAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "production.createPlan");
    await orderCommandService.setProductionPlan(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      woodworkDue: field(formData, "woodworkDue"),
      lacquerDue: field(formData, "lacquerDue"),
      finishingDue: field(formData, "finishingDue"),
      packingDue: field(formData, "packingDue"),
      shipDue: field(formData, "shipDue"),
      assignment: field(formData, "assignment"),
      note: field(formData, "note"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "planSaved" },
  );
}

export async function savePackingRecordAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "packing.update");
    await orderCommandService.setPackingRecord(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      packedAt: field(formData, "packedAt"),
      cartons: field(formData, "cartons"),
      pallets: field(formData, "pallets"),
      containerNumber: field(formData, "containerNumber"),
      note: field(formData, "note"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "packingSaved" },
  );
}

export async function saveLineItemsAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "orders.updateDraft");
    await orderCommandService.setLineItems(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      lineItems: parseLineItems(field(formData, "lineItemsJson")),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "linesSaved" },
  );
}

export async function saveOrderDetailsAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "orders.updateDraft");
    await orderCommandService.setDetails(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      shippingMark: field(formData, "shippingMark"),
      deliveryDueAt: field(formData, "deliveryDueAt"),
      targets: field(formData, "targets"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "detailsSaved" },
  );
}

export async function setSellingPriceAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "orders.updateDraft");
    await orderCommandService.setSellingPrice(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      amount: field(formData, "amount"),
      currency: field(formData, "currency"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(locale, orderId, code ? { error: code } : { notice: "priceSet" });
}

/** Expected ready date and carrier booking, kept by the Company Accountant. */
export async function setExportProgressAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(
      locale,
      orderId,
      "orders.updateExportProgress",
    );
    await orderCommandService.setExportProgress(context, {
      orderId,
      expectedRevision: field(formData, "expectedRevision"),
      expectedReadyAt: field(formData, "expectedReadyAt"),
      bookingNumber: field(formData, "bookingNumber"),
      bookingDate: field(formData, "bookingDate"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "exportSaved" },
  );
}

/** Removes a step output; the permission follows the file's kind. */
export async function removeOrderDocumentAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const order = await orderCommandService.findForAuthorization(orderId);
    if (!order) backToList(locale, "NOT_FOUND");
    const documentId = idSchema.parse(formData.get("documentId"));
    const existing = order.documents.find((item) => item.id === documentId);
    if (!existing) backToOrder(locale, orderId, { error: "NOT_FOUND" });

    const context = await requirePermission(
      orderDocumentPermissions[existing.kind],
      { resourceId: order.id, businessUnitIds: order.businessUnitIds },
    );
    await orderCommandService.removeDocument(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      documentId,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "documentRemoved" },
  );
}

/**
 * The Director approves the company's own label proof. `approvals.decide` is
 * a global permission; the service re-checks the scope and refuses the
 * person who uploaded the proof.
 */
export async function approveLabelProofAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "approvals.decide");
    await orderCommandService.approveLabelProof(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      documentId: idSchema.parse(formData.get("documentId")),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "labelApproved" },
  );
}

export async function removePaymentDocumentAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "payments.record");
    await orderCommandService.removePaymentDocument(context, {
      orderId,
      expectedRevision: revisionSchema.parse(formData.get("expectedRevision")),
      documentId: idSchema.parse(formData.get("documentId")),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToOrder(
    locale,
    orderId,
    code ? { error: code } : { notice: "documentRemoved" },
  );
}

export async function requestStageApprovalAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const orderId = idSchema.parse(formData.get("orderId"));

  let code: string | null = null;

  try {
    const { context } = await guarded(locale, orderId, "approvals.request");
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
