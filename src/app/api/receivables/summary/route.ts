import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json } from "@/domains/receivables/http";
import { readSummary } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tổng hợp công nợ: one row per customer (q, from, to, state, movement, sort). */
export async function GET(request: Request) {
  try {
    await requireReceivablesAccess("read");
    return json(await readSummary(new URL(request.url).searchParams));
  } catch (error) {
    return failure(error);
  }
}
