import "server-only";

import { type ClientSession, Types } from "mongoose";

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
import {
  contentPermissions,
  normalizeEmail,
} from "@/domains/identity/contracts";
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

/**
 * The DIRECTOR role definition, created the same way the first-Director
 * bootstrap does when this database has none yet.
 */
async function ensureDirectorRole(session: ClientSession): Promise<void> {
  const role = await getRoleDefinitionModel()
    .findOneAndUpdate(
      { key: "DIRECTOR" },
      {
        $setOnInsert: {
          key: "DIRECTOR",
          labels: [
            { locale: "vi", label: "Giám đốc" },
            { locale: "en", label: "Director" },
          ],
          permissions: contentPermissions.map((permission) => ({
            permission,
            scope: "all",
          })),
          system: true,
          active: true,
        },
      },
      { upsert: true, new: true, session, setDefaultsOnInsert: true },
    )
    .exec();
  if (!role.active) throw new Error("The Director role is inactive.");
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

  /**
   * The account behind the shared password sign-in (owner's decision,
   * 2026-11-17): it works as a Director with no approval step. Every sign-in
   * makes sure the account is active and holds an active DIRECTOR grant, so
   * knowing the username and password is all it takes. A suspended account
   * stays suspended. Its address ends in `.local`, which no Google account can
   * have and which the notification dispatcher never mails.
   */
  async synchronizePasswordIdentity(input: {
    email: string;
    displayName: string;
    occurredAt: Date;
  }): Promise<AuthIdentity> {
    const database = await connectToDatabase();
    const normalizedEmail = normalizeEmail(input.email);
    let identity: AuthIdentity | null = null;

    await database.connection.transaction(async (session) => {
      const User = getUserModel();
      const AccessGrant = getAccessGrantModel();

      let user = await User.findOne({ normalizedEmail })
        .session(session)
        .exec();
      if (user?.googleSubject) {
        throw new IdentityConflictError();
      }
      if (!user) {
        [user] = await User.create(
          [
            {
              email: input.email,
              normalizedEmail,
              displayName: input.displayName,
              status: "active",
              authzVersion: 1,
              lastLoginAt: input.occurredAt,
            },
          ],
          { session },
        );
      }
      if (!user) throw new Error("The password account was not created.");

      let changed = false;
      if (user.status === "pending") {
        user.status = "active";
        changed = true;
      }

      if (user.status === "active") {
        await ensureDirectorRole(session);
        const grant = await AccessGrant.findOne({
          userId: user._id,
          roleKey: "DIRECTOR",
          businessUnitId: null,
        })
          .session(session)
          .exec();
        if (!grant) {
          await AccessGrant.create(
            [
              {
                userId: user._id,
                roleKey: "DIRECTOR",
                businessUnitId: null,
                status: "active",
                grantedBy: user._id,
                grantedAt: input.occurredAt,
              },
            ],
            { session },
          );
          changed = true;
        } else if (
          grant.status !== "active" ||
          (grant.expiresAt && grant.expiresAt <= input.occurredAt)
        ) {
          grant.status = "active";
          grant.expiresAt = undefined;
          await grant.save({ session });
          changed = true;
        }
      }

      // A grant change must invalidate sessions minted before it, exactly
      // like the staff screen does when it changes a role.
      if (changed) user.authzVersion += 1;
      user.lastLoginAt = input.occurredAt;
      await user.save({ session });
      identity = toIdentity(user);
    });

    if (!identity) throw new Error("The password account was not saved.");
    return identity;
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
