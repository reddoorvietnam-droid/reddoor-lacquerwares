import {
  hasSalesSlipAccess,
  requireSalesSlipAccess,
  salesSlipCapabilities,
} from "@/domains/sales-slips/access";
import { redactPrices } from "@/domains/sales-slips/contracts";
import { failure, json, readJsonBody } from "@/domains/sales-slips/http";
import {
  createSlip,
  listCreators,
  listSlips,
  peopleNames,
  readMasters,
} from "@/domains/sales-slips/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET ?masters=1` → catalogue + capabilities; `GET ?creators=1`; otherwise the list. */
export async function GET(request: Request) {
  try {
    await requireSalesSlipAccess("read");
    const params = new URL(request.url).searchParams;
    if (params.get("masters") === "1") {
      const [masters, capabilities] = await Promise.all([
        readMasters(),
        salesSlipCapabilities(),
      ]);
      // The catalogue price is money: only a `readPrice` holder receives it.
      return json({
        ...masters,
        items: capabilities.readPrice
          ? masters.items
          : masters.items.map((item) => ({ ...item, salePrice: null })),
        capabilities,
      });
    }
    if (params.get("creators") === "1")
      return json({ creators: await listCreators() });
    return json(await listSlips(params, await hasSalesSlipAccess("readPrice")));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSalesSlipAccess("create");
    const body = await readJsonBody(request);
    const [canEditPrice, canReadPrice] = await Promise.all([
      hasSalesSlipAccess("editPrice"),
      hasSalesSlipAccess("readPrice"),
    ]);
    const slip = await createSlip(body, access.userId, { canEditPrice });
    return json(
      {
        slip: canReadPrice ? slip : redactPrices(slip),
        people: await peopleNames([slip.createdBy, slip.updatedBy]),
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
