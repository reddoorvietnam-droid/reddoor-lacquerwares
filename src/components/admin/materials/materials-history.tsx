"use client";

import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "@/domains/materials/contracts";
import {
  cardClass,
  formatDateTime,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { fetchHistory } from "./api";
import { useMaterials } from "./materials-workspace";
import { describeAudit, errorMessage } from "./materials-shared";

const pageSize = 50;

/** Every change to the warehouse, newest first; nothing here can be edited. */
export function MaterialsHistory() {
  const { stockVersion } = useMaterials();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);

  useEffect(() => {
    // Reloads after every write so the newest entry is always on top.
    const seq = ++requestSeq.current;
    const initial = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError("");
        try {
          const page = await fetchHistory({ offset: 0, limit: pageSize });
          if (seq !== requestSeq.current) return;
          setEntries(page.entries);
          setTotal(page.total);
          setNextOffset(page.nextOffset);
        } catch (reason) {
          if (seq === requestSeq.current)
            setError(errorMessage(reason, "Không tải được lịch sử."));
        } finally {
          if (seq === requestSeq.current) setLoading(false);
        }
      })();
    }, 0);
    return () => clearTimeout(initial);
  }, [stockVersion]);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoading(true);
    try {
      const page = await fetchHistory({ offset: nextOffset, limit: pageSize });
      setEntries((previous) => {
        const known = new Set(previous.map((entry) => entry.id));
        return [
          ...previous,
          ...page.entries.filter((entry) => !known.has(entry.id)),
        ];
      });
      setTotal(page.total);
      setNextOffset(page.nextOffset);
    } catch (reason) {
      setError(errorMessage(reason, "Không tải thêm được lịch sử."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={`${cardClass} materials-no-print space-y-4`}
      aria-label="Lịch sử chỉnh sửa"
    >
      <h2 className="text-burgundy font-serif text-2xl">Lịch sử chỉnh sửa</h2>
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900"
        >
          {error}
        </p>
      )}
      <div className={tableWrapClass}>
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className={theadClass}>
            <tr>
              {["Thời gian", "Người thực hiện", "Thao tác", "Chi tiết"].map(
                (label) => (
                  <th key={label} scope="col" className={thClass}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const { action, detail } = describeAudit(entry);
              return (
                <tr key={entry.id} className="border-burgundy/10 border-t">
                  <td className={`${tdClass} whitespace-nowrap`}>
                    {formatDateTime(entry.occurredAt)}
                  </td>
                  <td className={tdClass}>{entry.actorName || entry.actor}</td>
                  <td className={`${tdClass} font-semibold`}>{action}</td>
                  <td className={`${tdClass} whitespace-pre-wrap`}>
                    {detail || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {entries.length === 0 && (
          <p className="text-charcoal/65 p-8 text-center" role="status">
            {loading ? "Đang tải lịch sử…" : "Chưa có thay đổi nào được ghi."}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {nextOffset !== null && (
          <button
            type="button"
            className={ghostButtonClass}
            disabled={loading}
            onClick={() => void loadMore()}
          >
            Tải thêm ({Math.max(0, total - entries.length)} mục còn lại)
          </button>
        )}
        <span className="text-charcoal/65 text-sm">
          Hiển thị {entries.length}/{total} mục
        </span>
      </div>
    </section>
  );
}
