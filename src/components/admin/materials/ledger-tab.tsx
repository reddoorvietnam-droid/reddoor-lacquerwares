"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  displayDate,
  type MaterialTransaction,
} from "@/domains/materials/contracts";
import {
  buttonClass,
  dangerButtonClass,
  fieldClass,
  formatDateTime,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { fetchTransactions } from "./api";
import { useMaterials } from "./materials-workspace";
import { badgeClass, errorMessage, formatQuantity } from "./materials-shared";
import { TransactionEditor } from "./transaction-editor";

/**
 * Sổ chi tiết nhập / xuất: server-paged table plus the inline phiếu editor.
 * Rows never change on screen without a round trip — a save or a cancel
 * refreshes the page from the server, so what is shown is what is booked.
 */

type LedgerType = "INBOUND" | "OUTBOUND";
type Filters = { from: string; to: string; q: string; showCancelled: boolean };
const emptyFilters: Filters = { from: "", to: "", q: "", showCancelled: false };
const pageSize = 200;

const columns: Record<LedgerType, string[]> = {
  INBOUND: [
    "Ngày",
    "Mã vật tư",
    "Vật tư",
    "Diễn giải",
    "ĐVT",
    "Số lượng",
    "Đơn giá",
    "Thành tiền",
    "Ghi chú",
    "Người ghi",
    "Ghi lúc",
  ],
  OUTBOUND: [
    "Ngày",
    "Mã cơ sở",
    "Cơ sở / người nhận",
    "Mã vật tư",
    "Vật tư",
    "Diễn giải",
    "ĐVT",
    "Số lượng",
    "Ghi chú",
    "Người ghi",
    "Ghi lúc",
  ],
};

/** A 24-hex id nobody recognises is shown as a dash rather than as noise. */
const actorLabel = (
  page: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>,
  id: string,
) =>
  page.get(id) ??
  names.get(id) ??
  (id === "materials-workbook-migration"
    ? "Chuyển từ Excel"
    : /^[0-9a-f]{24}$/i.test(id)
      ? "—"
      : id || "—");

export function MaterialsLedger({ type }: { type: LedgerType }) {
  const {
    capabilities,
    stockVersion,
    materialFilter,
    setMaterialFilter,
    setTabFilters,
    confirm,
    guard,
    actorNames,
    discardSeq,
    busy,
  } = useMaterials();
  const canWrite =
    type === "INBOUND" ? capabilities.receive : capabilities.issue;
  const [rows, setRows] = useState<MaterialTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [inputs, setInputs] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [editorState, setEditorState] = useState<{
    existing: MaterialTransaction | null;
    seq: number;
  } | null>(null);
  // An editor opened before the last discard is gone, whatever its draft holds.
  const editor =
    editorState && editorState.seq === discardSeq ? editorState : null;
  const setEditor = (next: { existing: MaterialTransaction | null } | null) =>
    setEditorState(next ? { ...next, seq: discardSeq } : null);
  const [pageActors, setPageActors] = useState<Map<string, string>>(
    () => new Map(),
  );
  const requestSeq = useRef(0);
  const editorAnchor = useRef<HTMLDivElement>(null);
  const materialId = materialFilter?.id ?? null;

  // The search box applies after a pause; dates and the checkbox apply at once.
  useEffect(() => {
    const timer = setTimeout(
      () => setApplied((previous) => ({ ...previous, q: inputs.q })),
      300,
    );
    return () => clearTimeout(timer);
  }, [inputs.q]);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({ type });
      if (applied.from) params.set("from", applied.from);
      if (applied.to) params.set("to", applied.to);
      if (applied.q.trim()) params.set("q", applied.q.trim());
      if (materialId) params.set("materialId", materialId);
      setTabFilters(
        type === "INBOUND" ? "inbound" : "outbound",
        new URLSearchParams(params),
      );
      params.set("status", applied.showCancelled ? "ALL" : "POSTED");
      params.set("offset", String(offset));
      params.set("limit", String(pageSize));
      if (append) setLoadingMore(true);
      else setLoading(true);
      setLoadError("");
      const seq = ++requestSeq.current;
      try {
        const result = await fetchTransactions(params);
        // A newer load (filter change, refresh) supersedes this response.
        if (seq !== requestSeq.current) return;
        setRows((previous) => {
          if (!append) return result.rows;
          // Server offsets shift after a cancel; never list an id twice.
          const known = new Set(previous.map((row) => row.id));
          return [
            ...previous,
            ...result.rows.filter((row) => !known.has(row.id)),
          ];
        });
        setTotal(result.total);
        setNextOffset(result.nextOffset);
        setPageActors((previous) => {
          const next = new Map(previous);
          for (const [id, name] of Object.entries(result.actorNames ?? {}))
            next.set(id, name);
          return next;
        });
      } catch (reason) {
        if (seq === requestSeq.current)
          setLoadError(errorMessage(reason, "Không thể tải sổ kho."));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [applied, materialId, setTabFilters, type],
  );

  useEffect(() => {
    // Waits for the first stock load; stockVersion then re-runs it after every write.
    if (stockVersion === 0) return;
    const initial = setTimeout(() => void load(0, false), 0);
    return () => clearTimeout(initial);
  }, [load, stockVersion]);

  function setFilter(patch: Partial<Filters>) {
    setInputs((previous) => ({ ...previous, ...patch }));
    if (!("q" in patch)) setApplied((previous) => ({ ...previous, ...patch }));
  }

  function openEditor(existing: MaterialTransaction | null) {
    guard(() => {
      setEditor({ existing });
      window.setTimeout(
        () =>
          editorAnchor.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        0,
      );
    });
  }

  const filtering =
    !!applied.from || !!applied.to || !!applied.q || applied.showCancelled;
  const addLabel = type === "INBOUND" ? "Thêm phiếu nhập" : "Thêm phiếu xuất";
  const unitOf = (row: MaterialTransaction) => row.unit || "—";

  return (
    <>
      <div className="materials-no-print flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className={labelClass}>Từ ngày</span>
          <input
            aria-label="Từ ngày"
            type="date"
            className={fieldClass}
            value={inputs.from}
            onChange={(event) => setFilter({ from: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Đến ngày</span>
          <input
            aria-label="Đến ngày"
            type="date"
            className={fieldClass}
            value={inputs.to}
            onChange={(event) => setFilter({ to: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Tìm</span>
          <input
            aria-label={
              type === "INBOUND" ? "Tìm phiếu nhập" : "Tìm phiếu xuất"
            }
            placeholder={
              type === "INBOUND"
                ? "Mã / tên vật tư, ghi chú…"
                : "Mã / tên vật tư, cơ sở, ghi chú…"
            }
            className={`${fieldClass} min-w-64`}
            value={inputs.q}
            onChange={(event) => setFilter({ q: event.target.value })}
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inputs.showCancelled}
            onChange={(event) =>
              setFilter({ showCancelled: event.target.checked })
            }
          />
          Hiện dòng đã hủy
        </label>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={!filtering}
          onClick={() => {
            setInputs(emptyFilters);
            setApplied(emptyFilters);
          }}
        >
          Xóa bộ lọc
        </button>
        {materialFilter && (
          <span className="bg-ivory text-burgundy inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold">
            Vật tư: {materialFilter.code}
            <button
              type="button"
              className="underline"
              aria-label={`Bỏ lọc vật tư ${materialFilter.code}`}
              onClick={() => guard(() => setMaterialFilter(null))}
            >
              ✕
            </button>
          </span>
        )}
        {canWrite && (
          <button
            type="button"
            className={buttonClass}
            disabled={busy || !!editor}
            onClick={() => openEditor(null)}
          >
            {addLabel}
          </button>
        )}
        <span className="text-charcoal/65 text-sm" role="status">
          {loading ? "Đang tải…" : `Hiển thị ${rows.length}/${total} dòng`}
        </span>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          {loadError}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void load(0, false)}
          >
            Thử lại
          </button>
        </div>
      )}

      <div ref={editorAnchor}>
        {editor && canWrite && (
          <TransactionEditor
            key={editor.existing?.id ?? "new"}
            type={type}
            existing={editor.existing}
            onSaved={() => setEditor(null)}
            onCancel={() => setEditor(null)}
          />
        )}
      </div>

      <div className={`${tableWrapClass} materials-table-wrap`}>
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <caption className="sr-only">
            {type === "INBOUND"
              ? "Sổ chi tiết nhập nguyên vật liệu"
              : "Sổ chi tiết xuất nguyên vật liệu"}
          </caption>
          <thead className={theadClass}>
            <tr>
              {columns[type].map((label) => (
                <th key={label} scope="col" className={thClass}>
                  {label}
                </th>
              ))}
              {(canWrite || capabilities.cancel) && (
                // Pinned: the table is wider than any screen, and the row
                // actions are useless if they sit off the right edge.
                <th
                  scope="col"
                  className={`${thClass} materials-no-print border-burgundy/12 bg-ivory sticky right-0 border-l`}
                >
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cancelled = row.status === "CANCELLED";
              const cell = `${tdClass} ${cancelled ? "text-charcoal/50 line-through" : ""}`;
              return (
                <tr
                  key={row.id}
                  className="border-burgundy/10 hover:bg-ivory/40 border-t align-top"
                >
                  <td className={`${cell} whitespace-nowrap`}>
                    {displayDate(row.transactionDate)}
                  </td>
                  {type === "OUTBOUND" && (
                    <>
                      <td className={cell}>{row.facilityCode || "—"}</td>
                      <td className={`${cell} min-w-40`}>
                        {row.facilityName || "—"}
                      </td>
                    </>
                  )}
                  <td className={`${cell} font-semibold`}>
                    {row.materialCode || "—"}
                  </td>
                  <td className={`${cell} min-w-44`}>
                    {row.materialName || "—"}
                  </td>
                  <td className={cell}>{row.description || "—"}</td>
                  <td className={cell}>{unitOf(row)}</td>
                  <td className={`${cell} text-right tabular-nums`}>
                    {formatQuantity(row.quantity)}
                  </td>
                  {type === "INBOUND" && (
                    <>
                      <td className={`${cell} text-right tabular-nums`}>
                        {row.unitPrice === null
                          ? "—"
                          : formatQuantity(row.unitPrice)}
                      </td>
                      <td className={`${cell} text-right tabular-nums`}>
                        {row.amount === null ? "—" : formatQuantity(row.amount)}
                      </td>
                    </>
                  )}
                  <td className={`${cell} min-w-48 whitespace-pre-wrap`}>
                    {cancelled && (
                      <span
                        className={`${badgeClass} mr-2 bg-stone-100 text-stone-700 no-underline ring-1 ring-stone-300`}
                      >
                        Đã hủy
                      </span>
                    )}
                    {row.note || (cancelled ? "" : "—")}
                    {cancelled && row.cancelReason
                      ? ` Lý do hủy: ${row.cancelReason}`
                      : ""}
                  </td>
                  <td className={`${cell} min-w-32`}>
                    {actorLabel(pageActors, actorNames, row.updatedBy)}
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatDateTime(row.updatedAt)}
                  </td>
                  {(canWrite || capabilities.cancel) && (
                    <td
                      className={`${tdClass} materials-no-print border-burgundy/12 sticky right-0 space-y-2 border-l bg-white`}
                    >
                      {!cancelled && canWrite && (
                        <button
                          type="button"
                          className={`${ghostButtonClass} whitespace-nowrap`}
                          disabled={busy}
                          aria-label={`Sửa phiếu ${row.materialCode} ngày ${displayDate(row.transactionDate)}`}
                          onClick={() => openEditor(row)}
                        >
                          Sửa
                        </button>
                      )}
                      {!cancelled && capabilities.cancel && (
                        <button
                          type="button"
                          className={`${dangerButtonClass} whitespace-nowrap`}
                          disabled={busy}
                          aria-label={`Hủy phiếu ${row.materialCode} ngày ${displayDate(row.transactionDate)}`}
                          onClick={() =>
                            guard(() => confirm({ kind: "cancel-line", row }))
                          }
                        >
                          Hủy dòng
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !loading && (
          <p className="text-charcoal/65 p-8 text-center">
            {filtering || materialFilter
              ? "Không có dòng nào khớp bộ lọc. Hãy xóa bộ lọc để xem lại toàn bộ sổ."
              : canWrite
                ? `Chưa có phiếu nào. Bấm “${addLabel}” để ghi phiếu đầu tiên.`
                : "Chưa có phiếu nào."}
          </p>
        )}
      </div>
      {nextOffset !== null && (
        <div className="materials-no-print">
          <button
            type="button"
            className={ghostButtonClass}
            disabled={loadingMore || loading}
            onClick={() => void load(rows.length, true)}
          >
            {loadingMore
              ? "Đang tải…"
              : `Tải thêm (${Math.max(0, total - rows.length)} dòng còn lại)`}
          </button>
        </div>
      )}
    </>
  );
}
