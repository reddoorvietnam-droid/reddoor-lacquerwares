import { describe, expect, it } from "vitest";

import type { PlanItemDraft } from "@/domains/assistant/contracts";
import {
  buildOrderPlan,
  remainingStages,
  validatePlanItems,
} from "@/domains/assistant/planning";
import { orderStageDefinitions } from "@/domains/orders/workflow";

const tz = "Asia/Ho_Chi_Minh";
const today = "2026-09-06";

function plan(overrides: Partial<Parameters<typeof buildOrderPlan>[0]> = {}) {
  return buildOrderPlan({
    order: {
      id: "000000000000000000000001",
      orderCode: "RD-20260906-TEST",
      stage: "received",
      expectedReadyAt: null,
      revision: 0,
    },
    today,
    timeZone: tz,
    roleHolders: new Map(),
    ...overrides,
  });
}

describe("remainingStages", () => {
  it("follows the fifteen-step main path from the current stage, skipping the purchase branch", () => {
    const stages = remainingStages("received");
    expect(stages[0]).toBe("received");
    expect(stages.at(-1)).toBe("settled");
    expect(stages).not.toContain("materialProcurement");
    expect(stages).not.toContain("closed");
    expect(remainingStages("qualityControl")).toEqual([
      "qualityControl",
      "packing",
      "tradeDocumentation",
      "loadingScheduled",
      "shipped",
      "invoiced",
      "settled",
    ]);
    expect(remainingStages("closed")).toEqual([]);
    expect(remainingStages("cancelled")).toEqual([]);
  });
});

describe("buildOrderPlan", () => {
  it("makes one task per remaining stage, owned by the process owner, chained in order", () => {
    const built = plan();
    const stages = remainingStages("received");
    expect(built.items).toHaveLength(stages.length);
    for (const [index, item] of built.items.entries()) {
      expect(item.stage).toBe(stages[index]);
      expect(item.ownerRole).toBe(
        orderStageDefinitions[stages[index]!].ownerRole,
      );
      expect(item.dependsOn).toEqual(index === 0 ? [] : [index - 1]);
      expect(item.title).toContain(
        orderStageDefinitions[stages[index]!].labels.vi,
      );
    }
  });

  it("flags every default it relied on as an assumption when no ready date exists", () => {
    const built = plan();
    expect(
      built.assumptions.some((a) => a.includes("chưa có ngày dự kiến")),
    ).toBe(true);
    expect(built.assumptions.some((a) => a.includes("giả định mặc định"))).toBe(
      true,
    );
    expect(built.assumptions.some((a) => a.includes("nguyên liệu"))).toBe(true);
    // Forward schedule: due dates never go backwards.
    const dates = built.items.map((item) => item.dueDate!);
    expect([...dates].sort()).toEqual(dates);
    expect(dates[0]! > today).toBe(true);
  });

  it("caps production stages at the order's ready date and compresses when it is close", () => {
    const readyAt = new Date("2026-09-20T00:00:00Z");
    const built = plan({
      order: {
        id: "1",
        orderCode: "RD-X",
        stage: "received",
        expectedReadyAt: readyAt,
        revision: 0,
      },
    });
    const packing = built.items.find((item) => item.stage === "packing")!;
    expect(packing.dueDate).toBe("2026-09-20");
    const production = built.items.find(
      (item) => item.stage === "inProduction",
    )!;
    expect(production.dueDate! <= "2026-09-20").toBe(true);
    expect(built.assumptions.some((a) => a.includes("nén"))).toBe(true);
    const invoiced = built.items.find((item) => item.stage === "invoiced")!;
    expect(invoiced.dueDate! > "2026-09-20").toBe(true);
  });

  it("assigns the single holder of a position and reports unstaffed or ambiguous ones", () => {
    const built = plan({
      roleHolders: new Map([
        ["COMPANY_ACCOUNTANT", [{ id: "ca1", displayName: "Kế toán" }]],
        [
          "FACTORY_MANAGER",
          [
            { id: "fm1", displayName: "A" },
            { id: "fm2", displayName: "B" },
          ],
        ],
      ]),
    });
    expect(
      built.items.find((i) => i.stage === "fileOpened")!.assigneeUserId,
    ).toBe("ca1");
    expect(
      built.items.find((i) => i.stage === "productionPlanning")!.assigneeUserId,
    ).toBeNull();
    expect(
      built.assumptions.some(
        (a) => a.includes("FACTORY_MANAGER") && a.includes("2"),
      ),
    ).toBe(true);
    expect(built.assumptions.some((a) => a.includes("WAREHOUSE_MANAGER"))).toBe(
      true,
    );
  });

  it("uses explicit durations and notes without flagging them as defaults", () => {
    const built = plan({
      overrides: {
        stageDurations: { inProduction: 3 },
        stageNotes: { inProduction: "Ưu tiên lô 1" },
      },
    });
    const production = built.items.find((i) => i.stage === "inProduction")!;
    expect(production.note).toBe("Ưu tiên lô 1");
    expect(
      built.assumptions.some((a) =>
        a.includes(orderStageDefinitions.inProduction.labels.vi),
      ),
    ).toBe(false);
  });

  it("is deterministic for the same inputs", () => {
    expect(plan()).toEqual(plan());
  });
});

describe("validatePlanItems", () => {
  const item = (
    partial: Partial<PlanItemDraft> & { index: number },
  ): PlanItemDraft => ({
    title: `Item ${partial.index}`,
    note: null,
    stage: null,
    ownerRole: null,
    assigneeUserId: null,
    dueDate: null,
    dependsOn: [],
    priority: "normal",
    ...partial,
  });

  it("accepts a valid chain", () => {
    const result = validatePlanItems(
      [
        item({ index: 0, dueDate: "2026-09-07" }),
        item({ index: 1, dueDate: "2026-09-08", dependsOn: [0] }),
      ],
      { today, orderStage: null },
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects dependency cycles", () => {
    const result = validatePlanItems(
      [item({ index: 0, dependsOn: [1] }), item({ index: 1, dependsOn: [0] })],
      { today, orderStage: null },
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.some((e) => e.includes("cycle"))).toBe(true);
  });

  it("rejects a deadline earlier than the work it depends on, and past deadlines", () => {
    const result = validatePlanItems(
      [
        item({ index: 0, dueDate: "2026-09-10" }),
        item({ index: 1, dueDate: "2026-09-08", dependsOn: [0] }),
        item({ index: 2, dueDate: "2026-09-01" }),
      ],
      { today, orderStage: null },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.includes("before its dependency")),
      ).toBe(true);
      expect(result.errors.some((e) => e.includes("in the past"))).toBe(true);
    }
  });

  it("rejects stages the order already passed and owners that do not match the process", () => {
    const result = validatePlanItems(
      [
        item({ index: 0, stage: "received", ownerRole: "COMPANY_ACCOUNTANT" }),
        item({ index: 1, stage: "packing", ownerRole: "FACTORY_MANAGER" }),
      ],
      { today, orderStage: "inProduction" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("not ahead"))).toBe(true);
      expect(
        result.errors.some((e) => e.includes("owned by WAREHOUSE_MANAGER")),
      ).toBe(true);
    }
  });

  it("rejects unknown and self dependencies and duplicate indices", () => {
    const result = validatePlanItems(
      [item({ index: 0, dependsOn: [7] }), item({ index: 0, dependsOn: [0] })],
      { today, orderStage: null },
    );
    expect(result.ok).toBe(false);
  });
});
