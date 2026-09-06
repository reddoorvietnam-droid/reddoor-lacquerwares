import "server-only";

import { Schema } from "mongoose";

import { permissionCatalog } from "@/domains/identity/permissions";
import {
  canonicalFields,
  dateOrders,
  moneyFields,
  numberStyles,
  rowOutcomes,
  sheetCellTypes,
  sheetCheckSourceKinds,
  sheetCheckStatuses,
  sheetCheckTemplates,
  sheetFileFormats,
  sheetRowKinds,
  unitMultipliers,
} from "@/domains/sheet-checks/contracts";
import {
  getOrCreateModel,
  nestedSchemaOptions,
  rootSchemaOptions,
} from "@/lib/content/mongoose";
import { supportedCurrencies } from "@/lib/money";

/**
 * A check is stored as one header document plus one document per stored
 * row. Rows live apart so a 2,000-row sheet never has to travel with the
 * summary, and so the row list can be paged and filtered by severity in the
 * database. Both carry `expiresAt` for the TTL monitor: the original file is
 * never kept, and the parsed evidence itself is retained only for the
 * configured period.
 *
 * Issues are stored as `{code, severity, columnIndex, params}` objects
 * (Mixed): the catalogue renders the sentence at read time, so no prose and
 * no cell text ever becomes a template. Money inside results stays
 * `{amount, currency}` strings — nothing here is ever a JS number except a
 * cell's raw double, kept for the parser.
 */

const severityValues = ["error", "warn", "info"] as const;

const sheetInventorySchema = new Schema(
  {
    index: { type: Number, required: true, min: 0 },
    name: { type: String, required: true, maxlength: 200 },
    rowCount: { type: Number, required: true, min: 0 },
  },
  nestedSchemaOptions,
);

const periodSchema = new Schema(
  {
    from: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    to: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  nestedSchemaOptions,
);

const columnMappingSchema = new Schema(
  {
    columnIndex: { type: Number, required: true, min: 0 },
    field: { type: String, required: true, enum: canonicalFields },
    fixedCurrency: {
      type: String,
      enum: [...supportedCurrencies, null],
      default: null,
    },
    unitMultiplier: {
      type: String,
      required: true,
      enum: unitMultipliers,
      default: "1",
    },
    numberStyle: { type: String, enum: [...numberStyles, null], default: null },
    dateOrder: { type: String, enum: [...dateOrders, null], default: null },
  },
  nestedSchemaOptions,
);

const mappingSchema = new Schema(
  {
    columns: { type: [columnMappingSchema], required: true, default: [] },
    defaultCurrency: {
      type: String,
      required: true,
      enum: supportedCurrencies,
    },
    period: { type: periodSchema, default: null },
    compareSellingPrice: { type: Boolean, required: true, default: false },
  },
  nestedSchemaOptions,
);

const columnProposalSchema = new Schema(
  {
    columnIndex: { type: Number, required: true, min: 0 },
    header: { type: String, default: "" },
    field: { type: String, required: true, enum: canonicalFields },
    confidence: {
      type: String,
      required: true,
      enum: ["high", "medium", "low"],
    },
    suggestedMultiplier: {
      type: String,
      required: true,
      enum: unitMultipliers,
      default: "1",
    },
    inferredStyle: {
      type: String,
      enum: [...numberStyles, "mixed", "unknown", null],
      default: null,
    },
    inferredDateOrder: {
      type: String,
      enum: [...dateOrders, "conflict", "assumed", null],
      default: null,
    },
    sampleValues: { type: [String], required: true, default: [] },
  },
  nestedSchemaOptions,
);

const proposalSchema = new Schema(
  {
    headerSheetRowNumber: { type: Number, min: 1, default: null },
    headerFound: { type: Boolean, required: true, default: false },
    columns: { type: [columnProposalSchema], required: true, default: [] },
    periodHint: { type: periodSchema, default: null },
    titleLines: { type: [String], required: true, default: [] },
  },
  nestedSchemaOptions,
);

const totalsLineSchema = new Schema(
  {
    field: { type: String, required: true, enum: moneyFields },
    columnIndex: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: supportedCurrencies },
    computed: { type: String, required: true },
    sheetTotal: { type: String, default: null },
    rowsCounted: { type: Number, required: true, min: 0 },
    rowsSkipped: { type: Number, required: true, min: 0 },
    system: { type: String, default: null },
  },
  nestedSchemaOptions,
);

const outcomesSchema = new Schema(
  Object.fromEntries(
    rowOutcomes.map((outcome) => [
      outcome,
      { type: Number, required: true, min: 0, default: 0 },
    ]),
  ),
  nestedSchemaOptions,
);

const summarySchema = new Schema(
  {
    dataRows: { type: Number, required: true, min: 0 },
    skippedRows: { type: Number, required: true, min: 0 },
    errors: { type: Number, required: true, min: 0 },
    warnings: { type: Number, required: true, min: 0 },
    infos: { type: Number, required: true, min: 0 },
    outcomes: { type: outcomesSchema, required: true },
    totals: { type: [totalsLineSchema], required: true, default: [] },
  },
  nestedSchemaOptions,
);

const resultSchema = new Schema(
  {
    summary: { type: summarySchema, required: true },
    sheetIssues: { type: [Schema.Types.Mixed], required: true, default: [] },
    systemOnly: { type: [Schema.Types.Mixed], required: true, default: [] },
    dataAt: { type: Date, required: true },
  },
  nestedSchemaOptions,
);

export const sheetCheckSchema = new Schema(
  {
    template: {
      type: String,
      required: true,
      immutable: true,
      enum: sheetCheckTemplates,
    },
    status: {
      type: String,
      required: true,
      enum: sheetCheckStatuses,
      default: "mapping",
    },
    sourceKind: {
      type: String,
      required: true,
      immutable: true,
      enum: sheetCheckSourceKinds,
    },
    fileName: { type: String, required: true, immutable: true, maxlength: 255 },
    fileBytes: { type: Number, required: true, immutable: true, min: 0 },
    fileFormat: {
      type: String,
      required: true,
      immutable: true,
      enum: sheetFileFormats,
    },
    sheets: { type: [sheetInventorySchema], required: true, default: [] },
    sheetIndex: { type: Number, required: true, min: 0 },
    sheetName: { type: String, required: true, maxlength: 200 },
    columnCount: { type: Number, required: true, min: 0 },
    date1904: { type: Boolean, required: true, default: false },
    rowCount: { type: Number, required: true, min: 0 },
    dataRowCount: { type: Number, required: true, min: 0 },
    intakeIssues: { type: [Schema.Types.Mixed], required: true, default: [] },
    proposal: { type: proposalSchema, required: true },
    mapping: { type: mappingSchema, required: true },
    result: { type: resultSchema, default: null },
    requiredPermissions: {
      type: [{ type: String, enum: permissionCatalog }],
      required: true,
      default: [],
    },
    scopeKind: {
      type: String,
      required: true,
      enum: ["all", "businessUnits"],
    },
    businessUnitIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "BusinessUnit" }],
      required: true,
      default: [],
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "User",
    },
    rerunOf: { type: Schema.Types.ObjectId, ref: "SheetCheck", default: null },
    checkedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  rootSchemaOptions,
);

sheetCheckSchema.index(
  { createdByUserId: 1, createdAt: -1 },
  { name: "sheet_check_by_user" },
);
sheetCheckSchema.index(
  { businessUnitIds: 1, createdAt: -1 },
  { name: "sheet_check_by_unit" },
);
sheetCheckSchema.index(
  { status: 1, createdAt: -1 },
  { name: "sheet_check_by_status" },
);
// TTL: MongoDB removes the header once `expiresAt` has passed.
sheetCheckSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "sheet_check_ttl" },
);

const cellSchema = new Schema(
  {
    text: { type: String, default: "" },
    type: { type: String, required: true, enum: sheetCellTypes },
    number: { type: Number, default: null },
    numberFormat: { type: String, default: null },
    formula: { type: Boolean, required: true, default: false },
    noCache: { type: Boolean, required: true, default: false },
    mergedFill: { type: Boolean, required: true, default: false },
    truncated: { type: Boolean, required: true, default: false },
  },
  nestedSchemaOptions,
);

const rowResultSchema = new Schema(
  {
    parsed: { type: Schema.Types.Mixed, required: true },
    issues: { type: [Schema.Types.Mixed], required: true, default: [] },
    system: { type: Schema.Types.Mixed, default: null },
    outcome: { type: String, required: true, enum: rowOutcomes },
  },
  nestedSchemaOptions,
);

export const sheetCheckRowSchema = new Schema(
  {
    checkId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: "SheetCheck",
    },
    index: { type: Number, required: true, immutable: true, min: 0 },
    sheetRowNumber: { type: Number, required: true, min: 1 },
    kind: { type: String, required: true, enum: sheetRowKinds },
    hidden: { type: Boolean, required: true, default: false },
    cells: { type: [cellSchema], required: true, default: [] },
    result: { type: rowResultSchema, default: null },
    /** Denormalised worst severity of `result.issues`, for the issue filter. */
    worst: { type: String, enum: [...severityValues, null], default: null },
    expiresAt: { type: Date, required: true },
  },
  { strict: "throw", timestamps: false, minimize: false, versionKey: false },
);

sheetCheckRowSchema.index(
  { checkId: 1, index: 1 },
  { unique: true, name: "sheet_check_row_position" },
);
sheetCheckRowSchema.index(
  { checkId: 1, worst: 1, index: 1 },
  { name: "sheet_check_row_worst" },
);
sheetCheckRowSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: "sheet_check_row_ttl" },
);

export const getSheetCheckModel = () =>
  getOrCreateModel("SheetCheck", sheetCheckSchema);

export const getSheetCheckRowModel = () =>
  getOrCreateModel("SheetCheckRow", sheetCheckRowSchema);
