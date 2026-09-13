import "server-only";

import { Types, type ClientSession } from "mongoose";

import { getAuditEventModel } from "@/domains/audit/model";
import { redactAuditValue } from "@/domains/audit/redaction";
import {
  getAccessGrantModel,
  getRoleDefinitionModel,
  getUserModel,
} from "@/domains/identity/models";
import {
  assertStaffCommand,
  internalAccountEmailPattern,
  StaffCommandError,
  type AssignableRoleKey,
  type StaffCommand,
  type StaffMember,
} from "@/domains/identity/staff-policy";
import type { AccessContext } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Reads and writes behind "Danh sách nhân sự". The rules live in
 * `staff-policy.ts`; this file only loads an account, runs them inside one
 * transaction, and applies the result with the account's status and
 * `authzVersion` as the write condition, so two Directors' tabs (or a stale
 * page) can never both win.
 *
 * Every change bumps `authzVersion`. The JWT callback re-reads the account on
 * each request, so a new role, a lock or an unlock takes effect on the
 * person's next page load without them signing out.
 */

type UserRow = {
  _id: Types.ObjectId;
  email: string;
  displayName?: string | null;
  status: StaffMember["status"];
  authzVersion: number;
  createdAt?: Date | null;
  lastLoginAt?: Date | null;
  suspendedAt?: Date | null;
};

type GrantRow = { userId: Types.ObjectId; roleKey: string };

const userFields =
  "_id email displayName status authzVersion createdAt lastLoginAt suspendedAt";

function liveGrantFilter(now: Date) {
  return {
    status: "active" as const,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
}

async function activeRoleKeys(session: ClientSession | null) {
  const roles = await getRoleDefinitionModel()
    .find({ active: true })
    .select("key")
    .session(session)
    .lean<{ key: string }[]>()
    .exec();
  return new Set(roles.map(({ key }) => key));
}

function toMember(
  user: UserRow,
  grants: readonly GrantRow[],
  activeRoles: ReadonlySet<string>,
): StaffMember {
  const id = user._id.toHexString();
  return {
    id,
    email: user.email,
    displayName: user.displayName?.trim() || null,
    status: user.status,
    roleKeys: [
      ...new Set(
        grants
          .filter(
            (grant) =>
              grant.userId.toHexString() === id &&
              activeRoles.has(grant.roleKey),
          )
          .map((grant) => grant.roleKey),
      ),
    ],
    authzVersion: user.authzVersion,
    createdAt: user.createdAt ?? null,
    lastLoginAt: user.lastLoginAt ?? null,
    suspendedAt: user.suspendedAt ?? null,
  };
}

/** Every real account, whatever its status, with the roles it holds now. */
export async function listStaffMembers(
  now: Date = new Date(),
): Promise<StaffMember[]> {
  await connectToDatabase();

  const users = await getUserModel()
    // Internal test accounts are not staff (see `internalAccountDomains`).
    .find({ normalizedEmail: { $not: internalAccountEmailPattern } })
    .select(userFields)
    .lean<UserRow[]>()
    .exec();
  if (users.length === 0) return [];

  const [grants, activeRoles] = await Promise.all([
    getAccessGrantModel()
      .find({
        userId: { $in: users.map(({ _id }) => _id) },
        ...liveGrantFilter(now),
      })
      .select("userId roleKey")
      .lean<GrantRow[]>()
      .exec(),
    activeRoleKeys(null),
  ]);

  return users.map((user) => toMember(user, grants, activeRoles));
}

/** How many real accounts wait for the Director's approval. */
export async function countPendingStaff(): Promise<number> {
  await connectToDatabase();
  return getUserModel()
    .countDocuments({
      status: "pending",
      normalizedEmail: { $not: internalAccountEmailPattern },
    })
    .exec();
}

/**
 * Leaves the account holding exactly one global grant: `roleKey`. Other
 * grants are revoked rather than deleted, and a revoked grant on the same role
 * is revived, because the assignment index allows one document per role.
 */
async function keepOnlyRole(
  userId: Types.ObjectId,
  roleKey: AssignableRoleKey,
  actorId: Types.ObjectId,
  now: Date,
  session: ClientSession,
): Promise<void> {
  const AccessGrant = getAccessGrantModel();

  await AccessGrant.updateMany(
    {
      userId,
      status: "active",
      $or: [{ roleKey: { $ne: roleKey } }, { businessUnitId: { $ne: null } }],
    },
    { $set: { status: "revoked" } },
    { session },
  ).exec();

  const existing = await AccessGrant.findOne({
    userId,
    roleKey,
    businessUnitId: null,
  })
    .select("_id")
    .session(session)
    .exec();

  if (existing) {
    await AccessGrant.updateOne(
      { _id: existing._id },
      { $set: { status: "active" }, $unset: { expiresAt: 1 } },
      { session },
    ).exec();
    return;
  }

  await AccessGrant.create(
    [
      {
        userId,
        roleKey,
        businessUnitId: null,
        status: "active",
        grantedBy: actorId,
        grantedAt: now,
      },
    ],
    { session },
  );
}

export type StaffCommandInput = {
  userId: string;
  expectedAuthzVersion: number;
  command: StaffCommand;
};

export async function runStaffCommand(
  actor: AccessContext,
  input: StaffCommandInput,
  now: Date = new Date(),
): Promise<void> {
  if (!Types.ObjectId.isValid(input.userId)) {
    throw new StaffCommandError("NOT_FOUND");
  }

  const database = await connectToDatabase();
  const userId = new Types.ObjectId(input.userId);
  const actorId = new Types.ObjectId(actor.userId);

  await database.connection.transaction(async (session) => {
    const User = getUserModel();
    const AccessGrant = getAccessGrantModel();

    // Sequential on purpose: operations sharing a transaction's session must
    // not run concurrently.
    const user = await User.findById(userId)
      .select(userFields)
      .session(session)
      .lean<UserRow | null>()
      .exec();
    const grants = user
      ? await AccessGrant.find({ userId, ...liveGrantFilter(now) })
          .select("userId roleKey")
          .session(session)
          .lean<GrantRow[]>()
          .exec()
      : [];
    const activeRoles = await activeRoleKeys(session);
    const member = user ? toMember(user, grants, activeRoles) : null;

    const roleKey = assertStaffCommand(member, input.command, {
      actorUserId: actor.userId,
      expectedAuthzVersion: input.expectedAuthzVersion,
    });
    if (!member) throw new StaffCommandError("NOT_FOUND");

    if (roleKey) {
      // The role list comes from the seed; a database the seed never reached
      // must refuse rather than hand out a grant no definition backs.
      if (!activeRoles.has(roleKey)) {
        throw new StaffCommandError("ROLE_UNAVAILABLE");
      }
      await keepOnlyRole(userId, roleKey, actorId, now, session);
    }

    const current = {
      _id: userId,
      status: member.status,
      authzVersion: input.expectedAuthzVersion,
    };
    const expectOne = (matched: number) => {
      if (matched !== 1) throw new StaffCommandError("REVISION_CONFLICT");
    };
    let after: { status: StaffMember["status"]; roleKeys: readonly string[] };

    switch (input.command.kind) {
      case "reject": {
        await AccessGrant.deleteMany({ userId }, { session }).exec();
        const removed = await User.deleteOne(current, { session }).exec();
        expectOne(removed.deletedCount);
        after = { status: "pending", roleKeys: [] };
        break;
      }
      case "approve":
      case "changeRole": {
        const updated = await User.updateOne(
          current,
          { $set: { status: "active" }, $inc: { authzVersion: 1 } },
          { session },
        ).exec();
        expectOne(updated.matchedCount);
        after = { status: "active", roleKeys: roleKey ? [roleKey] : [] };
        break;
      }
      case "suspend": {
        const updated = await User.updateOne(
          current,
          {
            $set: {
              status: "suspended",
              suspendedAt: now,
              suspendedBy: actorId,
            },
            $inc: { authzVersion: 1 },
          },
          { session },
        ).exec();
        expectOne(updated.matchedCount);
        after = { status: "suspended", roleKeys: member.roleKeys };
        break;
      }
      case "unlock": {
        const updated = await User.updateOne(
          current,
          {
            $set: { status: "active" },
            $unset: { suspendedAt: 1, suspendedBy: 1, suspensionReason: 1 },
            $inc: { authzVersion: 1 },
          },
          { session },
        ).exec();
        expectOne(updated.matchedCount);
        after = {
          status: "active",
          roleKeys: roleKey ? [roleKey] : member.roleKeys,
        };
        break;
      }
    }

    await getAuditEventModel().create(
      [
        {
          actorType: "user",
          actorId,
          action: `users.${input.command.kind}`,
          resourceType: "user",
          resourceId: input.userId,
          businessUnitIds: [],
          requestId: actor.requestId,
          before: redactAuditValue({
            status: member.status,
            roleKeys: member.roleKeys,
          }),
          after: redactAuditValue(
            input.command.kind === "reject" ? { deleted: true } : after,
          ),
          occurredAt: now,
        },
      ],
      { session },
    );
  });
}
