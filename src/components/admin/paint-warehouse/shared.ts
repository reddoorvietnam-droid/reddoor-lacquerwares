import Decimal from "decimal.js";
import { ZodError } from "zod";
import { codeKey, type Master } from "@/domains/paint-warehouse/contracts";
import type { RowPatch } from "@/domains/paint-warehouse/contracts";
import type { ImportRowStatus } from "@/domains/paint-warehouse/import-workbook";

/** Types, labels and fetch helpers shared by the bảng xuất kho sơn cards. */

export type Capabilities = Record<
  "read" | "create" | "update" | "delete" | "export" | "import",
  boolean
>;
export const noCapabilities: Capabilities = {
  read: false,
  create: false,
  update: false,
  delete: false,
  export: false,
  import: false,
};

/** One row change as the batch endpoint takes it; version 0 creates. */
export type PaintChange = { id: string; version: number; patch: RowPatch };

/** One page of the ledger; the server caps a page at 500 rows. */
export const pageSize = 200;
export const maxPasteRows = 500;
/** The server reads the workbook in memory, so the upload is capped here too. */
export const maxImportBytes = 5 * 1024 * 1024;
export const previewLimit = 200;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Every refusal from the API carries { message }; fall back when it does not. */
function failureMessage(data: unknown, fallback: string): string {
  const message = (data as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : fallback;
}

export async function api<T>(query: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/paint-warehouse${query}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new ApiError(
      failureMessage(data, "Không thể xử lý yêu cầu."),
      response.status,
    );
  return data as T;
}

export async function postImport(
  file: File,
  mode: "preview" | "apply",
  includeDuplicates: boolean,
): Promise<unknown> {
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  if (includeDuplicates) form.append("includeDuplicates", "1");
  const response = await fetch("/api/paint-warehouse/import", {
    method: "POST",
    cache: "no-store",
    body: form,
  });
  const data: unknown = await response.json();
  if (!response.ok)
    throw new ApiError(
      failureMessage(data, "Không thể đọc file Excel."),
      response.status,
    );
  return data;
}

/** parseCell rejects through zod, so a bad cell must not surface as "[object Object]". */
export function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ZodError)
    return reason.issues.map((issue) => issue.message).join("; ");
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

export const displayDate = (iso: string) =>
  iso ? iso.split("-").reverse().join("/") : "";

/** Today's calendar date in the business time zone (Asia/Ho_Chi_Minh). */
export function todayInBusinessZone(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Thousands grouping with a dot decimal, as the workbook shows it — 3280 →
 * "3,280". Values are canonical decimal strings, so no float tail appears.
 */
export function formatNumber(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const [integer, fraction] = new Decimal(value).toFixed().split(".");
  const sign = integer!.startsWith("-") ? "-" : "";
  const grouped = integer!
    .replace("-", "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
}

/** The storekeeper types a code or the catalogue name; the code is what gets sent. */
export function findMaster(
  masters: readonly Master[],
  kind: Master["kind"],
  text: string,
): Master | null {
  const wanted = codeKey(text);
  if (!wanted) return null;
  const pool = masters.filter((master) => master.kind === kind);
  return (
    pool.find((master) => codeKey(master.code) === wanted) ??
    pool.find((master) => codeKey(master.name) === wanted) ??
    null
  );
}

export const badgeClass =
  "inline-block rounded-lg px-2 py-1 text-xs font-semibold whitespace-nowrap";

export const importStatusLabels: Record<ImportRowStatus, string> = {
  valid: "Hợp lệ",
  duplicate: "Trùng",
  "already-imported": "Đã nhập",
  invalid: "Lỗi",
};
export const importStatusBadges: Record<ImportRowStatus, string> = {
  valid: "bg-emerald-100 text-emerald-900",
  duplicate: "bg-amber-100 text-amber-900",
  "already-imported": "bg-charcoal/10 text-charcoal/70",
  invalid: "bg-red-100 text-red-900",
};
