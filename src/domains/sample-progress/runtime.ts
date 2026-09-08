import "server-only";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getSampleProgressModel } from "./models";
import {
  SampleProgressService,
  SampleProgressError,
  type SampleProgressStore,
} from "./service";
import type { ReportSummary, SampleReport } from "./contracts";

const summaryProjection = {
  _id: 0,
  week: 1,
  weekEnd: 1,
  reportDate: 1,
  revision: 1,
  previousRevision: 1,
  inheritedFrom: 1,
  changeNote: 1,
  createdAt: 1,
  createdBy: 1,
  createdByName: 1,
  savedAt: 1,
  savedBy: 1,
  savedByName: 1,
  count: { $size: "$rows" },
} as const;

const store: SampleProgressStore = {
  async latest(week, revision) {
    await connectToDatabase();
    return getSampleProgressModel()
      .findOne({ week, ...(revision ? { revision } : {}) })
      .sort({ revision: -1 })
      .select("-_id")
      .lean<SampleReport | null>()
      .exec();
  },
  async list(week) {
    await connectToDatabase();
    return getSampleProgressModel()
      .aggregate<ReportSummary>([
        ...(week ? [{ $match: { week } }] : []),
        { $sort: { week: -1, revision: -1 } },
        // Without a week, list each week once at its newest revision.
        ...(!week
          ? [
              { $group: { _id: "$week", report: { $first: "$$ROOT" } } },
              { $replaceRoot: { newRoot: "$report" } },
              { $sort: { week: -1 as const } },
            ]
          : []),
        { $project: summaryProjection },
      ])
      .exec();
  },
  async insert(report) {
    await connectToDatabase();
    try {
      await getSampleProgressModel().create({
        _id: `${report.week}:${report.revision}`,
        ...report,
      });
    } catch (error) {
      // The unique _id is the real concurrency guard: two saves racing on the
      // same week and revision cannot both win, transaction or not.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      )
        throw new SampleProgressError(
          "Người khác vừa lưu báo cáo tuần này. Hãy mở lại bản mới nhất trước khi lưu; nội dung đang nhập vẫn được giữ trên màn hình.",
          409,
          "SAMPLE_PROGRESS_CONFLICT",
        );
      throw error;
    }
  },
};
export const sampleProgressService = new SampleProgressService(store);
