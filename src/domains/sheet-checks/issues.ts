/**
 * The issue catalogue of the spreadsheet check.
 *
 * A check never stores prose: every finding is a code plus parameters, and
 * the sentence is rendered from this table when it is read, in the reader's
 * language. Cell text reaches a sentence only as a parameter, never as a
 * template, so nothing typed into a sheet can become an instruction or
 * markup. Severity defaults live here too; a template may override it
 * through the `issue()` factory (e.g. AMOUNT_ZERO is a warning for incoming
 * cash and information elsewhere).
 */

export type IssueSeverity = "error" | "warn" | "info";

type Definition = { severity: IssueSeverity; vi: string; en: string };

function def(severity: IssueSeverity, vi: string, en: string): Definition {
  return { severity, vi, en };
}

export const issueCatalog = {
  /* ---- mapping (block the run) ---- */
  REQUIRED_COLUMN_MISSING: def(
    "error",
    "Thiếu cột bắt buộc: {fields}",
    "Required column missing: {fields}",
  ),
  MAPPING_CONFLICT: def(
    "error",
    "Cột {a} và cột {b} cùng chọn trường {field}",
    "Columns {a} and {b} both map to {field}",
  ),
  DATE_ORDER_CONFLICT: def(
    "error",
    "Cột {header} vừa có ngày > 12 ở vị trí đầu vừa ở vị trí thứ hai; hãy chọn định dạng ngày",
    "Column {header} has a day > 12 in both positions; choose the date format",
  ),

  /* ---- sheet level ---- */
  HEADER_NOT_FOUND: def(
    "warn",
    "Không nhận ra dòng tiêu đề; đang dùng dòng {n}, hãy chọn cột thủ công",
    "Header row not recognised; using row {n}, map the columns by hand",
  ),
  ENCODING_FALLBACK: def(
    "info",
    "Tệp không phải UTF-8; đã đọc theo Windows-1258, kiểm tra dấu tiếng Việt",
    "File is not UTF-8; read as Windows-1258, check the Vietnamese diacritics",
  ),
  ENCODING_LOSSY: def(
    "warn",
    "Một số ký tự không đọc được (�)",
    "Some characters could not be decoded (�)",
  ),
  COLUMNS_IGNORED: def(
    "info",
    "{n} cột sau cột {max} bị bỏ qua",
    "{n} columns after column {max} were ignored",
  ),
  SHEETS_IGNORED: def(
    "info",
    "Chỉ đọc {max} sheet đầu; {n} sheet bị bỏ qua",
    "Only the first {max} sheets were read; {n} ignored",
  ),
  HIDDEN_ROWS: def(
    "info",
    "{n} dòng bị ẩn trong tệp vẫn được tính",
    "{n} hidden rows in the file are still counted",
  ),
  HIDDEN_COLUMNS: def(
    "info",
    "{n} cột bị ẩn trong tệp vẫn được đọc",
    "{n} hidden columns in the file are still read",
  ),
  TRAILING_CONTENT_IGNORED: def(
    "info",
    "Nội dung sau {n} dòng trống bị bỏ qua",
    "Content after {n} blank rows was ignored",
  ),
  GROUP_ROWS_SKIPPED: def(
    "info",
    "{n} dòng nhóm/tổng phụ không đối chiếu",
    "{n} group/subtotal rows were not reconciled",
  ),
  COLUMN_STYLE_MIXED: def(
    "warn",
    "Cột {header} dùng cả kiểu 1.250.000 và 1,250.00",
    "Column {header} mixes the 1.250.000 and 1,250.00 styles",
  ),
  UNIT_MULTIPLIER_APPLIED: def(
    "info",
    "Cột {header} nhân {multiplier} theo đơn vị đã xác nhận",
    "Column {header} multiplied by {multiplier} per the confirmed unit",
  ),
  CURRENCY_DEFAULTED: def(
    "info",
    "Cột {header} không ghi loại tiền; dùng {currency}",
    "Column {header} names no currency; {currency} assumed",
  ),
  CURRENCY_MIXED_COLUMN: def(
    "info",
    "Cột {header} có cả VND và USD; tổng tính riêng từng loại",
    "Column {header} holds both VND and USD; totals are kept apart",
  ),
  DATE_ORDER_ASSUMED: def(
    "info",
    "Không phân biệt được ngày/tháng trong cột {header}; đang đọc theo ngày/tháng/năm",
    "Day and month are indistinguishable in column {header}; reading as day/month/year",
  ),
  DATE_ORDER_MDY: def(
    "warn",
    "Cột {header} đang đọc theo tháng/ngày/năm vì có ngày > 12 ở vị trí thứ hai",
    "Column {header} is read as month/day/year because a day > 12 sits in the second position",
  ),
  TOTAL_MATCH: def(
    "info",
    "Dòng tổng {field} ({currency}) khớp: {total}",
    "Totals row for {field} ({currency}) matches: {total}",
  ),
  TOTAL_MISMATCH: def(
    "error",
    "Dòng tổng ghi {sheetTotal}, cộng {n} dòng được {computed}; lệch {diff}. {skipped} dòng không đọc được số đã bỏ qua; {hidden} dòng ẩn được tính",
    "Totals row says {sheetTotal}, {n} rows add up to {computed}; difference {diff}. {skipped} unreadable rows skipped; {hidden} hidden rows counted",
  ),
  TOTAL_MIXED_CURRENCY: def(
    "error",
    "Dòng tổng chỉ có một số nhưng cột có cả VND và USD; không so tổng",
    "The totals row has one figure but the column mixes VND and USD; totals not compared",
  ),
  TOTAL_NOT_CACHED: def(
    "warn",
    "Ô tổng là công thức chưa lưu giá trị",
    "The totals cell is a formula without a saved value",
  ),
  TOTAL_ABSENT: def(
    "info",
    "Tệp không có dòng tổng; chỉ hiện tổng cộng từ các dòng",
    "No totals row in the file; only the sum of the rows is shown",
  ),
  SUBTOTAL_MISMATCH: def(
    "warn",
    "Dòng «{label}» ghi {sheet}, cộng các dòng phía trên được {computed}",
    "Row «{label}» says {sheet}; the rows above add up to {computed}",
  ),
  PERIOD_TOTAL_MISMATCH: def(
    "warn",
    "Tổng tiền về trong kỳ theo bảng {sheet}, theo hệ thống {system}; lệch {diff}. Trong đó {x} dòng chưa có phiếu thu ({a}), {y} phiếu thu không có trong bảng ({b}), phần còn lại {residual} là chênh lệch số tiền ở các dòng đã khớp",
    "Cash received in the period: sheet {sheet}, system {system}; difference {diff}. Of that, {x} rows have no receipt ({a}), {y} receipts are absent from the sheet ({b}), and the remaining {residual} is the amount difference on matched rows",
  ),
  RECEIVABLES_TOTAL_MISMATCH: def(
    "warn",
    "Tổng dư nợ {currency} theo bảng {sheet}, hệ thống {system}; chỉ trên bảng {onlySheet}, chỉ trong hệ thống {onlySystem}, lệch từng khách {differing}",
    "Total {currency} receivables: sheet {sheet}, system {system}; sheet-only {onlySheet}, system-only {onlySystem}, per-customer differences {differing}",
  ),
  SYSTEM_DATA_TRUNCATED: def(
    "warn",
    "Chỉ nạp được {limit} bản ghi {kind} mới nhất từ hệ thống nên đối chiếu có thể thiếu; hãy thu hẹp kỳ báo cáo rồi chạy lại",
    "Only the {limit} most recent {kind} records were loaded, so the comparison may be incomplete; narrow the period and run again",
  ),
  AMOUNT_COMPARE_DISABLED: def(
    "info",
    "Cột số tiền chỉ được kiểm tra định dạng và cộng dồn; chưa bật tùy chọn so với giá bán của đơn",
    "The amount column was only checked for format and summed; comparing it with the order's selling price is switched off",
  ),
  SYSTEM_DUPLICATE_SUSPECT: def(
    "info",
    "Hệ thống có 2 phiếu thu giống nhau ngày {d}: {refs}",
    "The system holds two identical receipts on {d}: {refs}",
  ),
  AMOUNT_NOT_COMPARED: def(
    "info",
    "Cột số tiền chỉ được kiểm tra định dạng và cộng dồn; không đối chiếu với hệ thống vì tài khoản của bạn không có quyền xem giá bán/hóa đơn/tiền khách trả",
    "The amount column was only checked for format and summed; it was not compared with the system because your account may not read selling prices, invoices or customer payments",
  ),
  INVOICE_NOT_COMPARED: def(
    "info",
    "Cột hóa đơn không được đối chiếu: không có quyền xem hóa đơn",
    "The invoice column was not compared: no permission to read invoices",
  ),
  CUSTOMER_NOT_COMPARED: def(
    "info",
    "Tên khách chỉ so với tên trên đơn hàng; không tra danh sách khách hàng",
    "Customer names were compared with the order only; the customer list was not consulted",
  ),

  /* ---- row: parse / format ---- */
  REQUIRED_EMPTY: def("error", "Thiếu {field}", "Missing {field}"),
  CELL_TRUNCATED: def(
    "info",
    "Ô dài quá {max} ký tự, đã cắt",
    "Cell longer than {max} characters was cut",
  ),
  CELL_ERROR_VALUE: def(
    "error",
    "Ô báo lỗi Excel (#REF!, #N/A…)",
    "Excel error cell (#REF!, #N/A…)",
  ),
  FORMULA_NO_CACHE: def(
    "error",
    "Ô có công thức nhưng tệp không lưu giá trị; mở bằng Excel, lưu lại rồi tải lên",
    "Formula without a saved value; open in Excel, save, upload again",
  ),
  HIDDEN_ROW: def("info", "Dòng bị ẩn trong tệp", "Row is hidden in the file"),
  MERGED_FILL: def(
    "info",
    "Giá trị {field} lấy từ ô gộp phía trên",
    "{field} taken from the merged cell above",
  ),
  CELL_LOW_CONFIDENCE: def(
    "info",
    "Giá trị đọc từ ảnh với độ tin cậy thấp, chưa được sửa",
    "Value read from a photo with low confidence, not corrected",
  ),
  AMOUNT_NOT_NUMBER: def(
    "error",
    "Không đọc được số tiền «{raw}»",
    "Cannot read the amount «{raw}»",
  ),
  AMOUNT_AMBIGUOUS: def(
    "warn",
    "«{raw}» có thể là {asThousands} hoặc {asDecimal}; đang hiểu là {asThousands}",
    "«{raw}» may be {asThousands} or {asDecimal}; read as {asThousands}",
  ),
  AMOUNT_SCALE: def(
    "error",
    "VND không có phần lẻ / USD tối đa 2 số lẻ: «{raw}»",
    "VND has no decimals / USD at most 2: «{raw}»",
  ),
  AMOUNT_HIDDEN_DECIMALS: def(
    "warn",
    "Ô hiển thị {used} nhưng giá trị thật là {raw}; đối chiếu theo {used}",
    "The cell shows {used} but holds {raw}; compared as {used}",
  ),
  AMOUNT_NEGATIVE: def(
    "warn",
    "Số tiền âm — có phải hoàn tiền/ghi giảm?",
    "Negative amount — a refund or a reversal?",
  ),
  AMOUNT_ZERO: def("warn", "Số tiền bằng 0", "Amount is zero"),
  AMOUNT_UNIT_SUSPECT: def(
    "warn",
    "Số tiền {raw} nhỏ/lớn bất thường; bảng có tính theo nghìn/triệu đồng?",
    "Amount {raw} is unusually small/large; is the sheet in thousands/millions?",
  ),
  AMOUNT_IMPLAUSIBLE: def(
    "warn",
    "Số tiền vượt ngưỡng hợp lý",
    "Amount beyond a plausible range",
  ),
  AMOUNT_WITHIN_TOLERANCE: def(
    "info",
    "Lệch {diff} trong dung sai {tolerance}",
    "Difference {diff} within tolerance {tolerance}",
  ),
  USD_ROUNDING: def(
    "info",
    "Chênh lệch làm tròn 0,01",
    "Rounding difference of 0.01",
  ),
  CURRENCY_CONFLICT: def(
    "error",
    "Ô ghi {a} nhưng cột/tiêu đề ghi {b}",
    "Cell says {a} but the column/header says {b}",
  ),
  CURRENCY_UNSUPPORTED: def(
    "error",
    "Chỉ hỗ trợ VND và USD: «{raw}»",
    "Only VND and USD are supported: «{raw}»",
  ),
  CURRENCY_INVALID: def(
    "error",
    "Loại tiền không hợp lệ «{raw}»",
    "Invalid currency «{raw}»",
  ),
  DATE_INVALID: def(
    "error",
    "Ngày không hợp lệ «{raw}»",
    "Invalid date «{raw}»",
  ),
  DATE_AMBIGUOUS: def(
    "info",
    "«{raw}» có thể là {dmy} hoặc {mdy}; đang hiểu ngày/tháng/năm",
    "«{raw}» may be {dmy} or {mdy}; read as day/month/year",
  ),
  DATE_NO_YEAR: def(
    "error",
    "Ngày «{raw}» không có năm; hãy nhập kỳ báo cáo",
    "Date «{raw}» has no year; enter the report period",
  ),
  DATE_YEAR_ASSUMED: def(
    "info",
    "Năm lấy theo kỳ báo cáo: {day}",
    "Year taken from the report period: {day}",
  ),
  DATE_COMPACT: def("info", "Ngày đọc từ dạng {raw}", "Date read from {raw}"),
  DATE_OUT_OF_RANGE: def(
    "error",
    "Ngày {day} ngoài khoảng hợp lệ",
    "Date {day} outside the accepted range",
  ),
  DATE_FUTURE: def(
    "warn",
    "Ngày {day} ở tương lai",
    "Date {day} is in the future",
  ),
  DATE_OUT_OF_PERIOD: def(
    "warn",
    "Ngày {day} ngoài kỳ {period}",
    "Date {day} outside the period {period}",
  ),
  CODE_INVALID: def("error", "Mã không hợp lệ «{raw}»", "Invalid code «{raw}»"),
  CODE_NUMERIC_CELL: def(
    "warn",
    "Ô mã là số trong Excel; số 0 đầu có thể đã mất",
    "The code cell is numeric in Excel; leading zeros may be lost",
  ),
  CODE_NORMALIZED: def(
    "info",
    "«{raw}» được hiểu là {code}",
    "«{raw}» read as {code}",
  ),
  CODE_LEADING_ZERO_MATCH: def(
    "info",
    "Khớp {code} sau khi bỏ số 0 đầu",
    "Matched {code} after dropping leading zeros",
  ),
  CODE_AMBIGUOUS: def(
    "error",
    "Mã «{raw}» khớp nhiều bản ghi sau khi bỏ số 0 đầu",
    "Code «{raw}» matches several records after dropping leading zeros",
  ),
  CODE_SUSPICIOUS_CHARS: def(
    "warn",
    "Mã chứa ký tự lạ (không phải chữ/số ASCII); không đối chiếu",
    "Code holds unusual characters (non-ASCII letters/digits); not compared",
  ),
  CODE_NOT_TEXT: def(
    "error",
    "Ô mã là số thập phân/khoa học; không đọc được",
    "The code cell is a decimal/scientific number; unreadable",
  ),
  DUPLICATE_ROW: def(
    "error",
    "Trùng hoàn toàn với dòng {n}",
    "Identical to row {n}",
  ),
  DUPLICATE_KEY: def(
    "warn",
    "Trùng {key} với dòng {n}; kiểm tra có phải cùng một khoản",
    "Same {key} as row {n}; check whether it is the same item",
  ),

  /* ---- row: orders ---- */
  ORDER_MATCHED: def(
    "info",
    "Đơn {code}: {stage}, khách {customer}",
    "Order {code}: {stage}, customer {customer}",
  ),
  ORDER_NOT_FOUND: def(
    "error",
    "Không tìm thấy đơn {code} trong phạm vi của bạn",
    "Order {code} not found in your scope",
  ),
  ORDER_CANCELLED: def(
    "warn",
    "Đơn {code} đã hủy",
    "Order {code} is cancelled",
  ),
  ORDER_CLOSED: def("info", "Đơn {code} đã đóng", "Order {code} is closed"),
  ORDER_CUSTOMER_MISMATCH: def(
    "warn",
    "Khách trên bảng «{sheet}» khác khách của đơn «{system}»",
    "Sheet customer «{sheet}» differs from the order's «{system}»",
  ),
  STAGE_MISMATCH: def(
    "warn",
    "Trạng thái trên bảng «{sheet}», hệ thống «{system}»",
    "Sheet status «{sheet}», system «{system}»",
  ),
  STAGE_UNRECOGNIZED: def(
    "info",
    "Không nhận ra trạng thái «{raw}»",
    "Unrecognised status «{raw}»",
  ),
  SELLING_PRICE_MATCH: def(
    "info",
    "Giá bán đơn {code} khớp: {system}",
    "Selling price of {code} matches: {system}",
  ),
  SELLING_PRICE_MISMATCH: def(
    "warn",
    "Giá bán đơn {code} trong hệ thống {system}, bảng ghi {sheet}; lệch {diff}",
    "Selling price of {code}: system {system}, sheet {sheet}; difference {diff}",
  ),
  SELLING_PRICE_UNSET: def(
    "info",
    "Đơn {code} chưa có giá bán",
    "Order {code} has no selling price yet",
  ),

  /* ---- row: customers ---- */
  CUSTOMER_INFERRED: def(
    "info",
    "Khách lấy từ đơn/hóa đơn: {customer}",
    "Customer taken from the order/invoice: {customer}",
  ),
  CUSTOMER_MATCH_NORMALIZED: def(
    "info",
    "«{sheet}» được hiểu là «{system}»",
    "«{sheet}» read as «{system}»",
  ),
  CUSTOMER_MATCH_FUZZY: def(
    "warn",
    "«{sheet}» được hiểu là khách «{system}» — xác nhận",
    "«{sheet}» read as customer «{system}» — confirm",
  ),
  CUSTOMER_AMBIGUOUS: def(
    "error",
    "Tên «{sheet}» khớp nhiều khách: {list}",
    "Name «{sheet}» matches several customers: {list}",
  ),
  CUSTOMER_NOT_FOUND: def(
    "error",
    "Không tìm thấy khách «{sheet}»",
    "Customer «{sheet}» not found",
  ),

  /* ---- row: invoices ---- */
  INVOICE_MATCHED: def(
    "info",
    "Khớp hóa đơn {number}",
    "Matched invoice {number}",
  ),
  INVOICE_NOT_FOUND: def(
    "error",
    "Không tìm thấy hóa đơn {number}",
    "Invoice {number} not found",
  ),
  INVOICE_VOIDED: def(
    "warn",
    "Hóa đơn {number} đã hủy: {reason}",
    "Invoice {number} is voided: {reason}",
  ),
  INVOICE_MATCH_LOOSE: def(
    "warn",
    "«{sheet}» khớp hóa đơn {system} sau khi bỏ dấu phân cách",
    "«{sheet}» matched invoice {system} after dropping separators",
  ),
  INVOICE_ORDER_MISMATCH: def(
    "error",
    "Hóa đơn {number} thuộc đơn {system}, bảng ghi {sheet}",
    "Invoice {number} belongs to order {system}; the sheet says {sheet}",
  ),
  INVOICE_CUSTOMER_MISMATCH: def(
    "error",
    "Hóa đơn {number} của khách «{system}», bảng ghi «{sheet}»",
    "Invoice {number} belongs to «{system}»; the sheet says «{sheet}»",
  ),
  INVOICE_AMOUNT_MISMATCH: def(
    "error",
    "Giá trị hóa đơn {number}: hệ thống {system}, bảng {sheet}; lệch {diff}",
    "Invoice {number} amount: system {system}, sheet {sheet}; difference {diff}",
  ),
  INVOICE_PAID_MISMATCH: def(
    "error",
    "Đã trả hóa đơn {number}: hệ thống {system} (gắn {paid} + cọc {deposit}), bảng {sheet}",
    "Paid on invoice {number}: system {system} (allocated {paid} + deposit {deposit}), sheet {sheet}",
  ),
  INVOICE_REMAINING_MISMATCH: def(
    "error",
    "Hóa đơn {amount}, đã gắn {paid}, cọc áp dụng {deposit} → còn thiếu {remaining}; bảng ghi {sheet}",
    "Invoice {amount}, allocated {paid}, deposit applied {deposit} → remaining {remaining}; sheet says {sheet}",
  ),
  INVOICE_DUE_MISMATCH: def(
    "warn",
    "Hạn hóa đơn {number}: hệ thống {system}, bảng {sheet}",
    "Due date of invoice {number}: system {system}, sheet {sheet}",
  ),
  INVOICE_CURRENCY_MISMATCH: def(
    "error",
    "Hóa đơn {number} là {system}, bảng ghi {sheet}",
    "Invoice {number} is in {system}; the sheet says {sheet}",
  ),
  INVOICE_NOT_IN_SHEET: def(
    "warn",
    "Hóa đơn {number} còn thiếu {remaining} không có trong bảng",
    "Invoice {number} with {remaining} remaining is absent from the sheet",
  ),

  /* ---- row: receipts ---- */
  RECEIPT_MATCHED: def(
    "info",
    "Khớp phiếu thu ngày {d} {amount}",
    "Matched the receipt of {d} for {amount}",
  ),
  RECEIPT_DATE_MISMATCH: def(
    "warn",
    "Khớp số tiền, ngày lệch {n} ngày (hệ thống {d})",
    "Amount matches; date differs by {n} days (system {d})",
  ),
  RECEIPT_AMOUNT_MISMATCH: def(
    "error",
    "Hệ thống ghi {system}, bảng ghi {sheet}; lệch {diff}",
    "System {system}, sheet {sheet}; difference {diff}",
  ),
  RECEIPT_SHORT_BANK_FEE_LIKELY: def(
    "warn",
    "{side} thấp hơn {diff} — giống phí ngân hàng; nếu đúng, ghi phí và giữ phiếu thu",
    "{side} is lower by {diff} — looks like a bank fee; if so, book the fee and keep the receipt",
  ),
  RECEIPT_SPLIT_MATCH: def(
    "info",
    "Các dòng {rows} cộng lại khớp một phiếu thu {amount} ngày {d} — khách chuyển gộp",
    "Rows {rows} add up to one receipt of {amount} on {d} — a combined transfer",
  ),
  RECEIPT_MERGED_MATCH: def(
    "info",
    "Dòng này bằng tổng {n} phiếu thu ({refs})",
    "This row equals the sum of {n} receipts ({refs})",
  ),
  RECEIPT_NOT_FOUND: def(
    "error",
    "Không có phiếu thu nào của {customer} quanh ngày {d} với {amount}",
    "No receipt of {customer} around {d} for {amount}",
  ),
  RECEIPT_VOIDED: def(
    "error",
    "Phiếu thu khớp đã bị hủy: {reason}",
    "The matching receipt was voided: {reason}",
  ),
  RECEIPT_UNALLOCATED: def(
    "warn",
    "Phiếu thu chưa gắn vào hóa đơn/đơn nào — tiền đang là trả trước",
    "The receipt is not allocated to any invoice/order — the money counts as an advance",
  ),
  RECEIPT_ALLOCATION_DIFFERS: def(
    "warn",
    "Bảng ghi cho {sheetTarget}, phiếu thu gắn vào {systemTarget}",
    "The sheet says {sheetTarget}; the receipt is allocated to {systemTarget}",
  ),
  RECEIPT_METHOD_DIFFERS: def(
    "info",
    "Bảng ghi {sheet}, phiếu thu ghi {system}",
    "Sheet says {sheet}; the receipt says {system}",
  ),
  RECEIPT_MATCH_TIE: def(
    "warn",
    "Có {n} phiếu thu cùng số tiền quanh ngày này; đã chọn ngày gần nhất",
    "{n} receipts with this amount around this date; the nearest date was chosen",
  ),
  RECEIPT_NOT_IN_SHEET: def(
    "warn",
    "Phiếu thu ngày {d} {amount} của {customer} không có trong bảng",
    "Receipt of {d} for {amount} from {customer} is absent from the sheet",
  ),
  CURRENCY_MISMATCH: def(
    "error",
    "Bảng ghi {sheet}; hệ thống ghi {system} — không quy đổi",
    "Sheet in {sheet}; system in {system} — not converted",
  ),

  /* ---- row: balances ---- */
  ROW_ARITHMETIC_MISMATCH: def(
    "error",
    "Dư đầu {a} + phát sinh {b} − đã thu {c} + hoàn {r} = {calc}, khác dư cuối {sheet} ({diff}); tiền hoàn cho khách làm dư nợ tăng lại",
    "Opening {a} + invoiced {b} − received {c} + refunded {r} = {calc}, not the closing {sheet} ({diff}); a refund to the customer raises the balance again",
  ),
  BALANCE_MATCH: def(
    "info",
    "Khớp dư nợ {balance}",
    "Balance {balance} matches",
  ),
  BALANCE_MATCH_IGNORING_CREDIT: def(
    "warn",
    "Khớp với còn phải thu {outstanding} nhưng khách đang trả trước {credit}; dư nợ thực là {balance}",
    "Matches the outstanding {outstanding}, but the customer holds an advance of {credit}; the true balance is {balance}",
  ),
  BALANCE_MISMATCH: def(
    "error",
    "Bảng ghi dư nợ {sheet}; hệ thống: còn phải thu {outstanding} − trả trước {credit} = {balance}; lệch {diff}. {explanation}",
    "Sheet balance {sheet}; system: outstanding {outstanding} − advance {credit} = {balance}; difference {diff}. {explanation}",
  ),
  OPENING_MISMATCH: def(
    "warn",
    "Dư đầu kỳ: bảng {sheet}, hệ thống {system} (đến {day})",
    "Opening balance: sheet {sheet}, system {system} (as of {day})",
  ),
  INVOICED_PERIOD_MISMATCH: def(
    "warn",
    "Phát sinh trong kỳ: bảng {sheet}, hệ thống {system} ({invoices})",
    "Invoiced in the period: sheet {sheet}, system {system} ({invoices})",
  ),
  RECEIVED_PERIOD_MISMATCH: def(
    "warn",
    "Đã thu trong kỳ: bảng {sheet}, hệ thống {system} ({receipts})",
    "Received in the period: sheet {sheet}, system {system} ({receipts})",
  ),
  ORDER_REMAINING_MISMATCH: def(
    "error",
    "Còn thiếu của đơn {code}: hệ thống {system}, bảng {sheet}",
    "Remaining on order {code}: system {system}, sheet {sheet}",
  ),
  OVERDUE_COUNT_MISMATCH: def(
    "info",
    "Số hóa đơn quá hạn: bảng {sheet}, hệ thống {system}",
    "Overdue invoices: sheet {sheet}, system {system}",
  ),
  CUSTOMER_NOT_IN_SHEET: def(
    "warn",
    "{customer} có dư nợ {balance} trong hệ thống nhưng không có trong bảng",
    "{customer} owes {balance} in the system but is absent from the sheet",
  ),
} as const satisfies Record<string, Definition>;

export type IssueCode = keyof typeof issueCatalog;

export const issueCodes = Object.keys(issueCatalog) as readonly IssueCode[];

export type IssueParamValue = string | number | boolean | null;
export type IssueParams = Readonly<Record<string, IssueParamValue>>;

/**
 * One finding. `columnIndex` names the sheet column it is about (null for a
 * row- or sheet-wide finding); the row is implied by where the issue is
 * stored. Params are display values only — decimal strings, days, codes —
 * never raw cell HTML.
 */
export type Issue = {
  code: IssueCode;
  severity: IssueSeverity;
  columnIndex: number | null;
  params: IssueParams;
};

export function severityOf(code: IssueCode): IssueSeverity {
  return issueCatalog[code].severity;
}

/** Builds an issue with the catalogue severity unless overridden. */
export function issue(
  code: IssueCode,
  params: IssueParams = {},
  options: { columnIndex?: number | null; severity?: IssueSeverity } = {},
): Issue {
  return {
    code,
    severity: options.severity ?? issueCatalog[code].severity,
    columnIndex: options.columnIndex ?? null,
    params,
  };
}

const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

function paramText(value: IssueParamValue | undefined): string {
  if (value === undefined || value === null) return "…";
  if (typeof value === "boolean") return value ? "✓" : "✗";
  return String(value);
}

/** The sentence for an issue in the reader's language; params are inserted as plain text. */
export function renderIssue(issue: Issue, locale: "vi" | "en"): string {
  const definition = issueCatalog[issue.code];
  const template = locale === "vi" ? definition.vi : definition.en;
  return template.replace(PLACEHOLDER, (_match, key: string) =>
    paramText(issue.params[key]),
  );
}

export const severityRank: Record<IssueSeverity, number> = {
  error: 3,
  warn: 2,
  info: 1,
};

/** The most serious severity among the issues, or null when there is none. */
export function worstSeverity(
  issues: readonly Pick<Issue, "severity">[],
): IssueSeverity | null {
  let worst: IssueSeverity | null = null;
  for (const entry of issues) {
    if (!worst || severityRank[entry.severity] > severityRank[worst]) {
      worst = entry.severity;
    }
  }
  return worst;
}

export function countBySeverity(
  issues: readonly Pick<Issue, "severity">[],
): Record<IssueSeverity, number> {
  const counts: Record<IssueSeverity, number> = { error: 0, warn: 0, info: 0 };
  for (const entry of issues) counts[entry.severity] += 1;
  return counts;
}
