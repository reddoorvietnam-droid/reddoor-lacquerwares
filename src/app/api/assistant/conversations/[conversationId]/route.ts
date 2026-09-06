import { NextResponse } from "next/server";

import { attachmentLimits } from "@/domains/assistant/attachments/limits";
import {
  ConversationError,
  conversationIdSchema,
} from "@/domains/assistant/conversations/contracts";
import { assistantConversationService } from "@/domains/assistant/runtime";
import { ContentAccessDeniedError, requireListAccess } from "@/lib/auth";

/**
 * One stored conversation: its transcript, or its deletion.
 *
 * A conversation belonging to somebody else answers NOT_FOUND rather than
 * FORBIDDEN. The two are indistinguishable on purpose — a "you may not read
 * this" would confirm that a particular id exists and that someone else is
 * talking to the assistant about something.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denialStatus(error: ContentAccessDeniedError): number {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "AUTH_NOT_CONFIGURED") return 503;
  return 403;
}

async function ownerOf(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  try {
    const { context } = await requireListAccess("assistant.use");
    return { ok: true, userId: context.userId };
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "FORBIDDEN" },
          { status: denialStatus(error) },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 }),
    };
  }
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/assistant/conversations/[conversationId]">,
) {
  const owner = await ownerOf();
  if (!owner.ok) return owner.response;

  const { conversationId } = await context.params;
  if (!conversationIdSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const result = await assistantConversationService.read(
      owner.userId,
      conversationId,
      attachmentLimits.messagePageSize,
    );
    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ConversationError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    console.error("[assistant] conversation read failed", error);
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/assistant/conversations/[conversationId]">,
) {
  const owner = await ownerOf();
  if (!owner.ok) return owner.response;

  const { conversationId } = await context.params;
  if (!conversationIdSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await assistantConversationService.remove(owner.userId, conversationId);
    return new NextResponse(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ConversationError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.code === "NOT_FOUND" ? 404 : 400 },
      );
    }
    console.error("[assistant] conversation delete failed", error);
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }
}
