import {
  hasSalesSlipAccess,
  requireSalesSlipAccess,
  salesSlipCapabilities,
} from "@/domains/sales-slips/access";
import { idSchema, redactPrices } from "@/domains/sales-slips/contracts";
import { failure, json, readJsonBody } from "@/domains/sales-slips/http";
import { readSlip, updateSlip } from "@/domains/sales-slips/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slipId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireSalesSlipAccess("read");
    const id = idSchema.parse((await context.params).slipId);
    const [canReadPrice, capabilities] = await Promise.all([
      hasSalesSlipAccess("readPrice"),
      salesSlipCapabilities(),
    ]);
    const { slip, people } = await readSlip(id, canReadPrice);
    // The service already projects; redacting again here keeps the route safe on its own.
    return json({
      slip: canReadPrice ? slip : redactPrices(slip),
      people,
      capabilities,
    });
  } catch (error) {
    return failure(error);
  }
}

/** Saves a draft (header + every line) conditionally on its version. */
export async function PATCH(request: Request, context: Context) {
  try {
    const access = await requireSalesSlipAccess("update");
    const id = idSchema.parse((await context.params).slipId);
    const body = await readJsonBody(request);
    const [canEditPrice, canReadPrice] = await Promise.all([
      hasSalesSlipAccess("editPrice"),
      hasSalesSlipAccess("readPrice"),
    ]);
    const slip = await updateSlip(id, body, access.userId, { canEditPrice });
    return json({ slip: canReadPrice ? slip : redactPrices(slip) });
  } catch (error) {
    return failure(error);
  }
}
