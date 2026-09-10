import "server-only";
import { Schema } from "mongoose";
import { getOrCreateModel } from "@/lib/content/mongoose";

const rowSchema = new Schema(
  {
    _id: { type: String, required: true },
    version: { type: Number, required: true },
    sourceRow: Number,
    importKey: String,
    deleted: { type: Boolean, default: false },
    exportDate: { type: Date, required: true },
    facilityCode: String,
    facilityNameSnapshot: String,
    materialCode: String,
    materialNameSnapshot: String,
    description: String,
    unit: String,
    // Canonical decimal strings avoid binary floating point and survive JSON without loss.
    quantity: String,
    unitPrice: String,
    amount: String,
    actualQuantity: String,
    discountedUnitPrice: String,
    actualAmount: String,
    actualQuantityManual: Boolean,
    discountedPriceManual: Boolean,
    note: String,
    createdAt: String,
    updatedAt: String,
    createdBy: String,
    updatedBy: String,
  },
  { versionKey: false, strict: "throw" },
);
rowSchema.index({ importKey: 1 }, { unique: true, sparse: true });
rowSchema.index({ deleted: 1, exportDate: 1, _id: 1 });
rowSchema.index({ materialCode: 1, exportDate: 1 });
rowSchema.index({ facilityCode: 1, exportDate: 1 });
const masterSchema = new Schema(
  {
    kind: { type: String, enum: ["facility", "material"], required: true },
    key: { type: String, required: true },
    code: String,
    name: String,
    unit: String,
    unitPrice: String,
    /**
     * "Giá bán" of the sales slip (`KhoSon!E` in `08092026.xlsx`), kept apart
     * from `unitPrice`, which the export ledger reads. Null when the sales
     * workbook never listed the code.
     */
    salePrice: String,
  },
  { versionKey: false, strict: "throw" },
);
masterSchema.index({ kind: 1, key: 1 }, { unique: true });
export const getPaintRowModel = () =>
  getOrCreateModel("PaintWarehouseExport", rowSchema);
export const getPaintMasterModel = () =>
  getOrCreateModel("PaintWarehouseMaster", masterSchema);
