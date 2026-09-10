import "server-only";
import { ZodError } from "zod";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { SalesSlipError } from "./contracts";

/** Shared response helpers for every `/api/sales-slips/*` route. */

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
        message: "Bạn không có quyền thao tác phiếu bán hàng.",
        code: error.code,
      },
      error.code === "UNAUTHENTICATED" ? 401 : 403,
    );
  if (error instanceof SalesSlipError)
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
          "Phiếu đã được tạo trước đó. Tải lại để đối chiếu; không tạo bản sao.",
      },
      409,
    );
  console.error(
    "sales-slips request failed",
    error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError",
  );
  return json(
    {
      message:
        "Không thể đọc/ghi phiếu bán hàng lúc này. Giữ bản nháp và thử lại.",
    },
    500,
  );
}

/** Same-origin check for every mutating request (the session cookie alone is not enough). */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host"))
    throw new SalesSlipError("Nguồn yêu cầu không hợp lệ.", 403);
}

/** Reads a JSON body with a hard size cap; never buffers more than `limit` bytes. */
export async function readJsonBody(
  request: Request,
  limit = 1_000_000,
): Promise<unknown> {
  assertSameOrigin(request);
  const reader = request.body?.getReader();
  if (!reader) throw new SalesSlipError("Yêu cầu trống.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new SalesSlipError("Yêu cầu quá lớn (tối đa 1 MB).", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SalesSlipError("JSON không hợp lệ.");
  }
}
