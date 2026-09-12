// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { Route } from "next";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/vi/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

// A plain anchor: each test moves the pathname itself instead of a router.
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));

import {
  AdminNav,
  type AdminNavGroup,
  type AdminNavRoleGroup,
} from "@/components/admin/admin-nav";

const route = (path: string) => `/vi/admin${path}` as Route;

const top: AdminNavGroup[] = [
  {
    label: null,
    items: [
      { href: route(""), label: "Tổng quan" },
      { href: route("/assistant"), label: "Trợ lý AI" },
    ],
  },
];

const roleGroups: AdminNavRoleGroup[] = [
  {
    key: "WAREHOUSE_MANAGER",
    label: "Thủ kho / Quản lý kho",
    sections: [
      {
        label: null,
        items: [
          { href: route("/materials"), label: "Nguyên vật liệu" },
          { href: route("/orders"), label: "Sổ đơn hàng" },
        ],
      },
    ],
  },
  {
    key: "FACTORY_MANAGER",
    label: "Quản lý nhà máy",
    sections: [
      {
        label: null,
        items: [{ href: route("/orders"), label: "Sổ đơn hàng" }],
      },
      {
        label: "Tài chính",
        items: [
          { href: route("/finance/expenses"), label: "Chi phí đơn hàng" },
        ],
      },
    ],
  },
];

const directorNav = () => (
  <AdminNav
    navigationLabel="Điều hướng quản trị"
    basePath="/vi/admin"
    groups={top}
    roleGroups={roleGroups}
  />
);

const heading = (name: string) => screen.getByRole("button", { name });
const groupOf = (name: string) =>
  document.getElementById(heading(name).getAttribute("aria-controls")!)!;
const linkIn = (group: string, name: string) =>
  within(groupOf(group)).getByRole("link", { name, hidden: true });

beforeEach(() => {
  navigation.pathname = "/vi/admin";
});
afterEach(cleanup);

describe("the Director's menu by role", () => {
  it("starts with every role closed on the overview", () => {
    render(directorNav());
    for (const name of ["Thủ kho / Quản lý kho", "Quản lý nhà máy"]) {
      expect(heading(name).getAttribute("aria-expanded")).toBe("false");
      expect(groupOf(name).hidden).toBe(true);
    }
    expect(
      screen
        .getByRole("link", { name: "Tổng quan" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("opens and closes a role from its heading", () => {
    render(directorNav());
    fireEvent.click(heading("Quản lý nhà máy"));
    expect(heading("Quản lý nhà máy").getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(groupOf("Quản lý nhà máy").hidden).toBe(false);
    expect(
      within(groupOf("Quản lý nhà máy")).getByText("Tài chính"),
    ).toBeTruthy();
    fireEvent.click(heading("Quản lý nhà máy"));
    expect(groupOf("Quản lý nhà máy").hidden).toBe(true);
  });

  it("opens the role holding the current page, nested routes included", () => {
    navigation.pathname = "/vi/admin/materials/abc";
    render(directorNav());
    expect(groupOf("Thủ kho / Quản lý kho").hidden).toBe(false);
    expect(groupOf("Quản lý nhà máy").hidden).toBe(true);
    expect(
      linkIn("Thủ kho / Quản lý kho", "Nguyên vật liệu").getAttribute(
        "aria-current",
      ),
    ).toBe("page");
  });

  it("lights a shared entry only under the role it was picked from", () => {
    const { rerender } = render(directorNav());
    fireEvent.click(heading("Quản lý nhà máy"));
    fireEvent.click(linkIn("Quản lý nhà máy", "Sổ đơn hàng"));
    navigation.pathname = "/vi/admin/orders";
    rerender(directorNav());

    fireEvent.click(heading("Thủ kho / Quản lý kho"));
    expect(
      linkIn("Quản lý nhà máy", "Sổ đơn hàng").getAttribute("aria-current"),
    ).toBe("page");
    expect(
      linkIn("Thủ kho / Quản lý kho", "Sổ đơn hàng").getAttribute(
        "aria-current",
      ),
    ).toBeNull();
  });

  it("falls back to the first role holding the page when none was picked", () => {
    navigation.pathname = "/vi/admin/orders";
    render(directorNav());
    expect(groupOf("Thủ kho / Quản lý kho").hidden).toBe(false);
    expect(groupOf("Quản lý nhà máy").hidden).toBe(true);
    expect(
      linkIn("Thủ kho / Quản lý kho", "Sổ đơn hàng").getAttribute(
        "aria-current",
      ),
    ).toBe("page");
  });
});

describe("every other reader's menu", () => {
  it("stays flat and lights the longest matching entry", () => {
    navigation.pathname = "/vi/admin/finance/payments/42";
    render(
      <AdminNav
        navigationLabel="Điều hướng quản trị"
        basePath="/vi/admin"
        groups={[
          {
            label: "Tài chính",
            items: [
              { href: route("/finance"), label: "Tổng quan tài chính" },
              { href: route("/finance/payments"), label: "Tiền khách trả" },
            ],
          },
        ]}
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(
      screen
        .getByRole("link", { name: "Tiền khách trả" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Tổng quan tài chính" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});
