import type { Route } from "next";

import type {
  AdminNavGroup,
  AdminNavItem,
  AdminNavRoleGroup,
} from "@/components/admin/admin-nav";
import type { Permission } from "@/domains/identity/permissions";
import type { RoleDefinitionSeed } from "@/domains/identity/role-definitions";
import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

export type NavItemSeed = {
  href: Route;
  label: string;
  /** Visible when ANY of these is granted; null = visible to every signed-in reader. */
  anyOf: readonly Permission[] | null;
  /**
   * Stays above the role groups in the Director's menu instead of being
   * listed under every role that has it.
   */
  standalone?: boolean;
};

export type NavGroupSeed = {
  label: string | null;
  items: readonly NavItemSeed[];
};

/**
 * Every sidebar entry, before filtering. Each mirrors the permission its page
 * actually guards with, so the menu never links to a section the reader would
 * 404 on.
 */
export function adminNavSeeds(
  locale: AdminLocale,
  basePath: Route,
): NavGroupSeed[] {
  const copy = getAdminDictionary(locale);

  return [
    {
      label: null,
      items: [
        {
          href: basePath,
          label: copy.navigation.overview,
          anyOf: null,
          standalone: true,
        },
        {
          href: `${basePath}/paint-warehouse` as Route,
          label:
            locale === "vi" ? "Bảng xuất kho sơn" : "Paint warehouse exports",
          anyOf: ["paintWarehouse.read"],
        },
        {
          href: `${basePath}/materials` as Route,
          label: locale === "vi" ? "Nguyên vật liệu" : "Raw materials",
          anyOf: ["materials.read"],
        },
        {
          href: `${basePath}/sales-slips` as Route,
          label: locale === "vi" ? "Hóa đơn bán hàng" : "Sales slips",
          anyOf: ["salesSlips.read"],
        },
        {
          // Named for the counter it belongs to, because the finance group
          // already carries "Công nợ khách hàng" — the order/INV receivables
          // in USD and VND. Two ledgers, two counterparty sets; the labels must
          // not read alike in a sidebar that shows both to the accountant.
          href: `${basePath}/receivables` as Route,
          label: locale === "vi" ? "Công nợ bán sơn" : "Paint sales debt",
          anyOf: ["customerDebt.read"],
        },
        {
          // The assistant answers only from tools the reader's grants allow;
          // the entry itself follows `assistant.use`. The Director keeps it
          // outside the role groups (confirmed 2026-09-11).
          href: `${basePath}/assistant` as Route,
          label: copy.navigation.assistant,
          anyOf: ["assistant.use"],
          standalone: true,
        },
        {
          // Handing work out is the Director's desk (confirmed 2026-09-12),
          // so the entry follows the grant that hands it out, not the read.
          href: `${basePath}/tasks` as Route,
          label: copy.navigation.tasks,
          anyOf: ["tasks.assign"],
        },
        {
          // Everyone's own inbox of assigned work. `tasks.read` is held at
          // `own` by every other role, which opens no list by coverage, so
          // the shell shows this one through `canSeeAssignedTasks`. It sits
          // outside the role groups for the same reason the assistant does:
          // it is personal, not a position's screen.
          href: `${basePath}/my-tasks` as Route,
          label: copy.navigation.assignedTasks,
          anyOf: ["tasks.read"],
          standalone: true,
        },
        {
          href: `${basePath}/orders` as Route,
          label: copy.navigation.orders,
          anyOf: ["orders.read"],
        },
        {
          // The customer list belongs to the people who invoice and collect
          // money; other roles see the customer name on the order.
          href: `${basePath}/customers` as Route,
          label: copy.navigation.customers,
          anyOf: ["customers.read"],
        },
        {
          // The supplier list is kept by whoever records factory cost; other
          // roles only pick from it inside the cost form.
          href: `${basePath}/suppliers` as Route,
          label: copy.navigation.suppliers,
          anyOf: ["suppliers.update"],
        },
        {
          // The workflow reference is for the people who move orders through
          // it, not for every role that can read the order book.
          href: `${basePath}/operations` as Route,
          label: copy.navigation.operations,
          anyOf: ["orders.transitionOperational"],
        },
        {
          // The approvals queue is the Director's decision desk; requesters
          // raise and track approvals from the record they concern.
          href: `${basePath}/approvals` as Route,
          label: copy.navigation.approvals,
          anyOf: ["approvals.decide"],
        },
        {
          href: `${basePath}/organization` as Route,
          label: copy.navigation.organization,
          anyOf: ["users.read"],
        },
        {
          href: `${basePath}/content` as Route,
          label: copy.navigation.content,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/sample-progress` as Route,
          label: locale === "vi" ? "Theo dõi tiến độ mẫu" : "Sample progress",
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/products` as Route,
          label: copy.navigation.products,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/news` as Route,
          label: copy.navigation.news,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/collections` as Route,
          label: copy.navigation.collections,
          anyOf: ["content.read"],
        },
        {
          href: `${basePath}/shop` as Route,
          label: copy.navigation.shop,
          anyOf: ["shop.read"],
        },
        {
          // Guest orders are handled by the accountant and the Director;
          // the content creator never sees them.
          href: `${basePath}/shop/orders` as Route,
          label: copy.navigation.shopOrders,
          anyOf: ["shopOrders.read"],
        },
        {
          // Website quote requests: the Director's inbox, nobody else's.
          href: `${basePath}/quote-requests` as Route,
          label: copy.navigation.quoteRequests,
          anyOf: ["quoteRequests.read"],
        },
        {
          href: `${basePath}/settings` as Route,
          label: copy.navigation.settings,
          anyOf: ["settings.read"],
        },
      ],
    },
    {
      label: copy.navigation.financeGroup,
      items: [
        {
          href: `${basePath}/finance` as Route,
          label: copy.navigation.financeOverview,
          anyOf: ["payments.read"],
        },
        {
          href: `${basePath}/finance/invoices` as Route,
          label: copy.navigation.invoices,
          anyOf: ["invoices.read"],
        },
        {
          href: `${basePath}/finance/payments` as Route,
          label: copy.navigation.payments,
          anyOf: ["payments.read"],
        },
        {
          href: `${basePath}/finance/receivables` as Route,
          label: copy.navigation.receivables,
          anyOf: ["receivables.read"],
        },
        {
          // The check list guards on documents.read; uploading needs
          // documents.import and is gated again inside the page.
          href: `${basePath}/checks` as Route,
          label: copy.navigation.checks,
          anyOf: ["documents.read"],
        },
        {
          // The ledger page reads receipts, so it guards on payments.read;
          // expense-only readers get the order-costs screen instead.
          href: `${basePath}/finance/ledger` as Route,
          label: copy.navigation.ledger,
          anyOf: ["payments.read"],
        },
        {
          href: `${basePath}/finance/expenses` as Route,
          label: copy.navigation.expenses,
          anyOf: ["expenses.read"],
        },
        {
          href: `${basePath}/finance/fx` as Route,
          label: copy.navigation.fxRates,
          anyOf: ["finance.manageFxSnapshot"],
        },
      ],
    },
  ];
}

/**
 * Whether an entry belongs to a role's own menu: what a holder of one global
 * grant of that role sees. Such a grant widens `assignedBusinessUnits` to every
 * unit, and `own` never opens a list screen — the reading the live sidebar
 * gets from `grantCoverageForPermission`.
 */
function roleSees(role: RoleDefinitionSeed, item: NavItemSeed): boolean {
  return (
    item.anyOf !== null &&
    item.anyOf.some((permission) =>
      role.permissions.some(
        (entry) => entry.permission === permission && entry.scope !== "own",
      ),
    )
  );
}

function toItem({ href, label }: NavItemSeed): AdminNavItem {
  return { href, label };
}

/**
 * Lays the Director's menu out by position (confirmed 2026-09-11). Each other
 * role becomes one group listing that role's menu in full — an entry several
 * roles share repeats under each — so the Director reads off who works where.
 * Entries no other role has form the Director's own group, and `standalone`
 * entries stay on top, outside every group.
 *
 * `groups` must already be filtered to what the Director may open, so no group
 * links to a screen that 404s. Derived from the role seeds, the layout follows
 * any later change to a role's permissions without a second list to maintain.
 */
export function groupNavByRole(
  groups: readonly NavGroupSeed[],
  roles: readonly RoleDefinitionSeed[],
  locale: AdminLocale,
): { standalone: AdminNavGroup; roleGroups: AdminNavRoleGroup[] } {
  const director = roles.find(({ key }) => key === "DIRECTOR");
  const others = roles.filter(({ key }) => key !== "DIRECTOR");

  // A role's group keeps the sidebar's own sections, so finance entries stay
  // under their "Tài chính" heading exactly as in that role's menu.
  const menu = (belongs: (item: NavItemSeed) => boolean) =>
    groups
      .map(({ label, items }) => ({
        label,
        items: items
          .filter((item) => !item.standalone && belongs(item))
          .map(toItem),
      }))
      .filter(({ items }) => items.length > 0);

  const roleGroups: AdminNavRoleGroup[] = [
    ...(director
      ? [
          {
            key: director.key,
            label: director.labels[locale],
            sections: menu(
              (item) => !others.some((role) => roleSees(role, item)),
            ),
          },
        ]
      : []),
    ...others.map((role) => ({
      key: role.key,
      label: role.labels[locale],
      sections: menu((item) => roleSees(role, item)),
    })),
  ].filter(({ sections }) => sections.length > 0);

  return {
    standalone: {
      label: null,
      items: groups.flatMap(({ items }) =>
        items.filter((item) => item.standalone).map(toItem),
      ),
    },
    roleGroups,
  };
}
