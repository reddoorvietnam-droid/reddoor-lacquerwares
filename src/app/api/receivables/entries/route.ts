import { requireReceivablesAccess } from "@/domains/receivables/access";
import { failure, json, readJsonBody } from "@/domains/receivables/http";
import {
  listEntries,
  recordReduction,
  recordSale,
  recordSaleBatch,
  updateEntry,
} from "@/domains/receivables/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Phát sinh bán hàng / Thanh toán: the ledger lists behind the two columns. */
export async function GET(request: Request) {
  try {
    await requireReceivablesAccess("read");
    return json(await listEntries(new URL(request.url).searchParams));
  } catch (error) {
    return failure(error);
  }
}

/**
 * Writes an entry. The kind is in the body, and each kind is guarded by its own
 * permission — a reader who may record a payment cannot thereby record a sale.
 *
 *   kind: "sale"      one item
 *   kind: "saleBatch" one customer, one date, many items — the usual case
 *   anything else     a reduction
 *
 * `idempotencyKey` makes a retry return what the first attempt wrote rather
 * than a second copy of it.
 */
export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const { kind, ...input } = body ?? {};
    if (kind === "saleBatch") {
      const access = await requireReceivablesAccess("recordSale");
      return json(
        { entries: await recordSaleBatch(input, access.userId) },
        201,
      );
    }
    if (kind === "sale") {
      const access = await requireReceivablesAccess("recordSale");
      return json({ entry: await recordSale(input, access.userId) }, 201);
    }
    const access = await requireReceivablesAccess("recordReduction");
    return json({ entry: await recordReduction(input, access.userId) }, 201);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Corrects a recorded line in place. Guarded by its own permission, so a role
 * could be allowed to write the book without being allowed to rewrite it; the
 * service records every changed field, the actor and the reason.
 */
export async function PATCH(request: Request) {
  try {
    const access = await requireReceivablesAccess("updateEntry");
    const body = await readJsonBody(request);
    return json({ entry: await updateEntry(body, access.userId) });
  } catch (error) {
    return failure(error);
  }
}
