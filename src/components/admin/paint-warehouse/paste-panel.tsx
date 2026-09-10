"use client";

import { useState } from "react";
import {
  applyPatch,
  emptyRow,
  parseCell,
  patchSchema,
  type Master,
  type PaintRow,
} from "@/domains/paint-warehouse/contracts";
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
  errorMessage,
  displayDate,
  findMaster,
  formatNumber,
  maxPasteRows,
  todayInBusinessZone,
  type PaintChange,
} from "./shared";

/**
 * Bulk entry without the spreadsheet: rows copied from Excel are checked on
 * screen (mã, số, thành tiền) and written in one all-or-nothing request.
 */

const layout =
  "Ngày ⇥ Mã cơ sở ⇥ Mã vật tư ⇥ Số lượng ⇥ SL thực nhận ⇥ Đơn giá đã chiết khấu ⇥ Ghi chú";

type PreviewRow = {
  line: number;
  cells: string[];
  change: PaintChange | null;
  row: PaintRow | null;
  error: string | null;
};

export function PaintPastePanel({
  masters,
  busy,
  onWrite,
  onClose,
}: {
  masters: readonly Master[];
  busy: boolean;
  onWrite: (changes: PaintChange[]) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [readError, setReadError] = useState("");
  const [saving, setSaving] = useState(false);

  function read() {
    setReadError("");
    // Excel copies rows as tab-separated lines with a trailing newline.
    const lines = text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((raw, index) => ({ line: index + 1, raw }))
      .filter(({ raw }) => raw.trim() !== "");
    if (lines.length > maxPasteRows) {
      setReadError(`Dán tối đa ${maxPasteRows} dòng mỗi lần.`);
      setPreview(null);
      return;
    }
    const today = todayInBusinessZone();
    setPreview(
      lines.map(({ line, raw }) => {
        const cells = raw.split("\t").map((cell) => cell.trim());
        const [date, facility, material, quantity, actual, discounted, note] =
          cells;
        try {
          const patch = patchSchema.parse({
            exportDate: date ? parseCell("exportDate", date) : today,
            facilityCode:
              findMaster(masters, "facility", facility ?? "")?.code ??
              facility ??
              "",
            materialCode:
              findMaster(masters, "material", material ?? "")?.code ??
              material ??
              "",
            description: "xuất kho",
            quantity: parseCell("quantity", quantity ?? ""),
            actualQuantity: parseCell("actualQuantity", actual ?? ""),
            discountedUnitPrice: parseCell(
              "discountedUnitPrice",
              discounted ?? "",
            ),
            note: note ?? "",
          });
          const id = crypto.randomUUID();
          const row = applyPatch(
            emptyRow(id, patch.exportDate ?? today, ""),
            patch,
            masters,
          );
          if (!row.materialCode) throw new Error("Chưa có mã vật tư.");
          if (row.quantity === null) throw new Error("Chưa có số lượng.");
          return {
            line,
            cells,
            change: { id, version: 0, patch },
            row,
            error: null,
          };
        } catch (reason) {
          return {
            line,
            cells,
            change: null,
            row: null,
            error: errorMessage(reason, "Dòng không hợp lệ."),
          };
        }
      }),
    );
  }

  const valid = preview?.filter((entry) => entry.change) ?? [];
  const invalid = (preview?.length ?? 0) - valid.length;

  async function write() {
    const changes = valid.flatMap((entry) =>
      entry.change ? [entry.change] : [],
    );
    if (!changes.length) return;
    setSaving(true);
    try {
      await onWrite(changes);
      setText("");
      setPreview(null);
      onClose();
    } catch {
      // The batch is all-or-nothing on the server and the page shows why;
      // the pasted text stays so the storekeeper can fix and try again.
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${cardClass} space-y-4`} aria-label="Dán từ Excel">
      <h2 className="text-burgundy font-serif text-xl">Dán từ Excel</h2>
      <p className="text-charcoal/60 text-sm">
        Mỗi dòng một phiếu, các cột cách nhau bằng Tab (sao chép trực tiếp từ
        Excel): {layout}. Ngày trống lấy hôm nay; các cột cuối có thể bỏ trống.
        Tối đa {maxPasteRows} dòng.
      </p>
      <label className="block text-sm">
        <span className={labelClass}>Các dòng từ Excel</span>
        <textarea
          aria-label="Các dòng từ Excel"
          className={`${fieldClass} font-mono`}
          rows={6}
          disabled={saving}
          placeholder={`Dán các dòng từ Excel: ${layout}`}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPreview(null);
            setReadError("");
          }}
        />
      </label>
      {readError && (
        <p className="text-lacquer text-sm" role="alert">
          {readError}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={preview ? ghostButtonClass : buttonClass}
          disabled={saving || !text.trim()}
          onClick={read}
        >
          Đọc dữ liệu
        </button>
        {preview && (
          <button
            type="button"
            className={buttonClass}
            disabled={saving || busy || valid.length === 0}
            onClick={() => void write()}
          >
            Ghi {valid.length} dòng
          </button>
        )}
        <button
          type="button"
          className={ghostButtonClass}
          disabled={saving}
          onClick={onClose}
        >
          Đóng
        </button>
      </div>

      {preview && (
        <>
          <p className="text-sm" role="status">
            Đã đọc {preview.length} dòng: {valid.length} hợp lệ
            {invalid ? `, ${invalid} lỗi (không ghi)` : ""}.
          </p>
          <div className={tableWrapClass}>
            <table className="w-full min-w-250 border-collapse text-sm">
              <thead className={theadClass}>
                <tr>
                  {[
                    "Dòng",
                    "Ngày",
                    "Cơ sở SX",
                    "Vật tư",
                    "Số lượng",
                    "SL thực nhận",
                    "Đơn giá đã chiết khấu",
                    "Thành tiền thực nhận",
                    "Ghi chú",
                    "Kết quả",
                  ].map((label) => (
                    <th key={label} scope="col" className={thClass}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((entry) => (
                  <tr
                    key={entry.line}
                    className={`border-burgundy/10 border-t ${entry.error ? "bg-red-50" : ""}`}
                  >
                    <td className={tdClass}>{entry.line}</td>
                    <td className={tdClass}>
                      {entry.row
                        ? displayDate(entry.row.exportDate)
                        : entry.cells[0] || "—"}
                    </td>
                    <td className={tdClass}>
                      {entry.row
                        ? entry.row.facilityNameSnapshot ||
                          entry.row.facilityCode ||
                          "—"
                        : entry.cells[1] || "—"}
                    </td>
                    <td className={tdClass}>
                      {entry.row
                        ? `${entry.row.materialNameSnapshot || entry.row.materialCode}${entry.row.unit ? ` (${entry.row.unit})` : ""}`
                        : entry.cells[2] || "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {entry.row
                        ? formatNumber(entry.row.quantity)
                        : entry.cells[3] || "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {entry.row
                        ? formatNumber(entry.row.actualQuantity)
                        : entry.cells[4] || "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {entry.row
                        ? formatNumber(entry.row.discountedUnitPrice)
                        : entry.cells[5] || "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {entry.row ? formatNumber(entry.row.actualAmount) : "—"}
                    </td>
                    <td className={`${tdClass} whitespace-pre-wrap`}>
                      {(entry.row ? entry.row.note : entry.cells[6]) || "—"}
                    </td>
                    <td className={tdClass}>
                      {entry.error ? (
                        <>
                          <span
                            className={`${badgeClass} mr-2 bg-red-100 text-red-900 ring-1 ring-red-300`}
                          >
                            Lỗi
                          </span>
                          {entry.error}
                        </>
                      ) : (
                        <span
                          className={`${badgeClass} bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300`}
                        >
                          Hợp lệ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
