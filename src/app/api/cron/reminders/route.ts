import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runScheduledReminderJob } from "@/domains/notifications/runtime";
import { inspectCronEnv } from "@/lib/env/server";

/**
 * The scheduled reminder run. Called by the platform scheduler (Vercel
 * Cron sends GET) or any external scheduler with the bearer secret. The
 * job is idempotent, so an overlapping or repeated call is harmless; the
 * response is the run's summary for the scheduler's logs.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Five minutes, the ceiling a Vercel Hobby project allows with fluid
 * compute. Being cut off is safe anyway: every intent is claimed atomically
 * and keyed by `dedupeKey`, so whatever a run does not reach is picked up
 * by the next one and nothing is ever sent twice.
 */
export const maxDuration = 300;

function authorized(request: Request): boolean | "unconfigured" {
  const env = inspectCronEnv();
  if (!env.configured) return "unconfigured";
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const expected = Buffer.from(env.value.CRON_SECRET);
  const actual = Buffer.from(presented);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handle(request: Request) {
  const auth = authorized(request);
  if (auth === "unconfigured") {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  if (!auth) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const summary = await runScheduledReminderJob({ trigger: "cron" });
    return NextResponse.json(summary, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[cron] reminders failed", error);
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
