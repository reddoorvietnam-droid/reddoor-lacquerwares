import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json, readJsonBody } from "@/domains/receivables/http";
import { readLookups, saveCustomer } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireReceivablesAccess("read");
    const { customers } = await readLookups();
    return json({ customers });
  } catch (error) {
    return failure(error);
  }
}

/** Creates or updates one customer in the debt master. */
export async function POST(request: Request) {
  try {
    const access = await requireReceivablesAccess("manageCustomer");
    const body = await readJsonBody(request);
    return json({ customer: await saveCustomer(body, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
