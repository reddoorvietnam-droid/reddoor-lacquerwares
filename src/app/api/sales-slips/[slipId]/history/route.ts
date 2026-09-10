import {
  hasSalesSlipAccess,
  requireSalesSlipAccess,
} from "@/domains/sales-slips/access";
import { idSchema } from "@/domains/sales-slips/contracts";
import { failure, json } from "@/domains/sales-slips/http";
import { readHistory } from "@/domains/sales-slips/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slipId: string }> };

/** The slip's audit trail; money lines are dropped for readers without `readPrice`. */
export async function GET(_request: Request, context: Context) {
  try {
    await requireSalesSlipAccess("read");
    const id = idSchema.parse((await context.params).slipId);
    return json({
      history: await readHistory(id, await hasSalesSlipAccess("readPrice")),
    });
  } catch (error) {
    return failure(error);
  }
}
