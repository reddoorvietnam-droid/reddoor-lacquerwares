import type { ApprovalSubject } from "@/domains/approvals/contracts";
import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";

/**
 * The sales-order lifecycle, encoding the company's operating procedure
 * SOP-SX-001 Rev.1 (09/2026) as the Director answered it on 2026-09-14:
 *
 *   01 customer order — the Factory Manager records it, the Director confirms
 *   02 sample and technical confirmation (design + Factory Manager)
 *   03 production plan (Factory Manager)
 *   04 material supply (Storekeeper); short → purchase, Director approves the spend
 *   05 production, three workshop stages: woodwork → lacquer → finishing,
 *      with the raw-body inspection before lacquer
 *   06 quality control — the finishing inspection; fail → back to 05
 *   07 packing — the Storekeeper's packing slip and photos, then the packing
 *      inspection; the goods go straight onto pallets or into the container;
 *      labels follow the customer's template or a Director-approved proof
 *   08 export documents — INV, PKL, labels by the Factory Accountant
 *   09 customs — declaration by the Company Accountant
 *   10 dispatch — goods leave for the port
 *   11 receivables and the Director's closing report
 *
 * Each stage names the role that owns it, the permission required to leave it,
 * and whether leaving it needs a Director decision. Holding the permission is
 * never sufficient on its own: `assertTransition` also refuses any move the
 * process does not allow, and refuses to leave a stage whose SOP output has
 * not been recorded (plan, inspections, packing slip, documents).
 */

export const orderStages = [
  "received",
  "awaitingDirectorApproval",
  "sampleConfirmation",
  "productionPlanning",
  "inventoryCheck",
  "materialProcurement",
  "inProduction",
  "qualityControl",
  "packing",
  "exportDocuments",
  "tradeDocumentation",
  "shipped",
  "invoiced",
  "settled",
  "closed",
  "cancelled",
] as const;

export type OrderStage = (typeof orderStages)[number];

/**
 * Stage keys retired when the fifteen-step chart was replaced by the SOP.
 * Records written under the old chart are read forward to the stage that now
 * covers the same work; nothing is rewritten in the database.
 */
export const retiredOrderStages = {
  fileOpened: "received",
  materialIssued: "inventoryCheck",
  loadingScheduled: "shipped",
} as const satisfies Record<string, OrderStage>;

const stageSet: ReadonlySet<string> = new Set(orderStages);

export function normalizeOrderStage(value: string): OrderStage {
  if (stageSet.has(value)) return value as OrderStage;
  const retired = (retiredOrderStages as Record<string, OrderStage>)[value];
  if (retired) return retired;
  throw new Error(`Unknown order stage: ${value}`);
}

/** The three workshop stages of step 05, in order. Packing is step 07. */
export const productionStages = ["woodwork", "lacquer", "finishing"] as const;

export type ProductionStage = (typeof productionStages)[number];

export const productionStageLabels: Record<
  ProductionStage,
  { vi: string; en: string }
> = {
  woodwork: { vi: "Mộc", en: "Woodwork" },
  lacquer: { vi: "Sơn", en: "Lacquer" },
  finishing: { vi: "Hoàn thiện", en: "Finishing" },
};

/**
 * The three inspections the Factory Manager runs (confirmed 2026-09-14):
 * the raw body before lacquer, the finished piece before packing, and the
 * packed goods before dispatch. Each is recorded in the stage it belongs to.
 */
export const qcCheckpoints = ["woodwork", "finishing", "packing"] as const;

export type QcCheckpoint = (typeof qcCheckpoints)[number];

export const qcCheckpointLabels: Record<
  QcCheckpoint,
  { vi: string; en: string }
> = {
  woodwork: { vi: "Kiểm mộc", en: "Raw-body inspection" },
  finishing: { vi: "Kiểm hoàn thiện", en: "Finishing inspection" },
  packing: { vi: "Kiểm đóng gói", en: "Packing inspection" },
};

/** The stage in which each inspection is recorded. */
export const qcCheckpointStage: Record<QcCheckpoint, OrderStage> = {
  woodwork: "inProduction",
  finishing: "qualityControl",
  packing: "packing",
};

export type OrderStageDefinition = {
  readonly stage: OrderStage;
  /** Position in the SOP chart; null for terminal states. */
  readonly step: number | null;
  readonly labels: { readonly vi: string; readonly en: string };
  /** The position accountable for moving the order out of this stage. */
  readonly ownerRole: SystemRoleKey;
  /** Permission required to leave this stage. */
  readonly advancePermission: Permission;
  /** Director decision required before this stage may be left. */
  readonly approvalSubject: ApprovalSubject | null;
  readonly next: readonly OrderStage[];
};

export const orderStageDefinitions = {
  received: {
    stage: "received",
    step: 1,
    labels: {
      vi: "Khách hàng đặt hàng",
      en: "Customer order",
    },
    // The Factory Manager receives the order (task sheet, 2026-09-14); the
    // Company Accountant may also record one. Leaving the stage submits it
    // to the Director.
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "orders.submitForApproval",
    approvalSubject: null,
    next: ["awaitingDirectorApproval", "cancelled"],
  },
  awaitingDirectorApproval: {
    stage: "awaitingDirectorApproval",
    step: 1,
    labels: {
      vi: "Giám đốc xác nhận đơn hàng",
      en: "Director confirms the order",
    },
    ownerRole: "DIRECTOR",
    advancePermission: "orders.confirm",
    approvalSubject: "order.confirm",
    next: ["sampleConfirmation", "cancelled"],
  },
  sampleConfirmation: {
    stage: "sampleConfirmation",
    step: 2,
    labels: {
      vi: "Xác nhận mẫu & kỹ thuật",
      en: "Sample and technical confirmation",
    },
    // Design develops the sample in the weekly sample report; the Factory
    // Manager confirms it can be produced and moves the order on.
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "samples.recordInternalReview",
    approvalSubject: null,
    next: ["productionPlanning", "cancelled"],
  },
  productionPlanning: {
    stage: "productionPlanning",
    step: 3,
    labels: {
      vi: "Lập kế hoạch sản xuất",
      en: "Production plan",
    },
    // No Director gate: the Director approves sales and spending, not the
    // plan (confirmed 2026-09-14). Leaving requires the plan to be saved.
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "production.createPlan",
    approvalSubject: null,
    next: ["inventoryCheck", "cancelled"],
  },
  inventoryCheck: {
    stage: "inventoryCheck",
    step: 4,
    labels: {
      vi: "Kho cấp vật tư",
      en: "Material supply",
    },
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "inventory.issue",
    approvalSubject: null,
    // Enough material issues it to production; otherwise the order waits on
    // a purchase, which the Storekeeper raises.
    next: ["inProduction", "materialProcurement", "cancelled"],
  },
  materialProcurement: {
    stage: "materialProcurement",
    step: 4,
    labels: {
      vi: "Đặt mua vật tư",
      en: "Purchase material",
    },
    // Buying is spending, so the Director approves it; the goods arriving is
    // what releases the order, and receipt stays with the Storekeeper.
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "procurement.receive",
    approvalSubject: "procurement.purchase",
    next: ["inventoryCheck", "inProduction", "cancelled"],
  },
  inProduction: {
    stage: "inProduction",
    step: 5,
    labels: {
      vi: "Sản xuất",
      en: "Production",
    },
    // Woodwork → lacquer → finishing, tracked on the order; the raw-body
    // inspection must pass before lacquer starts, and finishing must be
    // reached before the order goes to quality control.
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "production.completeWork",
    approvalSubject: null,
    next: ["qualityControl", "cancelled"],
  },
  qualityControl: {
    stage: "qualityControl",
    step: 6,
    labels: {
      vi: "Kiểm tra chất lượng (QC)",
      en: "Quality control",
    },
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "production.approveQc",
    approvalSubject: null,
    // Failed inspection returns the order to production for rework.
    next: ["packing", "inProduction", "cancelled"],
  },
  packing: {
    stage: "packing",
    step: 7,
    labels: {
      vi: "Đóng gói & nhập thành phẩm",
      en: "Packing",
    },
    // The Storekeeper records the packing slip and photographs the goods; the
    // Factory Manager's packing inspection must pass before the stage is left.
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "packing.complete",
    approvalSubject: null,
    next: ["exportDocuments", "cancelled"],
  },
  exportDocuments: {
    stage: "exportDocuments",
    step: 8,
    labels: {
      vi: "Lập chứng từ xuất hàng",
      en: "Export documents",
    },
    // INV and PKL by the Factory Accountant; both must be on file to leave.
    ownerRole: "FACTORY_ACCOUNTANT",
    advancePermission: "tradeDocuments.manage",
    approvalSubject: null,
    next: ["tradeDocumentation", "cancelled"],
  },
  tradeDocumentation: {
    stage: "tradeDocumentation",
    step: 9,
    labels: {
      vi: "Thủ tục xuất nhập khẩu",
      en: "Customs clearance",
    },
    // The customs declaration by the Company Accountant must be on file.
    ownerRole: "COMPANY_ACCOUNTANT",
    advancePermission: "tradeDocuments.manage",
    approvalSubject: null,
    next: ["shipped", "cancelled"],
  },
  shipped: {
    stage: "shipped",
    step: 10,
    labels: {
      vi: "Xuất hàng – Giao khách",
      en: "Dispatch",
    },
    // No Director gate on dispatch (SOP step 10 names none). The Storekeeper
    // records the goods leaving; B/L, C/O and the certificates follow within
    // the week and are tracked on the document checklist.
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "shipments.dispatch",
    approvalSubject: null,
    next: ["invoiced"],
  },
  invoiced: {
    stage: "invoiced",
    step: 11,
    labels: {
      vi: "Theo dõi công nợ & báo cáo",
      en: "Receivables and report",
    },
    // Customer money stays with the Company Accountant (the Factory
    // Accountant reads the selling price but never what the customer paid,
    // confirmed 2026-09-14). A partially paid order stays here.
    ownerRole: "COMPANY_ACCOUNTANT",
    advancePermission: "payments.record",
    approvalSubject: null,
    next: ["settled"],
  },
  settled: {
    stage: "settled",
    step: 11,
    labels: {
      vi: "Đã thu đủ – Giám đốc đóng hồ sơ",
      en: "Paid in full – Director closes the file",
    },
    // The profit report is the Director's alone; closing the file against it
    // is the Director's decision.
    ownerRole: "DIRECTOR",
    advancePermission: "orders.close",
    approvalSubject: null,
    next: ["closed"],
  },
  closed: {
    stage: "closed",
    step: null,
    labels: { vi: "Đã đóng hồ sơ đơn hàng", en: "Order closed" },
    ownerRole: "DIRECTOR",
    advancePermission: "orders.close",
    approvalSubject: null,
    next: [],
  },
  cancelled: {
    stage: "cancelled",
    step: null,
    labels: { vi: "Đã hủy", en: "Cancelled" },
    ownerRole: "DIRECTOR",
    advancePermission: "orders.cancel",
    approvalSubject: null,
    next: [],
  },
} as const satisfies Record<OrderStage, OrderStageDefinition>;

export const terminalOrderStages = ["closed", "cancelled"] as const;

export function isTerminalStage(stage: OrderStage): boolean {
  return (terminalOrderStages as readonly OrderStage[]).includes(stage);
}

export const orderTransitionErrorCodes = [
  "INVALID_TRANSITION",
  "TERMINAL_STAGE",
  "APPROVAL_REQUIRED",
  "QC_NOT_PASSED",
  "REASON_REQUIRED",
  "PLAN_MISSING",
  "PRODUCTION_INCOMPLETE",
  "PACKING_NOT_READY",
  "LABELS_NOT_APPROVED",
  "EXPORT_DOCUMENTS_MISSING",
  "CUSTOMS_DECLARATION_MISSING",
] as const;

export type OrderTransitionErrorCode =
  (typeof orderTransitionErrorCodes)[number];

export class OrderTransitionError extends Error {
  readonly code: OrderTransitionErrorCode;

  constructor(code: OrderTransitionErrorCode, message: string) {
    super(message);
    this.name = "OrderTransitionError";
    this.code = code;
  }
}

/**
 * What the order has on file, as the SOP outputs the stages demand. Computed
 * once per record by `orderReadiness` in the contracts module and judged here.
 */
export type OrderReadiness = {
  /** The production plan has been saved (step 03 output). */
  readonly planned: boolean;
  /** The finishing stage has been reached (step 05 complete). */
  readonly productionComplete: boolean;
  /** Packing slip recorded and the packing inspection passed (step 07). */
  readonly packingReady: boolean;
  /**
   * The customer's label and shipping-mark spec is on file, or the company's
   * own proof has been approved by the Director (2026-09-14). Step 07.
   */
  readonly labelsReady: boolean;
  /** INV and PKL on file (step 08). */
  readonly exportDocumentsReady: boolean;
  /** Customs declaration on file (step 09). */
  readonly customsDeclared: boolean;
};

export const emptyReadiness: OrderReadiness = {
  planned: false,
  productionComplete: false,
  packingReady: false,
  labelsReady: false,
  exportDocumentsReady: false,
  customsDeclared: false,
};

export type OrderTransitionContext = {
  readonly from: OrderStage;
  readonly to: OrderStage;
  /** True once a Director decision for the stage's subject is approved. */
  readonly hasApproval: boolean;
  /** Mandatory finishing inspection; packing is refused until it passes. */
  readonly qcPassed: boolean;
  /** Cancellation and rework must always record why. */
  readonly reason: string | null;
  readonly readiness: OrderReadiness;
};

/**
 * The single place a stage change is judged. Permission is checked separately by
 * the caller's policy layer; this function answers only whether the process
 * permits the move.
 */
export function assertTransition(context: OrderTransitionContext): void {
  const { from, to, hasApproval, qcPassed, reason, readiness } = context;
  const definition = orderStageDefinitions[from];

  if (isTerminalStage(from)) {
    throw new OrderTransitionError(
      "TERMINAL_STAGE",
      "A closed or cancelled order cannot move to another stage.",
    );
  }

  if (!(definition.next as readonly OrderStage[]).includes(to)) {
    throw new OrderTransitionError(
      "INVALID_TRANSITION",
      `An order cannot move from ${from} to ${to}.`,
    );
  }

  if (definition.approvalSubject && !hasApproval) {
    throw new OrderTransitionError(
      "APPROVAL_REQUIRED",
      "This stage requires an approved Director decision before it can advance.",
    );
  }

  const needsReason =
    to === "cancelled" || (from === "qualityControl" && to === "inProduction");

  if (needsReason && !reason?.trim()) {
    throw new OrderTransitionError(
      "REASON_REQUIRED",
      "Cancelling an order or returning it for rework must record a reason.",
    );
  }

  // Cancelling never waits on an output; the guards below only apply to the
  // forward moves.
  if (to === "cancelled") return;

  if (from === "productionPlanning" && !readiness.planned) {
    throw new OrderTransitionError(
      "PLAN_MISSING",
      "Save the production plan before the order leaves planning.",
    );
  }

  if (from === "inProduction" && !readiness.productionComplete) {
    throw new OrderTransitionError(
      "PRODUCTION_INCOMPLETE",
      "The order reaches quality control only once finishing is under way.",
    );
  }

  // Mandatory inspection: packing and everything downstream is blocked until
  // the finishing inspection passes.
  if (from === "qualityControl" && to === "packing" && !qcPassed) {
    throw new OrderTransitionError(
      "QC_NOT_PASSED",
      "Packing is blocked until the required quality check passes.",
    );
  }

  if (from === "packing" && !readiness.packingReady) {
    throw new OrderTransitionError(
      "PACKING_NOT_READY",
      "Record the packing slip and pass the packing inspection first.",
    );
  }

  // Labels and shipping marks print from the customer's template, or from
  // the company's own proof once the Director has approved it.
  if (from === "packing" && !readiness.labelsReady) {
    throw new OrderTransitionError(
      "LABELS_NOT_APPROVED",
      "File the customer's label spec, or have the Director approve the company proof.",
    );
  }

  if (from === "exportDocuments" && !readiness.exportDocumentsReady) {
    throw new OrderTransitionError(
      "EXPORT_DOCUMENTS_MISSING",
      "The invoice (INV) and packing list (PKL) must be on file.",
    );
  }

  if (from === "tradeDocumentation" && !readiness.customsDeclared) {
    throw new OrderTransitionError(
      "CUSTOMS_DECLARATION_MISSING",
      "The customs declaration must be on file.",
    );
  }
}

/**
 * Whether a move must record a reason, mirroring the branch inside
 * `assertTransition` so a form can require the field before submitting.
 */
export function transitionNeedsReason(
  from: OrderStage,
  to: OrderStage,
): boolean {
  return (
    to === "cancelled" || (from === "qualityControl" && to === "inProduction")
  );
}

/** Ordered stages for progress display, excluding the terminal branches. */
export const orderProgressStages = orderStages.filter(
  (stage) => !isTerminalStage(stage),
);

export function stageDefinition(stage: OrderStage): OrderStageDefinition {
  return orderStageDefinitions[stage];
}
