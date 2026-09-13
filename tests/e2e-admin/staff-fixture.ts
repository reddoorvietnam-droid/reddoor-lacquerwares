// Seeds and removes the accounts `staff.spec.ts` works on. The database
// modules import "server-only", so run it through tsx with the react-server
// condition:
//
//   npx tsx --env-file-if-exists=.env --conditions=react-server tests/e2e-admin/staff-fixture.ts seed|cleanup
//
// Only accounts matching `fixturePattern` are ever touched; never use a
// database-wide reset, because admin E2E runs against the configured DB.
import mongoose from "mongoose";
import { encode } from "next-auth/jwt";

import {
  getAccessGrantModel,
  getUserModel,
} from "../../src/domains/identity/models";
import { connectToDatabase } from "../../src/lib/db/mongoose";

const accounts = [
  { key: "a", email: "e2e-staff-a@example.test", name: "E2E Nhân sự A" },
  { key: "b", email: "e2e-staff-b@example.test", name: "E2E Nhân sự B" },
] as const;

const fixturePattern = /^e2e-staff-[a-z]+@example\.test$/;

async function cleanup(): Promise<number> {
  const users = await getUserModel()
    .find({ normalizedEmail: fixturePattern })
    .select("_id")
    .lean<{ _id: mongoose.Types.ObjectId }[]>()
    .exec();
  const ids = users.map(({ _id }) => _id);
  if (ids.length > 0) {
    await getAccessGrantModel()
      .deleteMany({ userId: { $in: ids } })
      .exec();
    await getUserModel()
      .deleteMany({ _id: { $in: ids } })
      .exec();
  }
  return ids.length;
}

/**
 * Creates each account the way a first Google sign-in does (pending, no
 * grant) and mints the session cookie that sign-in would have set. The JWT
 * callback re-reads the account on every request, so the cookie follows the
 * Director's decisions exactly like a real one.
 */
async function seed() {
  await cleanup();
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");

  const now = new Date();
  const result: Record<string, { id: string; email: string; token: string }> =
    {};
  for (const account of accounts) {
    const user = await getUserModel().create({
      email: account.email,
      normalizedEmail: account.email,
      googleSubject: `e2e-staff-${account.key}`,
      displayName: account.name,
      status: "pending",
      authzVersion: 1,
      lastLoginAt: now,
    });
    const id = user._id.toHexString();
    const token = await encode({
      secret,
      maxAge: 8 * 60 * 60,
      token: { sub: id, userId: id, userStatus: "pending", authzVersion: 1 },
    });
    result[account.key] = { id, email: account.email, token };
  }
  return result;
}

async function main() {
  const mode = process.argv[2];
  await connectToDatabase();
  try {
    if (mode === "seed") {
      console.log(JSON.stringify(await seed()));
    } else if (mode === "cleanup") {
      console.log(JSON.stringify({ removed: await cleanup() }));
    } else {
      throw new Error("Usage: staff-fixture.ts seed|cleanup");
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
