import "server-only";

import { Types } from "mongoose";

import type {
  AuthIdentity,
  AuthorizationGrant,
  AuthorizationRepository,
  AuthorizationRole,
  AuthorizationSnapshot,
  GoogleIdentityInput,
  GoogleIdentityRepository,
  RolePermission,
} from "@/domains/identity/contracts";
import { normalizeEmail } from "@/domains/identity/contracts";
import {
  getAccessGrantModel,
  getRoleDefinitionModel,
  getUserModel,
} from "@/domains/identity/models";
import { connectToDatabase } from "@/lib/db/mongoose";

export class IdentityConflictError extends Error {
  constructor() {
    super("The external identity does not match the existing account.");
    this.name = "IdentityConflictError";
  }
}

function toIdentity(user: {
  _id: Types.ObjectId;
  normalizedEmail: string;
  displayName?: string | null;
  status: "pending" | "active" | "suspended";
  authzVersion: number;
}): AuthIdentity {
  return {
    id: user._id.toHexString(),
    normalizedEmail: user.normalizedEmail,
    displayName: user.displayName ?? null,
    status: user.status,
    authzVersion: user.authzVersion,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export class MongoIdentityRepository
  implements GoogleIdentityRepository, AuthorizationRepository
{
  async synchronizeGoogleIdentity(
    input: GoogleIdentityInput,
  ): Promise<AuthIdentity> {
    await connectToDatabase();

    const User = getUserModel();
    const normalizedEmail = normalizeEmail(input.email);
    let user = await User.findOne({
      $or: [{ googleSubject: input.googleSubject }, { normalizedEmail }],
    })
      .select(
        "_id email normalizedEmail googleSubject displayName status authzVersion",
      )
      .exec();

    if (user?.googleSubject && user.googleSubject !== input.googleSubject) {
      throw new IdentityConflictError();
    }

    if (!user) {
      try {
        user = await User.create({
          email: input.email.trim(),
          normalizedEmail,
          googleSubject: input.googleSubject,
          displayName: input.displayName ?? undefined,
          avatarUrl: input.avatarUrl ?? undefined,
          status: "pending",
          authzVersion: 1,
          lastLoginAt: input.occurredAt,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        user = await User.findOne({ normalizedEmail })
          .select(
            "_id email normalizedEmail googleSubject displayName status authzVersion",
          )
          .exec();

        if (
          !user ||
          (user.googleSubject && user.googleSubject !== input.googleSubject)
        ) {
          throw new IdentityConflictError();
        }
      }
    }

    user.email = input.email.trim();
    user.normalizedEmail = normalizedEmail;
    user.googleSubject ??= input.googleSubject;
    user.displayName = input.displayName ?? undefined;
    user.avatarUrl = input.avatarUrl ?? undefined;
    user.lastLoginAt = input.occurredAt;
    await user.save();

    return toIdentity(user);
  }

  async findIdentityByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<AuthIdentity | null> {
    await connectToDatabase();

    const user = await getUserModel()
      .findOne({ normalizedEmail: normalizeEmail(normalizedEmail) })
      .select("_id normalizedEmail displayName status authzVersion")
      .exec();

    return user ? toIdentity(user) : null;
  }

  /** Name and address of an account, for greeting the person signed in. */
  async findAccountProfile(
    userId: string,
  ): Promise<{ displayName: string | null; email: string } | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    await connectToDatabase();

    const user = await getUserModel()
      .findById(new Types.ObjectId(userId))
      .select("email displayName")
      .lean<{ email: string; displayName?: string | null }>()
      .exec();

    return user
      ? { displayName: user.displayName?.trim() || null, email: user.email }
      : null;
  }

  async findSnapshotByUserId(
    userId: string,
  ): Promise<AuthorizationSnapshot | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    await connectToDatabase();

    const objectId = new Types.ObjectId(userId);
    const user = await getUserModel()
      .findById(objectId)
      .select("_id status authzVersion")
      .exec();

    if (!user) {
      return null;
    }

    const now = new Date();
    const grantDocuments = await getAccessGrantModel()
      .find({
        userId: objectId,
        status: "active",
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      })
      .select("_id roleKey businessUnitId status expiresAt")
      .exec();

    const roleKeys = [...new Set(grantDocuments.map(({ roleKey }) => roleKey))];
    const roleDocuments = await getRoleDefinitionModel()
      .find({ key: { $in: roleKeys }, active: true })
      .select("key active permissions")
      .exec();

    const grants: AuthorizationGrant[] = grantDocuments.map((grant) => ({
      id: grant._id.toHexString(),
      roleKey: grant.roleKey,
      businessUnitId: grant.businessUnitId?.toHexString() ?? null,
      status: grant.status,
      expiresAt: grant.expiresAt ?? null,
    }));

    const roles: AuthorizationRole[] = roleDocuments.map((role) => ({
      key: role.key,
      active: role.active,
      permissions: role.permissions.map(
        ({ permission, scope }: RolePermission) => ({
          permission,
          scope,
        }),
      ),
    }));

    return {
      user: {
        id: user._id.toHexString(),
        status: user.status,
        authzVersion: user.authzVersion,
      },
      grants,
      roles,
    };
  }
}

export const mongoIdentityRepository = new MongoIdentityRepository();
