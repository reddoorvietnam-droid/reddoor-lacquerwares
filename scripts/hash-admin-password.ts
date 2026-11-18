/**
 * Prints the `ADMIN_PASSWORD_HASH` for the shared password sign-in.
 *
 *   npm run auth:hash-password
 *
 * The password is read from standard input (typed, or piped in) so it never
 * lands in shell history. Put the printed line in `.env` and in the Vercel
 * project's environment, next to `ADMIN_PASSWORD_USERNAME`.
 */

import { createInterface } from "node:readline/promises";

import { hashPassword } from "@/lib/auth/password-hash";

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    let piped = "";
    for await (const chunk of process.stdin) piped += String(chunk);
    return piped.replace(/\r?\n$/, "");
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  const typed = await prompt.question("Password: ");
  prompt.close();
  return typed;
}

async function main(): Promise<void> {
  const password = await readPassword();

  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exitCode = 1;
    return;
  }

  console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
}

void main();
