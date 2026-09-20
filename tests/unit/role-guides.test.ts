import type { Route } from "next";
import { describe, expect, it } from "vitest";

import {
  adminNavSeeds,
  groupNavByRole,
} from "@/components/admin/admin-nav-model";
import {
  guideFor,
  guidePath,
  screenAnchor,
  screenGuides,
} from "@/components/admin/guide";
import { guideBasics, roleGuides } from "@/components/admin/guide/roles";
import {
  roleDefinitionSeeds,
  systemRoleKeys,
  type SystemRoleKey,
} from "@/domains/identity/role-definitions";

const basePath = "/vi/admin" as Route;
const seeds = adminNavSeeds("vi", basePath);
const { standalone, roleGroups } = groupNavByRole(
  seeds,
  roleDefinitionSeeds,
  "vi",
);
const pathOf = (href: string) =>
  href === basePath ? "" : href.slice(basePath.length);

/**
 * Each role's menu as its holder sees it. Every role holds the entries on top
 * (the guide, the overview, the assistant and their own assigned work); the
 * Director's guide keeps to those and the Director's own desk.
 */
const menus = Object.fromEntries(
  systemRoleKeys.map((role) => [
    role,
    [
      ...standalone.items.map(({ href }) => pathOf(href)),
      ...(roleGroups
        .find(({ key }) => key === role)
        ?.sections.flatMap(({ items }) =>
          items.map(({ href }) => pathOf(href)),
        ) ?? []),
    ],
  ]),
) as Record<SystemRoleKey, string[]>;

const labels = new Map(
  seeds.flatMap(({ items }) =>
    items.map(({ href, label }) => [pathOf(href), label] as const),
  ),
);

function rolesOpening(path: string): SystemRoleKey[] {
  return systemRoleKeys.filter((role) => menus[role].includes(path));
}

function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object")
    return Object.entries(value)
      .filter(([key]) => key !== "roles" && key !== "links" && key !== "path")
      .flatMap(([, entry]) => stringsIn(entry));
  return [];
}

describe("the user guide", () => {
  it("describes every entry of every role's menu", () => {
    for (const role of systemRoleKeys) {
      for (const path of menus[role].filter((p) => p !== guidePath)) {
        expect(
          screenGuides.some((screen) => screen.path === path),
          `${role} ${path}`,
        ).toBe(true);
      }
    }
  });

  it("writes no section that no role's guide reaches, and none twice", () => {
    const paths = screenGuides.map(({ path }) => path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).not.toBe(guidePath);
      expect(rolesOpening(path), path).not.toEqual([]);
    }
  });

  it("names each section exactly as the menu does", () => {
    for (const screen of screenGuides) {
      expect(screen.title, screen.path).toBe(labels.get(screen.path));
    }
  });

  it("tags an entry only with roles whose menu holds the screen", () => {
    for (const screen of screenGuides) {
      const allowed = rolesOpening(screen.path);
      const tagged = [
        ...screen.layout,
        ...screen.capabilities,
        ...screen.limits,
        ...screen.flows,
        ...screen.terms,
        ...screen.tips,
      ].flatMap(({ roles }) => roles ?? []);
      for (const role of tagged) expect(allowed, screen.path).toContain(role);
    }
  });

  it("gives every role its own description", () => {
    for (const role of systemRoleKeys) {
      const guide = roleGuides[role];
      expect(guide.key).toBe(role);
      expect(guide.intro.length, role).toBeGreaterThan(0);
      expect(guide.responsibilities.length, role).toBeGreaterThan(0);
      expect(guide.sees.length, role).toBeGreaterThan(0);
      expect(guide.hidden.length, role).toBeGreaterThan(0);
      expect(guide.workflows.length, role).toBeGreaterThan(0);
      expect(guide.faq.length, role).toBeGreaterThan(0);
      for (const flow of guide.workflows) {
        for (const path of flow.links ?? []) {
          expect(menus[role], `${role} ${flow.title}`).toContain(path);
        }
      }
    }
    expect(guideBasics.length).toBeGreaterThan(0);
  });

  it("keeps each role to its own menu", () => {
    for (const role of systemRoleKeys) {
      const view = guideFor(role, menus[role]);
      expect(view.screens.map(({ path }) => path)).toEqual(
        menus[role].filter((path) => path !== guidePath),
      );
    }
    const director = guideFor("DIRECTOR", menus.DIRECTOR);
    expect(director.screens.map(({ path }) => path)).not.toContain("/orders");
  });

  it("drops entries meant for another role", () => {
    const orders = screenGuides.find(({ path }) => path === "/orders");
    const tagged = orders?.capabilities.find(({ roles }) => roles);
    if (!tagged?.roles) return;
    const outsider = rolesOpening("/orders").find(
      (role) => !tagged.roles?.includes(role),
    );
    if (!outsider) return;
    const view = guideFor(outsider, menus[outsider]);
    expect(
      view.screens.find(({ path }) => path === "/orders")?.capabilities,
    ).not.toContainEqual(tagged);
  });

  it("uses plain words and closes every bold label", () => {
    const technical =
      /\b(?:orders|customers|finance|payments|content|shop|shopOrders|tasks|users|materials|inventory|salesSlips|customerDebt|paintWarehouse|documents|expenses|invoices|receivables|approvals|assistant|quotes|quoteRequests|procurement|products|media|samples|labor|settings)\.[a-zA-Z]+\b|\b(?:MongoDB|server action|permission|scope|revision)\b/i;
    const texts = stringsIn([screenGuides, roleGuides, guideBasics]);
    expect(texts.length).toBeGreaterThan(500);
    for (const text of texts) {
      expect(text, text).toMatch(/\S/);
      // A **label** is copied from the screen, which may show such a word
      // itself (e.g. "Tạo revision mới"); only the guide's own words count.
      expect(text.replace(/\*\*(.+?)\*\*/g, ""), text).not.toMatch(technical);
      expect((text.match(/\*\*/g) ?? []).length % 2, text).toBe(0);
    }
  });

  it("anchors each section by its path", () => {
    expect(screenAnchor("")).toBe("muc-tong-quan");
    expect(screenAnchor("/finance/invoices")).toBe("muc-finance-invoices");
  });
});
