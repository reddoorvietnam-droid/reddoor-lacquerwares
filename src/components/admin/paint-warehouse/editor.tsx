"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyPatch,
  parseCell,
  patchSchema,
  type Master,
  type PaintRow,
  type RowPatch,
} from "@/domains/paint-warehouse/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
} from "@/components/admin/sample-progress-shared";
import {
  errorMessage,
  findMaster,
  formatNumber,
  type PaintChange,
} from "./shared";

/**
 * The inline phiếu form. Codes resolve through the danh mục the way the
 * workbook's VLOOKUPs did, every derived cell comes from applyPatch, and
 * "Áp dụng" writes the line immediately — there is no draft left on screen.
 */

type Draft = {
  exportDate: string;
  facilityCode: string;
  materialCode: string;
  description: string;
  quantity: string;
  actualQuantity: string;
  discountedUnitPrice: string;
  note: string;
};

function draftOf(row: PaintRow): Draft {
  return {
    exportDate: row.exportDate,
    facilityCode: row.facilityCode,
    materialCode: row.materialCode,
    description: row.description,
    quantity: row.quantity ?? "",
    // Blank means "theo mặc định"; only a hand-set K / L is echoed back.
    actualQuantity: row.actualQuantityManual ? (row.actualQuantity ?? "") : "",
    discountedUnitPrice: row.discountedPriceManual
      ? (row.discountedUnitPrice ?? "")
      : "",
    note: row.note,
  };
}

type Built = {
  patch: RowPatch | null;
  row: PaintRow | null;
  errors: Record<string, string>;
};

/** One place builds the patch: the live preview and "Áp dụng" must agree. */
function build(
  base: PaintRow,
  draft: Draft,
  masters: readonly Master[],
): Built {
  const errors: Record<string, string> = {};
  const facility = findMaster(masters, "facility", draft.facilityCode);
  const material = findMaster(masters, "material", draft.materialCode);
  const raw: Record<string, string | null> = {
    facilityCode: facility?.code ?? draft.facilityCode.trim(),
    materialCode: material?.code ?? draft.materialCode.trim(),
    description: draft.description,
    note: draft.note,
  };
  if (!draft.exportDate.trim()) errors.exportDate = "Chưa chọn ngày xuất.";
  else
    try {
      raw.exportDate = parseCell("exportDate", draft.exportDate);
    } catch (reason) {
      errors.exportDate = errorMessage(reason, "Ngày không hợp lệ.");
    }
  for (const field of [
    "quantity",
    "actualQuantity",
    "discountedUnitPrice",
  ] as const)
    try {
      raw[field] = parseCell(field, draft[field]);
    } catch (reason) {
      errors[field] = errorMessage(reason, "Số không hợp lệ.");
    }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { patch: null, row: null, errors };
  }
  try {
    return {
      patch: parsed.data,
      row: applyPatch(base, parsed.data, masters),
      errors,
    };
  } catch (reason) {
    const text = errorMessage(reason, "Mã không có trong danh mục.");
    errors[text.includes("cơ sở") ? "facilityCode" : "materialCode"] ??= text;
    return { patch: parsed.data, row: null, errors };
  }
}

export function PaintRowEditor({
  base,
  masters,
  saving,
  onSave,
  onCancel,
  onDirtyChange,
}: {
  /** The saved row being edited, or a fresh empty row for a new phiếu. */
  base: PaintRow;
  masters: readonly Master[];
  saving: boolean;
  onSave: (change: PaintChange) => Promise<void>;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(base));
  const [initial] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstField = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const creating = base.version === 0;

  useEffect(() => {
    firstField.current?.focus();
  }, []);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const built = useMemo(
    () => build(base, draft, masters),
    [base, draft, masters],
  );
  // Fall back to the saved row so the read-only cells stay readable while a
  // half-typed code is still unknown to the danh mục.
  const preview = built.row ?? base;
  const facility = findMaster(masters, "facility", draft.facilityCode);
  const material = findMaster(masters, "material", draft.materialCode);

  const update = (patch: Partial<Draft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const { patch, row, errors: found } = build(base, draft, masters);
    if (!draft.materialCode.trim())
      found.materialCode ??= "Chưa chọn mã vật tư.";
    if (row && row.quantity === null) found.quantity ??= "Chưa nhập số lượng.";
    setErrors(found);
    if (Object.keys(found).length > 0 || !patch || !row) return;
    await onSave({ id: base.id, version: base.version, patch });
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-lacquer mt-1 text-xs" role="alert">
        {errors[key]}
      </p>
    ) : null;
  const hint = (text: string) => (
    <span className="text-charcoal/60 mt-1 block text-xs">{text}</span>
  );
  const readOnlyClass = `${fieldClass} bg-ivory/60`;
  const title = creating ? "Thêm phiếu xuất" : "Sửa phiếu xuất";

  return (
    <form
      className={`${cardClass} space-y-4`}
      aria-label={title}
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <h2 className="text-burgundy font-serif text-xl">{title}</h2>
      <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className={labelClass}>Ngày xuất</span>
          <input
            ref={firstField}
            aria-label="Ngày xuất"
            type="date"
            className={fieldClass}
            value={draft.exportDate}
            onChange={(event) => update({ exportDate: event.target.value })}
          />
          {fieldError("exportDate")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Mã cơ sở SX</span>
          <input
            aria-label="Mã cơ sở SX"
            list="paint-facilities"
            className={fieldClass}
            placeholder="Mã hoặc tên cơ sở"
            value={draft.facilityCode}
            onChange={(event) => update({ facilityCode: event.target.value })}
          />
          {hint(
            facility
              ? facility.name || facility.code
              : draft.facilityCode.trim()
                ? "Không có trong danh mục"
                : "Gõ mã hoặc tên cơ sở",
          )}
          {fieldError("facilityCode")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Tên cơ sở SX</span>
          <input
            aria-label="Tên cơ sở SX"
            readOnly
            className={readOnlyClass}
            value={preview.facilityNameSnapshot}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Mã vật tư</span>
          <input
            aria-label="Mã vật tư"
            list="paint-materials"
            className={fieldClass}
            placeholder="Mã hoặc tên vật tư"
            value={draft.materialCode}
            onChange={(event) => update({ materialCode: event.target.value })}
          />
          {hint(
            material
              ? `${material.name || material.code} · ĐVT: ${material.unit || "—"}`
              : draft.materialCode.trim()
                ? "Không có trong danh mục"
                : "Gõ mã hoặc tên vật tư",
          )}
          {fieldError("materialCode")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Vật tư</span>
          <input
            aria-label="Vật tư"
            readOnly
            className={readOnlyClass}
            value={preview.materialNameSnapshot}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Diễn giải</span>
          <input
            aria-label="Diễn giải"
            className={fieldClass}
            maxLength={2000}
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
          />
          {fieldError("description")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>ĐVT</span>
          <input
            aria-label="ĐVT"
            readOnly
            className={readOnlyClass}
            value={preview.unit}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Số lượng</span>
          <input
            aria-label="Số lượng"
            inputMode="decimal"
            className={fieldClass}
            placeholder="VD: 0.3"
            value={draft.quantity}
            aria-invalid={!!errors.quantity}
            onChange={(event) => update({ quantity: event.target.value })}
          />
          {fieldError("quantity")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Đơn giá</span>
          <input
            aria-label="Đơn giá"
            readOnly
            className={`${readOnlyClass} text-right tabular-nums`}
            value={formatNumber(preview.unitPrice)}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Thành tiền</span>
          <input
            aria-label="Thành tiền"
            readOnly
            className={`${readOnlyClass} text-right tabular-nums`}
            value={formatNumber(preview.amount)}
          />
        </label>
        <label className="text-sm">
          <span className={labelClass}>Số lượng thực nhận</span>
          <input
            aria-label="Số lượng thực nhận"
            inputMode="decimal"
            className={fieldClass}
            placeholder={
              draft.quantity.trim()
                ? `Mặc định ${draft.quantity.trim()}`
                : "Mặc định bằng số lượng"
            }
            value={draft.actualQuantity}
            aria-invalid={!!errors.actualQuantity}
            onChange={(event) => update({ actualQuantity: event.target.value })}
          />
          {hint(
            `Đang tính: ${formatNumber(preview.actualQuantity) || "—"}. Để trống để lấy theo số lượng.`,
          )}
          {fieldError("actualQuantity")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Đơn giá đã chiết khấu</span>
          <input
            aria-label="Đơn giá đã chiết khấu"
            inputMode="decimal"
            title="Giá sau chiết khấu; để trống là lấy đúng đơn giá trong danh mục."
            className={`${fieldClass} bg-amber-50`}
            placeholder="Mặc định bằng đơn giá"
            value={draft.discountedUnitPrice}
            aria-invalid={!!errors.discountedUnitPrice}
            onChange={(event) =>
              update({ discountedUnitPrice: event.target.value })
            }
          />
          {hint(
            `Đang tính: ${formatNumber(preview.discountedUnitPrice) || "—"}. Để trống để lấy theo đơn giá.`,
          )}
          {fieldError("discountedUnitPrice")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Thành tiền thực nhận</span>
          <input
            aria-label="Thành tiền thực nhận"
            readOnly
            className={`${readOnlyClass} text-right tabular-nums`}
            value={formatNumber(preview.actualAmount)}
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className={labelClass}>Ghi chú</span>
          <textarea
            aria-label="Ghi chú"
            className={fieldClass}
            rows={2}
            maxLength={4000}
            value={draft.note}
            onChange={(event) => update({ note: event.target.value })}
          />
          {fieldError("note")}
        </label>
      </fieldset>
      {errors.form && (
        <p className="text-lacquer text-sm" role="alert">
          {errors.form}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonClass} disabled={saving}>
          Áp dụng
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={saving}
          onClick={onCancel}
        >
          Hủy
        </button>
      </div>
      <p className="text-charcoal/60 text-sm">
        Dòng được ghi vào sổ ngay khi bấm “Áp dụng”. Tên cơ sở, vật tư, ĐVT, đơn
        giá và thành tiền tự tính từ danh mục.
      </p>
      <datalist id="paint-facilities">
        {masters
          .filter((master) => master.kind === "facility")
          .map((master) => (
            <option key={master.code} value={master.code}>
              {master.name}
            </option>
          ))}
      </datalist>
      <datalist id="paint-materials">
        {masters
          .filter((master) => master.kind === "material")
          .map((master) => (
            <option key={master.code} value={master.code}>
              {master.name}
            </option>
          ))}
      </datalist>
    </form>
  );
}
