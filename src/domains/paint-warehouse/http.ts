import "server-only";
import { ZodError } from "zod";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { PaintError } from "./contracts";

/** Shared response and body helpers for every `/api/paint-warehouse/*` route. */

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
        message: "Bạn không có quyền thao tác bảng xuất kho sơn.",
        code: error.code,
      },
      error.code === "UNAUTHENTICATED" ? 401 : 403,
    );
  if (error instanceof PaintError)
    return json({ message: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        message: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === 11000
  )
    return json(
      { message: "Dòng đã được tạo. Tải lại để đối chiếu; không tạo bản sao." },
      409,
    );
  console.error(
    "paint-warehouse failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    {
      message:
        "Không thể lưu/đọc dữ liệu kho lúc này. Giữ bản nháp và thử lại.",
    },
    500,
  );
}

/** The session cookie alone is not enough: every mutation must come from our own page. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  // Opaque origins arrive as the literal "null"; treat anything unparsable as
  // foreign instead of letting URL() throw into a 500.
  let host: string | null = null;
  try {
    host = origin ? new URL(origin).host : null;
  } catch {
    host = null;
  }
  if (!host || host !== request.headers.get("host"))
    throw new PaintError("Nguồn yêu cầu không hợp lệ.", 403);
}

/** Buffers the body up to `limit` bytes; the declared content-length is attacker controlled. */
export async function readCappedBody(
  request: Request,
  limit: number,
  tooLarge: string,
): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new PaintError("Yêu cầu trống.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new PaintError(tooLarge, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/** Same-origin JSON body with the paste-sized cap the grid enforces client side. */
export async function readJsonBody(
  request: Request,
  limit = 1_000_000,
): Promise<unknown> {
  assertSameOrigin(request);
  const buffered = await readCappedBody(
    request,
    limit,
    "Tối đa 1 MB / 500 dòng mỗi lần dán.",
  );
  try {
    return JSON.parse(buffered.toString("utf8"));
  } catch {
    throw new PaintError("JSON không hợp lệ.");
  }
}

/** multipart/form-data rebuilt from the capped stream, never from `request.formData()`. */
export async function readFormBody(
  request: Request,
  limit: number,
  tooLarge: string,
): Promise<FormData> {
  assertSameOrigin(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data"))
    throw new PaintError("Biểu mẫu tải lên không hợp lệ.");
  const bytes = await readCappedBody(request, limit, tooLarge);
  try {
    return await new Response(new Uint8Array(bytes), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new PaintError("Biểu mẫu tải lên không hợp lệ.");
  }
}
