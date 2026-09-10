"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyRow,
  type Master,
  type PaintRow,
} from "@/domains/paint-warehouse/contracts";
import type { PaintImportPreview } from "@/domains/paint-warehouse/import-workbook";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import {
  PaintConfirm,
  PaintImportPreviewCard,
  rowLabel,
  type PaintConfirmation,
} from "./confirm";
import { PaintRowEditor } from "./editor";
import { PaintPastePanel } from "./paste-panel";
import {
  ApiError,
  api,
  displayDate,
  errorMessage,
  formatNumber,
  maxImportBytes,
  noCapabilities,
  pageSize,
  postImport,
  todayInBusinessZone,
  type Capabilities,
  type PaintChange,
} from "./shared";

/**
 * Sổ chi tiết xuất kho sơn: server-paged table plus the inline phiếu editor.
 * Nothing changes on screen without a round trip — every "Áp dụng" writes the
 * line and reloads the page, so what is shown is what is booked.
 */

type Filters = { q: string; from: string; to: string };
const emptyFilters: Filters = { q: "", from: "", to: "" };
type ImportApplyResult = { hash: string; imported: number; skipped: number };
type RowsResponse = {
  rows: PaintRow[];
  total: number;
  /** Sum over the whole filter, not just the page (canonical decimal string). */
  totalActualAmount: string;
  nextOffset: number | null;
};

const columns = [
  "Ngày",
  "Mã cơ sở",
  "Cơ sở SX",
  "Mã vật tư",
  "Vật tư",
  "Diễn giải",
  "ĐVT",
  "Số lượng",
  "Đơn giá",
  "Thành tiền",
  "SL thực nhận",
  "Đơn giá đã chiết khấu",
  "Thành tiền thực nhận",
  "Ghi chú",
];

export function PaintWarehouse() {
  const [rows, setRows] = useState<PaintRow[]>([]);
  const [total, setTotal] = useState(0);
  // What the whole filtered ledger is worth after discounts — the server sums
  // it, so a paged table never shows a partial total as if it were the total.
  const [actualTotal, setActualTotal] = useState("0");
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [masters, setMasters] = useState<Master[]>([]);
  const [capabilities, setCapabilities] =
    useState<Capabilities>(noCapabilities);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("Đang tải…");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [inputs, setInputs] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [editor, setEditor] = useState<{ base: PaintRow } | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<PaintConfirmation | null>(
    null,
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  // A rejected write is kept so it can be retried or saved to disk.
  const [failed, setFailed] = useState<PaintChange[] | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PaintImportPreview | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const requestSeq = useRef(0);
  const editorAnchor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    return params;
  }, [applied]);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      const params = filterParams();
      params.set("offset", String(offset));
      params.set("limit", String(pageSize));
      if (append) setLoadingMore(true);
      else setLoading(true);
      const seq = ++requestSeq.current;
      try {
        const result = await api<RowsResponse>(`?${params.toString()}`);
        // A newer load (filter change, refresh, save) supersedes this response.
        if (seq !== requestSeq.current) return;
        setRows((previous) => {
          if (!append) return result.rows;
          // Server offsets shift after a write; never list an id twice.
          const known = new Set(previous.map((row) => row.id));
          return [
            ...previous,
            ...result.rows.filter((row) => !known.has(row.id)),
          ];
        });
        setTotal(result.total);
        setActualTotal(result.totalActualAmount ?? "0");
        setNextOffset(result.nextOffset);
        setStatus("Đã tải dữ liệu");
      } catch (reason) {
        if (seq !== requestSeq.current) return;
        setError(errorMessage(reason, "Không thể tải dữ liệu."));
        setStatus("Lỗi tải");
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filterParams],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const meta = await api<{
          masters: Master[];
          capabilities: Capabilities;
        }>("?masters=1");
        if (cancelled) return;
        setMasters(meta.masters);
        setCapabilities(meta.capabilities);
      } catch (reason) {
        if (!cancelled)
          setError(errorMessage(reason, "Không thể tải danh mục."));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Waits for the danh mục: the table renders names the masters resolve.
    if (!ready) return;
    const initial = setTimeout(() => void load(0, false), 0);
    return () => clearTimeout(initial);
  }, [load, ready]);

  useEffect(() => {
    if (!editorDirty) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [editorDirty]);

  /** Runs now, or after the reader agrees to drop an editor with changes. */
  const guard = (run: () => void) => {
    if (editorDirty) setConfirmation({ kind: "discard-edit", run });
    else run();
  };

  const closeEditor = () => {
    setEditorDirty(false);
    setEditor(null);
  };

  /** Agreeing to drop the changes closes the editor, then does what was asked. */
  const discard = (run: () => void) => {
    setConfirmation(null);
    closeEditor();
    run();
  };

  function openEditor(base: PaintRow) {
    guard(() => {
      setConfirmation(null);
      setEditor({ base });
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

  const saveChanges = useCallback(
    async (changes: PaintChange[]): Promise<PaintRow[]> => {
      setWorking(true);
      setStatus("Đang lưu…");
      try {
        const result = await api<{ rows: PaintRow[] }>("", {
          method: "POST",
          body: JSON.stringify({ changes }),
        });
        setFailed(null);
        setError("");
        setStatus("Đã lưu");
        return result.rows;
      } catch (reason) {
        setStatus("Lỗi lưu");
        setError(errorMessage(reason, "Không lưu được dòng."));
        setFailed(changes);
        // A version clash means the cached page is stale, not the draft.
        if (reason instanceof ApiError && reason.status === 409)
          void load(0, false);
        throw reason;
      } finally {
        setWorking(false);
      }
    },
    [load],
  );

  const saveFromEditor = async (change: PaintChange) => {
    const saved = await saveChanges([change]);
    const row = saved[0];
    closeEditor();
    setNotice(
      row
        ? `${change.version === 0 ? "Đã ghi" : "Đã cập nhật"} dòng ${rowLabel(row)}.`
        : "Đã lưu dòng.",
    );
    await load(0, false);
  };

  const writeFromPaste = async (changes: PaintChange[]) => {
    await saveChanges(changes);
    setNotice(`Đã ghi ${changes.length} dòng từ dữ liệu dán.`);
    await load(0, false);
  };

  const retryFailed = async () => {
    if (!failed) return;
    try {
      await saveChanges(failed);
      closeEditor();
      setNotice(`Đã lưu lại ${failed.length} dòng.`);
      await load(0, false);
    } catch {
      // saveChanges already put the refusal in the alert above.
    }
  };

  const downloadDraft = () => {
    if (!failed) return;
    const blob = new Blob([JSON.stringify(failed, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ban-nhap-xuat-kho-son.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const remove = async (row: PaintRow) => {
    setConfirmation(null);
    setWorking(true);
    try {
      await api("", {
        method: "DELETE",
        body: JSON.stringify({ id: row.id, version: row.version }),
      });
      setError("");
      setStatus("Đã xóa dòng");
      setNotice(`Đã xóa dòng ${rowLabel(row)}.`);
      await load(0, false);
    } catch (reason) {
      setError(errorMessage(reason, "Không thể xóa dòng này."));
    } finally {
      setWorking(false);
    }
  };

  const exportLedger = async () => {
    setNotice("");
    try {
      const params = filterParams();
      params.set("export", "1");
      const response = await fetch(`/api/paint-warehouse?${params.toString()}`);
      if (!response.ok) {
        const data: unknown = await response.json();
        throw new Error(
          errorMessage(
            new Error((data as { message?: string }).message ?? ""),
            "Không thể xuất Excel.",
          ),
        );
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "BANG-XUAT-KHO-SON.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(errorMessage(reason, "Không thể xuất Excel."));
    }
  };

  const closeImport = () => {
    setPreview(null);
    setImportFile(null);
    setIncludeDuplicates(false);
  };

  /** Reading a file only ever builds a preview; nothing is written until confirmed. */
  const readImportFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setNotice("");
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setError("Chỉ nhận file Excel .xlsx hoặc .xlsm.");
      return;
    }
    if (file.size > maxImportBytes) {
      setError("File vượt quá 5 MB. Hãy tách bớt dòng rồi nhập lại.");
      return;
    }
    setImportBusy(true);
    try {
      setPreview(
        (await postImport(file, "preview", false)) as PaintImportPreview,
      );
      setImportFile(file);
      setIncludeDuplicates(false);
    } catch (reason) {
      setError(errorMessage(reason, "Không thể đọc file Excel."));
    } finally {
      setImportBusy(false);
    }
  };

  const applyImport = async () => {
    if (!importFile || !preview) return;
    setImportBusy(true);
    setError("");
    try {
      const result = (await postImport(
        importFile,
        "apply",
        includeDuplicates,
      )) as ImportApplyResult;
      const fileName = preview.fileName;
      closeImport();
      await load(0, false);
      setNotice(
        `Đã nhập ${result.imported} dòng từ ${fileName}; bỏ qua ${result.skipped} dòng đã có.`,
      );
    } catch (reason) {
      setError(errorMessage(reason, "Không thể nhập file Excel."));
    } finally {
      setImportBusy(false);
    }
  };

  const busy = loading || working || importBusy;
  const filtering = !!applied.q || !!applied.from || !!applied.to;
  const canAct = capabilities.update || capabilities.delete;
  const remaining = Math.max(0, total - rows.length);
  const canClear = filtering || !!inputs.q || !!inputs.from || !!inputs.to;

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <p className="eyebrow">Kho / Quản lý kho</p>
        <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
          Bảng xuất kho sơn
        </h1>
        <p className="text-charcoal/65 mt-4 max-w-3xl">
          Sổ chi tiết xuất kho sơn 2026 · {total.toLocaleString("vi-VN")} dòng ·
          Thành tiền thực nhận {formatNumber(actualTotal) || "0"} · {status}
          {editorDirty ? " · Có thay đổi chưa áp dụng." : ""}
        </p>
      </header>

      <section className={`${cardClass} space-y-4`}>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            guard(() => setApplied(inputs));
          }}
        >
          <label className="min-w-64 flex-1 text-sm">
            <span className={labelClass}>Tìm</span>
            <input
              aria-label="Tìm vật tư hoặc cơ sở"
              placeholder="Tìm mã / tên vật tư, cơ sở SX, ghi chú…"
              className={fieldClass}
              value={inputs.q}
              onChange={(event) =>
                setInputs((previous) => ({
                  ...previous,
                  q: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm">
            <span className={labelClass}>Từ ngày</span>
            <input
              aria-label="Từ ngày"
              type="date"
              className={fieldClass}
              value={inputs.from}
              onChange={(event) =>
                setInputs((previous) => ({
                  ...previous,
                  from: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm">
            <span className={labelClass}>Đến ngày</span>
            <input
              aria-label="Đến ngày"
              type="date"
              className={fieldClass}
              value={inputs.to}
              onChange={(event) =>
                setInputs((previous) => ({
                  ...previous,
                  to: event.target.value,
                }))
              }
            />
          </label>
          <button className={ghostButtonClass} disabled={busy}>
            Lọc
          </button>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy || !canClear}
            onClick={() =>
              guard(() => {
                setInputs(emptyFilters);
                setApplied(emptyFilters);
              })
            }
          >
            Xóa bộ lọc
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {capabilities.create && (
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !!editor}
              onClick={() =>
                openEditor(
                  emptyRow(crypto.randomUUID(), todayInBusinessZone(), ""),
                )
              }
            >
              + Thêm phiếu xuất
            </button>
          )}
          {capabilities.create && (
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              onClick={() => guard(() => setPasteOpen((open) => !open))}
            >
              Dán từ Excel
            </button>
          )}
          {capabilities.import && (
            <>
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy || !!preview}
                onClick={() => fileInput.current?.click()}
              >
                Nhập Excel
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xlsm"
                aria-label="File Excel xuất kho sơn"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Clear it so choosing the same file twice fires again.
                  event.target.value = "";
                  void readImportFile(file);
                }}
              />
            </>
          )}
          {capabilities.export && (
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              onClick={() => void exportLedger()}
            >
              Xuất Excel
            </button>
          )}
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy}
            onClick={() => guard(() => void load(0, false))}
          >
            Tải lại
          </button>
          <span role="status" className="text-charcoal/65 text-sm">
            {loading
              ? "Đang tải…"
              : `Hiển thị ${rows.length}/${total} dòng · ${status}`}
          </span>
        </div>

        <p className="text-charcoal/60 text-sm">
          Tên cơ sở, vật tư, ĐVT, đơn giá và thành tiền tự tính từ danh mục. Số
          thập phân dùng dấu chấm (0.3); dấu phẩy phân cách hàng nghìn.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          <p>{error}</p>
          {failed && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={ghostButtonClass}
                disabled={working}
                onClick={() => void retryFailed()}
              >
                Thử lưu lại
              </button>
              <button
                type="button"
                className={ghostButtonClass}
                onClick={downloadDraft}
              >
                Tải bản nháp
              </button>
            </div>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-2xl bg-emerald-50 p-4 text-emerald-900"
        >
          {notice}
        </p>
      )}

      {confirmation && (
        <PaintConfirm
          confirmation={confirmation}
          busy={working}
          onCancel={() => setConfirmation(null)}
          onDelete={(row) => void remove(row)}
          onDiscard={discard}
        />
      )}

      {preview && (
        <PaintImportPreviewCard
          preview={preview}
          includeDuplicates={includeDuplicates}
          busy={importBusy}
          onIncludeDuplicates={setIncludeDuplicates}
          onApply={() => void applyImport()}
          onCancel={closeImport}
        />
      )}

      {pasteOpen && capabilities.create && (
        <PaintPastePanel
          masters={masters}
          busy={busy}
          onWrite={writeFromPaste}
          onClose={() => setPasteOpen(false)}
        />
      )}

      <div ref={editorAnchor}>
        {editor && (
          <PaintRowEditor
            key={editor.base.id}
            base={editor.base}
            masters={masters}
            saving={working}
            onSave={saveFromEditor}
            onCancel={() => guard(closeEditor)}
            onDirtyChange={setEditorDirty}
          />
        )}
      </div>

      <div className={tableWrapClass}>
        <table className="w-full min-w-375 border-collapse text-sm">
          <caption className="sr-only">Sổ chi tiết xuất kho sơn</caption>
          <thead className={theadClass}>
            <tr>
              {columns.map((label) => (
                <th key={label} scope="col" className={thClass}>
                  {label}
                </th>
              ))}
              {canAct && (
                // Pinned: the table is wider than any screen, and the row
                // actions are useless if they sit off the right edge.
                <th
                  scope="col"
                  className={`${thClass} border-burgundy/12 bg-ivory sticky right-0 border-l`}
                >
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const number = `${tdClass} text-right tabular-nums`;
              return (
                <tr
                  key={row.id}
                  className="border-burgundy/10 hover:bg-ivory/40 border-t align-top"
                >
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {displayDate(row.exportDate)}
                  </td>
                  <td className={tdClass}>{row.facilityCode || "—"}</td>
                  <td className={`${tdClass} min-w-40`}>
                    {row.facilityNameSnapshot || "—"}
                  </td>
                  <td className={`${tdClass} font-semibold`}>
                    {row.materialCode || "—"}
                  </td>
                  <td className={`${tdClass} min-w-44`}>
                    {row.materialNameSnapshot || "—"}
                  </td>
                  <td className={tdClass}>{row.description || "—"}</td>
                  <td className={tdClass}>{row.unit || "—"}</td>
                  <td className={number}>
                    {formatNumber(row.quantity) || "—"}
                  </td>
                  <td className={number}>
                    {formatNumber(row.unitPrice) || "—"}
                  </td>
                  <td className={number}>{formatNumber(row.amount) || "—"}</td>
                  <td className={number}>
                    {formatNumber(row.actualQuantity) || "—"}
                  </td>
                  <td
                    className={`${number} bg-amber-50`}
                    title="Đơn giá sau chiết khấu — có thể sửa tay cho từng dòng."
                  >
                    {formatNumber(row.discountedUnitPrice) || "—"}
                  </td>
                  <td className={number}>
                    {formatNumber(row.actualAmount) || "—"}
                  </td>
                  <td className={`${tdClass} min-w-48 whitespace-pre-wrap`}>
                    {row.note || "—"}
                  </td>
                  {canAct && (
                    <td
                      className={`${tdClass} border-burgundy/12 sticky right-0 space-y-2 border-l bg-white`}
                    >
                      {capabilities.update && (
                        <button
                          type="button"
                          className={`${ghostButtonClass} whitespace-nowrap`}
                          disabled={busy}
                          aria-label={`Sửa dòng ${rowLabel(row)}`}
                          onClick={() => openEditor(row)}
                        >
                          Sửa
                        </button>
                      )}
                      {capabilities.delete && (
                        <button
                          type="button"
                          className={`${dangerButtonClass} whitespace-nowrap`}
                          disabled={busy}
                          aria-label={`Xóa dòng ${rowLabel(row)}`}
                          onClick={() =>
                            guard(() =>
                              setConfirmation({ kind: "delete", row }),
                            )
                          }
                        >
                          Xóa dòng
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
            {filtering
              ? "Không có dòng nào khớp bộ lọc. Hãy xóa bộ lọc để xem lại toàn bộ sổ."
              : capabilities.create
                ? "Chưa có dòng nào. Bấm “+ Thêm phiếu xuất” để ghi dòng đầu tiên."
                : "Chưa có dòng nào."}
          </p>
        )}
      </div>
      {nextOffset !== null && (
        <div>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={loadingMore || loading}
            onClick={() => void load(rows.length, true)}
          >
            {loadingMore ? "Đang tải…" : `Tải thêm (${remaining} dòng còn lại)`}
          </button>
        </div>
      )}
    </div>
  );
}
