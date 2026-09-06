import "server-only";

import { Types } from "mongoose";

import type { Permission } from "@/domains/identity/permissions";
import type {
  CheckResult,
  ColumnMapping,
  ColumnProposal,
  MappingProposal,
  NewSheetCheckRecord,
  NewSheetRowRecord,
  RowResult,
  SheetCell,
  SheetCheckDto,
  SheetCheckListFilter,
  SheetCheckListScope,
  SheetCheckStore,
  SheetInventoryEntry,
  SheetMapping,
  SheetRowDto,
  SheetRowListOptions,
  SystemOnlyItem,
} from "@/domains/sheet-checks/contracts";
import {
  severityRank,
  worstSeverity,
  type Issue,
  type IssueSeverity,
} from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import {
  getSheetCheckModel,
  getSheetCheckRowModel,
} from "@/domains/sheet-checks/persistence/models";
import { connectToDatabase } from "@/lib/db/mongoose";

type CheckDocument = {
  _id: Types.ObjectId;
  template: SheetCheckDto["template"];
  status: SheetCheckDto["status"];
  sourceKind: SheetCheckDto["sourceKind"];
  fileName: string;
  fileBytes: number;
  fileFormat: SheetCheckDto["fileFormat"];
  sheets: SheetInventoryEntry[];
  sheetIndex: number;
  sheetName: string;
  columnCount: number;
  date1904: boolean;
  rowCount: number;
  dataRowCount: number;
  intakeIssues: Issue[];
  proposal: MappingProposal;
  mapping: SheetMapping;
  result:
    | (Omit<CheckResult, "sheetIssues" | "systemOnly"> & {
        sheetIssues: Issue[];
        systemOnly: SystemOnlyItem[];
      })
    | null;
  requiredPermissions: Permission[];
  scopeKind: SheetCheckDto["scopeKind"];
  businessUnitIds: Types.ObjectId[];
  createdByUserId: Types.ObjectId;
  rerunOf: Types.ObjectId | null;
  checkedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
};

type RowDocument = {
  _id: Types.ObjectId;
  checkId: Types.ObjectId;
  index: number;
  sheetRowNumber: number;
  kind: SheetRowDto["kind"];
  hidden: boolean;
  cells: SheetCell[];
  result: RowResult | null;
  worst: IssueSeverity | null;
  expiresAt: Date;
};

const ROW_CHUNK = 500;

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function cloneIssue(entry: Issue): Issue {
  return {
    code: entry.code,
    severity: entry.severity,
    columnIndex: entry.columnIndex ?? null,
    params: { ...entry.params },
  };
}

function columnMappingToDocument(column: ColumnMapping) {
  return {
    columnIndex: column.columnIndex,
    field: column.field,
    fixedCurrency: column.fixedCurrency,
    unitMultiplier: column.unitMultiplier,
    numberStyle: column.numberStyle,
    dateOrder: column.dateOrder,
  };
}

function mappingToDocument(mapping: SheetMapping) {
  return {
    columns: mapping.columns.map(columnMappingToDocument),
    defaultCurrency: mapping.defaultCurrency,
    period: mapping.period ? { ...mapping.period } : null,
    compareSellingPrice: mapping.compareSellingPrice,
  };
}

function mappingToDto(mapping: SheetMapping): SheetMapping {
  return {
    columns: mapping.columns.map((column) => ({
      columnIndex: column.columnIndex,
      field: column.field,
      fixedCurrency: column.fixedCurrency ?? null,
      unitMultiplier: column.unitMultiplier,
      numberStyle: column.numberStyle ?? null,
      dateOrder: column.dateOrder ?? null,
    })),
    defaultCurrency: mapping.defaultCurrency,
    period: mapping.period
      ? { from: mapping.period.from, to: mapping.period.to }
      : null,
    compareSellingPrice: mapping.compareSellingPrice,
  };
}

function columnProposalToDocument(column: ColumnProposal) {
  return {
    columnIndex: column.columnIndex,
    header: column.header,
    field: column.field,
    confidence: column.confidence,
    suggestedMultiplier: column.suggestedMultiplier,
    inferredStyle: column.inferredStyle,
    inferredDateOrder: column.inferredDateOrder,
    sampleValues: [...column.sampleValues],
  };
}

function proposalToDocument(proposal: MappingProposal) {
  return {
    headerSheetRowNumber: proposal.headerSheetRowNumber,
    headerFound: proposal.headerFound,
    columns: proposal.columns.map(columnProposalToDocument),
    periodHint: proposal.periodHint ? { ...proposal.periodHint } : null,
    titleLines: [...proposal.titleLines],
  };
}

function proposalToDto(proposal: MappingProposal): MappingProposal {
  return {
    headerSheetRowNumber: proposal.headerSheetRowNumber ?? null,
    headerFound: proposal.headerFound,
    columns: proposal.columns.map((column) => ({
      columnIndex: column.columnIndex,
      header: column.header,
      field: column.field,
      confidence: column.confidence,
      suggestedMultiplier: column.suggestedMultiplier,
      inferredStyle: column.inferredStyle ?? null,
      inferredDateOrder: column.inferredDateOrder ?? null,
      sampleValues: [...column.sampleValues],
    })),
    periodHint: proposal.periodHint
      ? { from: proposal.periodHint.from, to: proposal.periodHint.to }
      : null,
    titleLines: [...proposal.titleLines],
  };
}

function resultToDocument(result: CheckResult) {
  return {
    summary: {
      dataRows: result.summary.dataRows,
      skippedRows: result.summary.skippedRows,
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      infos: result.summary.infos,
      outcomes: { ...result.summary.outcomes },
      totals: result.summary.totals.map((line) => ({
        field: line.field,
        columnIndex: line.columnIndex,
        currency: line.currency,
        computed: line.computed,
        sheetTotal: line.sheetTotal,
        rowsCounted: line.rowsCounted,
        rowsSkipped: line.rowsSkipped,
        system: line.system,
      })),
    },
    sheetIssues: result.sheetIssues.map(cloneIssue),
    systemOnly: result.systemOnly.map((item) => ({
      kind: item.kind,
      label: item.label,
      day: item.day,
      amount: item.amount ? { ...item.amount } : null,
      issue: cloneIssue(item.issue),
    })),
    dataAt: result.dataAt,
  };
}

function resultToDto(result: CheckDocument["result"]): CheckResult | null {
  if (!result) return null;
  return {
    summary: {
      dataRows: result.summary.dataRows,
      skippedRows: result.summary.skippedRows,
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      infos: result.summary.infos,
      outcomes: { ...result.summary.outcomes },
      totals: result.summary.totals.map((line) => ({
        field: line.field,
        columnIndex: line.columnIndex,
        currency: line.currency,
        computed: line.computed,
        sheetTotal: line.sheetTotal ?? null,
        rowsCounted: line.rowsCounted,
        rowsSkipped: line.rowsSkipped,
        system: line.system ?? null,
      })),
    },
    sheetIssues: result.sheetIssues.map(cloneIssue),
    systemOnly: result.systemOnly.map((item) => ({
      kind: item.kind,
      label: item.label,
      day: item.day ?? null,
      amount: item.amount ? { ...item.amount } : null,
      issue: cloneIssue(item.issue),
    })),
    dataAt: result.dataAt,
  };
}

function toDto(document: CheckDocument): SheetCheckDto {
  return {
    id: document._id.toHexString(),
    template: document.template,
    status: document.status,
    sourceKind: document.sourceKind,
    fileName: document.fileName,
    fileBytes: document.fileBytes,
    fileFormat: document.fileFormat,
    sheets: document.sheets.map((sheet) => ({
      index: sheet.index,
      name: sheet.name,
      rowCount: sheet.rowCount,
    })),
    sheetIndex: document.sheetIndex,
    sheetName: document.sheetName,
    columnCount: document.columnCount,
    date1904: document.date1904,
    rowCount: document.rowCount,
    dataRowCount: document.dataRowCount,
    intakeIssues: (document.intakeIssues ?? []).map(cloneIssue),
    proposal: proposalToDto(document.proposal),
    mapping: mappingToDto(document.mapping),
    result: resultToDto(document.result ?? null),
    requiredPermissions: [...(document.requiredPermissions ?? [])],
    scopeKind: document.scopeKind,
    businessUnitIds: (document.businessUnitIds ?? []).map((id) =>
      id.toHexString(),
    ),
    createdByUserId: document.createdByUserId.toHexString(),
    rerunOf: document.rerunOf ? document.rerunOf.toHexString() : null,
    checkedAt: document.checkedAt ?? null,
    expiresAt: document.expiresAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
  };
}

function cellToDocument(cell: SheetCell) {
  return {
    text: cell.text,
    type: cell.type,
    // A non-finite double cannot be stored as a BSON number; the text keeps
    // what the sheet showed and the parser treats the cell as unreadable.
    number:
      cell.number !== null && Number.isFinite(cell.number) ? cell.number : null,
    numberFormat: cell.numberFormat,
    formula: cell.formula,
    noCache: cell.noCache,
    mergedFill: cell.mergedFill,
    truncated: cell.truncated,
  };
}

function cellToDto(cell: SheetCell): SheetCell {
  return {
    text: cell.text ?? "",
    type: cell.type,
    number: cell.number ?? null,
    numberFormat: cell.numberFormat ?? null,
    formula: cell.formula ?? false,
    noCache: cell.noCache ?? false,
    mergedFill: cell.mergedFill ?? false,
    truncated: cell.truncated ?? false,
  };
}

function rowResultToDocument(result: RowResult) {
  return {
    parsed: { ...result.parsed },
    issues: result.issues.map(cloneIssue),
    system: result.system ? { ...result.system } : null,
    outcome: result.outcome,
  };
}

function rowResultToDto(result: RowResult | null): RowResult | null {
  if (!result) return null;
  return {
    parsed: { ...result.parsed },
    issues: (result.issues ?? []).map(cloneIssue),
    system: result.system ? { ...result.system } : null,
    outcome: result.outcome,
  };
}

function rowToDto(document: RowDocument): SheetRowDto {
  return {
    checkId: document.checkId.toHexString(),
    index: document.index,
    sheetRowNumber: document.sheetRowNumber,
    kind: document.kind,
    hidden: document.hidden,
    cells: document.cells.map(cellToDto),
    result: rowResultToDto(document.result ?? null),
  };
}

function rowToDocument(
  checkId: Types.ObjectId,
  row: NewSheetRowRecord,
  expiresAt: Date,
) {
  return {
    checkId,
    index: row.index,
    sheetRowNumber: row.sheetRowNumber,
    kind: row.kind,
    hidden: row.hidden,
    cells: row.cells.map(cellToDocument),
    result: null,
    worst: null,
    expiresAt,
  };
}

/**
 * `businessUnits`: every stamped unit is covered (a global check stamped []
 * is deliberately NOT matched — it needs a global grant) OR the reader
 * created it. `own`: the reader's own only.
 */
function scopeQuery(scope: SheetCheckListScope): Record<string, unknown> {
  if (scope.kind === "all") return {};
  const userId = new Types.ObjectId(scope.userId);
  if (scope.kind === "own") return { createdByUserId: userId };
  return {
    $or: [
      {
        "businessUnitIds.0": { $exists: true },
        businessUnitIds: {
          $not: { $elemMatch: { $nin: toObjectIds(scope.businessUnitIds) } },
        },
      },
      { createdByUserId: userId },
    ],
  };
}

function severitiesAtLeast(minSeverity: IssueSeverity): IssueSeverity[] {
  return (Object.keys(severityRank) as IssueSeverity[]).filter(
    (severity) => severityRank[severity] >= severityRank[minSeverity],
  );
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

export class MongoSheetCheckStore implements SheetCheckStore {
  async insert(
    record: NewSheetCheckRecord,
    rows: readonly NewSheetRowRecord[],
  ): Promise<SheetCheckDto> {
    await connectToDatabase();
    const created = await getSheetCheckModel().create({
      template: record.template,
      status: record.status,
      sourceKind: record.sourceKind,
      fileName: record.fileName,
      fileBytes: record.fileBytes,
      fileFormat: record.fileFormat,
      sheets: record.sheets.map((sheet) => ({
        index: sheet.index,
        name: sheet.name,
        rowCount: sheet.rowCount,
      })),
      sheetIndex: record.sheetIndex,
      sheetName: record.sheetName,
      columnCount: record.columnCount,
      date1904: record.date1904,
      rowCount: record.rowCount,
      dataRowCount: record.dataRowCount,
      intakeIssues: record.intakeIssues.map(cloneIssue),
      proposal: proposalToDocument(record.proposal),
      mapping: mappingToDocument(record.mapping),
      result: record.result ? resultToDocument(record.result) : null,
      requiredPermissions: [...record.requiredPermissions],
      scopeKind: record.scopeKind,
      businessUnitIds: toObjectIds(record.businessUnitIds),
      createdByUserId: new Types.ObjectId(record.createdByUserId),
      rerunOf: record.rerunOf ? new Types.ObjectId(record.rerunOf) : null,
      checkedAt: record.checkedAt,
      expiresAt: record.expiresAt,
    });
    const checkId = created._id as Types.ObjectId;

    try {
      for (const chunk of chunks(rows, ROW_CHUNK)) {
        await getSheetCheckRowModel().insertMany(
          chunk.map((row) => rowToDocument(checkId, row, record.expiresAt)),
          { ordered: true },
        );
      }
    } catch (error) {
      // A header without its rows would be an empty check; remove both so
      // the caller can retry cleanly.
      await getSheetCheckRowModel().deleteMany({ checkId }).exec();
      await getSheetCheckModel().deleteOne({ _id: checkId }).exec();
      throw error;
    }

    return toDto(created.toObject() as CheckDocument);
  }

  async findById(checkId: string): Promise<SheetCheckDto | null> {
    if (!Types.ObjectId.isValid(checkId)) return null;
    await connectToDatabase();
    const document = await getSheetCheckModel()
      .findById(checkId)
      .lean<CheckDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async list(filter: SheetCheckListFilter): Promise<SheetCheckDto[]> {
    await connectToDatabase();
    const documents = await getSheetCheckModel()
      .find({
        ...scopeQuery(filter.scope),
        ...(filter.template ? { template: filter.template } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(filter.offset ?? 0)
      .limit(filter.limit ?? sheetCheckLimits.listPageSize)
      .lean<CheckDocument[]>()
      .exec();
    return documents.map(toDto);
  }

  async countRowsWithIssues(
    checkId: string,
    minSeverity: IssueSeverity,
  ): Promise<number> {
    if (!Types.ObjectId.isValid(checkId)) return 0;
    await connectToDatabase();
    return getSheetCheckRowModel()
      .countDocuments({
        checkId: new Types.ObjectId(checkId),
        worst: { $in: severitiesAtLeast(minSeverity) },
      })
      .exec();
  }

  async listRows(
    checkId: string,
    options: SheetRowListOptions,
  ): Promise<SheetRowDto[]> {
    if (!Types.ObjectId.isValid(checkId)) return [];
    await connectToDatabase();
    const documents = await getSheetCheckRowModel()
      .find({
        checkId: new Types.ObjectId(checkId),
        ...(options.minSeverity
          ? { worst: { $in: severitiesAtLeast(options.minSeverity) } }
          : {}),
      })
      .sort({ index: 1 })
      .skip(options.offset)
      .limit(options.limit)
      .lean<RowDocument[]>()
      .exec();
    return documents.map(rowToDto);
  }

  async findRow(
    checkId: string,
    rowIndex: number,
  ): Promise<SheetRowDto | null> {
    if (!Types.ObjectId.isValid(checkId)) return null;
    await connectToDatabase();
    const document = await getSheetCheckRowModel()
      .findOne({ checkId: new Types.ObjectId(checkId), index: rowIndex })
      .lean<RowDocument>()
      .exec();
    return document ? rowToDto(document) : null;
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
    if (!Types.ObjectId.isValid(input.checkId)) return null;
    await connectToDatabase();
    const checkId = new Types.ObjectId(input.checkId);

    // The header flips first and conditionally: a concurrent run loses here
    // and never touches the rows. `new: false` keeps the draft as it was so
    // a failure while writing the rows can put it back.
    const previous = await getSheetCheckModel()
      .findOneAndUpdate(
        { _id: checkId, status: "mapping", revision: input.expectedRevision },
        {
          $set: {
            status: "checked",
            mapping: mappingToDocument(input.mapping),
            result: resultToDocument(input.result),
            requiredPermissions: [...input.requiredPermissions],
            checkedAt: input.checkedAt,
            expiresAt: input.expiresAt,
          },
          $inc: { revision: 1 },
        },
        { new: false },
      )
      .lean<CheckDocument>()
      .exec();
    if (!previous) return null;

    try {
      // Every row follows the header's retention, whether or not the run
      // produced a result for it.
      await getSheetCheckRowModel()
        .updateMany({ checkId }, { $set: { expiresAt: input.expiresAt } })
        .exec();
      for (const chunk of chunks(input.rowResults, ROW_CHUNK)) {
        await getSheetCheckRowModel().bulkWrite(
          chunk.map((entry) => ({
            updateOne: {
              filter: { checkId, index: entry.rowIndex },
              update: {
                $set: {
                  result: rowResultToDocument(entry.result),
                  worst: worstSeverity(entry.result.issues),
                  expiresAt: input.expiresAt,
                },
              },
            },
          })),
          { ordered: false },
        );
      }
    } catch (error) {
      // A half-written result would read as a finished check whose rows say
      // nothing. The draft is put back instead, so it can simply be run again.
      await getSheetCheckModel()
        .updateOne(
          { _id: checkId, revision: previous.revision + 1 },
          {
            $set: {
              status: "mapping",
              mapping: previous.mapping,
              result: null,
              requiredPermissions: [...previous.requiredPermissions],
              checkedAt: null,
              expiresAt: previous.expiresAt,
            },
            $inc: { revision: 1 },
          },
        )
        .exec()
        .catch(() => undefined);
      throw error;
    }

    const document = await getSheetCheckModel()
      .findById(checkId)
      .lean<CheckDocument>()
      .exec();
    return document ? toDto(document) : null;
  }

  async discard(input: {
    checkId: string;
    expectedRevision: number;
  }): Promise<boolean> {
    if (!Types.ObjectId.isValid(input.checkId)) return false;
    await connectToDatabase();
    const checkId = new Types.ObjectId(input.checkId);
    const deleted = await getSheetCheckModel()
      .deleteOne({
        _id: checkId,
        status: "mapping",
        revision: input.expectedRevision,
      })
      .exec();
    if (deleted.deletedCount !== 1) return false;
    await getSheetCheckRowModel().deleteMany({ checkId }).exec();
    return true;
  }
}

export const mongoSheetCheckStore = new MongoSheetCheckStore();
