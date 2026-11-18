import "server-only";

import { ZodError } from "zod";

import { CanhBao, LoiSoTay } from "./loi";

/** Trả lời chung cho mọi `/api/so-tay/*`: câu báo tiếng Việt, không lưu đệm. */
const headers = {
  "cache-control": "private, no-store",
  vary: "Cookie",
} as const;

export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers });

export function loi(error: unknown): Response {
  if (error instanceof CanhBao)
    return json({ message: error.message, canhBao: true }, 409);
  if (error instanceof LoiSoTay)
    return json({ message: error.message }, error.status);
  if (error instanceof ZodError) {
    return json(
      {
        message:
          error.issues.map((i) => i.message).join("; ") ||
          "Dữ liệu không hợp lệ.",
      },
      400,
    );
  }
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "ValidationError"
  ) {
    const errs =
      (error as { errors?: Record<string, { message?: string }> }).errors ?? {};
    const msg = Object.values(errs)
      .map((e) => e.message)
      .filter(Boolean)
      .join("; ");
    return json({ message: msg || "Dữ liệu không hợp lệ." }, 400);
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  ) {
    return json({ message: "Mã đã tồn tại. Tải lại trang để đối chiếu." }, 409);
  }
  console.error(
    "so-tay request failed",
    error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError",
  );
  return json({ message: "Máy chủ gặp lỗi, thử lại sau ít phút." }, 500);
}

/** Chống gửi chéo trang (CSRF): lệnh ghi chỉ nhận từ chính website. */
export function kiemNguon(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host)
      throw new LoiSoTay("Yêu cầu không hợp lệ.", 403);
  } catch (e) {
    if (e instanceof LoiSoTay) throw e;
    throw new LoiSoTay("Yêu cầu không hợp lệ.", 403);
  }
}
