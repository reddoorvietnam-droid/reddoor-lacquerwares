"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  displayDate,
  formatVnd,
  noCapabilities,
  salesSlipStatuses,
  statusLabels,
  type Capabilities,
  type SalesSlip,
  type SortOption,
} from "@/domains/sales-slips/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  formatDateTime,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { fetchCreators, fetchMasters, fetchSlips } from "./api";
import { salesBadgeClass, StatusBadge } from "./shared";

/**
 * The slip list, laid out like the materials ledger: a filter row that applies
 * at once (text search after a pause), a server-paged table with a pinned
 * action column, and no money for readers without `readPrice`.
 */

type Filters = {
  from: string;
  to: string;
  recipient: string;
  q: string;
  status: string;
  createdBy: string;
  sort: SortOption;
  showCancelled: boolean;
};

const emptyFilters: Filters = {
  from: "",
  to: "",
  recipient: "",
  q: "",
  status: "",
  createdBy: "",
  sort: "newest",
  showCancelled: false,
};

const isFiltering = (filters: Filters) =>
  !!filters.from ||
  !!filters.to ||
  !!filters.recipient.trim() ||
  !!filters.q.trim() ||
  !!filters.status ||
  !!filters.createdBy ||
  filters.sort !== "newest" ||
  filters.showCancelled;

const toParams = (filters: Filters, offset: number) => {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.recipient.trim())
    params.set("recipient", filters.recipient.trim());
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.createdBy) params.set("createdBy", filters.createdBy);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  // Cancelled slips stay out of the list unless asked for, or a status is chosen.
  if (!filters.showCancelled && !filters.status)
    params.set("hideCancelled", "1");
  if (offset) params.set("offset", String(offset));
  return params;
};

/**
 * What the header sentence reports: fetched once on mount, unfiltered, and
 * never touched by the filtered list.
 */
type Overview = { total: number; newest: SalesSlip | null };

const newestOf = (slips: SalesSlip[]): SalesSlip | null =>
  slips.reduce<SalesSlip | null>(
    (best, slip) =>
      best === null || slip.updatedAt > best.updatedAt ? slip : best,
    null,
  );

export function SalesSlipList({ basePath }: { basePath: string }) {
  const [capabilities, setCapabilities] =
    useState<Capabilities>(noCapabilities);
  const [creators, setCreators] = useState<{ id: string; name: string }[]>([]);
  const [inputs, setInputs] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [slips, setSlips] = useState<SalesSlip[]>([]);
  const [people, setPeople] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewPending, setOverviewPending] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);

  // The text boxes apply after a pause; every other control applies at once.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setApplied((previous) =>
          previous.q === inputs.q && previous.recipient === inputs.recipient
            ? previous
            : { ...previous, q: inputs.q, recipient: inputs.recipient },
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [inputs.q, inputs.recipient]);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      const seq = ++requestSeq.current;
      try {
        const result = await fetchSlips(toParams(applied, offset));
        // A newer load (filter change, retry) supersedes this response.
        if (seq !== requestSeq.current) return;
        setSlips((previous) => {
          if (!append) return result.slips;
          // Never list an id twice, whatever the server offsets did meanwhile.
          const known = new Set(previous.map((slip) => slip.id));
          return [
            ...previous,
            ...result.slips.filter((slip) => !known.has(slip.id)),
          ];
        });
        setPeople((previous) => ({ ...previous, ...result.people }));
        setTotal(result.total);
        setNextOffset(result.nextOffset);
      } catch (reason) {
        if (seq === requestSeq.current)
          setError(
            reason instanceof Error && reason.message
              ? reason.message
              : "Không thể tải danh sách phiếu.",
          );
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [applied],
  );

  const loadMasters = useCallback(() => {
    void Promise.all([fetchMasters(), fetchCreators()])
      .then(([masters, list]) => {
        setCapabilities(masters.capabilities);
        setCreators(list.creators);
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error && reason.message
            ? reason.message
            : "Không thể tải dữ liệu.",
        ),
      );
  }, []);

  useEffect(() => {
    // Deferred so StrictMode's double invoke fetches once.
    const timer = setTimeout(loadMasters, 0);
    return () => clearTimeout(timer);
  }, [loadMasters]);

  useEffect(() => {
    const timer = setTimeout(() => void load(0, false), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // One unfiltered page for the header sentence (count + latest change),
  // independent of whatever the filters show. A failure here is not worth a
  // banner: the list request surfaces the same problem.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchSlips(new URLSearchParams({ limit: "50" }))
        .then((result) => {
          if (cancelled) return;
          setPeople((previous) => ({ ...previous, ...result.people }));
          setOverview({
            total: result.total,
            newest: newestOf(result.slips),
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setOverviewPending(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  function setFilter(patch: Partial<Filters>) {
    setInputs((previous) => ({ ...previous, ...patch }));
    if (!("q" in patch) && !("recipient" in patch))
      setApplied((previous) => ({ ...previous, ...patch }));
  }

  const filtering = isFiltering(applied);
  const showPrice = capabilities.readPrice;
  const newHref = `${basePath}/new` as Route;
  const busy = loading || loadingMore;

  const headerLine = overview
    ? overview.total === 0 || !overview.newest
      ? "Chưa có phiếu bán hàng nào."
      : `${[
          "Phiếu bán hàng của kho sơn",
          `${overview.total} phiếu`,
          `Cập nhật gần nhất ${formatDateTime(overview.newest.updatedAt)} bởi ${people[overview.newest.updatedBy] ?? overview.newest.updatedBy}`,
        ].join(" · ")}.`
    : `Phiếu bán hàng của kho sơn${overviewPending ? " · Đang tải…" : ""}`;

  return (
    <div className="space-y-6" aria-busy={busy}>
      <header>
        <p className="eyebrow">Bán hàng</p>
        <h1 className="text-burgundy mt-3 font-serif text-4xl md:text-5xl">
          Hóa đơn bán hàng
        </h1>
        <p className="text-charcoal/65 mt-4 max-w-3xl">{headerLine}</p>
      </header>

      <section className={`${cardClass} space-y-4`}>
        {capabilities.create && (
          <div className="flex flex-wrap items-center gap-3">
            <Link href={newHref} className={buttonClass}>
              + Tạo phiếu bán hàng
            </Link>
          </div>
        )}
        <p className="text-charcoal/60 text-sm">
          Mỗi phiếu được lưu ngay khi nhập; xác nhận để khóa người nhận, số
          lượng và đơn giá. Bản in giữ đúng mẫu PHIẾU BÁN HÀNG.
        </p>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              loadMasters();
              void load(0, false);
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
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
          <span className={labelClass}>Người nhận</span>
          <input
            aria-label="Người nhận"
            placeholder="Tên người nhận…"
            className={fieldClass}
            value={inputs.recipient}
            onChange={(event) => setFilter({ recipient: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Tìm</span>
          <input
            aria-label="Tìm phiếu"
            placeholder="Mã phiếu, mã / tên vật tư…"
            className={`${fieldClass} min-w-64`}
            value={inputs.q}
            onChange={(event) => setFilter({ q: event.target.value })}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Trạng thái</span>
          <select
            aria-label="Trạng thái"
            className={fieldClass}
            value={inputs.status}
            onChange={(event) => setFilter({ status: event.target.value })}
          >
            <option value="">Tất cả</option>
            {salesSlipStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={labelClass}>Người lập</span>
          <select
            aria-label="Người lập"
            className={fieldClass}
            value={inputs.createdBy}
            onChange={(event) => setFilter({ createdBy: event.target.value })}
          >
            <option value="">Tất cả</option>
            {creators.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={labelClass}>Sắp xếp</span>
          <select
            aria-label="Sắp xếp"
            className={fieldClass}
            value={inputs.sort}
            onChange={(event) =>
              setFilter({ sort: event.target.value as SortOption })
            }
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="dateDesc">Ngày bán giảm dần</option>
            <option value="dateAsc">Ngày bán tăng dần</option>
            {showPrice && (
              <>
                <option value="totalDesc">Tổng tiền giảm dần</option>
                <option value="totalAsc">Tổng tiền tăng dần</option>
              </>
            )}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inputs.showCancelled}
            onChange={(event) =>
              setFilter({ showCancelled: event.target.checked })
            }
          />
          Hiện phiếu đã hủy
        </label>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={!filtering && !isFiltering(inputs)}
          onClick={() => {
            setInputs(emptyFilters);
            setApplied(emptyFilters);
          }}
        >
          Xóa bộ lọc
        </button>
        <span className="text-charcoal/65 text-sm" role="status">
          {loading ? "Đang tải…" : `Hiển thị ${slips.length}/${total} phiếu`}
        </span>
      </div>

      <div className={tableWrapClass}>
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <caption className="sr-only">Danh sách phiếu bán hàng</caption>
          <thead className={theadClass}>
            <tr>
              <th scope="col" className={thClass}>
                Mã phiếu
              </th>
              <th scope="col" className={thClass}>
                Ngày
              </th>
              <th scope="col" className={`${thClass} whitespace-nowrap`}>
                Trạng thái
              </th>
              <th scope="col" className={thClass}>
                Người nhận
              </th>
              {showPrice && (
                <th
                  scope="col"
                  className={`${thClass} text-right whitespace-nowrap`}
                >
                  Tổng tiền
                </th>
              )}
              <th scope="col" className={thClass}>
                Nội dung
              </th>
              <th
                scope="col"
                className={`${thClass} text-right whitespace-nowrap`}
              >
                Số mặt hàng
              </th>
              <th scope="col" className={thClass}>
                Người lập
              </th>
              <th scope="col" className={`${thClass} whitespace-nowrap`}>
                Cập nhật
              </th>
              {/* Pinned: the table is wider than most screens, and the row
                  actions are useless if they sit off the right edge. */}
              <th
                scope="col"
                className={`${thClass} border-burgundy/12 bg-ivory sticky right-0 border-l whitespace-nowrap`}
              >
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {slips.map((slip) => {
              const cancelled = slip.status === "CANCELLED";
              const cell = `${tdClass} ${cancelled ? "text-charcoal/50 line-through" : ""}`;
              const href = `${basePath}/${slip.id}` as Route;
              const label =
                slip.internalNumber ?? slip.migrationSheet ?? slip.id;
              return (
                <tr
                  key={slip.id}
                  className="border-burgundy/10 hover:bg-ivory/40 border-t align-top"
                >
                  <td className={`${cell} whitespace-nowrap`}>
                    <Link
                      href={href}
                      className="text-burgundy font-semibold underline"
                    >
                      {slip.internalNumber ??
                        `Excel · ${slip.migrationSheet ?? "—"}`}
                    </Link>
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    {displayDate(slip.slipDate)}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <StatusBadge status={slip.status} />
                    {slip.migrationIssues.length > 0 && (
                      <span
                        className={`${salesBadgeClass} ml-2 bg-amber-100 text-amber-900 ring-1 ring-amber-300`}
                        title={slip.migrationIssues.join("\n")}
                      >
                        Cần kiểm tra
                      </span>
                    )}
                  </td>
                  <td className={`${cell} min-w-36`}>
                    {slip.recipientName || "—"}
                  </td>
                  {showPrice && (
                    <td className={`${cell} text-right tabular-nums`}>
                      {formatVnd(slip.totalPayment) || "—"}
                    </td>
                  )}
                  <td
                    className={`${cell} max-w-40 truncate`}
                    title={slip.content || undefined}
                  >
                    {slip.content || "—"}
                  </td>
                  <td className={`${cell} text-right tabular-nums`}>
                    {slip.lines.length}
                  </td>
                  <td className={`${cell} min-w-32`}>
                    {people[slip.createdBy] ?? slip.createdBy}
                  </td>
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatDateTime(slip.updatedAt)}
                  </td>
                  <td
                    className={`${tdClass} border-burgundy/12 sticky right-0 border-l bg-white`}
                  >
                    <div className="flex flex-col items-start gap-2">
                      <Link
                        href={href}
                        className={`${ghostButtonClass} whitespace-nowrap`}
                        aria-label={`Mở phiếu ${label}`}
                      >
                        Mở
                      </Link>
                      {capabilities.print && (
                        <Link
                          href={`${basePath}/${slip.id}/print` as Route}
                          className={`${ghostButtonClass} whitespace-nowrap`}
                          aria-label={`In phiếu ${label}`}
                        >
                          In
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {slips.length === 0 && !loading && (
          <>
            <p className="text-charcoal/65 p-8 text-center" role="status">
              {filtering
                ? "Không có phiếu nào khớp bộ lọc."
                : "Chưa có phiếu bán hàng."}
            </p>
            {!filtering && capabilities.create && (
              <div className="pb-8 text-center">
                <Link href={newHref} className={buttonClass}>
                  + Tạo phiếu bán hàng
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {nextOffset !== null && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={ghostButtonClass}
            disabled={busy}
            onClick={() => void load(nextOffset, true)}
          >
            {loadingMore
              ? "Đang tải…"
              : `Tải thêm (${Math.max(0, total - slips.length)} phiếu còn lại)`}
          </button>
        </div>
      )}
    </div>
  );
}
