import "server-only";
import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongoose";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  getSampleProgressArchiveModel,
  getSampleProgressModel,
} from "./models";
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
  async listRevisions(week) {
    await connectToDatabase();
    return getSampleProgressModel()
      .find({ week })
      .sort({ revision: 1 })
      .select("-_id")
      .lean<SampleReport[]>()
      .exec();
  },
  async archiveWeek({ reports, reason, actor, at }) {
    await connectToDatabase();
    await getSampleProgressArchiveModel().insertMany(
      reports.map((report) => ({
        ...report,
        deletedAt: at,
        deletedBy: actor.userId,
        deletedByName: actor.name,
        deleteReason: reason,
      })),
    );
    // The audit event records that it happened and why; the archive holds the
    // content, because audit values are capped at fifty array entries.
    await mongoAuditRepository.append({
      actor: { type: "user", userId: actor.userId },
      action: "sampleProgress.report.deleted",
      resourceType: "sampleProgressReport",
      resourceId: reports[0]?.week ?? null,
      requestId: randomUUID(),
      reason,
      metadata: {
        revisions: reports.map((report) => report.revision),
        rows: reports[reports.length - 1]?.rows.length ?? 0,
        deletedByName: actor.name,
      },
      occurredAt: new Date(at),
    });
  },
  async removeWeek(week) {
    await connectToDatabase();
    const result = await getSampleProgressModel().deleteMany({ week });
    return result.deletedCount ?? 0;
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
