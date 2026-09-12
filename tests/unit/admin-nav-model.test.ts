import type { Route } from "next";
import { describe, expect, it } from "vitest";
import {
  adminNavSeeds,
  groupNavByRole,
} from "@/components/admin/admin-nav-model";
import type { AdminNavRoleGroup } from "@/components/admin/admin-nav";
import { roleDefinitionSeeds } from "@/domains/identity/role-definitions";

// The Director holds the whole catalog, so every entry is open to them.
const seeds = adminNavSeeds("vi", "/vi/admin" as Route);
const { standalone, roleGroups } = groupNavByRole(
  seeds,
  roleDefinitionSeeds,
  "vi",
);

function menuOf(groups: readonly AdminNavRoleGroup[], key: string) {
  return groups
    .find((group) => group.key === key)
    ?.sections.map(({ label, items }) => ({
      label,
      items: items.map((item) => item.label),
    }));
}

const labelsIn = (groups: readonly AdminNavRoleGroup[]) =>
  groups.flatMap(({ sections }) =>
    sections.flatMap(({ items }) => items.map((item) => item.label)),
  );

describe("the Director's menu, laid out by role", () => {
  it("keeps the overview and the assistant on top, in no role group", () => {
    expect(standalone.items.map((item) => item.label)).toEqual([
      "Tổng quan",
      "Trợ lý AI",
      // Personal like the assistant: everyone's own inbox of assigned work.
      "Công việc được giao",
    ]);
    expect(labelsIn(roleGroups)).not.toContain("Trợ lý AI");
    expect(labelsIn(roleGroups)).not.toContain("Tổng quan");
  });

  it("orders the groups by position", () => {
    expect(roleGroups.map((group) => group.label)).toEqual([
      "Giám đốc",
      "Thủ kho / Quản lý kho",
      "Quản lý nhà máy",
      "Kế toán nhà máy & mua hàng",
      "Kế toán công ty",
      "Biên tập nội dung",
    ]);
  });

  it("lists each role's menu as agreed on 2026-09-11", () => {
    expect(menuOf(roleGroups, "DIRECTOR")).toEqual([
      {
        label: null,
        items: ["Giao việc", "Phê duyệt", "Cơ cấu tổ chức", "Yêu cầu báo giá"],
      },
    ]);
    expect(menuOf(roleGroups, "WAREHOUSE_MANAGER")).toEqual([
      {
        label: null,
        items: [
          "Bảng xuất kho sơn",
          "Nguyên vật liệu",
          "Hóa đơn bán hàng",
          "Công nợ bán sơn",
          "Sổ đơn hàng",
        ],
      },
      { label: "Tài chính", items: ["Kiểm tra bảng biểu"] },
    ]);
    expect(menuOf(roleGroups, "FACTORY_MANAGER")).toEqual([
      {
        label: null,
        items: ["Sổ đơn hàng", "Quy trình đơn hàng"],
      },
      { label: "Tài chính", items: ["Kiểm tra bảng biểu", "Chi phí đơn hàng"] },
    ]);
    expect(menuOf(roleGroups, "FACTORY_ACCOUNTANT")).toEqual([
      { label: null, items: ["Sổ đơn hàng", "Nhà cung cấp"] },
      { label: "Tài chính", items: ["Kiểm tra bảng biểu", "Chi phí đơn hàng"] },
    ]);
    expect(menuOf(roleGroups, "COMPANY_ACCOUNTANT")).toEqual([
      {
        label: null,
        items: [
          "Hóa đơn bán hàng",
          "Công nợ bán sơn",
          "Sổ đơn hàng",
          "Khách hàng",
          "Quy trình đơn hàng",
          "Đơn cửa hàng",
          "Thiết lập",
        ],
      },
      {
        label: "Tài chính",
        items: [
          "Tổng quan tài chính",
          "Hóa đơn (INV)",
          "Tiền khách trả",
          "Công nợ khách hàng",
          "Kiểm tra bảng biểu",
          "Thu – Chi",
          "Chi phí đơn hàng",
          "Tỷ giá USD",
        ],
      },
    ]);
    expect(menuOf(roleGroups, "CONTENT_CREATOR")).toEqual([
      {
        label: null,
        items: [
          "Nội dung",
          "Theo dõi tiến độ mẫu",
          "Sản phẩm",
          "Tin tức",
          "Bộ sưu tập",
          "Cửa hàng",
        ],
      },
    ]);
  });

  it("places every entry the Director can open somewhere", () => {
    const placed = new Set(
      [
        ...standalone.items,
        ...roleGroups.flatMap(({ sections }) =>
          sections.flatMap(({ items }) => items),
        ),
      ].map((item) => item.href),
    );
    expect(placed).toEqual(
      new Set(seeds.flatMap(({ items }) => items.map((item) => item.href))),
    );
  });

  it("groups only what the Director was allowed to open", () => {
    const narrowed = seeds.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.href.endsWith("/materials")),
    }));
    expect(
      labelsIn(groupNavByRole(narrowed, roleDefinitionSeeds, "vi").roleGroups),
    ).not.toContain("Nguyên vật liệu");
  });

  it("follows a change to a role's permissions", () => {
    const roles = roleDefinitionSeeds.map((role) =>
      role.key === "FACTORY_MANAGER"
        ? {
            ...role,
            permissions: [
              ...role.permissions,
              { permission: "customers.read" as const, scope: "all" as const },
            ],
          }
        : role,
    );
    const regrouped = groupNavByRole(seeds, roles, "vi").roleGroups;
    expect(menuOf(regrouped, "FACTORY_MANAGER")?.[0]?.items).toContain(
      "Khách hàng",
    );
  });

  it("ignores a permission a role holds only over its own records", () => {
    const roles = roleDefinitionSeeds.map((role) =>
      role.key === "FACTORY_MANAGER"
        ? {
            ...role,
            permissions: [
              ...role.permissions,
              { permission: "customers.read" as const, scope: "own" as const },
            ],
          }
        : role,
    );
    const regrouped = groupNavByRole(seeds, roles, "vi").roleGroups;
    expect(menuOf(regrouped, "FACTORY_MANAGER")?.[0]?.items).not.toContain(
      "Khách hàng",
    );
  });
});
