import "server-only";
import {
  addDays,
  dateNote,
  emptySampleDate,
  isMonday,
  isoDate,
  isoDateSchema,
  parseVietnameseDate,
  reportInputSchema,
  sameRowContent,
  sampleDateSchema,
  weekEnd,
  weekStart,
  type ReportSummary,
  type SampleDate,
  type SampleReport,
  type SampleRow,
  type SampleRowInput,
} from "./contracts";

export class SampleProgressError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "SAMPLE_PROGRESS_INVALID",
  ) {
    super(message);
    this.name = "SampleProgressError";
  }
}

export type Actor = { userId: string; name: string };

export interface SampleProgressStore {
  latest(week: string, revision?: number): Promise<SampleReport | null>;
  list(week?: string): Promise<ReportSummary[]>;
  insert(report: SampleReport): Promise<void>;
  /** Every revision of a week, oldest first. */
  listRevisions(week: string): Promise<SampleReport[]>;
  /** Copies the week out of the way so a delete can be undone. */
  archiveWeek(input: {
    reports: readonly SampleReport[];
    reason: string;
    actor: Actor;
    at: string;
  }): Promise<void>;
  removeWeek(week: string): Promise<number>;
}

/**
 * Revisions saved before the date columns became structured hold plain strings.
 * Snapshots are immutable, so they are never rewritten — they are read forward
 * into the current shape instead, which keeps every archived week openable.
 */
export function normalizeStoredDate(value: unknown): SampleDate {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return emptySampleDate;
    const parsed = parseVietnameseDate(trimmed);
    return parsed && "iso" in parsed ? isoDate(parsed.iso) : dateNote(trimmed);
  }
  const parsed = sampleDateSchema.safeParse(value);
  return parsed.success ? parsed.data : emptySampleDate;
}

export function normalizeStoredReport(
  raw: SampleReport & Partial<Record<string, unknown>>,
): SampleReport {
  const savedAt = raw.savedAt ?? new Date(0).toISOString();
  return {
    week: raw.week,
    weekEnd: raw.weekEnd ?? weekEnd(raw.week),
    reportDate: raw.reportDate,
    revision: raw.revision,
    previousRevision:
      raw.previousRevision ?? (raw.revision > 1 ? raw.revision - 1 : null),
    inheritedFrom: raw.inheritedFrom ?? null,
    changeNote: raw.changeNote,
    createdAt: raw.createdAt ?? savedAt,
    createdBy: raw.createdBy ?? raw.savedBy,
    createdByName: raw.createdByName ?? raw.savedByName,
    savedAt,
    savedBy: raw.savedBy,
    savedByName: raw.savedByName,
    rows: (raw.rows ?? []).map((row) => ({
      ...row,
      receivedDate: normalizeStoredDate(row.receivedDate),
      qcDate: normalizeStoredDate(row.qcDate),
      sentDate: normalizeStoredDate(row.sentDate),
      updatedAt: row.updatedAt ?? savedAt,
      updatedBy: row.updatedBy ?? raw.savedBy,
      updatedByName: row.updatedByName ?? raw.savedByName,
    })),
  };
}

export class SampleProgressService {
  constructor(
    private readonly store: SampleProgressStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async read(week: string, revision?: number): Promise<SampleReport> {
    this.assertWeek(week);
    if (
      revision !== undefined &&
      (!Number.isSafeInteger(revision) || revision < 1)
    )
      throw new SampleProgressError("Phiên bản báo cáo không hợp lệ.");
    const report = await this.store.latest(week, revision);
    if (!report)
      throw new SampleProgressError(
        "Không tìm thấy báo cáo cho tuần này.",
        404,
        "SAMPLE_PROGRESS_NOT_FOUND",
      );
    return normalizeStoredReport(report);
  }

  async list(week?: string): Promise<ReportSummary[]> {
    if (week) this.assertWeek(week);
    return this.store.list(week);
  }

  async save(raw: unknown, actor: Actor): Promise<SampleReport> {
    const input = reportInputSchema.parse(raw);
    const previous = await this.store.latest(input.week);
    if ((previous?.revision ?? 0) !== input.expectedRevision)
      throw new SampleProgressError(
        previous
          ? `Người khác vừa lưu phiên bản ${previous.revision} của tuần này. Hãy mở lại bản mới nhất rồi lưu; nội dung bạn đang nhập vẫn giữ nguyên trên màn hình.`
          : "Báo cáo tuần này vừa được tạo ở nơi khác. Hãy mở lại bản mới nhất trước khi lưu.",
        409,
        "SAMPLE_PROGRESS_CONFLICT",
      );
    const report = this.compose({
      week: input.week,
      reportDate: input.reportDate,
      rows: input.rows,
      changeNote: input.changeNote,
      previous: previous ? normalizeStoredReport(previous) : null,
      inheritedFrom: previous ? normalizeStoredReport(previous).inheritedFrom : null,
      actor,
    });
    await this.store.insert(report);
    return report;
  }

  /**
   * Copies the latest revision of `sourceWeek` into the week that follows it
   * and saves it as that week's first revision. Doing the copy on the server
   * means the unique `week:revision` key — not a client-side check — is what
   * prevents a second inherit from overwriting a week already in progress.
   */
  async inherit(sourceWeek: string, actor: Actor): Promise<SampleReport> {
    this.assertWeek(sourceWeek);
    const source = await this.store.latest(sourceWeek);
    if (!source)
      throw new SampleProgressError(
        "Không tìm thấy báo cáo của tuần nguồn để kế thừa.",
        404,
        "SAMPLE_PROGRESS_NOT_FOUND",
      );
    const target = addDays(sourceWeek, 7);
    const existing = await this.store.latest(target);
    if (existing)
      throw new SampleProgressError(
        `Tuần ${target} đã có báo cáo (phiên bản ${existing.revision}). Hãy mở tuần đó để cập nhật thay vì kế thừa lại.`,
        409,
        "SAMPLE_PROGRESS_CONFLICT",
      );
    const normalized = normalizeStoredReport(source);
    const report = this.compose({
      week: target,
      reportDate: target,
      // Row ids stay stable across weeks, so a sample that did not change keeps
      // the stamp of whoever last actually touched it.
      rows: normalized.rows,
      changeNote: `Kế thừa từ tuần ${sourceWeek} (phiên bản ${normalized.revision}).`,
      previous: null,
      inheritedFrom: sourceWeek,
      actor,
      carryRowAudit: normalized.rows,
    });
    await this.store.insert(report);
    return report;
  }

  /**
   * Deletes a whole week — every revision of it. Used when a week was created
   * by mistake, typically the wrong file imported and saved.
   *
   * The week is archived first: if that copy cannot be written, nothing is
   * deleted. Individual revisions stay un-deletable, so the history of a week
   * that is genuinely in use can never be thinned out one entry at a time.
   */
  async remove(
    week: string,
    reason: string,
    actor: Actor,
  ): Promise<{ week: string; revisions: number; rows: number }> {
    this.assertWeek(week);
    const trimmed = reason.trim();
    if (trimmed.length < 5 || trimmed.length > 500)
      throw new SampleProgressError(
        "Hãy ghi lý do xóa báo cáo, ít nhất 5 ký tự.",
      );
    const stored = await this.store.listRevisions(week);
    if (!stored.length)
      throw new SampleProgressError(
        "Không tìm thấy báo cáo của tuần này để xóa.",
        404,
        "SAMPLE_PROGRESS_NOT_FOUND",
      );
    const reports = stored.map(normalizeStoredReport);
    await this.store.archiveWeek({
      reports,
      reason: trimmed,
      actor,
      at: this.now().toISOString(),
    });
    const revisions = await this.store.removeWeek(week);
    return {
      week,
      revisions,
      rows: reports[reports.length - 1]?.rows.length ?? 0,
    };
  }

  private assertWeek(week: string): void {
    isoDateSchema.parse(week);
    if (!isMonday(week))
      throw new SampleProgressError("Tuần báo cáo phải bắt đầu từ thứ Hai.");
  }

  private compose(options: {
    week: string;
    reportDate: string;
    rows: readonly SampleRowInput[];
    changeNote: string;
    previous: SampleReport | null;
    inheritedFrom: string | null;
    actor: Actor;
    carryRowAudit?: readonly SampleRow[];
  }): SampleReport {
    const savedAt = this.now().toISOString();
    const { previous, actor } = options;
    const earlier = new Map(
      (options.carryRowAudit ?? previous?.rows ?? []).map((row) => [
        row.id,
        row,
      ]),
    );
    const rows: SampleRow[] = options.rows.map((row) => {
      const before = earlier.get(row.id);
      // Only a real content change re-stamps the row, so "last updated" answers
      // when the sample moved, not when the report was last saved.
      const unchanged = before && sameRowContent(before, row);
      return {
        ...row,
        updatedAt: unchanged ? before.updatedAt : savedAt,
        updatedBy: unchanged ? before.updatedBy : actor.userId,
        updatedByName: unchanged ? before.updatedByName : actor.name,
      };
    });
    return {
      week: options.week,
      weekEnd: weekEnd(options.week),
      reportDate: options.reportDate,
      revision: (previous?.revision ?? 0) + 1,
      previousRevision: previous?.revision ?? null,
      inheritedFrom: options.inheritedFrom,
      rows,
      changeNote: options.changeNote,
      createdAt: previous?.createdAt ?? savedAt,
      createdBy: previous?.createdBy ?? actor.userId,
      createdByName: previous?.createdByName ?? actor.name,
      savedAt,
      savedBy: actor.userId,
      savedByName: actor.name,
    };
  }
}

export { weekStart };
