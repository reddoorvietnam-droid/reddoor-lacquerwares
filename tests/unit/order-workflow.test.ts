import { describe, expect, it } from "vitest";

import {
  assertTransition,
  emptyReadiness,
  isTerminalStage,
  normalizeOrderStage,
  orderStageDefinitions,
  orderStages,
  OrderTransitionError,
  qcCheckpointStage,
  stageDefinition,
  terminalOrderStages,
  type OrderReadiness,
  type OrderStage,
  type OrderTransitionContext,
} from "@/domains/orders/workflow";
import { getRoleDefinitionSeed } from "@/domains/identity/role-definitions";

type TransitionOverrides = Partial<
  Omit<OrderTransitionContext, "from" | "to" | "readiness">
> & { readiness?: Partial<OrderReadiness> };

/** Everything on file, so only the rule under test can refuse the move. */
const allReady: OrderReadiness = {
  planned: true,
  productionComplete: true,
  packingReady: true,
  labelsReady: true,
  exportDocumentsReady: true,
  customsDeclared: true,
};

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
    readiness: { ...allReady, ...overrides.readiness },
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

/** The SOP happy path, material available at step 4. */
const happyPath = [
  "received",
  "awaitingDirectorApproval",
  "sampleConfirmation",
  "productionPlanning",
  "inventoryCheck",
  "inProduction",
  "qualityControl",
  "packing",
  "exportDocuments",
  "tradeDocumentation",
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

  it("numbers the working stages 1 to 11 as the SOP does", () => {
    const steps = new Set<number>();
    for (const stage of orderStages) {
      const step = orderStageDefinitions[stage].step;
      if (step !== null) steps.add(step);
    }
    expect([...steps].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
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

  it("gates only the order confirmation and the material purchase on the Director", () => {
    expect(approvalGatedStages).toEqual([
      "awaitingDirectorApproval",
      "materialProcurement",
    ]);
  });

  it("reads the retired fifteen-step keys forward and refuses unknown ones", () => {
    expect(normalizeOrderStage("fileOpened")).toBe("received");
    expect(normalizeOrderStage("materialIssued")).toBe("inventoryCheck");
    expect(normalizeOrderStage("loadingScheduled")).toBe("shipped");
    expect(normalizeOrderStage("packing")).toBe("packing");
    expect(() => normalizeOrderStage("nonsense")).toThrow();
  });

  it("records each inspection in the stage it belongs to", () => {
    expect(qcCheckpointStage).toEqual({
      woodwork: "inProduction",
      finishing: "qualityControl",
      packing: "packing",
    });
  });
});

describe("order transitions", () => {
  it("walks the SOP happy path from received to closed", () => {
    expect(happyPath).toHaveLength(14);

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

  it("blocks packing until the finishing inspection passes", () => {
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

  it("supports the material shortage detour at step 4", () => {
    expect(() =>
      transition("inventoryCheck", "materialProcurement"),
    ).not.toThrow();
    expect(() =>
      transition("materialProcurement", "inventoryCheck", {
        hasApproval: true,
      }),
    ).not.toThrow();
    expect(() =>
      transition("materialProcurement", "inProduction", {
        hasApproval: true,
      }),
    ).not.toThrow();
  });
});

describe("SOP outputs gate the forward moves", () => {
  it("keeps the order in planning until the plan is saved", () => {
    expect(
      errorCode(() =>
        transition("productionPlanning", "inventoryCheck", {
          readiness: { planned: false },
        }),
      ),
    ).toBe("PLAN_MISSING");
  });

  it("sends the order to quality control only from the finishing stage", () => {
    expect(
      errorCode(() =>
        transition("inProduction", "qualityControl", {
          readiness: { productionComplete: false },
        }),
      ),
    ).toBe("PRODUCTION_INCOMPLETE");
  });

  it("keeps the order in packing without the slip and the packing inspection", () => {
    expect(
      errorCode(() =>
        transition("packing", "exportDocuments", {
          readiness: { packingReady: false },
        }),
      ),
    ).toBe("PACKING_NOT_READY");
  });

  it("keeps the order in packing until the labels are settled", () => {
    expect(
      errorCode(() =>
        transition("packing", "exportDocuments", {
          readiness: { labelsReady: false },
        }),
      ),
    ).toBe("LABELS_NOT_APPROVED");
    // The packing slip is judged first.
    expect(
      errorCode(() =>
        transition("packing", "exportDocuments", {
          readiness: { packingReady: false, labelsReady: false },
        }),
      ),
    ).toBe("PACKING_NOT_READY");
    expect(() =>
      assertTransition({
        from: "packing",
        to: "cancelled",
        hasApproval: false,
        qcPassed: false,
        reason: "stopped",
        readiness: { ...allReady, labelsReady: false },
      }),
    ).not.toThrow();
  });

  it("needs the INV and PKL on file to leave export documents", () => {
    expect(
      errorCode(() =>
        transition("exportDocuments", "tradeDocumentation", {
          readiness: { exportDocumentsReady: false },
        }),
      ),
    ).toBe("EXPORT_DOCUMENTS_MISSING");
  });

  it("needs the customs declaration on file to leave customs", () => {
    expect(
      errorCode(() =>
        transition("tradeDocumentation", "shipped", {
          readiness: { customsDeclared: false },
        }),
      ),
    ).toBe("CUSTOMS_DECLARATION_MISSING");
  });

  it("never blocks a cancellation on a missing output", () => {
    for (const from of [
      "productionPlanning",
      "inProduction",
      "packing",
      "exportDocuments",
      "tradeDocumentation",
    ] as const) {
      expect(() =>
        assertTransition({
          from,
          to: "cancelled",
          hasApproval: false,
          qcPassed: false,
          reason: "stopped",
          readiness: emptyReadiness,
        }),
      ).not.toThrow();
    }
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
