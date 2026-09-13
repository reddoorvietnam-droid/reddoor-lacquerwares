import type { Route } from "next";
import { describe, expect, it } from "vitest";

import { adminNavSeeds } from "@/components/admin/admin-nav-model";
import {
  describeNavHref,
  greetingFor,
  roleWelcome,
} from "@/components/admin/admin-welcome-copy";
import { systemRoleKeys } from "@/domains/identity/role-definitions";
import { adminLocales } from "@/lib/i18n/admin";

describe("the welcome page's words", () => {
  it.each(adminLocales)("describes every menu entry in %s", (locale) => {
    const basePath = `/${locale}/admin` as Route;
    const entries = adminNavSeeds(locale, basePath)
      .flatMap(({ items }) => items)
      .filter(({ href }) => href !== basePath);

    expect(entries.length).toBeGreaterThan(20);
    for (const { href } of entries) {
      expect(describeNavHref(href, basePath, locale), href).toMatch(/\S/);
    }
  });

  it("welcomes every role in both languages", () => {
    for (const roleKey of systemRoleKeys) {
      for (const locale of adminLocales) {
        expect(roleWelcome[roleKey][locale], roleKey).toMatch(/\S/);
      }
    }
  });

  it("does not describe paths it does not know", () => {
    expect(describeNavHref("/vi/admin/unknown", "/vi/admin", "vi")).toBeNull();
    expect(
      describeNavHref("/vi/admin/constructor", "/vi/admin", "vi"),
    ).toBeNull();
  });

  it.each([
    [4, "Chào buổi sáng", "Good morning"],
    [10, "Chào buổi sáng", "Good morning"],
    [11, "Chào buổi trưa", "Good morning"],
    [12, "Chào buổi trưa", "Good afternoon"],
    [13, "Chào buổi chiều", "Good afternoon"],
    [17, "Chào buổi chiều", "Good afternoon"],
    [18, "Chào buổi tối", "Good evening"],
    [0, "Chào buổi tối", "Good evening"],
    [3, "Chào buổi tối", "Good evening"],
  ] as const)("greets at %i:00", (hour, vi, en) => {
    expect(greetingFor(hour, "vi")).toBe(vi);
    expect(greetingFor(hour, "en")).toBe(en);
  });
});
