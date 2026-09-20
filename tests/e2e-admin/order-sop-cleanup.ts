// Removes only the orders the SOP walk-through creates, recognisable by their
// code prefix, and the approval requests raised on them. Never a database-wide
// reset: admin E2E runs against the developer's configured DB.
import { Types } from "mongoose";

import { getApprovalRequestModel } from "../../src/domains/approvals/model";
import { getSalesOrderModel } from "../../src/domains/orders/persistence/models";
import { connectToDatabase } from "../../src/lib/db/mongoose";

/** Every order the spec creates starts with this; nothing real does. */
export const sopOrderCodePrefix = "E2E-SOP-";

export async function removeSopOrders(): Promise<number> {
  const orders = getSalesOrderModel();
  const candidates = await orders
    .find({ orderCode: { $regex: `^${sopOrderCodePrefix}` } })
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>()
    .exec();
  const ids = candidates.map((order) => order._id);
  if (ids.length === 0) return 0;
  await getApprovalRequestModel().deleteMany({
    resourceType: "salesOrder",
    resourceId: { $in: ids.map((id) => id.toHexString()) },
  });
  await orders.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

async function main() {
  const db = await connectToDatabase();
  try {
    const removed = await removeSopOrders();
    console.info(`Removed ${removed} SOP walk-through order(s).`);
  } finally {
    await db.disconnect();
  }
}

if (process.argv[1]?.includes("order-sop-cleanup"))
  void main().catch((error) => {
    console.error("SOP order cleanup failed.", error);
    process.exitCode = 1;
  });
