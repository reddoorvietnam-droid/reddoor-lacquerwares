import mongoose from "mongoose";
import { connectToDatabase } from "../../src/lib/db/mongoose";

/**
 * Removes anything `tests/e2e-admin/receivables.spec.ts` left in the real debt
 * book. The spec writes into the live collections, so a failed run must not be
 * allowed to leave a posted entry behind and shift a customer's balance.
 *
 * Only entries the spec itself marks are touched: `MANUAL` entries written by
 * the web whose description carries the E2E marker. A migrated line has
 * `sourceType: "MIGRATION"` and can never match.
 */

const MARKER = /E2E kiểm thử|probe-/;

async function main() {
  await connectToDatabase();
  const entries = mongoose.connection.db!.collection("receivableentries");
  const doomed = await entries
    .find({
      sourceType: "WEB",
      referenceType: "MANUAL",
      $or: [
        { description: { $regex: MARKER.source } },
        { note: { $regex: MARKER.source } },
        // A multi-item sale carries the marker on the document number, since
        // its lines keep the ordinary "xuất kho" description.
        { documentNumber: { $regex: MARKER.source } },
      ],
    })
    .toArray();

  if (doomed.length === 0) {
    console.info("No E2E receivable entries to remove.");
  } else {
    const result = await entries.deleteMany({
      _id: { $in: doomed.map((row) => row._id) },
    });
    console.info(
      `Removed ${result.deletedCount} E2E receivable entries: ${doomed
        .map((row) => `${row.customerCode}/${row.status}`)
        .join(", ")}`,
    );
  }
  // The catalogue is shared with Bảng xuất kho sơn and Hóa đơn bán hàng, so a
  // test code left behind would show up in both. Only the E2E prefix is touched.
  const catalogue = mongoose.connection.db!.collection("paintwarehousemasters");
  const codes = await catalogue
    .find({ kind: "material", key: { $regex: "^e2e-son-" } })
    .toArray();
  if (codes.length) {
    await catalogue.deleteMany({ _id: { $in: codes.map((row) => row._id) } });
    console.info(
      `Removed ${codes.length} E2E catalogue codes: ${codes
        .map((row) => String(row.code))
        .join(", ")}`,
    );
  } else {
    console.info("No E2E catalogue codes to remove.");
  }

  await mongoose.disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
