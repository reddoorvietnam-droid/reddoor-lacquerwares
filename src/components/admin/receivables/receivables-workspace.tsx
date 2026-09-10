"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  formatMoney,
  noCapabilities,
  todayInBusinessZone,
  type Capabilities,
  type CatalogueItem,
  type ExportScope,
  type ReceivableCustomer,
  type SummaryKpis,
  type SummaryResponse,
  type SummaryRow,
  type SummaryTotals,
} from "@/domains/receivables/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
} from "@/components/admin/sample-progress-shared";
import { ApiError, downloadExport, fetchLookups, fetchSummary } from "./api";
import { CustomerDetailCard } from "./customer-detail";
import { ReceivablesEntries } from "./entries-tab";
import { ReceivablesHistory } from "./receivables-history";
import { errorMessage, isTab, tabs, type Tab } from "./receivables-shared";
import { ReceivablesSummary } from "./summary-tab";

/**
 * One screen, four tabs, one shared date window.
 *
 * The window is deliberately global: `Đến ngày` is how the accountant reads a
 * debt at a point in time, and it has to mean the same thing on the summary, in
 * a customer's ledger and in the exported file. Every figure on screen is
 * computed by the server from the ledger — nothing here adds money up.
 */

export type Window = { from: string; to: string };

export type ReceivablesContextValue = {
  customers: ReceivableCustomer[];
  items: CatalogueItem[];
  capabilities: Capabilities;
  summary: SummaryRow[];
  totals: SummaryTotals;
  kpis: SummaryKpis;
  amountsVisible: boolean;
  window: Window;
  /** Bumped after every write; tabs reload on it. */
  dataVersion: number;
  busy: boolean;
  tab: Tab;
  refreshAll: () => Promise<void>;
  notify: (message: string) => void;
  fail: (reason: unknown, fallback?: string) => void;
  perform: (run: () => Promise<void>) => void;
  openCustomer: (customerId: string) => void;
  openedCustomer: string | null;
  closeCustomer: () => void;
  /** Jumps to a ledger tab already filtered to one customer. */
  openLedger: (tab: "sales" | "reductions", customerId: string) => void;
  ledgerCustomer: string | null;
  setLedgerCustomer: (customerId: string | null) => void;
  windowParams: () => URLSearchParams;
  /** The board's "Hiện cả khách chưa phát sinh" toggle; the export follows it. */
  showUntouched: boolean;
  setShowUntouched: (show: boolean) => void;
};

const noKpis: SummaryKpis = {
  customers: 0,
  owing: 0,
  settled: 0,
  prepaid: 0,
  outstanding: "0",
  prepaidAmount: "0",
};
const noTotals: SummaryTotals = {
  opening: "0",
  increase: "0",
  decrease: "0",
  closing: "0",
};

const ReceivablesContext = createContext<ReceivablesContextValue | null>(null);

export function useReceivables(): ReceivablesContextValue {
  const value = useContext(ReceivablesContext);
  if (!value)
    throw new Error("useReceivables must be used inside ReceivablesWorkspace");
  return value;
}

export function ReceivablesWorkspace() {
  return (
    <Suspense fallback={<p className="text-charcoal/60">Đang tải công nợ…</p>}>
      <Workspace />
    </Suspense>
  );
}

const exportScope: Record<Tab, ExportScope> = {
  summary: "summary",
  sales: "sales",
  reductions: "reductions",
  history: "summary",
};

function Workspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = isTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as Tab)
    : "summary";

  const [customers, setCustomers] = useState<ReceivableCustomer[]>([]);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [capabilities, setCapabilities] =
    useState<Capabilities>(noCapabilities);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [dateWindow, setDateWindow] = useState<Window>({ from: "", to: "" });
  const [dataVersion, setDataVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openedCustomer, setOpenedCustomer] = useState<string | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<string | null>(null);
  const [showUntouched, setShowUntouched] = useState(false);

  const notify = useCallback((text: string) => {
    setError(null);
    setMessage(text);
  }, []);
  const fail = useCallback(
    (reason: unknown, fallback = "Không thực hiện được.") => {
      setMessage(null);
      setError(errorMessage(reason, fallback));
    },
    [],
  );

  const windowParams = useCallback(() => {
    const params = new URLSearchParams();
    if (dateWindow.from) params.set("from", dateWindow.from);
    if (dateWindow.to) params.set("to", dateWindow.to);
    return params;
  }, [dateWindow.from, dateWindow.to]);

  const loadSummary = useCallback(async () => {
    setSummary(await fetchSummary(windowParams()));
  }, [windowParams]);

  const refreshAll = useCallback(async () => {
    const [lookups] = await Promise.all([fetchLookups(), loadSummary()]);
    setCustomers(lookups.customers);
    setItems(lookups.items);
    setCapabilities(lookups.capabilities);
    setDataVersion((version) => version + 1);
  }, [loadSummary]);

  const perform = useCallback(
    (run: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      void (async () => {
        try {
          await run();
        } catch (reason) {
          fail(reason);
        } finally {
          setBusy(false);
        }
      })();
    },
    [fail],
  );

  useEffect(() => {
    // Deferred so StrictMode's double invoke fetches once, and so no state is
    // set synchronously inside the effect body.
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const [lookups, board] = await Promise.all([
            fetchLookups(),
            fetchSummary(windowParams()),
          ]);
          if (!alive) return;
          setCustomers(lookups.customers);
          setItems(lookups.items);
          setCapabilities(lookups.capabilities);
          setSummary(board);
          setDataVersion((version) => version + 1);
        } catch (reason) {
          if (alive)
            fail(
              reason,
              reason instanceof ApiError && reason.status === 403
                ? "Bạn không có quyền xem công nợ."
                : "Không tải được công nợ.",
            );
        } finally {
          if (alive) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [windowParams, fail]);

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

  const value = useMemo<ReceivablesContextValue>(
    () => ({
      customers,
      items,
      capabilities,
      summary: summary?.rows ?? [],
      totals: summary?.totals ?? noTotals,
      kpis: summary?.kpis ?? noKpis,
      amountsVisible: summary?.amountsVisible ?? false,
      window: dateWindow,
      dataVersion,
      busy,
      tab,
      refreshAll,
      notify,
      fail,
      perform,
      openCustomer: setOpenedCustomer,
      openedCustomer,
      closeCustomer: () => setOpenedCustomer(null),
      openLedger: (next, customerId) => {
        setLedgerCustomer(customerId);
        setOpenedCustomer(null);
        selectTab(next);
      },
      ledgerCustomer,
      setLedgerCustomer,
      windowParams,
      showUntouched,
      setShowUntouched,
    }),
    [
      customers,
      items,
      capabilities,
      summary,
      dateWindow,
      dataVersion,
      busy,
      tab,
      refreshAll,
      notify,
      fail,
      perform,
      openedCustomer,
      ledgerCustomer,
      selectTab,
      windowParams,
      showUntouched,
    ],
  );

  const today = todayInBusinessZone();
  const headerLine = loading
    ? "Đang tải công nợ…"
    : [
        value.amountsVisible
          ? `${value.kpis.owing} khách còn nợ ${formatMoney(value.kpis.outstanding)} ₫`
          : `${value.kpis.customers} khách hàng`,
        value.kpis.prepaid > 0 && value.amountsVisible
          ? `${value.kpis.prepaid} khách trả trước ${formatMoney(value.kpis.prepaidAmount)} ₫`
          : null,
        dateWindow.to
          ? `tính đến ${dateWindow.to.split("-").reverse().join("/")}`
          : `tính đến ${today.split("-").reverse().join("/")}`,
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <ReceivablesContext.Provider value={value}>
      <div className="receivables-page space-y-6" aria-busy={busy}>
        <header>
          <p className="eyebrow">Kho / Quản lý kho</p>
          <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
            Công nợ bán sơn
          </h1>
          <p className="text-charcoal/65 mt-4 max-w-3xl">
            Theo dõi phát sinh, thanh toán và số dư công nợ khách hàng.{" "}
            {headerLine}.
          </p>
        </header>

        <section className={`${cardClass} receivables-no-print space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Sổ công nợ"
              className="flex flex-wrap gap-2"
            >
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`receivables-tab-${item.id}`}
                  aria-selected={item.id === tab}
                  aria-controls={`receivables-panel-${item.id}`}
                  className={item.id === tab ? buttonClass : ghostButtonClass}
                  onClick={() => item.id !== tab && selectTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {capabilities.export && (
                <button
                  type="button"
                  className={ghostButtonClass}
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      // The file carries the rows the board is showing, so the
                      // download and the screen can never disagree.
                      const params = windowParams();
                      if (showUntouched) params.set("includeInactive", "1");
                      await downloadExport(exportScope[tab], params);
                      notify("Đã tải file Excel theo bộ lọc đang xem.");
                    })
                  }
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

          {/*
            One window for the whole module. "Đến ngày" alone answers "khách
            còn nợ bao nhiêu tính đến hôm đó"; adding "Từ ngày" turns the
            report into a period statement where everything before it is
            carried in as the opening figure rather than disappearing.
          */}
          <div className="border-burgundy/12 flex flex-wrap items-end gap-3 border-t pt-4">
            <div>
              <label className={labelClass} htmlFor="receivables-from">
                Từ ngày
              </label>
              <input
                id="receivables-from"
                type="date"
                className={fieldClass}
                max={dateWindow.to || today}
                value={dateWindow.from}
                onChange={(event) =>
                  setDateWindow((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="receivables-to">
                Đến ngày
              </label>
              <input
                id="receivables-to"
                type="date"
                className={fieldClass}
                min={dateWindow.from || undefined}
                value={dateWindow.to}
                onChange={(event) =>
                  setDateWindow((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </div>
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy || (!dateWindow.from && !dateWindow.to)}
              onClick={() => setDateWindow({ from: "", to: "" })}
            >
              Bỏ lọc ngày
            </button>
            <p className="text-charcoal/55 max-w-md text-xs">
              {dateWindow.from
                ? "Dư đầu kỳ đã gồm mọi giao dịch trước “Từ ngày”, nên số dư không bị mất khi lọc."
                : "Để trống để xem toàn kỳ 2026 theo dư đầu ngày 02/01/2026."}
            </p>
          </div>
        </section>

        {message && (
          <p
            role="status"
            className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            {message}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900"
          >
            {error}
          </p>
        )}
        {!capabilities.readAmount && !loading && (
          <p className="text-charcoal/70 rounded-2xl bg-stone-50 px-4 py-3 text-sm">
            Tài khoản của bạn xem được danh sách khách hàng nhưng không xem được
            số tiền công nợ.
          </p>
        )}

        {openedCustomer && (
          <CustomerDetailCard
            key={openedCustomer}
            customerId={openedCustomer}
            onClose={() => setOpenedCustomer(null)}
          />
        )}

        <div
          role="tabpanel"
          id={`receivables-panel-${tab}`}
          aria-labelledby={`receivables-tab-${tab}`}
        >
          {tab === "summary" && <ReceivablesSummary loading={loading} />}
          {tab === "sales" && <ReceivablesEntries kind="sales" />}
          {tab === "reductions" && <ReceivablesEntries kind="reductions" />}
          {tab === "history" && <ReceivablesHistory />}
        </div>
      </div>
    </ReceivablesContext.Provider>
  );
}
