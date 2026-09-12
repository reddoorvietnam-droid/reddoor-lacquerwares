import { describe, expect, it } from "vitest";
import type {
  AuthorizationGrant,
  AuthorizationSnapshot,
} from "@/domains/identity/contracts";
import { activeRoleKeys } from "@/lib/auth/authorization";

const now = new Date("2026-09-11T04:00:00.000Z");

function snapshot(
  grants: Partial<AuthorizationGrant>[],
  inactiveRoles: string[] = [],
): AuthorizationSnapshot {
  const full = grants.map((grant, index): AuthorizationGrant => ({
    id: `grant-${index}`,
    roleKey: "DIRECTOR",
    businessUnitId: null,
    status: "active",
    expiresAt: null,
    ...grant,
  }));
  return {
    user: { id: "user-1", status: "active", authzVersion: 1 },
    roles: [...new Set(full.map(({ roleKey }) => roleKey))].map((key) => ({
      key,
      active: !inactiveRoles.includes(key),
      permissions: [],
    })),
    grants: full,
  };
}

describe("the roles a session actively holds", () => {
  it("names each live grant's role once, unit-bound grants included", () => {
    expect(
      activeRoleKeys(
        snapshot([
          { roleKey: "DIRECTOR" },
          { roleKey: "CONTENT_CREATOR" },
          { roleKey: "DIRECTOR", businessUnitId: "factory" },
        ]),
        now,
      ),
    ).toEqual(["DIRECTOR", "CONTENT_CREATOR"]);
  });

  it("drops revoked and expired grants", () => {
    expect(
      activeRoleKeys(
        snapshot([
          { roleKey: "DIRECTOR", status: "revoked" },
          { roleKey: "CONTENT_CREATOR", expiresAt: new Date("2026-09-01") },
          { roleKey: "WAREHOUSE_MANAGER", expiresAt: new Date("2026-12-31") },
        ]),
        now,
      ),
    ).toEqual(["WAREHOUSE_MANAGER"]);
  });

  it("drops a grant whose role is deactivated or missing", () => {
    const data = snapshot(
      [{ roleKey: "DIRECTOR" }, { roleKey: "FACTORY_MANAGER" }],
      ["DIRECTOR"],
    );
    const retired: AuthorizationGrant = {
      id: "grant-retired",
      roleKey: "SUPER_ADMIN",
      businessUnitId: null,
      status: "active",
      expiresAt: null,
    };
    expect(
      activeRoleKeys({ ...data, grants: [...data.grants, retired] }, now),
    ).toEqual(["FACTORY_MANAGER"]);
  });
});
