import { describe, expect, it } from "vitest";

import { isPermission, type Permission } from "@/domains/identity/permissions";
import {
  approvalDecidingRoleKeys,
  getRoleDefinitionSeed,
  roleDefinitionSeeds,
  systemRoleKeys,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";

const seeds: readonly {
  key: SystemRoleKey;
  permissions: readonly { permission: Permission }[];
}[] = roleDefinitionSeeds;

function permissionsOf(key: SystemRoleKey): ReadonlySet<Permission> {
  const seed = getRoleDefinitionSeed(key);
  if (!seed) {
    throw new Error(`No role seed for ${key}.`);
  }

  return new Set(seed.permissions.map((entry) => entry.permission));
}

function rolesGranting(permission: Permission): readonly SystemRoleKey[] {
  return seeds
    .filter((seed) =>
      seed.permissions.some((entry) => entry.permission === permission),
    )
    .map((seed) => seed.key)
    .sort();
}

const restrictedCommercialPermissions = [
  "orders.readSellingPrice",
  "products.readSellingPrice",
  "quotes.readSellingPrice",
  "finance.readProfit",
] as const satisfies readonly Permission[];

const commerciallyBlindRoles = [
  "PRODUCTION_UNIT",
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "SUPPLIER_MANAGER",
  "PRODUCT_DESIGNER",
] as const satisfies readonly SystemRoleKey[];

const operationalStaffRoles = [
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "SUPPLIER_MANAGER",
  "PRODUCT_DESIGNER",
  "COMPANY_ACCOUNTANT",
  "ORDER_MANAGER",
  "REPORT_VIEWER",
] as const satisfies readonly SystemRoleKey[];

describe("role seed integrity", () => {
  it("grants only catalogued permissions", () => {
    for (const seed of seeds) {
      for (const entry of seed.permissions) {
        expect(isPermission(entry.permission)).toBe(true);
      }
    }
  });

  it("defines exactly one seed per system role key", () => {
    expect(seeds).toHaveLength(systemRoleKeys.length);
    for (const key of systemRoleKeys) {
      expect(seeds.filter((seed) => seed.key === key)).toHaveLength(1);
      expect(getRoleDefinitionSeed(key)?.key).toBe(key);
    }
  });

  it.each(approvalDecidingRoleKeys)(
    "lets %s decide a Director approval",
    (key) => {
      expect(permissionsOf(key).has("approvals.decide")).toBe(true);
    },
  );
});

describe("selling price and profit stay with the Director and the accountant", () => {
  it.each(restrictedCommercialPermissions)(
    "grants %s to no role beyond Super Admin, Director, and Company Accountant",
    (permission) => {
      expect(rolesGranting(permission)).toEqual([
        "COMPANY_ACCOUNTANT",
        "DIRECTOR",
        "SUPER_ADMIN",
      ]);
    },
  );

  it.each(commerciallyBlindRoles)(
    "withholds every price and profit read from %s",
    (key) => {
      const permissions = permissionsOf(key);

      for (const permission of restrictedCommercialPermissions) {
        expect(permissions.has(permission)).toBe(false);
      }
    },
  );
});

describe("purchase price and ordinary reads are broad", () => {
  it.each(operationalStaffRoles)(
    "lets %s read purchase price and the product catalog",
    (key) => {
      const permissions = permissionsOf(key);

      expect(permissions.has("procurement.readPrice")).toBe(true);
      expect(permissions.has("products.read")).toBe(true);
    },
  );

  it("gives the two administrative roles the whole catalog they are entitled to", () => {
    const superAdmin = permissionsOf("SUPER_ADMIN");
    const director = permissionsOf("DIRECTOR");

    for (const permission of [
      "procurement.readPrice",
      "products.read",
    ] as const) {
      expect(superAdmin.has(permission)).toBe(true);
      expect(director.has(permission)).toBe(true);
    }
  });
});

describe("separation of duties", () => {
  it("lets the Factory Accountant submit cost but never release it", () => {
    const permissions = permissionsOf("FACTORY_ACCOUNTANT");

    expect(permissions.has("expenses.submit")).toBe(true);
    expect(permissions.has("expenses.approve")).toBe(false);
    expect(permissions.has("expenses.post")).toBe(false);
  });

  it("lets the Supplier Manager request price changes and advances, not approve them", () => {
    const permissions = permissionsOf("SUPPLIER_MANAGER");

    expect(permissions.has("procurement.requestPriceChange")).toBe(true);
    expect(permissions.has("procurement.requestAdvance")).toBe(true);
    expect(permissions.has("procurement.approvePriceChange")).toBe(false);
    expect(permissions.has("procurement.approveAdvance")).toBe(false);
  });

  it("lets the Order Manager request a price adjustment, not approve one", () => {
    const permissions = permissionsOf("ORDER_MANAGER");

    expect(permissions.has("orders.requestPriceAdjustment")).toBe(true);
    expect(permissions.has("orders.approvePriceAdjustment")).toBe(false);
  });

  it("keeps quality sign-off away from the unit doing the work", () => {
    expect(permissionsOf("PRODUCTION_UNIT").has("production.approveQc")).toBe(
      false,
    );
  });
});
