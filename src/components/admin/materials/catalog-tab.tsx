"use client";

import { useEffect, useRef, useState } from "react";
import {
  codeKey,
  facilityPatchSchema,
  materialPatchSchema,
  parseCell,
  type Facility,
  type MasterKind,
  type Material,
} from "@/domains/materials/contracts";
import {
  buttonClass,
  cardClass,
  dangerButtonClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  tableWrapClass,
  tdClass,
  thClass,
  theadClass,
} from "@/components/admin/sample-progress-shared";
import { ApiError, saveMasters, type MasterChange } from "./api";
import { useMaterials } from "./materials-workspace";
import {
  badgeClass,
  errorMessage,
  formatQuantity,
  masterLabel,
} from "./materials-shared";

/**
 * KhoNVL + Cososx: the two master lists. Nothing is deleted — Trạng thái
 * toggles — and a code with movement is locked because the ledgers snapshot it.
 */

type MasterRow = Material | Facility;
type Draft = {
  code: string;
  name: string;
  unit: string;
  openingQuantity: string;
  minimumStock: string;
  note: string;
  type: string;
  phone: string;
};

const draftOf = (row: MasterRow | null): Draft => ({
  code: row?.code ?? "",
  name: row?.name ?? "",
  unit: row && "unit" in row ? row.unit : "",
  openingQuantity: row && "openingQuantity" in row ? row.openingQuantity : "0",
  minimumStock: row && "minimumStock" in row ? (row.minimumStock ?? "") : "",
  note: row?.note ?? "",
  type: row && "type" in row ? row.type : "",
  phone: row && "phone" in row ? row.phone : "",
});

const matches = (row: MasterRow, q: string) => {
  const needle = q.trim().toLocaleLowerCase("vi");
  if (!needle) return true;
  return [
    row.code,
    row.name,
    row.note,
    "type" in row ? row.type : "",
    "phone" in row ? row.phone : "",
  ]
    .join(" ")
    .toLocaleLowerCase("vi")
    .includes(needle);
};

const activeBadge = (active: boolean) => (
  <span
    className={`${badgeClass} ${
      active
        ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
        : "bg-stone-100 text-stone-700 ring-1 ring-stone-300"
    }`}
  >
    {active ? "Đang dùng" : "Ngừng dùng"}
  </span>
);

export function MaterialsCatalog() {
  const { materials, facilities } = useMaterials();
  return (
    <>
      <MasterSection kind="material" rows={materials} />
      <MasterSection kind="facility" rows={facilities} />
    </>
  );
}

const copy: Record<
  MasterKind,
  { heading: string; add: string; label: string; columns: string[] }
> = {
  material: {
    heading: "Danh mục vật tư (KhoNVL)",
    add: "Thêm vật tư",
    label: "vật tư",
    columns: [
      "STT",
      "Mã",
      "Tên",
      "ĐVT",
      "Tồn đầu kỳ",
      "Tồn tối thiểu",
      "Ghi chú",
      "Trạng thái",
    ],
  },
  facility: {
    heading: "Cơ sở / người nhận (Cososx)",
    add: "Thêm cơ sở",
    label: "cơ sở",
    columns: ["STT", "Loại", "Mã", "Tên", "SĐT", "Ghi chú", "Trạng thái"],
  },
};

function MasterSection({
  kind,
  rows,
}: {
  kind: MasterKind;
  rows: MasterRow[];
}) {
  const { capabilities, busy, confirm, guard, notify, fail, refreshAll } =
    useMaterials();
  const [q, setQ] = useState("");
  const [editor, setEditor] = useState<{ existing: MasterRow | null } | null>(
    null,
  );
  const [reactivating, setReactivating] = useState("");
  const editorAnchor = useRef<HTMLDivElement>(null);
  const canEdit = capabilities.manageCatalog;
  const text = copy[kind];
  const visible = rows.filter((row) => matches(row, q));

  function openEditor(existing: MasterRow | null) {
    guard(() => {
      setEditor({ existing });
      window.setTimeout(
        () =>
          editorAnchor.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        0,
      );
    });
  }

  async function reactivate(row: MasterRow) {
    setReactivating(row.id);
    try {
      await saveMasters(kind, [
        { id: row.id, version: row.version, patch: { active: true } },
      ]);
      await refreshAll();
      notify(`Đã dùng lại ${text.label} ${masterLabel(row)}.`);
    } catch (reason) {
      fail(reason, "Không đổi được trạng thái.");
    } finally {
      setReactivating("");
    }
  }

  return (
    <section className={`${cardClass} space-y-4`} aria-label={text.heading}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-burgundy font-serif text-2xl">{text.heading}</h2>
        <div className="materials-no-print flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className={labelClass}>Tìm {text.label}</span>
            <input
              aria-label={`Tìm ${text.label}`}
              placeholder="Mã, tên, ghi chú…"
              className={`${fieldClass} min-w-64`}
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
          {canEdit && (
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !!editor}
              onClick={() => openEditor(null)}
            >
              {text.add}
            </button>
          )}
          <span className="text-charcoal/65 text-sm">
            Hiển thị {visible.length}/{rows.length} dòng
          </span>
        </div>
      </div>

      <div ref={editorAnchor}>
        {editor && canEdit && (
          <MasterEditor
            key={editor.existing?.id ?? "new"}
            kind={kind}
            existing={editor.existing}
            others={rows.filter((row) => row.id !== editor.existing?.id)}
            onSaved={() => setEditor(null)}
            onCancel={() => setEditor(null)}
          />
        )}
      </div>

      <div className={`${tableWrapClass} materials-table-wrap`}>
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">{text.heading}</caption>
          <thead className={theadClass}>
            <tr>
              {text.columns.map((label) => (
                <th key={label} scope="col" className={thClass}>
                  {label}
                </th>
              ))}
              {canEdit && (
                <th
                  scope="col"
                  className={`${thClass} materials-no-print border-burgundy/12 bg-ivory sticky right-0 border-l`}
                >
                  Thao tác
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr
                key={row.id}
                className={`border-burgundy/10 hover:bg-ivory/40 border-t align-top ${row.active ? "" : "text-charcoal/50"}`}
              >
                <td className={`${tdClass} font-semibold`}>{index + 1}</td>
                {kind === "facility" && (
                  <td className={tdClass}>
                    {"type" in row ? row.type || "—" : "—"}
                  </td>
                )}
                <td className={`${tdClass} font-semibold`}>{row.code}</td>
                <td className={`${tdClass} min-w-52`}>{row.name || "—"}</td>
                {kind === "material" && "unit" in row && (
                  <>
                    <td className={tdClass}>{row.unit || "—"}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {formatQuantity(row.openingQuantity)}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {row.minimumStock === null
                        ? "—"
                        : formatQuantity(row.minimumStock)}
                    </td>
                  </>
                )}
                {kind === "facility" && (
                  <td className={tdClass}>
                    {"phone" in row ? row.phone || "—" : "—"}
                  </td>
                )}
                <td className={`${tdClass} min-w-48 whitespace-pre-wrap`}>
                  {row.note || "—"}
                </td>
                <td className={tdClass}>{activeBadge(row.active)}</td>
                {canEdit && (
                  <td
                    className={`${tdClass} materials-no-print border-burgundy/12 sticky right-0 space-y-2 border-l bg-white`}
                  >
                    <button
                      type="button"
                      className={`${ghostButtonClass} whitespace-nowrap`}
                      disabled={busy}
                      aria-label={`Sửa ${text.label} ${row.code}`}
                      onClick={() => openEditor(row)}
                    >
                      Sửa
                    </button>
                    {row.active ? (
                      <button
                        type="button"
                        className={`${dangerButtonClass} whitespace-nowrap`}
                        disabled={busy}
                        aria-label={`Ngừng dùng ${text.label} ${row.code}`}
                        onClick={() =>
                          guard(() =>
                            confirm({
                              kind: "deactivate",
                              master: row,
                              masterKind: kind,
                            }),
                          )
                        }
                      >
                        Ngừng dùng
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`${ghostButtonClass} whitespace-nowrap`}
                        disabled={busy || reactivating === row.id}
                        aria-label={`Dùng lại ${text.label} ${row.code}`}
                        onClick={() => void reactivate(row)}
                      >
                        Dùng lại
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-charcoal/65 p-8 text-center">
            {rows.length
              ? `Không có ${text.label} nào khớp từ khóa.`
              : `Chưa có ${text.label} nào.`}
          </p>
        )}
      </div>
    </section>
  );
}

function MasterEditor({
  kind,
  existing,
  others,
  onSaved,
  onCancel,
}: {
  kind: MasterKind;
  existing: MasterRow | null;
  others: MasterRow[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { notify, fail, refreshAll, guard, setEditorDirty } = useMaterials();
  const [id] = useState(() => existing?.id ?? crypto.randomUUID());
  const [draft, setDraft] = useState(() => draftOf(existing));
  const [initial] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const codeLocked = !!existing?.hasTransactions;
  const label = copy[kind].label;

  useEffect(() => {
    firstField.current?.focus();
  }, []);
  useEffect(() => {
    setEditorDirty(dirty);
    return () => setEditorDirty(false);
  }, [dirty, setEditorDirty]);

  const update = (patch: Partial<Draft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const patch: Record<string, unknown> = {
      name: draft.name.trim(),
      note: draft.note.trim(),
    };
    if (!codeLocked) {
      const code = draft.code.trim();
      patch.code = code;
      const clash = others.find((row) => codeKey(row.code) === codeKey(code));
      if (!code) found.code = `Mã ${label} không được trống.`;
      else if (clash) found.code = `Mã "${clash.code}" đã tồn tại.`;
    }
    if (kind === "material") {
      patch.unit = draft.unit.trim();
      try {
        patch.openingQuantity = parseCell("quantity", draft.openingQuantity);
      } catch (reason) {
        found.openingQuantity = errorMessage(reason, "Số không hợp lệ");
      }
      try {
        patch.minimumStock = parseCell("unitPrice", draft.minimumStock);
      } catch (reason) {
        found.minimumStock = errorMessage(reason, "Số không hợp lệ");
      }
    } else {
      patch.type = draft.type.trim();
      patch.phone = draft.phone.trim();
    }
    const parsed = (
      kind === "material" ? materialPatchSchema : facilityPatchSchema
    ).safeParse(patch);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        found[String(issue.path[0] ?? "form")] ??= issue.message;
    setErrors(found);
    if (Object.keys(found).length > 0 || !parsed.success) return;

    setSaving(true);
    try {
      const change: MasterChange = {
        id,
        version: existing?.version ?? 0,
        patch: parsed.data,
      };
      const result = await saveMasters(kind, [change]);
      const saved = result.rows[0];
      onSaved();
      await refreshAll();
      notify(
        `${existing ? "Đã cập nhật" : "Đã thêm"} ${label} ${saved ? masterLabel(saved) : draft.code}.`,
      );
    } catch (reason) {
      fail(reason, `Không lưu được ${label}.`);
      // Version conflict or duplicate code: the row on screen is stale.
      if (reason instanceof ApiError && reason.status === 409) {
        onCancel();
        void refreshAll();
      }
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
  const title = existing ? `Sửa ${label}` : copy[kind].add;

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
          <span className={labelClass}>Mã {label}</span>
          <input
            ref={firstField}
            aria-label={`Mã ${label}`}
            className={fieldClass}
            maxLength={150}
            value={draft.code}
            disabled={codeLocked}
            onChange={(event) => update({ code: event.target.value })}
          />
          {codeLocked && (
            <span className="text-charcoal/60 mt-1 block text-xs">
              Mã đã có giao dịch
            </span>
          )}
          {fieldError("code")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Tên {label}</span>
          <input
            aria-label={`Tên ${label}`}
            className={fieldClass}
            maxLength={300}
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
          />
          {fieldError("name")}
        </label>
        {kind === "material" ? (
          <>
            <label className="text-sm">
              <span className={labelClass}>ĐVT</span>
              <input
                aria-label="ĐVT"
                className={fieldClass}
                maxLength={50}
                value={draft.unit}
                onChange={(event) => update({ unit: event.target.value })}
              />
              {fieldError("unit")}
            </label>
            <label className="text-sm">
              <span className={labelClass}>Tồn đầu kỳ</span>
              <input
                aria-label="Tồn đầu kỳ"
                inputMode="decimal"
                className={fieldClass}
                value={draft.openingQuantity}
                onChange={(event) =>
                  update({ openingQuantity: event.target.value })
                }
              />
              {fieldError("openingQuantity")}
            </label>
            <label className="text-sm">
              <span className={labelClass}>Tồn tối thiểu (không bắt buộc)</span>
              <input
                aria-label="Tồn tối thiểu"
                inputMode="decimal"
                className={fieldClass}
                value={draft.minimumStock}
                onChange={(event) =>
                  update({ minimumStock: event.target.value })
                }
              />
              {fieldError("minimumStock")}
            </label>
          </>
        ) : (
          <>
            <label className="text-sm">
              <span className={labelClass}>Loại</span>
              <input
                aria-label="Loại"
                className={fieldClass}
                maxLength={50}
                placeholder="VD: Loại 1"
                value={draft.type}
                onChange={(event) => update({ type: event.target.value })}
              />
              {fieldError("type")}
            </label>
            <label className="text-sm">
              <span className={labelClass}>SĐT</span>
              <input
                aria-label="SĐT"
                className={fieldClass}
                maxLength={50}
                value={draft.phone}
                onChange={(event) => update({ phone: event.target.value })}
              />
              {fieldError("phone")}
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
        <button className={buttonClass} disabled={saving} type="submit">
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
        {kind === "material"
          ? "Hạ tồn đầu kỳ không được làm tồn kho âm. Số thập phân dùng dấu chấm (0.3)."
          : "Mã cơ sở dùng để ghi phiếu xuất; đổi tên không ảnh hưởng phiếu đã ghi."}
      </p>
    </form>
  );
}
