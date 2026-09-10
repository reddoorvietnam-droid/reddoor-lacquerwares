"use client";

import { useEffect, useState } from "react";
import type { HistoryResponse } from "@/domains/receivables/contracts";
import {
  formatDateTime,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { fetchHistory } from "./api";
import { actionLabel, historySummary } from "./receivables-shared";
import { useReceivables } from "./receivables-workspace";

/**
 * Nhật ký: every change to a debt figure, newest first — who, when, what and
 * why. It is the audit trail an opening-balance restatement or a cancellation
 * has to leave behind, read straight from the shared audit log.
 */

const PAGE = 50;

export function ReceivablesHistory() {
  const { dataVersion, busy } = useReceivables();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const next = await fetchHistory({ offset, limit: PAGE });
          if (alive) setData(next);
        } finally {
          if (alive) setLoading(false);
        }
      })();
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [offset, dataVersion]);

  return (
    <div className="space-y-4">
      <div className={tableWrapClass}>
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">Nhật ký thay đổi công nợ</caption>
          <thead className={`${theadClass} bg-ivory/60 sticky top-0 z-10`}>
            <tr>
              <th scope="col" className={thClass}>
                Thời điểm
              </th>
              <th scope="col" className={thClass}>
                Người thực hiện
              </th>
              <th scope="col" className={thClass}>
                Thao tác
              </th>
              <th scope="col" className={thClass}>
                Nội dung
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={4}>
                  Đang tải nhật ký…
                </td>
              </tr>
            )}
            {!loading && data && data.entries.length === 0 && (
              <tr>
                <td className={`${tdClass} text-charcoal/60`} colSpan={4}>
                  Chưa có thay đổi nào được ghi lại.
                </td>
              </tr>
            )}
            {data?.entries.map((entry) => (
              <tr key={entry.id} className="border-burgundy/10 border-b">
                <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                  {formatDateTime(entry.occurredAt)}
                </td>
                <td className={tdClass}>{entry.actorName}</td>
                <td className={tdClass}>{actionLabel(entry.action)}</td>
                <td className={`${tdClass} text-charcoal/70`}>
                  {historySummary(entry) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > PAGE && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={ghostButtonClass}
            disabled={offset === 0 || busy}
            onClick={() => setOffset(Math.max(0, offset - PAGE))}
          >
            Trang trước
          </button>
          <span className="text-charcoal/60 text-sm">
            {offset + 1}–{Math.min(offset + PAGE, data.total)} / {data.total}
          </span>
          <button
            type="button"
            className={ghostButtonClass}
            disabled={data.nextOffset === null || busy}
            onClick={() => setOffset(data.nextOffset ?? offset)}
          >
            Trang sau
          </button>
        </div>
      )}
    </div>
  );
}
