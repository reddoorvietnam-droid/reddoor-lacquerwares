import "server-only";
import { ZodError } from "zod";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { ReceivablesError } from "./contracts";

/** Shared response helpers for every `/api/receivables/*` route. */

export const responseHeaders = {
  "cache-control": "private, no-store",
  vary: "Cookie",
} as const;

export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: responseHeaders });

export function failure(error: unknown): Response {
  if (error instanceof ContentAccessDeniedError)
    return json(
      {
        message: "Bạn không có quyền xem hoặc thao tác công nợ.",
        code: error.code,
      },
      error.code === "UNAUTHENTICATED" ? 401 : 403,
    );
  if (error instanceof ReceivablesError)
    return json(
      { message: error.message, details: error.details ?? null },
      error.status,
    );
  if (error instanceof ZodError)
    return json(
      {
        message: error.issues
          .map((issue) =>
            issue.path.length
              ? `${issue.path.join(".")}: ${issue.message}`
              : issue.message,
          )
          .join("; "),
      },
      400,
    );
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  )
    return json(
      {
        message:
          "Giao dịch này đã được ghi sổ. Tải lại để đối chiếu; không ghi thêm bản sao.",
      },
      409,
    );
  console.error(
    "receivables request failed",
    error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError",
  );
  return json(
    { message: "Không thể đọc/ghi công nợ lúc này. Giữ bản nháp và thử lại." },
    500,
  );
}

/** Same-origin check for every mutating request (the session cookie alone is not enough). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // Browsers send the literal "null" for opaque origins; treat any unparsable
  // value as foreign rather than letting URL() throw into a 500.
  let host: string | null = null;
  try {
    host = origin ? new URL(origin).host : null;
  } catch {
    host = null;
  }
  if (!host || host !== request.headers.get("host"))
    throw new ReceivablesError("Nguồn yêu cầu không hợp lệ.", 403);
}

/** Reads a JSON body with a hard size cap; the declared length is attacker controlled. */
export async function readJsonBody(
  request: Request,
  limit = 1_000_000,
): Promise<unknown> {
  assertSameOrigin(request);
  const reader = request.body?.getReader();
  if (!reader) throw new ReceivablesError("Yêu cầu trống.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new ReceivablesError("Yêu cầu quá lớn (tối đa 1 MB).", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ReceivablesError("JSON không hợp lệ.");
  }
}
