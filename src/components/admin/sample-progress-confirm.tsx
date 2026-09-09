"use client";

import { useState } from "react";
import {
  formatWeekRange,
  type SampleRow,
} from "@/domains/sample-progress/contracts";
import type { ImportIssue } from "@/domains/sample-progress/import-workbook";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
} from "./sample-progress-shared";

/**
 * Every step that would overwrite or discard work asks first, inline on the
 * page. The admin area has no modal idiom, and a panel the reader can scroll
 * back to beats a browser confirm() they cannot re-read.
 */
export type SampleProgressConfirmation =
  | { kind: "inherit"; source: string; target: string }
  | { kind: "remove"; row: SampleRow }
  | { kind: "discard"; run: () => void }
  | { kind: "discard-import"; fileName: string }
  | { kind: "delete-week"; week: string; revisions: number; rows: number };

export function SampleProgressConfirm({
  confirmation,
  rowCount,
  busy,
  onCancel,
  onInherit,
  onRemove,
  onDiscard,
  onDiscardImport,
  onDeleteWeek,
}: {
  confirmation: SampleProgressConfirmation;
  rowCount: number;
  busy: boolean;
  onCancel: () => void;
  onInherit: (source: string) => void;
  onRemove: (row: SampleRow) => void;
  onDiscard: (run: () => void) => void;
  onDiscardImport: () => void;
  onDeleteWeek: (reason: string) => void;
}) {
  if (confirmation.kind === "delete-week")
    return (
      <DeleteWeekPanel
        week={confirmation.week}
        revisions={confirmation.revisions}
        rows={confirmation.rows}
        busy={busy}
        onCancel={onCancel}
        onDelete={onDeleteWeek}
      />
    );

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

  if (confirmation.kind === "discard-import")
    return (
      <section
        className={`${cardClass} sample-no-print border-lacquer/40 space-y-3`}
        aria-label="Xác nhận hủy nhập file"
      >
        <p className="text-sm">
          Bỏ toàn bộ dữ liệu vừa đọc từ <strong>{confirmation.fileName}</strong>?
          Bảng sẽ quay lại đúng như trước khi nhập file. Báo cáo đã lưu trong hệ
          thống không bị ảnh hưởng.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            onClick={onDiscardImport}
          >
            Hủy nhập file
          </button>
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Giữ lại dữ liệu vừa đọc
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

/**
 * Shown for as long as an imported file is only a preview. It names the file,
 * says what was read, and keeps the way out in view — a wrong file should never
 * need a reload to undo.
 */
export function SampleProgressImportPreview({
  fileName,
  issues,
  rowCount,
  busy,
  onCancel,
}: {
  fileName: string;
  issues: readonly ImportIssue[];
  rowCount: number;
  busy: boolean;
  onCancel: () => void;
}) {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return (
    <section
      className="sample-no-print space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-5"
      aria-label="Dữ liệu đọc từ file Excel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-amber-900">
            Đang xem trước file “{fileName}” — chưa lưu vào hệ thống
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            Đã đọc {rowCount} mẫu · {errors} lỗi ·{" "}
            {issues.length - errors} cảnh báo. Dữ liệu này thay cho toàn bộ bảng
            bên dưới; bấm “Lưu báo cáo” mới ghi vào hệ thống.
          </p>
        </div>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={busy}
          onClick={onCancel}
        >
          Hủy nhập file
        </button>
      </div>
      {issues.length > 0 && (
        <details open={errors > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">
            Xem {issues.length} ghi chú khi đọc file
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
      )}
    </section>
  );
}

/**
 * Deleting a week removes the whole report — every sample and every revision of
 * it — which is what someone needs after saving the wrong file. It asks for a
 * reason rather than a second click: the reason is what the archived copy and
 * the audit entry are filed under.
 */
function DeleteWeekPanel({
  week,
  revisions,
  rows,
  busy,
  onCancel,
  onDelete,
}: {
  week: string;
  revisions: number;
  rows: number;
  busy: boolean;
  onCancel: () => void;
  onDelete: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ready = reason.trim().length >= 5;
  return (
    <section
      className={`${cardClass} sample-no-print border-lacquer/50 space-y-3`}
      aria-label="Xác nhận xóa báo cáo tuần"
    >
      <h2 className="text-lacquer font-serif text-xl">Xóa báo cáo tuần này</h2>
      <p className="text-sm">
        Sẽ xóa toàn bộ báo cáo của tuần{" "}
        <strong>{formatWeekRange(week)}</strong>: {rows} mẫu và cả{" "}
        {revisions} phiên bản đã lưu. Tuần này sẽ biến mất khỏi danh sách của
        giám đốc.
      </p>
      <p className="text-charcoal/70 text-sm">
        Một bản sao đầy đủ được lưu lại trước khi xóa, nên nếu xóa nhầm thì vẫn
        khôi phục được — nhưng phải nhờ kỹ thuật, không tự làm trên web. Sau khi
        xóa, chị có thể nhập lại file khác cho tuần này từ đầu.
      </p>
      <label className="block text-sm">
        <span className={labelClass}>Lý do xóa (bắt buộc)</span>
        <textarea
          aria-label="Lý do xóa báo cáo"
          className={fieldClass}
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="VD: Nhập nhầm file của tuần khác."
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !ready}
          onClick={() => onDelete(reason)}
        >
          Xóa báo cáo tuần này
        </button>
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          Giữ lại báo cáo
        </button>
      </div>
    </section>
  );
}
