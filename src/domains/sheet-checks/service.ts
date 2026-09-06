import type { PermissionScope } from "@/domains/identity/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  runSheetCheckInputSchema,
  SheetCheckError,
  templateGates,
  type CheckResult,
  type ColumnMapping,
  type MappingProposal,
  type NewSheetCheckRecord,
  type NewSheetRowRecord,
  type RunSheetCheckInput,
  type SheetCheckAuthorizationView,
  type SheetCheckDto,
  type SheetCheckListScope,
  type SheetCheckServiceDependencies,
  type SheetCheckStatus,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRow,
  type SheetRowDto,
  type SheetRowListOptions,
  type SystemSnapshot,
} from "@/domains/sheet-checks/contracts";
import { buildCsvExport } from "@/domains/sheet-checks/export";
import { issue, type Issue } from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import type {
  analyzeSheet,
  proposeMapping,
  validateMapping,
} from "@/domains/sheet-checks/parsing/header";
import type { readUpload } from "@/domains/sheet-checks/parsing/intake";
import type { parseRows } from "@/domains/sheet-checks/parsing/rows";
import type { reconcile } from "@/domains/sheet-checks/reconcile";
import { formatBusinessDay } from "@/domains/tasks/policy";
import {
  ContentAccessDeniedError,
  type AccessContext,
  type EffectivePermission,
} from "@/lib/auth/authorization";

/**
 * The spreadsheet check, end to end: upload → parse → propose a mapping →
 * confirm and run → immutable result. The service never writes to any
 * business store — its dependency type only carries the read methods — and
 * it inspects the caller's `AccessContext` itself for every decision, so a
 * page, an action, a route or an assistant tool cannot reach more than the
 * permissions its guard actually merged into the context.
 *
 * Two gates guard a check. Creating and running it needs `documents.import`
 * (whose scope stamps the check) plus the template gate: the money templates
 * need their finance permissions with GLOBAL reach, the generic order list
 * needs `orders.read` at any scope. Reading it needs `documents.read` plus
 * every permission the run exercised (`requiredPermissions`), re-checked on
 * each read, so a comparison of customer money never reaches a reader who
 * may not see money.
 */

/** Re-declared locally: `@/lib/auth` is server-only and this module is pure. */
export type PermissionCoverage = {
  global: boolean;
  businessUnitIds: readonly string[];
};

/** The list scope shape every business store accepts. */
type ReadScope =
  | { kind: "all" }
  | { kind: "businessUnits"; businessUnitIds: readonly string[] }
  | { kind: "own"; userId: string };

/**
 * The parsing and reconciliation steps, injectable so the service can be
 * exercised with small fakes; the real modules are loaded on first use.
 */
export type SheetCheckPipeline = {
  readUpload: typeof readUpload;
  analyzeSheet: typeof analyzeSheet;
  proposeMapping: typeof proposeMapping;
  validateMapping: typeof validateMapping;
  parseRows: typeof parseRows;
  reconcile: typeof reconcile;
};

export type SheetCheckServiceOptions = SheetCheckServiceDependencies & {
  pipeline?: Partial<SheetCheckPipeline>;
};

export const SHEET_CHECK_RESOURCE_TYPE = "sheetCheck";

const MONEY_TEMPLATES: ReadonlySet<SheetCheckTemplate> = new Set([
  "incomingCash",
  "receivables",
]);

const DAY_MS = 86_400_000;
const RECEIPT_LIST_LIMIT = 5_000;
/** The order and customer stores cap their own reads at this many documents. */
const ORDER_LIST_LIMIT = 1_000;
const CUSTOMER_LIST_LIMIT = 1_000;
/** Paging the check list: documents examined per batch and in total. */
const LIST_SCAN_PAGE = 100;
const LIST_SCAN_LIMIT = 1_000;
const ROW_LOAD_CHUNK = 500;
const MAX_FILE_NAME = 255;

let realPipeline: Promise<SheetCheckPipeline> | null = null;

/** The production parsing/reconcile modules, loaded once and only when needed. */
function loadRealPipeline(): Promise<SheetCheckPipeline> {
  realPipeline ??= Promise.all([
    import("@/domains/sheet-checks/parsing/intake"),
    import("@/domains/sheet-checks/parsing/header"),
    import("@/domains/sheet-checks/parsing/rows"),
    import("@/domains/sheet-checks/reconcile"),
  ]).then(([intake, header, rows, reconciling]) => ({
    readUpload: intake.readUpload,
    analyzeSheet: header.analyzeSheet,
    proposeMapping: header.proposeMapping,
    validateMapping: header.validateMapping,
    parseRows: rows.parseRows,
    reconcile: reconciling.reconcile,
  }));
  return realPipeline;
}

function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Browser-supplied names are display text only: control characters and length are bounded. */
function cleanFileName(fileName: string): string {
  const cleaned = fileName
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_FILE_NAME);
  return cleaned.length > 0 ? cleaned : "upload";
}

function clampRetention(days: number | undefined): number {
  if (days === undefined || !Number.isFinite(days)) {
    return sheetCheckLimits.checkedRetentionDays;
  }
  return Math.min(
    sheetCheckLimits.maxRetentionDays,
    Math.max(sheetCheckLimits.minRetentionDays, Math.trunc(days)),
  );
}

function hasBlockingIssue(issues: readonly Issue[]): boolean {
  return issues.some((entry) => entry.severity === "error");
}

export class SheetCheckService {
  private readonly dependencies: SheetCheckServiceOptions;
  private readonly retentionDays: number;
  private pipelinePromise: Promise<SheetCheckPipeline> | null = null;

  constructor(dependencies: SheetCheckServiceOptions) {
    this.dependencies = dependencies;
    this.retentionDays = clampRetention(dependencies.checkedRetentionDays);
  }

  /* ---------------------------------------------------------------- */
  /* Context inspection                                                */
  /* ---------------------------------------------------------------- */

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private entryOf(
    context: AccessContext,
    permission: Permission,
  ): EffectivePermission | null {
    if (context.userStatus !== "active") return null;
    const entries = context.permissions.filter(
      (candidate) => candidate.permission === permission,
    );
    if (entries.length === 0) return null;
    // A context merged from several guards may carry the same permission
    // twice; the widest reach is the one the guards approved.
    const order: Record<PermissionScope, number> = {
      all: 3,
      assignedBusinessUnits: 2,
      own: 1,
    };
    return entries.reduce((best, entry) =>
      order[entry.scope] > order[best.scope] ? entry : best,
    );
  }

  private holds(context: AccessContext, permission: Permission): boolean {
    return this.entryOf(context, permission) !== null;
  }

  private holdsGlobal(context: AccessContext, permission: Permission): boolean {
    return this.entryOf(context, permission)?.scope === "all";
  }

  private scopeOf(
    context: AccessContext,
    permission: Permission,
  ): ReadScope | null {
    const entry = this.entryOf(context, permission);
    if (!entry) return null;
    if (entry.scope === "all") return { kind: "all" };
    if (entry.scope === "assignedBusinessUnits") {
      return { kind: "businessUnits", businessUnitIds: entry.businessUnitIds };
    }
    return { kind: "own", userId: context.userId };
  }

  /**
   * Denies with an audit trail. The guard in front of the service already
   * records its own denials; this covers the second line of defence, where
   * a context reached the service without the permission the check needs.
   */
  private async deny(
    context: AccessContext,
    permission: Permission,
    target: { resourceId: string | null; businessUnitIds: readonly string[] },
  ): Promise<never> {
    try {
      await this.dependencies.auditRepository.append({
        actor: { type: "user", userId: context.userId },
        action: "sheetCheck.denied",
        resourceType: SHEET_CHECK_RESOURCE_TYPE,
        resourceId: target.resourceId,
        businessUnitIds: target.businessUnitIds,
        requestId: context.requestId,
        permissionDecision: {
          permission,
          outcome: "denied",
          reasonCode: "PERMISSION_DENIED",
          scope: null,
        },
        occurredAt: this.now(),
      });
    } catch {
      // The denial stands even when the audit store is unavailable.
    }
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }

  private async assertHolds(
    context: AccessContext,
    permission: Permission,
    target: { resourceId: string | null; businessUnitIds: readonly string[] },
  ): Promise<void> {
    if (!this.holds(context, permission)) {
      await this.deny(context, permission, target);
    }
  }

  /** Money templates need every gate with global reach; generic needs `orders.read` at any scope. */
  private async assertGates(
    context: AccessContext,
    template: SheetCheckTemplate,
    target: { resourceId: string | null; businessUnitIds: readonly string[] },
  ): Promise<void> {
    for (const permission of templateGates[template]) {
      const ok = MONEY_TEMPLATES.has(template)
        ? this.holdsGlobal(context, permission)
        : this.holds(context, permission);
      if (!ok) await this.deny(context, permission, target);
    }
  }

  /** Read rule: `documents.read` plus every permission the check carries. */
  private async assertReadable(
    context: AccessContext,
    check: SheetCheckDto,
  ): Promise<void> {
    const target = {
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
    };
    await this.assertHolds(context, "documents.read", target);
    for (const permission of check.requiredPermissions) {
      await this.assertHolds(context, permission, target);
    }
  }

  /**
   * Where a new check lives: from the `documents.import` grant, never from
   * the form or the file. Money templates are global by construction.
   */
  private stampScope(
    context: AccessContext,
    template: SheetCheckTemplate,
  ): Pick<SheetCheckDto, "scopeKind" | "businessUnitIds"> {
    if (MONEY_TEMPLATES.has(template)) {
      return { scopeKind: "all", businessUnitIds: [] };
    }
    const entry = this.entryOf(context, "documents.import");
    if (entry?.scope === "all") {
      return { scopeKind: "all", businessUnitIds: [] };
    }
    if (entry?.scope === "assignedBusinessUnits") {
      return {
        scopeKind: "businessUnits",
        businessUnitIds: unique(entry.businessUnitIds),
      };
    }
    // `own`: a personal check no unit grant reaches; only its creator does.
    return { scopeKind: "businessUnits", businessUnitIds: [] };
  }

  private async pipeline(): Promise<SheetCheckPipeline> {
    this.pipelinePromise ??= (async () => {
      const overrides = this.dependencies.pipeline ?? {};
      const complete =
        overrides.readUpload &&
        overrides.analyzeSheet &&
        overrides.proposeMapping &&
        overrides.validateMapping &&
        overrides.parseRows &&
        overrides.reconcile;
      const real = complete ? null : await loadRealPipeline();
      const pick = <K extends keyof SheetCheckPipeline>(
        key: K,
      ): SheetCheckPipeline[K] => {
        const override = overrides[key];
        if (override) return override;
        if (!real) throw new Error(`Sheet check pipeline step ${key} missing.`);
        return real[key];
      };
      return {
        readUpload: pick("readUpload"),
        analyzeSheet: pick("analyzeSheet"),
        proposeMapping: pick("proposeMapping"),
        validateMapping: pick("validateMapping"),
        parseRows: pick("parseRows"),
        reconcile: pick("reconcile"),
      };
    })();
    return this.pipelinePromise;
  }

  private async loadCheck(checkId: string): Promise<SheetCheckDto> {
    const check = await this.dependencies.store.findById(checkId);
    if (!check) throw new SheetCheckError("NOT_FOUND", "Check not found.");
    return check;
  }

  private async loadAllRows(check: SheetCheckDto): Promise<SheetRowDto[]> {
    const rows: SheetRowDto[] = [];
    for (let offset = 0; offset < check.rowCount; offset += ROW_LOAD_CHUNK) {
      const page = await this.dependencies.store.listRows(check.id, {
        offset,
        limit: ROW_LOAD_CHUNK,
      });
      rows.push(...page);
      if (page.length < ROW_LOAD_CHUNK) break;
    }
    return rows;
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Upload path. `context` must hold `documents.import` (any scope) and the
   * template gates (money templates with scope "all"; generic: `orders.read`
   * at any scope). The file bytes are parsed and dropped; only the grid and
   * the proposal are stored.
   */
  async createFromFile(
    context: AccessContext,
    input: {
      template: SheetCheckTemplate;
      bytes: Uint8Array;
      fileName: string;
      sheetSelector: string | null;
    },
  ): Promise<SheetCheckDto> {
    const anonymousTarget = { resourceId: null, businessUnitIds: [] };
    await this.assertHolds(context, "documents.import", anonymousTarget);
    await this.assertGates(context, input.template, anonymousTarget);
    const scope = this.stampScope(context, input.template);

    const steps = await this.pipeline();
    const workbook = steps.readUpload({
      bytes: input.bytes,
      fileName: input.fileName,
      sheetSelector: input.sheetSelector,
    });
    const analysis = steps.analyzeSheet(workbook.chosen, input.template);
    const proposed = steps.proposeMapping(analysis, input.template);

    const now = this.now();
    const record: NewSheetCheckRecord = {
      template: input.template,
      status: "mapping",
      sourceKind: "file",
      fileName: cleanFileName(input.fileName),
      fileBytes: input.bytes.length,
      fileFormat: workbook.fileFormat,
      sheets: workbook.sheets,
      sheetIndex: workbook.chosen.index,
      sheetName: workbook.chosen.name,
      columnCount: workbook.chosen.columnCount,
      date1904: workbook.date1904,
      rowCount: analysis.rows.length,
      dataRowCount: analysis.dataRowCount,
      intakeIssues: [...workbook.issues, ...analysis.issues],
      proposal: proposed.proposal,
      mapping: proposed.mapping,
      result: null,
      requiredPermissions: [...templateGates[input.template]],
      scopeKind: scope.scopeKind,
      businessUnitIds: scope.businessUnitIds,
      createdByUserId: context.userId,
      rerunOf: null,
      checkedAt: null,
      expiresAt: addDays(now, sheetCheckLimits.draftRetentionDays),
    };
    const check = await this.dependencies.store.insert(record, analysis.rows);

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "sheetCheck.created",
      resourceType: SHEET_CHECK_RESOURCE_TYPE,
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        template: check.template,
        fileFormat: check.fileFormat,
        fileBytes: check.fileBytes,
        rowCount: check.rowCount,
        columnCount: check.columnCount,
        headerFound: check.proposal.headerFound,
      },
      occurredAt: now,
    });

    return check;
  }

  /** The fields a guard needs to judge a check; never rendered. */
  async findForAuthorization(
    checkId: string,
  ): Promise<SheetCheckAuthorizationView | null> {
    const check = await this.dependencies.store.findById(checkId);
    if (!check) return null;
    return {
      id: check.id,
      status: check.status,
      template: check.template,
      createdByUserId: check.createdByUserId,
      businessUnitIds: check.businessUnitIds,
      requiredPermissions: check.requiredPermissions,
    };
  }

  /** Read rule: `documents.read` AND every `requiredPermissions` entry present in the context. */
  async get(context: AccessContext, checkId: string): Promise<SheetCheckDto> {
    const check = await this.loadCheck(checkId);
    await this.assertReadable(context, check);
    return check;
  }

  /**
   * Newest first, narrowed by the reader's `documents.read` scope in the
   * store, then reduced to the checks whose stamped permissions the reader's
   * coverage reaches. A check the reader may not open is simply absent.
   */
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
    const target = { resourceId: null, businessUnitIds: [] };
    await this.assertHolds(context, "documents.read", target);
    const entry = this.entryOf(context, "documents.read");
    const scope: SheetCheckListScope =
      entry?.scope === "all"
        ? { kind: "all" }
        : entry?.scope === "assignedBusinessUnits"
          ? {
              kind: "businessUnits",
              businessUnitIds: entry.businessUnitIds,
              userId: context.userId,
            }
          : { kind: "own", userId: context.userId };

    const readable = (check: SheetCheckDto): boolean =>
      check.requiredPermissions.every((permission) => {
        const coverage = coverages[permission];
        if (!coverage) return false;
        if (coverage.global) return true;
        if (check.businessUnitIds.length === 0) return false;
        const covered = new Set(coverage.businessUnitIds);
        return check.businessUnitIds.every((unitId) => covered.has(unitId));
      });

    // Checks the reader may not open are dropped AFTER the store page, so
    // the store is read forward until the requested page is full; otherwise
    // a page would come back short and the "next page" link would vanish
    // while readable checks are still waiting behind the hidden ones.
    const pageSize = Math.max(1, Math.min(query.limit, 200));
    const skip = Math.max(0, query.offset);
    const wanted = skip + pageSize;
    const visible: SheetCheckDto[] = [];
    let scanned = 0;
    while (visible.length < wanted && scanned < LIST_SCAN_LIMIT) {
      const batch = await this.dependencies.store.list({
        scope,
        ...(query.template ? { template: query.template } : {}),
        ...(query.status ? { status: query.status } : {}),
        limit: LIST_SCAN_PAGE,
        offset: scanned,
      });
      if (batch.length === 0) break;
      scanned += batch.length;
      visible.push(...batch.filter(readable));
      if (batch.length < LIST_SCAN_PAGE) break;
    }
    return visible.slice(skip, wanted);
  }

  /**
   * A page of rows. `issueRowCount` counts the rows carrying at least one
   * issue at `minSeverity` or worse (any issue when none is given), so the
   * caller can page an "issues only" view.
   */
  async listRows(
    context: AccessContext,
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<{ rows: SheetRowDto[]; issueRowCount: number }> {
    if (
      !Number.isInteger(options.offset) ||
      options.offset < 0 ||
      !Number.isInteger(options.limit) ||
      options.limit < 1
    ) {
      throw new SheetCheckError("INVALID_INPUT", "Invalid row page.");
    }
    const check = await this.loadCheck(checkId);
    await this.assertReadable(context, check);
    const minSeverity = options.minSeverity ?? "info";
    const [rows, issueRowCount] = await Promise.all([
      this.dependencies.store.listRows(check.id, {
        offset: options.offset,
        limit: Math.min(options.limit, sheetCheckLimits.rowsPageSize),
        ...(options.minSeverity ? { minSeverity: options.minSeverity } : {}),
      }),
      this.dependencies.store.countRowsWithIssues(check.id, minSeverity),
    ]);
    return { rows, issueRowCount };
  }

  async findRow(
    context: AccessContext,
    checkId: string,
    rowIndex: number,
  ): Promise<SheetRowDto> {
    const check = await this.loadCheck(checkId);
    await this.assertReadable(context, check);
    const row = await this.dependencies.store.findRow(check.id, rowIndex);
    if (!row) throw new SheetCheckError("NOT_FOUND", "Row not found.");
    return row;
  }

  /**
   * What the system side of a run may contain. A part is loaded only when
   * the context holds the governing permission; otherwise it is `null` and
   * the reconciliation cannot even see it.
   */
  private async loadSnapshot(
    context: AccessContext,
    check: Pick<SheetCheckDto, "template" | "scopeKind" | "businessUnitIds">,
    mapping: SheetMapping,
  ): Promise<{ snapshot: SystemSnapshot; truncated: readonly string[] }> {
    const template = check.template;
    const stores = this.dependencies;
    // The stamp decides who may open the result, so a run may never compare
    // more than the stamp covers: a wider-scoped runner working on someone
    // else's unit-stamped draft is narrowed to that draft's units, or the
    // rows would show unit-bound readers orders they cannot reach.
    const orderScope = this.narrowToStamp(
      template === "generic"
        ? this.scopeOf(context, "orders.read")
        : this.scopeOf(context, templateGates[template][0]!),
      check,
    );
    const orders = orderScope ? await stores.orderStore.list(orderScope) : null;

    const invoices = this.holdsGlobal(context, "invoices.read")
      ? await stores.invoiceStore.list({ scope: { kind: "all" } })
      : null;

    let receipts: SystemSnapshot["receipts"] = null;
    let refunds: SystemSnapshot["refunds"] = null;
    if (this.holdsGlobal(context, "payments.read")) {
      const entries = await stores.financeEntryStore.list({
        scope: { kind: "all" },
        entryKind: "receipt",
        limit: RECEIPT_LIST_LIMIT,
      });
      receipts = entries.filter((entry) => entry.category === "orderPayment");
      refunds = await stores.financeEntryStore.listActive({
        scope: { kind: "all" },
        category: "refund",
      });
    }

    const customers = this.holdsGlobal(context, "customers.read")
      ? await stores.customerStore.list({})
      : null;

    // Every store caps its read. A snapshot that came back at the cap may
    // be missing exactly the record a row needs, so the result says so
    // instead of reporting a confident "not found".
    const truncated: string[] = [];
    if (orders && orders.length >= ORDER_LIST_LIMIT) truncated.push("orders");
    if (receipts && receipts.length >= RECEIPT_LIST_LIMIT) {
      truncated.push("receipts");
    }
    if (customers && customers.length >= CUSTOMER_LIST_LIMIT) {
      truncated.push("customers");
    }

    return {
      snapshot: {
        orders,
        invoices,
        receipts,
        refunds,
        customers,
        sellingPriceVisible:
          template === "generic" &&
          mapping.compareSellingPrice &&
          this.holdsGlobal(context, "orders.readSellingPrice"),
        sellingPriceGranted: this.holdsGlobal(
          context,
          "orders.readSellingPrice",
        ),
      },
      truncated,
    };
  }

  /** Caps the runner's own list scope to the units the check is stamped with. */
  private narrowToStamp(
    scope: ReadScope | null,
    check: Pick<SheetCheckDto, "scopeKind" | "businessUnitIds">,
  ): ReadScope | null {
    if (
      !scope ||
      check.scopeKind === "all" ||
      check.businessUnitIds.length === 0
    ) {
      return scope;
    }
    const stamped = new Set(check.businessUnitIds);
    if (scope.kind === "all") {
      return { kind: "businessUnits", businessUnitIds: [...stamped] };
    }
    if (scope.kind === "businessUnits") {
      return {
        kind: "businessUnits",
        businessUnitIds: scope.businessUnitIds.filter((unitId) =>
          stamped.has(unitId),
        ),
      };
    }
    return scope;
  }

  private mappingFromInput(
    check: SheetCheckDto,
    input: RunSheetCheckInput["mapping"],
  ): SheetMapping {
    const seen = new Set<number>();
    const columns: ColumnMapping[] = [];
    for (const column of input.columns) {
      // Columns outside the grid, or posted twice, are dropped silently.
      if (
        column.columnIndex >= check.columnCount ||
        seen.has(column.columnIndex)
      )
        continue;
      seen.add(column.columnIndex);
      columns.push({
        columnIndex: column.columnIndex,
        field: column.field,
        fixedCurrency: column.fixedCurrency,
        unitMultiplier: column.unitMultiplier,
        numberStyle: column.numberStyle,
        dateOrder: column.dateOrder,
      });
    }
    columns.sort((left, right) => left.columnIndex - right.columnIndex);
    return {
      columns,
      defaultCurrency: input.defaultCurrency,
      period: input.period
        ? { from: input.period.from, to: input.period.to }
        : null,
      compareSellingPrice:
        check.template === "generic" && input.compareSellingPrice,
    };
  }

  /**
   * Confirms the mapping and runs the comparison. `context` holds
   * `documents.import` on the check target plus the template gates (and,
   * for generic, whichever opportunistic permissions the caller resolved as
   * global). The result is written once, conditionally on the revision.
   */
  async run(
    context: AccessContext,
    rawInput: RunSheetCheckInput,
  ): Promise<SheetCheckDto> {
    const parsedInput = runSheetCheckInputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      throw new SheetCheckError("INVALID_INPUT", "Invalid run input.");
    }
    const input = parsedInput.data;
    const check = await this.loadCheck(input.checkId);
    if (check.status === "checked") {
      throw new SheetCheckError(
        "ALREADY_CHECKED",
        "This check already ran; rerun it to check again.",
      );
    }
    if (check.revision !== input.expectedRevision) {
      throw new SheetCheckError(
        "REVISION_CONFLICT",
        "The check changed on screen.",
      );
    }
    const target = {
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
    };
    await this.assertHolds(context, "documents.import", target);
    await this.assertGates(context, check.template, target);

    const mapping = this.mappingFromInput(check, input.mapping);
    if (
      mapping.compareSellingPrice &&
      !this.holdsGlobal(context, "orders.readSellingPrice")
    ) {
      await this.deny(context, "orders.readSellingPrice", target);
    }

    const steps = await this.pipeline();
    const rows = await this.loadAllRows(check);
    const storedRows: SheetRow[] = rows.map((row) => ({
      index: row.index,
      sheetRowNumber: row.sheetRowNumber,
      kind: row.kind,
      hidden: row.hidden,
      cells: row.cells,
    }));
    const mappingIssues = steps.validateMapping(
      mapping,
      check.template,
      storedRows,
    );
    if (hasBlockingIssue(mappingIssues)) {
      throw new SheetCheckError(
        "MAPPING_INVALID",
        "The mapping cannot run.",
        mappingIssues,
      );
    }

    const now = this.now();
    const timeZone = this.dependencies.timeZone;
    const headerTexts = Array.from(
      { length: check.columnCount },
      (_, index) =>
        check.proposal.columns.find((column) => column.columnIndex === index)
          ?.header ?? "",
    );
    const { snapshot: system, truncated } = await this.loadSnapshot(
      context,
      check,
      mapping,
    );
    const parsed = steps.parseRows(storedRows, {
      template: check.template,
      mapping,
      headerTexts,
      date1904: check.date1904,
      today: formatBusinessDay(now, timeZone),
    });
    const output = steps.reconcile({
      template: check.template,
      mapping,
      rows: storedRows,
      parsed,
      headerTexts,
      system,
      now,
      timeZone,
    });

    const requiredPermissions = unique<Permission>([
      ...templateGates[check.template],
      ...output.exercised,
    ]);
    const truncationIssues = truncated.map((kind) =>
      issue("SYSTEM_DATA_TRUNCATED", {
        kind,
        limit:
          kind === "receipts"
            ? RECEIPT_LIST_LIMIT
            : kind === "orders"
              ? ORDER_LIST_LIMIT
              : CUSTOMER_LIST_LIMIT,
      }),
    );
    const result: CheckResult = {
      summary: {
        ...output.summary,
        warnings: output.summary.warnings + truncationIssues.length,
      },
      sheetIssues: [...output.sheetIssues, ...truncationIssues],
      systemOnly: output.systemOnly,
      dataAt: now,
    };
    const checked = await this.dependencies.store.markChecked({
      checkId: check.id,
      expectedRevision: check.revision,
      mapping,
      result,
      rowResults: output.rowResults,
      requiredPermissions,
      checkedAt: now,
      expiresAt: addDays(now, this.retentionDays),
    });
    if (!checked) {
      const current = await this.dependencies.store.findById(check.id);
      if (current?.status === "checked") {
        throw new SheetCheckError(
          "ALREADY_CHECKED",
          "A concurrent run completed this check.",
        );
      }
      throw new SheetCheckError(
        "REVISION_CONFLICT",
        "The check changed while running.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "sheetCheck.run",
      resourceType: SHEET_CHECK_RESOURCE_TYPE,
      resourceId: checked.id,
      businessUnitIds: checked.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        template: checked.template,
        dataRows: output.summary.dataRows,
        errors: output.summary.errors,
        warnings: output.summary.warnings,
        requiredPermissions,
      },
      occurredAt: now,
    });

    return checked;
  }

  /** Removes an unrun draft: its creator, or a holder of global `documents.import`. */
  async discard(
    context: AccessContext,
    input: { checkId: string; expectedRevision: number },
  ): Promise<void> {
    const check = await this.loadCheck(input.checkId);
    if (check.status !== "mapping") {
      throw new SheetCheckError(
        "INVALID_STATE",
        "A checked result is kept until it expires.",
      );
    }
    const target = {
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
    };
    await this.assertHolds(context, "documents.import", target);
    if (
      check.createdByUserId !== context.userId &&
      !this.holdsGlobal(context, "documents.import")
    ) {
      await this.deny(context, "documents.import", target);
    }
    if (check.revision !== input.expectedRevision) {
      throw new SheetCheckError(
        "REVISION_CONFLICT",
        "The check changed on screen.",
      );
    }

    const removed = await this.dependencies.store.discard({
      checkId: check.id,
      expectedRevision: check.revision,
    });
    if (!removed) {
      const current = await this.dependencies.store.findById(check.id);
      if (!current) throw new SheetCheckError("NOT_FOUND", "Check not found.");
      throw new SheetCheckError(
        current.status === "mapping" ? "REVISION_CONFLICT" : "INVALID_STATE",
        "The check changed on screen.",
      );
    }

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "sheetCheck.discarded",
      resourceType: SHEET_CHECK_RESOURCE_TYPE,
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
      requestId: context.requestId,
      metadata: { template: check.template, rowCount: check.rowCount },
      occurredAt: this.now(),
    });
  }

  /**
   * A new `mapping` check from a checked one: the grid is cloned with its
   * results stripped, the proposal and the confirmed mapping are copied and
   * `rerunOf` points back. A result is never mutated in place. Requires
   * `documents.import` on the source, the read rule and the template gates.
   */
  async rerun(
    context: AccessContext,
    input: { checkId: string },
  ): Promise<SheetCheckDto> {
    const source = await this.loadCheck(input.checkId);
    if (source.status !== "checked") {
      throw new SheetCheckError(
        "INVALID_STATE",
        "Only a finished check can be run again.",
      );
    }
    const target = {
      resourceId: source.id,
      businessUnitIds: source.businessUnitIds,
    };
    await this.assertReadable(context, source);
    await this.assertHolds(context, "documents.import", target);
    await this.assertGates(context, source.template, target);
    const scope = this.stampScope(context, source.template);

    const rows = await this.loadAllRows(source);
    const clonedRows: NewSheetRowRecord[] = rows.map((row) => ({
      index: row.index,
      sheetRowNumber: row.sheetRowNumber,
      kind: row.kind,
      hidden: row.hidden,
      cells: row.cells,
    }));
    const proposal: MappingProposal = source.proposal;
    const now = this.now();
    const record: NewSheetCheckRecord = {
      template: source.template,
      status: "mapping",
      sourceKind: source.sourceKind,
      fileName: source.fileName,
      fileBytes: source.fileBytes,
      fileFormat: source.fileFormat,
      sheets: source.sheets,
      sheetIndex: source.sheetIndex,
      sheetName: source.sheetName,
      columnCount: source.columnCount,
      date1904: source.date1904,
      rowCount: source.rowCount,
      dataRowCount: source.dataRowCount,
      intakeIssues: source.intakeIssues,
      proposal,
      mapping: source.mapping,
      result: null,
      requiredPermissions: [...templateGates[source.template]],
      scopeKind: scope.scopeKind,
      businessUnitIds: scope.businessUnitIds,
      createdByUserId: context.userId,
      rerunOf: source.id,
      checkedAt: null,
      expiresAt: addDays(now, sheetCheckLimits.draftRetentionDays),
    };
    const check = await this.dependencies.store.insert(record, clonedRows);

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "sheetCheck.rerun",
      resourceType: SHEET_CHECK_RESOURCE_TYPE,
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        template: check.template,
        rerunOf: source.id,
        rowCount: check.rowCount,
      },
      occurredAt: now,
    });

    return check;
  }

  /** CSV of a checked result: `documents.export` plus the read rule. */
  async exportCsv(
    context: AccessContext,
    checkId: string,
    locale: "vi" | "en",
  ): Promise<{ fileName: string; content: string }> {
    const check = await this.loadCheck(checkId);
    const target = {
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
    };
    await this.assertHolds(context, "documents.export", target);
    await this.assertReadable(context, check);
    if (check.status !== "checked") {
      throw new SheetCheckError(
        "INVALID_STATE",
        "Only a checked result can be exported.",
      );
    }

    const rows = await this.loadAllRows(check);
    const file = buildCsvExport({
      check,
      rows,
      locale,
      timeZone: this.dependencies.timeZone,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "sheetCheck.exported",
      resourceType: SHEET_CHECK_RESOURCE_TYPE,
      resourceId: check.id,
      businessUnitIds: check.businessUnitIds,
      requestId: context.requestId,
      metadata: {
        template: check.template,
        rowCount: rows.length,
        fileName: file.fileName,
        locale,
      },
      occurredAt: this.now(),
    });

    return file;
  }
}
