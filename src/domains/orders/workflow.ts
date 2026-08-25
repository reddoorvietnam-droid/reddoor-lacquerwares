import type { ApprovalSubject } from "@/domains/approvals/contracts";
import type { Permission } from "@/domains/identity/permissions";
import type { SystemRoleKey } from "@/domains/identity/role-definitions";

/**
 * The sales-order lifecycle, encoding the company's confirmed fifteen-step
 * process:
 *
 *   1  customer order received
 *   2  Company Accountant opens the order file
 *   3  Director approval
 *   4  Factory Manager production planning
 *   5  Storekeeper inventory check
 *   6  material available? -> issue to production, or purchase first
 *   7  production / sub-workshop / printing / moulding
 *   8  Factory Accountant tracks cost
 *   9  inspection and quality control
 *   10 packing
 *   11 import/export documentation
 *   12 loading schedule
 *   13 delivery / shipment
 *   14 invoice and incoming cash
 *   15 final cost and profit report, then the order closes
 *
 * Each stage names the role that owns it, the permission required to leave it,
 * and whether leaving it needs a Director decision. Holding the permission is
 * never sufficient on its own: `assertTransition` also refuses any move the
 * process does not allow.
 */

export const orderStages = [
  "received",
  "fileOpened",
  "awaitingDirectorApproval",
  "productionPlanning",
  "inventoryCheck",
  "materialProcurement",
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
  "cancelled",
] as const;

export type OrderStage = (typeof orderStages)[number];

export type OrderStageDefinition = {
  readonly stage: OrderStage;
  /** Position in the printed process chart; null for terminal states. */
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
      vi: "Nhận đơn hàng từ khách hàng",
      en: "Customer order received",
    },
    ownerRole: "ORDER_MANAGER",
    advancePermission: "orders.updateDraft",
    approvalSubject: null,
    next: ["fileOpened", "cancelled"],
  },
  fileOpened: {
    stage: "fileOpened",
    step: 2,
    labels: {
      vi: "Kế toán công ty mở hồ sơ đơn hàng",
      en: "Company Accountant opens the order file",
    },
    // Order number, customer record, proforma, payment terms and the
    // import/export document checklist are created here.
    ownerRole: "COMPANY_ACCOUNTANT",
    advancePermission: "orders.submitForApproval",
    approvalSubject: null,
    next: ["awaitingDirectorApproval", "cancelled"],
  },
  awaitingDirectorApproval: {
    stage: "awaitingDirectorApproval",
    step: 3,
    labels: {
      vi: "Giám đốc phê duyệt đơn hàng, giá và điều khoản",
      en: "Director approves the order, price, and terms",
    },
    ownerRole: "DIRECTOR",
    advancePermission: "orders.confirm",
    approvalSubject: "order.confirm",
    next: ["productionPlanning", "cancelled"],
  },
  productionPlanning: {
    stage: "productionPlanning",
    step: 4,
    labels: {
      vi: "Quản đốc nhà máy lập kế hoạch sản xuất",
      en: "Factory Manager plans production",
    },
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "production.createPlan",
    approvalSubject: "production.plan",
    next: ["inventoryCheck", "cancelled"],
  },
  inventoryCheck: {
    stage: "inventoryCheck",
    step: 5,
    labels: {
      vi: "Thủ kho kiểm tra tồn kho",
      en: "Storekeeper checks inventory",
    },
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "inventory.read",
    approvalSubject: null,
    // Step 6 is the decision point: enough material issues it to production,
    // otherwise the order waits on a purchase.
    next: ["materialIssued", "materialProcurement", "cancelled"],
  },
  materialProcurement: {
    stage: "materialProcurement",
    step: 6,
    labels: {
      vi: "Đặt mua nguyên liệu",
      en: "Purchase material",
    },
    // The Supplier Manager raises the purchase, but what releases the order is
    // the goods arriving. Receipt stays with the storekeeper so the person who
    // buys is never the person who confirms delivery.
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "procurement.receive",
    approvalSubject: "procurement.purchase",
    next: ["inventoryCheck", "materialIssued", "cancelled"],
  },
  materialIssued: {
    stage: "materialIssued",
    step: 6,
    labels: {
      vi: "Xuất nguyên liệu cho sản xuất",
      en: "Material issued to production",
    },
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "inventory.issue",
    approvalSubject: null,
    next: ["inProduction", "cancelled"],
  },
  inProduction: {
    stage: "inProduction",
    step: 7,
    labels: {
      vi: "Sản xuất, in ấn, ép khuôn và xưởng phụ",
      en: "Production, printing, moulding, and sub-workshops",
    },
    // Step 8, the Factory Accountant's cost tracking, runs alongside production
    // rather than blocking it, so it is recorded against the order instead of
    // occupying a stage of its own.
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "production.completeWork",
    approvalSubject: null,
    next: ["qualityControl", "cancelled"],
  },
  qualityControl: {
    stage: "qualityControl",
    step: 9,
    labels: {
      vi: "Kiểm tra và kiểm soát chất lượng",
      en: "Inspection and quality control",
    },
    ownerRole: "FACTORY_MANAGER",
    advancePermission: "production.approveQc",
    approvalSubject: null,
    // Failed inspection returns the order to production for rework.
    next: ["packing", "inProduction", "cancelled"],
  },
  packing: {
    stage: "packing",
    step: 10,
    labels: { vi: "Đóng gói", en: "Packing" },
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "packing.complete",
    approvalSubject: null,
    next: ["tradeDocumentation", "cancelled"],
  },
  tradeDocumentation: {
    stage: "tradeDocumentation",
    step: 11,
    labels: {
      vi: "Hồ sơ xuất nhập khẩu",
      en: "Import and export documentation",
    },
    ownerRole: "COMPANY_ACCOUNTANT",
    advancePermission: "tradeDocuments.manage",
    approvalSubject: null,
    next: ["loadingScheduled", "cancelled"],
  },
  loadingScheduled: {
    stage: "loadingScheduled",
    step: 12,
    labels: { vi: "Lịch đóng hàng", en: "Loading schedule" },
    // Order management agrees the schedule; the warehouse confirms the vehicle
    // or container and releases the shipment.
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "shipments.dispatch",
    approvalSubject: "order.dispatch",
    next: ["shipped", "cancelled"],
  },
  shipped: {
    stage: "shipped",
    step: 13,
    labels: { vi: "Giao hàng và xuất lô", en: "Delivery and shipment" },
    ownerRole: "WAREHOUSE_MANAGER",
    advancePermission: "documents.generate",
    approvalSubject: null,
    next: ["invoiced"],
  },
  invoiced: {
    stage: "invoiced",
    step: 14,
    labels: {
      vi: "Hóa đơn và tiền thu về",
      en: "Invoice and incoming cash",
    },
    ownerRole: "COMPANY_ACCOUNTANT",
    advancePermission: "payments.record",
    approvalSubject: null,
    // A partially paid order stays here until the receivable clears.
    next: ["settled"],
  },
  settled: {
    stage: "settled",
    step: 15,
    labels: {
      vi: "Báo cáo chi phí và lợi nhuận cuối cùng",
      en: "Final cost and profit report",
    },
    // The Company Accountant produces the final cost and profit report; closing
    // the order file against it is the Director's decision.
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

export type OrderTransitionContext = {
  readonly from: OrderStage;
  readonly to: OrderStage;
  /** True once a Director decision for the stage's subject is approved. */
  readonly hasApproval: boolean;
  /** Mandatory inspection result; packing is refused until it passes. */
  readonly qcPassed: boolean;
  /** Cancellation and rework must always record why. */
  readonly reason: string | null;
};

/**
 * The single place a stage change is judged. Permission is checked separately by
 * the caller's policy layer; this function answers only whether the process
 * permits the move.
 */
export function assertTransition(context: OrderTransitionContext): void {
  const { from, to, hasApproval, qcPassed, reason } = context;
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

  // Mandatory inspection: packing and everything downstream is blocked until
  // quality control passes.
  if (from === "qualityControl" && to === "packing" && !qcPassed) {
    throw new OrderTransitionError(
      "QC_NOT_PASSED",
      "Packing is blocked until the required quality check passes.",
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
}

/** Ordered stages for progress display, excluding the terminal branches. */
export const orderProgressStages = orderStages.filter(
  (stage) => !isTerminalStage(stage),
);

export function stageDefinition(stage: OrderStage): OrderStageDefinition {
  return orderStageDefinitions[stage];
}
