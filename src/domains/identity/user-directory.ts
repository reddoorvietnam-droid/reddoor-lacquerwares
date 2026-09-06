import "server-only";

import { Types } from "mongoose";

import { getAccessGrantModel, getUserModel } from "@/domains/identity/models";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Read-only lookups of staff accounts for assignment and reminders.
 *
 * Only active users with an active grant are ever returned, so a task can
 * never be assigned to — or a reminder sent to — an account that cannot sign
 * in. Email is carried for the reminder channel only; callers that render a
 * user to other staff show `displayName`.
 */

export type UserSummary = {
  id: string;
  displayName: string;
  email: string;
  roleKeys: readonly string[];
};

export interface UserDirectory {
  findActiveUsers(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, UserSummary>>;
  listActiveUsersByRole(roleKey: SystemRoleKey): Promise<UserSummary[]>;
  listActiveUsers(): Promise<UserSummary[]>;
}

type UserRow = {
  _id: Types.ObjectId;
  email: string;
  displayName?: string | null;
  status: "pending" | "active" | "suspended";
};

type GrantRow = { userId: Types.ObjectId; roleKey: string };

function activeGrantFilter(now: Date) {
  return {
    status: "active" as const,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
}

function summarize(user: UserRow, grants: readonly GrantRow[]): UserSummary {
  const id = user._id.toHexString();
  return {
    id,
    displayName: user.displayName?.trim() || user.email,
    email: user.email,
    roleKeys: [
      ...new Set(
        grants
          .filter((grant) => grant.userId.toHexString() === id)
          .map((grant) => grant.roleKey),
      ),
    ],
  };
}

export class MongoUserDirectory implements UserDirectory {
  async findActiveUsers(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, UserSummary>> {
    const validIds = userIds.filter(Types.ObjectId.isValid);
    if (validIds.length === 0) return new Map();
    await connectToDatabase();

    const objectIds = validIds.map((id) => new Types.ObjectId(id));
    const now = new Date();
    const [users, grants] = await Promise.all([
      getUserModel()
        .find({ _id: { $in: objectIds }, status: "active" })
        .select("_id email displayName status")
        .lean<UserRow[]>()
        .exec(),
      getAccessGrantModel()
        .find({ userId: { $in: objectIds }, ...activeGrantFilter(now) })
        .select("userId roleKey")
        .lean<GrantRow[]>()
        .exec(),
    ]);

    const result = new Map<string, UserSummary>();
    for (const user of users) {
      const summary = summarize(user, grants);
      if (summary.roleKeys.length > 0) result.set(summary.id, summary);
    }
    return result;
  }

  async listActiveUsersByRole(roleKey: SystemRoleKey): Promise<UserSummary[]> {
    await connectToDatabase();
    const now = new Date();
    const grants = await getAccessGrantModel()
      .find({ roleKey, ...activeGrantFilter(now) })
      .select("userId roleKey")
      .lean<GrantRow[]>()
      .exec();
    if (grants.length === 0) return [];

    const users = await getUserModel()
      .find({
        _id: { $in: grants.map((grant) => grant.userId) },
        status: "active",
      })
      .select("_id email displayName status")
      .sort({ displayName: 1 })
      .lean<UserRow[]>()
      .exec();
    return users.map((user) => summarize(user, grants));
  }

  async listActiveUsers(): Promise<UserSummary[]> {
    await connectToDatabase();
    const now = new Date();
    const grants = await getAccessGrantModel()
      .find(activeGrantFilter(now))
      .select("userId roleKey")
      .lean<GrantRow[]>()
      .exec();
    if (grants.length === 0) return [];

    const users = await getUserModel()
      .find({
        _id: { $in: [...new Set(grants.map((grant) => grant.userId))] },
        status: "active",
      })
      .select("_id email displayName status")
      .sort({ displayName: 1 })
      .lean<UserRow[]>()
      .exec();
    return users
      .map((user) => summarize(user, grants))
      .filter((user) => user.roleKeys.length > 0);
  }
}

export const mongoUserDirectory = new MongoUserDirectory();
