"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  Capabilities,
  ExportScope,
  Facility,
  HistoryListResponse,
  ImportPreview,
  Lookups,
  MasterKind,
  Material,
  MaterialTransaction,
  SummaryKpis,
  SummaryRow,
  TransactionType,
} from "@/domains/materials/contracts";
import {
  buttonClass,
  cardClass,
  formatDateTime,
  ghostButtonClass,
} from "@/components/admin/sample-progress-shared";
import {
  cancelTransaction,
  downloadExport,
  fetchHistory,
  fetchMasters,
  fetchSummary,
  importWorkbook,
  saveMasters,
  ApiError,
} from "./api";
import { MaterialsCatalog } from "./catalog-tab";
import { MaterialsLedger } from "./ledger-tab";
import {
  MaterialsConfirm,
  MaterialsImportPreview,
  type MaterialsConfirmation,
} from "./materials-confirm";
import { MaterialsHistory } from "./materials-history";
import {
  errorMessage,
  isTab,
  masterLabel,
  slipLabels,
  tabs,
  type Tab,
} from "./materials-shared";
import { PasteFromExcel } from "./paste-panel";
import { MaterialsSummary } from "./summary-tab";

/**
 * One screen, four tabs, shared master data and stock. Every tab stays
 * mounted (hidden) so filters and an open editor survive switching between
 * nhập and xuất. Every "Áp dụng" writes immediately; there is no batch save.
 */

export type MaterialFilter = { id: string; code: string };

type HeaderCounts = {
  transactions: number;
  lastActivity: HistoryListResponse["lastActivity"];
};

export type MaterialsContextValue = {
  materials: Material[];
  facilities: Facility[];
  capabilities: Capabilities;
  lookups: Lookups;
  /** Current balances by material id (whole catalogue), refreshed after every write. */
  stock: Map<string, SummaryRow>;
  /** Bumped after every stock refresh (initial load included); tabs reload on it. */
  stockVersion: number;
  kpis: SummaryKpis;
  /** Display names seen in the audit log, for the "Người ghi" columns. */
  actorNames: ReadonlyMap<string, string>;
  busy: boolean;
  tab: Tab;
  refreshAll: () => Promise<void>;
  refreshStock: () => Promise<void>;
  notify: (message: string) => void;
  fail: (reason: unknown, fallback?: string) => void;
  confirm: (confirmation: MaterialsConfirmation | null) => void;
  /** Runs now, or after the reader agrees to drop an editor with changes. */
  guard: (run: () => void) => void;
  setEditorDirty: (dirty: boolean) => void;
  /** Bumped when the reader discards an editor; open editors close on it. */
  discardSeq: number;
  materialFilter: MaterialFilter | null;
  setMaterialFilter: (filter: MaterialFilter | null) => void;
  openLedger: (type: TransactionType, material: MaterialFilter) => void;
  openedMaterial: string | null;
  openMaterial: (materialId: string) => void;
  closeMaterial: () => void;
  setTabFilters: (tab: Tab, params: URLSearchParams) => void;
};

const noCapabilities: Capabilities = {
  read: false,
  manageCatalog: false,
  receive: false,
  issue: false,
  cancel: false,
  export: false,
  import: false,
};
const noKpis: SummaryKpis = {
  materials: 0,
  inStock: 0,
  lowStock: 0,
  outOfStock: 0,
};
const exportScope: Record<Tab, ExportScope> = {
  summary: "summary",
  inbound: "inbound",
  outbound: "outbound",
  catalog: "all",
};

const MaterialsContext = createContext<MaterialsContextValue | null>(null);

export function useMaterials(): MaterialsContextValue {
  const value = useContext(MaterialsContext);
  if (!value) throw new Error("useMaterials ngoài MaterialsWorkspace");
  return value;
}

export function MaterialsWorkspace() {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-charcoal/65 text-sm">
          Đang tải kho nguyên vật liệu…
        </p>
      }
    >
      <Workspace />
    </Suspense>
  );
}

type ImportSession = {
  file: File;
  preview: ImportPreview;
  includeDuplicates: boolean;
};

function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const tab: Tab = isTab(urlTab) ? urlTab : "summary";

  const [materials, setMaterials] = useState<Material[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [capabilities, setCapabilities] =
    useState<Capabilities>(noCapabilities);
  const [stock, setStock] = useState<Map<string, SummaryRow>>(new Map());
  const [stockVersion, setStockVersion] = useState(0);
  const [kpis, setKpis] = useState<SummaryKpis>(noKpis);
  const [counts, setCounts] = useState<HeaderCounts | null>(null);
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] =
    useState<MaterialsConfirmation | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [discardSeq, setDiscardSeq] = useState(0);
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter | null>(
    null,
  );
  const [openedMaterial, setOpenedMaterial] = useState<string | null>(null);
  const [importSession, setImportSession] = useState<ImportSession | null>(
    null,
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const tabFilters = useRef(new Map<Tab, URLSearchParams>());
  const fileInput = useRef<HTMLInputElement>(null);
  const busy = loading || working;

  const notify = useCallback((text: string) => {
    setMessage(text);
    setError("");
  }, []);
  const fail = useCallback(
    (reason: unknown, fallback = "Thao tác chưa thành công.") => {
      setError(errorMessage(reason, fallback));
      setMessage("");
    },
    [],
  );

  const refreshMasters = useCallback(async () => {
    const response = await fetchMasters();
    setMaterials(response.materials);
    setFacilities(response.facilities);
    setCapabilities(response.capabilities);
  }, []);

  const refreshStock = useCallback(async () => {
    try {
      const [summary, history] = await Promise.all([
        fetchSummary(new URLSearchParams({ includeInactive: "1" })),
        fetchHistory({ limit: 50 }),
      ]);
      setStock(new Map(summary.rows.map((row) => [row.materialId, row])));
      setKpis(summary.kpis);
      setCounts({
        transactions: history.transactions,
        lastActivity: history.lastActivity,
      });
      setActorNames((known) => {
        const next = new Map(known);
        for (const entry of history.entries)
          if (entry.actorName) next.set(entry.actor, entry.actorName);
        return next;
      });
    } finally {
      // Bumped even on failure so the ledgers still load; the server enforces stock.
      setStockVersion((version) => version + 1);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshMasters(), refreshStock()]);
  }, [refreshMasters, refreshStock]);

  useEffect(() => {
    // Deferred so StrictMode's double invoke fetches once.
    let cancelled = false;
    const initial = setTimeout(() => {
      void (async () => {
        try {
          await refreshAll();
        } catch (reason) {
          if (!cancelled)
            setError(
              errorMessage(reason, "Không tải được kho nguyên vật liệu."),
            );
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(initial);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!editorDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editorDirty]);

  const guard = useCallback(
    (run: () => void) => {
      if (!editorDirty) run();
      else setConfirmation({ kind: "discard-edit", run });
    },
    [editorDirty],
  );

  const selectTab = useCallback(
    (next: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}` as Route, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const openLedger = useCallback(
    (type: TransactionType, material: MaterialFilter) =>
      guard(() => {
        setMaterialFilter(material);
        selectTab(type === "INBOUND" ? "inbound" : "outbound");
      }),
    [guard, selectTab],
  );
  const openMaterial = useCallback(
    (materialId: string) => guard(() => setOpenedMaterial(materialId)),
    [guard],
  );
  const closeMaterial = useCallback(
    () => guard(() => setOpenedMaterial(null)),
    [guard],
  );
  const setTabFilters = useCallback((target: Tab, params: URLSearchParams) => {
    tabFilters.current.set(target, params);
  }, []);

  const lookups = useMemo<Lookups>(
    () => ({ materials, facilities }),
    [materials, facilities],
  );

  const value = useMemo<MaterialsContextValue>(
    () => ({
      materials,
      facilities,
      capabilities,
      lookups,
      stock,
      stockVersion,
      kpis,
      actorNames,
      busy,
      tab,
      refreshAll,
      refreshStock,
      notify,
      fail,
      confirm: setConfirmation,
      guard,
      setEditorDirty,
      discardSeq,
      materialFilter,
      setMaterialFilter,
      openLedger,
      openedMaterial,
      openMaterial,
      closeMaterial,
      setTabFilters,
    }),
    [
      actorNames,
      discardSeq,
      busy,
      capabilities,
      closeMaterial,
      facilities,
      fail,
      guard,
      kpis,
      lookups,
      materialFilter,
      materials,
      notify,
      openLedger,
      openMaterial,
      openedMaterial,
      refreshAll,
      refreshStock,
      setTabFilters,
      stock,
      stockVersion,
      tab,
    ],
  );

  /** One global operation at a time; errors land in the red alert. */
  async function perform(work: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await work();
    } catch (reason) {
      fail(reason);
    } finally {
      setWorking(false);
    }
  }

  function exportCurrent() {
    void perform(async () => {
      await downloadExport(
        exportScope[tab],
        tabFilters.current.get(tab) ?? new URLSearchParams(),
      );
      notify("Đã tải file Excel của tab đang xem.");
    });
  }

  function importFile(file?: File) {
    if (!file) return;
    void perform(async () => {
      if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024)
        throw new Error("Chọn file .xlsx theo mẫu RedDoor - NVL, tối đa 5 MB.");
      const preview = await importWorkbook(file, "preview", false);
      setImportSession({ file, preview, includeDuplicates: false });
      setPasteOpen(false);
      notify(
        `Đã đọc ${preview.rows.length} dòng từ “${file.name}”: ${preview.counts.valid} hợp lệ. Kiểm tra bảng rồi bấm “Nhập … dòng vào kho”.`,
      );
    });
  }

  function applyImport() {
    if (!importSession) return;
    const { file, includeDuplicates } = importSession;
    void perform(async () => {
      const result = await importWorkbook(file, "apply", includeDuplicates);
      setImportSession(null);
      await refreshAll();
      notify(
        `Đã nhập ${result.imported} dòng từ “${file.name}” vào kho, bỏ qua ${result.skipped} dòng.`,
      );
    });
  }

  function cancelLine(row: MaterialTransaction, reason: string) {
    void perform(async () => {
      try {
        await cancelTransaction({ id: row.id, version: row.version, reason });
      } catch (reason) {
        // The row changed under us: close the panel and reload fresh versions
        // so the next attempt does not resend the stale one.
        if (reason instanceof ApiError && reason.status === 409) {
          setConfirmation(null);
          void refreshStock();
        }
        throw reason;
      }
      setConfirmation(null);
      await refreshStock();
      notify(
        `Đã hủy ${slipLabels[row.type]} ${row.materialName} (${row.materialCode}); tồn kho đã tính lại.`,
      );
    });
  }

  function deactivate(master: Material | Facility, kind: MasterKind) {
    void perform(async () => {
      await saveMasters(kind, [
        { id: master.id, version: master.version, patch: { active: false } },
      ]);
      setConfirmation(null);
      await refreshAll();
      notify(
        `Đã ngừng dùng ${kind === "material" ? "vật tư" : "cơ sở"} ${masterLabel(master)}.`,
      );
    });
  }

  const canPaste = capabilities.receive || capabilities.issue;
  const headerLine = [
    "Kho nguyên vật liệu 2026",
    `${kpis.materials} vật tư đang theo dõi`,
    counts ? `${counts.transactions} giao dịch` : null,
    counts?.lastActivity
      ? `Cập nhật gần nhất ${formatDateTime(counts.lastActivity.occurredAt)} bởi ${counts.lastActivity.actorName}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MaterialsContext.Provider value={value}>
      <div className="materials-page space-y-6" aria-busy={busy}>
        <header>
          <p className="eyebrow">Kho / Quản lý kho</p>
          <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
            Nguyên vật liệu
          </h1>
          <p className="text-charcoal/65 mt-4 max-w-3xl">
            {loading ? "Đang tải kho nguyên vật liệu…" : `${headerLine}.`}
          </p>
        </header>

        <section className={`${cardClass} materials-no-print space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Sổ kho"
              className="flex flex-wrap gap-2"
            >
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`materials-tab-${item.id}`}
                  aria-selected={item.id === tab}
                  aria-controls={`materials-panel-${item.id}`}
                  className={item.id === tab ? buttonClass : ghostButtonClass}
                  onClick={() =>
                    item.id !== tab && guard(() => selectTab(item.id))
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {capabilities.import && (
                <>
                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                  >
                    Nhập Excel
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".xlsx"
                    aria-label="File sổ nhập / xuất NVL"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      // Clear it so choosing the same file twice fires again.
                      event.target.value = "";
                      importFile(file);
                    }}
                  />
                </>
              )}
              {canPaste && (
                <button
                  type="button"
                  className={ghostButtonClass}
                  disabled={busy}
                  aria-pressed={pasteOpen}
                  onClick={() => setPasteOpen((open) => !open)}
                >
                  Dán từ Excel
                </button>
              )}
              {capabilities.export && (
                <button
                  type="button"
                  className={ghostButtonClass}
                  disabled={busy}
                  onClick={exportCurrent}
                >
                  Xuất Excel
                </button>
              )}
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy}
                onClick={() => window.print()}
              >
                In báo cáo
              </button>
            </div>
          </div>
          <p className="text-charcoal/60 text-sm">
            Tồn cuối = Tồn đầu + Nhập − Xuất, tính từ các giao dịch đã ghi. Mỗi
            phiếu được ghi ngay khi bấm Áp dụng và có lịch sử người thực hiện.
          </p>
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
          >
            {error}
          </div>
        )}
        {(message || busy) && (
          <p
            role="status"
            className={
              message
                ? "rounded-2xl bg-emerald-50 p-4 text-emerald-900"
                : "text-charcoal/65 text-sm"
            }
          >
            {message || "Đang xử lý…"}
          </p>
        )}

        {confirmation && (
          <MaterialsConfirm
            confirmation={confirmation}
            busy={busy}
            onCancel={() => setConfirmation(null)}
            onCancelLine={cancelLine}
            onDiscard={(run) => {
              setEditorDirty(false);
              // Closes the dirty editor everywhere; otherwise it would stay
              // mounted and submittable with the guards switched off.
              setDiscardSeq((seq) => seq + 1);
              setConfirmation(null);
              run();
            }}
            onDiscardImport={() => {
              const name = importSession?.file.name ?? "";
              setImportSession(null);
              setConfirmation(null);
              notify(
                `Đã hủy nhập file “${name}”; không có gì được ghi vào kho.`,
              );
            }}
            onDeactivate={deactivate}
          />
        )}

        {importSession && (
          <MaterialsImportPreview
            fileName={importSession.file.name}
            preview={importSession.preview}
            includeDuplicates={importSession.includeDuplicates}
            busy={busy}
            onToggleDuplicates={(includeDuplicates) =>
              setImportSession({ ...importSession, includeDuplicates })
            }
            onApply={applyImport}
            onCancel={() =>
              setConfirmation({
                kind: "discard-import",
                fileName: importSession.file.name,
              })
            }
          />
        )}

        {pasteOpen && canPaste && (
          <PasteFromExcel onClose={() => setPasteOpen(false)} />
        )}

        <section className="materials-report space-y-5">
          {tabs.map((item) => (
            <div
              key={item.id}
              role="tabpanel"
              id={`materials-panel-${item.id}`}
              aria-labelledby={`materials-tab-${item.id}`}
              hidden={item.id !== tab}
              className="space-y-5"
            >
              {item.id === "summary" && <MaterialsSummary />}
              {item.id === "inbound" && <MaterialsLedger type="INBOUND" />}
              {item.id === "outbound" && <MaterialsLedger type="OUTBOUND" />}
              {item.id === "catalog" && <MaterialsCatalog />}
            </div>
          ))}
        </section>

        <datalist id="materials-codes">
          {materials
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.id} value={m.code}>
                {m.name}
                {m.unit ? ` (${m.unit})` : ""}
              </option>
            ))}
        </datalist>
        <datalist id="facility-codes">
          {facilities
            .filter((f) => f.active)
            .map((f) => (
              <option key={f.id} value={f.code}>
                {f.name}
              </option>
            ))}
        </datalist>

        <section className={`${cardClass} materials-no-print space-y-4`}>
          <div className="flex flex-wrap gap-3">
            {capabilities.export && (
              <button
                type="button"
                className={ghostButtonClass}
                disabled={busy}
                onClick={exportCurrent}
              >
                Xuất Excel
              </button>
            )}
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              onClick={() => window.print()}
            >
              In báo cáo
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy}
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              Lịch sử chỉnh sửa
            </button>
          </div>
          <p className="text-charcoal/60 text-sm">
            File Excel và bản in theo tab và bộ lọc đang xem. Mỗi phiếu ghi, sửa
            hay hủy đều lưu người thực hiện và thời gian lấy từ máy chủ.
          </p>
        </section>

        {historyOpen && <MaterialsHistory />}
      </div>
    </MaterialsContext.Provider>
  );
}
