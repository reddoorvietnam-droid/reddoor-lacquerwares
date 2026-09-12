import { describe, expect, it, vi } from "vitest";
import { roleDefinitionSeeds } from "@/domains/identity/role-definitions";
import { evaluatePermission } from "@/lib/auth/authorization";
import type { AuthorizationSnapshot } from "@/domains/identity/contracts";
import { createPermissionGuard } from "@/lib/auth/guard";
import {
  assertSampleProgressRole,
  sampleProgressRole,
} from "@/domains/sample-progress/access";

const session = {
  userId: "editor",
  status: "active" as const,
  authzVersion: 1,
};

function snapshot(...roleKeys: string[]): AuthorizationSnapshot {
  return {
    user: { id: session.userId, status: "active", authzVersion: 1 },
    roles: roleDefinitionSeeds.map((role) => ({
      key: role.key,
      active: true,
      permissions: [...role.permissions],
    })),
    grants: (roleKeys.length ? roleKeys : ["CONTENT_CREATOR"]).map(
      (roleKey, index) => ({
        id: `grant-${index}`,
        roleKey,
        status: "active" as const,
        businessUnitId: null,
        expiresAt: null,
      }),
    ),
  };
}

function evaluate(data: AuthorizationSnapshot) {
  return evaluatePermission({
    session,
    snapshot: data,
    permission: "content.read",
    requestId: "test",
    now: new Date(),
  });
}

function contextFor(...roleKeys: string[]) {
  const decision = evaluate(snapshot(...roleKeys));
  if (!decision.allowed) throw new Error("expected the grant to be allowed");
  return decision.context;
}

describe("only the director and the content creator reach sample progress", () => {
  it.each(roleDefinitionSeeds.map((role) => role.key))(
    "checks the seeded role %s",
    (role) => {
      const decision = evaluate(snapshot(role));
      const allowed = role === "DIRECTOR" || role === "CONTENT_CREATOR";
      expect(decision.allowed).toBe(allowed);
      if (decision.allowed)
        // Every role that clears the permission must still clear the allowlist.
        expect(() => assertSampleProgressRole(decision.context)).not.toThrow();
    },
  );

  it.each([
    "FACTORY_MANAGER",
    "WAREHOUSE_MANAGER",
    "FACTORY_ACCOUNTANT",
    "COMPANY_ACCOUNTANT",
  ])(
    "denies %s at the allowlist even if it somehow held content.read",
    (roleKey) => {
      const data = snapshot(roleKey);
      data.roles = data.roles.map((role) =>
        role.key === roleKey
          ? {
              ...role,
              permissions: [{ permission: "content.read", scope: "all" }],
            }
          : role,
      );
      const decision = evaluate(data);
      expect(decision.allowed).toBe(true);
      if (decision.allowed)
        expect(() => assertSampleProgressRole(decision.context)).toThrow(
          "Access denied",
        );
    },
  );

  it("rejects a brand-new role even if someone grants it content.read", () => {
    const data = snapshot("CUSTOM_EDITOR");
    data.roles = [
      ...data.roles,
      {
        key: "CUSTOM_EDITOR",
        active: true,
        permissions: [{ permission: "content.read", scope: "all" }],
      },
    ];
    const decision = evaluate(data);
    expect(decision.allowed).toBe(true);
    if (decision.allowed)
      expect(() => assertSampleProgressRole(decision.context)).toThrow(
        "Access denied",
      );
  });

  it.each([
    "revoked",
    "expired",
    "suspended",
    "pending",
    "stale",
    "inactive",
    "unit",
  ])(
    "rejects %s authorization before the allowlist is reached",
    (condition) => {
      const data = snapshot();
      if (condition === "revoked") data.grants[0]!.status = "revoked";
      if (condition === "expired")
        data.grants[0]!.expiresAt = new Date("2000-01-01");
      if (condition === "suspended" || condition === "pending")
        data.user.status = condition;
      if (condition === "stale") data.user.authzVersion = 2;
      if (condition === "inactive")
        data.roles = data.roles.map((role) => ({ ...role, active: false }));
      if (condition === "unit") data.grants[0]!.businessUnitId = "factory";
      const decision = evaluate(data);
      expect(decision.allowed).toBe(false);
      // The guard denies first, so no context ever reaches the role check.
      if (!decision.allowed) expect(decision.code).toBeTruthy();
    },
  );

  it("never treats a dev-open-access context as an allowed role", async () => {
    const guard = createPermissionGuard({
      resolveSessionIdentity: async () => ({
        configured: true,
        identity: session,
      }),
      authorizationRepository: { findSnapshotByUserId: async () => snapshot() },
      auditRepository: { append: vi.fn() },
      openAccess: () => true,
    });
    const context = await guard("content.read");
    // The bypass stamps the sentinel role key, never DIRECTOR or CONTENT_CREATOR.
    expect(context.permissions[0]!.roleKeys).toEqual(["DEV_OPEN_ACCESS"]);
    expect(() => assertSampleProgressRole(context)).toThrow("Access denied");
    expect(() => sampleProgressRole(context)).toThrow("Access denied");
  });
});

describe("the director and the content creator both maintain the report", () => {
  it("gives the content creator edit rights", () => {
    expect(sampleProgressRole(contextFor("CONTENT_CREATOR"))).toBe("editor");
  });

  it("gives the director edit rights too", () => {
    expect(sampleProgressRole(contextFor("DIRECTOR"))).toBe("editor");
  });

  it("treats someone holding both roles as an editor", () => {
    expect(sampleProgressRole(contextFor("DIRECTOR", "CONTENT_CREATOR"))).toBe(
      "editor",
    );
    expect(sampleProgressRole(contextFor("CONTENT_CREATOR", "DIRECTOR"))).toBe(
      "editor",
    );
  });

  it("refuses a context carrying no usable permission entry", () => {
    expect(() =>
      sampleProgressRole({
        actorType: "user",
        userId: "someone",
        userStatus: "active",
        permissions: [],
        authzVersion: 1,
        requestId: "test",
      }),
    ).toThrow("Access denied");
  });

  it("refuses a context whose grant is not global", () => {
    expect(() =>
      sampleProgressRole({
        actorType: "user",
        userId: "someone",
        userStatus: "active",
        permissions: [
          {
            permission: "content.read",
            scope: "assignedBusinessUnits",
            businessUnitIds: ["factory"],
            roleKeys: ["CONTENT_CREATOR"],
          },
        ],
        authzVersion: 1,
        requestId: "test",
      }),
    ).toThrow("Access denied");
  });
});
