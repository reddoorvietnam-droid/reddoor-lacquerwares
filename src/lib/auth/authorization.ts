import type {
  AuthorizationGrant,
  AuthorizationRole,
  AuthorizationSnapshot,
  ContentPermission,
  PermissionScope,
} from "@/domains/identity/contracts";

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

export type ContentPermissionTarget = {
  resourceId?: string | null;
  ownerUserId?: string | null;
  businessUnitIds?: readonly string[];
};

export type EffectivePermission = {
  permission: ContentPermission;
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
  permission: ContentPermission,
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

    const scope =
      grant.businessUnitId && rolePermission.scope === "all"
        ? "assignedBusinessUnits"
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

function effectivePermission(
  permission: ContentPermission,
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
  permission: ContentPermission,
  actorUserId: string,
  candidates: readonly PermissionCandidate[],
  target: ContentPermissionTarget,
): boolean {
  if (
    candidates.some(
      ({ scope, businessUnitId }) => scope === "all" && businessUnitId === null,
    )
  ) {
    return true;
  }

  if (permission === "content.review" || permission === "content.publish") {
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

  if (permission === "content.create") {
    return !target.ownerUserId || target.ownerUserId === actorUserId;
  }

  if (permission === "content.read" && !target.resourceId) {
    return true;
  }

  return target.ownerUserId === actorUserId;
}

export function evaluateContentPermission(input: {
  session: SessionIdentity;
  snapshot: AuthorizationSnapshot;
  permission: ContentPermission;
  target?: ContentPermissionTarget;
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

export class ContentAccessDeniedError extends Error {
  readonly code: AccessDenialCode;

  constructor(code: AccessDenialCode) {
    super("Access denied.");
    this.name = "ContentAccessDeniedError";
    this.code = code;
  }
}
