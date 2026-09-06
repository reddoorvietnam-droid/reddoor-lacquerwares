import { NextResponse } from "next/server";

import { SheetCheckError } from "@/domains/sheet-checks/contracts";
import { sheetCheckService } from "@/domains/sheet-checks/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import type { AccessContext } from "@/lib/auth/authorization";

/**
 * CSV download of a checked result. The guard chain mirrors the result
 * page exactly — `documents.export`, `documents.read`, then every
 * permission the run exercised, each judged against the check's own units —
 * and any denial answers 404, so the endpoint never confirms that a check
 * the caller may not open exists.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_ID = /^[a-f0-9]{24}$/;

function notFound(): NextResponse {
  return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}

function merge(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ checkId: string }> },
) {
  const { checkId } = await params;
  if (!CHECK_ID.test(checkId)) return notFound();
  const locale =
    new URL(request.url).searchParams.get("locale") === "en" ? "en" : "vi";
  const requestId = globalThis.crypto.randomUUID();

  try {
    const view = await sheetCheckService.findForAuthorization(checkId);
    if (!view) return notFound();
    const target = {
      resourceId: view.id,
      businessUnitIds: view.businessUnitIds,
      requestId,
    };
    let context = await requirePermission("documents.export", {
      ...target,
      ownerUserId: view.createdByUserId,
    });
    context = merge(
      context,
      await requirePermission("documents.read", {
        ...target,
        ownerUserId: view.createdByUserId,
      }),
    );
    for (const permission of view.requiredPermissions) {
      context = merge(context, await requirePermission(permission, target));
    }

    const file = await sheetCheckService.exportCsv(context, checkId, locale);
    return new NextResponse(file.content, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${file.fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) return notFound();
    if (error instanceof SheetCheckError) {
      if (error.code === "NOT_FOUND") return notFound();
      if (error.code === "INVALID_STATE") {
        return NextResponse.json({ error: error.code }, { status: 409 });
      }
    }
    console.error("[sheet-checks] export failed", requestId, error);
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }
}
