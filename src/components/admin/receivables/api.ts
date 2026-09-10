import type {
  CatalogueItem,
  CustomerDetail,
  EntryListResponse,
  ExportScope,
  HistoryResponse,
  Lookups,
  ReceivableCustomer,
  ReceivableEntry,
  SummaryResponse,
} from "@/domains/receivables/contracts";

/** Typed browser helpers for `/api/receivables/*`; every call is same-origin and uncached. */

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
  let response: Response;
  try {
    response = await fetch(`/api/receivables${path}`, {
      credentials: "same-origin",
      ...init,
      cache: "no-store",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
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

export const fetchLookups = () => request<Lookups>("/lookups");

export const fetchSummary = (params: URLSearchParams) =>
  request<SummaryResponse>(`/summary?${params.toString()}`);

export const fetchEntries = (params: URLSearchParams) =>
  request<EntryListResponse>(`/entries?${params.toString()}`);

export const fetchCustomerDetail = (
  customerId: string,
  params: URLSearchParams,
) => request<CustomerDetail>(`/customers/${customerId}?${params.toString()}`);

export const saveCustomer = (body: {
  id?: string;
  version?: number;
  patch: Record<string, unknown>;
}) =>
  request<{ customer: ReceivableCustomer }>("/customers", {
    method: "POST",
    body: JSON.stringify(body),
  });

/**
 * Records a sale or a reduction. `idempotencyKey` is minted once per form and
 * reused on every retry, so a double-click or a flaky network can only ever
 * produce one entry.
 */
export const createEntry = (body: Record<string, unknown>) =>
  request<{ entry: ReceivableEntry }>("/entries", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** One customer, one date, many item lines — the usual counter purchase. */
export const createSaleBatch = (body: Record<string, unknown>) =>
  request<{ entries: ReceivableEntry[] }>("/entries", {
    method: "POST",
    body: JSON.stringify({ ...body, kind: "saleBatch" }),
  });

/** Corrects a recorded line in place; the server audits every changed field. */
export const updateEntry = (body: {
  id: string;
  version: number;
  patch: Record<string, unknown>;
  reason?: string;
}) =>
  request<{ entry: ReceivableEntry }>("/entries", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** Adds a paint code or reprices one, in the shared paint catalogue. */
export const saveCatalogueItem = (body: {
  code: string;
  name: string;
  unit: string;
  salePrice: string | null;
}) =>
  request<{ item: CatalogueItem }>("/catalogue", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const postEntry = (body: {
  id: string;
  version: number;
  kind: "sale" | "reduction";
}) =>
  request<{ entry: ReceivableEntry }>("/entries/post", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const cancelEntry = (body: {
  id: string;
  version: number;
  reason: string;
}) =>
  request<{ entry: ReceivableEntry }>("/entries/cancel", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const setOpeningBalance = (body: {
  customerId: string;
  amount: string;
  reason: string;
}) =>
  request<{ entry: ReceivableEntry }>("/opening-balance", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const fetchHistory = (params: { offset?: number; limit?: number }) =>
  request<HistoryResponse>(
    `/history?${new URLSearchParams({
      offset: String(params.offset ?? 0),
      limit: String(params.limit ?? 50),
    }).toString()}`,
  );

const exportFileNames: Record<ExportScope, string> = {
  all: "CONG-NO-2026.xlsx",
  summary: "TONG-HOP-CONG-NO.xlsx",
  sales: "SO-CHI-TIET-BAN-HANG.xlsx",
  reductions: "BANG-THANH-TOAN.xlsx",
};

/** Streams the workbook and hands it to the browser as a download. */
export async function downloadExport(
  scope: ExportScope,
  filters: URLSearchParams,
  customerId?: string,
): Promise<void> {
  const params = new URLSearchParams(filters);
  params.set("scope", scope);
  if (customerId) params.set("customerId", customerId);
  let response: Response;
  try {
    response = await fetch(`/api/receivables/export?${params.toString()}`, {
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
