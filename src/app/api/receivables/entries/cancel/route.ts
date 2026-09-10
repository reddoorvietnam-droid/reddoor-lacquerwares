import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json, readJsonBody } from "@/domains/receivables/http";
import { cancelEntry } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hủy giao dịch: status CANCELLED with a reason, never a hard delete. The
 * entry stays in the ledger and stops contributing, so the balance returns to
 * exactly what it was before it was posted.
 */
export async function POST(request: Request) {
  try {
    const access = await requireReceivablesAccess("cancelEntry");
    const body = await readJsonBody(request);
    return json({ entry: await cancelEntry(body, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
