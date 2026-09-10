import Decimal from "decimal.js";
import { z } from "zod";

export const fields = [
  "exportDate",
  "facilityCode",
  "facilityNameSnapshot",
  "materialCode",
  "materialNameSnapshot",
  "description",
  "unit",
  "quantity",
  "unitPrice",
  "amount",
  "actualQuantity",
  "discountedUnitPrice",
  "actualAmount",
  "note",
] as const;
export type Field = (typeof fields)[number];
export const editableFields = [
  "exportDate",
  "facilityCode",
  "materialCode",
  "description",
  "quantity",
  "actualQuantity",
  "discountedUnitPrice",
  "note",
] as const;
export type EditableField = (typeof editableFields)[number];
export const codeKey = (code: string) => code.trim().toLocaleLowerCase("en-US");
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Ngày không hợp lệ");
export const decimalSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,14})(?:\.\d{1,8})?$/,
    "Nhập số không âm, tối đa 8 chữ số thập phân",
  )
  .transform((value) => new Decimal(value).toFixed());
export const patchSchema = z
  .object({
    exportDate: dateSchema,
    facilityCode: z.string().trim().max(150),
    materialCode: z.string().trim().max(150),
    description: z.string().max(2000),
    quantity: decimalSchema.nullable(),
    actualQuantity: decimalSchema.nullable(),
    discountedUnitPrice: decimalSchema.nullable(),
    note: z.string().max(4000),
  })
  .partial()
  .strict();
export type RowPatch = z.infer<typeof patchSchema>;
export type PaintRow = {
  id: string;
  version: number;
  sourceRow: number | null;
  exportDate: string;
  facilityCode: string;
  facilityNameSnapshot: string;
  materialCode: string;
  materialNameSnapshot: string;
  description: string;
  unit: string;
  quantity: string | null;
  unitPrice: string | null;
  amount: string | null;
  actualQuantity: string | null;
  discountedUnitPrice: string | null;
  actualAmount: string | null;
  actualQuantityManual: boolean;
  discountedPriceManual: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};
export type Master = {
  kind: "facility" | "material";
  code: string;
  name: string;
  unit: string;
  unitPrice: string | null;
};
export class PaintError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PaintError";
  }
}
export const multiply = (a: string | null, b: string | null) =>
  a === null || b === null ? null : new Decimal(a).mul(b).toFixed();
export function applyPatch(
  row: PaintRow,
  patch: RowPatch,
  masters: readonly Master[],
): PaintRow {
  const next: PaintRow = Object.assign(
    { ...row },
    Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
  );
  if (
    patch.facilityCode !== undefined &&
    codeKey(patch.facilityCode) !== codeKey(row.facilityCode)
  ) {
    const facility = masters.find(
      (m) =>
        m.kind === "facility" &&
        codeKey(m.code) === codeKey(patch.facilityCode!),
    );
    if (!facility && patch.facilityCode)
      throw new PaintError("Mã cơ sở SX không có trong danh mục.");
    next.facilityNameSnapshot = facility?.name ?? "";
  }
  if (
    patch.materialCode !== undefined &&
    (codeKey(patch.materialCode) !== codeKey(row.materialCode) ||
      row.unitPrice === null)
  ) {
    const material = masters.find(
      (m) =>
        m.kind === "material" &&
        codeKey(m.code) === codeKey(patch.materialCode!),
    );
    if (!material && patch.materialCode)
      throw new PaintError("Mã vật tư không có trong danh mục.");
    next.materialNameSnapshot = material?.name ?? "";
    next.unit = material?.unit ?? "";
    next.unitPrice = material?.unitPrice ?? null;
    if (
      (!row.discountedPriceManual || row.discountedUnitPrice === null) &&
      patch.discountedUnitPrice === undefined
    )
      next.discountedUnitPrice = next.unitPrice;
  }
  if (
    patch.quantity !== undefined &&
    (!row.actualQuantityManual || row.actualQuantity === null) &&
    patch.actualQuantity === undefined
  )
    next.actualQuantity = patch.quantity;
  if (patch.actualQuantity !== undefined)
    next.actualQuantityManual = patch.actualQuantity !== null;
  if (patch.actualQuantity === null) next.actualQuantity = next.quantity;
  if (patch.discountedUnitPrice !== undefined)
    next.discountedPriceManual = patch.discountedUnitPrice !== null;
  if (patch.discountedUnitPrice === null)
    next.discountedUnitPrice = next.unitPrice;
  next.amount = multiply(next.quantity, next.unitPrice);
  next.actualAmount = multiply(next.actualQuantity, next.discountedUnitPrice);
  return next;
}
export function emptyRow(id: string, date: string, actor: string): PaintRow {
  const now = new Date().toISOString();
  return {
    id,
    version: 0,
    sourceRow: null,
    exportDate: date,
    facilityCode: "",
    facilityNameSnapshot: "",
    materialCode: "",
    materialNameSnapshot: "",
    description: "xuất kho",
    unit: "",
    quantity: null,
    unitPrice: null,
    amount: null,
    actualQuantity: null,
    discountedUnitPrice: null,
    actualAmount: null,
    actualQuantityManual: false,
    discountedPriceManual: false,
    note: "",
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
    updatedBy: actor,
  };
}
/** Clipboard numbers follow Excel's displayed comma-grouping and dot-decimals. */
export function parseCell(field: EditableField, text: string): string | null {
  const value = text.trim();
  if (field === "exportDate") {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    return dateSchema.parse(
      match
        ? `${match[3]}-${match[2]!.padStart(2, "0")}-${match[1]!.padStart(2, "0")}`
        : value,
    );
  }
  if (["quantity", "actualQuantity", "discountedUnitPrice"].includes(field)) {
    if (!value) return null;
    if (value.includes(",") && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(value))
      throw new PaintError(
        "Dùng dấu chấm cho số thập phân (ví dụ 0.3); dấu phẩy phân cách hàng nghìn.",
      );
    return decimalSchema.parse(value.replaceAll(",", ""));
  }
  return text;
}
