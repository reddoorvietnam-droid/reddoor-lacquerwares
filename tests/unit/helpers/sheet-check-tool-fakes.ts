import type { Permission } from "@/domains/identity/permissions";
import {
  emptyParsedRow,
  SheetCheckError,
  templateGates,
  type CanonicalField,
  type CheckResult,
  type CheckSummary,
  type MappingProposal,
  type NewSheetCheckRecord,
  type NewSheetRowRecord,
  type ParsedRow,
  type RowOutcome,
  type RowResult,
  type RowSystemView,
  type SheetCell,
  type SheetCheckAuthorizationView,
  type SheetCheckDto,
  type SheetCheckListFilter,
  type SheetCheckListScope,
  type SheetCheckStatus,
  type SheetCheckStore,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRowDto,
  type SheetRowKind,
  type SheetRowListOptions,
  type SystemOnlyItem,
  type TotalsLine,
} from "@/domains/sheet-checks/contracts";
import {
  issue,
  severityRank,
  worstSeverity,
  type Issue,
  type IssueSeverity,
} from "@/domains/sheet-checks/issues";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

import { nextId, occurredAt } from "./finance-fakes";

/**
 * In-memory sheet-check store, a read-only service fake that applies the
 * read rule of spec § 2.10 (documents.read plus every stamped permission,
 * present in the access context the tool's guard built), and fixture
 * builders that produce checked results shaped like the reconciliation
 * engines produce them — issues as codes and params, money as decimal
 * strings, system views only where the run was allowed to compare.
 */

export type PermissionCoverage = {
  global: boolean;
  businessUnitIds: readonly string[];
};

/** The read surface of agent C's `SheetCheckService` the tools depend on. */
export interface SheetCheckReadService {
  findForAuthorization(
    checkId: string,
  ): Promise<SheetCheckAuthorizationView | null>;
  get(context: AccessContext, checkId: string): Promise<SheetCheckDto>;
  listForReader(
    context: AccessContext,
    coverages: Partial<Record<Permission, PermissionCoverage>>,
    query: {
      template?: SheetCheckTemplate;
      status?: SheetCheckStatus;
      limit: number;
      offset: number;
    },
  ): Promise<SheetCheckDto[]>;
  listRows(
    context: AccessContext,
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<{ rows: SheetRowDto[]; issueRowCount: number }>;
  findRow(
    context: AccessContext,
    checkId: string,
    rowIndex: number,
  ): Promise<SheetRowDto>;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

function rowSeverity(row: SheetRowDto): IssueSeverity | null {
  return worstSeverity(row.result?.issues ?? []);
}

function reachesSeverity(
  row: SheetRowDto,
  minSeverity: IssueSeverity | undefined,
): boolean {
  if (!minSeverity) return true;
  const worst = rowSeverity(row);
  return worst !== null && severityRank[worst] >= severityRank[minSeverity];
}

function inScope(check: SheetCheckDto, scope: SheetCheckListScope): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "own") return check.createdByUserId === scope.userId;
  if (check.createdByUserId === scope.userId) return true;
  return (
    check.businessUnitIds.length > 0 &&
    check.businessUnitIds.every((id) => scope.businessUnitIds.includes(id))
  );
}

export class FakeSheetCheckStore implements SheetCheckStore {
  checks = new Map<string, SheetCheckDto>();
  rows = new Map<string, SheetRowDto[]>();
  listCalls: SheetCheckListFilter[] = [];
  listRowsCalls: { checkId: string; options: SheetRowListOptions }[] = [];

  seed(check: SheetCheckDto, rows: readonly SheetRowDto[]): SheetCheckDto {
    this.checks.set(check.id, check);
    this.rows.set(
      check.id,
      [...rows].sort((left, right) => left.index - right.index),
    );
    return check;
  }

  async insert(
    record: NewSheetCheckRecord,
    rows: readonly NewSheetRowRecord[],
  ): Promise<SheetCheckDto> {
    const id = nextId("5");
    const check: SheetCheckDto = {
      ...record,
      id,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: 0,
    };
    return this.seed(
      check,
      rows.map((row) => ({ ...row, checkId: id, result: null })),
    );
  }

  async findById(checkId: string): Promise<SheetCheckDto | null> {
    return this.checks.get(checkId) ?? null;
  }

  async list(filter: SheetCheckListFilter): Promise<SheetCheckDto[]> {
    this.listCalls.push(filter);
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return [...this.checks.values()]
      .filter(
        (check) =>
          inScope(check, filter.scope) &&
          (!filter.template || check.template === filter.template) &&
          (!filter.status || check.status === filter.status),
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(offset, offset + limit);
  }

  async countRowsWithIssues(
    checkId: string,
    minSeverity: IssueSeverity,
  ): Promise<number> {
    return (this.rows.get(checkId) ?? []).filter((row) =>
      reachesSeverity(row, minSeverity),
    ).length;
  }

  async listRows(
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<SheetRowDto[]> {
    this.listRowsCalls.push({ checkId, options });
    return (this.rows.get(checkId) ?? [])
      .filter((row) => reachesSeverity(row, options.minSeverity))
      .slice(options.offset, options.offset + options.limit);
  }

  async findRow(
    checkId: string,
    rowIndex: number,
  ): Promise<SheetRowDto | null> {
    return (
      (this.rows.get(checkId) ?? []).find((row) => row.index === rowIndex) ??
      null
    );
  }

  async markChecked(input: {
    checkId: string;
    expectedRevision: number;
    mapping: SheetMapping;
    result: CheckResult;
    rowResults: readonly { rowIndex: number; result: RowResult }[];
    requiredPermissions: readonly Permission[];
    checkedAt: Date;
    expiresAt: Date;
  }): Promise<SheetCheckDto | null> {
    const check = this.checks.get(input.checkId);
    if (
      !check ||
      check.status !== "mapping" ||
      check.revision !== input.expectedRevision
    ) {
      return null;
    }
    const updated: SheetCheckDto = {
      ...check,
      status: "checked",
      mapping: input.mapping,
      result: input.result,
      requiredPermissions: input.requiredPermissions,
      checkedAt: input.checkedAt,
      expiresAt: input.expiresAt,
      updatedAt: input.checkedAt,
      revision: check.revision + 1,
    };
    const results = new Map(
      input.rowResults.map((entry) => [entry.rowIndex, entry.result]),
    );
    this.rows.set(
      check.id,
      (this.rows.get(check.id) ?? []).map((row) => ({
        ...row,
        result: results.get(row.index) ?? row.result,
      })),
    );
    this.checks.set(check.id, updated);
    return updated;
  }

  async discard(input: {
    checkId: string;
    expectedRevision: number;
  }): Promise<boolean> {
    const check = this.checks.get(input.checkId);
    if (
      !check ||
      check.status !== "mapping" ||
      check.revision !== input.expectedRevision
    ) {
      return false;
    }
    this.checks.delete(check.id);
    this.rows.delete(check.id);
    return true;
  }
}

/* ------------------------------------------------------------------ */
/* Read service                                                        */
/* ------------------------------------------------------------------ */

function holds(context: AccessContext, permission: Permission): boolean {
  return context.permissions.some((entry) => entry.permission === permission);
}

function coverageReaches(
  coverage: PermissionCoverage | undefined,
  businessUnitIds: readonly string[],
): boolean {
  if (!coverage) return false;
  if (coverage.global) return true;
  return (
    businessUnitIds.length > 0 &&
    businessUnitIds.every((id) => coverage.businessUnitIds.includes(id))
  );
}

/**
 * Mirrors the service's read rule so a tool test proves the guard-then-
 * service order: every call is recorded, and a forbidden read throws the
 * same `ContentAccessDeniedError` the real service throws.
 */
export class FakeSheetCheckService implements SheetCheckReadService {
  readonly store: FakeSheetCheckStore;
  calls: string[] = [];

  constructor(store: FakeSheetCheckStore) {
    this.store = store;
  }

  private assertReadable(context: AccessContext, check: SheetCheckDto): void {
    if (
      context.userStatus !== "active" ||
      !holds(context, "documents.read") ||
      !check.requiredPermissions.every((permission) =>
        holds(context, permission),
      )
    ) {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  private async load(
    context: AccessContext,
    checkId: string,
  ): Promise<SheetCheckDto> {
    const check = await this.store.findById(checkId);
    if (!check) {
      throw new SheetCheckError("NOT_FOUND", "The check does not exist.");
    }
    this.assertReadable(context, check);
    return check;
  }

  async findForAuthorization(
    checkId: string,
  ): Promise<SheetCheckAuthorizationView | null> {
    this.calls.push("findForAuthorization");
    const check = await this.store.findById(checkId);
    return check
      ? {
          id: check.id,
          status: check.status,
          template: check.template,
          createdByUserId: check.createdByUserId,
          businessUnitIds: check.businessUnitIds,
          requiredPermissions: check.requiredPermissions,
        }
      : null;
  }

  async get(context: AccessContext, checkId: string): Promise<SheetCheckDto> {
    this.calls.push("get");
    return this.load(context, checkId);
  }

  async listForReader(
    context: AccessContext,
    coverages: Partial<Record<Permission, PermissionCoverage>>,
    query: {
      template?: SheetCheckTemplate;
      status?: SheetCheckStatus;
      limit: number;
      offset: number;
    },
  ): Promise<SheetCheckDto[]> {
    this.calls.push("listForReader");
    const entry = context.permissions.find(
      (candidate) => candidate.permission === "documents.read",
    );
    if (!entry || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
    const scope: SheetCheckListScope =
      entry.scope === "all"
        ? { kind: "all" }
        : entry.scope === "assignedBusinessUnits"
          ? {
              kind: "businessUnits",
              businessUnitIds: entry.businessUnitIds,
              userId: context.userId,
            }
          : { kind: "own", userId: context.userId };
    const checks = await this.store.list({
      scope,
      ...(query.template ? { template: query.template } : {}),
      ...(query.status ? { status: query.status } : {}),
      limit: query.limit,
      offset: query.offset,
    });
    return checks.filter((check) =>
      check.requiredPermissions.every((permission) =>
        coverageReaches(coverages[permission], check.businessUnitIds),
      ),
    );
  }

  async listRows(
    context: AccessContext,
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<{ rows: SheetRowDto[]; issueRowCount: number }> {
    this.calls.push("listRows");
    await this.load(context, checkId);
    const rows = await this.store.listRows(checkId, options);
    const issueRowCount = await this.store.countRowsWithIssues(
      checkId,
      options.minSeverity ?? "info",
    );
    return { rows, issueRowCount };
  }

  async findRow(
    context: AccessContext,
    checkId: string,
    rowIndex: number,
  ): Promise<SheetRowDto> {
    this.calls.push("findRow");
    await this.load(context, checkId);
    const row = await this.store.findRow(checkId, rowIndex);
    if (!row) {
      throw new SheetCheckError("NOT_FOUND", "The row does not exist.");
    }
    return row;
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

export const checkNow = new Date("2026-09-06T02:00:00Z");

export function cell(text: string): SheetCell {
  return {
    text,
    type: text === "" ? "z" : "s",
    number: null,
    numberFormat: null,
    formula: false,
    noCache: false,
    mergedFill: false,
    truncated: false,
  };
}

export type SeededColumn = { header: string; field: CanonicalField };

export type SeededRowSpec = {
  kind?: SheetRowKind;
  cells: readonly string[];
  parsed?: Partial<ParsedRow>;
  issues?: readonly Issue[];
  /** Absent → the stored result has `system: null`. */
  system?: RowSystemView;
  outcome?: RowOutcome;
};

export type SeededCheckOptions = {
  template: SheetCheckTemplate;
  createdByUserId: string;
  columns: readonly SeededColumn[];
  rows: readonly SeededRowSpec[];
  requiredPermissions?: readonly Permission[];
  businessUnitIds?: readonly string[];
  fileName?: string;
  status?: SheetCheckStatus;
  headerSheetRowNumber?: number | null;
  sheetIssues?: readonly Issue[];
  systemOnly?: readonly SystemOnlyItem[];
  totals?: readonly TotalsLine[];
  createdAt?: Date;
};

function outcomeOf(spec: SeededRowSpec): RowOutcome {
  if (spec.outcome) return spec.outcome;
  if ((spec.kind ?? "data") !== "data") return "skipped";
  const worst = worstSeverity(spec.issues ?? []);
  return worst === "error" ? "mismatch" : "matched";
}

/**
 * A check as the service would persist it. Rows are stored in sheet order
 * right below the header (row numbers start at header + 1); a `checked`
 * status gets a result whose counts are derived from the rows given.
 */
export function seededCheck(
  store: FakeSheetCheckStore,
  options: SeededCheckOptions,
): SheetCheckDto {
  const id = nextId("5");
  const status = options.status ?? "checked";
  // `undefined` = the usual header on sheet row 4; `null` = no header found,
  // so stored rows start at sheet row 1.
  const header =
    options.headerSheetRowNumber === undefined
      ? 4
      : options.headerSheetRowNumber;
  const firstRowNumber = header === null ? 1 : header + 1;
  const createdAt = options.createdAt ?? checkNow;
  const proposal: MappingProposal = {
    headerSheetRowNumber: header,
    headerFound: header !== null,
    columns: options.columns.map((column, index) => ({
      columnIndex: index,
      header: column.header,
      field: column.field,
      confidence: "high",
      suggestedMultiplier: "1",
      inferredStyle: null,
      inferredDateOrder: null,
      sampleValues: [],
    })),
    periodHint: null,
    titleLines: [],
  };
  const mapping: SheetMapping = {
    columns: options.columns.map((column, index) => ({
      columnIndex: index,
      field: column.field,
      fixedCurrency: null,
      unitMultiplier: "1",
      numberStyle: null,
      dateOrder: null,
    })),
    defaultCurrency: "VND",
    period: { from: "2026-08-01", to: "2026-08-31" },
    compareSellingPrice: false,
  };

  const rows: SheetRowDto[] = options.rows.map((spec, index) => {
    const kind = spec.kind ?? "data";
    const cells = options.columns.map((_, column) =>
      cell(spec.cells[column] ?? ""),
    );
    const result: RowResult | null =
      status === "checked"
        ? {
            parsed: { ...emptyParsedRow(), ...spec.parsed },
            issues: spec.issues ?? [],
            system: spec.system ?? null,
            outcome: outcomeOf(spec),
          }
        : null;
    return {
      checkId: id,
      index,
      sheetRowNumber: firstRowNumber + index,
      kind,
      hidden: false,
      cells,
      result,
    };
  });

  let result: CheckResult | null = null;
  if (status === "checked") {
    const outcomes: Record<RowOutcome, number> = {
      matched: 0,
      mismatch: 0,
      notFound: 0,
      notCompared: 0,
      invalid: 0,
      skipped: 0,
    };
    const counts = { error: 0, warn: 0, info: 0 };
    for (const row of rows) {
      if (row.result) outcomes[row.result.outcome] += 1;
      for (const entry of row.result?.issues ?? []) counts[entry.severity] += 1;
    }
    for (const entry of options.sheetIssues ?? []) counts[entry.severity] += 1;
    const summary: CheckSummary = {
      dataRows: rows.filter((row) => row.kind === "data").length,
      skippedRows: rows.filter((row) => row.kind !== "data").length,
      errors: counts.error,
      warnings: counts.warn,
      infos: counts.info,
      outcomes,
      totals: options.totals ?? [],
    };
    result = {
      summary,
      sheetIssues: options.sheetIssues ?? [],
      systemOnly: options.systemOnly ?? [],
      dataAt: createdAt,
    };
  }

  const check: SheetCheckDto = {
    id,
    template: options.template,
    status,
    sourceKind: "file",
    fileName: options.fileName ?? "bang-kiem-tra.xlsx",
    fileBytes: 12_345,
    fileFormat: "xlsx",
    sheets: [
      { index: 0, name: "Sheet1", rowCount: rows.length + (header ?? 0) },
    ],
    sheetIndex: 0,
    sheetName: "Sheet1",
    columnCount: options.columns.length,
    date1904: false,
    rowCount: rows.length,
    dataRowCount: rows.filter((row) => row.kind === "data").length,
    intakeIssues: [],
    proposal,
    mapping,
    result,
    requiredPermissions:
      options.requiredPermissions ?? templateGates[options.template],
    scopeKind:
      (options.businessUnitIds ?? []).length > 0 ? "businessUnits" : "all",
    businessUnitIds: options.businessUnitIds ?? [],
    createdByUserId: options.createdByUserId,
    rerunOf: null,
    checkedAt: status === "checked" ? createdAt : null,
    expiresAt: new Date(createdAt.getTime() + 180 * 86_400_000),
    createdAt,
    updatedAt: createdAt,
    revision: status === "checked" ? 1 : 0,
  };
  return store.seed(check, rows);
}

/* ---- canned scenarios ---- */

export const cashFixture = {
  columns: [
    { header: "Ngày", field: "date" },
    { header: "Khách hàng", field: "customerName" },
    { header: "Mã đơn", field: "orderCode" },
    { header: "Số tiền", field: "amount" },
  ] satisfies readonly SeededColumn[],
  customer: "Công ty Kiso",
  matchedAmount: "25000000",
  missingAmount: "18500000",
  systemAmount: "24975000",
  sheetAmount: "26000000",
  unknownOrder: "RD-20260801-ZZ99",
} as const;

/**
 * A checked cash-received report by a global reader: one matched row, one
 * receipt not found, two rows on `orderCode` (amount mismatch, not found),
 * one unknown order, one unreadable amount and a totals row.
 */
export function seedCashCheck(
  store: FakeSheetCheckStore,
  options: {
    createdByUserId: string;
    orderCode: string;
    fileName?: string;
    createdAt?: Date;
  },
): SheetCheckDto {
  const f = cashFixture;
  const order = {
    id: "0000000000000000000000a1",
    orderCode: options.orderCode,
    stage: "inProduction" as const,
    customerName: f.customer,
    sellingPrice: null,
  };
  const receipt = (amount: string, day: string) => ({
    id: nextId("2"),
    occurredDay: day,
    amount: { amount, currency: "VND" as const },
    counterparty: f.customer,
    method: "bankTransfer",
    allocations: [`order:${options.orderCode}=${amount}`],
    status: "active" as const,
    voidReason: null,
  });
  return seededCheck(store, {
    template: "incomingCash",
    createdByUserId: options.createdByUserId,
    ...(options.fileName ? { fileName: options.fileName } : {}),
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    columns: f.columns,
    rows: [
      {
        cells: ["15/08/2026", f.customer, "", "25.000.000"],
        parsed: {
          date: "2026-08-15",
          customerName: f.customer,
          amount: { amount: f.matchedAmount, currency: "VND" },
        },
        issues: [
          issue("RECEIPT_MATCHED", {
            d: "2026-08-15",
            amount: `${f.matchedAmount} VND`,
          }),
        ],
        system: {
          receipts: [receipt(f.matchedAmount, "2026-08-15")],
          matchStrength: "S2_CUSTOMER_AMOUNT_DATE",
        },
        outcome: "matched",
      },
      {
        cells: ["18/08/2026", f.customer, "", "18.500.000"],
        parsed: {
          date: "2026-08-18",
          customerName: f.customer,
          amount: { amount: f.missingAmount, currency: "VND" },
        },
        issues: [
          issue("RECEIPT_NOT_FOUND", {
            customer: f.customer,
            d: "2026-08-18",
            amount: `${f.missingAmount} VND`,
          }),
        ],
        system: {
          candidates: [
            {
              id: nextId("2"),
              occurredDay: "2026-08-29",
              amount: { amount: f.missingAmount, currency: "VND" },
              why: "DATE_DIFF",
              usedByRowIndex: null,
            },
          ],
        },
        outcome: "notFound",
      },
      {
        cells: ["20/08/2026", f.customer, options.orderCode, "26.000.000"],
        parsed: {
          date: "2026-08-20",
          customerName: f.customer,
          orderCode: options.orderCode,
          amount: { amount: f.sheetAmount, currency: "VND" },
        },
        issues: [
          issue("ORDER_MATCHED", {
            code: options.orderCode,
            stage: "Đang sản xuất",
            customer: f.customer,
          }),
          issue("RECEIPT_AMOUNT_MISMATCH", {
            system: `${f.systemAmount} VND`,
            sheet: `${f.sheetAmount} VND`,
            diff: "1025000 VND",
          }),
        ],
        system: { order, receipts: [receipt(f.systemAmount, "2026-08-20")] },
        outcome: "mismatch",
      },
      {
        cells: ["22/08/2026", f.customer, options.orderCode, "5.000.000"],
        parsed: {
          date: "2026-08-22",
          customerName: f.customer,
          orderCode: options.orderCode,
          amount: { amount: "5000000", currency: "VND" },
        },
        issues: [
          issue("ORDER_MATCHED", {
            code: options.orderCode,
            stage: "Đang sản xuất",
            customer: f.customer,
          }),
          issue("RECEIPT_NOT_FOUND", {
            customer: f.customer,
            d: "2026-08-22",
            amount: "5000000 VND",
          }),
        ],
        system: { order, candidates: [] },
        outcome: "notFound",
      },
      {
        cells: ["25/08/2026", f.customer, f.unknownOrder, "7.000.000"],
        parsed: {
          date: "2026-08-25",
          customerName: f.customer,
          orderCode: f.unknownOrder,
          amount: { amount: "7000000", currency: "VND" },
        },
        issues: [issue("ORDER_NOT_FOUND", { code: f.unknownOrder })],
        outcome: "notFound",
      },
      {
        cells: ["26/08/2026", f.customer, "", "1.2tr"],
        parsed: { date: "2026-08-26", customerName: f.customer },
        issues: [
          issue("AMOUNT_NOT_NUMBER", { raw: "1.2tr" }, { columnIndex: 3 }),
        ],
        outcome: "invalid",
      },
      {
        kind: "total",
        cells: ["", "Tổng cộng", "", "81.500.000"],
        parsed: { amount: { amount: "81500000", currency: "VND" } },
        outcome: "skipped",
      },
    ],
    sheetIssues: [
      issue(
        "TOTAL_MISMATCH",
        {
          sheetTotal: "81500000 VND",
          n: 5,
          computed: "81500000 VND",
          diff: "0 VND",
          skipped: 1,
          hidden: 0,
        },
        { columnIndex: 3 },
      ),
      issue("PERIOD_TOTAL_MISMATCH", {
        sheet: "81500000 VND",
        system: "62975000 VND",
        diff: "18525000 VND",
        x: 2,
        a: "23500000 VND",
        y: 1,
        b: "4975000 VND",
      }),
    ],
    systemOnly: [
      {
        kind: "receipt",
        label: f.customer,
        day: "2026-08-29",
        amount: { amount: "4975000", currency: "VND" },
        issue: issue("RECEIPT_NOT_IN_SHEET", {
          d: "2026-08-29",
          amount: "4975000 VND",
          customer: f.customer,
        }),
      },
    ],
    totals: [
      {
        field: "amount",
        columnIndex: 3,
        currency: "VND",
        computed: "81500000",
        sheetTotal: "81500000",
        rowsCounted: 5,
        rowsSkipped: 1,
        system: "62975000",
      },
    ],
  });
}

export const genericFixture = {
  columns: [
    { header: "Mã đơn", field: "orderCode" },
    { header: "Khách hàng", field: "customerName" },
    { header: "Giá trị", field: "amount" },
    { header: "Trạng thái", field: "stage" },
  ] satisfies readonly SeededColumn[],
  unknownOrder: "RD-20260801-YY88",
} as const;

/**
 * A checked order list by a unit-bound reader: the amount column was
 * summed but never compared, so no row carries a money key and the totals
 * line has no system figure.
 */
export function seedGenericCheck(
  store: FakeSheetCheckStore,
  options: {
    createdByUserId: string;
    businessUnitIds: readonly string[];
    orderCode: string;
    customerName?: string;
    requiredPermissions?: readonly Permission[];
    fileName?: string;
    createdAt?: Date;
    headerSheetRowNumber?: number | null;
  },
): SheetCheckDto {
  const customer = options.customerName ?? "Công ty Kiso";
  const order = {
    id: "0000000000000000000000a2",
    orderCode: options.orderCode,
    stage: "inProduction" as const,
    customerName: customer,
    sellingPrice: null,
  };
  return seededCheck(store, {
    template: "generic",
    createdByUserId: options.createdByUserId,
    businessUnitIds: options.businessUnitIds,
    ...(options.requiredPermissions
      ? { requiredPermissions: options.requiredPermissions }
      : {}),
    ...(options.fileName ? { fileName: options.fileName } : {}),
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    ...(options.headerSheetRowNumber !== undefined
      ? { headerSheetRowNumber: options.headerSheetRowNumber }
      : {}),
    columns: genericFixture.columns,
    rows: [
      {
        cells: [options.orderCode, customer, "1.250", "Đang sản xuất"],
        parsed: {
          orderCode: options.orderCode,
          customerName: customer,
          amount: { amount: "1250", currency: "VND" },
          stage: "Đang sản xuất",
        },
        issues: [
          issue("ORDER_MATCHED", {
            code: options.orderCode,
            stage: "Đang sản xuất",
            customer,
          }),
        ],
        system: { order },
        outcome: "matched",
      },
      {
        cells: [genericFixture.unknownOrder, customer, "2.000", "Mới"],
        parsed: {
          orderCode: genericFixture.unknownOrder,
          customerName: customer,
          amount: { amount: "2000", currency: "VND" },
          stage: "Mới",
        },
        issues: [
          issue("ORDER_NOT_FOUND", { code: genericFixture.unknownOrder }),
        ],
        outcome: "notFound",
      },
      {
        cells: [options.orderCode, customer, "1.250", "Đang sản xuất"],
        parsed: {
          orderCode: options.orderCode,
          customerName: customer,
          amount: { amount: "1250", currency: "VND" },
          stage: "Đang sản xuất",
        },
        issues: [
          issue("DUPLICATE_ROW", { n: 5 }),
          issue("ORDER_MATCHED", {
            code: options.orderCode,
            stage: "Đang sản xuất",
            customer,
          }),
        ],
        system: { order },
        outcome: "mismatch",
      },
      {
        cells: ["RD-20260801-QQ11", customer, "abc", ""],
        parsed: { orderCode: "RD-20260801-QQ11", customerName: customer },
        issues: [
          issue("AMOUNT_NOT_NUMBER", { raw: "abc" }, { columnIndex: 2 }),
          issue("ORDER_NOT_FOUND", { code: "RD-20260801-QQ11" }),
        ],
        outcome: "invalid",
      },
    ],
    sheetIssues: [issue("AMOUNT_NOT_COMPARED", {}, { columnIndex: 2 })],
    totals: [
      {
        field: "amount",
        columnIndex: 2,
        currency: "VND",
        computed: "4500",
        sheetTotal: null,
        rowsCounted: 3,
        rowsSkipped: 1,
        system: null,
      },
    ],
  });
}

/** A checked receivables statement (three global money gates) with one balance mismatch. */
export function seedReceivablesCheck(
  store: FakeSheetCheckStore,
  options: { createdByUserId: string; createdAt?: Date },
): SheetCheckDto {
  const customer = "Công ty Kiso";
  const balance = (amount: string) => ({
    customerId: "0000000000000000000000c1",
    customerName: customer,
    currency: "VND" as const,
    invoiced: { amount: "120000000", currency: "VND" as const },
    received: { amount: "50000000", currency: "VND" as const },
    refunded: { amount: "0", currency: "VND" as const },
    outstanding: { amount: "70000000", currency: "VND" as const },
    credit: { amount: "0", currency: "VND" as const },
    balance: { amount, currency: "VND" as const },
    overdueInvoiceCount: 1,
  });
  return seededCheck(store, {
    template: "receivables",
    createdByUserId: options.createdByUserId,
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    fileName: "cong-no.xlsx",
    columns: [
      { header: "Khách hàng", field: "customerName" },
      { header: "Dư nợ", field: "outstanding" },
    ],
    rows: [
      {
        cells: [customer, "60.000.000"],
        parsed: {
          customerName: customer,
          outstanding: { amount: "60000000", currency: "VND" },
        },
        issues: [
          issue("BALANCE_MISMATCH", {
            sheet: "60000000 VND",
            outstanding: "70000000 VND",
            credit: "0 VND",
            balance: "70000000 VND",
            diff: "-10000000 VND",
            explanation: "không tìm được khoản đơn lẻ",
          }),
        ],
        system: { balance: balance("70000000") },
        outcome: "mismatch",
      },
    ],
    totals: [
      {
        field: "outstanding",
        columnIndex: 1,
        currency: "VND",
        computed: "60000000",
        sheetTotal: null,
        rowsCounted: 1,
        rowsSkipped: 0,
        system: "70000000",
      },
    ],
  });
}

/** An uploaded but unrun check (status `mapping`, no result, no row results). */
export function seedDraftCheck(
  store: FakeSheetCheckStore,
  options: {
    template: SheetCheckTemplate;
    createdByUserId: string;
    businessUnitIds?: readonly string[];
    createdAt?: Date;
  },
): SheetCheckDto {
  return seededCheck(store, {
    template: options.template,
    status: "mapping",
    createdByUserId: options.createdByUserId,
    ...(options.businessUnitIds
      ? { businessUnitIds: options.businessUnitIds }
      : {}),
    ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    fileName: "ban-nhap.xlsx",
    columns:
      options.template === "generic"
        ? genericFixture.columns
        : cashFixture.columns,
    rows: [{ cells: ["", "", "", ""] }],
  });
}

/** Every key at any depth of a JSON-like value, for "forbidden key" assertions. */
export function collectKeys(
  value: unknown,
  into = new Set<string>(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, into);
  } else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      into.add(key);
      collectKeys(entry, into);
    }
  }
  return into;
}
