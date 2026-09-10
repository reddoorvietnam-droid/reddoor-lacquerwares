import {
  hasSalesSlipAccess,
  requireSalesSlipAccess,
} from "@/domains/sales-slips/access";
import {
  idSchema,
  redactPrices,
  transitionSchema,
} from "@/domains/sales-slips/contracts";
import { failure, json, readJsonBody } from "@/domains/sales-slips/http";
import { transitionSlip } from "@/domains/sales-slips/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slipId: string }> };

/** confirm / reopen need `confirm`; cancel needs `cancel`. Checked before any write. */
export async function POST(request: Request, context: Context) {
  try {
    await requireSalesSlipAccess("read");
    const id = idSchema.parse((await context.params).slipId);
    const body = transitionSchema.parse(await readJsonBody(request));
    const access = await requireSalesSlipAccess(
      body.action === "cancel" ? "cancel" : "confirm",
    );
    const slip = await transitionSlip(id, body, access.userId);
    return json({
      slip: (await hasSalesSlipAccess("readPrice")) ? slip : redactPrices(slip),
    });
  } catch (error) {
    return failure(error);
  }
}
