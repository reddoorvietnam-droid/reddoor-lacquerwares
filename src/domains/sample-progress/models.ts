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
const dateFields = () => ({
  kind: { type: String, enum: ["empty", "date", "text"], required: true },
  value: { type: String, default: "" },
});

const rowFields = () => ({
  id: { type: String, required: true },
  number: { type: Number, required: true },
  orderName: { type: String, required: true },
  productDetails: { type: String, default: "" },
  status: { type: String, enum: sampleStatuses, required: true },
  workshop: { type: String, default: "" },
  receivedDate: {
    type: new Schema(dateFields(), { _id: false, strict: "throw" }),
    required: true,
  },
  qcDate: {
    type: new Schema(dateFields(), { _id: false, strict: "throw" }),
    required: true,
  },
  sentDate: {
    type: new Schema(dateFields(), { _id: false, strict: "throw" }),
    required: true,
  },
  notes: { type: String, default: "" },
  // Who last changed this row, carried forward untouched when it did not.
  updatedAt: { type: String, required: true },
  updatedBy: { type: String, default: "" },
  updatedByName: { type: String, default: "" },
});

const reportFields = () => ({
  week: { type: String, required: true },
  weekEnd: { type: String, required: true },
  reportDate: { type: String, required: true },
  revision: { type: Number, required: true },
  previousRevision: { type: Number, default: null },
  inheritedFrom: { type: String, default: null },
  rows: {
    type: [new Schema(rowFields(), { _id: false, strict: "throw" })],
    required: true,
  },
  changeNote: { type: String, required: true },
  createdAt: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
  savedAt: { type: String, required: true },
  savedBy: { type: String, required: true },
  savedByName: { type: String, required: true },
});

// Append-only snapshots. The built-in unique _id (week:revision) makes a
// concurrent save fail atomically, without needing a transaction or autoIndex.
const reportSchema = new Schema(
  { _id: { type: String, required: true }, ...reportFields() },
  { versionKey: false, strict: "throw" },
);
reportSchema.index(
  { week: -1, revision: -1 },
  { name: "sample_progress_week_revision" },
);

/**
 * Where a deleted week goes. Deleting from the reports collection outright
 * keeps `week:revision` free, so the same week can be imported again — and the
 * full snapshots survive here, which the audit log could not promise: it caps
 * an archived array at fifty entries.
 *
 * Nothing in the site reads this collection; restoring is a deliberate,
 * out-of-band act.
 */
const archiveSchema = new Schema(
  {
    ...reportFields(),
    deletedAt: { type: String, required: true },
    deletedBy: { type: String, required: true },
    deletedByName: { type: String, required: true },
    deleteReason: { type: String, required: true },
  },
  { versionKey: false, strict: "throw" },
);
archiveSchema.index(
  { week: -1, revision: -1 },
  { name: "sample_progress_archive_week_revision" },
);
archiveSchema.index(
  { deletedAt: -1 },
  { name: "sample_progress_archive_deleted_at" },
);

export const getSampleProgressModel = () =>
  getOrCreateModel("SampleProgressReport", reportSchema);

export const getSampleProgressArchiveModel = () =>
  getOrCreateModel("SampleProgressReportArchive", archiveSchema);
