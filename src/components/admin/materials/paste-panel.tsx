"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import {
  applyTransactionPatch,
  decideStock,
  displayDate,
  emptyTransaction,
  parseCell,
  stockDelta,
  todayInBusinessZone,
  transactionCompleteness,
  transactionPatchSchema,
  type MaterialTransaction,
  type TransactionChange,
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
import { saveTransactions } from "./api";
import { useMaterials } from "./materials-workspace";
import {
  badgeClass,
  errorMessage,
  formatQuantity,
  slipLabels,
  typeLabels,
} from "./materials-shared";

/**
 * Bulk entry without the spreadsheet: rows copied from Excel are checked on
 * screen (codes, numbers, stock across the whole batch) and written in one
 * all-or-nothing request.
 */

type LedgerType = "INBOUND" | "OUTBOUND";
const maxRows = 500;
const layout: Record<LedgerType, string> = {
  INBOUND: "Ngày ⇥ Mã vật tư ⇥ Số lượng ⇥ Ghi chú",
  OUTBOUND: "Ngày ⇥ Mã cơ sở ⇥ Mã vật tư ⇥ Số lượng ⇥ Ghi chú",
};

type PreviewRow = {
  line: number;
  cells: string[];
  change: TransactionChange | null;
  row: MaterialTransaction | null;
  error: string | null;
};

export function PasteFromExcel({ onClose }: { onClose: () => void }) {
  const { capabilities, lookups, stock, notify, fail, refreshStock, busy } =
    useMaterials();
  const allowed: LedgerType[] = [
    ...(capabilities.receive ? (["INBOUND"] as const) : []),
    ...(capabilities.issue ? (["OUTBOUND"] as const) : []),
  ];
  const [type, setType] = useState<LedgerType>(allowed[0] ?? "INBOUND");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  function read() {
    const lines = text
      .split(/\r?\n/)
      .map((line, index) => ({ line: index + 1, raw: line }))
      .filter(({ raw }) => raw.trim() !== "");
    if (lines.length > maxRows) {
      fail(new Error(`Tối đa ${maxRows} dòng mỗi lần dán.`));
      return;
    }
    const today = todayInBusinessZone();
    const deltas = new Map<string, Decimal>();
    const rows: PreviewRow[] = lines.map(({ line, raw }) => {
      const cells = raw.split("\t").map((cell) => cell.trim());
      const [date, second, third, fourth, fifth] = cells;
      const fields =
        type === "INBOUND"
          ? { facility: "", material: second, quantity: third, note: fourth }
          : {
              facility: second,
              material: third,
              quantity: fourth,
              note: fifth,
            };
      try {
        const patch = transactionPatchSchema.parse({
          transactionDate: date ? parseCell("transactionDate", date) : today,
          materialCode: fields.material ?? "",
          quantity: parseCell("quantity", fields.quantity ?? ""),
          note: fields.note ?? "",
          ...(type === "OUTBOUND"
            ? { facilityCode: fields.facility ?? "" }
            : {}),
        });
        const id = crypto.randomUUID();
        const row = applyTransactionPatch(
          emptyTransaction(id, type, patch.transactionDate ?? today, ""),
          patch,
          lookups,
        );
        const missing = transactionCompleteness(row);
        if (missing) throw new Error(missing);
        if (type === "OUTBOUND") {
          // Stock is checked across the batch: three lines of 4 against 10 fail on the third.
          const delta = (deltas.get(row.materialId) ?? new Decimal(0)).add(
            stockDelta(type, row.quantity),
          );
          const balance = stock.get(row.materialId);
          if (balance) {
            const decision = decideStock(balance.currentQuantity, delta);
            if (!decision.allowed)
              throw new Error(
                `Số lượng xuất vượt quá tồn kho hiện tại. Tồn hiện tại: ${formatQuantity(decision.current)} ${row.unit} · Yêu cầu xuất (cộng dồn): ${formatQuantity(decision.requested)} ${row.unit}`,
              );
          }
          // Rejected rows are never sent, so they must not count against later rows.
          deltas.set(row.materialId, delta);
        }
        return {
          line,
          cells,
          change: { id, version: 0, type, patch },
          row,
          error: null,
        };
      } catch (reason) {
        return {
          line,
          cells,
          change: null,
          row: null,
          error: errorMessage(reason, "Dòng không hợp lệ"),
        };
      }
    });
    setPreview(rows);
  }

  const valid = preview?.filter((row) => row.change) ?? [];
  const invalid = (preview?.length ?? 0) - valid.length;

  async function write() {
    const changes = valid.flatMap((row) => (row.change ? [row.change] : []));
    if (!changes.length) return;
    setSaving(true);
    try {
      const result = await saveTransactions(changes);
      notify(
        `Đã ghi ${result.rows.length} ${slipLabels[type]} từ dữ liệu dán; tồn kho đã cập nhật.`,
      );
      setText("");
      setPreview(null);
      await refreshStock();
      onClose();
    } catch (reason) {
      // The batch is all-or-nothing on the server; the text stays for a fix.
      fail(reason, "Không ghi được các dòng đã dán.");
      void refreshStock();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={`${cardClass} materials-no-print space-y-4`}
      aria-label="Dán từ Excel"
    >
      <h2 className="text-burgundy font-serif text-xl">Dán từ Excel</h2>
      <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
        <label className="text-sm">
          <span className={labelClass}>Loại phiếu</span>
          <select
            aria-label="Loại phiếu"
            className={fieldClass}
            value={type}
            disabled={saving}
            onChange={(event) => {
              setType(event.target.value as LedgerType);
              setPreview(null);
            }}
          >
            {allowed.map((option) => (
              <option key={option} value={option}>
                {typeLabels[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className={labelClass}>Các dòng từ Excel</span>
          <textarea
            aria-label="Các dòng từ Excel"
            className={`${fieldClass} font-mono`}
            rows={6}
            disabled={saving}
            placeholder={`Dán các dòng từ Excel: ${layout[type]}`}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPreview(null);
            }}
          />
        </label>
      </div>
      <p className="text-charcoal/60 text-sm">
        Mỗi dòng một phiếu, các cột cách nhau bằng Tab (sao chép trực tiếp từ
        Excel): {layout[type]}. Ngày trống lấy hôm nay. Tối đa {maxRows} dòng.
      </p>
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
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className={theadClass}>
                <tr>
                  {[
                    "Dòng",
                    "Ngày",
                    ...(type === "OUTBOUND" ? ["Cơ sở"] : []),
                    "Vật tư",
                    "Số lượng",
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
                        ? displayDate(entry.row.transactionDate)
                        : entry.cells[0] || "—"}
                    </td>
                    {type === "OUTBOUND" && (
                      <td className={tdClass}>
                        {entry.row
                          ? entry.row.facilityName || entry.row.facilityCode
                          : entry.cells[1] || "—"}
                      </td>
                    )}
                    <td className={tdClass}>
                      {entry.row
                        ? `${entry.row.materialName} (${entry.row.materialCode})`
                        : entry.cells[type === "OUTBOUND" ? 2 : 1] || "—"}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {entry.row
                        ? `${formatQuantity(entry.row.quantity)} ${entry.row.unit}`
                        : entry.cells[type === "OUTBOUND" ? 3 : 2] || "—"}
                    </td>
                    <td className={`${tdClass} whitespace-pre-wrap`}>
                      {(entry.row
                        ? entry.row.note
                        : entry.cells[type === "OUTBOUND" ? 4 : 3]) || "—"}
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
