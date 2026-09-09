// Removes only this spec's explicitly named fixture reports. Never use a
// database-wide reset: admin E2E runs against the developer's configured DB.
import { connectToDatabase } from "../../src/lib/db/mongoose";
import {
  getSampleProgressArchiveModel,
  getSampleProgressModel,
} from "../../src/domains/sample-progress/models";
import { fixtureMarker, fixtureWeeks } from "./sample-progress-fixtures";

type StoredRow = { orderName?: unknown };
type StoredReport = { _id: string; rows?: StoredRow[] };

/** Deleting a week in the UI moves it here, so the fixtures land here too. */
async function removeArchivedFixtures(): Promise<number> {
  const model = getSampleProgressArchiveModel();
  const candidates = await model
    .find({ week: { $in: [...fixtureWeeks] } })
    .lean<(StoredReport & { _id: unknown })[]>()
    .exec();
  const ids = candidates.filter(isFixture).map((report) => report._id);
  if (ids.length) await model.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

/** Both narrowings must hold: a fixture week AND the marker in every row. */
function isFixture(report: { rows?: StoredRow[] }): boolean {
  return (
    Array.isArray(report.rows) &&
    report.rows.length > 0 &&
    report.rows.every(
      (row) =>
        typeof row.orderName === "string" &&
        row.orderName.startsWith(fixtureMarker),
    )
  );
}

export async function removeSampleProgressFixtures(): Promise<number> {
  const model = getSampleProgressModel();
  const candidates = await model
    .find({ week: { $in: [...fixtureWeeks] } })
    .lean<StoredReport[]>()
    .exec();
  // Two independent narrowings — the fixture weeks and the marker in every row
  // — so a real report can never be matched even if it shared a week.
  const fixtureIds = candidates.filter(isFixture).map((report) => report._id);
  if (fixtureIds.length) await model.deleteMany({ _id: { $in: fixtureIds } });
  return fixtureIds.length + (await removeArchivedFixtures());
}

async function main() {
  const db = await connectToDatabase();
  try {
    const removed = await removeSampleProgressFixtures();
    console.info(
      `Removed ${removed} sample-progress E2E fixture revisions from ${fixtureWeeks.join(", ")}.`,
    );
  } finally {
    await db.disconnect();
  }
}

// Only run when invoked directly, so the spec can import the constants above.
if (process.argv[1]?.includes("sample-progress-cleanup"))
  void main().catch(() => {
    console.error("Sample-progress fixture cleanup failed.");
    process.exitCode = 1;
  });
