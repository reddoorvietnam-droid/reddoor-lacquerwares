"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  emptyRow,
  formatIsoDate,
  formatWeekRange,
  isoWeekLabel,
  reportInputSchema,
  todayInBusinessTimezone,
  toRowInput,
  weekEnd,
  weekStart,
  type ReportSummary,
  type SampleReport,
  type SampleRow,
  type SampleRowInput,
} from "@/domains/sample-progress/contracts";
import type { ImportIssue } from "@/domains/sample-progress/import-workbook";
import {
  SampleProgressConfirm,
  SampleProgressImportPreview,
  type SampleProgressConfirmation,
} from "./sample-progress-confirm";
import { SampleProgressEditor } from "./sample-progress-editor";
import { SampleProgressHistory } from "./sample-progress-history";
import { SampleProgressSummary } from "./sample-progress-summary";
import { SampleProgressTable } from "./sample-progress-table";
import {
  SampleProgressFilters,
  SampleProgressToolbar,
} from "./sample-progress-toolbar";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  formatDateTime,
  visibleRows,
  type SortKey,
} from "./sample-progress-shared";

type Role = "editor" | "viewer";

/**
 * An imported file only ever produces a preview, so the state it replaced is
 * kept alongside it. Picking the wrong file is a one-click mistake and must be
 * a one-click undo, not a page reload.
 */
type ImportSession = {
  fileName: string;
  restore: {
    current: SampleReport | null;
    week: string;
    reportDate: string;
    rows: SampleRow[];
    changeNote: string;
    dirty: boolean;
  };
};

const unsaved = "Chưa lưu";

/** Rows edited on screen carry no server stamp until the revision is saved. */
function asDraftRow(row: SampleRowInput): SampleRow {
  return { ...row, updatedAt: "", updatedBy: "", updatedByName: unsaved };
}

async function api<T>(query = "", init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/sample-progress${query}`, {
      ...init,
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Mất kết nối tới máy chủ. Hãy kiểm tra mạng rồi thử lại; nội dung đang nhập vẫn giữ trên màn hình.",
    );
  }
  if (
    !response.headers.get("content-type")?.includes("application/json") &&
    !response.ok
  )
    throw new Error("Không thể xử lý báo cáo lúc này. Vui lòng thử lại.");
  const body = (await response.json()) as { message?: string; error?: string };
  if (!response.ok)
    throw new Error(body.message || body.error || "Không thể xử lý báo cáo.");
  return body as T;
}

export function SampleProgressManager() {
  const [role, setRole] = useState<Role>("viewer");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [current, setCurrent] = useState<SampleReport | null>(null);
  const [week, setWeek] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [rows, setRows] = useState<SampleRow[]>([]);
  const [changeNote, setChangeNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [history, setHistory] = useState<ReportSummary[] | null>(null);
  const [draft, setDraft] = useState<SampleRowInput | null>(null);
  const [confirmation, setConfirmation] = useState<SampleProgressConfirmation | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("report");
  const editorAnchor = useRef<HTMLDivElement>(null);

  const latestRevision = current
    ? (reports.find((entry) => entry.week === current.week)?.revision ??
      current.revision)
    : 0;
  const historical = !!current && current.revision < latestRevision;
  const editable = role === "editor" && !historical;
  const blocking = issues.filter((issue) => issue.severity === "error");
  const flagged = new Set(
    issues.flatMap((issue) => (issue.rowId ? [issue.rowId] : [])),
  );
  const shown = visibleRows(rows, { search, status: statusFilter, sort });
  const filtering = !!search || !!statusFilter || sort !== "report";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const listing = await api<{ role: Role; reports: ReportSummary[] }>();
        if (cancelled) return;
        setRole(listing.role);
        setReports(listing.reports);
        const first = listing.reports[0];
        if (!first) {
          setWeek(weekStart(todayInBusinessTimezone()));
          setReportDate(todayInBusinessTimezone());
          return;
        }
        const opened = await api<{ report: SampleReport }>(
          `?week=${first.week}`,
        );
        if (cancelled) return;
        applyReport(opened.report);
      } catch (caught) {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được báo cáo.",
          );
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dirty && !draft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, draft]);

  function applyReport(report: SampleReport) {
    setCurrent(report);
    setWeek(report.week);
    setReportDate(report.reportDate);
    setRows(report.rows);
    setChangeNote("");
    setDirty(false);
    setDraft(null);
    setIssues([]);
    setImportSession(null);
    setHistory(null);
    setConflict(false);
    setConfirmation(null);
  }

  /** Anything that would discard unsaved work asks first, in the page itself. */
  function guard(run: () => void) {
    if (!dirty && !draft) run();
    else setConfirmation({ kind: "discard", run });
  }

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Thao tác chưa thành công.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshListing() {
    const listing = await api<{ role: Role; reports: ReportSummary[] }>();
    setRole(listing.role);
    setReports(listing.reports);
  }

  function openWeek(target: string, revision?: number) {
    guard(() =>
      void perform(async () => {
        const opened = await api<{ report: SampleReport }>(
          `?week=${target}${revision ? `&revision=${revision}` : ""}`,
        );
        applyReport(opened.report);
        await refreshListing();
      }),
    );
  }

  function startWeek(value: string) {
    guard(() => {
      const monday = weekStart(value);
      if (reports.some((entry) => entry.week === monday)) {
        openWeek(monday);
        return;
      }
      setCurrent(null);
      setWeek(monday);
      setReportDate(value);
      setRows([]);
      // Left blank on purpose: every save states its own change note.
      setChangeNote("");
      setIssues([]);
      setHistory(null);
      setConflict(false);
      setConfirmation(null);
      setDraft(null);
      setDirty(true);
      setMessage(
        `Đang soạn báo cáo mới cho tuần ${formatWeekRange(monday)}. Thêm mẫu hoặc nhập Excel, rồi bấm “Lưu báo cáo”.`,
      );
    });
  }

  function save() {
    void perform(async () => {
      const payload = {
        week,
        reportDate,
        rows: rows.map(toRowInput),
        changeNote,
        expectedRevision: current?.revision ?? 0,
      };
      const parsed = reportInputSchema.safeParse(payload);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "biểu mẫu"}: ${issue.message}`)
            .join("; "),
        );
      try {
        const saved = await api<{ report: SampleReport }>("", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        applyReport(saved.report);
        setMessage(
          `Đã lưu ${saved.report.rows.length} mẫu · phiên bản ${saved.report.revision} · ${formatDateTime(saved.report.savedAt)}.`,
        );
        await refreshListing();
      } catch (caught) {
        // A conflict must never discard what is on screen.
        if (caught instanceof Error && caught.message.includes("vừa lưu"))
          setConflict(true);
        throw caught;
      }
    });
  }

  function inherit(source: string) {
    void perform(async () => {
      const created = await api<{ report: SampleReport }>("?action=inherit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ week: source }),
      });
      applyReport(created.report);
      await refreshListing();
      setMessage(
        `Đã kế thừa ${created.report.rows.length} mẫu sang tuần ${formatWeekRange(created.report.week)}. Hãy cập nhật những mẫu có thay đổi rồi lưu.`,
      );
    });
  }

  function importFile(file?: File) {
    if (!file) return;
    guard(() => {
      // Snapshot the screen before the file replaces it, so "Hủy nhập file"
      // can put back exactly what was there.
      const restore = { current, week, reportDate, rows, changeNote, dirty };
      void perform(async () => {
        if (!/\.(xlsx|xlsm)$/i.test(file.name) || file.size > 2_000_000)
          throw new Error("Chọn file .xlsx hoặc .xlsm, dung lượng tối đa 2 MB.");
        const preview = await api<{
          reportDate: string;
          week: string;
          rows: SampleRowInput[];
          issues: ImportIssue[];
        }>("?action=import", { method: "POST", body: file });
        const targetWeek = preview.week || weekStart(todayInBusinessTimezone());
        const listing = await api<{ role: Role; reports: ReportSummary[] }>();
        setReports(listing.reports);
        const existing = listing.reports.find(
          (entry) => entry.week === targetWeek,
        );
        const base = existing
          ? (await api<{ report: SampleReport }>(`?week=${targetWeek}`)).report
          : null;
        setCurrent(base);
        setWeek(targetWeek);
        setReportDate(preview.reportDate || targetWeek);
        setRows(preview.rows.map(asDraftRow));
        setIssues(preview.issues);
        setHistory(null);
        setConflict(false);
        setDraft(null);
        setChangeNote("");
        setDirty(true);
        setImportSession({ fileName: file.name, restore });
        const errors = preview.issues.filter(
          (issue) => issue.severity === "error",
        ).length;
        setMessage(
          `Đã đọc ${preview.rows.length} mẫu cho tuần ${formatWeekRange(targetWeek)}${
            base ? ` (sẽ lưu thành phiên bản ${base.revision + 1})` : ""
          }. ${errors ? `Có ${errors} dòng cần sửa trước khi lưu.` : "Kiểm tra bảng rồi bấm “Lưu báo cáo”."}`,
        );
      });
    });
  }

  /** Removes a whole week: every sample and every revision it ever had. */
  function deleteWeek(reason: string) {
    const target = current?.week;
    if (!target) return;
    void perform(async () => {
      const result = await api<{
        removed: { revisions: number; rows: number };
      }>("", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ week: target, reason }),
      });
      const listing = await api<{ role: Role; reports: ReportSummary[] }>();
      setRole(listing.role);
      setReports(listing.reports);
      setConfirmation(null);
      const next = listing.reports[0];
      if (next) {
        const opened = await api<{ report: SampleReport }>(
          `?week=${next.week}`,
        );
        applyReport(opened.report);
      } else {
        setCurrent(null);
        setRows([]);
        setWeek(weekStart(todayInBusinessTimezone()));
        setReportDate(todayInBusinessTimezone());
        setChangeNote("");
        setDirty(false);
        setIssues([]);
        setImportSession(null);
        setHistory(null);
      }
      setMessage(
        `Đã xóa báo cáo tuần ${formatWeekRange(target)}: ${result.removed.rows} mẫu, ${result.removed.revisions} phiên bản. Có thể nhập lại file khác cho tuần này.`,
      );
    });
  }

  /** Puts the screen back exactly as it was before the file was read. */
  function cancelImport() {
    if (!importSession) return;
    const { fileName, restore } = importSession;
    setCurrent(restore.current);
    setWeek(restore.week);
    setReportDate(restore.reportDate);
    setRows(restore.rows);
    setChangeNote(restore.changeNote);
    setDirty(restore.dirty);
    setIssues([]);
    setImportSession(null);
    setDraft(null);
    setConfirmation(null);
    setError("");
    setMessage(
      `Đã hủy nhập file “${fileName}”. Bảng quay lại như trước khi nhập; không có gì được ghi vào hệ thống.`,
    );
  }

  function download() {
    if (!current) return;
    void perform(async () => {
      const response = await fetch(
        `/api/sample-progress?week=${current.week}&revision=${current.revision}&export=1`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        throw new Error(body.message || "Không xuất được Excel.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `Bao-cao-tien-do-mau-Red-Door-${isoWeekLabel(current.week)}-v${current.revision}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Đã tải file Excel của phiên bản đang xem.");
    });
  }

  function editRow(row: SampleRow) {
    setDraft(toRowInput(row));
    window.setTimeout(
      () =>
        editorAnchor.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      0,
    );
  }

  function applyDraft(row: SampleRowInput) {
    setRows((previous) =>
      previous.some((entry) => entry.id === row.id)
        ? previous.map((entry) =>
            entry.id === row.id ? asDraftRow(row) : entry,
          )
        : [...previous, asDraftRow(row)],
    );
    // The row was just corrected, so its import complaints no longer apply.
    setIssues((previous) =>
      previous.filter((issue) => issue.rowId !== row.id),
    );
    setDraft(null);
    setDirty(true);
  }

  function removeRow(row: SampleRow) {
    setRows((previous) => previous.filter((entry) => entry.id !== row.id));
    setIssues((previous) => previous.filter((issue) => issue.rowId !== row.id));
    if (draft?.id === row.id) setDraft(null);
    setDirty(true);
    setConfirmation(null);
    setMessage(
      `Đã bỏ mẫu STT ${row.number} khỏi bản đang soạn. Các phiên bản đã lưu vẫn giữ nguyên mẫu này.`,
    );
  }

  return (
    <div className="sample-progress space-y-6" aria-busy={busy}>
      <header>
        <p className="eyebrow">Báo cáo hằng tuần</p>
        <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
          Theo dõi tiến độ mẫu
        </h1>
        <p className="text-charcoal/65 mt-4 max-w-3xl">
          {current
            ? `Tuần ${formatWeekRange(current.week)} · Phiên bản ${current.revision} · Lưu bởi ${current.savedByName} lúc ${formatDateTime(current.savedAt)}.`
            : week
              ? `Bản nháp cho tuần ${formatWeekRange(week)} · chưa lưu vào hệ thống.`
              : "Đang tải báo cáo…"}
          {dirty ? " · Có thay đổi chưa lưu." : ""}
        </p>
        {current?.inheritedFrom && (
          <p className="text-charcoal/60 mt-1 text-sm">
            Tuần này được kế thừa từ tuần {formatIsoDate(current.inheritedFrom)}.
          </p>
        )}
      </header>

      <SampleProgressToolbar
        reports={reports}
        current={current}
        editable={role === "editor"}
        busy={busy}
        onOpenWeek={openWeek}
        onStartWeek={startWeek}
        onInherit={() =>
          current &&
          setConfirmation({
            kind: "inherit",
            source: current.week,
            target: addDays(current.week, 7),
          })
        }
        onImport={importFile}
      />

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          <p>{error}</p>
          {conflict && current && (
            <button
              type="button"
              className={`${ghostButtonClass} mt-3`}
              onClick={() =>
                void perform(async () => {
                  const opened = await api<{ report: SampleReport }>(
                    `?week=${current.week}`,
                  );
                  applyReport(opened.report);
                  await refreshListing();
                  setMessage(
                    "Đã mở phiên bản mới nhất. Hãy nhập lại phần thay đổi của bạn rồi lưu.",
                  );
                })
              }
            >
              Mở lại bản mới nhất
            </button>
          )}
        </div>
      )}
      {(message || busy) && (
        // One live region: two would announce over each other, and a save that
        // is still refreshing the week list would show both at once.
        <p
          role="status"
          className={
            message
              ? "rounded-2xl bg-emerald-50 p-4 text-emerald-900"
              : "text-charcoal/65 text-sm"
          }
        >
          {message || "Đang xử lý báo cáo…"}
        </p>
      )}

      {confirmation && (
        <SampleProgressConfirm
          confirmation={confirmation}
          rowCount={rows.length}
          busy={busy}
          onCancel={() => setConfirmation(null)}
          onInherit={(source) => {
            setConfirmation(null);
            inherit(source);
          }}
          onRemove={removeRow}
          onDiscardImport={cancelImport}
          onDeleteWeek={deleteWeek}
          onDiscard={(run) => {
            setDirty(false);
            setDraft(null);
            setConfirmation(null);
            run();
          }}
        />
      )}

      {importSession && (
        <SampleProgressImportPreview
          fileName={importSession.fileName}
          issues={issues}
          rowCount={rows.length}
          busy={busy}
          onCancel={() =>
            setConfirmation({
              kind: "discard-import",
              fileName: importSession.fileName,
            })
          }
        />
      )}


      {historical && (
        <p className="sample-no-print rounded-2xl bg-amber-50 p-4 text-amber-900">
          Đang xem phiên bản {current?.revision} (chỉ đọc). Phiên bản mới nhất là{" "}
          {latestRevision}.{" "}
          {current && (
            <button
              type="button"
              className="underline"
              disabled={busy}
              onClick={() => openWeek(current.week)}
            >
              Mở phiên bản mới nhất
            </button>
          )}
        </p>
      )}

      <section className="sample-report space-y-5">
        <SampleProgressSummary rows={rows} />

        <SampleProgressFilters
          search={search}
          status={statusFilter}
          sort={sort}
          shown={shown.length}
          total={rows.length}
          canAdd={editable && !draft}
          busy={busy}
          onSearch={setSearch}
          onStatus={setStatusFilter}
          onSort={setSort}
          onClear={() => {
            setSearch("");
            setStatusFilter("");
            setSort("report");
          }}
          onAdd={() =>
            setDraft(
              emptyRow(Math.max(0, ...rows.map((row) => row.number)) + 1),
            )
          }
        />

        <div ref={editorAnchor}>
          {draft && editable && (
            <SampleProgressEditor
              draft={draft}
              existing={rows.some((row) => row.id === draft.id)}
              busy={busy}
              otherNumbers={rows
                .filter((row) => row.id !== draft.id)
                .map((row) => row.number)}
              onChange={setDraft}
              onApply={applyDraft}
              onCancel={() => setDraft(null)}
            />
          )}
        </div>

        <SampleProgressTable
          rows={shown}
          total={rows.length}
          editable={editable}
          busy={busy}
          flagged={flagged}
          onEdit={editRow}
          onRemove={(row) => setConfirmation({ kind: "remove", row })}
        />
      </section>

      <section className={`${cardClass} sample-no-print space-y-4`}>
        {editable && (
          <>
            <label className="block text-sm">
              <span className={labelClass}>
                Nội dung cập nhật lần này (bắt buộc khi lưu)
              </span>
              <textarea
                aria-label="Nội dung cập nhật lần này"
                className={fieldClass}
                maxLength={1000}
                rows={2}
                value={changeNote}
                disabled={busy}
                onChange={(event) => {
                  setChangeNote(event.target.value);
                  setDirty(true);
                }}
                placeholder="VD: 2 mẫu chuyển sang hoàn thiện, 1 mẫu đã gửi cho khách."
                required
              />
            </label>
            <label className="block max-w-xs text-sm">
              <span className={labelClass}>Ngày báo cáo</span>
              <input
                aria-label="Ngày báo cáo"
                type="date"
                className={fieldClass}
                value={reportDate}
                min={week}
                max={week ? weekEnd(week) : undefined}
                disabled={busy}
                onChange={(event) => {
                  setReportDate(event.target.value);
                  setDirty(true);
                }}
              />
            </label>
          </>
        )}
        <div className="flex flex-wrap gap-3">
          {editable && (
            <button
              type="button"
              className={buttonClass}
              disabled={
                busy ||
                !dirty ||
                !!draft ||
                !changeNote.trim() ||
                !reportDate ||
                !week ||
                blocking.length > 0
              }
              onClick={save}
            >
              Lưu báo cáo
            </button>
          )}
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy || !current || dirty || !!draft}
            onClick={download}
          >
            Xuất Excel
          </button>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy || !current}
            onClick={() => window.print()}
          >
            In báo cáo
          </button>
          {editable && current && (
            <button
              type="button"
              className={dangerButtonClass}
              disabled={busy || dirty || !!draft}
              onClick={() =>
                setConfirmation({
                  kind: "delete-week",
                  week: current.week,
                  revisions: latestRevision,
                  rows: rows.length,
                })
              }
            >
              Xóa báo cáo tuần này
            </button>
          )}
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy || !current}
            onClick={() =>
              void perform(async () => {
                if (!current) return;
                const listing = await api<{ reports: ReportSummary[] }>(
                  `?week=${current.week}&history=1`,
                );
                setHistory(listing.reports);
              })
            }
          >
            Lịch sử chỉnh sửa
          </button>
        </div>
        <p className="text-charcoal/60 text-sm">
          {draft
            ? "Hãy bấm “Áp dụng vào bảng” cho mẫu đang sửa trước khi lưu báo cáo."
            : blocking.length
              ? `Còn ${blocking.length} dòng nhập từ Excel cần sửa trước khi lưu.`
              : dirty
                ? "Thay đổi chỉ được ghi khi bấm “Lưu báo cáo”. Xuất Excel và in dùng phiên bản đã lưu."
                : "Mỗi lần lưu tạo một phiên bản mới kèm người lưu và thời gian lấy từ máy chủ."}
        </p>
        {filtering && (
          <p className="text-charcoal/60 text-sm">
            Bản in theo bộ lọc đang chọn; file Excel xuất ra luôn gồm toàn bộ
            mẫu của phiên bản đã lưu.
          </p>
        )}
      </section>

      {history && current && (
        <SampleProgressHistory
          entries={history}
          week={current.week}
          busy={busy}
          onOpen={openWeek}
        />
      )}

    </div>
  );
}
