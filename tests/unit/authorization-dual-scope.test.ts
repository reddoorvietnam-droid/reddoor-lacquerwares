import { describe, expect, it } from "vitest";

import type { AuthorizationSnapshot } from "@/domains/identity/contracts";
import {
  evaluatePermission,
  grantCoverageForPermission,
} from "@/lib/auth/authorization";

/**
 * A role that names one permission at two scopes (`own` for personal
 * records, `assignedBusinessUnits` for the unit's) must contribute both
 * reaches, whichever the seed lists first. Before this held, only the first
 * entry counted and a globally granted Factory Manager saw nothing but
 * their own tasks.
 */
const now = new Date("2026-09-06T02:00:00.000Z");
const userId = "66c84b2d12ad6a75f9400001";
const unitId = "66c84b2d12ad6a75f9400010";

function snapshot(
  businessUnitId: string | null,
  order: "ownFirst" | "unitFirst",
): AuthorizationSnapshot {
  const entries = [
    { permission: "tasks.read", scope: "own" as const },
    { permission: "tasks.read", scope: "assignedBusinessUnits" as const },
  ];
  return {
    user: { id: userId, status: "active", authzVersion: 1 },
    grants: [
      {
        id: "66c84b2d12ad6a75f9400002",
        roleKey: "FACTORY_MANAGER",
        businessUnitId,
        status: "active",
        expiresAt: null,
      },
    ],
    roles: [
      {
        key: "FACTORY_MANAGER",
        active: true,
        permissions: order === "ownFirst" ? entries : [...entries].reverse(),
      },
    ],
  };
}

describe("a permission seeded at two scopes", () => {
  it.each(["ownFirst", "unitFirst"] as const)(
    "reaches every unit under a global grant regardless of seed order (%s)",
    (order) => {
      const coverage = grantCoverageForPermission(
        snapshot(null, order),
        "tasks.read",
        now,
      );
      expect(coverage.global).toBe(true);
    },
  );

  it.each(["ownFirst", "unitFirst"] as const)(
    "under a unit grant reaches the unit's records, keeps `own` inside the unit, and refuses other units (%s)",
    (order) => {
      const session = { userId, status: "active" as const, authzVersion: 1 };
      const unitRecord = evaluatePermission({
        session,
        snapshot: snapshot(unitId, order),
        permission: "tasks.read",
        target: {
          resourceId: "r1",
          businessUnitIds: [unitId],
          ownerUserId: "someone-else",
        },
        requestId: "r",
        now,
      });
      expect(unitRecord.allowed).toBe(true);
      // A unit-bound `own` grant covers the actor's records only inside the
      // unit; a record with no unit at all is out of reach. The task service
      // therefore stamps a unit-less personal task with the creator's units.
      const ownInUnit = evaluatePermission({
        session,
        snapshot: snapshot(unitId, order),
        permission: "tasks.read",
        target: {
          resourceId: "r2",
          businessUnitIds: [unitId],
          ownerUserId: userId,
        },
        requestId: "r",
        now,
      });
      expect(ownInUnit.allowed).toBe(true);
      const ownWithoutUnit = evaluatePermission({
        session,
        snapshot: snapshot(unitId, order),
        permission: "tasks.read",
        target: { resourceId: "r2b", businessUnitIds: [], ownerUserId: userId },
        requestId: "r",
        now,
      });
      expect(ownWithoutUnit.allowed).toBe(false);
      const foreign = evaluatePermission({
        session,
        snapshot: snapshot(unitId, order),
        permission: "tasks.read",
        target: {
          resourceId: "r3",
          businessUnitIds: ["66c84b2d12ad6a75f9400099"],
          ownerUserId: "someone-else",
        },
        requestId: "r",
        now,
      });
      expect(foreign.allowed).toBe(false);
    },
  );
});
