/**
 * Idempotent development seed.
 *
 * Running it twice must leave the database in the same state as running it
 * once. It provisions the platform's fixed reference data — role definitions
 * and business units — and, only when explicitly asked, clearly labelled demo
 * records.
 *
 * It never creates a user, a password, a token, or any secret. The first
 * administrator is bootstrapped through `ADMIN_EMAILS` at sign-in, not here.
 *
 *   npm run seed -- --dry-run     validate the seed data without a database
 *   npm run seed                  provision reference data
 *   npm run seed -- --with-demo   also insert DEMO-labelled business units
 */

import {
  getBusinessUnitModel,
  getRoleDefinitionModel,
} from "@/domains/identity/models";
import { isPermission } from "@/domains/identity/permissions";
import { roleDefinitionSeeds } from "@/domains/identity/role-definitions";
import { connectToDatabase } from "@/lib/db/mongoose";
import { locales } from "@/lib/i18n/config";

type SeedOptions = {
  dryRun: boolean;
  withDemo: boolean;
};

function parseOptions(argv: readonly string[]): SeedOptions {
  return {
    dryRun: argv.includes("--dry-run"),
    withDemo: argv.includes("--with-demo"),
  };
}

/**
 * Production business units are created by an administrator, not seeded. These
 * exist so a developer has somewhere to hang scoped grants, and every one is
 * labelled so it can never be mistaken for a real site.
 */
const demoBusinessUnits = [
  { code: "DEMO-HQ", name: "DEMO — Head office", type: "office" },
  { code: "DEMO-FACTORY-1", name: "DEMO — Main factory", type: "factory" },
  { code: "DEMO-WORKSHOP-1", name: "DEMO — Sub-workshop 1", type: "workshop" },
  { code: "DEMO-WORKSHOP-2", name: "DEMO — Sub-workshop 2", type: "workshop" },
  {
    code: "DEMO-WAREHOUSE-1",
    name: "DEMO — Main warehouse",
    type: "warehouse",
  },
] as const;

/** Fails fast on a malformed seed before any write is attempted. */
function validateSeedData(): void {
  const problems: string[] = [];

  for (const seed of roleDefinitionSeeds) {
    if (seed.permissions.length === 0) {
      problems.push(`Role ${seed.key} grants no permissions.`);
    }

    for (const { permission } of seed.permissions) {
      if (!isPermission(permission)) {
        problems.push(
          `Role ${seed.key} names unknown permission ${permission}.`,
        );
      }
    }

    const seen = new Set<string>();
    for (const { permission, scope } of seed.permissions) {
      const key = `${permission}:${scope}`;
      if (seen.has(key)) {
        problems.push(`Role ${seed.key} repeats ${key}.`);
      }
      seen.add(key);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Seed data is invalid:\n- ${problems.join("\n- ")}`);
  }
}

async function seedRoleDefinitions(): Promise<void> {
  const model = getRoleDefinitionModel();

  for (const seed of roleDefinitionSeeds) {
    // `key` is immutable, so an existing role is updated in place rather than
    // recreated. Labels and permissions are the parts that legitimately evolve.
    await model.updateOne(
      { key: seed.key },
      {
        $set: {
          labels: locales.map((locale) => ({
            locale,
            label: locale === "vi" ? seed.labels.vi : seed.labels.en,
          })),
          permissions: seed.permissions.map(({ permission, scope }) => ({
            permission,
            scope,
          })),
          system: true,
          active: true,
        },
        $setOnInsert: { key: seed.key },
      },
      { upsert: true },
    );
  }

  console.info(`Provisioned ${roleDefinitionSeeds.length} role definitions.`);
}

async function seedDemoBusinessUnits(): Promise<void> {
  const model = getBusinessUnitModel();

  for (const unit of demoBusinessUnits) {
    await model.updateOne(
      { code: unit.code },
      {
        $set: { name: unit.name, type: unit.type, status: "active" },
        $setOnInsert: { code: unit.code },
      },
      { upsert: true },
    );
  }

  console.info(`Provisioned ${demoBusinessUnits.length} DEMO business units.`);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));

  validateSeedData();
  console.info(
    `Seed data validated: ${roleDefinitionSeeds.length} roles, ` +
      `${roleDefinitionSeeds.reduce((total, seed) => total + seed.permissions.length, 0)} grants.`,
  );

  if (options.dryRun) {
    console.info("Dry run requested; no database connection was opened.");
    return;
  }

  await connectToDatabase();
  await seedRoleDefinitions();

  if (options.withDemo) {
    await seedDemoBusinessUnits();
  } else {
    console.info(
      "Skipped DEMO business units. Pass --with-demo to insert them.",
    );
  }

  console.info("Seed complete.");
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
