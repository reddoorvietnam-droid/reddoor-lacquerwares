import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json, readJsonBody } from "@/domains/receivables/http";
import { setOpeningBalance } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Restates one customer's `Dư đầu kỳ`. Held by the accountant and the Director
 * only, and every change records the before, the after and the reason — an
 * opening balance is the one figure nobody can derive from a transaction.
 */
export async function POST(request: Request) {
  try {
    const access = await requireReceivablesAccess("updateOpeningBalance");
    const body = await readJsonBody(request);
    return json({ entry: await setOpeningBalance(body, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
