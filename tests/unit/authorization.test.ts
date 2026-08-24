import { describe, expect, it, vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import type {
  AuthorizationRepository,
  AuthorizationSnapshot,
  ContentPermission,
} from "@/domains/identity/contracts";
import {
  evaluateContentPermission,
  type SessionIdentity,
} from "@/lib/auth/authorization";
import {
  createContentPermissionGuard,
  type SessionIdentityResolution,
} from "@/lib/auth/guard";

const now = new Date("2026-08-24T04:00:00.000Z");
const userId = "66c84b2d12ad6a75f9400001";

function snapshot(
  input: {
    status?: "pending" | "active" | "suspended";
    authzVersion?: number;
    permission?: ContentPermission;
    scope?: "own" | "assignedBusinessUnits" | "all";
    grantStatus?: "active" | "revoked";
    expiresAt?: Date | null;
    businessUnitId?: string | null;
    roleActive?: boolean;
  } = {},
): AuthorizationSnapshot {
  return {
    user: {
      id: userId,
      status: input.status ?? "active",
      authzVersion: input.authzVersion ?? 3,
    },
    grants: [
      {
        id: "66c84b2d12ad6a75f9400002",
        roleKey: "CONTENT_EDITOR",
        businessUnitId: input.businessUnitId ?? null,
        status: input.grantStatus ?? "active",
        expiresAt: input.expiresAt ?? null,
      },
    ],
    roles: [
      {
        key: "CONTENT_EDITOR",
        active: input.roleActive ?? true,
        permissions: [
          {
            permission: input.permission ?? "content.update",
            scope: input.scope ?? "own",
          },
        ],
      },
    ],
  };
}

const session: SessionIdentity = {
  userId,
  status: "active",
  authzVersion: 3,
};

describe("content permission evaluation", () => {
  it.each([
    ["pending", "USER_PENDING"],
    ["suspended", "USER_SUSPENDED"],
  ] as const)("denies a %s user", (status, code) => {
    expect(
      evaluateContentPermission({
        session,
        snapshot: snapshot({ status }),
        permission: "content.update",
        target: { resourceId: "content-1", ownerUserId: userId },
        requestId: "request-1",
        now,
      }),
    ).toEqual({ allowed: false, code });
  });

  it("denies a session carrying a stale authorization version", () => {
    expect(
      evaluateContentPermission({
        session,
        snapshot: snapshot({ authzVersion: 4 }),
        permission: "content.update",
        target: { resourceId: "content-1", ownerUserId: userId },
        requestId: "request-1",
        now,
      }),
    ).toEqual({ allowed: false, code: "STALE_SESSION" });
  });

  it("allows own-scope updates only for the persisted owner", () => {
    const allowed = evaluateContentPermission({
      session,
      snapshot: snapshot(),
      permission: "content.update",
      target: { resourceId: "content-1", ownerUserId: userId },
      requestId: "request-1",
      now,
    });
    const denied = evaluateContentPermission({
      session,
      snapshot: snapshot(),
      permission: "content.update",
      target: {
        resourceId: "content-2",
        ownerUserId: "66c84b2d12ad6a75f9400999",
      },
      requestId: "request-2",
      now,
    });

    expect(allowed).toMatchObject({
      allowed: true,
      context: {
        userId,
        userStatus: "active",
        permissions: [{ permission: "content.update", scope: "own" }],
      },
    });
    expect(denied).toEqual({ allowed: false, code: "PERMISSION_DENIED" });
  });

  it("does not let an own grant in one unit cross into another unit", () => {
    expect(
      evaluateContentPermission({
        session,
        snapshot: snapshot({
          businessUnitId: "66c84b2d12ad6a75f9400010",
        }),
        permission: "content.update",
        target: {
          resourceId: "content-1",
          ownerUserId: userId,
          businessUnitIds: ["66c84b2d12ad6a75f9400011"],
        },
        requestId: "request-cross-unit",
        now,
      }),
    ).toEqual({ allowed: false, code: "PERMISSION_DENIED" });
  });

  it("permits an own-scoped read listing while returning the limiting scope", () => {
    expect(
      evaluateContentPermission({
        session,
        snapshot: snapshot({ permission: "content.read" }),
        permission: "content.read",
        requestId: "request-list",
        now,
      }),
    ).toMatchObject({
      allowed: true,
      context: { permissions: [{ scope: "own" }] },
    });
  });

  it("requires a global all-scope grant for review and publish", () => {
    const ownReview = evaluateContentPermission({
      session,
      snapshot: snapshot({ permission: "content.review", scope: "own" }),
      permission: "content.review",
      target: { resourceId: "content-1", ownerUserId: userId },
      requestId: "request-review-own",
      now,
    });
    const globalPublish = evaluateContentPermission({
      session,
      snapshot: snapshot({ permission: "content.publish", scope: "all" }),
      permission: "content.publish",
      target: { resourceId: "content-1" },
      requestId: "request-publish-global",
      now,
    });

    expect(ownReview).toEqual({
      allowed: false,
      code: "PERMISSION_DENIED",
    });
    expect(globalPublish).toMatchObject({
      allowed: true,
      context: { permissions: [{ scope: "all" }] },
    });
  });

  it.each([
    snapshot({ grantStatus: "revoked" }),
    snapshot({ expiresAt: new Date("2026-08-24T03:59:59.000Z") }),
    snapshot({ roleActive: false }),
  ])("denies inactive, expired, or revoked authorization data", (data) => {
    expect(
      evaluateContentPermission({
        session,
        snapshot: data,
        permission: "content.update",
        target: { resourceId: "content-1", ownerUserId: userId },
        requestId: "request-inactive",
        now,
      }),
    ).toEqual({ allowed: false, code: "PERMISSION_DENIED" });
  });
});

function createGuardHarness(input: {
  resolution: SessionIdentityResolution;
  authorizationSnapshot?: AuthorizationSnapshot | null;
}) {
  const events: AuditEventInput[] = [];
  const auditRepository: AuditRepository = {
    append: vi.fn(async (event) => {
      events.push(event);
      return { id: "audit-1", occurredAt: now };
    }),
  };
  const authorizationRepository: AuthorizationRepository = {
    findSnapshotByUserId: vi.fn(
      async () => input.authorizationSnapshot ?? null,
    ),
  };
  const guard = createContentPermissionGuard({
    resolveSessionIdentity: vi.fn(async () => input.resolution),
    authorizationRepository,
    auditRepository,
    now: () => now,
    createRequestId: () => "request-fixed",
  });

  return { guard, events, authorizationRepository };
}

describe("deny-by-default content guard", () => {
  it("denies when OAuth is not configured and records a safe audit decision", async () => {
    const harness = createGuardHarness({ resolution: { configured: false } });

    await expect(harness.guard("content.create")).rejects.toMatchObject({
      message: "Access denied.",
      code: "AUTH_NOT_CONFIGURED",
    });
    expect(
      harness.authorizationRepository.findSnapshotByUserId,
    ).not.toHaveBeenCalled();
    expect(harness.events).toMatchObject([
      {
        actor: { type: "system", systemName: "authorization-guard" },
        action: "authorization.denied",
        permissionDecision: {
          permission: "content.create",
          outcome: "denied",
          reasonCode: "AUTH_NOT_CONFIGURED",
        },
      },
    ]);
  });

  it("denies a missing session without consulting authorization data", async () => {
    const harness = createGuardHarness({
      resolution: { configured: true, identity: null },
    });

    await expect(harness.guard("content.read")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(
      harness.authorizationRepository.findSnapshotByUserId,
    ).not.toHaveBeenCalled();
  });

  it("denies pending and suspended users after a current database read", async () => {
    for (const [status, code] of [
      ["pending", "USER_PENDING"],
      ["suspended", "USER_SUSPENDED"],
    ] as const) {
      const harness = createGuardHarness({
        resolution: { configured: true, identity: session },
        authorizationSnapshot: snapshot({ status }),
      });

      await expect(
        harness.guard("content.update", {
          resourceId: "content-1",
          ownerUserId: userId,
        }),
      ).rejects.toMatchObject({ code });
      expect(harness.events.at(-1)?.permissionDecision?.reasonCode).toBe(code);
    }
  });

  it("never converts an unavailable authorization store into access", async () => {
    const auditRepository: AuditRepository = {
      append: vi.fn(async () => ({ id: "audit-1", occurredAt: now })),
    };
    const guard = createContentPermissionGuard({
      resolveSessionIdentity: vi.fn(async () => ({
        configured: true,
        identity: session,
      })),
      authorizationRepository: {
        findSnapshotByUserId: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
      },
      auditRepository,
      now: () => now,
      createRequestId: () => "request-fixed",
    });

    await expect(guard("content.publish")).rejects.toMatchObject({
      code: "AUTHORIZATION_UNAVAILABLE",
    });
  });
});
