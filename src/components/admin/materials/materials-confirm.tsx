"use client";

import { useState } from "react";
import {
  displayDate,
  type Facility,
  type ImportPreview,
  type ImportRowStatus,
  type MasterKind,
  type Material,
  type MaterialTransaction,
} from "@/domains/materials/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import {
  badgeClass,
  formatQuantity,
  masterLabel,
  slipLabels,
  typeLabels,
} from "./materials-shared";

/**
 * Every step that discards work or changes the books asks first, inline on
 * the page — never a browser confirm() the reader cannot re-read.
 */
export type MaterialsConfirmation =
  | { kind: "cancel-line"; row: MaterialTransaction }
  | { kind: "discard-edit"; run: () => void }
  | { kind: "discard-import"; fileName: string }
  | { kind: "deactivate"; master: Material | Facility; masterKind: MasterKind };

export function MaterialsConfirm({
  confirmation,
  busy,
  onCancel,
  onCancelLine,
  onDiscard,
  onDiscardImport,
  onDeactivate,
}: {
  confirmation: MaterialsConfirmation;
  busy: boolean;
  onCancel: () => void;
  onCancelLine: (row: MaterialTransaction, reason: string) => void;
  onDiscard: (run: () => void) => void;
  onDiscardImport: () => void;
  onDeactivate: (master: Material | Facility, kind: MasterKind) => void;
}) {
  if (confirmation.kind === "cancel-line")
    return (
      <CancelLinePanel
        row={confirmation.row}
        busy={busy}
        onCancel={onCancel}
        onConfirm={onCancelLine}
      />
    );

  if (confirmation.kind === "deactivate") {
    const label = confirmation.masterKind === "material" ? "vật tư" : "cơ sở";
    return (
      <section
        className={`${cardClass} materials-no-print border-lacquer/40 space-y-3`}
        aria-label={`Xác nhận ngừng dùng ${label}`}
      >
        <p className="text-sm">
          Ngừng dùng {label} <strong>{masterLabel(confirmation.master)}</strong>
          ? Các phiếu đã ghi vẫn giữ nguyên; từ nay không ghi thêm phiếu cho{" "}
          {label} này được nữa. Có thể bấm “Dùng lại” bất cứ lúc nào.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() =>
              onDeactivate(confirmation.master, confirmation.masterKind)
            }
          >
            Ngừng dùng
          </button>
          <button type="button" className={ghostButtonClass} onClick={onCancel}>
            Giữ lại
          </button>
        </div>
      </section>
    );
  }

  if (confirmation.kind === "discard-import")
    return (
      <section
        className={`${cardClass} materials-no-print border-lacquer/40 space-y-3`}
        aria-label="Xác nhận hủy nhập file"
      >
        <p className="text-sm">
          Bỏ toàn bộ dữ liệu vừa đọc từ <strong>{confirmation.fileName}</strong>
          ? Chưa có gì được ghi vào kho.
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
      className={`${cardClass} materials-no-print border-lacquer/40 space-y-3`}
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
}

/**
 * Cancelling a line keeps it in the books as CANCELLED; the reason is what
 * the audit entry is filed under, so it is required rather than a second click.
 */
function CancelLinePanel({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: MaterialTransaction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (row: MaterialTransaction, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const ready = reason.trim().length >= 3;
  return (
    <section
      className={`${cardClass} materials-no-print border-lacquer/50 space-y-3`}
      aria-label={`Xác nhận hủy ${slipLabels[row.type]}`}
    >
      <h2 className="text-lacquer font-serif text-xl">
        Hủy {slipLabels[row.type]}
      </h2>
      <p className="text-sm">
        {typeLabels[row.type]} <strong>{formatQuantity(row.quantity)}</strong>{" "}
        {row.unit} {row.materialName} ({row.materialCode}) ngày{" "}
        {displayDate(row.transactionDate)}
        {row.facilityName ? ` · ${row.facilityName}` : ""}. Dòng sẽ được đánh
        dấu đã hủy và tồn kho tính lại; không xóa khỏi sổ.
      </p>
      <label className="block text-sm">
        <span className={labelClass}>Lý do hủy (bắt buộc)</span>
        <textarea
          aria-label="Lý do hủy"
          className={fieldClass}
          rows={2}
          maxLength={2000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="VD: Ghi nhầm số lượng."
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || !ready}
          onClick={() => onConfirm(row, reason.trim())}
        >
          Hủy dòng này
        </button>
        <button type="button" className={ghostButtonClass} onClick={onCancel}>
          Giữ lại
        </button>
      </div>
    </section>
  );
}

const importStatusLabel: Record<ImportRowStatus, string> = {
  valid: "Hợp lệ",
  invalid: "Lỗi",
  duplicate: "Trùng",
  "already-imported": "Đã nhập",
  "unknown-material": "Vật tư lạ",
  "unknown-facility": "Cơ sở lạ",
};
const importStatusTone: Record<ImportRowStatus, string> = {
  valid: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300",
  invalid: "bg-red-100 text-red-900 ring-1 ring-red-300",
  duplicate: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  "already-imported": "bg-stone-100 text-stone-700 ring-1 ring-stone-300",
  "unknown-material": "bg-red-100 text-red-900 ring-1 ring-red-300",
  "unknown-facility": "bg-red-100 text-red-900 ring-1 ring-red-300",
};
const importStatusOrder: ImportRowStatus[] = [
  "valid",
  "invalid",
  "duplicate",
  "already-imported",
  "unknown-material",
  "unknown-facility",
];

/** Shown for as long as an imported file is only a preview; nothing is written until "Nhập … dòng vào kho". */
export function MaterialsImportPreview({
  fileName,
  preview,
  includeDuplicates,
  busy,
  onToggleDuplicates,
  onApply,
  onCancel,
}: {
  fileName: string;
  preview: ImportPreview;
  includeDuplicates: boolean;
  busy: boolean;
  onToggleDuplicates: (value: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const importable =
    preview.counts.valid + (includeDuplicates ? preview.counts.duplicate : 0);
  return (
    <section
      className="materials-no-print border-gold/40 space-y-4 rounded-2xl border bg-amber-50/40 p-5"
      aria-label="Dữ liệu đọc từ file Excel"
    >
      <div>
        <p className="font-semibold text-amber-900">
          Dữ liệu đọc từ file “{fileName}” — chưa ghi vào kho
        </p>
        <p className="mt-1 text-sm text-amber-900/80">
          {importStatusOrder
            .map(
              (status) =>
                `${preview.counts[status]} ${importStatusLabel[status].toLocaleLowerCase("vi")}`,
            )
            .join(" · ")}
          . Chỉ dòng hợp lệ được ghi; mã lạ cần thêm vào Danh mục trước.
        </p>
      </div>
      <div className={tableWrapClass}>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className={theadClass}>
            <tr>
              {[
                "Sheet",
                "Dòng",
                "Ngày",
                "Mã vật tư",
                "Cơ sở",
                "Số lượng",
                "Trạng thái",
                "Ghi chú kiểm tra",
              ].map((label) => (
                <th key={label} scope="col" className={thClass}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr
                key={`${row.sheet}:${row.row}`}
                className="border-burgundy/10 border-t"
              >
                <td className={tdClass}>{row.sheet}</td>
                <td className={tdClass}>{row.row}</td>
                <td className={tdClass}>
                  {row.transactionDate ? displayDate(row.transactionDate) : "—"}
                </td>
                <td className={tdClass}>{row.materialCode || "—"}</td>
                <td className={tdClass}>{row.facilityCode || "—"}</td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {row.quantity === null ? "—" : formatQuantity(row.quantity)}
                </td>
                <td className={tdClass}>
                  <span
                    className={`${badgeClass} ${importStatusTone[row.status]}`}
                  >
                    {importStatusLabel[row.status]}
                  </span>
                </td>
                <td className={`${tdClass} whitespace-pre-wrap`}>
                  {row.message || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.rows.length === 0 && (
          <p className="text-charcoal/65 p-8 text-center">
            File không có dòng nhập / xuất nào.
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeDuplicates}
          disabled={busy}
          onChange={(event) => onToggleDuplicates(event.target.checked)}
        />
        Nhập cả các dòng trùng ({preview.counts.duplicate})
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || importable === 0}
          onClick={onApply}
        >
          Nhập {importable} dòng vào kho
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
