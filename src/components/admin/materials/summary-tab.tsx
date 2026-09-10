"use client";

import { useEffect, useMemo, useState } from "react";
import Decimal from "decimal.js";
import { codeKey, type SummaryRow } from "@/domains/materials/contracts";
import {
  fieldClass,
  formatPercent,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { MaterialDetailCard } from "./material-detail";
import { useMaterials } from "./materials-workspace";
import {
  badgeClass,
  formatQuantity,
  stockLabels,
  stockTone,
  stockTones,
  toneOf,
  type StockTone,
} from "./materials-shared";

/**
 * Tổng kho: the whole catalogue lives in the shared stock map, so filtering
 * is instant and the counts always describe the same data the ledgers check.
 */

type Filters = { q: string; unit: string; state: "" | StockTone; all: boolean };
const emptyFilters: Filters = { q: "", unit: "", state: "", all: false };

const nonZero = (value: string) => !new Decimal(value).isZero();
const hasMovement = (row: SummaryRow) =>
  [
    row.inboundQuantity,
    row.outboundQuantity,
    row.adjustmentQuantity,
    row.currentQuantity,
  ].some(nonZero);
/** Mirrors the server's board rule: declared stock, a threshold, or movement. */
const tracked = (row: SummaryRow) =>
  row.minimumStock !== null || nonZero(row.openingQuantity) || hasMovement(row);

function Doughnut({
  slices,
  total,
}: {
  slices: { tone: StockTone; count: number; ratio: number }[];
  total: number;
}) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg
      viewBox="0 0 160 160"
      className="h-40 w-40 shrink-0"
      role="img"
      aria-label={`Biểu đồ tồn kho: ${slices
        .map((slice) => `${stockLabels[slice.tone]} ${slice.count}`)
        .join(", ")}`}
    >
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#e4d9c8"
        strokeWidth="24"
      />
      {total > 0 &&
        slices.map((slice) => {
          const length = slice.ratio * circumference;
          const dash = (
            <circle
              key={slice.tone}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={stockTone[slice.tone].chart}
              strokeWidth="24"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            />
          );
          offset += length;
          return dash;
        })}
      <text
        x="80"
        y="74"
        textAnchor="middle"
        className="fill-burgundy text-[1.5rem] font-semibold"
      >
        {total}
      </text>
      <text
        x="80"
        y="94"
        textAnchor="middle"
        className="fill-charcoal/60 text-[0.6rem]"
      >
        vật tư
      </text>
    </svg>
  );
}

export function MaterialsSummary() {
  const {
    stock,
    kpis,
    busy,
    openLedger,
    openMaterial,
    openedMaterial,
    closeMaterial,
    setTabFilters,
  } = useMaterials();
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const rows = useMemo(() => [...stock.values()], [stock]);
  // Only inactive rows with movement stay on the board, so only they are counted.
  const inactive = rows.filter((row) => !row.active && hasMovement(row)).length;
  const total = kpis.materials + inactive;
  const slices = (
    [
      ["in", kpis.inStock],
      ["low", kpis.lowStock],
      ["out", kpis.outOfStock],
      ["inactive", inactive],
    ] as const
  ).map(([tone, count]) => ({
    tone,
    count,
    ratio: total ? count / total : 0,
  }));

  const units = useMemo(
    () =>
      [...new Set(rows.map((row) => row.unit).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "vi"),
      ),
    [rows],
  );
  const board = rows.filter(
    (row) =>
      filters.all ||
      filters.state === "inactive" ||
      (row.active && tracked(row)) ||
      hasMovement(row),
  );
  const needle = filters.q.trim().toLocaleLowerCase("vi");
  const visible = board.filter((row) => {
    if (
      needle &&
      !`${row.code} ${row.name}`.toLocaleLowerCase("vi").includes(needle)
    )
      return false;
    if (filters.unit && codeKey(row.unit) !== codeKey(filters.unit))
      return false;
    if (filters.state && toneOf(row) !== filters.state) return false;
    return true;
  });
  const filtering =
    !!filters.q || !!filters.unit || !!filters.state || filters.all;

  useEffect(() => {
    // The export route filters server-side with the same names.
    const params = new URLSearchParams();
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.unit) params.set("unit", filters.unit);
    if (filters.state && filters.state !== "inactive")
      params.set("state", filters.state);
    if (filters.all) params.set("includeInactive", "1");
    setTabFilters("summary", params);
  }, [filters, setTabFilters]);

  return (
    <>
      <section
        aria-label="Thống kê tồn kho"
        className="border-burgundy/15 flex flex-wrap items-center gap-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]"
      >
        <Doughnut slices={slices} total={total} />
        <div className="grid min-w-64 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {slices.map((slice) => (
            <div
              key={slice.tone}
              className={`rounded-xl p-4 ${stockTone[slice.tone].card}`}
            >
              <p className="text-xs leading-snug font-semibold">
                {stockLabels[slice.tone]}
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {slice.count}{" "}
                <span className="text-sm font-normal">
                  ({formatPercent(slice.ratio)})
                </span>
              </p>
            </div>
          ))}
        </div>
        <p className="text-charcoal/60 basis-full text-xs">
          Đếm theo vật tư đang theo dõi (có tồn đầu, tồn tối thiểu hoặc giao
          dịch). Sắp hết = tồn cuối không vượt tồn tối thiểu; Hết hàng = tồn
          cuối bằng 0 hoặc âm.
        </p>
      </section>

      {openedMaterial && (
        <MaterialDetailCard
          key={openedMaterial}
          materialId={openedMaterial}
          onClose={closeMaterial}
        />
      )}

      <div className="materials-no-print flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className={labelClass}>Tìm vật tư</span>
          <input
            aria-label="Tìm vật tư"
            placeholder="Mã hoặc tên vật tư…"
            className={`${fieldClass} min-w-64`}
            value={filters.q}
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>ĐVT</span>
          <select
            aria-label="ĐVT"
            className={fieldClass}
            value={filters.unit}
            onChange={(event) =>
              setFilters({ ...filters, unit: event.target.value })
            }
          >
            <option value="">Tất cả ĐVT</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={labelClass}>Trạng thái</span>
          <select
            aria-label="Trạng thái"
            className={fieldClass}
            value={filters.state}
            onChange={(event) =>
              setFilters({
                ...filters,
                state: event.target.value as Filters["state"],
              })
            }
          >
            <option value="">Tất cả trạng thái</option>
            {stockTones.map((tone) => (
              <option key={tone} value={tone}>
                {stockLabels[tone]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.all}
            onChange={(event) =>
              setFilters({ ...filters, all: event.target.checked })
            }
          />
          Hiện toàn bộ danh mục
        </label>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={!filtering}
          onClick={() => setFilters(emptyFilters)}
        >
          Xóa bộ lọc
        </button>
        <span className="text-charcoal/65 text-sm">
          Hiển thị {visible.length}/{board.length} vật tư
        </span>
      </div>

      <div className={`${tableWrapClass} materials-table-wrap`}>
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <caption className="sr-only">Kho nguyên vật liệu 2026</caption>
          <thead className={theadClass}>
            <tr>
              {[
                "STT",
                "Mã vật tư",
                "Vật tư",
                "ĐVT",
                "Tồn đầu",
                "Nhập",
                "Xuất",
                "Tồn cuối",
                "Trạng thái",
                "Ghi chú",
              ].map((label) => (
                <th key={label} scope="col" className={thClass}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const tone = toneOf(row);
              const filter = { id: row.materialId, code: row.code };
              return (
                <tr
                  key={row.materialId}
                  className={`border-burgundy/10 hover:bg-ivory/40 border-t align-top ${row.active ? "" : "text-charcoal/50"}`}
                >
                  <td className={`${tdClass} font-semibold`}>{index + 1}</td>
                  <td className={`${tdClass} font-semibold`}>
                    <button
                      type="button"
                      className="text-burgundy underline"
                      disabled={busy}
                      onClick={() => openMaterial(row.materialId)}
                    >
                      {row.code}
                    </button>
                  </td>
                  <td className={`${tdClass} min-w-52`}>
                    <button
                      type="button"
                      className="text-left underline"
                      disabled={busy}
                      onClick={() => openMaterial(row.materialId)}
                    >
                      {row.name || "—"}
                    </button>
                  </td>
                  <td className={tdClass}>{row.unit || "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {formatQuantity(row.openingQuantity)}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    <button
                      type="button"
                      className="underline"
                      disabled={busy}
                      aria-label={`Sổ nhập của ${row.code}`}
                      onClick={() => openLedger("INBOUND", filter)}
                    >
                      {formatQuantity(row.inboundQuantity)}
                    </button>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    <button
                      type="button"
                      className="underline"
                      disabled={busy}
                      aria-label={`Sổ xuất của ${row.code}`}
                      onClick={() => openLedger("OUTBOUND", filter)}
                    >
                      {formatQuantity(row.outboundQuantity)}
                    </button>
                  </td>
                  <td
                    className={`${tdClass} text-right font-semibold tabular-nums`}
                  >
                    {formatQuantity(row.currentQuantity)}
                  </td>
                  <td className={tdClass}>
                    <span className={`${badgeClass} ${stockTone[tone].badge}`}>
                      {stockLabels[tone]}
                    </span>
                  </td>
                  <td className={`${tdClass} min-w-48 whitespace-pre-wrap`}>
                    {row.note || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-charcoal/65 p-8 text-center">
            {board.length
              ? "Không có vật tư nào khớp bộ lọc. Hãy xóa bộ lọc để xem lại toàn bộ kho."
              : stock.size
                ? "Chưa có vật tư nào đang theo dõi. Bật “Hiện toàn bộ danh mục” để xem danh mục."
                : "Chưa có vật tư nào. Thêm vật tư trong Danh mục NVL để bắt đầu."}
          </p>
        )}
      </div>
    </>
  );
}
