import { describe, expect, it } from "vitest";

import {
  assertTransition,
  isTerminalStage,
  orderStageDefinitions,
  orderStages,
  OrderTransitionError,
  stageDefinition,
  terminalOrderStages,
  type OrderStage,
  type OrderTransitionContext,
} from "@/domains/orders/workflow";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";

type TransitionOverrides = Partial<Omit<OrderTransitionContext, "from" | "to">>;

function transition(
  from: OrderStage,
  to: OrderStage,
  overrides: TransitionOverrides = {},
): void {
  assertTransition({
    from,
    to,
    hasApproval: overrides.hasApproval ?? false,
    qcPassed: overrides.qcPassed ?? false,
    reason: overrides.reason ?? null,
  });
}

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof OrderTransitionError ? error.code : undefined;
  }
}

/** The documented fifteen-step happy path, material available at step 6. */
const happyPath = [
  "received",
  "fileOpened",
  "awaitingDirectorApproval",
  "productionPlanning",
  "inventoryCheck",
  "materialIssued",
  "inProduction",
  "qualityControl",
  "packing",
  "tradeDocumentation",
  "loadingScheduled",
  "shipped",
  "invoiced",
  "settled",
  "closed",
] as const satisfies readonly OrderStage[];

const approvalGatedStages = orderStages.filter(
  (stage) => orderStageDefinitions[stage].approvalSubject !== null,
);

describe("order stage definitions", () => {
  it("defines every stage exactly once, keyed by itself", () => {
    expect(Object.keys(orderStageDefinitions)).toHaveLength(orderStages.length);
    for (const stage of orderStages) {
      const definition = stageDefinition(stage);
      expect(definition).toBeDefined();
      expect(definition.stage).toBe(stage);
      expect(definition.labels.vi.length).toBeGreaterThan(0);
      expect(definition.labels.en.length).toBeGreaterThan(0);
    }
  });

  it("only ever points at stages that exist", () => {
    for (const stage of orderStages) {
      for (const next of stageDefinition(stage).next) {
        expect(orderStages).toContain(next);
      }
    }
  });

  it("treats closed and cancelled as the terminal stages", () => {
    for (const stage of orderStages) {
      expect(isTerminalStage(stage)).toBe(
        (terminalOrderStages as readonly OrderStage[]).includes(stage),
      );
    }
  });
});

describe("order transitions", () => {
  it("walks the documented happy path from received to closed", () => {
    expect(happyPath).toHaveLength(15);

    for (const [index, from] of happyPath.entries()) {
      const to = happyPath[index + 1];
      if (!to) {
        break;
      }

      expect(() =>
        transition(from, to, {
          hasApproval: stageDefinition(from).approvalSubject !== null,
          qcPassed: true,
        }),
      ).not.toThrow();
    }
  });

  it("rejects a jump the process does not describe", () => {
    expect(errorCode(() => transition("received", "shipped"))).toBe(
      "INVALID_TRANSITION",
    );
    expect(
      errorCode(() =>
        transition("inventoryCheck", "qualityControl", { qcPassed: true }),
      ),
    ).toBe("INVALID_TRANSITION");
  });

  it.each(terminalOrderStages)("rejects moving out of %s", (from) => {
    expect(
      errorCode(() =>
        transition(from, "invoiced", {
          hasApproval: true,
          qcPassed: true,
          reason: "reopen",
        }),
      ),
    ).toBe("TERMINAL_STAGE");
  });

  it.each(approvalGatedStages)(
    "requires an approved Director decision to leave %s",
    (from) => {
      const definition = stageDefinition(from);
      const to = definition.next.find((candidate) => candidate !== "cancelled");
      expect(to).toBeDefined();
      if (!to) {
        return;
      }

      expect(definition.approvalSubject).not.toBeNull();
      expect(errorCode(() => transition(from, to, { qcPassed: true }))).toBe(
        "APPROVAL_REQUIRED",
      );
      expect(() =>
        transition(from, to, { hasApproval: true, qcPassed: true }),
      ).not.toThrow();
    },
  );

  it("blocks packing until quality control passes", () => {
    expect(errorCode(() => transition("qualityControl", "packing"))).toBe(
      "QC_NOT_PASSED",
    );
    expect(() =>
      transition("qualityControl", "packing", { qcPassed: true }),
    ).not.toThrow();
  });

  it("requires a reason to cancel", () => {
    expect(
      errorCode(() => transition("received", "cancelled", { reason: "   " })),
    ).toBe("REASON_REQUIRED");
    expect(() =>
      transition("received", "cancelled", { reason: "Customer withdrew" }),
    ).not.toThrow();
  });

  it("requires a reason to return production for rework", () => {
    expect(errorCode(() => transition("qualityControl", "inProduction"))).toBe(
      "REASON_REQUIRED",
    );
    expect(() =>
      transition("qualityControl", "inProduction", {
        reason: "Lacquer finish failed inspection",
      }),
    ).not.toThrow();
  });

  it("supports the material shortage detour at step 6", () => {
    expect(() =>
      transition("inventoryCheck", "materialProcurement"),
    ).not.toThrow();
    expect(() =>
      transition("materialProcurement", "inventoryCheck", {
        hasApproval: true,
      }),
    ).not.toThrow();
    expect(() =>
      transition("materialProcurement", "materialIssued", {
        hasApproval: true,
      }),
    ).not.toThrow();
  });
});

describe("stage ownership matches the granted permissions", () => {
  // A stage whose accountable position cannot leave it would stall every order
  // until the Director intervened. Only that role holds the whole catalog, so
  // the check is meaningful for every other position.
  it.each(orderStages.map((stage) => [stage] as const))(
    "%s can be advanced by the role that owns it",
    (stage) => {
      const definition = stageDefinition(stage);
      const seed = getRoleDefinitionSeed(definition.ownerRole);

      expect(
        seed,
        `${definition.ownerRole} has no role definition`,
      ).not.toBeNull();
      expect(
        seed?.permissions.some(
          (entry) => entry.permission === definition.advancePermission,
        ),
        `${definition.ownerRole} cannot ${definition.advancePermission} to leave ${stage}`,
      ).toBe(true);
    },
  );
});
