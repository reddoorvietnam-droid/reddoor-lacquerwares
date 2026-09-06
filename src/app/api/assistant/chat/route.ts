import { NextResponse } from "next/server";

import { runAssistantChat } from "@/domains/assistant/chat";
import {
  AssistantError,
  chatRequestSchema,
} from "@/domains/assistant/contracts";
import {
  buildToolContext,
  resolveAssistantProvider,
} from "@/domains/assistant/runtime";
import { availableTools, toolPermissions } from "@/domains/assistant/tools";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { inspectAiEnv } from "@/lib/env/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

/**
 * One chat turn. The session decides who is asking; `assistant.use` decides
 * whether they may ask at all; every tool the model calls re-checks the
 * permission of the data it reads. Nothing in the request body is trusted
 * for identity or role, and the answer carries the provider that produced
 * it so a scripted answer can never pass for a live one.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function errorResponse(status: number, code: string, extra?: object) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "INVALID_REQUEST");
  }
  const parsed = chatRequestSchema.safeParse(payload);
  if (!parsed.success) return errorResponse(400, "INVALID_REQUEST");

  const requestId = globalThis.crypto.randomUUID();
  let access;
  try {
    access = await requirePermission("assistant.use", { requestId });
  } catch (error) {
    if (error instanceof ContentAccessDeniedError) {
      if (error.code === "UNAUTHENTICATED")
        return errorResponse(401, "UNAUTHENTICATED");
      if (error.code === "AUTH_NOT_CONFIGURED")
        return errorResponse(503, "NOT_CONFIGURED");
      return errorResponse(403, "FORBIDDEN");
    }
    return errorResponse(500, "UNAVAILABLE");
  }

  const limit = consumeRateLimit(`assistant:${access.userId}`, {
    limit: 20,
    windowMs: 5 * 60_000,
  });
  if (!limit.allowed) {
    return errorResponse(429, "RATE_LIMITED", {
      retryAfterMs: limit.retryAfterMs,
    });
  }

  const availability = resolveAssistantProvider();
  if (!availability.configured) {
    return errorResponse(503, "NOT_CONFIGURED", {
      missing: availability.missing,
    });
  }

  const started = Date.now();
  try {
    const [coverages, users] = await Promise.all([
      resolvePermissionCoverages(toolPermissions),
      mongoUserDirectory.findActiveUsers([access.userId]),
    ]);
    const user = users.get(access.userId);
    const tools = availableTools(coverages);
    const aiEnv = inspectAiEnv();
    const response = await runAssistantChat({
      provider: availability.provider,
      tools,
      toolContext: buildToolContext({
        userId: access.userId,
        locale: parsed.data.locale,
        requestId,
      }),
      principal: {
        displayName: user?.displayName ?? "staff",
        roleKeys: user?.roleKeys ?? [],
      },
      request: parsed.data,
      limits: aiEnv.configured
        ? {
            maxRounds: aiEnv.value.AI_MAX_TOOL_ROUNDS,
            requestTimeoutMs: aiEnv.value.AI_REQUEST_TIMEOUT_MS,
          }
        : {},
    });

    try {
      await mongoAuditRepository.append({
        actor: { type: "user", userId: access.userId },
        action: "assistant.chat",
        resourceType: "assistant",
        resourceId: null,
        requestId,
        metadata: {
          provider: response.provider,
          tools: response.trace.map((entry) => ({
            tool: entry.tool,
            ok: entry.ok,
            code: entry.code,
          })),
          proposalIds: response.proposals.map((proposal) => proposal.id),
          usage: response.usage,
          truncated: response.truncated,
          messageLength: parsed.data.message.length,
          durationMs: Date.now() - started,
        },
        occurredAt: new Date(),
      });
    } catch {
      // The answer is still returned when audit storage is unavailable.
    }

    return NextResponse.json(response, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AssistantError) {
      const status =
        error.code === "PROVIDER_TIMEOUT"
          ? 504
          : error.code === "RATE_LIMITED"
            ? 429
            : error.code === "NOT_CONFIGURED"
              ? 503
              : 502;
      return errorResponse(status, error.code);
    }
    console.error("[assistant] chat failed", requestId, error);
    return errorResponse(500, "UNAVAILABLE");
  }
}
