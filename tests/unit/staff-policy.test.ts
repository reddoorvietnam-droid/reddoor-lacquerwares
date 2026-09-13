import { describe, expect, it } from "vitest";

import { requiresGlobalGrant } from "@/domains/identity/permissions";
import {
  allowedStaffCommands,
  assertStaffCommand,
  assignableRoleKeys,
  isInternalAccountEmail,
  StaffCommandError,
  type StaffCommand,
  type StaffMember,
} from "@/domains/identity/staff-policy";

const actorUserId = "d".repeat(24);

function member(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: "a".repeat(24),
    email: "nhanvien@gmail.com",
    displayName: "Nhân viên",
    status: "pending",
    roleKeys: [],
    authzVersion: 3,
    createdAt: null,
    lastLoginAt: null,
    suspendedAt: null,
    ...overrides,
  };
}

function refusal(
  account: StaffMember | null,
  command: StaffCommand,
  expectedAuthzVersion = account?.authzVersion ?? 1,
): string | null {
  try {
    assertStaffCommand(account, command, { actorUserId, expectedAuthzVersion });
    return null;
  } catch (error) {
    if (error instanceof StaffCommandError) return error.code;
    throw error;
  }
}

const approve = (roleKey: string): StaffCommand => ({
  kind: "approve",
  roleKey,
});
const changeRole = (roleKey: string): StaffCommand => ({
  kind: "changeRole",
  roleKey,
});

describe("the roles the Director hands out", () => {
  it("are every position except the Director's own", () => {
    expect(assignableRoleKeys).toEqual([
      "FACTORY_MANAGER",
      "WAREHOUSE_MANAGER",
      "FACTORY_ACCOUNTANT",
      "COMPANY_ACCOUNTANT",
      "CONTENT_CREATOR",
    ]);
  });

  it("take a global grant to change anyone's access", () => {
    for (const permission of [
      "users.activate",
      "users.suspend",
      "users.manageRoles",
    ] as const) {
      expect(requiresGlobalGrant(permission)).toBe(true);
    }
  });
});

describe("which actions a row offers", () => {
  it.each([
    ["pending", ["approve", "reject"]],
    ["active", ["changeRole", "suspend"]],
    ["suspended", ["unlock"]],
  ] as const)("a %s account offers %j", (status, expected) => {
    expect(
      allowedStaffCommands(
        member({ status, roleKeys: ["WAREHOUSE_MANAGER"] }),
        actorUserId,
      ),
    ).toEqual(expected);
  });

  it.each([
    ["the actor's own account", member({ id: actorUserId, status: "active" })],
    ["the Director", member({ status: "active", roleKeys: ["DIRECTOR"] })],
    [
      "a retired role-preview account",
      member({ email: "admin@dev-preview.reddoor.local", status: "active" }),
    ],
    [
      "an E2E role account",
      member({ email: "director@e2e.reddoor.local", status: "active" }),
    ],
  ])("offers nothing on %s", (_label, account) => {
    expect(allowedStaffCommands(account, actorUserId)).toEqual([]);
  });
});

describe("approving a first Gmail sign-in", () => {
  it("returns the one role the account will hold", () => {
    expect(
      assertStaffCommand(member(), approve("WAREHOUSE_MANAGER"), {
        actorUserId,
        expectedAuthzVersion: 3,
      }),
    ).toBe("WAREHOUSE_MANAGER");
  });

  it.each([
    "DIRECTOR",
    "SUPER_ADMIN",
    "ORDER_MANAGER",
    "",
    "warehouse_manager",
  ])("refuses the role %j", (roleKey) => {
    expect(refusal(member(), approve(roleKey))).toBe("INVALID_ROLE");
  });

  it("refuses an account that is no longer pending", () => {
    expect(
      refusal(
        member({ status: "active", roleKeys: ["FACTORY_MANAGER"] }),
        approve("WAREHOUSE_MANAGER"),
      ),
    ).toBe("INVALID_STATE");
  });

  it("refuses a page rendered before someone else changed the account", () => {
    expect(refusal(member(), approve("WAREHOUSE_MANAGER"), 2)).toBe(
      "REVISION_CONFLICT",
    );
  });

  it("refuses an account that no longer exists", () => {
    expect(refusal(null, approve("WAREHOUSE_MANAGER"))).toBe("NOT_FOUND");
  });
});

describe("the accounts no command may touch", () => {
  const commands: StaffCommand[] = [
    approve("WAREHOUSE_MANAGER"),
    { kind: "reject" },
    changeRole("WAREHOUSE_MANAGER"),
    { kind: "suspend" },
    { kind: "unlock", roleKey: "WAREHOUSE_MANAGER" },
  ];

  it.each(commands)("the actor's own account refuses $kind", (command) => {
    expect(refusal(member({ id: actorUserId }), command)).toBe("SELF");
  });

  it.each(commands)("the Director refuses $kind", (command) => {
    expect(
      refusal(member({ status: "active", roleKeys: ["DIRECTOR"] }), command),
    ).toBe("DIRECTOR_PROTECTED");
    // A second role alongside does not make the Director manageable.
    expect(
      refusal(
        member({
          status: "active",
          roleKeys: ["WAREHOUSE_MANAGER", "DIRECTOR"],
        }),
        command,
      ),
    ).toBe("DIRECTOR_PROTECTED");
  });

  it.each(commands)("an internal test account refuses $kind", (command) => {
    for (const email of [
      "Company_Accountant@Dev-Preview.Reddoor.Local",
      "director@e2e.reddoor.local",
    ]) {
      expect(refusal(member({ email }), command), email).toBe("TEST_ACCOUNT");
    }
  });

  it("recognises internal accounts by their exact reserved domain", () => {
    expect(isInternalAccountEmail("warehouse_manager@E2E.reddoor.local")).toBe(
      true,
    );
    for (const email of [
      "reddoorvietnam@gmail.com",
      "x@notdev-preview.reddoor.local",
      "x@e2e.reddoor.local.example.com",
    ]) {
      expect(isInternalAccountEmail(email), email).toBe(false);
    }
  });

  it("names the protection even on a stale page", () => {
    expect(
      refusal(
        member({ status: "active", roleKeys: ["DIRECTOR"] }),
        { kind: "suspend" },
        1,
      ),
    ).toBe("DIRECTOR_PROTECTED");
  });
});

describe("changing a working account's role", () => {
  const working = member({ status: "active", roleKeys: ["FACTORY_MANAGER"] });

  it("returns the new role", () => {
    expect(
      assertStaffCommand(working, changeRole("CONTENT_CREATOR"), {
        actorUserId,
        expectedAuthzVersion: 3,
      }),
    ).toBe("CONTENT_CREATOR");
  });

  it("refuses the role the account already holds", () => {
    expect(refusal(working, changeRole("FACTORY_MANAGER"))).toBe(
      "ROLE_UNCHANGED",
    );
  });

  it("collapses an older two-role account onto one of them", () => {
    expect(
      refusal(
        member({
          status: "active",
          roleKeys: ["FACTORY_MANAGER", "COMPANY_ACCOUNTANT"],
        }),
        changeRole("FACTORY_MANAGER"),
      ),
    ).toBeNull();
  });

  it("refuses a pending or locked account", () => {
    expect(refusal(member(), changeRole("CONTENT_CREATOR"))).toBe(
      "INVALID_STATE",
    );
    expect(
      refusal(
        member({ status: "suspended", roleKeys: ["FACTORY_MANAGER"] }),
        changeRole("CONTENT_CREATOR"),
      ),
    ).toBe("INVALID_STATE");
  });
});

describe("locking, unlocking and rejecting", () => {
  it("locks a working account without touching its role", () => {
    expect(
      assertStaffCommand(
        member({ status: "active", roleKeys: ["FACTORY_MANAGER"] }),
        { kind: "suspend" },
        { actorUserId, expectedAuthzVersion: 3 },
      ),
    ).toBeNull();
    expect(refusal(member(), { kind: "suspend" })).toBe("INVALID_STATE");
  });

  it("unlocks with the role the account kept, ignoring any other pick", () => {
    expect(
      assertStaffCommand(
        member({ status: "suspended", roleKeys: ["FACTORY_MANAGER"] }),
        { kind: "unlock", roleKey: "CONTENT_CREATOR" },
        { actorUserId, expectedAuthzVersion: 3 },
      ),
    ).toBeNull();
  });

  it("asks for a role when a locked account has none to keep", () => {
    const roleless = member({ status: "suspended", roleKeys: [] });
    expect(refusal(roleless, { kind: "unlock", roleKey: null })).toBe(
      "ROLE_REQUIRED",
    );
    expect(refusal(roleless, { kind: "unlock", roleKey: "DIRECTOR" })).toBe(
      "INVALID_ROLE",
    );
    expect(
      assertStaffCommand(
        roleless,
        { kind: "unlock", roleKey: "COMPANY_ACCOUNTANT" },
        { actorUserId, expectedAuthzVersion: 3 },
      ),
    ).toBe("COMPANY_ACCOUNTANT");
  });

  it("rejects only a pending account", () => {
    expect(refusal(member(), { kind: "reject" })).toBeNull();
    expect(
      refusal(member({ status: "active", roleKeys: ["FACTORY_MANAGER"] }), {
        kind: "reject",
      }),
    ).toBe("INVALID_STATE");
    expect(refusal(member({ status: "suspended" }), { kind: "reject" })).toBe(
      "INVALID_STATE",
    );
  });
});
