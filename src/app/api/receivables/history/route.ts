import { z } from "zod";
import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json } from "@/domains/receivables/http";
import { readHistory } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const offsetSchema = z.coerce.number().int().min(0).max(10_000_000);
const limitSchema = z.coerce.number().int().min(1).max(200);

/** Nhật ký: who changed what, when and why. */
export async function GET(request: Request) {
  try {
    await requireReceivablesAccess("read");
    const params = new URL(request.url).searchParams;
    return json(
      await readHistory({
        offset: offsetSchema.parse(params.get("offset") ?? 0),
        limit: limitSchema.parse(params.get("limit") ?? 50),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
