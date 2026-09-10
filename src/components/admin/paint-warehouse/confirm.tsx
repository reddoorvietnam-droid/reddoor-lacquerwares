"use client";

import type { PaintRow } from "@/domains/paint-warehouse/contracts";
import type { PaintImportPreview } from "@/domains/paint-warehouse/import-workbook";
import {
  buttonClass,
  cardClass,
  ghostButtonClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import {
  displayDate,
  formatNumber,
  importStatusBadges,
  importStatusLabels,
  previewLimit,
} from "./shared";

/** Deleting a ledger row and dropping an unapplied edit both ask first. */
export type PaintConfirmation =
  { kind: "delete"; row: PaintRow } | { kind: "discard-edit"; run: () => void };

/** The line as the storekeeper reads it in the table, for the confirmation copy. */
export const rowLabel = (row: PaintRow) =>
  [
    displayDate(row.exportDate),
    row.materialNameSnapshot || row.materialCode || "dòng trống",
    row.facilityNameSnapshot || row.facilityCode,
    row.quantity === null ? "" : `${formatNumber(row.quantity)} ${row.unit}`,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Deleting a ledger row and dropping a draft both happen on the page: a panel
 * the storekeeper can re-read beats a browser dialog that vanishes on a click.
 */
export function PaintConfirm({
  confirmation,
  busy,
  onCancel,
  onDelete,
  onDiscard,
}: {
  confirmation: PaintConfirmation;
  busy: boolean;
  onCancel: () => void;
  onDelete: (row: PaintRow) => void;
  /** Drops the open editor first, then runs what the reader asked for. */
  onDiscard: (run: () => void) => void;
}) {
  if (confirmation.kind === "discard-edit")
    return (
      <section
        className={`${cardClass} border-lacquer/40 space-y-3`}
        aria-label="Xác nhận bỏ thay đổi"
      >
        <p className="text-sm">
          Phiếu đang sửa có thay đổi chưa áp dụng. Tiếp tục sẽ bỏ những thay đổi
          đó.
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
  return (
    <section
      className={`${cardClass} border-lacquer/40 space-y-3`}
      aria-label="Xác nhận xóa dòng"
    >
      <p className="text-sm">
        Xóa dòng <strong>{rowLabel(confirmation.row)}</strong>? Dòng sẽ không
        còn trong sổ và trong file Excel xuất ra.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => onDelete(confirmation.row)}
        >
          Xóa dòng
        </button>
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          Giữ lại
        </button>
      </div>
    </section>
  );
}

/**
 * A read file stays a proposal until the storekeeper presses the import button:
 * the card shows what each source row would become, and the way out stays next
 * to it so a wrong file costs one click, not a reload.
 */
export function PaintImportPreviewCard({
  preview,
  includeDuplicates,
  busy,
  onIncludeDuplicates,
  onApply,
  onCancel,
}: {
  preview: PaintImportPreview;
  includeDuplicates: boolean;
  busy: boolean;
  onIncludeDuplicates: (value: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const importable =
    preview.counts.valid + (includeDuplicates ? preview.counts.duplicate : 0);
  const shown = preview.rows.slice(0, previewLimit);
  const notes = [...preview.issues, ...preview.warnings];
  return (
    <section
      className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50 p-5"
      aria-label="Xem trước file Excel xuất kho sơn"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-amber-900">
            Đang xem trước file “{preview.fileName}” — chưa ghi vào sổ
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            Hợp lệ {preview.counts.valid} · Trùng {preview.counts.duplicate} ·
            Đã nhập {preview.counts["already-imported"]} · Lỗi{" "}
            {preview.counts.invalid} · Thành tiền theo file{" "}
            {preview.sourceAmount} · Thành tiền thực nhận{" "}
            {preview.sourceActualAmount}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-amber-900">
          <input
            type="checkbox"
            checked={includeDuplicates}
            disabled={busy || preview.counts.duplicate === 0}
            onChange={(event) => onIncludeDuplicates(event.target.checked)}
          />
          Nhập cả các dòng trùng
        </label>
      </div>

      {notes.length > 0 && (
        <details open={preview.issues.length > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">
            Xem {notes.length} ghi chú khi đọc file
          </summary>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {notes.map((issue, index) => (
              <li
                key={`${issue.row}-${index}`}
                className={index < preview.issues.length ? "text-red-900" : ""}
              >
                Dòng {issue.row}: {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={tableWrapClass}>
        <table className="w-full min-w-208 text-sm">
          <thead className={theadClass}>
            <tr>
              <th className={thClass}>Dòng</th>
              <th className={thClass}>Ngày</th>
              <th className={thClass}>Mã cơ sở</th>
              <th className={thClass}>Mã vật tư</th>
              <th className={thClass}>Số lượng</th>
              <th className={thClass}>Thành tiền</th>
              <th className={thClass}>Trạng thái</th>
              <th className={thClass}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.sourceRow} className="border-burgundy/10 border-t">
                <td className={tdClass}>{row.sourceRow}</td>
                <td className={tdClass}>{row.exportDate ?? "—"}</td>
                <td className={tdClass}>
                  {row.facilityCode || "—"}
                  {row.unknownFacility ? " *" : ""}
                </td>
                <td className={tdClass}>
                  {row.materialCode || "—"}
                  {row.unknownMaterial ? " *" : ""}
                </td>
                <td className={tdClass}>{row.quantity ?? "—"}</td>
                <td className={tdClass}>{row.amount ?? "—"}</td>
                <td className={tdClass}>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${importStatusBadges[row.status]}`}
                  >
                    {importStatusLabels[row.status]}
                  </span>
                </td>
                <td className={tdClass}>{row.message || row.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-amber-900/80">
        {preview.rows.length > previewLimit
          ? `Hiển thị ${previewLimit}/${preview.rows.length} dòng đầu tiên. `
          : ""}
        Dấu * là mã chưa có trong danh mục; dòng vẫn nhập được và giữ nguyên tên
        ghi trong file.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || importable === 0}
          onClick={onApply}
        >
          Nhập {importable} dòng vào sổ
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={busy}
          onClick={onCancel}
        >
          Hủy nhập file
        </button>
      </div>
    </section>
  );
}
