import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json } from "@/domains/receivables/http";
import { idSchema } from "@/domains/receivables/contracts";
import { readCustomerDetail } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sổ chi tiết công nợ của một khách, kèm số dư sau từng giao dịch. */
export async function GET(
  request: Request,
  context: { params: Promise<{ customerId: string }> },
) {
  try {
    await requireReceivablesAccess("read");
    const { customerId } = await context.params;
    return json(
      await readCustomerDetail(
        idSchema.parse(customerId),
        new URL(request.url).searchParams,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
