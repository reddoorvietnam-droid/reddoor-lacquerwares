import { z } from "zod";

/** Business timezone for every week boundary and "today" in this module. */
export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

export const sampleStatuses = [
  "woodwork",
  "finishing",
  "qc_passed",
  "sent",
] as const;
export type SampleStatus = (typeof sampleStatuses)[number];

/** The four labels are the report's contract with the workshop; never extend. */
export const statusLabels: Record<SampleStatus, string> = {
  woodwork: "1. Đang làm mộc/vóc",
  finishing: "2. Đang hoàn thiện",
  qc_passed: "3. Đã kiểm duyệt (QC Đạt)",
  sent: "4. Đã gửi mẫu",
};

/** Fill colours taken from the workbook Red Door already uses. */
export const statusExcelColor: Record<SampleStatus, string> = {
  woodwork: "FFFF0000",
  finishing: "FFFFC000",
  qc_passed: "FF92D050",
  sent: "FF0070C0",
};

/** Screen palette, matching the workbook: red, amber, green, blue. */
export const statusTone: Record<
  SampleStatus,
  { badge: string; card: string; chart: string }
> = {
  woodwork: {
    badge: "bg-red-100 text-red-900 ring-1 ring-red-300",
    card: "bg-red-50 text-red-900",
    chart: "#dc2626",
  },
  finishing: {
    badge: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
    card: "bg-amber-50 text-amber-900",
    chart: "#f59e0b",
  },
  qc_passed: {
    badge: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
    card: "bg-emerald-50 text-emerald-900",
    chart: "#16a34a",
  },
  sent: {
    badge: "bg-blue-100 text-blue-900 ring-1 ring-blue-300",
    card: "bg-blue-50 text-blue-900",
    chart: "#2563eb",
  },
};

export const sampleTextFields = [
  { key: "orderName", label: "Mẫu đơn hàng", max: 300, rows: 1 },
  {
    key: "productDetails",
    label: "Số lượng mẫu & chi tiết sản phẩm",
    max: 5000,
    rows: 3,
  },
  { key: "workshop", label: "Nơi làm", max: 300, rows: 1 },
  {
    key: "notes",
    label: "Chi tiết tiến độ / ghi chú nhật ký",
    max: 10000,
    rows: 4,
  },
] as const;

export const sampleDateFields = [
  { key: "receivedDate", label: "Thời điểm nhận mẫu" },
  { key: "qcDate", label: "Ngày kiểm (QC)" },
  { key: "sentDate", label: "Ngày gửi mẫu" },
] as const;

export type SampleDateField = (typeof sampleDateFields)[number]["key"];
export type SampleTextField = (typeof sampleTextFields)[number]["key"];

/** The nine business columns of the workbook, in report order. */
export const reportColumns = [
  "STT",
  "MẪU ĐƠN HÀNG",
  "SỐ LƯỢNG MẪU & CHI TIẾT SẢN PHẨM",
  "TRẠNG THÁI TỔNG THỂ",
  "NƠI LÀM",
  "THỜI ĐIỂM NHẬN MẪU",
  "NGÀY KIỂM (QC)",
  "NGÀY GỬI MẪU",
  "CHI TIẾT TIẾN ĐỘ / GHI CHÚ NHẬT KÝ",
] as const;

// ----------------------------------------------------------------- dates ----

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isoDateSchema = z
  .string()
  .regex(isoDatePattern, "Ngày phải theo dạng yyyy-mm-dd.")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === m - 1 &&
      date.getUTCDate() === d &&
      y >= 2000 &&
      y <= 2999
    );
  }, "Ngày không có thật.");

/**
 * Workbook date columns hold real dates, business notes ("Chờ gửi") and blanks
 * alike. Keeping the three cases apart lets the site store proper dates without
 * ever guessing at, or throwing away, the wording Red Door already used.
 */
export const sampleDateSchema = z
  .object({
    kind: z.enum(["empty", "date", "text"]),
    value: z.string().max(300),
  })
  .superRefine((entry, ctx) => {
    if (entry.kind === "empty" && entry.value !== "")
      ctx.addIssue({
        code: "custom",
        message: "Ô ngày trống không được có nội dung.",
      });
    if (entry.kind === "date" && !isoDateSchema.safeParse(entry.value).success)
      ctx.addIssue({ code: "custom", message: "Ngày không hợp lệ." });
    if (entry.kind === "text" && entry.value.trim() === "")
      ctx.addIssue({
        code: "custom",
        message: "Ghi chú ngày không được để trống.",
      });
  });

export type SampleDate = z.infer<typeof sampleDateSchema>;

export const emptySampleDate: SampleDate = { kind: "empty", value: "" };

export const isoDate = (value: string): SampleDate => ({
  kind: "date",
  value,
});
export const dateNote = (value: string): SampleDate => ({
  kind: "text",
  value: value.trim(),
});

/** dd/MM/yyyy for a real date, the original wording for a note, "" for blank. */
export function formatSampleDate(entry: SampleDate): string {
  if (entry.kind === "date") return formatIsoDate(entry.value);
  return entry.kind === "text" ? entry.value : "";
}

export function formatIsoDate(value: string): string {
  return isoDatePattern.test(value)
    ? value.split("-").reverse().join("/")
    : value;
}

/**
 * Reads dd/MM/yyyy — the Vietnamese convention this workbook is written in.
 * Reports `ambiguous` when the day could just as well be a month, so those
 * cells stay as the author's own text instead of becoming a guessed date.
 */
export function parseVietnameseDate(
  raw: string,
): { iso: string } | { ambiguous: true } | null {
  const match = raw
    .trim()
    .match(/^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!isoDateSchema.safeParse(iso).success) return null;
  // Both readings are real dates, so the file itself cannot say which was
  // meant. Surface it rather than silently swapping day and month.
  if (day <= 12 && month <= 12 && day !== month) return { ambiguous: true };
  return { iso };
}

// ----------------------------------------------------------------- weeks ----

/** Today's calendar date in Asia/Ho_Chi_Minh, as yyyy-mm-dd. */
export function todayInBusinessTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Calendar dates carry no time, so week maths is plain day arithmetic. UTC is
 * used only as a stable calendar here and can never shift a date by a day.
 */
function toUtc(value: string): Date {
  const [y, m, d] = isoDateSchema.parse(value).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(value: string, days: number): string {
  const date = toUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `value`. */
export function weekStart(value: string): string {
  return addDays(value, -((toUtc(value).getUTCDay() + 6) % 7));
}

/** Sunday of the week containing `value`. */
export function weekEnd(value: string): string {
  return addDays(weekStart(value), 6);
}

export function isMonday(value: string): boolean {
  return weekStart(value) === value;
}

/** ISO-8601 week label such as `2026-W36`, used in export file names. */
export function isoWeekLabel(value: string): string {
  const thursday = toUtc(addDays(weekStart(value), 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3,
  );
  const week =
    1 +
    Math.round(
      (thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    );
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function formatWeekRange(monday: string): string {
  return `${formatIsoDate(monday)} – ${formatIsoDate(weekEnd(monday))}`;
}

// ------------------------------------------------------------------ rows ----

export const maxSampleRows = 500;

/** What a client may send. Row audit fields are added by the server only. */
export const sampleRowInputSchema = z.object({
  id: z.uuid("Mã mẫu không hợp lệ."),
  number: z.number().int().min(1).max(999999),
  orderName: z.string().trim().min(1, "Tên mẫu đơn hàng là bắt buộc.").max(300),
  productDetails: z.string().max(5000),
  status: z.enum(sampleStatuses),
  workshop: z.string().max(300),
  receivedDate: sampleDateSchema,
  qcDate: sampleDateSchema,
  sentDate: sampleDateSchema,
  notes: z.string().max(10000),
});

export type SampleRowInput = z.infer<typeof sampleRowInputSchema>;

export const sampleRowSchema = sampleRowInputSchema.extend({
  updatedAt: z.string().min(1).max(40),
  updatedBy: z.string().max(200),
  updatedByName: z.string().max(200),
});

export type SampleRow = z.infer<typeof sampleRowSchema>;

export const reportInputSchema = z
  .object({
    week: isoDateSchema,
    reportDate: isoDateSchema,
    rows: z.array(sampleRowInputSchema).max(maxSampleRows, {
      message: `Một báo cáo tối đa ${maxSampleRows} mẫu.`,
    }),
    changeNote: z
      .string()
      .trim()
      .min(1, "Hãy ghi nội dung cập nhật lần này.")
      .max(1000),
    expectedRevision: z.number().int().min(0).max(100_000),
  })
  .superRefine((input, ctx) => {
    // The field checks above may already have failed, and this refinement still
    // runs, so never hand a malformed date to the week helpers: they throw, and
    // a throw here would surface as a server error instead of a 400.
    const datesUsable =
      isoDateSchema.safeParse(input.week).success &&
      isoDateSchema.safeParse(input.reportDate).success;
    if (datesUsable && !isMonday(input.week))
      ctx.addIssue({
        code: "custom",
        message: "Tuần báo cáo phải bắt đầu từ thứ Hai.",
        path: ["week"],
      });
    else if (datesUsable && weekStart(input.reportDate) !== input.week)
      ctx.addIssue({
        code: "custom",
        message: "Ngày báo cáo phải nằm trong tuần đang mở.",
        path: ["reportDate"],
      });
    if (new Set(input.rows.map((row) => row.id)).size !== input.rows.length)
      ctx.addIssue({
        code: "custom",
        message: "Mã mẫu bị trùng.",
        path: ["rows"],
      });
    if (new Set(input.rows.map((row) => row.number)).size !== input.rows.length)
      ctx.addIssue({
        code: "custom",
        message: "STT mẫu bị trùng.",
        path: ["rows"],
      });
    if (JSON.stringify(input.rows).length > 500_000)
      ctx.addIssue({
        code: "custom",
        message: "Báo cáo quá lớn; tối đa 500.000 ký tự dữ liệu mẫu.",
        path: ["rows"],
      });
  });

export type ReportInput = z.infer<typeof reportInputSchema>;

export type SampleReport = {
  week: string;
  weekEnd: string;
  reportDate: string;
  revision: number;
  previousRevision: number | null;
  inheritedFrom: string | null;
  rows: SampleRow[];
  changeNote: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  savedAt: string;
  savedBy: string;
  savedByName: string;
};

export type ReportSummary = Omit<SampleReport, "rows"> & { count: number };

export function summarize(rows: readonly { status: SampleStatus }[]) {
  return sampleStatuses.map((status) => {
    const count = rows.filter((row) => row.status === status).length;
    // Share of the four statuses across sample rows — not a completion rate.
    return { status, count, ratio: rows.length ? count / rows.length : 0 };
  });
}

export function emptyRow(number: number): SampleRowInput {
  return {
    id: crypto.randomUUID(),
    number,
    orderName: "",
    productDetails: "",
    status: "woodwork",
    workshop: "",
    receivedDate: emptySampleDate,
    qcDate: emptySampleDate,
    sentDate: emptySampleDate,
    notes: "",
  };
}

/** Drops the server-managed audit fields, leaving what a client may send. */
export function toRowInput(row: SampleRow | SampleRowInput): SampleRowInput {
  return {
    id: row.id,
    number: row.number,
    orderName: row.orderName,
    productDetails: row.productDetails,
    status: row.status,
    workshop: row.workshop,
    receivedDate: row.receivedDate,
    qcDate: row.qcDate,
    sentDate: row.sentDate,
    notes: row.notes,
  };
}

/** Business fields only: what decides whether a row counts as edited. */
export function sameRowContent(a: SampleRowInput, b: SampleRowInput): boolean {
  const fields = (row: SampleRowInput) => [
    row.number,
    row.orderName,
    row.productDetails,
    row.status,
    row.workshop,
    row.receivedDate,
    row.qcDate,
    row.sentDate,
    row.notes,
  ];
  return JSON.stringify(fields(a)) === JSON.stringify(fields(b));
}
