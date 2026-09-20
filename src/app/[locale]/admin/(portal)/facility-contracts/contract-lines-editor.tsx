"use client";

import { useState } from "react";

/**
 * The goods of a site contract, edited as a small table and posted as one
 * JSON field so the server action validates every row at once. Rows without
 * an item code are dropped on submit.
 */

export type ContractLineRow = {
  productCode: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

const emptyRow: ContractLineRow = {
  productCode: "",
  description: "",
  quantity: "",
  unit: "cái",
  unitPrice: "",
};

const copy = {
  vi: {
    code: "Mã hàng",
    description: "Chủng loại hàng hóa",
    quantity: "Số lượng",
    unit: "ĐVT",
    unitPrice: "Đơn giá (VND)",
    add: "Thêm dòng",
    remove: "Xóa",
  },
  en: {
    code: "Item code",
    description: "Kind of goods",
    quantity: "Quantity",
    unit: "Unit",
    unitPrice: "Unit price (VND)",
    add: "Add line",
    remove: "Remove",
  },
} as const;

const cellClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-lg border bg-white px-2 py-1.5 text-sm outline-none";

export function ContractLinesEditor({
  locale,
  name,
  initial,
}: {
  locale: "vi" | "en";
  /** Name of the hidden field carrying the rows as JSON. */
  name: string;
  initial: readonly ContractLineRow[];
}) {
  const text = copy[locale];
  const [rows, setRows] = useState<ContractLineRow[]>(
    initial.length > 0 ? [...initial] : [{ ...emptyRow }],
  );

  const update = (index: number, patch: Partial<ContractLineRow>) =>
    setRows((current) =>
      current.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );

  const payload = rows
    .filter((row) => row.productCode.trim().length > 0)
    .map((row) => ({
      productCode: row.productCode.trim(),
      description: row.description.trim(),
      quantity: row.quantity.trim() || null,
      unit: row.unit.trim() || "cái",
      unitPrice: row.unitPrice.trim(),
    }));

  const columns: {
    key: keyof ContractLineRow;
    label: string;
    maxLength: number;
    className: string;
    mono?: boolean;
    numeric?: boolean;
  }[] = [
    {
      key: "productCode",
      label: text.code,
      maxLength: 80,
      className: "w-36",
      mono: true,
    },
    {
      key: "description",
      label: text.description,
      maxLength: 300,
      className: "",
    },
    {
      key: "quantity",
      label: text.quantity,
      maxLength: 14,
      className: "w-24",
      mono: true,
      numeric: true,
    },
    { key: "unit", label: text.unit, maxLength: 20, className: "w-20" },
    {
      key: "unitPrice",
      label: text.unitPrice,
      maxLength: 20,
      className: "w-36",
      mono: true,
      numeric: true,
    },
  ];

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(payload)} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="text-charcoal/60 text-xs tracking-[0.12em] uppercase">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-1 py-2 font-semibold ${column.className}`}
                >
                  {column.label}
                </th>
              ))}
              <th className="w-16 px-1 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className="px-1 py-1">
                    <input
                      value={row[column.key]}
                      maxLength={column.maxLength}
                      aria-label={column.label}
                      inputMode={column.numeric ? "decimal" : undefined}
                      onChange={(event) =>
                        update(index, { [column.key]: event.target.value })
                      }
                      className={`${cellClass} ${column.mono ? "font-mono" : ""}`}
                    />
                  </td>
                ))}
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
