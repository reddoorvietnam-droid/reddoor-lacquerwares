/**
 * Hard limits of the spreadsheet check. Every cap is a deliberate ceiling
 * (ADR-005: spreadsheets are parsed server-side only, formulas are never
 * evaluated, and bytes/rows/columns are bounded) so a hostile or merely
 * huge file cannot exhaust the server or the database.
 */
export const sheetCheckLimits = {
  /** Upload size, bytes. Route handlers reject anything above it before parsing. */
  maxFileBytes: 4 * 1024 * 1024,
  /** Data rows read from the chosen sheet (header and title rows excluded). */
  maxRows: 2_000,
  /** Columns read; the rest are dropped with COLUMNS_IGNORED. */
  maxColumns: 40,
  /** Characters kept per cell; longer text is cut with CELL_TRUNCATED. */
  maxCellChars: 200,
  /** Sheets inspected; the rest are dropped with SHEETS_IGNORED. */
  maxSheets: 10,
  /** Rows scanned from the top when looking for the header row. */
  headerWindowRows: 30,
  /** Consecutive blank rows that end the data region. */
  blankRowsEndRegion: 3,
  /** Rows a SheetJS read may touch at most (header window + data + slack). */
  sheetRowsCap: 2_031,
  /** Zip container guards applied before SheetJS sees the bytes. */
  maxZipEntries: 200,
  maxZipEntryBytes: 30 * 1024 * 1024,
  maxZipTotalBytes: 60 * 1024 * 1024,
  /** Uploads per user inside the window. */
  uploadsPerWindow: 10,
  uploadWindowMs: 10 * 60_000,
  /** Retention: unrun drafts, and checked results (overridable by env, 7–365). */
  draftRetentionDays: 7,
  checkedRetentionDays: 180,
  minRetentionDays: 7,
  maxRetentionDays: 365,
  /** Receipt matching window in calendar days around the sheet date. */
  matchWindowDays: 7,
  /** Bank-fee tolerance: |diff| ≤ ratio × amount, capped, with an absolute floor. */
  feeTolerance: {
    ratio: "0.005",
    capVnd: "500000",
    capUsd: "50",
    floorVnd: "30000",
    floorUsd: "5",
  },
  /** Split/merged transfers: how many rows/receipts may add up to one figure. */
  splitMaxParts: 4,
  /** Candidate receipts considered for a merged match; above this no search. */
  mergedMaxCandidates: 6,
  /** Receipt candidates named in a RECEIPT_NOT_FOUND issue. */
  candidatesShown: 3,
  /** Digits-only order hints named in an ORDER_NOT_FOUND issue. */
  orderHintsShown: 3,
  /** Sample values shown per proposed column on the mapping page. */
  sampleValuesShown: 3,
  /** Paging. */
  listPageSize: 50,
  rowsPageSize: 200,
  /** Money sanity thresholds (money templates only). */
  vndUnitSuspectBelow: "1000",
  vndImplausibleAbove: "10000000000000",
  usdImplausibleAbove: "1000000000",
  /** Dates accepted: from this day to today + futureDays. */
  earliestDay: "2015-01-01",
  futureDays: 366,
  /** A `date` further ahead than this is flagged DATE_FUTURE. */
  dateFutureWarnDays: 7,
} as const;

export type SheetCheckLimits = typeof sheetCheckLimits;
