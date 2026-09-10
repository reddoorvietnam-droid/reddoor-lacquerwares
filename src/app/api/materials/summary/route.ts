import { requireMaterialsAccess } from "@/domains/materials/access";
import { failure, json } from "@/domains/materials/http";
import { readSummary } from "@/domains/materials/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tổng kho: balances per material (q, unit, state, includeInactive). */
export async function GET(request: Request) {
  try {
    await requireMaterialsAccess("read");
    return json(await readSummary(new URL(request.url).searchParams));
  } catch (error) {
    return failure(error);
  }
}
