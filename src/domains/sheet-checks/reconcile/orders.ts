import type { OrderRecordDto } from "@/domains/orders/contracts";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { stageFromText } from "@/domains/sheet-checks/parsing/code";
import { stageLabelVi } from "@/domains/sheet-checks/reconcile/shared";

/**
 * Order lookups inside the runner's own scope. The index holds only the
 * orders the snapshot carries, so an order outside the runner's units and
 * an order that does not exist yield the very same finding — nothing in
 * the code, the params or the timing tells them apart. The only leniency
 * is leading zeros (a numeric Excel cell drops them); codes are never
 * fuzzy-matched.
 */

export type OrderIndex = {
  byCode: Map<string, OrderRecordDto>;
  /** Each zero-stripped digit run of a code → the orders holding it. */
  byDigits: Map<string, OrderRecordDto[]>;
};

const DIGIT_RUN = /\d+/g;

/** "000123" → "123", "0" stays "0". */
function stripLeadingZeros(run: string): string {
  return run.replace(/^0+(?=\d)/, "");
}

/** The code with every digit run stripped of leading zeros: "RD-000123" → "RD-123". */
function structuralKey(code: string): string {
  return code.replace(DIGIT_RUN, stripLeadingZeros);
}

function digitRuns(code: string): string[] {
  return (code.match(DIGIT_RUN) ?? []).map(stripLeadingZeros);
}

export function buildOrderIndex(orders: readonly OrderRecordDto[]): OrderIndex {
  const byCode = new Map<string, OrderRecordDto>();
  const byDigits = new Map<string, OrderRecordDto[]>();
  for (const order of orders) {
    byCode.set(order.orderCode.toUpperCase(), order);
    for (const run of new Set(digitRuns(order.orderCode))) {
      const list = byDigits.get(run) ?? [];
      list.push(order);
      byDigits.set(run, list);
    }
  }
  return { byCode, byDigits };
}

function sortedByCode(orders: Iterable<OrderRecordDto>): OrderRecordDto[] {
  return [...new Set(orders)].sort((left, right) =>
    left.orderCode.localeCompare(right.orderCode),
  );
}

export type OrderResolution = {
  order: OrderRecordDto | null;
  issues: Issue[];
};

/**
 * Exact code first; then the same code modulo leading zeros in any digit
 * run (unique → CODE_LEADING_ZERO_MATCH, several → CODE_AMBIGUOUS); else
 * ORDER_NOT_FOUND. Hints name in-scope orders sharing a digits-only code,
 * and only those, so the finding is a pure function of the sheet text.
 */
export function resolveOrder(code: string, index: OrderIndex): OrderResolution {
  const wanted = code.trim().toUpperCase();
  const exact = index.byCode.get(wanted);
  if (exact) return { order: exact, issues: [] };

  const structure = structuralKey(wanted);
  const candidates = sortedByCode(
    digitRuns(wanted).flatMap((run) => index.byDigits.get(run) ?? []),
  ).filter(
    (order) => structuralKey(order.orderCode.toUpperCase()) === structure,
  );

  const [first] = candidates;
  if (candidates.length === 1 && first) {
    return {
      order: first,
      issues: [issue("CODE_LEADING_ZERO_MATCH", { code: first.orderCode })],
    };
  }
  if (candidates.length > 1) {
    return { order: null, issues: [issue("CODE_AMBIGUOUS", { raw: code })] };
  }

  // Hints only for digits-only codes (a numeric cell): the in-scope orders
  // whose code carries that number somewhere, e.g. "20260906" → RD-20260906-….
  const hints = /^\d{2,}$/.test(wanted)
    ? sortedByCode(index.byDigits.get(stripLeadingZeros(wanted)) ?? [])
        .slice(0, sheetCheckLimits.orderHintsShown)
        .map((order) => order.orderCode)
    : [];
  return {
    order: null,
    issues: [
      issue("ORDER_NOT_FOUND", {
        code,
        ...(hints.length > 0 ? { hints: hints.join(", ") } : {}),
      }),
    ],
  };
}

/** ORDER_MATCHED with the stage label, plus the terminal-state notices. */
export function orderIssues(order: OrderRecordDto): Issue[] {
  const issues: Issue[] = [
    issue("ORDER_MATCHED", {
      code: order.orderCode,
      stage: stageLabelVi(order.stage),
      customer: order.customerName,
    }),
  ];
  if (order.stage === "cancelled") {
    issues.push(issue("ORDER_CANCELLED", { code: order.orderCode }));
  } else if (order.stage === "closed") {
    issues.push(issue("ORDER_CLOSED", { code: order.orderCode }));
  }
  return issues;
}

/** The sheet's stage text against the order's stage; null when they agree. */
export function compareStage(
  sheetStage: string,
  order: OrderRecordDto,
): Issue | null {
  const stage = stageFromText(sheetStage);
  if (stage === null) {
    return issue("STAGE_UNRECOGNIZED", { raw: sheetStage });
  }
  if (stage === order.stage) return null;
  return issue("STAGE_MISMATCH", {
    sheet: sheetStage,
    system: stageLabelVi(order.stage),
  });
}
