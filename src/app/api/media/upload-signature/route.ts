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

const requestSchema = z.object({
  /** Which catalogue the upload belongs to, used to build the folder. */
  collectionId: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{24}$/, "A collection id is required."),
  locale: z.enum(["vi", "en", "fr", "de", "ja", "zh-CN"]),
});

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

    const instruction = await storage.createSignedUpload({
      // Folder is derived server-side from validated input, never accepted
      // from the client, so an upload cannot be aimed at another collection.
      folder: `${rootFolder}/collections/${parsed.data.collectionId}/${parsed.data.locale}`,
      resourceType: "raw",
      maxBytes,
      allowedFormats: ["pdf"],
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
