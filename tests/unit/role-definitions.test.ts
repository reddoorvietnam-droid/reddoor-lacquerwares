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
  // Revenue is recognised per invoice, and a customer receipt or receivable
  // reveals the price it settles, so these stay with the same two roles.
  "invoices.read",
  "invoices.manage",
  "payments.read",
  "payments.record",
  "receivables.read",
  "customers.read",
] as const satisfies readonly Permission[];

const commerciallyBlindRoles = [
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
] as const satisfies readonly SystemRoleKey[];

const operationalStaffRoles = [
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
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
    "grants %s to no role beyond the Director and the Company Accountant",
    (permission) => {
      expect(rolesGranting(permission)).toEqual([
        "COMPANY_ACCOUNTANT",
        "DIRECTOR",
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

  it("gives the Director the whole catalog they are entitled to", () => {
    const director = permissionsOf("DIRECTOR");

    for (const permission of [
      "procurement.readPrice",
      "products.read",
    ] as const) {
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

  it("lets the Factory Accountant record actual factory cost without seeing any customer money", () => {
    const permissions = permissionsOf("FACTORY_ACCOUNTANT");

    expect(permissions.has("expenses.create")).toBe(true);
    expect(permissions.has("expenses.read")).toBe(true);
    for (const permission of [
      "payments.read",
      "payments.record",
      "payments.refund",
      "receivables.read",
      "invoices.read",
      "customers.read",
      "orders.updateExportProgress",
    ] as const) {
      expect(permissions.has(permission)).toBe(false);
    }
  });

  it("keeps the order file's export progress and invoices with the Company Accountant", () => {
    const permissions = permissionsOf("COMPANY_ACCOUNTANT");

    for (const permission of [
      "orders.updateExportProgress",
      "invoices.manage",
      "payments.record",
      "payments.refund",
      "finance.manageFxSnapshot",
      "customers.create",
      "customers.update",
    ] as const) {
      expect(permissions.has(permission)).toBe(true);
    }
  });

  it("lets the Factory Accountant request price changes and advances, not approve them", () => {
    const permissions = permissionsOf("FACTORY_ACCOUNTANT");

    expect(permissions.has("procurement.requestPriceChange")).toBe(true);
    expect(permissions.has("procurement.requestAdvance")).toBe(true);
    expect(permissions.has("procurement.approvePriceChange")).toBe(false);
    expect(permissions.has("procurement.approveAdvance")).toBe(false);
  });

  it("keeps the final say on price with the Director even though the Company Accountant holds both sides", () => {
    const permissions = permissionsOf("COMPANY_ACCOUNTANT");

    // The former Order Manager merged in, so the same role requests and
    // approves a price adjustment; the Director approval gate on every price
    // change stays the outside check.
    expect(permissions.has("orders.requestPriceAdjustment")).toBe(true);
    expect(permissions.has("orders.approvePriceAdjustment")).toBe(true);
    expect(permissions.has("approvals.decide")).toBe(false);
  });

  it("keeps quality sign-off away from the warehouse", () => {
    expect(permissionsOf("WAREHOUSE_MANAGER").has("production.approveQc")).toBe(
      false,
    );
  });
});

describe("the Content Creator publishes the website and nothing else", () => {
  const creator = permissionsOf("CONTENT_CREATOR");

  it("holds the full editorial workflow at global scope", () => {
    const seed = getRoleDefinitionSeed("CONTENT_CREATOR");
    for (const permission of [
      "content.read",
      "content.create",
      "content.update",
      "content.publish",
      "content.archive",
      "media.upload",
      "shop.manage",
      "shop.publish",
    ] as const) {
      expect(creator.has(permission)).toBe(true);
    }
    expect(seed?.permissions.every((entry) => entry.scope === "all")).toBe(
      true,
    );
  });

  it("never sees orders, prices, or finance", () => {
    for (const permission of [
      "orders.read",
      "shopOrders.read",
      "shopOrders.manage",
      "products.readSellingPrice",
      "products.readCost",
      "finance.readProfit",
      "payments.read",
      "users.read",
    ] as const) {
      expect(creator.has(permission)).toBe(false);
    }
  });

  it("leaves shop orders with the Director and the Company Accountant", () => {
    expect(rolesGranting("shopOrders.manage")).toEqual([
      "COMPANY_ACCOUNTANT",
      "DIRECTOR",
    ]);
    expect(rolesGranting("shop.publish")).toEqual([
      "CONTENT_CREATOR",
      "DIRECTOR",
    ]);
  });
});
