import { z } from "zod";
import { requireMaterialsAccess } from "@/domains/materials/access";
import { idSchema } from "@/domains/materials/contracts";
import { failure, json } from "@/domains/materials/http";
import { readMaterialDetail } from "@/domains/materials/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const offsetSchema = z.coerce.number().int().min(0).max(10_000_000);

/** One material: balance, timeline page (offset) and recent audit history. */
export async function GET(request: Request) {
  try {
    await requireMaterialsAccess("read");
    const params = new URL(request.url).searchParams;
    const id = idSchema.parse(params.get("id"));
    const offset = offsetSchema.parse(params.get("offset") ?? 0);
    return json(await readMaterialDetail(id, offset));
  } catch (error) {
    return failure(error);
  }
}
