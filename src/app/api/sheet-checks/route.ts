import { NextResponse } from "next/server";

import {
  SheetCheckError,
  templateGates,
  uploadFieldsSchema,
  type SheetCheckTemplate,
} from "@/domains/sheet-checks/contracts";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { sheetCheckService } from "@/domains/sheet-checks/runtime";
import {
  ContentAccessDeniedError,
  requireListAccess,
  requirePermission,
} from "@/lib/auth";
import type { AccessContext } from "@/lib/auth/authorization";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

/**
 * The upload endpoint behind the "Tải bảng mới" form. Browsers post the
 * multipart form here directly, so success and failure are both redirects
 * back into the portal; a client that asks for JSON (tests, scripts) gets
 * `{ id }` or `{ error }` instead. The file is read into memory once,
 * parsed, and dropped — its bytes are never stored — and every error code
 * sent back is a fixed identifier, never a piece of the file.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Locale = "vi" | "en";

/** Multipart framing around a file at the size limit: boundaries and the small text fields. */
const MULTIPART_SLACK_BYTES = 16 * 1024;

function localeOf(value: FormDataEntryValue | string | null): Locale {
  return value === "en" ? "en" : "vi";
}

/** The form posts to `/api/sheet-checks?locale=…`, so failures can redirect before the body is read. */
function localeOfRequest(request: Request): Locale {
  return localeOf(new URL(request.url).searchParams.get("locale"));
}

function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

function newPageUrl(
  request: Request,
  locale: Locale,
  query: Record<string, string>,
): URL {
  const url = new URL(`/${locale}/admin/checks/new`, request.url);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function failure(
  request: Request,
  locale: Locale,
  status: number,
  code: string,
  extra: Record<string, string> = {},
): NextResponse {
  if (wantsJson(request)) {
    return NextResponse.json({ error: code, ...extra }, { status });
  }
  return NextResponse.redirect(
    newPageUrl(request, locale, { error: code, ...extra }),
    303,
  );
}

function denialStatus(error: ContentAccessDeniedError): number {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "AUTH_NOT_CONFIGURED") return 503;
  return 403;
}

function merge(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

/** Read-only extras a money-template run uses when the caller holds them. */
const moneyExtras = ["customers.read", "invoices.read"] as const;

function coveredGlobally(
  context: AccessContext,
  permission: (typeof moneyExtras)[number],
): boolean {
  return context.permissions.some(
    (entry) => entry.permission === permission && entry.scope === "all",
  );
}

/** The line number a CSV_MALFORMED error names, for the error banner. */
function csvLine(error: SheetCheckError): string | null {
  const match = /line\s+(\d{1,7})/i.exec(error.message);
  return match ? match[1]! : null;
}

export async function POST(request: Request) {
  const locale = localeOfRequest(request);
  const contentLength = request.headers.get("content-length") ?? "";
  if (
    /^\d+$/.test(contentLength) &&
    Number.parseInt(contentLength, 10) >
      sheetCheckLimits.maxFileBytes + MULTIPART_SLACK_BYTES
  ) {
    return failure(request, locale, 413, "FILE_TOO_LARGE");
  }

  // Who is asking, and may they ask again, is decided before a single byte
  // of the body is read: an anonymous or throttled caller must not be able
  // to make the server buffer a multipart upload.
  const requestId = globalThis.crypto.randomUUID();
  let context: AccessContext;
  try {
    context = (await requireListAccess("documents.import")).context;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return failure(request, locale, denialStatus(error), "FORBIDDEN");
    }
    console.error("[sheet-checks] upload guard failed", requestId, error);
    return failure(request, locale, 500, "UNAVAILABLE");
  }

  const limit = consumeRateLimit(`sheet-checks:upload:${context.userId}`, {
    limit: sheetCheckLimits.uploadsPerWindow,
    windowMs: sheetCheckLimits.uploadWindowMs,
  });
  if (!limit.allowed) {
    return failure(request, locale, 429, "RATE_LIMITED");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure(request, locale, 400, "FILE_PARSE_FAILED");
  }

  const fields = uploadFieldsSchema.safeParse({
    template: formData.get("template"),
    sheet: formData.get("sheet"),
  });
  if (!fields.success) {
    return failure(request, locale, 400, "INVALID_INPUT");
  }
  const template: SheetCheckTemplate = fields.data.template;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return failure(request, locale, 400, "FILE_EMPTY", { template });
  }
  if (file.size > sheetCheckLimits.maxFileBytes) {
    return failure(request, locale, 413, "FILE_TOO_LARGE", { template });
  }

  // The template gate is judged by the real guard (audited on denial) and
  // merged into the context the service re-inspects.
  try {
    if (template === "generic") {
      context = merge(
        context,
        (await requireListAccess("orders.read")).context,
      );
    } else {
      for (const permission of templateGates[template]) {
        context = merge(
          context,
          await requirePermission(permission, { requestId }),
        );
      }
      // Matching a cash or receivables sheet by customer name needs the
      // directory; it is opportunistic, so a holder gets it and everyone
      // else simply reconciles without it.
      for (const permission of moneyExtras) {
        if (coveredGlobally(context, permission)) continue;
        try {
          context = merge(context, await requirePermission(permission));
        } catch {
          // Not held: the run compares without the directory.
        }
      }
    }
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return failure(request, locale, denialStatus(error), "FORBIDDEN", {
        template,
      });
    }
    console.error("[sheet-checks] gate guard failed", requestId, error);
    return failure(request, locale, 500, "UNAVAILABLE", { template });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = await sheetCheckService.createFromFile(
      { ...context, requestId },
      {
        template,
        bytes,
        fileName: file.name,
        sheetSelector: fields.data.sheet,
      },
    );
    if (wantsJson(request)) {
      return NextResponse.json(
        { id: check.id },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    }
    return NextResponse.redirect(
      new URL(`/${locale}/admin/checks/${check.id}`, request.url),
      303,
    );
  } catch (error) {
    if (error instanceof SheetCheckError) {
      const line = error.code === "CSV_MALFORMED" ? csvLine(error) : null;
      const status =
        error.code === "FILE_TOO_LARGE" || error.code === "FILE_TOO_MANY_ROWS"
          ? 413
          : error.code === "RATE_LIMITED"
            ? 429
            : error.code === "PERMISSION_DENIED"
              ? 403
              : 400;
      return failure(request, locale, status, error.code, {
        template,
        ...(line ? { line } : {}),
      });
    }
    if (error instanceof ContentAccessDeniedError) {
      return failure(request, locale, 403, "FORBIDDEN", { template });
    }
    console.error("[sheet-checks] upload failed", requestId, error);
    return failure(request, locale, 500, "UNAVAILABLE", { template });
  }
}
