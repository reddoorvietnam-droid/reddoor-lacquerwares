import { execSync } from "node:child_process";

const baseURL = process.env.E2E_ADMIN_BASE_URL ?? "http://localhost:3000";

/** Opens one signed-in session per role for the run (see role-sessions.ts). */
export default async function globalSetup(): Promise<void> {
  // Without Google sign-in configured the portal locks itself, and every test
  // would only time out waiting for the menu. Say so before anything runs.
  const response = await fetch(`${baseURL}/vi/admin/sign-in`).catch(() => null);
  if (!response) {
    throw new Error(
      `No server answers at ${baseURL}; start npm run dev first.`,
    );
  }
  if ((await response.text()).includes("CMS đang khóa an toàn")) {
    throw new Error(
      "The server has no Google sign-in configured (AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET). " +
        "No Google round trip happens in these tests, so placeholder values are enough.",
    );
  }

  execSync(
    "npx tsx --env-file-if-exists=.env --conditions=react-server tests/e2e-admin/role-sessions.ts open",
    { stdio: "inherit" },
  );
}
