"use client";

import {
  formatWeekRange,
  type SampleRow,
} from "@/domains/sample-progress/contracts";
import type { ImportIssue } from "@/domains/sample-progress/import-workbook";
import {
  buttonClass,
  cardClass,
  ghostButtonClass,
} from "./sample-progress-shared";

/**
 * Every step that would overwrite or discard work asks first, inline on the
 * page. The admin area has no modal idiom, and a panel the reader can scroll
 * back to beats a browser confirm() they cannot re-read.
 */
export type SampleProgressConfirmation =
  | { kind: "inherit"; source: string; target: string }
  | { kind: "remove"; row: SampleRow }
  | { kind: "discard"; run: () => void };

export function SampleProgressConfirm({
  confirmation,
  rowCount,
  busy,
  onCancel,
  onInherit,
  onRemove,
  onDiscard,
}: {
  confirmation: SampleProgressConfirmation;
  rowCount: number;
  busy: boolean;
  onCancel: () => void;
  onInherit: (source: string) => void;
  onRemove: (row: SampleRow) => void;
  onDiscard: (run: () => void) => void;
}) {
  if (confirmation.kind === "inherit")
    return (
      <section
        className={`${cardClass} sample-no-print border-gold/40 space-y-3`}
        aria-label="Xác nhận kế thừa tuần mới"
      >
        <h2 className="text-burgundy font-serif text-xl">
          Kế thừa sang tuần mới
        </h2>
        <p className="text-sm">
          Sao chép toàn bộ {rowCount} mẫu của tuần nguồn{" "}
          <strong>{formatWeekRange(confirmation.source)}</strong> sang tuần đích{" "}
          <strong>{formatWeekRange(confirmation.target)}</strong>. Tuần đích sẽ
          bắt đầu ở phiên bản 1; lịch sử phiên bản của tuần nguồn không được sao
          chép.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => onInherit(confirmation.source)}
          >
            Xác nhận kế thừa
          </button>
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Hủy
          </button>
        </div>
      </section>
    );

  if (confirmation.kind === "remove")
    return (
      <section
        className={`${cardClass} sample-no-print border-lacquer/40 space-y-3`}
        aria-label="Xác nhận bỏ mẫu"
      >
        <p className="text-sm">
          Bỏ mẫu STT {confirmation.row.number} “{confirmation.row.orderName}”
          khỏi bản đang soạn? Các phiên bản đã lưu vẫn giữ mẫu này.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            onClick={() => onRemove(confirmation.row)}
          >
            Bỏ mẫu
          </button>
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Giữ lại
          </button>
        </div>
      </section>
    );

  return (
    <section
      className={`${cardClass} sample-no-print border-lacquer/40 space-y-3`}
      aria-label="Xác nhận bỏ thay đổi"
    >
      <p className="text-sm">
        Bản đang soạn có thay đổi chưa lưu. Tiếp tục sẽ bỏ những thay đổi đó.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => onDiscard(confirmation.run)}
        >
          Bỏ thay đổi và tiếp tục
        </button>
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          Quay lại chỉnh sửa
        </button>
      </div>
    </section>
  );
}

/** What the Excel reader found, so nothing is corrected behind the editor's back. */
export function SampleProgressIssues({
  issues,
  rowCount,
}: {
  issues: readonly ImportIssue[];
  rowCount: number;
}) {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return (
    <details
      className="sample-no-print rounded-2xl border border-amber-200 bg-amber-50 p-4"
      open={errors > 0}
    >
      <summary className="cursor-pointer font-semibold">
        Kết quả đọc file Excel: {rowCount} dòng, {errors} lỗi,{" "}
        {issues.length - errors} cảnh báo
      </summary>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        {issues.map((issue, index) => (
          <li
            key={`${issue.rowId ?? "file"}-${index}`}
            className={issue.severity === "error" ? "text-red-900" : ""}
          >
            {issue.severity === "error" ? "Lỗi: " : "Cảnh báo: "}
            {issue.message}
          </li>
        ))}
      </ul>
    </details>
  );
}
