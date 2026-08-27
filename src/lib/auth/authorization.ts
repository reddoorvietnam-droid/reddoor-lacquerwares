import type {
  AuthorizationGrant,
  AuthorizationRole,
  AuthorizationSnapshot,
  PermissionScope,
} from "@/domains/identity/contracts";
import {
  requiresGlobalGrant,
  type Permission,
} from "@/domains/identity/permissions";

export const accessDenialCodes = [
  "AUTH_NOT_CONFIGURED",
  "UNAUTHENTICATED",
  "USER_NOT_FOUND",
  "USER_PENDING",
  "USER_SUSPENDED",
  "STALE_SESSION",
  "PERMISSION_DENIED",
  "AUTHORIZATION_UNAVAILABLE",
] as const;

export type AccessDenialCode = (typeof accessDenialCodes)[number];

export type SessionIdentity = {
  userId: string;
  status: "pending" | "active" | "suspended";
  authzVersion: number;
};

export type PermissionTarget = {
  resourceId?: string | null;
  ownerUserId?: string | null;
  businessUnitIds?: readonly string[];
};

export type EffectivePermission = {
  permission: Permission;
  scope: PermissionScope;
  businessUnitIds: readonly string[];
  roleKeys: readonly string[];
};

export type AccessContext = {
  actorType: "user";
  userId: string;
  userStatus: "active";
  permissions: readonly EffectivePermission[];
  authzVersion: number;
  requestId: string;
};

export type AccessDecision =
  | { allowed: true; context: AccessContext }
  | { allowed: false; code: AccessDenialCode };

type PermissionCandidate = {
  scope: PermissionScope;
  businessUnitId: string | null;
  roleKey: string;
};

function activeGrant(grant: AuthorizationGrant, now: Date): boolean {
  return (
    grant.status === "active" &&
    (grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime())
  );
}

function candidatesForPermission(
  snapshot: AuthorizationSnapshot,
  permission: Permission,
  now: Date,
): PermissionCandidate[] {
  const rolesByKey = new Map<string, AuthorizationRole>(
    snapshot.roles
      .filter(({ active }) => active)
      .map((role) => [role.key, role]),
  );

  return snapshot.grants.flatMap((grant) => {
    if (!activeGrant(grant, now)) {
      return [];
    }

    const role = rolesByKey.get(grant.roleKey);
    const rolePermission = role?.permissions.find(
      (entry) => entry.permission === permission,
    );

    if (!role || !rolePermission) {
      return [];
    }

    // The narrower of grant breadth and role ceiling wins in both directions:
    // a unit-bound grant narrows a role's `all` to that unit, and a
    // deliberately global grant (null business unit, issued only by a role
    // manager) widens `assignedBusinessUnits` to every unit — the role names
    // the capability, the grant names its reach. Globally scoped permissions
    // (`requiresGlobalGrant`) are unaffected: they are never seeded below
    // `all`, and `scopeCoversTarget` still demands the explicit global grant.
    const scope =
      grant.businessUnitId && rolePermission.scope === "all"
        ? "assignedBusinessUnits"
        : !grant.businessUnitId &&
            rolePermission.scope === "assignedBusinessUnits"
          ? "all"
          : rolePermission.scope;

    return [
      {
        scope,
        businessUnitId: grant.businessUnitId,
        roleKey: role.key,
      },
    ];
  });
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * The business units an actor's active grants attach to a permission, plus
 * whether any grant satisfies it globally.
 *
 * List reads follow the RBAC convention that the repository narrows the query
 * before it runs. A caller uses this to name the units it is about to read and
 * passes them as the guard target, so the evaluator judges exactly the set the
 * repository will filter by, and the audit trail records it.
 */
export function grantCoverageForPermission(
  snapshot: AuthorizationSnapshot,
  permission: Permission,
  now: Date,
): { global: boolean; businessUnitIds: readonly string[] } {
  const candidates = candidatesForPermission(snapshot, permission, now);

  return {
    global: candidates.some(
      ({ scope, businessUnitId }) => scope === "all" && businessUnitId === null,
    ),
    businessUnitIds: unique(
      candidates.flatMap(({ scope, businessUnitId }) =>
        scope === "assignedBusinessUnits" && businessUnitId
          ? [businessUnitId]
          : [],
      ),
    ),
  };
}

function effectivePermission(
  permission: Permission,
  candidates: readonly PermissionCandidate[],
): EffectivePermission {
  const globalAll = candidates.some(
    ({ scope, businessUnitId }) => scope === "all" && businessUnitId === null,
  );
  const hasAssignedScope = candidates.some(
    ({ scope }) => scope === "assignedBusinessUnits",
  );

  return {
    permission,
    scope: globalAll
      ? "all"
      : hasAssignedScope
        ? "assignedBusinessUnits"
        : "own",
    businessUnitIds: unique(
      candidates.flatMap(({ businessUnitId }) =>
        businessUnitId ? [businessUnitId] : [],
      ),
    ),
    roleKeys: unique(candidates.map(({ roleKey }) => roleKey)),
  };
}

function scopeCoversTarget(
  permission: Permission,
  actorUserId: string,
  candidates: readonly PermissionCandidate[],
  target: PermissionTarget,
): boolean {
  if (
    candidates.some(
      ({ scope, businessUnitId }) => scope === "all" && businessUnitId === null,
    )
  ) {
    return true;
  }

  // Review, approval, publication, and platform administration are satisfied
  // only by an explicitly global grant, which the check above already covered.
  if (requiresGlobalGrant(permission)) {
    return false;
  }

  const targetBusinessUnitIds = unique(target.businessUnitIds ?? []);
  const assignedUnitIds = new Set(
    candidates.flatMap(({ scope, businessUnitId }) =>
      scope === "assignedBusinessUnits" && businessUnitId
        ? [businessUnitId]
        : [],
    ),
  );

  if (
    targetBusinessUnitIds.length > 0 &&
    targetBusinessUnitIds.every((unitId) => assignedUnitIds.has(unitId))
  ) {
    return true;
  }

  const ownCandidates = candidates.filter(({ scope }) => scope === "own");
  if (ownCandidates.length === 0) {
    return false;
  }

  const globalOwn = ownCandidates.some(
    ({ businessUnitId }) => businessUnitId === null,
  );
  const ownUnitIds = new Set(
    ownCandidates.flatMap(({ businessUnitId }) =>
      businessUnitId ? [businessUnitId] : [],
    ),
  );
  const ownScopeCoversUnits =
    globalOwn ||
    (targetBusinessUnitIds.length > 0 &&
      targetBusinessUnitIds.every((unitId) => ownUnitIds.has(unitId)));

  if (!ownScopeCoversUnits) {
    return false;
  }

  const action = permission.slice(permission.indexOf(".") + 1);

  // Creating under `own` scope means the service assigns ownership to the actor;
  // a client-supplied owner that is not the actor is rejected.
  if (action === "create") {
    return !target.ownerUserId || target.ownerUserId === actorUserId;
  }

  // A list, count, or autocomplete read carries no resource; the repository
  // still narrows the query to the actor's own records.
  if (action.startsWith("read") && !target.resourceId) {
    return true;
  }

  return target.ownerUserId === actorUserId;
}

export function evaluatePermission(input: {
  session: SessionIdentity;
  snapshot: AuthorizationSnapshot;
  permission: Permission;
  target?: PermissionTarget;
  requestId: string;
  now: Date;
}): AccessDecision {
  const { session, snapshot, permission, requestId, now } = input;

  if (session.status === "pending") {
    return { allowed: false, code: "USER_PENDING" };
  }

  if (session.status === "suspended") {
    return { allowed: false, code: "USER_SUSPENDED" };
  }

  if (snapshot.user.id !== session.userId) {
    return { allowed: false, code: "USER_NOT_FOUND" };
  }

  if (snapshot.user.status === "pending") {
    return { allowed: false, code: "USER_PENDING" };
  }

  if (snapshot.user.status === "suspended") {
    return { allowed: false, code: "USER_SUSPENDED" };
  }

  if (snapshot.user.authzVersion !== session.authzVersion) {
    return { allowed: false, code: "STALE_SESSION" };
  }

  const candidates = candidatesForPermission(snapshot, permission, now);
  if (
    candidates.length === 0 ||
    !scopeCoversTarget(
      permission,
      session.userId,
      candidates,
      input.target ?? {},
    )
  ) {
    return { allowed: false, code: "PERMISSION_DENIED" };
  }

  return {
    allowed: true,
    context: {
      actorType: "user",
      userId: session.userId,
      userStatus: "active",
      permissions: [effectivePermission(permission, candidates)],
      authzVersion: snapshot.user.authzVersion,
      requestId,
    },
  };
}

/** @deprecated Kept for Phase 2 content call sites. Use `PermissionTarget`. */
export type ContentPermissionTarget = PermissionTarget;

/** @deprecated Kept for Phase 2 content call sites. Use `evaluatePermission`. */
export const evaluateContentPermission = evaluatePermission;

export class ContentAccessDeniedError extends Error {
  readonly code: AccessDenialCode;

  constructor(code: AccessDenialCode) {
    super("Access denied.");
    this.name = "ContentAccessDeniedError";
    this.code = code;
  }
}
