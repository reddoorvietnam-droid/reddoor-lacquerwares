import { describe, expect, it } from "vitest";
import { permissionCatalog } from "@/domains/identity/permissions";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";

const materialsPermissions = [
  "materials.read",
  "materials.manageCatalog",
  "materials.receive",
  "materials.issue",
  "materials.cancel",
  "materials.export",
  "materials.import",
] as const;

describe("materials permissions", () => {
  it("are all part of the catalog", () => {
    for (const permission of materialsPermissions)
      expect(permissionCatalog).toContain(permission);
    expect(
      permissionCatalog.filter((p) => p.startsWith("materials.")),
    ).toHaveLength(materialsPermissions.length);
  });

  it.each(["WAREHOUSE_MANAGER", "DIRECTOR"] as const)(
    "%s holds every materials permission at scope all",
    (role) => {
      const permissions = getRoleDefinitionSeed(role)?.permissions ?? [];
      for (const permission of materialsPermissions)
        expect(permissions).toContainEqual({ permission, scope: "all" });
    },
  );

  it.each([
    "CONTENT_CREATOR",
    "FACTORY_MANAGER",
    "FACTORY_ACCOUNTANT",
    "COMPANY_ACCOUNTANT",
  ] as const)("%s holds no materials permission", (role) => {
    const seed = getRoleDefinitionSeed(role);
    expect(seed).toBeDefined();
    expect(
      seed?.permissions.some((p) => p.permission.startsWith("materials.")),
    ).toBe(false);
  });
});
