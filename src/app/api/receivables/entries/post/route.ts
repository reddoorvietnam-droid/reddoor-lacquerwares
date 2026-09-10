import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json, readJsonBody } from "@/domains/receivables/http";
import { postEntry } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ghi sổ một bản nháp. Guarded by the same permission that created it: a
 * draft sale needs `recordSale`, a draft reduction needs `recordReduction`,
 * and the service refuses anything that is not still a draft.
 */
export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const { kind, ...input } = body ?? {};
    const access = await requireReceivablesAccess(
      kind === "sale" ? "recordSale" : "recordReduction",
    );
    return json({ entry: await postEntry(input, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
