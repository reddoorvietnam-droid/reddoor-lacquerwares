"use client";

import {
  formatSampleDate,
  reportColumns,
  statusLabels,
  statusTone,
  type SampleRow,
} from "@/domains/sample-progress/contracts";
import {
  dangerButtonClass,
  formatDateTime,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "./sample-progress-shared";

export function SampleProgressTable({
  rows,
  total,
  editable,
  busy,
  flagged,
  onEdit,
  onRemove,
}: {
  rows: readonly SampleRow[];
  total: number;
  editable: boolean;
  busy: boolean;
  flagged: ReadonlySet<string>;
  onEdit: (row: SampleRow) => void;
  onRemove: (row: SampleRow) => void;
}) {
  return (
    <div className={`${tableWrapClass} sample-table-wrap`}>
      <table className="w-full min-w-[1500px] border-collapse text-sm">
        <caption className="sr-only">
          Bảng theo dõi tiến độ chi tiết từng đơn hàng mẫu
        </caption>
        <thead className={theadClass}>
          <tr>
            {reportColumns.map((label) => (
              <th key={label} scope="col" className={thClass}>
                {label}
              </th>
            ))}
            <th scope="col" className={thClass}>
              Người cập nhật
            </th>
            <th scope="col" className={thClass}>
              Cập nhật lúc
            </th>
            {editable && (
              // Pinned: the table is wider than any screen, and the row actions
              // are useless if they sit off the right edge.
              <th
                scope="col"
                className={`${thClass} sample-no-print border-burgundy/12 bg-ivory sticky right-0 border-l`}
              >
                Thao tác
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`border-burgundy/10 border-t align-top ${
                flagged.has(row.id) ? "bg-amber-50" : "hover:bg-ivory/40"
              }`}
            >
              <td className={`${tdClass} font-semibold`}>{row.number}</td>
              <td className={`${tdClass} min-w-36 whitespace-pre-wrap`}>
                {row.orderName}
              </td>
              <td className={`${tdClass} min-w-52 whitespace-pre-wrap`}>
                {row.productDetails || "—"}
              </td>
              <td className={`${tdClass} min-w-44`}>
                <span
                  className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${statusTone[row.status].badge}`}
                >
                  {statusLabels[row.status]}
                </span>
              </td>
              <td className={`${tdClass} min-w-32 whitespace-pre-wrap`}>
                {row.workshop || "—"}
              </td>
              {(["receivedDate", "qcDate", "sentDate"] as const).map((key) => (
                <td
                  key={key}
                  className={`${tdClass} min-w-32 break-words whitespace-pre-wrap`}
                >
                  {formatSampleDate(row[key]) || "—"}
                </td>
              ))}
              <td className={`${tdClass} min-w-80 break-words whitespace-pre-wrap`}>
                {row.notes || "—"}
              </td>
              <td className={`${tdClass} min-w-32`}>
                {row.updatedByName || "—"}
              </td>
              <td className={`${tdClass} min-w-32`}>
                {/* A row edited on screen has no server stamp yet. */}
                {row.updatedAt ? formatDateTime(row.updatedAt) : "Chưa lưu"}
              </td>
              {editable && (
                <td
                  className={`${tdClass} sample-no-print border-burgundy/12 sticky right-0 space-y-2 border-l bg-white`}
                >
                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={busy}
                    aria-label={`Sửa mẫu ${row.number}`}
                    onClick={() => onEdit(row)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className={dangerButtonClass}
                    disabled={busy}
                    aria-label={`Bỏ mẫu ${row.number}`}
                    onClick={() => onRemove(row)}
                  >
                    Bỏ mẫu
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-charcoal/65 p-8 text-center">
          {total
            ? "Không có mẫu nào khớp bộ lọc. Hãy xóa bộ lọc để xem lại toàn bộ báo cáo."
            : "Chưa có mẫu nào. Hãy nhập file Excel hiện tại hoặc thêm mẫu để bắt đầu."}
        </p>
      )}
    </div>
  );
}
