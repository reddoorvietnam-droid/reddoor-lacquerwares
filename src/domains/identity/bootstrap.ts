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
import { internalAccountEmailPattern } from "@/domains/identity/staff-policy";
import { connectToDatabase } from "@/lib/db/mongoose";

const bootstrapEmailSchema = z.email().max(320);
// The claim id predates the Super Admin/Director merge; it stays unchanged so
// a database that already claimed the bootstrap is never bootstrapped twice.
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

function minimumDirectorPermissions() {
  return contentPermissions.map((permission) => ({ permission, scope: "all" }));
}

export async function tryBootstrapInitialDirector(input: {
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
    const activeDirectorGrants = await AccessGrant.find({
      roleKey: "DIRECTOR",
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
    const existingDirector = await User.findOne({
      _id: { $in: activeDirectorGrants.map(({ userId }) => userId) },
      status: "active",
      // Accounts the platform provisions for testing (reserved `.local`
      // addresses no Google sign-in can carry) are never the company's
      // Director, so they must not block the real Director's bootstrap.
      normalizedEmail: { $not: internalAccountEmailPattern },
    })
      .select("_id")
      .session(session)
      .exec();

    if (existingDirector) {
      await BootstrapClaim.create(
        [
          {
            _id: bootstrapClaimId,
            userId: existingDirector._id,
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
    const requiredPermissions = minimumDirectorPermissions();
    const role = await RoleDefinition.findOneAndUpdate(
      { key: "DIRECTOR" },
      {
        $setOnInsert: {
          key: "DIRECTOR",
          labels: [
            { locale: "vi", label: "Giám đốc" },
            { locale: "en", label: "Director" },
          ],
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
      throw new Error("The seeded Director role is not valid.");
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
          roleKey: "DIRECTOR",
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
          action: "authorization.bootstrapDirector",
          resourceType: "user",
          resourceId: user._id.toHexString(),
          businessUnitIds: [],
          requestId: input.requestId,
          reason: "One-time initial Director bootstrap",
          before: { status: bootstrapUser.status, roleKey: null },
          after: { status: "active", roleKey: "DIRECTOR" },
          occurredAt: input.occurredAt,
        },
      ],
      { session },
    );

    result = "bootstrapped";
  });

  return result;
}
