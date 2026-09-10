import type {
  Capabilities,
  DraftInput,
  HistoryEntry,
  ListResponse,
  MastersResponse,
  SalesSlip,
  TransitionAction,
} from "@/domains/sales-slips/contracts";

/** Typed browser helpers for `/api/sales-slips/*`; every call is same-origin and uncached. */

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/sales-slips${path}`, {
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
    const record = (data ?? {}) as { message?: unknown; details?: unknown };
    throw new ApiError(
      typeof record.message === "string" && record.message
        ? record.message
        : fallbackMessage,
      response.status,
      record.details ?? null,
    );
  }
  return data as T;
}

export const fetchMasters = () => request<MastersResponse>("?masters=1");
export const fetchCreators = () =>
  request<{ creators: { id: string; name: string }[] }>("?creators=1");
export const fetchSlips = (params: URLSearchParams) =>
  request<ListResponse>(`?${params.toString()}`);
export const fetchSlip = (id: string) =>
  request<{
    slip: SalesSlip;
    people: Record<string, string>;
    capabilities: Capabilities;
  }>(`/${encodeURIComponent(id)}`);
export const createSlip = (id: string, draft: DraftInput) =>
  request<{ slip: SalesSlip; people?: Record<string, string> }>("", {
    method: "POST",
    body: JSON.stringify({ id, draft }),
  });
export const updateSlip = (id: string, version: number, draft: DraftInput) =>
  request<{ slip: SalesSlip }>(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ version, draft }),
  });
export const transitionSlip = (
  id: string,
  action: TransitionAction,
  version: number,
  reason?: string,
) =>
  request<{ slip: SalesSlip }>(`/${encodeURIComponent(id)}/transition`, {
    method: "POST",
    body: JSON.stringify({ action, version, ...(reason ? { reason } : {}) }),
  });
export const fetchHistory = (id: string) =>
  request<{ history: HistoryEntry[] }>(`/${encodeURIComponent(id)}/history`);

export const exportUrl = (id: string, format: "xlsx" | "pdf") =>
  `/api/sales-slips/${encodeURIComponent(id)}/export?format=${format}`;

/** Downloads an export through fetch so a 403/500 surfaces as a message, not a broken tab. */
export async function downloadExport(
  id: string,
  format: "xlsx" | "pdf",
): Promise<void> {
  const response = await fetch(exportUrl(id, format), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new ApiError(data?.message ?? fallbackMessage, response.status);
  }
  const name =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1] ?? `phieu-ban-hang.${format}`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
