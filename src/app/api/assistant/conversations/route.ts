import { NextResponse } from "next/server";

import { assistantConversationService } from "@/domains/assistant/runtime";
import { ContentAccessDeniedError, requireListAccess } from "@/lib/auth";

/**
 * The signed-in person's own conversations, newest first.
 *
 * There is no parameter for whose list to read: the owner comes from the
 * session and goes straight into the store's filter. That is the whole
 * mechanism behind "only the owner", and it has to be structural — the
 * Director holds every permission at `all`, so no permission scope could
 * have expressed it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denialStatus(error: ContentAccessDeniedError): number {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "AUTH_NOT_CONFIGURED") return 503;
  return 403;
}

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = (await requireListAccess("assistant.use")).context.userId;
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: denialStatus(error) },
      );
    }
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }

  const requested = new URL(request.url).searchParams.get("limit");
  const limit =
    requested && /^\d{1,3}$/.test(requested)
      ? Number.parseInt(requested, 10)
      : undefined;

  try {
    const conversations = await assistantConversationService.list(
      userId,
      // The store clamps whatever arrives; passing it through unchanged
      // keeps the ceiling in one place instead of two that can drift.
      limit === undefined ? {} : { limit },
    );
    return NextResponse.json(
      { conversations },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[assistant] conversation list failed", error);
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }
}
