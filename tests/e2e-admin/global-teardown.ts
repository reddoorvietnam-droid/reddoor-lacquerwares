import { execSync } from "node:child_process";

/** Locks the role accounts again, voiding every cookie the run used. */
export default function globalTeardown(): void {
  execSync(
    "npx tsx --env-file-if-exists=.env --conditions=react-server tests/e2e-admin/role-sessions.ts close",
    { stdio: "inherit" },
  );
}
