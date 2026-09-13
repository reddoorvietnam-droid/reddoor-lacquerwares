// Opens and closes the admin E2E role sessions. Sign-in is Gmail only, so a
// test cannot press a role button: instead this provisions one internal
// account per role and mints the session cookie a Google sign-in would have
// left, signed with this checkout's AUTH_SECRET. Every request still runs
// through the real JWT callback, permission guard and audit trail.
//
//   npx tsx --env-file-if-exists=.env --conditions=react-server tests/e2e-admin/role-sessions.ts open|close
//
// `open` activates the accounts and writes the cookies; `close` locks the
// accounts again (bumping `authzVersion`, which voids every minted cookie), so
// between runs no test account can sign in or be assigned work.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import mongoose from "mongoose";
import { encode } from "next-auth/jwt";

import {
  getAccessGrantModel,
  getRoleDefinitionModel,
  getUserModel,
} from "../../src/domains/identity/models";
import { roleDefinitionSeeds } from "../../src/domains/identity/role-definitions";
import { connectToDatabase } from "../../src/lib/db/mongoose";
import {
  e2eAccountDomain,
  e2eRoleKeys,
  roleSessionFile,
  type RoleKey,
} from "./role-session-file";

// Short-lived on purpose: a run killed before its teardown leaves cookies that
// expire within hours. Run `close` to lock the accounts at once.
const sessionMaxAge = 3 * 60 * 60;
const accountPattern = new RegExp(
  `@${e2eAccountDomain.replaceAll(".", "\\.")}$`,
);

async function open(): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  const User = getUserModel();
  const AccessGrant = getAccessGrantModel();
  const now = new Date();
  const tokens = {} as Record<RoleKey, string>;

  for (const roleKey of e2eRoleKeys) {
    const seed = roleDefinitionSeeds.find((entry) => entry.key === roleKey);
    const role = await getRoleDefinitionModel()
      .findOne({ key: roleKey, active: true })
      .select("_id")
      .lean()
      .exec();
    if (!seed || !role) {
      throw new Error(
        `Role ${roleKey} is not in the database; run npm run seed first.`,
      );
    }

    const email = `${roleKey.toLowerCase()}@${e2eAccountDomain}`;
    const user = await User.findOneAndUpdate(
      { normalizedEmail: email },
      {
        $set: { status: "active", displayName: `${seed.labels.vi} (E2E)` },
        $unset: { suspendedAt: 1, suspendedBy: 1, suspensionReason: 1 },
        $setOnInsert: { email, normalizedEmail: email, authzVersion: 1 },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).exec();

    // Exactly one global grant on the role, like an account the Director
    // approved on the staff list.
    await AccessGrant.updateMany(
      {
        userId: user._id,
        status: "active",
        $or: [{ roleKey: { $ne: roleKey } }, { businessUnitId: { $ne: null } }],
      },
      { $set: { status: "revoked" } },
    ).exec();
    const grant = await AccessGrant.findOne({
      userId: user._id,
      roleKey,
      businessUnitId: null,
    })
      .select("_id")
      .exec();
    if (grant) {
      await AccessGrant.updateOne(
        { _id: grant._id },
        { $set: { status: "active" }, $unset: { expiresAt: 1 } },
      ).exec();
    } else {
      await AccessGrant.create({
        userId: user._id,
        roleKey,
        businessUnitId: null,
        status: "active",
        grantedBy: user._id,
        grantedAt: now,
      });
    }

    const id = user._id.toHexString();
    tokens[roleKey] = await encode({
      secret,
      maxAge: sessionMaxAge,
      token: {
        sub: id,
        userId: id,
        userStatus: "active",
        authzVersion: user.authzVersion,
      },
    });
  }

  mkdirSync(dirname(roleSessionFile), { recursive: true });
  writeFileSync(roleSessionFile, JSON.stringify(tokens, null, 2));
  console.log(`Opened ${e2eRoleKeys.length} E2E role sessions.`);
}

async function close(): Promise<void> {
  const locked = await getUserModel()
    .updateMany(
      { normalizedEmail: accountPattern, status: { $ne: "suspended" } },
      {
        $set: {
          status: "suspended",
          suspendedAt: new Date(),
          suspensionReason: "E2E run finished.",
        },
        $inc: { authzVersion: 1 },
      },
    )
    .exec();
  rmSync(roleSessionFile, { force: true });
  console.log(`Closed ${locked.modifiedCount} E2E role sessions.`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "open" && mode !== "close") {
    throw new Error("Usage: role-sessions.ts open|close");
  }
  await connectToDatabase();
  try {
    await (mode === "open" ? open() : close());
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
