import { NextResponse } from "next/server";
import { z } from "zod";

import { CloudinaryMediaStorage } from "@/lib/media/cloudinary-storage";
import { MediaStorageError } from "@/lib/media/storage-port";
import { ContentAccessDeniedError, requireContentPermission } from "@/lib/auth";
import { getCloudinaryEnv } from "@/lib/env/server";

/**
 * Issues signed parameters so an administrator's browser can upload a
 * catalogue PDF straight to Cloudinary.
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
 * One signing endpoint, three upload targets. The folder is always derived
 * server-side from the validated target, and the accepted formats follow the
 * target: a collection takes its catalogue PDF, an article or product takes
 * photographs.
 */
const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("collection"),
    id: objectIdSchema,
    locale: z.enum(["vi", "en", "fr", "de", "ja", "zh-CN"]),
  }),
  z.object({ kind: z.literal("article"), id: objectIdSchema }),
  z.object({ kind: z.literal("product"), id: objectIdSchema }),
]);

function errorResponse(status: number, code: string) {
  // Deliberately bare: an unauthenticated caller learns nothing about whether
  // storage is configured, which collections exist, or why signing failed.
  return NextResponse.json({ error: code }, { status });
}

export async function POST(request: Request) {
  let actorUserId: string;

  try {
    // Uploading media is an administrative act; the same permission that
    // governs collection drafts governs their assets.
    const context = await requireContentPermission("content.update");
    actorUserId = context.userId;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : 403;
      return errorResponse(status, "FORBIDDEN");
    }
    return errorResponse(500, "UNAVAILABLE");
  }

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
        : `${rootFolder}/${target.kind}s/${target.id}`;

    const instruction = await storage.createSignedUpload({
      folder,
      // Always an image-type asset: photographs are images outright, and a
      // catalogue PDF must be image-typed for page renditions (`pg_N`) — the
      // cover and every flipbook page — to be derivable. A raw upload would
      // store the bytes but could never render a page.
      resourceType: "image",
      maxBytes,
      allowedFormats:
        target.kind === "collection" ? ["pdf"] : ["jpg", "jpeg", "png", "webp"],
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
