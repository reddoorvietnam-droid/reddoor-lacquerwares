import { z } from "zod";
import { requireMaterialsAccess } from "@/domains/materials/access";
import { failure, json } from "@/domains/materials/http";
import { readWarehouseHistory } from "@/domains/materials/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const offsetSchema = z.coerce.number().int().min(0).max(10_000_000);
const limitSchema = z.coerce.number().int().min(1).max(200);

/** Warehouse-wide audit page plus the counts shown in the page header. */
export async function GET(request: Request) {
  try {
    await requireMaterialsAccess("read");
    const params = new URL(request.url).searchParams;
    const offset = offsetSchema.parse(params.get("offset") ?? 0);
    const limit = limitSchema.parse(params.get("limit") ?? 50);
    return json(await readWarehouseHistory({ offset, limit }));
  } catch (error) {
    return failure(error);
  }
}
