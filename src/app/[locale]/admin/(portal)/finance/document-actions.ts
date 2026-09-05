"use server";

import { z } from "zod";

import { FinanceCommandError } from "@/domains/finance/contracts";
import { invoiceCommandService } from "@/domains/finance/runtime";
import { OrderCommandError } from "@/domains/orders/contracts";
import { orderCommandService } from "@/domains/orders/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

/**
 * Records an uploaded document on an order (payment evidence) or an invoice
 * (the INV file). The bytes are already at the storage provider; this only
 * attaches the descriptor, after re-authorizing against the exact record.
 */

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/);

const payloadSchema = z.object({
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("orderDocument"), id: objectIdSchema }),
    z.object({ kind: z.literal("invoiceDocument"), id: objectIdSchema }),
  ]),
  expectedRevision: z.number().int().min(0),
  publicId: z.string().min(1).max(500),
  assetVersion: z.number().int().min(1),
  format: z.string().min(1).max(10),
  bytes: z.number().int().min(1),
  label: z.string().min(1).max(200),
});

export type DocumentActionState = {
  status: "success" | "error";
  message: string;
};

function failure(error: unknown): DocumentActionState {
  if (error instanceof ContentAccessDeniedError) {
    return { status: "error", message: "FORBIDDEN" };
  }
  if (
    error instanceof FinanceCommandError ||
    error instanceof OrderCommandError
  ) {
    return { status: "error", message: error.code };
  }
  if (error instanceof z.ZodError) {
    return { status: "error", message: "INVALID_INPUT" };
  }
  console.error("[finance] document action failed", error);
  return { status: "error", message: "UNAVAILABLE" };
}

export async function attachDocumentAction(
  input: unknown,
): Promise<DocumentActionState> {
  try {
    const payload = payloadSchema.parse(input);
    const descriptor = {
      expectedRevision: payload.expectedRevision,
      publicId: payload.publicId,
      assetVersion: payload.assetVersion,
      format: payload.format,
      bytes: payload.bytes,
      label: payload.label,
    };

    if (payload.target.kind === "orderDocument") {
      const order = await orderCommandService.findForAuthorization(
        payload.target.id,
      );
      if (!order) return { status: "error", message: "NOT_FOUND" };
      const context = await requirePermission("payments.record", {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
      });
      await orderCommandService.attachPaymentDocument(context, {
        orderId: order.id,
        ...descriptor,
      });
      return { status: "success", message: "ATTACHED" };
    }

    const invoice = await invoiceCommandService.findForAuthorization(
      payload.target.id,
    );
    if (!invoice) return { status: "error", message: "NOT_FOUND" };
    const context = await requirePermission("invoices.manage", {
      resourceId: invoice.id,
      businessUnitIds: invoice.businessUnitIds,
    });
    await invoiceCommandService.attachDocument(context, {
      invoiceId: invoice.id,
      ...descriptor,
    });
    return { status: "success", message: "ATTACHED" };
  } catch (error) {
    return failure(error);
  }
}
