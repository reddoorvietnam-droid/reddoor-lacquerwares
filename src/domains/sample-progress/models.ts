import "server-only";
import { Schema } from "mongoose";
import { getOrCreateModel } from "@/lib/content/mongoose";
import { sampleStatuses } from "./contracts";

/**
 * Date columns hold a real date, a business note kept verbatim from the
 * workbook, or nothing at all. Storing the three cases apart is what lets the
 * export write true date cells without ever guessing at wording like
 * "Chờ gửi".
 */
const dateSchema = new Schema(
  {
    kind: { type: String, enum: ["empty", "date", "text"], required: true },
    value: { type: String, default: "" },
  },
  { _id: false, strict: "throw" },
);

const rowSchema = new Schema(
  {
    id: { type: String, required: true },
    number: { type: Number, required: true },
    orderName: { type: String, required: true },
    productDetails: { type: String, default: "" },
    status: { type: String, enum: sampleStatuses, required: true },
    workshop: { type: String, default: "" },
    receivedDate: { type: dateSchema, required: true },
    qcDate: { type: dateSchema, required: true },
    sentDate: { type: dateSchema, required: true },
    notes: { type: String, default: "" },
    // Who last changed this row, carried forward untouched when it did not.
    updatedAt: { type: String, required: true },
    updatedBy: { type: String, default: "" },
    updatedByName: { type: String, default: "" },
  },
  { _id: false, strict: "throw" },
);

// Append-only snapshots. The built-in unique _id (week:revision) makes a
// concurrent save fail atomically, without needing a transaction or autoIndex.
const reportSchema = new Schema(
  {
    _id: { type: String, required: true },
    week: { type: String, required: true },
    weekEnd: { type: String, required: true },
    reportDate: { type: String, required: true },
    revision: { type: Number, required: true },
    previousRevision: { type: Number, default: null },
    inheritedFrom: { type: String, default: null },
    rows: { type: [rowSchema], required: true },
    changeNote: { type: String, required: true },
    createdAt: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, required: true },
    savedAt: { type: String, required: true },
    savedBy: { type: String, required: true },
    savedByName: { type: String, required: true },
  },
  { versionKey: false, strict: "throw" },
);
reportSchema.index(
  { week: -1, revision: -1 },
  { name: "sample_progress_week_revision" },
);
export const getSampleProgressModel = () =>
  getOrCreateModel("SampleProgressReport", reportSchema);
