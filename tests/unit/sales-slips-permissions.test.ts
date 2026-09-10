import { describe, expect, it } from "vitest";
import {
  permissionCatalog,
  sensitiveFieldPermissions,
} from "@/domains/identity/permissions";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";
import { capabilityActions } from "@/domains/sales-slips/contracts";

const salesSlipPermissions = capabilityActions.map(
  (action) => `salesSlips.${action}` as const,
);

describe("sales slip permissions", () => {
  it("are all part of the catalog, one per capability", () => {
    for (const permission of salesSlipPermissions)
      expect(permissionCatalog).toContain(permission);
    expect(
      permissionCatalog.filter((p) => p.startsWith("salesSlips.")),
    ).toHaveLength(salesSlipPermissions.length);
    expect(sensitiveFieldPermissions).toContain("salesSlips.readPrice");
  });

  it.each(["COMPANY_ACCOUNTANT", "DIRECTOR"] as const)(
    "%s holds every sales slip permission at scope all (rule 1: selling price)",
    (role) => {
      const permissions = getRoleDefinitionSeed(role)?.permissions ?? [];
      for (const permission of salesSlipPermissions)
        expect(permissions).toContainEqual({ permission, scope: "all" });
    },
  );

  it("WAREHOUSE_MANAGER owns the slip flow (everything but the workbook import)", () => {
    const permissions =
      getRoleDefinitionSeed("WAREHOUSE_MANAGER")?.permissions ?? [];
    for (const action of capabilityActions.filter((a) => a !== "import"))
      expect(permissions).toContainEqual({
        permission: `salesSlips.${action}`,
        scope: "all",
      });
    expect(permissions.some((p) => p.permission === "salesSlips.import")).toBe(
      false,
    );
  });

  it.each([
    "FACTORY_MANAGER",
    "FACTORY_ACCOUNTANT",
    "CONTENT_CREATOR",
  ] as const)("%s holds no sales slip permission", (role) => {
    const seed = getRoleDefinitionSeed(role);
    expect(seed).toBeDefined();
    expect(
      seed?.permissions.some((p) => p.permission.startsWith("salesSlips.")),
    ).toBe(false);
  });
});
