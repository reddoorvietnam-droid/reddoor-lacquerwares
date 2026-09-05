import { NextResponse } from "next/server";
import { z } from "zod";

import { invoiceCommandService } from "@/domains/finance/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { MediaStorageError } from "@/lib/media/storage-port";
import {
  ContentAccessDeniedError,
  requireContentPermission,
  requirePermission,
} from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";

/**
 * Issues signed parameters so an administrator's browser can upload a file
 * straight to Cloudinary.
 *
 * The file itself never reaches this function. It returns a short-lived
 * signature that binds the upload to one folder, one format and one size
 * ceiling; the storage provider enforces all three.
 *
 * Node runtime, because signing uses `node:crypto`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/, "An entity id is required.");

/**
 * One signing endpoint, several upload targets. The folder is always derived
 * server-side from the validated target, and the accepted formats follow the
 * target: a collection takes its catalogue PDF, an article or product takes
 * photographs, an order or invoice takes a document (PDF or photo).
 */
const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("collection"),
    id: objectIdSchema,
    locale: z.enum(["vi", "en", "fr", "de", "ja", "zh-CN"]),
  }),
  z.object({ kind: z.literal("article"), id: objectIdSchema }),
  z.object({ kind: z.literal("product"), id: objectIdSchema }),
  z.object({ kind: z.literal("shopItem"), id: objectIdSchema }),
  z.object({ kind: z.literal("orderDocument"), id: objectIdSchema }),
  z.object({ kind: z.literal("invoiceDocument"), id: objectIdSchema }),
]);

const documentFormats = ["pdf", "jpg", "jpeg", "png", "webp"] as const;

function errorResponse(status: number, code: string) {
  // Deliberately bare: an unauthenticated caller learns nothing about whether
  // storage is configured, which collections exist, or why signing failed.
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "INVALID_REQUEST");
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse(400, "INVALID_REQUEST");
  }

  let actorUserId: string;

  try {
    // Uploading media is an administrative act. A shop item is governed by
    // `shop.manage`; a payment document on an order by `payments.record`
    // against that order; an invoice file by `invoices.manage` against that
    // invoice; every editorial entity by the same `content.update` that
    // governs its drafts. The validated target decides which applies.
    const target = parsed.data;
    let context;
    if (target.kind === "shopItem") {
      context = await requirePermission("shop.manage");
    } else if (target.kind === "orderDocument") {
      const order = await orderCommandService.findForAuthorization(target.id);
      if (!order) return errorResponse(404, "NOT_FOUND");
      context = await requirePermission("payments.record", {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
      });
    } else if (target.kind === "invoiceDocument") {
      const invoice = await invoiceCommandService.findForAuthorization(
        target.id,
      );
      if (!invoice) return errorResponse(404, "NOT_FOUND");
      context = await requirePermission("invoices.manage", {
        resourceId: invoice.id,
        businessUnitIds: invoice.businessUnitIds,
      });
    } else {
      context = await requireContentPermission("content.update");
    }
    actorUserId = context.userId;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
      return errorResponse(status, "FORBIDDEN");
    }
    return errorResponse(500, "UNAVAILABLE");
  }

  let maxBytes: number;
  try {
    maxBytes = getCloudinaryEnv().MAX_PDF_UPLOAD_MB * 1024 * 1024;
  } catch {
    return errorResponse(503, "STORAGE_UNAVAILABLE");
  }

  try {
    const storage = CloudinaryMediaStorage.fromEnvironment();
    const rootFolder = getCloudinaryEnv().CLOUDINARY_UPLOAD_FOLDER;
    const target = parsed.data;

    // Folder is derived server-side from validated input, never accepted
    // from the client, so an upload cannot be aimed at another entity.
    const folder =
      target.kind === "collection"
        ? `${rootFolder}/collections/${target.id}/${target.locale}`
        : target.kind === "shopItem"
          ? `${rootFolder}/shop-items/${target.id}`
          : target.kind === "orderDocument"
            ? `${rootFolder}/orders/${target.id}/payment-documents`
            : target.kind === "invoiceDocument"
              ? `${rootFolder}/invoices/${target.id}`
              : `${rootFolder}/${target.kind}s/${target.id}`;

    const allowedFormats =
      target.kind === "collection"
        ? ["pdf"]
        : target.kind === "orderDocument" || target.kind === "invoiceDocument"
          ? [...documentFormats]
          : ["jpg", "jpeg", "png", "webp"];

    const instruction = await storage.createSignedUpload({
      folder,
      // Always an image-type asset: photographs are images outright, and a
      // PDF must be image-typed for page renditions (`pg_N`) — the cover and
      // every flipbook page, or a preview of a document — to be derivable. A
      // raw upload would store the bytes but could never render a page.
      resourceType: "image",
      maxBytes,
      allowedFormats,
      requestedByUserId: actorUserId,
      issuedAt: new Date(),
    });

    return NextResponse.json(instruction, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof MediaStorageError) {
      return errorResponse(
        error.code === "NOT_CONFIGURED" ? 503 : 400,
        error.code === "NOT_CONFIGURED"
          ? "STORAGE_UNAVAILABLE"
          : "INVALID_REQUEST",
      );
    }
    return errorResponse(500, "UNAVAILABLE");
  }
}
