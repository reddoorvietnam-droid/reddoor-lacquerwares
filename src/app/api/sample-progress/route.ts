import { ZodError } from "zod";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import {
  requireSampleProgressAccess,
  requireSampleProgressEditor,
} from "@/domains/sample-progress/access";
import { sampleProgressService } from "@/domains/sample-progress/runtime";
import { SampleProgressError } from "@/domains/sample-progress/service";
import {
  importSampleWorkbook,
  maxWorkbookBytes,
} from "@/domains/sample-progress/import-workbook";
import {
  buildReportFileName,
  exportSampleWorkbook,
} from "@/domains/sample-progress/export-workbook";
import { getUserModel } from "@/domains/identity/models";
import { isoDateSchema } from "@/domains/sample-progress/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Weekly progress is internal: never cache it in a shared or browser cache. */
const privateHeaders = { "cache-control": "private, no-store", vary: "Cookie" };
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: privateHeaders });

const maxJsonBytes = 1_000_000;

function failure(error: unknown) {
  if (error instanceof ContentAccessDeniedError)
    return json(
      {
        error: error.code,
        message:
          "Chỉ giám đốc và biên tập nội dung được truy cập báo cáo tiến độ mẫu.",
      },
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "AUTH_NOT_CONFIGURED"
          ? 503
          : 403,
    );
  if (error instanceof SampleProgressError)
    return json({ error: error.code, message: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: "SAMPLE_PROGRESS_INVALID",
        message: `Dữ liệu chưa hợp lệ: ${error.issues
          .map((issue) => `${issue.path.join(".") || "biểu mẫu"}: ${issue.message}`)
          .join("; ")}`,
      },
      400,
    );
  // Only the error's name is logged: report rows carry customer wording.
  console.error(
    "sample-progress request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    {
      error: "SAMPLE_PROGRESS_UNAVAILABLE",
      message:
        "Không thể xử lý báo cáo lúc này. Vui lòng thử lại; dữ liệu đang nhập vẫn được giữ trên màn hình.",
    },
    500,
  );
}

export async function GET(request: Request) {
  try {
    const access = await requireSampleProgressAccess();
    const params = new URL(request.url).searchParams;
    const week = params.get("week");
    if (!week)
      return json({
        role: access.role,
        reports: await sampleProgressService.list(),
      });
    isoDateSchema.parse(week);
    if (params.get("history") === "1")
      return json({
        role: access.role,
        reports: await sampleProgressService.list(week),
      });
    const revision = params.has("revision")
      ? Number(params.get("revision"))
      : undefined;
    const report = await sampleProgressService.read(week, revision);
    if (params.get("export") === "1") {
      return new Response(new Uint8Array(exportSampleWorkbook(report)), {
        headers: {
          ...privateHeaders,
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${buildReportFileName(report)}"`,
        },
      });
    }
    return json({ role: access.role, report });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    // Editors only: the Director reads and exports, but does not maintain the
    // weekly report, so every write names the person who actually keeps it.
    const access = await requireSampleProgressEditor();
    assertSameOrigin(request);
    const action = new URL(request.url).searchParams.get("action");

    if (action === "import") {
      const bytes = await readLimitedBody(request, maxWorkbookBytes);
      return json(importSampleWorkbook(bytes));
    }

    const bytes = await readLimitedBody(request, maxJsonBytes);
    let input: unknown;
    try {
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new SampleProgressError("Nội dung yêu cầu không hợp lệ.");
    }

    const actor = {
      userId: access.userId,
      name: await displayName(access.userId),
    };
    if (action === "inherit") {
      const week =
        typeof input === "object" && input !== null && "week" in input
          ? String((input as { week: unknown }).week)
          : "";
      const report = await sampleProgressService.inherit(
        isoDateSchema.parse(week),
        actor,
      );
      return json({ role: access.role, report }, 201);
    }
    const report = await sampleProgressService.save(input, actor);
    return json({ role: access.role, report }, 201);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Removes a whole week, every revision of it. Kept separate from POST so a
 * delete can never be reached by a form post or a stray retry of a save.
 */
export async function DELETE(request: Request) {
  try {
    const access = await requireSampleProgressEditor();
    assertSameOrigin(request);
    const bytes = await readLimitedBody(request, maxJsonBytes);
    let input: unknown;
    try {
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new SampleProgressError("Nội dung yêu cầu không hợp lệ.");
    }
    const body = (input ?? {}) as { week?: unknown; reason?: unknown };
    const removed = await sampleProgressService.remove(
      isoDateSchema.parse(typeof body.week === "string" ? body.week : ""),
      typeof body.reason === "string" ? body.reason : "",
      { userId: access.userId, name: await displayName(access.userId) },
    );
    return json({ role: access.role, removed });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Session cookies ride along on a cross-site form post, so a same-origin check
 * is what stops another site from saving a report as the signed-in editor.
 */
function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  let originHost = "";
  try {
    originHost = origin ? new URL(origin).host : "";
  } catch {
    originHost = "";
  }
  if (!originHost || !host || originHost !== host)
    throw new SampleProgressError(
      "Nguồn yêu cầu không hợp lệ.",
      403,
      "SAMPLE_PROGRESS_BAD_ORIGIN",
    );
}

async function displayName(userId: string): Promise<string> {
  const user = await getUserModel()
    .findById(userId)
    .select("displayName")
    .lean<{ displayName?: string } | null>()
    .exec();
  return user?.displayName || userId;
}

async function readLimitedBody(request: Request, limit: number) {
  const tooLarge = () =>
    new SampleProgressError(
      `Nội dung yêu cầu vượt quá ${Math.round(limit / 100_000) / 10} MB.`,
      413,
      "SAMPLE_PROGRESS_TOO_LARGE",
    );
  // content-length is attacker controlled, so the stream is capped as well.
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new SampleProgressError("Yêu cầu không có dữ liệu.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
