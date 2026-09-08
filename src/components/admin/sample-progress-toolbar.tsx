"use client";

import { useRef } from "react";
import {
  formatWeekRange,
  maxSampleRows,
  sampleStatuses,
  statusLabels,
  type ReportSummary,
  type SampleReport,
} from "@/domains/sample-progress/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  sortOptions,
  type SortKey,
} from "./sample-progress-shared";

/** Choosing which week and revision to work on, and how to start a new one. */
export function SampleProgressToolbar({
  reports,
  current,
  editable,
  busy,
  onOpenWeek,
  onStartWeek,
  onInherit,
  onImport,
}: {
  reports: readonly ReportSummary[];
  current: SampleReport | null;
  editable: boolean;
  busy: boolean;
  onOpenWeek: (week: string) => void;
  onStartWeek: (date: string) => void;
  onInherit: () => void;
  onImport: (file?: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className={`${cardClass} sample-no-print space-y-4`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1 text-sm">
          <span className={labelClass}>Báo cáo đã lưu</span>
          <select
            aria-label="Báo cáo đã lưu"
            className={fieldClass}
            value={current?.week ?? ""}
            disabled={busy}
            onChange={(event) =>
              event.target.value && onOpenWeek(event.target.value)
            }
          >
            <option value="">
              {reports.length ? "Chọn tuần…" : "Chưa có báo cáo nào"}
            </option>
            {reports.map((entry) => (
              <option key={entry.week} value={entry.week}>
                Tuần {formatWeekRange(entry.week)} · {entry.count} mẫu · v
                {entry.revision}
              </option>
            ))}
          </select>
        </label>
        {editable && (
          <>
            <label className="text-sm">
              <span className={labelClass}>Mở hoặc tạo tuần khác</span>
              <input
                aria-label="Mở hoặc tạo tuần khác"
                type="date"
                className={fieldClass}
                disabled={busy}
                onChange={(event) =>
                  event.target.value && onStartWeek(event.target.value)
                }
              />
            </label>
            <button
              type="button"
              className={ghostButtonClass}
              disabled={busy || !current}
              onClick={onInherit}
            >
              Kế thừa sang tuần mới
            </button>
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
              accept=".xlsx,.xlsm"
              aria-label="File tiến độ mẫu"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Clear it so choosing the same file twice fires again.
                event.target.value = "";
                onImport(file);
              }}
            />
          </>
        )}
      </div>
      <p className="text-charcoal/60 text-sm">
        Mỗi tuần tính từ thứ Hai đến Chủ nhật theo giờ Việt Nam.{" "}
        {editable
          ? "Mỗi lần lưu tạo một phiên bản mới; các phiên bản cũ vẫn giữ nguyên."
          : "Giám đốc xem và xuất báo cáo; việc cập nhật do biên tập nội dung thực hiện."}
      </p>
    </section>
  );
}

/** Narrowing the view only. The saved snapshot is never changed by a filter. */
export function SampleProgressFilters({
  search,
  status,
  sort,
  shown,
  total,
  canAdd,
  busy,
  onSearch,
  onStatus,
  onSort,
  onClear,
  onAdd,
}: {
  search: string;
  status: string;
  sort: SortKey;
  shown: number;
  total: number;
  canAdd: boolean;
  busy: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onSort: (value: SortKey) => void;
  onClear: () => void;
  onAdd: () => void;
}) {
  const filtering = !!search || !!status || sort !== "report";
  return (
    <div className="sample-no-print flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className={labelClass}>Tìm mẫu</span>
        <input
          aria-label="Tìm mẫu"
          placeholder="Tên mẫu, nơi làm, ghi chú…"
          className={`${fieldClass} min-w-64`}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <label className="text-sm">
        <span className={labelClass}>Lọc trạng thái</span>
        <select
          aria-label="Lọc trạng thái"
          className={fieldClass}
          value={status}
          onChange={(event) => onStatus(event.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {sampleStatuses.map((key) => (
            <option key={key} value={key}>
              {statusLabels[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className={labelClass}>Sắp xếp</span>
        <select
          aria-label="Sắp xếp"
          className={fieldClass}
          value={sort}
          onChange={(event) => onSort(event.target.value as SortKey)}
        >
          {sortOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={ghostButtonClass}
        disabled={!filtering}
        onClick={onClear}
      >
        Xóa bộ lọc
      </button>
      {canAdd && (
        <button
          type="button"
          className={buttonClass}
          disabled={busy || total >= maxSampleRows}
          onClick={onAdd}
        >
          Thêm mẫu
        </button>
      )}
      <span className="text-charcoal/65 text-sm">
        Hiển thị {shown}/{total} mẫu
        {total >= maxSampleRows
          ? ` · đã đạt giới hạn ${maxSampleRows} mẫu`
          : ""}
      </span>
    </div>
  );
}
