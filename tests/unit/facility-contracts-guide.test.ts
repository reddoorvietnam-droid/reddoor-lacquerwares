import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import type { Route } from "next";
import { describe, expect, it } from "vitest";

import { adminNavSeeds } from "@/components/admin/admin-nav-model";
import { facilityContractScreens } from "@/components/admin/guide/screens/facility-contracts";

const basePath = "/vi/admin" as Route;
const pageDir = join(
  process.cwd(),
  "src/app/[locale]/admin/(portal)/facility-contracts",
);

function sourcesIn(directory: string): string {
  return readdirSync(directory)
    .map((name) => join(directory, name))
    .map((path) =>
      statSync(path).isDirectory()
        ? sourcesIn(path)
        : readFileSync(path, "utf8"),
    )
    .join("\n");
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object")
    return Object.entries(value)
      .filter(([key]) => key !== "roles" && key !== "path")
      .flatMap(([, entry]) => stringsIn(entry));
  return [];
}

describe("the site-contract guide", () => {
  const [screen] = facilityContractScreens;

  it("describes the menu entry under its exact label", () => {
    const label = adminNavSeeds("vi", basePath)
      .flatMap(({ items }) => items)
      .find(({ href }) => href === `${basePath}/facility-contracts`)?.label;
    expect(facilityContractScreens).toHaveLength(1);
    expect(screen?.path).toBe("/facility-contracts");
    expect(screen?.title).toBe(label);
  });

  it("tags entries only with the three positions working on the screen", () => {
    const allowed = [
      "FACTORY_MANAGER",
      "FACTORY_ACCOUNTANT",
      "COMPANY_ACCOUNTANT",
    ];
    const tagged = [
      ...screen!.layout,
      ...screen!.capabilities,
      ...screen!.limits,
      ...screen!.flows,
      ...screen!.terms,
      ...screen!.tips,
    ].flatMap(({ roles }) => roles ?? []);
    for (const role of tagged) expect(allowed).toContain(role);
  });

  it("bolds only labels the screen really shows", () => {
    const sources = sourcesIn(pageDir);
    const labels = stringsIn(screen).flatMap((text) =>
      [...text.matchAll(/\*\*(.+?)\*\*/g)].map((match) => match[1]!),
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(sources, label).toContain(`"${label}"`);
    }
  });
});
