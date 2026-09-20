// Files a fake customer label spec on one SOP walk-through order, so the
// spec can leave step 7 without a real Cloudinary upload. Touches only an
// order whose code carries the walk-through prefix; the cleanup script
// removes the whole order afterwards.
//
//   npx tsx --env-file-if-exists=.env --conditions=react-server \
//     tests/e2e-admin/order-sop-fixture.ts <ORDER-CODE>
import { Types } from "mongoose";

import { getSalesOrderModel } from "../../src/domains/orders/persistence/models";
import { connectToDatabase } from "../../src/lib/db/mongoose";

import { sopOrderCodePrefix } from "./order-sop-cleanup";

export async function fileCustomerLabelSpec(orderCode: string): Promise<void> {
  const code = orderCode.trim().toUpperCase();
  if (!code.startsWith(sopOrderCodePrefix)) {
    throw new Error(`Refusing to touch ${code}: not a walk-through order.`);
  }

  const orders = getSalesOrderModel();
  const order = await orders
    .findOne({ orderCode: code })
    .select("_id createdBy")
    .lean<{ _id: Types.ObjectId; createdBy: Types.ObjectId }>()
    .exec();
  if (!order) throw new Error(`Order ${code} not found.`);

  await orders.updateOne(
    { _id: order._id },
    {
      $push: {
        documents: {
          _id: new Types.ObjectId(),
          kind: "customerLabelSpec",
          publicId: "e2e/order-sop/customer-label-spec",
          assetVersion: 1,
          format: "pdf",
          bytes: 1024,
          label: "E2E mẫu tem khách.pdf",
          uploadedBy: order.createdBy,
          uploadedAt: new Date(),
        },
      },
      $inc: { revision: 1 },
    },
  );
}

async function main() {
  const orderCode = process.argv[2];
  if (!orderCode) throw new Error("Pass the order code.");
  const db = await connectToDatabase();
  try {
    await fileCustomerLabelSpec(orderCode);
    console.info(`Filed a customer label spec on ${orderCode}.`);
  } finally {
    await db.disconnect();
  }
}

if (process.argv[1]?.includes("order-sop-fixture"))
  void main().catch((error) => {
    console.error("SOP order fixture failed.", error);
    process.exitCode = 1;
  });
