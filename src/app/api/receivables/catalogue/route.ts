import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json, readJsonBody } from "@/domains/receivables/http";
import { readLookups, saveCatalogueItem } from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireReceivablesAccess("read");
    const { items } = await readLookups();
    return json({ items });
  } catch (error) {
    return failure(error);
  }
}

/**
 * Adds a paint code or reprices one, straight from the counter — new codes
 * appear every week, so the catalogue is not a fixed list.
 *
 * It writes the shared paint catalogue that `Bảng xuất kho sơn` and
 * `Hóa đơn bán hàng` also read, so a code added here exists everywhere it
 * should. A new price is only a default for the next sale: every debt already
 * recorded keeps the price snapshotted on its own line.
 */
export async function POST(request: Request) {
  try {
    const access = await requireReceivablesAccess("manageCatalog");
    const body = await readJsonBody(request);
    return json({ item: await saveCatalogueItem(body, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
