/**
 * Point-in-time export of the operational collections.
 *
 * This is a developer and pre-migration safety net, not a substitute for
 * MongoDB Atlas backups. It writes newline-delimited JSON per collection into
 * `backups/<timestamp>/`, a directory that is git-ignored so an export can
 * never be committed.
 *
 *   npm run backup                    export every known collection
 *   npm run backup -- --out ./tmp     choose the destination directory
 *
 * Sensitive identity fields are redacted on the way out: an export is a file on
 * a laptop, and it should not be the weakest link holding the data.
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { connectToDatabase } from "@/lib/db/mongoose";

const exportedCollections = [
  "users",
  "roledefinitions",
  "accessgrants",
  "businessunits",
  "auditevents",
  "contententries",
  "sitesettings",
] as const;

/** Identity fields that must not leave the database in a plain export. */
const redactedFields = new Set([
  "googleSubject",
  "avatarUrl",
  "email",
  "normalizedEmail",
]);

function redact(document: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(document).map(([key, value]) => [
      key,
      redactedFields.has(key) ? "[redacted]" : value,
    ]),
  );
}

function parseOutDirectory(argv: readonly string[]): string {
  const index = argv.indexOf("--out");
  const supplied = index === -1 ? undefined : argv[index + 1];
  return supplied ?? "backups";
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.resolve(parseOutDirectory(argv), stamp);

  const mongoose = await connectToDatabase();
  const database = mongoose.connection.db;

  if (!database) {
    throw new Error("The database handle was not available after connecting.");
  }

  await mkdir(destination, { recursive: true });

  let total = 0;
  for (const name of exportedCollections) {
    const cursor = database.collection(name).find({});
    const file = path.join(destination, `${name}.ndjson`);
    let count = 0;

    // Streamed rather than buffered so a large collection cannot exhaust memory.
    const lines = Readable.from(
      (async function* generate() {
        for await (const document of cursor) {
          count += 1;
          yield `${JSON.stringify(redact(document))}\n`;
        }
      })(),
    );

    await pipeline(lines, createWriteStream(file, { encoding: "utf8" }));
    total += count;
    console.info(`${name}: ${count} documents`);
  }

  console.info(`Exported ${total} documents to ${destination}.`);
  console.info(
    "This export is git-ignored. Treat it as sensitive and delete it when done.",
  );
}

main()
  .then(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
