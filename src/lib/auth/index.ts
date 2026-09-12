import "server-only";

import { cache } from "react";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import type { Permission } from "@/domains/identity/permissions";
import {
  activeRoleKeys,
  grantCoverageForPermission,
  type AccessContext,
  type AccessDenialCode,
} from "@/lib/auth/authorization";
import {
  createContentPermissionGuard,
  createPermissionGuard,
} from "@/lib/auth/guard";
import { resolveSessionIdentity } from "@/lib/auth/session";
import { isDevOpenAccessEnabled } from "@/lib/env/server";

export type {
  AccessContext,
  ContentPermissionTarget,
} from "@/lib/auth/authorization";
export { ContentAccessDeniedError } from "@/lib/auth/authorization";
export type {
  RequireContentPermissionOptions,
  RequirePermissionOptions,
} from "@/lib/auth/guard";

/**
 * Request-scoped memoization. One page view runs the layout gate, the shell's
 * menu filter, and every leaf guard — each of which needs the session
 * identity and the authorization snapshot. Both are stable for the lifetime
 * of a request, and the snapshot alone costs three Atlas queries, so React's
 * `cache` collapses all of those reads into one per request. Grants changed
 * mid-request are still caught: the JWT's `authzVersion` is compared against
 * the snapshot on every evaluation.
 */
const resolveSessionIdentityCached = cache(resolveSessionIdentity);

const findSnapshotByUserIdCached = cache((userId: string) =>
  mongoIdentityRepository.findSnapshotByUserId(userId),
);

const cachedIdentityRepository = {
  findSnapshotByUserId: findSnapshotByUserIdCached,
};

export const requireContentPermission = createContentPermissionGuard({
  resolveSessionIdentity: resolveSessionIdentityCached,
  authorizationRepository: cachedIdentityRepository,
  auditRepository: mongoAuditRepository,
  openAccess: isDevOpenAccessEnabled,
});

/** The generalized guard: any permission from the catalog, any target. */
export const requirePermission = createPermissionGuard({
  resolveSessionIdentity: resolveSessionIdentityCached,
  authorizationRepository: cachedIdentityRepository,
  auditRepository: mongoAuditRepository,
  openAccess: isDevOpenAccessEnabled,
});

export type PortalDenialCode = Extract<
  AccessDenialCode,
  | "USER_PENDING"
  | "USER_SUSPENDED"
  | "USER_NOT_FOUND"
  | "STALE_SESSION"
  | "PERMISSION_DENIED"
>;

export type PortalEntryState =
  | { kind: "unconfigured" }
  | { kind: "unauthenticated" }
  | { kind: "denied"; code: PortalDenialCode }
  | { kind: "granted" };

/**
 * Auditless gate for the portal layout: decides whether the shell renders at
 * all, with the exact denial code the access screen should explain. Every
 * leaf page still guards its own reads and writes — this check writes no
 * audit event, because a navigation is not an authorization decision and a
 * per-click denial write was the most expensive thing the layout did.
 */
export async function resolvePortalEntry(
  entryPermissions: readonly Permission[],
): Promise<PortalEntryState> {
  const resolution = await resolveSessionIdentityCached();
  if (!resolution.configured) return { kind: "unconfigured" };
  if (!resolution.identity) return { kind: "unauthenticated" };

  const identity = resolution.identity;
  if (identity.status === "pending") {
    return { kind: "denied", code: "USER_PENDING" };
  }
  if (identity.status === "suspended") {
    return { kind: "denied", code: "USER_SUSPENDED" };
  }

  if (isDevOpenAccessEnabled()) return { kind: "granted" };

  const snapshot = await findSnapshotByUserIdCached(identity.userId);
  if (!snapshot) return { kind: "denied", code: "USER_NOT_FOUND" };
  if (snapshot.user.authzVersion !== identity.authzVersion) {
    return { kind: "denied", code: "STALE_SESSION" };
  }

  const now = new Date();
  const granted = entryPermissions.some((permission) => {
    const coverage = grantCoverageForPermission(snapshot, permission, now);
    return coverage.global || coverage.businessUnitIds.length > 0;
  });
  return granted
    ? { kind: "granted" }
    : { kind: "denied", code: "PERMISSION_DENIED" };
}

export type PermissionCoverage = {
  global: boolean;
  businessUnitIds: readonly string[];
  /** Granted for the holder's own records only; opens no list screen. */
  own: boolean;
  /** The units such a grant is bound to; empty when it is global. */
  ownBusinessUnitIds: readonly string[];
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
  const empty: PermissionCoverage = {
    global: false,
    businessUnitIds: [],
    own: false,
    ownBusinessUnitIds: [],
  };
  const coverages = Object.fromEntries(
    permissions.map((permission) => [permission, empty]),
  ) as Record<P[number], PermissionCoverage>;

  const resolution = await resolveSessionIdentityCached();
  if (!resolution.configured || !resolution.identity) {
    return coverages;
  }

  if (isDevOpenAccessEnabled()) {
    const open: PermissionCoverage = {
      global: true,
      businessUnitIds: [],
      own: true,
      ownBusinessUnitIds: [],
    };
    for (const permission of permissions) {
      coverages[permission as P[number]] = open;
    }
    return coverages;
  }

  if (resolution.identity.status !== "active") {
    return coverages;
  }

  const snapshot = await findSnapshotByUserIdCached(resolution.identity.userId);
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

/**
 * The roles the session actively holds, for arranging the UI only — like
 * `resolvePermissionCoverages`, it writes no audit event and decides nothing:
 * every page and action still re-authorizes through its own guard.
 */
export async function resolveActiveRoleKeys(): Promise<readonly string[]> {
  const resolution = await resolveSessionIdentityCached();
  if (
    !resolution.configured ||
    !resolution.identity ||
    resolution.identity.status !== "active"
  ) {
    return [];
  }

  const snapshot = await findSnapshotByUserIdCached(resolution.identity.userId);
  if (
    !snapshot ||
    snapshot.user.status !== "active" ||
    snapshot.user.authzVersion !== resolution.identity.authzVersion
  ) {
    return [];
  }

  return activeRoleKeys(snapshot, new Date());
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
  const resolution = await resolveSessionIdentityCached();
  const userId =
    resolution.configured && resolution.identity
      ? resolution.identity.userId
      : null;
  let coveredUnitIds: readonly string[] = [];
  let ownUnitIds: readonly string[] = [];
  let ownOnly = false;

  if (userId) {
    const snapshot = await findSnapshotByUserIdCached(userId);
    if (snapshot) {
      const coverage = grantCoverageForPermission(
        snapshot,
        permission,
        new Date(),
      );
      coveredUnitIds = coverage.global ? [] : coverage.businessUnitIds;
      // A grant that only reaches the holder's own records still opens the
      // holder's own list — but the evaluator has to be told whose records
      // are being asked for, or an `own` grant judges a target with no
      // owner and refuses.
      ownOnly =
        !coverage.global &&
        coverage.businessUnitIds.length === 0 &&
        coverage.own;
      ownUnitIds = coverage.ownBusinessUnitIds;
    }
  }

  const context = await requirePermission(
    permission,
    coveredUnitIds.length > 0
      ? { businessUnitIds: coveredUnitIds }
      : ownOnly
        ? // A list carries no record, so the target names only the units the
          // `own` grant is bound to (none when it is global); the repository
          // then narrows the query to the reader's own records.
          { businessUnitIds: ownUnitIds }
        : {},
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
