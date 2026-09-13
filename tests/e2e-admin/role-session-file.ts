// Shared by the Playwright process (helpers.ts) and the tsx provisioning
// script (role-sessions.ts). Deliberately free of imports: the spec side must
// not load the database modules, which import "server-only".

/** Where the global setup leaves one session cookie value per role. */
export const roleSessionFile = ".e2e-auth/role-sessions.json";

/**
 * Reserved `.local` domain for the E2E role accounts. No Google sign-in can
 * carry it, and the staff list, the Director bootstrap and the staff rules
 * all treat it as an internal test account (see `staff-policy.ts`).
 */
export const e2eAccountDomain = "e2e.reddoor.local";

export const e2eRoleKeys = [
  "DIRECTOR",
  "WAREHOUSE_MANAGER",
  "FACTORY_MANAGER",
  "FACTORY_ACCOUNTANT",
  "COMPANY_ACCOUNTANT",
  "CONTENT_CREATOR",
] as const;

export type RoleKey = (typeof e2eRoleKeys)[number];
