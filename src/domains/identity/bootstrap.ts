import "server-only";

import { Types } from "mongoose";
import { z } from "zod";

import { getAuditEventModel } from "@/domains/audit/model";
import {
  contentPermissions,
  normalizeEmail,
  type RolePermission,
} from "@/domains/identity/contracts";
import {
  getAccessGrantModel,
  getRoleDefinitionModel,
  getSecurityBootstrapClaimModel,
  getUserModel,
} from "@/domains/identity/models";
import { connectToDatabase } from "@/lib/db/mongoose";

const bootstrapEmailSchema = z.email().max(320);
const bootstrapClaimId = "initial-super-admin";

export type BootstrapResult =
  "notEligible" | "alreadyClaimed" | "alreadyProvisioned" | "bootstrapped";

export function parseBootstrapAdminEmails(
  value: string | undefined,
): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(/[,;\n]/)
      .map(normalizeEmail)
      .filter((email) => bootstrapEmailSchema.safeParse(email).success),
  );
}

function minimumSuperAdminPermissions() {
  return contentPermissions.map((permission) => ({ permission, scope: "all" }));
}

export async function tryBootstrapInitialSuperAdmin(input: {
  userId: string;
  normalizedEmail: string;
  allowedEmails: ReadonlySet<string>;
  occurredAt: Date;
  requestId: string;
}): Promise<BootstrapResult> {
  const normalizedEmail = normalizeEmail(input.normalizedEmail);
  if (
    !Types.ObjectId.isValid(input.userId) ||
    !input.allowedEmails.has(normalizedEmail)
  ) {
    return "notEligible";
  }

  const database = await connectToDatabase();
  let result: BootstrapResult = "alreadyClaimed";

  await database.connection.transaction(async (session) => {
    const BootstrapClaim = getSecurityBootstrapClaimModel();
    const existingClaim = await BootstrapClaim.findById(bootstrapClaimId)
      .session(session)
      .exec();

    if (existingClaim) {
      result = "alreadyClaimed";
      return;
    }

    const User = getUserModel();
    const AccessGrant = getAccessGrantModel();
    const activeSuperAdminGrants = await AccessGrant.find({
      roleKey: "SUPER_ADMIN",
      status: "active",
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: input.occurredAt } },
      ],
    })
      .select("userId")
      .session(session)
      .exec();
    const existingSuperAdmin = await User.findOne({
      _id: { $in: activeSuperAdminGrants.map(({ userId }) => userId) },
      status: "active",
    })
      .select("_id")
      .session(session)
      .exec();

    if (existingSuperAdmin) {
      await BootstrapClaim.create(
        [
          {
            _id: bootstrapClaimId,
            userId: existingSuperAdmin._id,
            mode: "alreadyProvisioned",
            claimedAt: input.occurredAt,
          },
        ],
        { session },
      );
      result = "alreadyProvisioned";
      return;
    }

    const RoleDefinition = getRoleDefinitionModel();
    const requiredPermissions = minimumSuperAdminPermissions();
    const role = await RoleDefinition.findOneAndUpdate(
      { key: "SUPER_ADMIN" },
      {
        $setOnInsert: {
          key: "SUPER_ADMIN",
          labels: [{ locale: "en", label: "Super Admin" }],
          permissions: requiredPermissions,
          system: true,
          active: true,
        },
      },
      { upsert: true, new: true, session, setDefaultsOnInsert: true },
    ).exec();
    const hasRequiredPermissions = requiredPermissions.every((required) =>
      role.permissions.some(
        (entry: RolePermission) =>
          entry.permission === required.permission && entry.scope === "all",
      ),
    );

    if (!role.active || !role.system || !hasRequiredPermissions) {
      throw new Error("The seeded Super Admin role is not valid.");
    }

    const userObjectId = new Types.ObjectId(input.userId);
    const bootstrapUser = await User.findOne({
      _id: userObjectId,
      normalizedEmail,
      status: { $in: ["pending", "active"] },
    })
      .select("_id status")
      .session(session)
      .exec();

    if (!bootstrapUser) {
      throw new Error("The bootstrap identity is not eligible.");
    }

    const user = await User.findOneAndUpdate(
      {
        _id: userObjectId,
        normalizedEmail,
        status: bootstrapUser.status,
      },
      {
        $set: { status: "active" },
        $inc: { authzVersion: 1 },
      },
      { new: true, session },
    ).exec();

    if (!user) {
      throw new Error("The bootstrap identity is no longer available.");
    }

    await AccessGrant.create(
      [
        {
          userId: user._id,
          roleKey: "SUPER_ADMIN",
          businessUnitId: null,
          status: "active",
          grantedBy: user._id,
          grantedAt: input.occurredAt,
        },
      ],
      { session },
    );
    await BootstrapClaim.create(
      [
        {
          _id: bootstrapClaimId,
          userId: user._id,
          mode: "bootstrapped",
          claimedAt: input.occurredAt,
        },
      ],
      { session },
    );
    await getAuditEventModel().create(
      [
        {
          actorType: "user",
          actorId: user._id,
          action: "authorization.bootstrapSuperAdmin",
          resourceType: "user",
          resourceId: user._id.toHexString(),
          businessUnitIds: [],
          requestId: input.requestId,
          reason: "One-time initial Super Admin bootstrap",
          before: { status: bootstrapUser.status, roleKey: null },
          after: { status: "active", roleKey: "SUPER_ADMIN" },
          occurredAt: input.occurredAt,
        },
      ],
      { session },
    );

    result = "bootstrapped";
  });

  return result;
}
