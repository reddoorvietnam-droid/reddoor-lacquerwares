"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { DocumentActionState } from "@/app/[locale]/admin/(portal)/finance/document-actions";
import {
  ImportShipmentCommandError,
  importShipmentDocumentKinds,
} from "@/domains/import-shipments/contracts";
import { importShipmentCommandService } from "@/domains/import-shipments/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

/**
 * Server actions behind the import shipment pages. Every action
 * re-authorizes on the server, then hands the request to
 * `ImportShipmentCommandService`, which re-asserts the permission and the
 * record's revision. Results travel back as a query parameter so the pages
 * stay server-rendered.
 */

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof ImportShipmentCommandError) return error.code;
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

function backToShipment(
  locale: string,
  shipmentId: string,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  redirect(`/${locale}/admin/import-shipments/${shipmentId}${query}` as Route);
}

export async function createImportShipmentAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  let createdId: string | null = null;
  let code: string | null = null;

  try {
    const context = await requirePermission("importShipments.manage");
    const record = await importShipmentCommandService.create(context, {
      code: field(formData, "code"),
      declarationNumber: field(formData, "declarationNumber"),
      declaredOn: field(formData, "declaredOn"),
      supplierName: field(formData, "supplierName"),
      goodsDescription: field(formData, "goodsDescription"),
      note: field(formData, "note"),
    });
    createdId = record.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (createdId) backToShipment(locale, createdId, { notice: "created" });
  redirect(
    `/${locale}/admin/import-shipments?error=${code ?? "UNAVAILABLE"}` as Route,
  );
}

export async function updateImportShipmentAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const shipmentId = idSchema.parse(formData.get("shipmentId"));

  let code: string | null = null;

  try {
    const context = await requirePermission("importShipments.manage", {
      resourceId: shipmentId,
    });
    await importShipmentCommandService.update(context, {
      shipmentId,
      expectedRevision: field(formData, "expectedRevision"),
      code: field(formData, "code"),
      declarationNumber: field(formData, "declarationNumber"),
      declaredOn: field(formData, "declaredOn"),
      supplierName: field(formData, "supplierName"),
      goodsDescription: field(formData, "goodsDescription"),
      note: field(formData, "note"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToShipment(
    locale,
    shipmentId,
    code ? { error: code } : { notice: "saved" },
  );
}

export async function removeImportShipmentDocumentAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const shipmentId = idSchema.parse(formData.get("shipmentId"));

  let code: string | null = null;

  try {
    const context = await requirePermission("importShipments.manage", {
      resourceId: shipmentId,
    });
    await importShipmentCommandService.removeDocument(context, {
      shipmentId,
      expectedRevision: field(formData, "expectedRevision"),
      documentId: field(formData, "documentId"),
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToShipment(
    locale,
    shipmentId,
    code ? { error: code } : { notice: "documentRemoved" },
  );
}

const attachPayloadSchema = z.object({
  target: z.object({
    kind: z.literal("importShipmentDocument"),
    id: idSchema,
  }),
  expectedRevision: z.number().int().min(0),
  publicId: z.string().min(1).max(500),
  assetVersion: z.number().int().min(1),
  format: z.string().min(1).max(10),
  bytes: z.number().int().min(1),
  label: z.string().min(1).max(200),
});

/**
 * The `attachAction` of `DocumentUpload` on a shipment's checklist. The page
 * binds the document kind of the row, so the button records the stored file
 * under the kind it was uploaded for.
 */
export async function attachImportShipmentDocumentAction(
  documentKind: unknown,
  input: unknown,
): Promise<DocumentActionState> {
  try {
    const kind = z.enum(importShipmentDocumentKinds).parse(documentKind);
    const payload = attachPayloadSchema.parse(input);
    const context = await requirePermission("importShipments.manage", {
      resourceId: payload.target.id,
    });
    await importShipmentCommandService.attachDocument(context, {
      shipmentId: payload.target.id,
      expectedRevision: payload.expectedRevision,
      kind,
      publicId: payload.publicId,
      assetVersion: payload.assetVersion,
      format: payload.format,
      bytes: payload.bytes,
      label: payload.label,
    });
    return { status: "success", message: "ATTACHED" };
  } catch (error) {
    const message = errorCode(error);
    if (message === "UNAVAILABLE") {
      console.error("[import-shipments] document attach failed", error);
    }
    return { status: "error", message };
  }
}
