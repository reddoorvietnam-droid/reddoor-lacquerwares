#!/usr/bin/env node
/**
 * One-command public demo: opens a Cloudflare quick tunnel, builds the app with
 * the tunnel hostname baked in (canonical/OG/sitemap), then serves it.
 *
 * Quick tunnels get a new random hostname on every run, and NEXT_PUBLIC_SITE_URL
 * is inlined at build time — so the tunnel must come up before `next build`.
 *
 * Usage: node scripts/demo-tunnel.mjs [--port 3000] [--skip-build]
 */
import { spawn } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);
const port = args.includes("--port")
  ? args[args.indexOf("--port") + 1]
  : "3000";
const skipBuild = args.includes("--skip-build");

const children = [];
function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function run(command, commandArgs, options = {}) {
  const child = spawn(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  children.push(child);
  return child;
}

function startTunnel() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cloudflared",
      ["tunnel", "--url", `http://localhost:${port}`],
      { shell: process.platform === "win32" },
    );
    children.push(child);

    const timer = setTimeout(
      () => reject(new Error("cloudflared did not report a URL within 60s")),
      60_000,
    );

    const scan = (buffer) => {
      const text = String(buffer);
      process.stderr.write(text);
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };

    child.stdout.on("data", scan);
    child.stderr.on("data", scan);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`cloudflared exited with code ${code}`));
    });
  });
}

function waitForExit(child, label) {
  return new Promise((resolve, reject) => {
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${label} exited with code ${code}`)),
    );
  });
}

const url = await startTunnel();
const env = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: url,
  NEXTAUTH_URL: url,
};

if (!skipBuild) {
  console.log(`\n▶ Building with NEXT_PUBLIC_SITE_URL=${url}\n`);
  await waitForExit(run("npm", ["run", "build"], { env }), "next build");
}

console.log(`\n▶ Serving on ${url}\n`);
const server = run("npx", ["next", "start", "-p", port], { env });
await waitForExit(server, "next start").catch((error) => {
  console.error(error.message);
  shutdown(1);
});
