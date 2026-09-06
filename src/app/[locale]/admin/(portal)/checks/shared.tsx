import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { orderStageDefinitions } from "@/domains/orders/workflow";
import {
  columnLabel,
  fieldLabels,
  identityFields,
  templateGates,
  type CandidateReason,
  type CanonicalField,
  type MappingConfidence,
  type MatchStrength,
  type RowOutcome,
  type RowSystemView,
  type SheetCheckDto,
  type SheetCheckStatus,
  type SheetCheckTemplate,
  type SheetMapping,
  type SheetRowDto,
  type SheetRowKind,
} from "@/domains/sheet-checks/contracts";
import {
  issueCatalog,
  renderIssue,
  type Issue,
  type IssueCode,
  type IssueSeverity,
} from "@/domains/sheet-checks/issues";
import { sheetCheckLimits } from "@/domains/sheet-checks/limits";
import { formatBusinessDay } from "@/domains/tasks/policy";
import type { PermissionCoverage } from "@/lib/auth";
import type { AdminLocale } from "@/lib/i18n/admin";
import { formatMoney, type Currency, type Money } from "@/lib/money";

/**
 * Copy and presentational helpers of the spreadsheet-check screens. Like the
 * finance pages, the copy ships with the screens instead of the admin
 * dictionary: the three pages read together, and every sentence about a
 * finding is rendered from the issue catalogue — never from cell text.
 */

const maxFileMb = Math.round(sheetCheckLimits.maxFileBytes / (1024 * 1024));

/**
 * Query values are attacker-controlled text: a key such as `__proto__` or
 * `constructor` must never resolve through the prototype chain into a
 * value React then refuses to render.
 */
export function copyFor(
  map: Record<string, string>,
  key: string | undefined,
): string | null {
  if (!key || !Object.hasOwn(map, key)) return null;
  const value = map[key];
  return typeof value === "string" ? value : null;
}

export const checkCopy = {
  vi: {
    eyebrow: "Kiểm tra bảng biểu",
    back: "← Kiểm tra bảng biểu",
    listTitle: "Kiểm tra bảng biểu, dư nợ",
    listDescription:
      "Tải bảng báo cáo tiền về, bảng công nợ hoặc danh sách đơn hàng (Excel/CSV) lên; hệ thống đọc từng ô, kiểm tra định dạng và đối chiếu với dữ liệu trong phần mềm. Kết quả chỉ để xem: không sửa gì trong hệ thống, không lưu tệp gốc.",
    explainerTitle: "Kiểm tra làm gì",
    explainerDoes: [
      "Đọc bảng, nhận dạng cột, kiểm tra số tiền, ngày, mã đơn và các dòng trùng.",
      "So từng dòng với phiếu thu, hóa đơn, dư nợ hoặc đơn hàng mà bạn có quyền xem.",
      "Cộng lại các cột tiền theo từng loại tiền và so với dòng tổng của bảng.",
    ],
    explainerDoesNot: [
      "Không ghi gì vào hệ thống: không tạo phiếu thu, hóa đơn, đơn hàng hay việc.",
      "Chưa đối soát với sao kê ngân hàng — chỉ so với sổ trong phần mềm.",
      "Không lưu tệp gốc; chỉ giữ lưới đã đọc và các phát hiện, tự xóa sau thời hạn lưu.",
    ],
    newButton: "Tải bảng mới",
    emptyList: "Chưa có bản kiểm tra nào trong phạm vi của bạn.",
    filterTemplate: "Loại bảng",
    filterStatus: "Trạng thái",
    filterAll: "Tất cả",
    fileColumn: "Tệp",
    templateColumn: "Loại bảng",
    statusColumn: "Trạng thái",
    createdColumn: "Ngày tải",
    rowsColumn: "Dòng dữ liệu",
    findingsColumn: "Lỗi / cảnh báo",
    creatorColumn: "Người tải",
    openLink: "Mở",
    previous: "← Trước",
    next: "Sau →",
    page: "Trang",
    status: {
      mapping: "Chờ chọn cột",
      checked: "Đã kiểm tra",
    } satisfies Record<SheetCheckStatus, string>,
    template: {
      incomingCash: "Báo cáo tiền về",
      receivables: "Báo cáo công nợ / dư nợ",
      generic: "Danh sách đơn hàng",
    } satisfies Record<SheetCheckTemplate, string>,
    templateHint: {
      incomingCash:
        "Mỗi dòng là một khoản tiền khách chuyển; so với phiếu thu của khách.",
      receivables:
        "Mỗi dòng là một khách, hóa đơn hoặc đơn với dư nợ cuối kỳ; so với công nợ trong hệ thống.",
      generic:
        "Bất kỳ bảng nào có cột mã đơn; so trạng thái, khách và (nếu có quyền) giá bán, hóa đơn.",
    } satisfies Record<SheetCheckTemplate, string>,
    outcome: {
      matched: "Khớp",
      mismatch: "Lệch",
      notFound: "Không thấy",
      notCompared: "Không đối chiếu",
      invalid: "Không đọc được",
      skipped: "Bỏ qua",
    } satisfies Record<RowOutcome, string>,
    severity: {
      error: "Lỗi",
      warn: "Cảnh báo",
      info: "Thông tin",
    } satisfies Record<IssueSeverity, string>,
    kind: {
      data: "Dữ liệu",
      total: "Tổng",
      subtotal: "Tổng phụ",
      group: "Nhóm",
      blank: "Trống",
    } satisfies Record<SheetRowKind, string>,
    confidence: {
      high: "chắc",
      medium: "khá chắc",
      low: "đoán",
    } satisfies Record<MappingConfidence, string>,
    matchStrength: {
      S1_BANK_REF: "theo số chứng từ",
      S2_CUSTOMER_AMOUNT_DATE: "theo khách + số tiền + ngày",
      S3_ALLOCATION_TARGET: "theo đơn/hóa đơn được gắn",
      S4_AMOUNT_DATE: "theo số tiền + ngày",
      S5_FEE_TOLERANCE: "trong dung sai phí ngân hàng",
      S6_SPLIT: "nhiều dòng gộp một phiếu thu",
      S7_MERGED: "một dòng bằng nhiều phiếu thu",
    } satisfies Record<MatchStrength, string>,
    candidateReason: {
      AMOUNT_DIFF: "khác số tiền",
      DATE_DIFF: "khác ngày",
      ALREADY_USED_BY_ROW: "đã khớp với dòng khác",
      CURRENCY_DIFF: "khác loại tiền",
      VOIDED: "đã hủy",
    } satisfies Record<CandidateReason, string>,
    // upload page
    newTitle: "Tải bảng lên",
    newDescription:
      "Chọn loại bảng cho đúng cách đối chiếu, rồi chọn tệp. Bước tiếp theo là xác nhận cột trước khi chạy.",
    templateLabel: "Loại bảng",
    fileLabel: "Tệp (.xlsx, .xls, .csv)",
    sheetLabel: "Sheet (tùy chọn)",
    sheetHint:
      "Số thứ tự (1, 2…) hoặc tên sheet. Bỏ trống để lấy sheet đầu tiên có dữ liệu.",
    upload: "Đọc bảng",
    rulesTitle: "Quy tắc",
    rules: [
      `Tối đa ${maxFileMb} MB, ${sheetCheckLimits.maxRows.toLocaleString("vi-VN")} dòng dữ liệu, ${sheetCheckLimits.maxColumns} cột, ${sheetCheckLimits.maxSheets} sheet.`,
      "Chỉ nhận .xlsx, .xls, .csv; tệp có macro (.xlsm) bị từ chối — mở bằng Excel, Lưu dưới dạng .xlsx.",
      "Công thức chỉ được đọc giá trị đã lưu; tệp không được lưu lại trên máy chủ.",
      "Kiểm tra không ghi gì vào hệ thống và chưa đối soát với sao kê ngân hàng.",
    ],
    // mapping page
    mappingTitle: "Xác nhận cột",
    mappingDescription:
      "Hệ thống đã đoán ý nghĩa từng cột theo tiêu đề và dữ liệu. Sửa lại nếu sai, rồi chạy kiểm tra. Cột không cần đối chiếu chọn «Bỏ qua».",
    fileInfo: "Tệp",
    sheetsInfo: "Sheet",
    sheetRows: "dòng",
    headerRowInfo: "Dòng tiêu đề",
    headerNotFound: "không nhận ra — hãy chọn cột thủ công",
    rowsInfo: "Dòng dữ liệu",
    titleLinesInfo: "Tiêu đề bảng",
    columnHeading: "Cột",
    headerHeading: "Tiêu đề trong tệp",
    samplesHeading: "Ví dụ",
    fieldHeading: "Ý nghĩa",
    noHeader: "(không có tiêu đề)",
    noSamples: "(trống)",
    multiplierLabel: "Đơn vị",
    multiplier: {
      "1": "Đơn vị gốc",
      "1000": "× 1.000",
      "1000000": "× 1.000.000",
    },
    styleLabel: "Kiểu số",
    styleAuto: "Tự nhận",
    styleVi: "1.250.000,50",
    styleEn: "1,250,000.50",
    styleInferred: {
      vi: "nhận dạng: kiểu 1.250.000",
      en: "nhận dạng: kiểu 1,250.00",
      mixed: "lẫn hai kiểu — hãy chọn",
      unknown: "chưa rõ kiểu",
    },
    currencyLabel: "Tiền tệ của cột",
    currencyAuto: "Theo ô / mặc định",
    dateOrderLabel: "Định dạng ngày",
    dateOrderAuto: "Tự nhận",
    dateOrderDmy: "ngày/tháng/năm",
    dateOrderMdy: "tháng/ngày/năm",
    dateInferred: {
      dmy: "nhận dạng: ngày/tháng/năm",
      mdy: "nhận dạng: tháng/ngày/năm",
      conflict: "mâu thuẫn — hãy chọn",
      assumed: "chưa rõ, mặc định ngày/tháng/năm",
    },
    suggestedMultiplier: "tiêu đề gợi ý đơn vị",
    defaultsTitle: "Thiết lập chung",
    defaultCurrencyLabel: "Tiền tệ khi ô không ghi",
    periodFromLabel: "Kỳ báo cáo từ ngày",
    periodToLabel: "đến ngày",
    periodHint:
      "Kỳ dùng để bổ sung năm cho ngày thiếu năm, lọc phiếu thu/hóa đơn và tính dư đầu kỳ. Nhập cả hai hoặc bỏ trống cả hai.",
    compareSellingPriceLabel:
      "So cột số tiền với giá bán của đơn (chỉ khi bạn có quyền xem giá bán)",
    run: "Chạy kiểm tra",
    discard: "Hủy bản nháp",
    discardHint:
      "Bản nháp chưa chạy có thể hủy; kết quả đã chạy chỉ tự xóa theo thời hạn.",
    intakeIssuesTitle: "Ghi nhận khi đọc tệp",
    draftExpires: "Bản nháp tự xóa vào",
    mappingBlocked: "Chưa chạy được vì:",
    // result page
    checkedAt: "Kiểm tra lúc",
    dataAt: "Dữ liệu hệ thống lấy lúc",
    resultExpires: "Kết quả tự xóa vào",
    rerunOf: "Chạy lại từ bản",
    summaryTitle: "Tổng quan",
    dataRows: "Dòng dữ liệu",
    skippedRows: "Dòng bỏ qua",
    errorsCard: "Lỗi",
    warningsCard: "Cảnh báo",
    infosCard: "Thông tin",
    totalsTitle: "Tổng cộng theo cột",
    totalsField: "Trường",
    totalsColumn: "Cột",
    totalsCurrency: "Loại tiền",
    totalsComputed: "Cộng từ các dòng",
    totalsSheet: "Dòng tổng trong bảng",
    totalsSystem: "Hệ thống",
    totalsRows: "Dòng tính / bỏ qua",
    totalsNote:
      "Mỗi loại tiền tính riêng; không có tổng gộp VND với USD. Cột hệ thống chỉ hiện khi bản kiểm tra được phép so tiền.",
    totalsEmpty: "Bảng không có cột tiền nào để cộng.",
    sheetIssuesTitle: "Phát hiện chung",
    sheetIssuesEmpty: "Không có phát hiện chung.",
    systemOnlyTitle: "Có trong hệ thống nhưng không có trong bảng",
    systemOnlyEmpty: "Không có khoản nào trong hệ thống bị thiếu trên bảng.",
    systemOnlyKind: {
      receipt: "Phiếu thu",
      invoice: "Hóa đơn",
      customer: "Khách",
    },
    rowsTitle: "Từng dòng",
    rowsFilterIssues: "Có cảnh báo / lỗi",
    rowsFilterAll: "Tất cả dòng",
    rowsEmpty: "Không có dòng nào trong bộ lọc này.",
    rowNo: "Dòng",
    rowKind: "Loại",
    rowDate: "Ngày",
    rowIdentity: "Đối tượng",
    rowAmount: "Số tiền (bảng)",
    rowOutcome: "Kết quả",
    rowSeverity: "Mức",
    rowDetails: "Chi tiết",
    rowIssuesTitle: "Phát hiện",
    rowNoIssues: "Không có phát hiện.",
    rowCellsTitle: "Ô trong bảng",
    rowHidden: "dòng ẩn",
    systemTitle: "Hệ thống",
    systemOrder: "Đơn",
    systemStage: "Bước",
    systemCustomer: "Khách",
    systemSellingPrice: "Giá bán",
    systemInvoice: "Hóa đơn",
    systemInvoiceAmount: "Giá trị",
    systemInvoicePaid: "Đã gắn",
    systemInvoiceDeposit: "Cọc áp dụng",
    systemInvoiceRemaining: "Còn thiếu",
    systemInvoiceIssued: "Ngày lập",
    systemInvoiceDue: "Hạn",
    systemVoided: "đã hủy",
    systemReceipts: "Phiếu thu khớp",
    systemCandidates: "Phiếu thu gần giống",
    systemAllocations: "gắn vào",
    systemUnallocated: "chưa gắn",
    systemBalance: "Dư nợ",
    systemBalanceInvoiced: "Đã xuất hóa đơn",
    systemBalanceReceived: "Đã thu",
    systemBalanceRefunded: "Đã hoàn",
    systemBalanceOutstanding: "Còn phải thu",
    systemBalanceCredit: "Trả trước",
    systemBalanceBalance: "Cân đối",
    systemBalanceOverdue: "hóa đơn quá hạn",
    systemMatchStrength: "Cách khớp",
    usedByRow: "đã dùng cho dòng",
    exportCsv: "Xuất CSV",
    rerun: "Chạy lại với tệp này",
    rerunHint:
      "Tạo bản kiểm tra mới từ lưới đã đọc (không cần tải lại tệp) để chọn cột khác hoặc so với dữ liệu mới nhất. Kết quả này được giữ nguyên.",
    proposeFollowUps: "Tạo việc theo dõi với trợ lý →",
    followUpPrompt: "Đề xuất việc theo dõi cho kiểm tra",
    requiredPermissions: "Quyền cần có để xem",
    notBankReconciliation:
      "Chưa đối soát với sao kê ngân hàng; chỉ so với sổ trong phần mềm.",
    noWrites: "Kết quả chỉ để xem — không ghi gì vào hệ thống.",
    columnPrefix: "Cột",
    notices: {
      checked: "Đã chạy kiểm tra. Kết quả bên dưới không thay đổi được nữa.",
      discarded: "Đã hủy bản nháp.",
      rerun: "Đã tạo bản kiểm tra mới từ tệp cũ. Xác nhận cột rồi chạy lại.",
    } as Record<string, string>,
    mappingErrors: {
      REQUIRED_COLUMN_MISSING:
        "Thiếu cột bắt buộc cho loại bảng này — hãy chọn đủ ý nghĩa cột bên dưới.",
      MAPPING_CONFLICT:
        "Hai cột đang cùng một ý nghĩa — hãy sửa lại một trong hai.",
      DATE_ORDER_CONFLICT:
        "Cột ngày có cả ngày > 12 ở vị trí đầu và vị trí thứ hai — hãy chọn định dạng ngày cho cột đó.",
    } as Record<string, string>,
    errorLead: "Thao tác không thành công:",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này.",
      NOT_FOUND: "Không tìm thấy bản kiểm tra.",
      INVALID_STATE: "Bản kiểm tra đã chạy; không hủy được nữa.",
      ALREADY_CHECKED: "Bản kiểm tra này đã chạy rồi.",
      REVISION_CONFLICT:
        "Bản kiểm tra đã thay đổi trong lúc bạn thao tác. Trang đã tải lại — kiểm tra rồi thử lại.",
      MAPPING_INVALID: "Cách chọn cột chưa chạy được.",
      INVALID_INPUT: "Dữ liệu nhập chưa hợp lệ.",
      RATE_LIMITED:
        "Bạn tải lên quá nhiều trong 10 phút; đợi một lát rồi thử lại.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
      FILE_TOO_LARGE: `Tệp vượt ${maxFileMb} MB.`,
      FILE_TYPE_REJECTED:
        "Chỉ nhận .xlsx, .xls, .csv; không nhận tệp có macro hoặc tệp đổi đuôi.",
      FILE_MACRO_REJECTED:
        "Tệp chứa macro; mở bằng Excel, Lưu dưới dạng .xlsx rồi tải lại.",
      FILE_ZIP_SUSPICIOUS: "Tệp nén bất thường, bị từ chối.",
      FILE_EMPTY: "Không có sheet nào có dữ liệu.",
      FILE_TOO_MANY_ROWS: `Tối đa ${sheetCheckLimits.maxRows.toLocaleString("vi-VN")} dòng dữ liệu; hãy tách tệp theo tháng.`,
      FILE_PARSE_FAILED: "Không đọc được tệp.",
      ENCODING_UNKNOWN: "Không đọc được bảng mã; lưu lại dạng CSV UTF-8.",
      CSV_MALFORMED: "Tệp CSV có dấu nháy chưa đóng.",
      SHEET_NOT_FOUND: "Không tìm thấy sheet có số thứ tự hoặc tên đã nhập.",
    } as Record<string, string>,
    csvLine: "Dòng",
  },
  en: {
    eyebrow: "Sheet checks",
    back: "← Sheet checks",
    listTitle: "Sheet and receivables checks",
    listDescription:
      "Upload a cash-received report, a receivables statement or an order list (Excel/CSV); the system reads every cell, validates the formats and compares the rows with what the portal holds. The result is read-only: nothing is written back and the file itself is never stored.",
    explainerTitle: "What a check does",
    explainerDoes: [
      "Reads the sheet, recognises the columns, validates amounts, dates, order codes and duplicate rows.",
      "Compares each row with the receipts, invoices, balances or orders you may read.",
      "Sums the money columns per currency and compares them with the sheet's totals row.",
    ],
    explainerDoesNot: [
      "Writes nothing: no receipt, invoice, order or task is created.",
      "Is not a bank reconciliation — it compares with the books in the software only.",
      "Keeps no original file; only the parsed grid and the findings, deleted after the retention period.",
    ],
    newButton: "Upload a sheet",
    emptyList: "No check inside your scope yet.",
    filterTemplate: "Sheet type",
    filterStatus: "Status",
    filterAll: "All",
    fileColumn: "File",
    templateColumn: "Sheet type",
    statusColumn: "Status",
    createdColumn: "Uploaded",
    rowsColumn: "Data rows",
    findingsColumn: "Errors / warnings",
    creatorColumn: "Uploaded by",
    openLink: "Open",
    previous: "← Previous",
    next: "Next →",
    page: "Page",
    status: {
      mapping: "Awaiting column mapping",
      checked: "Checked",
    } satisfies Record<SheetCheckStatus, string>,
    template: {
      incomingCash: "Cash received report",
      receivables: "Receivables statement",
      generic: "Order list",
    } satisfies Record<SheetCheckTemplate, string>,
    templateHint: {
      incomingCash:
        "Each row is a customer payment; compared with the customer's receipts.",
      receivables:
        "Each row is a customer, invoice or order with a closing balance; compared with the receivables in the system.",
      generic:
        "Any sheet with an order-code column; compares stage, customer and (when permitted) selling price and invoices.",
    } satisfies Record<SheetCheckTemplate, string>,
    outcome: {
      matched: "Matched",
      mismatch: "Mismatch",
      notFound: "Not found",
      notCompared: "Not compared",
      invalid: "Unreadable",
      skipped: "Skipped",
    } satisfies Record<RowOutcome, string>,
    severity: {
      error: "Error",
      warn: "Warning",
      info: "Info",
    } satisfies Record<IssueSeverity, string>,
    kind: {
      data: "Data",
      total: "Total",
      subtotal: "Subtotal",
      group: "Group",
      blank: "Blank",
    } satisfies Record<SheetRowKind, string>,
    confidence: {
      high: "confident",
      medium: "likely",
      low: "guess",
    } satisfies Record<MappingConfidence, string>,
    matchStrength: {
      S1_BANK_REF: "by bank reference",
      S2_CUSTOMER_AMOUNT_DATE: "by customer + amount + date",
      S3_ALLOCATION_TARGET: "by allocated order/invoice",
      S4_AMOUNT_DATE: "by amount + date",
      S5_FEE_TOLERANCE: "within bank-fee tolerance",
      S6_SPLIT: "several rows for one receipt",
      S7_MERGED: "one row for several receipts",
    } satisfies Record<MatchStrength, string>,
    candidateReason: {
      AMOUNT_DIFF: "amount differs",
      DATE_DIFF: "date differs",
      ALREADY_USED_BY_ROW: "already matched to another row",
      CURRENCY_DIFF: "currency differs",
      VOIDED: "voided",
    } satisfies Record<CandidateReason, string>,
    newTitle: "Upload a sheet",
    newDescription:
      "Pick the sheet type so the right comparison runs, then choose the file. The next step confirms the columns before the run.",
    templateLabel: "Sheet type",
    fileLabel: "File (.xlsx, .xls, .csv)",
    sheetLabel: "Sheet (optional)",
    sheetHint:
      "A 1-based position or the sheet name. Leave empty for the first sheet with data.",
    upload: "Read the sheet",
    rulesTitle: "Rules",
    rules: [
      `At most ${maxFileMb} MB, ${sheetCheckLimits.maxRows.toLocaleString("en-US")} data rows, ${sheetCheckLimits.maxColumns} columns, ${sheetCheckLimits.maxSheets} sheets.`,
      "Only .xlsx, .xls, .csv; macro files (.xlsm) are refused — open in Excel and save as .xlsx.",
      "Formulas are read as their saved values; the file is never kept on the server.",
      "A check writes nothing to the system and is not a bank reconciliation.",
    ],
    mappingTitle: "Confirm the columns",
    mappingDescription:
      "The system guessed what each column means from its header and values. Correct anything wrong, then run the check. Columns that need no comparison get “Ignore”.",
    fileInfo: "File",
    sheetsInfo: "Sheets",
    sheetRows: "rows",
    headerRowInfo: "Header row",
    headerNotFound: "not recognised — map the columns by hand",
    rowsInfo: "Data rows",
    titleLinesInfo: "Sheet title",
    columnHeading: "Column",
    headerHeading: "Header in the file",
    samplesHeading: "Samples",
    fieldHeading: "Meaning",
    noHeader: "(no header)",
    noSamples: "(empty)",
    multiplierLabel: "Unit",
    multiplier: {
      "1": "As written",
      "1000": "× 1,000",
      "1000000": "× 1,000,000",
    },
    styleLabel: "Number style",
    styleAuto: "Detect",
    styleVi: "1.250.000,50",
    styleEn: "1,250,000.50",
    styleInferred: {
      vi: "detected: 1.250.000 style",
      en: "detected: 1,250.00 style",
      mixed: "both styles present — choose one",
      unknown: "style unclear",
    },
    currencyLabel: "Column currency",
    currencyAuto: "From the cell / default",
    dateOrderLabel: "Date format",
    dateOrderAuto: "Detect",
    dateOrderDmy: "day/month/year",
    dateOrderMdy: "month/day/year",
    dateInferred: {
      dmy: "detected: day/month/year",
      mdy: "detected: month/day/year",
      conflict: "conflicting — choose one",
      assumed: "unclear, day/month/year assumed",
    },
    suggestedMultiplier: "header suggests a unit",
    defaultsTitle: "General settings",
    defaultCurrencyLabel: "Currency when a cell names none",
    periodFromLabel: "Report period from",
    periodToLabel: "to",
    periodHint:
      "The period completes dates without a year, filters receipts/invoices and sets the opening balance. Enter both dates or neither.",
    compareSellingPriceLabel:
      "Compare the amount column with the order selling price (only with the selling-price permission)",
    run: "Run the check",
    discard: "Discard draft",
    discardHint:
      "A draft that has not run can be discarded; a checked result only expires by itself.",
    intakeIssuesTitle: "Noted while reading the file",
    draftExpires: "Draft expires on",
    mappingBlocked: "The run is blocked by:",
    checkedAt: "Checked at",
    dataAt: "System data read at",
    resultExpires: "Result expires on",
    rerunOf: "Re-run of",
    summaryTitle: "Summary",
    dataRows: "Data rows",
    skippedRows: "Skipped rows",
    errorsCard: "Errors",
    warningsCard: "Warnings",
    infosCard: "Info",
    totalsTitle: "Column totals",
    totalsField: "Field",
    totalsColumn: "Column",
    totalsCurrency: "Currency",
    totalsComputed: "Sum of the rows",
    totalsSheet: "Totals row in the sheet",
    totalsSystem: "System",
    totalsRows: "Rows counted / skipped",
    totalsNote:
      "Each currency is summed on its own; there is no combined VND + USD figure. The system column appears only when the check may compare money.",
    totalsEmpty: "The sheet has no money column to sum.",
    sheetIssuesTitle: "Sheet-level findings",
    sheetIssuesEmpty: "No sheet-level finding.",
    systemOnlyTitle: "In the system but absent from the sheet",
    systemOnlyEmpty: "Nothing in the system is missing from the sheet.",
    systemOnlyKind: {
      receipt: "Receipt",
      invoice: "Invoice",
      customer: "Customer",
    },
    rowsTitle: "Rows",
    rowsFilterIssues: "With warnings / errors",
    rowsFilterAll: "All rows",
    rowsEmpty: "No row matches this filter.",
    rowNo: "Row",
    rowKind: "Kind",
    rowDate: "Date",
    rowIdentity: "Subject",
    rowAmount: "Amount (sheet)",
    rowOutcome: "Outcome",
    rowSeverity: "Level",
    rowDetails: "Details",
    rowIssuesTitle: "Findings",
    rowNoIssues: "No finding.",
    rowCellsTitle: "Cells in the sheet",
    rowHidden: "hidden row",
    systemTitle: "System",
    systemOrder: "Order",
    systemStage: "Stage",
    systemCustomer: "Customer",
    systemSellingPrice: "Selling price",
    systemInvoice: "Invoice",
    systemInvoiceAmount: "Amount",
    systemInvoicePaid: "Allocated",
    systemInvoiceDeposit: "Deposit applied",
    systemInvoiceRemaining: "Remaining",
    systemInvoiceIssued: "Issued",
    systemInvoiceDue: "Due",
    systemVoided: "voided",
    systemReceipts: "Matched receipts",
    systemCandidates: "Similar receipts",
    systemAllocations: "allocated to",
    systemUnallocated: "unallocated",
    systemBalance: "Balance",
    systemBalanceInvoiced: "Invoiced",
    systemBalanceReceived: "Received",
    systemBalanceRefunded: "Refunded",
    systemBalanceOutstanding: "Outstanding",
    systemBalanceCredit: "Advance",
    systemBalanceBalance: "Balance",
    systemBalanceOverdue: "overdue invoices",
    systemMatchStrength: "Matched",
    usedByRow: "used by row",
    exportCsv: "Export CSV",
    rerun: "Re-run with this file",
    rerunHint:
      "Creates a new check from the parsed grid (no new upload) to map the columns differently or compare with the latest data. This result stays as it is.",
    proposeFollowUps: "Draft follow-up tasks with the assistant →",
    followUpPrompt: "Propose follow-up tasks for check",
    requiredPermissions: "Permissions needed to read",
    notBankReconciliation:
      "Not a bank reconciliation; compared with the books in the software only.",
    noWrites: "Read-only result — nothing was written to the system.",
    columnPrefix: "Column",
    notices: {
      checked: "The check ran. The result below can no longer change.",
      discarded: "Draft discarded.",
      rerun:
        "A new check was created from the same file. Confirm the columns and run it.",
    } as Record<string, string>,
    mappingErrors: {
      REQUIRED_COLUMN_MISSING:
        "A column this template needs is not mapped — set the missing meaning below.",
      MAPPING_CONFLICT:
        "Two columns carry the same meaning — change one of them.",
      DATE_ORDER_CONFLICT:
        "The date column has a day > 12 in both positions — choose its date format.",
    } as Record<string, string>,
    errorLead: "The action failed:",
    errors: {
      FORBIDDEN: "You are not permitted to perform this action.",
      PERMISSION_DENIED: "You are not permitted to perform this action.",
      NOT_FOUND: "The check was not found.",
      INVALID_STATE: "The check already ran; it can no longer be discarded.",
      ALREADY_CHECKED: "This check already ran.",
      REVISION_CONFLICT:
        "The check changed while you were acting. The page has reloaded — review and retry.",
      MAPPING_INVALID: "The column mapping cannot run.",
      INVALID_INPUT: "The submitted data is not valid.",
      RATE_LIMITED: "Too many uploads in 10 minutes; wait a moment and retry.",
      UNAVAILABLE: "The system is temporarily unavailable.",
      FILE_TOO_LARGE: `The file exceeds ${maxFileMb} MB.`,
      FILE_TYPE_REJECTED:
        "Only .xlsx, .xls and .csv are accepted; macro files and renamed files are refused.",
      FILE_MACRO_REJECTED:
        "The file contains macros; open it in Excel, save as .xlsx and upload again.",
      FILE_ZIP_SUSPICIOUS: "The container looks abnormal and was refused.",
      FILE_EMPTY: "No sheet holds any data.",
      FILE_TOO_MANY_ROWS: `At most ${sheetCheckLimits.maxRows.toLocaleString("en-US")} data rows; split the file by month.`,
      FILE_PARSE_FAILED: "The file could not be read.",
      ENCODING_UNKNOWN: "Unknown text encoding; save as CSV UTF-8.",
      CSV_MALFORMED: "The CSV has an unterminated quote.",
      SHEET_NOT_FOUND: "No sheet has the given position or name.",
    } as Record<string, string>,
    csvLine: "Line",
  },
} as const;

export type CheckCopy = (typeof checkCopy)[AdminLocale];

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

export const cardClass =
  "border-burgundy/15 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
export const buttonClass =
  "bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:opacity-50";
export const ghostButtonClass =
  "text-burgundy border-burgundy/30 hover:bg-ivory/70 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold";
export const dangerButtonClass =
  "text-lacquer border-lacquer/30 hover:bg-lacquer/5 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold";
export const fieldClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none";
export const labelClass = "text-charcoal/60 mb-1 block text-xs";
export const tableWrapClass =
  "border-burgundy/15 overflow-x-auto rounded-2xl border bg-white shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]";
export const theadClass =
  "border-burgundy/12 text-charcoal/60 border-b text-xs tracking-[0.12em] uppercase";
export const thClass = "px-4 py-3 font-semibold";
export const tdClass = "px-4 py-3 align-top";

/* ------------------------------------------------------------------ */
/* Routing and permissions                                             */
/* ------------------------------------------------------------------ */

export function checksHref(locale: AdminLocale, path = "", query = ""): Route {
  return `/${locale}/admin/checks${path}${query ? `?${query}` : ""}` as Route;
}

type GateCoverages = Partial<
  Record<
    "payments.read" | "receivables.read" | "invoices.read" | "orders.read",
    PermissionCoverage
  >
>;

/**
 * Whether a template's gate passes for a reader's coverage: money templates
 * need every gate permission globally (they read every customer's money);
 * the order list needs `orders.read` at any scope.
 */
export function templateAllowed(
  template: SheetCheckTemplate,
  coverages: GateCoverages,
): boolean {
  const gates = templateGates[template];
  if (template === "generic") {
    const coverage = coverages["orders.read"];
    return Boolean(
      coverage && (coverage.global || coverage.businessUnitIds.length > 0),
    );
  }
  return gates.every((permission) => {
    const coverage = coverages[permission as keyof GateCoverages];
    return Boolean(coverage?.global);
  });
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** Business day plus local wall-clock time, e.g. "2026-09-06 09:15". */
export function formatBusinessMoment(instant: Date, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return `${formatBusinessDay(instant, timeZone)} ${time}`;
}

/** Display of a decimal string at the currency scale (totals lines). */
export function formatAmount(
  amount: string,
  currency: Currency,
  locale: AdminLocale,
): string {
  return formatMoney({ amount, currency }, locale);
}

export function formatMoneyValue(value: Money, locale: AdminLocale): string {
  return formatMoney(value, locale);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Header text of a column as the proposal saw it, else its letter. */
export function columnHeader(
  check: SheetCheckDto,
  columnIndex: number,
): string {
  const header = check.proposal.columns.find(
    (column) => column.columnIndex === columnIndex,
  )?.header;
  return header && header.length > 0 ? header : columnLabel(columnIndex);
}

export function mappedColumnIndex(
  mapping: SheetMapping,
  field: CanonicalField,
): number | null {
  const column = mapping.columns.find((entry) => entry.field === field);
  return column ? column.columnIndex : null;
}

/** The columns the rows table shows beside the outcome: date, who/what, and the template's money figure. */
export function keyColumns(check: SheetCheckDto): {
  date: number | null;
  identity: readonly number[];
  amount: number | null;
} {
  const mapping = check.mapping;
  const moneyField: CanonicalField =
    check.template === "receivables" ? "outstanding" : "amount";
  return {
    date: mappedColumnIndex(mapping, "date"),
    identity: identityFields
      .map((field) => mappedColumnIndex(mapping, field))
      .filter((index): index is number => index !== null),
    amount: mappedColumnIndex(mapping, moneyField),
  };
}

export function cellText(row: SheetRowDto, columnIndex: number | null): string {
  if (columnIndex === null) return "";
  return row.cells[columnIndex]?.text ?? "";
}

/** `?issues=CODE1,CODE2` from a MAPPING_INVALID redirect: only catalogue codes survive. */
export function issueCodesFromQuery(value: string | undefined): IssueCode[] {
  if (!value) return [];
  return value
    .split(",")
    .map((code) => code.trim())
    .filter((code): code is IssueCode => Object.hasOwn(issueCatalog, code));
}

/* ------------------------------------------------------------------ */
/* The mapping form → service input                                    */
/* ------------------------------------------------------------------ */

function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Reads the mapping page's fields into the shape `sheetMappingInputSchema`
 * validates. Columns are read by index up to the column cap — any index
 * the check does not have is dropped by the service — so the form needs
 * no client script; blanks mean "let the run decide". A period is passed
 * on whenever either bound is typed, so a lone bound fails validation
 * instead of silently vanishing.
 */
export function readMappingForm(formData: FormData): {
  columns: {
    columnIndex: number;
    field: string;
    unitMultiplier: string;
    numberStyle: string | null;
    fixedCurrency: string | null;
    dateOrder: string | null;
  }[];
  defaultCurrency: string;
  period: { from: string; to: string } | null;
  compareSellingPrice: boolean;
} {
  const columns = [];
  for (let index = 0; index < sheetCheckLimits.maxColumns; index += 1) {
    const field = formData.get(`field.${index}`);
    if (typeof field !== "string") continue;
    columns.push({
      columnIndex: index,
      field: field.trim(),
      unitMultiplier: formText(formData, `multiplier.${index}`) || "1",
      numberStyle: formText(formData, `style.${index}`) || null,
      fixedCurrency: formText(formData, `currency.${index}`) || null,
      dateOrder: formText(formData, `dateOrder.${index}`) || null,
    });
  }
  const from = formText(formData, "periodFrom");
  const to = formText(formData, "periodTo");
  const compare = formData.get("compareSellingPrice");
  return {
    columns,
    defaultCurrency: formText(formData, "defaultCurrency") || "VND",
    period: from || to ? { from, to } : null,
    compareSellingPrice: compare === "on" || compare === "true",
  };
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

export function BackLink({ locale }: { locale: AdminLocale }) {
  return (
    <Link
      href={checksHref(locale)}
      className="text-charcoal/55 hover:text-burgundy text-sm"
    >
      {checkCopy[locale].back}
    </Link>
  );
}

export function CheckBanner({
  locale,
  error,
  notice,
  issueCodes = [],
  csvLine,
}: {
  locale: AdminLocale;
  error?: string | undefined;
  notice?: string | undefined;
  issueCodes?: readonly IssueCode[];
  csvLine?: string | undefined;
}) {
  const text = checkCopy[locale];
  if (error) {
    const line =
      error === "CSV_MALFORMED" && csvLine && /^\d{1,7}$/.test(csvLine)
        ? ` ${text.csvLine} ${csvLine}.`
        : "";
    return (
      <div className="border-lacquer/40 bg-lacquer/5 text-lacquer mt-8 max-w-3xl rounded-2xl border px-5 py-4 text-sm">
        <p>
          {text.errorLead}{" "}
          {copyFor(text.errors, error) ?? text.errors.UNAVAILABLE}
          {line}
        </p>
        {issueCodes.length > 0 ? (
          <>
            <p className="mt-2 font-semibold">{text.mappingBlocked}</p>
            <ul className="mt-1 list-disc pl-5">
              {issueCodes.map((code) => (
                <li key={code}>
                  {/* The blocking issue travels as a bare code, so the page
                      names the fix rather than a template with empty slots. */}
                  {copyFor(text.mappingErrors, code) ??
                    renderIssue(
                      {
                        code,
                        severity: "error",
                        columnIndex: null,
                        params: {},
                      },
                      locale,
                    )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  }
  const noticeText = copyFor(text.notices, notice);
  if (noticeText) {
    return (
      <p className="mt-8 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
        {noticeText}
      </p>
    );
  }
  return null;
}

const badgeBase =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function StatusBadge({
  status,
  locale,
}: {
  status: SheetCheckStatus;
  locale: AdminLocale;
}) {
  const text = checkCopy[locale];
  return (
    <span
      className={
        status === "checked"
          ? `${badgeBase} bg-emerald-50 text-emerald-800`
          : `${badgeBase} bg-gold/15 text-gold-ink`
      }
    >
      {text.status[status]}
    </span>
  );
}

const outcomeClass: Record<RowOutcome, string> = {
  matched: "bg-emerald-50 text-emerald-800",
  mismatch: "bg-lacquer/10 text-lacquer",
  notFound: "bg-lacquer/10 text-lacquer",
  notCompared: "bg-charcoal/6 text-charcoal/60",
  invalid: "bg-gold/15 text-gold-ink",
  skipped: "bg-charcoal/6 text-charcoal/45",
};

export function OutcomeBadge({
  outcome,
  locale,
}: {
  outcome: RowOutcome;
  locale: AdminLocale;
}) {
  return (
    <span className={`${badgeBase} ${outcomeClass[outcome]}`}>
      {checkCopy[locale].outcome[outcome]}
    </span>
  );
}

const severityClass: Record<IssueSeverity, string> = {
  error: "bg-lacquer/10 text-lacquer",
  warn: "bg-gold/15 text-gold-ink",
  info: "bg-charcoal/6 text-charcoal/60",
};

export function SeverityBadge({
  severity,
  locale,
}: {
  severity: IssueSeverity | null;
  locale: AdminLocale;
}) {
  if (!severity) return <span className="text-charcoal/35">—</span>;
  return (
    <span className={`${badgeBase} ${severityClass[severity]}`}>
      {checkCopy[locale].severity[severity]}
    </span>
  );
}

/** One finding as a sentence with its severity and, when column-bound, the column. */
export function IssueList({
  issues,
  locale,
  check,
  emptyText,
}: {
  issues: readonly Issue[];
  locale: AdminLocale;
  check?: SheetCheckDto;
  emptyText?: string;
}) {
  if (issues.length === 0) {
    return emptyText ? (
      <p className="text-charcoal/55 text-sm">{emptyText}</p>
    ) : null;
  }
  const text = checkCopy[locale];
  return (
    <ul className="grid gap-1.5 text-sm">
      {issues.map((entry, index) => (
        <li
          key={`${entry.code}-${index}`}
          className="flex flex-wrap items-start gap-2"
        >
          <SeverityBadge severity={entry.severity} locale={locale} />
          <span className="text-charcoal/80 min-w-0">
            {entry.columnIndex !== null ? (
              <span className="text-charcoal/50 mr-1 font-mono text-xs">
                {text.columnPrefix} {columnLabel(entry.columnIndex)}
                {check ? ` · ${columnHeader(check, entry.columnIndex)}` : ""}
              </span>
            ) : null}
            {renderIssue(entry, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="mr-3 inline-block">
      <span className="text-charcoal/50">{label}:</span>{" "}
      <span className="font-mono">{value}</span>
    </span>
  );
}

/**
 * What the system held for a row. Only the keys the run stored are
 * rendered: a restricted run never stored money, so none is shown.
 */
export function SystemViewBlock({
  system,
  locale,
}: {
  system: RowSystemView;
  locale: AdminLocale;
}) {
  const text = checkCopy[locale];
  const sections: ReactNode[] = [];

  if (system.order) {
    const order = system.order;
    sections.push(
      <p key="order">
        <span className="font-semibold">{text.systemOrder}</span>{" "}
        <span className="font-mono">{order.orderCode}</span> ·{" "}
        {text.systemStage} {orderStageDefinitions[order.stage].step}:{" "}
        {orderStageDefinitions[order.stage].labels[locale]} ·{" "}
        {text.systemCustomer} {order.customerName}
        {order.sellingPrice ? (
          <>
            {" "}
            · {text.systemSellingPrice}{" "}
            <span className="font-mono">
              {formatMoney(order.sellingPrice, locale)}
            </span>
          </>
        ) : null}
      </p>,
    );
  }

  if (system.customer) {
    sections.push(
      <p key="customer">
        <span className="font-semibold">{text.systemCustomer}</span>{" "}
        {system.customer.name}
        {system.customer.code ? (
          <span className="text-charcoal/50 ml-1 font-mono text-xs">
            {system.customer.code}
          </span>
        ) : null}
      </p>,
    );
  }

  if (system.invoice) {
    const invoice = system.invoice;
    sections.push(
      <p key="invoice">
        <span className="font-semibold">{text.systemInvoice}</span>{" "}
        <span className="font-mono">{invoice.invoiceNumber}</span>
        {invoice.status === "voided" ? (
          <span className="text-lacquer ml-1">
            ({text.systemVoided}
            {invoice.voidReason ? `: ${invoice.voidReason}` : ""})
          </span>
        ) : null}{" "}
        · {text.systemOrder}{" "}
        <span className="font-mono">{invoice.orderCode}</span> ·{" "}
        {text.systemCustomer} {invoice.customerName}
        <span className="mt-1 block">
          <Figure
            label={text.systemInvoiceAmount}
            value={formatMoney(invoice.amount, locale)}
          />
          <Figure
            label={text.systemInvoicePaid}
            value={formatMoney(invoice.paid, locale)}
          />
          <Figure
            label={text.systemInvoiceDeposit}
            value={formatMoney(invoice.depositApplied, locale)}
          />
          <Figure
            label={text.systemInvoiceRemaining}
            value={formatMoney(invoice.remaining, locale)}
          />
          <Figure label={text.systemInvoiceIssued} value={invoice.issuedDay} />
          <Figure label={text.systemInvoiceDue} value={invoice.dueDay} />
        </span>
      </p>,
    );
  }

  if (system.receipts && system.receipts.length > 0) {
    sections.push(
      <div key="receipts">
        <p className="font-semibold">
          {text.systemReceipts}
          {system.matchStrength ? (
            <span className="text-charcoal/50 ml-2 text-xs font-normal">
              {text.systemMatchStrength}:{" "}
              {text.matchStrength[system.matchStrength]}
            </span>
          ) : null}
        </p>
        <ul className="mt-1 grid gap-1">
          {system.receipts.map((receipt) => (
            <li key={receipt.id}>
              <span className="font-mono">{receipt.occurredDay}</span> ·{" "}
              <span className="font-mono">
                {formatMoney(receipt.amount, locale)}
              </span>{" "}
              · {receipt.counterparty} · {receipt.method}
              {receipt.status === "voided" ? (
                <span className="text-lacquer ml-1">
                  ({text.systemVoided}
                  {receipt.voidReason ? `: ${receipt.voidReason}` : ""})
                </span>
              ) : null}
              <span className="text-charcoal/50 ml-1 text-xs">
                {receipt.allocations.length > 0
                  ? `${text.systemAllocations} ${receipt.allocations.join(", ")}`
                  : text.systemUnallocated}
              </span>
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  if (system.candidates && system.candidates.length > 0) {
    sections.push(
      <div key="candidates">
        <p className="font-semibold">{text.systemCandidates}</p>
        <ul className="mt-1 grid gap-1">
          {system.candidates.map((candidate) => (
            <li key={candidate.id}>
              <span className="font-mono">{candidate.occurredDay}</span> ·{" "}
              <span className="font-mono">
                {formatMoney(candidate.amount, locale)}
              </span>{" "}
              · {text.candidateReason[candidate.why]}
              {candidate.usedByRowIndex !== null
                ? ` (${text.usedByRow} #${candidate.usedByRowIndex + 1})`
                : ""}
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  if (system.balance) {
    const balance = system.balance;
    sections.push(
      <p key="balance">
        <span className="font-semibold">{text.systemBalance}</span>{" "}
        {balance.customerName}{" "}
        <span className="text-charcoal/50 font-mono text-xs">
          {balance.currency}
        </span>
        <span className="mt-1 block">
          <Figure
            label={text.systemBalanceInvoiced}
            value={formatMoney(balance.invoiced, locale)}
          />
          <Figure
            label={text.systemBalanceReceived}
            value={formatMoney(balance.received, locale)}
          />
          <Figure
            label={text.systemBalanceRefunded}
            value={formatMoney(balance.refunded, locale)}
          />
          <Figure
            label={text.systemBalanceOutstanding}
            value={formatMoney(balance.outstanding, locale)}
          />
          <Figure
            label={text.systemBalanceCredit}
            value={formatMoney(balance.credit, locale)}
          />
          <Figure
            label={text.systemBalanceBalance}
            value={formatMoney(balance.balance, locale)}
          />
          {balance.overdueInvoiceCount > 0 ? (
            <span className="text-lacquer">
              {balance.overdueInvoiceCount} {text.systemBalanceOverdue}
            </span>
          ) : null}
        </span>
      </p>,
    );
  }

  if (sections.length === 0) return null;
  return (
    <div className="border-burgundy/10 mt-3 grid gap-2 border-t pt-3 text-sm">
      <p className="text-charcoal/60 text-xs font-semibold tracking-[0.12em] uppercase">
        {text.systemTitle}
      </p>
      {sections}
    </div>
  );
}

/** The field label a select shows; every canonical field is offered on every column. */
export function fieldLabel(field: CanonicalField, locale: AdminLocale): string {
  return fieldLabels[field][locale];
}
