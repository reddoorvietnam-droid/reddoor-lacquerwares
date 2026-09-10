import type { z } from "zod";
import type {
  ExportScope,
  HistoryListResponse,
  ImportPreview,
  ImportResult,
  masterChangeSchema,
  MasterKind,
  MastersResponse,
  MaterialDetailResponse,
  MaterialTransaction,
  SummaryResponse,
  TransactionChange,
  TransactionListResponse,
  Facility,
  Material,
} from "@/domains/materials/contracts";

/** Typed browser helpers for `/api/materials/*`; every call is same-origin and uncached. */

export type MasterChange = z.infer<typeof masterChangeSchema>;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const fallbackMessage = "Không thể xử lý yêu cầu. Thử lại sau.";

function readMessage(data: unknown): { message: string; details: unknown } {
  if (typeof data === "object" && data !== null) {
    const record = data as { message?: unknown; details?: unknown };
    return {
      message:
        typeof record.message === "string" && record.message
          ? record.message
          : fallbackMessage,
      details: record.details ?? null,
    };
  }
  return { message: fallbackMessage, details: null };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`/api/materials${path}`, {
      credentials: "same-origin",
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.body && !isForm
          ? { "content-type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.", 0);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { message, details } = readMessage(data);
    throw new ApiError(message, response.status, details);
  }
  return data as T;
}

export const fetchMasters = () => request<MastersResponse>("/masters");

export const saveMasters = (kind: MasterKind, changes: MasterChange[]) =>
  request<{ kind: MasterKind; rows: (Material | Facility)[] }>("/masters", {
    method: "POST",
    body: JSON.stringify({ kind, changes }),
  });

export const fetchSummary = (params: URLSearchParams) =>
  request<SummaryResponse>(`/summary?${params.toString()}`);

export const fetchTransactions = (params: URLSearchParams) =>
  request<TransactionListResponse>(`/transactions?${params.toString()}`);

export const saveTransactions = (changes: TransactionChange[]) =>
  request<{ rows: MaterialTransaction[]; batchId: string }>("/transactions", {
    method: "POST",
    body: JSON.stringify({ changes }),
  });

export const cancelTransaction = (input: {
  id: string;
  version: number;
  reason?: string;
}) =>
  request<{ row: MaterialTransaction }>("/transactions", {
    method: "DELETE",
    body: JSON.stringify(input),
  });

export const fetchDetail = (id: string, offset = 0) =>
  request<MaterialDetailResponse>(
    `/detail?${new URLSearchParams({ id, offset: String(offset) }).toString()}`,
  );

/** Warehouse-wide audit page; also carries the header counts. */
export const fetchHistory = (params: { offset?: number; limit?: number }) =>
  request<HistoryListResponse>(
    `/history?${new URLSearchParams({
      offset: String(params.offset ?? 0),
      limit: String(params.limit ?? 50),
    }).toString()}`,
  );

export function importWorkbook(
  file: File,
  mode: "preview",
  includeDuplicates: boolean,
): Promise<ImportPreview>;
export function importWorkbook(
  file: File,
  mode: "apply",
  includeDuplicates: boolean,
): Promise<ImportResult>;
export function importWorkbook(
  file: File,
  mode: "preview" | "apply",
  includeDuplicates: boolean,
): Promise<ImportPreview | ImportResult> {
  const form = new FormData();
  form.set("file", file);
  form.set("mode", mode);
  if (includeDuplicates) form.set("includeDuplicates", "1");
  return request<ImportPreview | ImportResult>("/import", {
    method: "POST",
    body: form,
  });
}

const exportFileNames: Record<ExportScope, string> = {
  all: "KHO-NVL-2026.xlsx",
  summary: "TONG-KHO-NVL.xlsx",
  inbound: "CHI-TIET-NHAP-NVL.xlsx",
  outbound: "CHI-TIET-XUAT-NVL.xlsx",
};

/** Streams the workbook and hands it to the browser as a download. */
export async function downloadExport(
  scope: ExportScope,
  filters: URLSearchParams,
): Promise<void> {
  const params = new URLSearchParams(filters);
  params.set("scope", scope);
  let response: Response;
  try {
    response = await fetch(`/api/materials/export?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.", 0);
  }
  if (!response.ok) {
    const { message } = readMessage(await response.json().catch(() => null));
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const name =
    /filename="([^"]+)"/.exec(disposition)?.[1] ?? exportFileNames[scope];
  saveBlob(await response.blob(), name);
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
