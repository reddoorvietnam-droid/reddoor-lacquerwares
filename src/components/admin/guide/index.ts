import type { SystemRoleKey } from "@/domains/identity/role-definitions";

import type {
  GuideBasic,
  GuideFlow,
  RoleGuide,
  ScreenGuide,
} from "@/components/admin/guide/guide-types";
import { guideBasics, roleGuides } from "@/components/admin/guide/roles";
import { commonScreens } from "@/components/admin/guide/screens/common";
import { contentScreens } from "@/components/admin/guide/screens/content";
import { counterSalesScreens } from "@/components/admin/guide/screens/counter-sales";
import { directorDeskScreens } from "@/components/admin/guide/screens/director-desk";
import { financeBookScreens } from "@/components/admin/guide/screens/finance-books";
import { financeMoneyScreens } from "@/components/admin/guide/screens/finance-money";
import { orderFlowScreens } from "@/components/admin/guide/screens/order-flow";
import { orderScreens } from "@/components/admin/guide/screens/orders";
import { shopSettingsScreens } from "@/components/admin/guide/screens/shop-settings";
import { warehouseScreens } from "@/components/admin/guide/screens/warehouse";

/** Every screen the guide describes, whichever roles read it. */
export const screenGuides: readonly ScreenGuide[] = [
  ...commonScreens,
  ...directorDeskScreens,
  ...warehouseScreens,
  ...counterSalesScreens,
  ...orderFlowScreens,
  ...orderScreens,
  ...financeMoneyScreens,
  ...financeBookScreens,
  ...contentScreens,
  ...shopSettingsScreens,
];

const screensByPath = new Map(
  screenGuides.map((screen) => [screen.path, screen]),
);

/** The page's own entry; it never describes itself. */
export const guidePath = "/guide";

/** A stable anchor for a screen's section, e.g. "muc-finance-invoices". */
export function screenAnchor(path: string): string {
  return path === "" ? "muc-tong-quan" : `muc${path.replaceAll("/", "-")}`;
}

export type RoleGuideView = {
  role: RoleGuide;
  basics: readonly GuideBasic[];
  /** One section per menu entry, in menu order. */
  screens: readonly ScreenGuide[];
};

/**
 * One role's guide, cut to the menu the reader actually has: a screen the
 * sidebar hides gets no section, an entry tagged for other roles is dropped,
 * and a workflow never links to a screen the reader cannot open.
 */
export function guideFor(
  role: SystemRoleKey,
  menuPaths: readonly string[],
): RoleGuideView {
  const open = new Set(menuPaths);
  const forRole = <T extends { roles?: readonly SystemRoleKey[] }>(
    entries: readonly T[],
  ): T[] => entries.filter(({ roles }) => !roles || roles.includes(role));
  const withOpenLinks = (flow: GuideFlow): GuideFlow =>
    flow.links
      ? { ...flow, links: flow.links.filter((path) => open.has(path)) }
      : flow;

  const guide = roleGuides[role];

  return {
    role: {
      ...guide,
      workflows: forRole(guide.workflows).map(withOpenLinks),
    },
    basics: guideBasics
      .map((basic) => ({ ...basic, points: forRole(basic.points) }))
      .filter(({ points }) => points.length > 0),
    screens: [...open].flatMap((path) => {
      const screen = screensByPath.get(path);
      return screen
        ? [
            {
              ...screen,
              layout: forRole(screen.layout),
              capabilities: forRole(screen.capabilities),
              limits: forRole(screen.limits),
              flows: forRole(screen.flows),
              terms: forRole(screen.terms),
              tips: forRole(screen.tips),
            },
          ]
        : [];
    }),
  };
}
