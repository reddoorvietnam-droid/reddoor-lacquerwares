"use client";

import { useMemo, useState } from "react";
import Decimal from "decimal.js";
import {
  debtStateOf,
  formatMoney,
  hasActivity,
  summaryKpis,
  type DebtState,
  type SummaryRow,
} from "@/domains/receivables/contracts";
import {
  fieldClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import {
  badgeClass,
  debtStateLabels,
  debtStates,
  debtTone,
  sortOptions,
} from "./receivables-shared";
import { useReceivables } from "./receivables-workspace";

/**
 * Bảng tổng hợp công nợ — the operational table, kept dense and in the source
 * workbook's column order so the staff read it the way they always have.
 *
 * The three movement columns and the closing balance are never editable here.
 * A wrong number is fixed at its cause: the opening balance, or the entry that
 * moved it. Clicking a figure opens exactly the entries behind it.
 */

type Filters = {
  q: string;
  state: DebtState | "";
  movement: "" | "with" | "without";
  sort: (typeof sortOptions)[number]["id"];
};

const emptyFilters: Filters = {
  q: "",
  state: "",
  movement: "",
  sort: "report",
};

// `hasActivity` is shared with the export, so a downloaded workbook always
// holds exactly the rows that were on screen.

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ${tone ?? "bg-ivory/70 text-charcoal"}`}
    >
      <p className="text-[0.68rem] tracking-[0.12em] uppercase opacity-70">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

export function ReceivablesSummary({ loading }: { loading: boolean }) {
  const {
    summary,
    amountsVisible,
    capabilities,
    openCustomer,
    openLedger,
    window: dateWindow,
    showUntouched,
    setShowUntouched,
  } = useReceivables();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  // Filtering and sorting only change what is on screen; the ledger is never
  // touched, and the total line always describes exactly the visible rows.
  const rows = useMemo(() => {
    const needle = filters.q.trim().toLocaleLowerCase("vi");
    const visible = summary.filter((row) => {
      if (!showUntouched && !hasActivity(row)) return false;
      if (filters.state && row.state !== filters.state) return false;
      if (filters.movement === "with" && row.entryCount === 0) return false;
      if (filters.movement === "without" && row.entryCount > 0) return false;
      if (!needle) return true;
      return [row.code, row.name, row.phone]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(needle);
    });
    const compare: Record<
      Filters["sort"],
      ((a: SummaryRow, b: SummaryRow) => number) | null
    > = {
      // `null` keeps the server's order: the workbook's own row order.
      report: null,
      code: (a, b) => a.code.localeCompare(b.code, "vi"),
      name: (a, b) => a.name.localeCompare(b.name, "vi"),
      closingDesc: (a, b) => new Decimal(b.closing).comparedTo(a.closing),
      closingAsc: (a, b) => new Decimal(a.closing).comparedTo(b.closing),
      increase: (a, b) => new Decimal(b.increase).comparedTo(a.increase),
      decrease: (a, b) => new Decimal(b.decrease).comparedTo(a.decrease),
    };
    const order = compare[filters.sort];
    return order ? [...visible].sort(order) : visible;
  }, [summary, filters, showUntouched]);

  // KPIs describe exactly the rows on screen, so the cards and the table can
  // never tell two different stories.
  const visibleKpis = useMemo(() => summaryKpis(rows), [rows]);

  const visibleTotals = useMemo(() => {
    const sum = rows.reduce(
      (carry, row) => ({
        opening: carry.opening.plus(row.opening),
        increase: carry.increase.plus(row.increase),
        decrease: carry.decrease.plus(row.decrease),
      }),
      {
        opening: new Decimal(0),
        increase: new Decimal(0),
        decrease: new Decimal(0),
      },
    );
    return {
      opening: sum.opening.toFixed(),
      increase: sum.increase.toFixed(),
      decrease: sum.decrease.toFixed(),
      closing: sum.opening.plus(sum.increase).minus(sum.decrease).toFixed(),
    };
  }, [rows]);

  const money = (value: string) => (amountsVisible ? formatMoney(value) : "—");
  const filtered = rows.length !== summary.length;

  return (
    <div className="space-y-4">
      {amountsVisible && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Tổng dư nợ"
            value={`${formatMoney(visibleKpis.outstanding)} ₫`}
            hint={`${visibleKpis.owing} khách còn nợ`}
            tone={debtTone.OWING.card}
          />
          <Kpi
            label="Đã thanh toán"
            value={String(visibleKpis.settled)}
            hint="khách có số dư bằng 0"
            tone={debtTone.SETTLED.card}
          />
          <Kpi
            label="Dư trả trước"
            value={`${formatMoney(visibleKpis.prepaidAmount)} ₫`}
            hint={`${visibleKpis.prepaid} khách trả trước`}
            tone={debtTone.PREPAID.card}
          />
          <Kpi
            label="Khách đang theo dõi"
            value={String(visibleKpis.customers)}
            hint={
              dateWindow.to
                ? `tính đến ${dateWindow.to.split("-").reverse().join("/")}`
                : "toàn kỳ 2026"
            }
          />
        </div>
      )}

      <div className="receivables-no-print flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label className={labelClass} htmlFor="receivables-search">
            Tìm khách hàng
          </label>
          <input
            id="receivables-search"
            type="search"
            className={fieldClass}
            placeholder="Mã khách, tên hoặc số điện thoại"
            value={filters.q}
            onChange={(event) =>
              setFilters((current) => ({ ...current, q: event.target.value }))
            }
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="receivables-state">
            Trạng thái
          </label>
          <select
            id="receivables-state"
            className={fieldClass}
            value={filters.state}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                state: event.target.value as DebtState | "",
              }))
            }
          >
            <option value="">Tất cả</option>
            {debtStates.map((state) => (
              <option key={state} value={state}>
                {debtStateLabels[state]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="receivables-movement">
            Phát sinh
          </label>
          <select
            id="receivables-movement"
            className={fieldClass}
            value={filters.movement}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                movement: event.target.value as Filters["movement"],
              }))
            }
          >
            <option value="">Tất cả</option>
            <option value="with">Có phát sinh</option>
            <option value="without">Không phát sinh</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="receivables-sort">
            Sắp xếp
          </label>
          <select
            id="receivables-sort"
            className={fieldClass}
            value={filters.sort}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sort: event.target.value as Filters["sort"],
              }))
            }
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <label className="text-charcoal/70 mb-2 inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showUntouched}
            onChange={(event) => setShowUntouched(event.target.checked)}
          />
          Hiện cả khách chưa phát sinh
        </label>
      </div>

      <div className={tableWrapClass}>
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <caption className="sr-only">
            Bảng tổng hợp công nợ khách hàng năm 2026
          </caption>
          <thead className={`${theadClass} bg-ivory/60 sticky top-0 z-10`}>
            <tr>
              <th scope="col" className={`${thClass} w-14`}>
                STT
              </th>
              <th scope="col" className={thClass}>
                Mã khách
              </th>
              <th scope="col" className={thClass}>
                Tên khách hàng
              </th>
              <th scope="col" className={thClass}>
                Số điện thoại
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Dư đầu
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Phát sinh tăng
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Phát sinh giảm
              </th>
              <th scope="col" className={`${thClass} text-right`}>
                Dư hiện tại
              </th>
              <th scope="col" className={thClass}>
                Chú ý
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={9}>
                  Đang tải…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={9}>
                  Không có khách hàng nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {rows.map((row, index) => {
              const state = amountsVisible ? row.state : debtStateOf("0");
              return (
                <tr
                  key={row.customerId}
                  className="border-burgundy/10 hover:bg-ivory/50 border-b"
                >
                  <td className={`${tdClass} text-charcoal/60 tabular-nums`}>
                    {index + 1}
                  </td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      className="text-burgundy font-semibold underline-offset-2 hover:underline"
                      onClick={() => openCustomer(row.customerId)}
                    >
                      {row.code}
                    </button>
                    {!row.active && (
                      <span
                        className={`${badgeClass} ml-2 bg-stone-100 text-stone-700 ring-1 ring-stone-300`}
                      >
                        Ngừng
                      </span>
                    )}
                  </td>
                  <td className={tdClass}>{row.name || "—"}</td>
                  <td className={`${tdClass} tabular-nums`}>
                    {row.phone || "—"}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {money(row.opening)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {amountsVisible && !new Decimal(row.increase).isZero() ? (
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        title="Xem các dòng bán hàng tạo nên số này"
                        onClick={() => openLedger("sales", row.customerId)}
                      >
                        {formatMoney(row.increase)}
                      </button>
                    ) : (
                      money(row.increase)
                    )}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {amountsVisible && !new Decimal(row.decrease).isZero() ? (
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        title="Xem các dòng thanh toán / giảm nợ tạo nên số này"
                        onClick={() => openLedger("reductions", row.customerId)}
                      >
                        {formatMoney(row.decrease)}
                      </button>
                    ) : (
                      money(row.decrease)
                    )}
                  </td>
                  <td
                    className={`${tdClass} text-right font-semibold tabular-nums ${
                      amountsVisible ? debtTone[row.state].amount : ""
                    }`}
                  >
                    {money(row.closing)}
                  </td>
                  <td className={tdClass}>
                    {amountsVisible && (
                      <span
                        className={`${badgeClass} ${debtTone[state].badge}`}
                      >
                        {debtStateLabels[row.state]}
                      </span>
                    )}
                    {row.note && (
                      <span className="text-charcoal/60 ml-2 text-xs">
                        {row.note}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-burgundy/25 bg-ivory/70 border-t-2 font-semibold">
              <td className={tdClass} colSpan={4}>
                Cộng tổng
                {filtered && (
                  <span className="text-charcoal/55 ml-2 text-xs font-normal">
                    ({rows.length}/{summary.length} khách đang hiển thị)
                  </span>
                )}
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {money(visibleTotals.opening)}
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {money(visibleTotals.increase)}
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {money(visibleTotals.decrease)}
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>
                {money(visibleTotals.closing)}
              </td>
              <td className={tdClass} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-charcoal/55 text-xs">
        Dư hiện tại = Dư đầu + Phát sinh tăng − Phát sinh giảm, tính lại từ sổ
        sau mỗi lần ghi. Không sửa trực tiếp được: muốn đổi số dư, hãy sửa dư
        đầu kỳ hoặc giao dịch tương ứng.
        {capabilities.export &&
          " Bấm vào một số phát sinh để xem đúng những giao dịch tạo nên nó."}
      </p>
      {!amountsVisible && (
        <p className="text-charcoal/55 text-xs">
          Các cột số tiền hiển thị “—” vì tài khoản của bạn không có quyền xem
          số tiền công nợ. Máy chủ không gửi số về trình duyệt.
        </p>
      )}
    </div>
  );
}
