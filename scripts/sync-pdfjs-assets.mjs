/**
 * Copies pdf.js decoder assets into `public/pdfjs/`.
 *
 * pdf.js decodes JPEG-2000 and JBIG2 images and applies ICC colour profiles in
 * WebAssembly, and resolves CJK text through CMap files. Those files are
 * fetched at runtime from same-origin URLs; without them every such image
 * renders silently blank while text and vector fills still appear.
 *
 * The copies are generated, git-ignored, and version-locked to the installed
 * `pdfjs-dist` by running this before `dev` and `build` — a stale hand copy
 * after an upgrade would reintroduce the blank-image bug without any error.
 */

import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const packageRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = require("pdfjs-dist/package.json");

const target = path.resolve("public/pdfjs");
const directories = ["wasm", "cmaps", "iccs", "standard_fonts"];

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const directory of directories) {
  cpSync(path.join(packageRoot, directory), path.join(target, directory), {
    recursive: true,
  });
}

// Recorded so a mismatch is diagnosable from the deployed site alone.
writeFileSync(
  path.join(target, "VERSION.txt"),
  `pdfjs-dist ${version}\n`,
  "utf8",
);

console.info(`Synchronised pdf.js ${version} assets into public/pdfjs.`);
