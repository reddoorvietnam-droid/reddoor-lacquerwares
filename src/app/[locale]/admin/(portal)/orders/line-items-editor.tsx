"use client";

import { useState } from "react";

/**
 * The product lines of an order, edited as a small table and posted as one
 * JSON field so the server action validates the rows in one go. Rows without
 * an item code are dropped on submit; the server never sees them.
 */

export type LineItemRow = {
  productCode: string;
  description: string;
  quantity: string;
  unit: string;
  facilityName: string;
  note: string;
};

const emptyRow: LineItemRow = {
  productCode: "",
  description: "",
  quantity: "",
  unit: "cái",
  facilityName: "",
  note: "",
};

const copy = {
  vi: {
    code: "Mã hàng",
    description: "Mô tả",
    quantity: "Số lượng",
    unit: "ĐVT",
    facility: "Đơn vị sản xuất",
    note: "Ghi chú",
    add: "Thêm dòng",
    remove: "Xóa",
  },
  en: {
    code: "Item code",
    description: "Description",
    quantity: "Quantity",
    unit: "Unit",
    facility: "Production site",
    note: "Note",
    add: "Add line",
    remove: "Remove",
  },
} as const;

const cellClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-lg border bg-white px-2 py-1.5 text-sm outline-none";

export function LineItemsEditor({
  locale,
  name,
  initial,
  facilityNames,
}: {
  locale: "vi" | "en";
  /** Name of the hidden field carrying the rows as JSON. */
  name: string;
  initial: readonly LineItemRow[];
  /** Production sites already known to the stock ledger, offered as suggestions. */
  facilityNames: readonly string[];
}) {
  const text = copy[locale];
  const [rows, setRows] = useState<LineItemRow[]>(
    initial.length > 0 ? [...initial] : [{ ...emptyRow }],
  );

  const update = (index: number, patch: Partial<LineItemRow>) =>
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );

  const payload = rows
    .filter((row) => row.productCode.trim().length > 0)
    .map((row) => ({
      productCode: row.productCode.trim(),
      description: row.description.trim(),
      quantity: row.quantity.trim(),
      unit: row.unit.trim() || "cái",
      facilityName: row.facilityName.trim() || null,
      note: row.note.trim() || null,
    }));

  const listId = `${name}-facilities`;

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(payload)} />
      <datalist id={listId}>
        {facilityNames.map((facility) => (
          <option key={facility} value={facility} />
        ))}
      </datalist>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="text-charcoal/60 text-xs tracking-[0.12em] uppercase">
              <th className="px-1 py-2 font-semibold">{text.code}</th>
              <th className="px-1 py-2 font-semibold">{text.description}</th>
              <th className="w-24 px-1 py-2 font-semibold">{text.quantity}</th>
              <th className="w-20 px-1 py-2 font-semibold">{text.unit}</th>
              <th className="px-1 py-2 font-semibold">{text.facility}</th>
              <th className="px-1 py-2 font-semibold">{text.note}</th>
              <th className="w-16 px-1 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td className="px-1 py-1">
                  <input
                    value={row.productCode}
                    maxLength={80}
                    onChange={(event) =>
                      update(index, { productCode: event.target.value })
                    }
                    className={`${cellClass} font-mono`}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.description}
                    maxLength={300}
                    onChange={(event) =>
                      update(index, { description: event.target.value })
                    }
                    className={cellClass}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.quantity}
                    inputMode="decimal"
                    maxLength={14}
                    onChange={(event) =>
                      update(index, { quantity: event.target.value })
                    }
                    className={`${cellClass} font-mono`}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.unit}
                    maxLength={20}
                    onChange={(event) =>
                      update(index, { unit: event.target.value })
                    }
                    className={cellClass}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.facilityName}
                    list={listId}
                    maxLength={150}
                    onChange={(event) =>
                      update(index, { facilityName: event.target.value })
                    }
                    className={cellClass}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.note}
                    maxLength={500}
                    onChange={(event) =>
                      update(index, { note: event.target.value })
                    }
                    className={cellClass}
                  />
                </td>
                <td className="px-1 py-1 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) =>
                        current.length === 1
                          ? [{ ...emptyRow }]
                          : current.filter((_row, at) => at !== index),
                      )
                    }
                    className="text-lacquer text-xs font-semibold hover:underline"
                  >
                    {text.remove}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setRows((current) => [...current, { ...emptyRow }])}
        className="border-burgundy/25 text-burgundy hover:border-burgundy/50 mt-3 inline-flex min-h-9 items-center rounded-full border px-4 text-xs font-semibold"
      >
        {text.add}
      </button>
    </div>
  );
}
