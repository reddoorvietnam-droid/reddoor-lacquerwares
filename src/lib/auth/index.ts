import "server-only";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import type { Permission } from "@/domains/identity/permissions";
import {
  grantCoverageForPermission,
  type AccessContext,
} from "@/lib/auth/authorization";
import {
  createContentPermissionGuard,
  createPermissionGuard,
} from "@/lib/auth/guard";
import { resolveSessionIdentity } from "@/lib/auth/session";

export type {
  AccessContext,
  ContentPermissionTarget,
} from "@/lib/auth/authorization";
export { ContentAccessDeniedError } from "@/lib/auth/authorization";
export type {
  RequireContentPermissionOptions,
  RequirePermissionOptions,
} from "@/lib/auth/guard";

export const requireContentPermission = createContentPermissionGuard({
  resolveSessionIdentity,
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});

/** The generalized guard: any permission from the catalog, any target. */
export const requirePermission = createPermissionGuard({
  resolveSessionIdentity,
  authorizationRepository: mongoIdentityRepository,
  auditRepository: mongoAuditRepository,
});

export type PermissionCoverage = {
  global: boolean;
  businessUnitIds: readonly string[];
};

/**
 * Grant coverage for several permissions in one snapshot read, for UI
 * affordances only — showing or hiding a control is never the authorization
 * decision, so this deliberately writes no audit event. Every action still
 * re-authorizes through `requirePermission`.
 */
export async function resolvePermissionCoverages<
  const P extends readonly Permission[],
>(permissions: P): Promise<Record<P[number], PermissionCoverage>> {
  const empty: PermissionCoverage = { global: false, businessUnitIds: [] };
  const coverages = Object.fromEntries(
    permissions.map((permission) => [permission, empty]),
  ) as Record<P[number], PermissionCoverage>;

  const resolution = await resolveSessionIdentity();
  if (
    !resolution.configured ||
    !resolution.identity ||
    resolution.identity.status !== "active"
  ) {
    return coverages;
  }

  const snapshot = await mongoIdentityRepository.findSnapshotByUserId(
    resolution.identity.userId,
  );
  if (
    !snapshot ||
    snapshot.user.authzVersion !== resolution.identity.authzVersion
  ) {
    return coverages;
  }

  const now = new Date();
  for (const permission of permissions) {
    coverages[permission as P[number]] = grantCoverageForPermission(
      snapshot,
      permission,
      now,
    );
  }
  return coverages;
}

/** Whether coverage reaches a specific record's business units. */
export function coverageReaches(
  coverage: PermissionCoverage,
  businessUnitIds: readonly string[],
): boolean {
  if (coverage.global) return true;
  if (businessUnitIds.length === 0) return false;
  const covered = new Set(coverage.businessUnitIds);
  return businessUnitIds.every((unitId) => covered.has(unitId));
}

/** How a repository must narrow a list read after `requireListAccess`. */
export type ListReadScope =
  | { kind: "all" }
  | { kind: "businessUnits"; businessUnitIds: readonly string[] }
  | { kind: "own"; userId: string };

/**
 * Guard for list reads of business-unit-scoped resources.
 *
 * The evaluator judges a target; a list has none until the repository chooses
 * its filter. This helper reads the actor's grant coverage for the permission,
 * presents exactly that coverage as the guard target, and hands back the
 * predicate the repository must apply — so the units the guard approved are
 * the units the query is narrowed to, never wider.
 */
export async function requireListAccess(
  permission: Permission,
): Promise<{ context: AccessContext; scope: ListReadScope }> {
  const resolution = await resolveSessionIdentity();
  let coveredUnitIds: readonly string[] = [];

  if (resolution.configured && resolution.identity) {
    const snapshot = await mongoIdentityRepository.findSnapshotByUserId(
      resolution.identity.userId,
    );
    if (snapshot) {
      const coverage = grantCoverageForPermission(
        snapshot,
        permission,
        new Date(),
      );
      coveredUnitIds = coverage.global ? [] : coverage.businessUnitIds;
    }
  }

  const context = await requirePermission(
    permission,
    coveredUnitIds.length > 0 ? { businessUnitIds: coveredUnitIds } : {},
  );

  const effective = context.permissions[0];
  const scope: ListReadScope =
    effective?.scope === "all"
      ? { kind: "all" }
      : effective?.scope === "assignedBusinessUnits"
        ? { kind: "businessUnits", businessUnitIds: effective.businessUnitIds }
        : { kind: "own", userId: context.userId };

  return { context, scope };
}
