import { NextResponse } from "next/server";

/**
 * The development-only flipbook preview route must answer production requests
 * with a genuine 404 status. The page already renders nothing in production,
 * but it sits under a streaming boundary: by the time its `notFound()` runs,
 * the 200 and the loading shell are already on the wire. The proxy executes
 * before rendering starts, so it is the one place the status can still be set.
 *
 * The in-page production guard stays as defence in depth; this matcher is the
 * only path the proxy touches.
 */
export function proxy() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:locale/collections/preview",
};
