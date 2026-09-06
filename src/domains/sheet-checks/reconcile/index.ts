import type { Permission } from "@/domains/identity/permissions";
import type {
  CheckSummary,
  RowOutcome,
  RowResult,
  RowSystemView,
  SystemOnlyItem,
} from "@/domains/sheet-checks/contracts";
import { countBySeverity, type Issue } from "@/domains/sheet-checks/issues";
import { reconcileIncomingCash } from "@/domains/sheet-checks/reconcile/cash";
import { findDuplicates } from "@/domains/sheet-checks/reconcile/duplicates";
import { reconcileGeneric } from "@/domains/sheet-checks/reconcile/generic";
import { buildOrderIndex } from "@/domains/sheet-checks/reconcile/orders";
import { reconcileReceivables } from "@/domains/sheet-checks/reconcile/receivables";
import {
  RowAccumulator,
  type ReconcileInput,
  type ReconcileOutput,
} from "@/domains/sheet-checks/reconcile/shared";
import {
  checkTotals,
  type TotalsSystemInput,
} from "@/domains/sheet-checks/reconcile/totals";

export type { ReconcileInput, ReconcileOutput };

/**
 * The reconciliation of one parsed sheet against the system snapshot.
 *
 * `reconcile()` is pure: it receives the stored rows, the parsed values and
 * the snapshot the service was allowed to load, and returns one result per
 * row plus the sheet-level findings. It never touches a store, so the only
 * way money reaches a result is through a snapshot part the runner's
 * permissions filled in.
 */

/** What every template engine hands back to the orchestrator. */
export type EngineOutput = {
  rowIssues: ReadonlyMap<number, Issue[]>;
  rowSystem: ReadonlyMap<number, RowSystemView>;
  sheetIssues: Issue[];
  systemOnly: SystemOnlyItem[];
};

function emptyOutcomes(): Record<RowOutcome, number> {
  return {
    matched: 0,
    mismatch: 0,
    notFound: 0,
    notCompared: 0,
    invalid: 0,
    skipped: 0,
  };
}

export function reconcile(input: ReconcileInput): ReconcileOutput {
  const orderIndex = buildOrderIndex(input.system.orders ?? []);
  const duplicates = findDuplicates(
    input.parsed.rows,
    input.template,
    input.rows,
  );

  let engine: EngineOutput;
  let exercised: Permission[] = [];
  let totalsSystem: TotalsSystemInput | null = null;
  switch (input.template) {
    case "incomingCash": {
      const cash = reconcileIncomingCash({ ...input, orderIndex });
      engine = cash;
      totalsSystem = { periodTotals: cash.periodTotals };
      break;
    }
    case "receivables": {
      const receivables = reconcileReceivables({ ...input, orderIndex });
      engine = receivables;
      totalsSystem = { fieldTotals: receivables.systemTotals };
      break;
    }
    case "generic": {
      const generic = reconcileGeneric({ ...input, orderIndex });
      engine = generic;
      exercised = generic.exercised;
      break;
    }
  }

  const totals = checkTotals({
    rows: input.rows,
    parsed: input.parsed,
    mapping: input.mapping,
    headerTexts: input.headerTexts,
    system: totalsSystem,
    template: input.template,
  });

  const outcomes = emptyOutcomes();
  const rowIssues: Issue[] = [];
  let dataRows = 0;

  const rowResults = input.parsed.rows.map((entry) => {
    if (!entry.skipped) dataRows += 1;
    const accumulator = new RowAccumulator({
      rowIndex: entry.rowIndex,
      template: input.template,
      parsed: entry.parsed,
      skipped: entry.skipped,
      parsingIssues: entry.issues,
    });
    // Parsing first, then duplicates, then the comparison: the order people
    // read a row's findings in, and stable across reruns.
    accumulator.addDuplicateIssues(duplicates.get(entry.rowIndex) ?? []);
    accumulator.addComparisonIssues(engine.rowIssues.get(entry.rowIndex) ?? []);
    if (!entry.skipped) {
      accumulator.setSystem(engine.rowSystem.get(entry.rowIndex) ?? null);
    }
    const result: RowResult = accumulator.toResult();
    outcomes[result.outcome] += 1;
    rowIssues.push(...result.issues);
    return { rowIndex: entry.rowIndex, result };
  });

  const sheetIssues = [
    ...input.parsed.columnIssues,
    ...engine.sheetIssues,
    ...totals.issues,
  ];
  const counts = countBySeverity([...rowIssues, ...sheetIssues]);

  const summary: CheckSummary = {
    dataRows,
    skippedRows: input.parsed.rows.length - dataRows,
    errors: counts.error,
    warnings: counts.warn,
    infos: counts.info,
    outcomes,
    totals: totals.lines,
  };

  return {
    rowResults,
    sheetIssues,
    summary,
    systemOnly: engine.systemOnly,
    exercised,
  };
}
