import { NextResponse } from "next/server";

import {
  AttachmentError,
  type AttachmentInput,
} from "@/domains/assistant/attachments/contracts";
import { attachmentLimits } from "@/domains/assistant/attachments/limits";
import { assistantAttachmentService } from "@/domains/assistant/runtime";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { ContentAccessDeniedError, requireListAccess } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

/**
 * Files a staff member attaches to a question. The bytes are read here,
 * parsed by this project's own readers, and dropped: what is stored is the
 * extracted text, owned by the uploader and expiring with the conversation
 * that carries it. The original file is never written anywhere.
 *
 * The gate is `assistant.use`, the same permission that opens the chat:
 * parsing someone's own document exposes no portal record, and every tool
 * the model then calls re-checks the permission that governs the data it
 * reads. Comparing a spreadsheet against portal records is a different
 * feature with its own, stricter gate ("Kiểm tra bảng biểu").
 *
 * Errors are fixed identifiers. None of them repeats anything from inside
 * the file: the message is shown to whoever is at the screen, and the file
 * may hold data they are not the ones to see.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Multipart framing around files at the cap: boundaries and field names. */
const MULTIPART_SLACK_BYTES = 16 * 1024;

function errorResponse(status: number, code: string) {
  return NextResponse.json({ error: code }, { status });
}

function denialStatus(error: ContentAccessDeniedError): number {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "AUTH_NOT_CONFIGURED") return 503;
  return 403;
}

function statusOf(code: string): number {
  if (code === "FILE_TOO_LARGE" || code === "FILE_TOO_MANY_ROWS") return 413;
  if (code === "PERMISSION_DENIED") return 403;
  if (code === "NOT_FOUND") return 404;
  return 400;
}

export async function POST(request: Request) {
  const declared = request.headers.get("content-length") ?? "";
  if (
    /^\d+$/.test(declared) &&
    Number.parseInt(declared, 10) >
      attachmentLimits.maxTotalBytes + MULTIPART_SLACK_BYTES
  ) {
    return errorResponse(413, "FILE_TOO_LARGE");
  }

  // Who is asking, and whether they may ask again, is settled before a
  // single byte of the body is read: an anonymous or throttled caller must
  // not be able to make the server buffer an upload.
  const requestId = globalThis.crypto.randomUUID();
  let userId: string;
  try {
    userId = (await requireListAccess("assistant.use")).context.userId;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return errorResponse(denialStatus(error), "FORBIDDEN");
    }
    console.error("[assistant] attachment guard failed", requestId, error);
    return errorResponse(500, "UNAVAILABLE");
  }

  const limit = consumeRateLimit(`assistant:attachments:${userId}`, {
    limit: attachmentLimits.uploadsPerWindow,
    windowMs: attachmentLimits.uploadWindowMs,
  });
  if (!limit.allowed) return errorResponse(429, "RATE_LIMITED");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(400, "FILE_PARSE_FAILED");
  }

  const uploaded = formData
    .getAll("file")
    .filter((entry): entry is File => entry instanceof File);
  if (uploaded.length === 0) return errorResponse(400, "FILE_EMPTY");
  if (uploaded.length > attachmentLimits.maxFilesPerTurn) {
    return errorResponse(400, "TOO_MANY_FILES");
  }
  const total = uploaded.reduce((sum, file) => sum + file.size, 0);
  if (total > attachmentLimits.maxTotalBytes) {
    return errorResponse(413, "FILE_TOO_LARGE");
  }

  const started = Date.now();
  try {
    const files: AttachmentInput[] = [];
    for (const file of uploaded) {
      files.push({
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
      });
    }
    const attachments = await assistantAttachmentService.ingest({
      ownerUserId: userId,
      now: new Date(),
      files,
    });

    try {
      await mongoAuditRepository.append({
        actor: { type: "user", userId },
        action: "assistant.attachment.read",
        resourceType: "assistantAttachment",
        resourceId: null,
        requestId,
        metadata: {
          // The names are the person's own file names and stay out of the
          // audit trail, which outlives the seven-day conversation window.
          count: attachments.length,
          formats: attachments.map((attachment) => attachment.format),
          bytes: total,
          truncated: attachments.some((attachment) => attachment.truncated),
          durationMs: Date.now() - started,
        },
        occurredAt: new Date(),
      });
    } catch {
      // The upload still succeeded when audit storage is unavailable.
    }

    return NextResponse.json(
      { attachments },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AttachmentError) {
      return errorResponse(statusOf(error.code), error.code);
    }
    console.error("[assistant] attachment upload failed", requestId, error);
    return errorResponse(500, "UNAVAILABLE");
  }
}
