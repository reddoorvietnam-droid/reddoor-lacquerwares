"use client";

import {
  formatWeekRange,
  type ReportSummary,
} from "@/domains/sample-progress/contracts";
import {
  cardClass,
  formatDateTime,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "./sample-progress-shared";

/** Every revision ever saved for a week; nothing here can be edited or removed. */
export function SampleProgressHistory({
  entries,
  week,
  busy,
  onOpen,
}: {
  entries: readonly ReportSummary[];
  week: string;
  busy: boolean;
  onOpen: (week: string, revision: number) => void;
}) {
  return (
    <section className={`${cardClass} sample-no-print`}>
      <h2 className="text-burgundy mb-4 font-serif text-2xl">
        Lịch sử chỉnh sửa tuần {formatWeekRange(week)}
      </h2>
      <div className={tableWrapClass}>
        <table className="w-full border-collapse text-sm">
          <thead className={theadClass}>
            <tr>
              <th scope="col" className={thClass}>
                Phiên bản
              </th>
              <th scope="col" className={thClass}>
                Số mẫu
              </th>
              <th scope="col" className={thClass}>
                Người lưu
              </th>
              <th scope="col" className={thClass}>
                Thời gian lưu
              </th>
              <th scope="col" className={thClass}>
                Nội dung cập nhật
              </th>
              <th scope="col" className={thClass}>
                Xem
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.revision} className="border-burgundy/10 border-t">
                <td className={`${tdClass} font-semibold`}>{entry.revision}</td>
                <td className={tdClass}>{entry.count}</td>
                <td className={tdClass}>{entry.savedByName}</td>
                <td className={tdClass}>{formatDateTime(entry.savedAt)}</td>
                <td className={`${tdClass} whitespace-pre-wrap`}>
                  {entry.changeNote}
                </td>
                <td className={tdClass}>
                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={busy}
                    onClick={() => onOpen(entry.week, entry.revision)}
                  >
                    Xem phiên bản {entry.revision}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
