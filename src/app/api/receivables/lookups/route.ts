import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json } from "@/domains/receivables/http";
import { readLookups } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customers, the paint catalogue and this session's capabilities. */
export async function GET() {
  try {
    await requireReceivablesAccess("read");
    return json(await readLookups());
  } catch (error) {
    return failure(error);
  }
}
