import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import { getAuthConfiguration } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

function setupRequiredResponse(): Response {
  return Response.json(
    {
      error: "AUTH_NOT_CONFIGURED",
      message: "Authentication is not configured for this deployment.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

async function handler(
  request: NextRequest,
  context: AuthRouteContext,
): Promise<Response> {
  const configuration = getAuthConfiguration();

  if (!configuration.configured) {
    return setupRequiredResponse();
  }

  return NextAuth(configuration.options)(request, context) as Promise<Response>;
}

export { handler as GET, handler as POST };
