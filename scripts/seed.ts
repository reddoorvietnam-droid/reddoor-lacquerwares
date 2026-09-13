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
  getAccessGrantModel,
  getBusinessUnitModel,
  getRoleDefinitionModel,
  getUserModel,
} from "@/domains/identity/models";
import { isPermission } from "@/domains/identity/permissions";
import {
  retiredRoleReplacements,
  retiredSystemRoleKeys,
  roleDefinitionSeeds,
  type RetiredSystemRoleKey,
} from "@/domains/identity/role-definitions";
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

/**
 * Retired roles were merged into a surviving role (see
 * `retiredRoleReplacements`). Their definitions are deactivated and every
 * grant they still carry is replaced by an equivalent grant on the surviving
 * role, so a database seeded before a merge keeps working without a manual
 * migration.
 */
async function retireMergedRoles(): Promise<void> {
  const RoleDefinition = getRoleDefinitionModel();
  const AccessGrant = getAccessGrantModel();
  const User = getUserModel();

  const deactivated = await RoleDefinition.updateMany(
    { key: { $in: [...retiredSystemRoleKeys] }, active: true },
    { $set: { active: false } },
  );

  const retiredGrants = await AccessGrant.find({
    roleKey: { $in: [...retiredSystemRoleKeys] },
    status: "active",
  }).exec();

  for (const grant of retiredGrants) {
    const survivingRoleKey =
      retiredRoleReplacements[grant.roleKey as RetiredSystemRoleKey];
    const replacement = await AccessGrant.findOne({
      userId: grant.userId,
      roleKey: survivingRoleKey,
      businessUnitId: grant.businessUnitId,
    }).exec();

    if (!replacement) {
      await AccessGrant.create({
        userId: grant.userId,
        roleKey: survivingRoleKey,
        businessUnitId: grant.businessUnitId,
        status: "active",
        grantedBy: grant.grantedBy,
        grantedAt: new Date(),
      });
    } else if (replacement.status !== "active") {
      await AccessGrant.updateOne(
        { _id: replacement._id },
        { $set: { status: "active" } },
      );
    }

    await AccessGrant.updateOne(
      { _id: grant._id },
      { $set: { status: "revoked" } },
    );
    await User.updateOne({ _id: grant.userId }, { $inc: { authzVersion: 1 } });
  }

  if (deactivated.modifiedCount > 0 || retiredGrants.length > 0) {
    console.info(
      `Retired merged roles: ${deactivated.modifiedCount} definitions deactivated, ` +
        `${retiredGrants.length} grants moved to their surviving roles.`,
    );
  }
}

/**
 * The one-click role preview was removed on 2026-09-13: sign-in is Gmail only.
 * Its accounts (`<role>@dev-preview.reddoor.local`) could still carry a live
 * session cookie, and several held the Director role. They are locked and
 * their grants revoked — kept rather than deleted, because tasks, reports and
 * audit events still name them.
 */
async function retireRolePreviewAccounts(): Promise<void> {
  const User = getUserModel();
  const AccessGrant = getAccessGrantModel();

  const accounts = await User.find({
    normalizedEmail: /@dev-preview\.reddoor\.local$/,
  })
    .select("_id")
    .exec();
  if (accounts.length === 0) return;

  const ids = accounts.map(({ _id }) => _id);
  const revoked = await AccessGrant.updateMany(
    { userId: { $in: ids }, status: "active" },
    { $set: { status: "revoked" } },
  );
  const locked = await User.updateMany(
    { _id: { $in: ids }, status: { $ne: "suspended" } },
    {
      $set: {
        status: "suspended",
        suspendedAt: new Date(),
        suspensionReason:
          "Role-preview sign-in removed; sign-in is Gmail only.",
      },
      $inc: { authzVersion: 1 },
    },
  );

  if (revoked.modifiedCount > 0 || locked.modifiedCount > 0) {
    console.info(
      `Retired role-preview accounts: ${locked.modifiedCount} locked, ` +
        `${revoked.modifiedCount} grants revoked.`,
    );
  }
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
  await retireMergedRoles();
  await retireRolePreviewAccounts();

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
