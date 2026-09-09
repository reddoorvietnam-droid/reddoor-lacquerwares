import {
  dateNote,
  emptySampleDate,
  isoDate,
  weekEnd,
  type SampleReport,
  toRowInput,
  type SampleRow,
} from "@/domains/sample-progress/contracts";
import type {
  ReportSummary,
  SampleStatus,
} from "@/domains/sample-progress/contracts";
import {
  SampleProgressError,
  SampleProgressService,
  type SampleProgressStore,
} from "@/domains/sample-progress/service";

/** Stable ids keep failure messages readable and snapshots comparable. */
export const fixtureId = (seed: string) =>
  `00000000-0000-4000-8000-${String(seed).padStart(12, "0").slice(-12)}`;

export function buildRow(
  overrides: Partial<SampleRow> & { number: number },
): SampleRow {
  return {
    id: fixtureId(String(overrides.number)),
    orderName: `Mẫu ${overrides.number}`,
    productDetails: "1 khay 40x25 cm",
    status: "woodwork" as SampleStatus,
    workshop: "Công ty",
    receivedDate: emptySampleDate,
    qcDate: emptySampleDate,
    sentDate: emptySampleDate,
    notes: "",
    updatedAt: "2026-08-24T03:00:00.000Z",
    updatedBy: "editor-1",
    updatedByName: "Biên tập nội dung",
    ...overrides,
  };
}

export function buildReport(overrides: Partial<SampleReport> = {}): SampleReport {
  const week = overrides.week ?? "2026-08-24";
  return {
    week,
    weekEnd: weekEnd(week),
    reportDate: overrides.reportDate ?? week,
    revision: 1,
    previousRevision: null,
    inheritedFrom: null,
    changeNote: "Cập nhật tuần này",
    createdAt: "2026-08-24T03:00:00.000Z",
    createdBy: "editor-1",
    createdByName: "Biên tập nội dung",
    savedAt: "2026-08-24T03:00:00.000Z",
    savedBy: "editor-1",
    savedByName: "Biên tập nội dung",
    rows: [
      buildRow({
        number: 1,
        orderName: "Sofitel",
        productDetails: "2 tấm phẳng tranh bát giác 113x74x5 cm\n1 bộ 3 khay đáy rời tranh",
        status: "qc_passed",
        receivedDate: isoDate("2025-12-31"),
        qcDate: isoDate("2026-10-05"),
        // Business wording the workbook keeps in a date column.
        sentDate: dateNote("Chờ gửi"),
        notes: "Đã xong đang chờ gửi",
      }),
      buildRow({
        number: 2,
        orderName: "Tung Hoang",
        productDetails: "4 khay và 30 bộ lót cốc",
        status: "sent",
        receivedDate: isoDate("2026-07-13"),
        // Text a spreadsheet would otherwise turn into a formula.
        notes: "=HYPERLINK(\"http://example.test\")\n+84 lô hàng, -2 khay, @ghi chú",
      }),
    ],
    ...overrides,
  };
}

export type ArchivedWeek = {
  reports: readonly SampleReport[];
  reason: string;
  actor: { userId: string; name: string };
  at: string;
};

export type FakeStore = SampleProgressStore & {
  records: Map<string, SampleReport>;
  archived: ArchivedWeek[];
};

export function createFakeStore(seed: SampleReport[] = []): FakeStore {
  const records = new Map<string, SampleReport>(
    seed.map((report) => [`${report.week}:${report.revision}`, report]),
  );
  const archived: ArchivedWeek[] = [];
  return {
    records,
    archived,
    async listRevisions(week) {
      return [...records.values()]
        .filter((report) => report.week === week)
        .sort((a, b) => a.revision - b.revision)
        .map((report) => structuredClone(report));
    },
    async archiveWeek(input) {
      archived.push({
        ...input,
        reports: input.reports.map((report) => structuredClone(report)),
      });
    },
    async removeWeek(week) {
      let removed = 0;
      for (const [key, report] of [...records.entries()])
        if (report.week === week && records.delete(key)) removed += 1;
      return removed;
    },
    async latest(week, revision) {
      const matches = [...records.values()]
        .filter(
          (report) =>
            report.week === week &&
            (revision === undefined || report.revision === revision),
        )
        .sort((a, b) => b.revision - a.revision);
      return matches[0] ? structuredClone(matches[0]) : null;
    },
    async list(week) {
      const all = [...records.values()].filter(
        (report) => !week || report.week === week,
      );
      // Without a week, keep each week once at its highest revision — the same
      // thing the Mongo aggregation does with $sort then $group/$first.
      const newest = new Map<string, SampleReport>();
      for (const report of all)
        if ((newest.get(report.week)?.revision ?? -1) < report.revision)
          newest.set(report.week, report);
      const chosen = week ? all : [...newest.values()];
      return chosen
        .sort((a, b) => b.week.localeCompare(a.week) || b.revision - a.revision)
        .map(({ rows, ...rest }): ReportSummary => ({
          ...rest,
          count: rows.length,
        }));
    },
    async insert(report) {
      const key = `${report.week}:${report.revision}`;
      // Mirrors the unique _id in MongoDB: the second writer of a revision loses.
      if (records.has(key))
        throw new SampleProgressError(
          "Người khác vừa lưu báo cáo tuần này.",
          409,
          "SAMPLE_PROGRESS_CONFLICT",
        );
      records.set(key, structuredClone(report));
    },
  };
}

export function createService(seed: SampleReport[] = [], now = "2026-09-07T02:00:00.000Z") {
  const store = createFakeStore(seed);
  return {
    store,
    service: new SampleProgressService(store, () => new Date(now)),
  };
}

export const editor = { userId: "editor-1", name: "Biên tập nội dung" };
export const director = { userId: "director-1", name: "Giám đốc" };

export const toInput = toRowInput;
