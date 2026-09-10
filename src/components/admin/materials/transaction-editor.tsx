"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Decimal from "decimal.js";
import {
  applyTransactionPatch,
  decideStock,
  defaultDescription,
  displayDate,
  emptyTransaction,
  findFacility,
  findMaterial,
  formatQuantity,
  multiply,
  parseCell,
  stockDelta,
  todayInBusinessZone,
  transactionCompleteness,
  transactionPatchSchema,
  type Material,
  type MaterialTransaction,
  type SummaryRow,
  type TransactionPatch,
  type TransactionType,
  codeKey,
  type Lookups,
} from "@/domains/materials/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
} from "@/components/admin/sample-progress-shared";
import { ApiError, saveTransactions } from "./api";
import { useMaterials } from "./materials-workspace";
import { errorMessage, slipLabels } from "./materials-shared";

/**
 * The inline phiếu form. Codes resolve through the master lists the way the
 * workbook's VLOOKUPs did; xuất may never exceed the cached balance, and the
 * server checks again under its own lock.
 */

type Draft = {
  transactionDate: string;
  materialCode: string;
  facilityCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

function draftOf(
  type: TransactionType,
  existing: MaterialTransaction | null,
  material: Pick<Material, "code"> | null,
): Draft {
  if (existing)
    return {
      transactionDate: existing.transactionDate,
      materialCode: existing.materialCode,
      facilityCode: existing.facilityCode,
      description: existing.description,
      quantity: existing.quantity,
      unitPrice: existing.unitPrice ?? "",
      note: existing.note,
    };
  return {
    transactionDate: todayInBusinessZone(),
    materialCode: material?.code ?? "",
    facilityCode: "",
    description: defaultDescription[type],
    quantity: "",
    unitPrice: "",
    note: "",
  };
}

const safeDecimal = (field: "quantity" | "unitPrice", text: string) => {
  try {
    return parseCell(field, text);
  } catch {
    return null;
  }
};

export function overrunMessage(
  balance: SummaryRow | undefined,
  quantity: string | null,
  previous: Decimal,
): string | null {
  if (!balance || quantity === null || !new Decimal(quantity).gt(0))
    return null;
  const decision = decideStock(
    balance.currentQuantity,
    stockDelta("OUTBOUND", quantity).sub(previous),
  );
  return decision.allowed
    ? null
    : `Số lượng xuất vượt quá tồn kho hiện tại. Tồn hiện tại: ${formatQuantity(decision.current)} ${balance.unit} · Yêu cầu xuất: ${formatQuantity(decision.requested)} ${balance.unit}`;
}

/** The field accepts a code or a name, like the storekeeper types it; the code is what gets sent. */
function resolveMaterial(lookups: Lookups, text: string) {
  const wanted = codeKey(text);
  return (
    findMaterial(lookups, text) ??
    lookups.materials.find((m) => codeKey(m.name) === wanted) ??
    null
  );
}

function resolveFacility(lookups: Lookups, text: string) {
  const wanted = codeKey(text);
  return (
    findFacility(lookups, text) ??
    lookups.facilities.find((f) => codeKey(f.name) === wanted) ??
    null
  );
}

export function TransactionEditor({
  type,
  existing,
  material = null,
  onSaved,
  onCancel,
}: {
  type: TransactionType;
  existing: MaterialTransaction | null;
  /** Prefilled material when opened from the material card. */
  material?: Material | null;
  onSaved: (row: MaterialTransaction) => void;
  onCancel: () => void;
}) {
  const { lookups, stock, notify, fail, refreshStock, guard, setEditorDirty } =
    useMaterials();
  const [id] = useState(() => existing?.id ?? crypto.randomUUID());
  const [draft, setDraft] = useState(() => draftOf(type, existing, material));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [initial] = useState(draft);
  const firstField = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  useEffect(() => {
    firstField.current?.focus();
  }, []);
  useEffect(() => {
    setEditorDirty(dirty);
    return () => setEditorDirty(false);
  }, [dirty, setEditorDirty]);

  const matchedMaterial = useMemo(
    () =>
      draft.materialCode.trim()
        ? resolveMaterial(lookups, draft.materialCode)
        : null,
    [lookups, draft.materialCode],
  );
  const matchedFacility = useMemo(
    () =>
      draft.facilityCode.trim()
        ? resolveFacility(lookups, draft.facilityCode)
        : null,
    [lookups, draft.facilityCode],
  );
  const balance = matchedMaterial ? stock.get(matchedMaterial.id) : undefined;
  const quantityValue = safeDecimal("quantity", draft.quantity);
  const priceValue = safeDecimal("unitPrice", draft.unitPrice);
  const amount =
    quantityValue !== null && priceValue !== null
      ? multiply(quantityValue, priceValue)
      : null;
  // An edit gives back what the saved line already took out of stock.
  const previousDelta =
    existing &&
    existing.status === "POSTED" &&
    matchedMaterial &&
    existing.materialId === matchedMaterial.id
      ? stockDelta(existing.type, existing.quantity)
      : new Decimal(0);
  const overrun =
    type === "OUTBOUND"
      ? overrunMessage(balance, quantityValue, previousDelta)
      : null;

  const update = (patch: Partial<Draft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const raw: Record<string, string | null> = {
      transactionDate: draft.transactionDate,
      materialCode: matchedMaterial?.code ?? draft.materialCode.trim(),
      description: draft.description,
      note: draft.note,
    };
    for (const field of ["quantity", "unitPrice"] as const) {
      if (field === "unitPrice" && type !== "INBOUND") continue;
      try {
        raw[field] = parseCell(field, draft[field]);
      } catch (reason) {
        found[field] = errorMessage(reason, "Số không hợp lệ");
      }
    }
    if (type === "OUTBOUND")
      raw.facilityCode = matchedFacility?.code ?? draft.facilityCode.trim();
    // Named up front so an empty form lists every gap, not just the first.
    if (!draft.materialCode.trim()) found.materialCode = "Chưa chọn mã vật tư";
    if (type === "OUTBOUND" && !draft.facilityCode.trim())
      found.facilityCode = "Chưa chọn cơ sở / người nhận";
    const parsed = transactionPatchSchema.safeParse(raw);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        found[String(issue.path[0] ?? "form")] ??= issue.message;
    let patch: TransactionPatch | null = null;
    let next: MaterialTransaction | null = null;
    if (parsed.success) {
      patch = parsed.data;
      try {
        next = applyTransactionPatch(
          existing ?? emptyTransaction(id, type, draft.transactionDate, ""),
          patch,
          lookups,
        );
        const missing = transactionCompleteness(next);
        if (missing)
          found[
            missing.includes("cơ sở")
              ? "facilityCode"
              : missing.includes("vật tư")
                ? "materialCode"
                : "quantity"
          ] ??= missing;
      } catch (reason) {
        const text = errorMessage(reason, "Mã không hợp lệ");
        found[text.includes("cơ sở") ? "facilityCode" : "materialCode"] ??=
          text;
      }
    }
    if (overrun) found.quantity ??= overrun;
    setErrors(found);
    if (Object.keys(found).length > 0 || !patch || !next) return;

    setSaving(true);
    try {
      const saved = await saveTransactions([
        { id, version: existing?.version ?? 0, type, patch },
      ]);
      const row = saved.rows[0];
      if (!row) throw new Error("Máy chủ không trả về phiếu vừa ghi.");
      notify(
        `${existing ? "Đã cập nhật" : "Đã ghi"} ${slipLabels[type]} ${formatQuantity(row.quantity)} ${row.unit} ${row.materialName} · ${displayDate(row.transactionDate)}.`,
      );
      onSaved(row);
      try {
        await refreshStock();
      } catch {
        // The line is written; only the screen refresh failed.
        fail(
          new Error(
            "Đã ghi phiếu nhưng chưa tải lại được số liệu; hãy tải lại trang để đối chiếu.",
          ),
        );
      }
    } catch (reason) {
      fail(reason, "Không ghi được phiếu.");
      // A stock or version rejection means the cached balance is stale.
      if (reason instanceof ApiError && reason.status === 409)
        void refreshStock();
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="text-lacquer mt-1 text-xs" role="alert">
        {errors[key]}
      </p>
    ) : null;

  const title = existing
    ? `Sửa ${slipLabels[type]}`
    : type === "INBOUND"
      ? "Thêm phiếu nhập"
      : "Thêm phiếu xuất";
  const materialHint = matchedMaterial
    ? `${matchedMaterial.name || matchedMaterial.code} · ĐVT: ${matchedMaterial.unit || "—"}${matchedMaterial.active ? "" : " · đã ngừng dùng"}`
    : draft.materialCode.trim()
      ? "Không có trong danh mục"
      : "Gõ mã hoặc tên vật tư";

  return (
    <form
      className={`${cardClass} materials-no-print space-y-4`}
      onSubmit={(event) => void submit(event)}
      aria-label={title}
      noValidate
    >
      <h3 className="text-burgundy font-serif text-xl">{title}</h3>
      <fieldset disabled={saving} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className={labelClass}>
            {type === "INBOUND" ? "Ngày nhập" : "Ngày xuất"}
          </span>
          <input
            ref={firstField}
            aria-label={type === "INBOUND" ? "Ngày nhập" : "Ngày xuất"}
            type="date"
            className={fieldClass}
            value={draft.transactionDate}
            onChange={(event) =>
              update({ transactionDate: event.target.value })
            }
          />
          {fieldError("transactionDate")}
        </label>
        {type === "OUTBOUND" && (
          <label className="text-sm">
            <span className={labelClass}>Cơ sở / người nhận</span>
            <input
              aria-label="Cơ sở / người nhận"
              list="facility-codes"
              className={fieldClass}
              placeholder="Mã hoặc tên cơ sở"
              value={draft.facilityCode}
              onChange={(event) => update({ facilityCode: event.target.value })}
            />
            <span className="text-charcoal/60 mt-1 block text-xs">
              {matchedFacility
                ? `${matchedFacility.name || matchedFacility.code}${matchedFacility.active ? "" : " · đã ngừng dùng"}`
                : draft.facilityCode.trim()
                  ? "Không có trong danh mục"
                  : "Gõ mã hoặc tên cơ sở"}
            </span>
            {fieldError("facilityCode")}
          </label>
        )}
        <label className="text-sm">
          <span className={labelClass}>Mã vật tư</span>
          <input
            aria-label="Mã vật tư"
            list="materials-codes"
            className={fieldClass}
            placeholder="Mã hoặc tên vật tư"
            value={draft.materialCode}
            onChange={(event) => update({ materialCode: event.target.value })}
          />
          <span className="text-charcoal/60 mt-1 block text-xs">
            {materialHint}
          </span>
          {fieldError("materialCode")}
        </label>
        {type === "INBOUND" && (
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
        )}
        {type === "OUTBOUND" && (
          <p className="text-sm">
            <span className={labelClass}>Tồn hiện tại</span>
            <strong>
              {balance
                ? `Tồn hiện tại: ${formatQuantity(balance.currentQuantity)} ${balance.unit}`
                : "—"}
            </strong>
          </p>
        )}
        <label className="text-sm">
          <span className={labelClass}>
            {type === "INBOUND" ? "Số lượng" : "Số lượng xuất"}
          </span>
          <input
            aria-label={type === "INBOUND" ? "Số lượng" : "Số lượng xuất"}
            inputMode="decimal"
            className={fieldClass}
            placeholder="VD: 0.3"
            value={draft.quantity}
            aria-invalid={!!overrun || !!errors.quantity}
            onChange={(event) => update({ quantity: event.target.value })}
          />
          {overrun ? (
            <span className="text-lacquer mt-1 block text-xs" role="alert">
              {overrun}
            </span>
          ) : (
            fieldError("quantity")
          )}
        </label>
        {type === "INBOUND" && (
          <>
            <label className="text-sm">
              <span className={labelClass}>Đơn giá (không bắt buộc)</span>
              <input
                aria-label="Đơn giá"
                inputMode="decimal"
                className={fieldClass}
                value={draft.unitPrice}
                onChange={(event) => update({ unitPrice: event.target.value })}
              />
              {fieldError("unitPrice")}
            </label>
            <label className="text-sm">
              <span className={labelClass}>Thành tiền</span>
              <input
                aria-label="Thành tiền"
                readOnly
                className={`${fieldClass} bg-ivory/60`}
                value={amount === null ? "" : formatQuantity(amount)}
              />
            </label>
          </>
        )}
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
        <button
          className={buttonClass}
          disabled={saving || !!overrun}
          type="submit"
        >
          Áp dụng
        </button>
        <button
          className={ghostButtonClass}
          disabled={saving}
          type="button"
          onClick={() => guard(onCancel)}
        >
          Hủy
        </button>
      </div>
      <p className="text-charcoal/60 text-sm">
        Phiếu được ghi vào kho ngay khi bấm “Áp dụng”. Số thập phân dùng dấu
        chấm (0.3).
      </p>
    </form>
  );
}
