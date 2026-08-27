import "server-only";

import { Types } from "mongoose";

import {
  getAccessGrantModel,
  getRoleDefinitionModel,
  getUserModel,
} from "@/domains/identity/models";
import {
  roleDefinitionSeeds,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Local role-preview accounts, active only while `DEV_LOGIN_PASSWORD` is set.
 *
 * Their purpose is to let the working group walk the admin portal as each of
 * the twelve seeded roles before Google sign-in and grant administration
 * exist. They are NOT a parallel authentication system: signing in provisions
 * a real user document and a real access grant, and every later check runs
 * through the same repository, guard, and audit path a Google account will
 * use. Faking the session instead would demonstrate a portal that no real
 * account could reproduce.
 *
 * One account per role, named by the role key, plus `admin` as the requested
 * alias for the Director. Each account's email is derived from its username,
 * so re-signing-in reuses the same user instead of accumulating documents.
 */

export type DevPreviewAccount = {
  username: string;
  roleKey: SystemRoleKey;
  labels: { vi: string; en: string };
  summary: { vi: string; en: string };
};

function accountFor(roleKey: SystemRoleKey): DevPreviewAccount {
  const seed = roleDefinitionSeeds.find((entry) => entry.key === roleKey);
  if (!seed) {
    throw new Error(`Unknown role seed: ${roleKey}`);
  }

  return {
    username: roleKey.toLowerCase(),
    roleKey,
    labels: seed.labels,
    summary: seed.summary,
  };
}

export const devPreviewAccounts: readonly DevPreviewAccount[] = [
  { ...accountFor("DIRECTOR"), username: "admin" },
  ...roleDefinitionSeeds
    .filter((seed) => seed.key !== "DIRECTOR")
    .map((seed) => accountFor(seed.key)),
];

export function findDevPreviewAccount(
  username: string,
): DevPreviewAccount | null {
  const normalized = username.trim().toLowerCase();
  return (
    devPreviewAccounts.find((account) => account.username === normalized) ??
    null
  );
}

function emailForAccount(account: DevPreviewAccount): string {
  return `${account.username}@dev-preview.reddoor.local`;
}

/**
 * Idempotently provisions the user and grant behind a preview account and
 * returns the email the normal JWT callback will resolve the identity by.
 */
export async function provisionDevPreviewIdentity(
  account: DevPreviewAccount,
  occurredAt: Date,
): Promise<{ userId: string; email: string }> {
  await connectToDatabase();

  const email = emailForAccount(account);
  const seed = roleDefinitionSeeds.find(
    (entry) => entry.key === account.roleKey,
  );
  if (!seed) {
    throw new Error(`Unknown role seed: ${account.roleKey}`);
  }

  // The role definition normally comes from `npm run seed`; upserting it here
  // keeps a preview sign-in working on a database the seed has not reached,
  // without overwriting anything an administrator may have edited since.
  await getRoleDefinitionModel()
    .findOneAndUpdate(
      { key: seed.key },
      {
        $setOnInsert: {
          key: seed.key,
          labels: [
            { locale: "vi", label: seed.labels.vi },
            { locale: "en", label: seed.labels.en },
          ],
          permissions: seed.permissions,
          system: true,
          active: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
    .exec();

  const User = getUserModel();
  const user = await User.findOneAndUpdate(
    { normalizedEmail: email },
    {
      $set: {
        status: "active",
        displayName: `${seed.labels.vi} (dev preview)`,
        lastLoginAt: occurredAt,
      },
      $setOnInsert: {
        email,
        normalizedEmail: email,
        authzVersion: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  const AccessGrant = getAccessGrantModel();
  const existingGrant = await AccessGrant.findOne({
    userId: user._id,
    roleKey: account.roleKey,
    status: "active",
  })
    .select("_id")
    .exec();

  if (!existingGrant) {
    await AccessGrant.create({
      userId: user._id,
      roleKey: account.roleKey,
      businessUnitId: null,
      status: "active",
      grantedBy: user._id as Types.ObjectId,
      grantedAt: occurredAt,
    });
    await User.updateOne({ _id: user._id }, { $inc: { authzVersion: 1 } });
  }

  return { userId: user._id.toHexString(), email };
}
