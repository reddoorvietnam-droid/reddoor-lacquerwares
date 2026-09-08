"use client";

import { useState } from "react";
import {
  emptySampleDate,
  sampleDateFields,
  sampleRowInputSchema,
  sampleStatuses,
  sampleTextFields,
  statusLabels,
  type SampleDate,
  type SampleRowInput,
} from "@/domains/sample-progress/contracts";
import {
  buttonClass,
  cardClass,
  fieldClass,
  ghostButtonClass,
  labelClass,
  isStatus,
} from "./sample-progress-shared";

/**
 * A date column may hold a real date, wording kept from the workbook, or
 * nothing. The three cases are edited explicitly so nobody has to encode a note
 * like "Chờ gửi" as a fake date.
 */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SampleDate;
  onChange: (next: SampleDate) => void;
}) {
  return (
    <fieldset className="border-burgundy/15 rounded-xl border p-3">
      <legend className={labelClass}>{label}</legend>
      <select
        aria-label={`${label} — kiểu dữ liệu`}
        className={`${fieldClass} mb-2`}
        value={value.kind}
        onChange={(event) => {
          const kind = event.target.value;
          if (kind === "date") onChange({ kind: "date", value: "" });
          else if (kind === "text") onChange({ kind: "text", value: "" });
          else onChange(emptySampleDate);
        }}
      >
        <option value="empty">Chưa có</option>
        <option value="date">Ngày cụ thể</option>
        <option value="text">Ghi chú (VD: Chờ gửi)</option>
      </select>
      {value.kind === "date" && (
        <input
          type="date"
          aria-label={label}
          className={fieldClass}
          value={value.value}
          onChange={(event) =>
            onChange({ kind: "date", value: event.target.value })
          }
        />
      )}
      {value.kind === "text" && (
        <input
          type="text"
          aria-label={`${label} — ghi chú`}
          className={fieldClass}
          maxLength={300}
          placeholder="VD: Chờ gửi"
          value={value.value}
          onChange={(event) =>
            onChange({ kind: "text", value: event.target.value })
          }
        />
      )}
    </fieldset>
  );
}

export function SampleProgressEditor({
  draft,
  existing,
  busy,
  otherNumbers,
  onChange,
  onApply,
  onCancel,
}: {
  draft: SampleRowInput;
  existing: boolean;
  busy: boolean;
  otherNumbers: readonly number[];
  onChange: (next: SampleRowInput) => void;
  onApply: (row: SampleRowInput) => void;
  onCancel: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    const parsed = sampleRowInputSchema.safeParse(draft);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        found[String(issue.path[0] ?? "form")] = issue.message;
    if (otherNumbers.includes(draft.number))
      found.number = "STT này đã có trong báo cáo. Hãy chọn số khác.";
    setErrors(found);
    // Nothing is written back to the table until every field is valid, so a
    // rejected edit never half-applies.
    if (Object.keys(found).length === 0) onApply(draft);
  }

  const error = (key: string) =>
    errors[key] ? (
      <p className="text-lacquer mt-1 text-xs" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form
      className={`${cardClass} sample-no-print space-y-4`}
      onSubmit={submit}
      aria-label={existing ? "Cập nhật mẫu" : "Thêm mẫu mới"}
    >
      <h3 className="text-burgundy font-serif text-xl">
        {existing ? "Cập nhật mẫu" : "Thêm mẫu mới"}
      </h3>
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className={labelClass}>STT</span>
          <input
            aria-label="STT"
            type="number"
            min={1}
            max={999999}
            required
            className={fieldClass}
            value={draft.number || ""}
            onChange={(event) =>
              onChange({ ...draft, number: Number(event.target.value) })
            }
          />
          {error("number")}
        </label>
        <label className="text-sm">
          <span className={labelClass}>Trạng thái tổng thể</span>
          <select
            aria-label="Trạng thái tổng thể"
            className={fieldClass}
            value={draft.status}
            onChange={(event) =>
              isStatus(event.target.value) &&
              onChange({ ...draft, status: event.target.value })
            }
          >
            {sampleStatuses.map((key) => (
              <option key={key} value={key}>
                {statusLabels[key]}
              </option>
            ))}
          </select>
        </label>
        {sampleTextFields.map(({ key, label, max, rows }) => (
          <label
            key={key}
            className={`text-sm ${rows > 1 ? "md:col-span-2" : ""}`}
          >
            <span className={labelClass}>{label}</span>
            <textarea
              aria-label={label}
              className={fieldClass}
              rows={rows}
              required={key === "orderName"}
              maxLength={max}
              value={draft[key]}
              onChange={(event) =>
                onChange({ ...draft, [key]: event.target.value })
              }
            />
            {error(key)}
          </label>
        ))}
        <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
          {sampleDateFields.map(({ key, label }) => (
            <div key={key}>
              <DateField
                label={label}
                value={draft[key]}
                onChange={(next) => onChange({ ...draft, [key]: next })}
              />
              {error(key)}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} disabled={busy} type="submit">
          Áp dụng vào bảng
        </button>
        <button
          className={ghostButtonClass}
          disabled={busy}
          type="button"
          onClick={onCancel}
        >
          Hủy chỉnh sửa mẫu
        </button>
      </div>
      <p className="text-charcoal/60 text-sm">
        Thay đổi chỉ vào bảng khi bấm “Áp dụng vào bảng”, và chỉ được ghi vào hệ
        thống khi bấm “Lưu báo cáo”.
      </p>
    </form>
  );
}
