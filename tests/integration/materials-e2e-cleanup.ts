/**
 * Removes everything the materials E2E walk-throughs create (`E2E-UI-*`
 * materials and their lines). Audit events stay (append-only).
 *
 *   npx tsx --env-file-if-exists=.env --conditions=react-server tests/integration/materials-e2e-cleanup.ts
 */
import { connectToDatabase } from "../../src/lib/db/mongoose";
import {
  getFacilityModel,
  getMaterialModel,
  getMaterialTransactionModel,
} from "../../src/domains/materials/models";

async function main() {
  const db = await connectToDatabase();
  const materials = await getMaterialModel()
    .find({ code: /^E2E-/ })
    .select("_id code")
    .lean<{ _id: string; code: string }[]>()
    .exec();
  const ids = materials.map((m) => m._id);
  const lines = await getMaterialTransactionModel().deleteMany({
    materialId: { $in: ids },
  });
  const removed = await getMaterialModel().deleteMany({ _id: { $in: ids } });
  const facilities = await getFacilityModel().deleteMany({ code: /^E2E-/ });
  console.info(
    `removed ${removed.deletedCount} materials (${materials.map((m) => m.code).join(", ") || "none"}), ${lines.deletedCount} lines, ${facilities.deletedCount} facilities`,
  );
  await db.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
