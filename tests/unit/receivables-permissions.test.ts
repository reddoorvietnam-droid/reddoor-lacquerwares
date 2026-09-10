import { describe, expect, it } from "vitest";
import {
  permissionCatalog,
  sensitiveFieldPermissions,
} from "@/domains/identity/permissions";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";
import { capabilityActions } from "@/domains/receivables/contracts";

const debtPermissions = capabilityActions.map(
  (action) => `customerDebt.${action}`,
);

describe("customer debt permissions", () => {
  it("cover exactly the module's capability actions", () => {
    for (const permission of debtPermissions)
      expect(permissionCatalog).toContain(permission);
    expect(
      permissionCatalog.filter((p) => p.startsWith("customerDebt.")),
    ).toHaveLength(debtPermissions.length);
  });

  it("treats the money permission as a sensitive field", () => {
    // Reading the module never implies reading the amounts on it.
    expect(sensitiveFieldPermissions).toContain("customerDebt.readAmount");
  });

  it("stays distinct from the order/INV receivables permission", () => {
    // Two ledgers, two counterparty sets; sharing a permission would let a
    // grant on one silently open the other.
    expect(permissionCatalog).toContain("receivables.read");
    expect(debtPermissions).not.toContain("receivables.read");
  });

  it.each(["DIRECTOR", "COMPANY_ACCOUNTANT"] as const)(
    "%s holds every customer-debt permission at scope all",
    (role) => {
      const permissions = getRoleDefinitionSeed(role)?.permissions ?? [];
      for (const permission of debtPermissions)
        expect(permissions).toContainEqual({ permission, scope: "all" });
    },
  );

  it("gives the storekeeper the counter's own actions", () => {
    const permissions =
      getRoleDefinitionSeed("WAREHOUSE_MANAGER")?.permissions ?? [];
    for (const action of [
      "read",
      "readAmount",
      "recordSale",
      "recordReduction",
      // Correcting a line and adding a paint code are the counter's own work.
      "updateEntry",
      "cancelEntry",
      "manageCatalog",
      "manageCustomer",
      "export",
    ])
      expect(permissions).toContainEqual({
        permission: `customerDebt.${action}`,
        scope: "all",
      });
  });

  it("keeps the opening balance and the import away from the storekeeper", () => {
    // Restating a period's opening balance, and re-running the workbook
    // migration, belong to the accountant and the Director.
    const permissions =
      getRoleDefinitionSeed("WAREHOUSE_MANAGER")?.permissions ?? [];
    const held = permissions.map((p) => p.permission);
    expect(held).not.toContain("customerDebt.updateOpeningBalance");
    expect(held).not.toContain("customerDebt.import");
  });

  it.each([
    "FACTORY_ACCOUNTANT",
    "FACTORY_MANAGER",
    "CONTENT_CREATOR",
  ] as const)("%s holds no customer-debt permission", (role) => {
    const seed = getRoleDefinitionSeed(role);
    expect(seed).toBeDefined();
    expect(
      seed?.permissions.some((p) => p.permission.startsWith("customerDebt.")),
    ).toBe(false);
  });
});
