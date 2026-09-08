import { describe, expect, it } from "vitest";
import {
  emptyRow,
  isoDate,
  weekEnd,
  type SampleReport,
} from "@/domains/sample-progress/contracts";
import {
  normalizeStoredDate,
  normalizeStoredReport,
  SampleProgressError,
} from "@/domains/sample-progress/service";
import {
  buildReport,
  buildRow,
  createService,
  editor,
  director,
  toInput,
} from "./helpers/sample-progress-fakes";

const week = "2026-08-24";

const input = (
  rows = [{ ...emptyRow(1), orderName: "Sofitel" }],
  overrides: Record<string, unknown> = {},
) => ({
  week,
  reportDate: week,
  rows,
  changeNote: "Cập nhật tuần này",
  expectedRevision: 0,
  ...overrides,
});

describe("saving creates immutable weekly snapshots", () => {
  it("stamps the saver, the time and the week end from the server", async () => {
    const { service } = createService([], "2026-09-07T02:30:00.000Z");
    const report = await service.save(input(), editor);
    expect(report.revision).toBe(1);
    expect(report.week).toBe(week);
    expect(report.weekEnd).toBe(weekEnd(week));
    expect(report.savedBy).toBe(editor.userId);
    expect(report.savedByName).toBe(editor.name);
    expect(report.savedAt).toBe("2026-09-07T02:30:00.000Z");
    expect(report.createdBy).toBe(editor.userId);
    expect(report.previousRevision).toBeNull();
  });

  it("never lets a client dictate who saved a revision", async () => {
    const { service } = createService();
    const report = await service.save(
      input(undefined, {
        savedBy: "someone-else",
        savedByName: "Kẻ giả mạo",
        revision: 99,
      }),
      editor,
    );
    expect(report.savedBy).toBe(editor.userId);
    expect(report.savedByName).toBe(editor.name);
    expect(report.revision).toBe(1);
  });

  it("keeps every earlier revision readable and unchanged", async () => {
    const { service, store } = createService();
    const first = await service.save(input(), editor);
    await service.save(
      input([], { expectedRevision: 1, changeNote: "Bỏ hết mẫu" }),
      director,
    );
    const archived = await service.read(week, 1);
    expect(archived.rows).toHaveLength(1);
    expect(archived).toEqual(first);
    expect((await service.read(week)).rows).toHaveLength(0);
    expect((await service.read(week)).revision).toBe(2);
    expect(store.records.size).toBe(2);
  });

  it("carries the week's original creator across revisions", async () => {
    const { service } = createService();
    await service.save(input(), editor);
    const second = await service.save(
      input(undefined, { expectedRevision: 1 }),
      director,
    );
    expect(second.createdBy).toBe(editor.userId);
    expect(second.savedBy).toBe(director.userId);
    expect(second.previousRevision).toBe(1);
  });

  it("lists each week once at its newest revision", async () => {
    const { service } = createService();
    await service.save(input(), editor);
    await service.save(input(undefined, { expectedRevision: 1 }), editor);
    await service.save(
      input(undefined, { week: "2026-08-31", reportDate: "2026-08-31" }),
      editor,
    );
    const listed = await service.list();
    expect(listed.map((entry) => [entry.week, entry.revision])).toEqual([
      ["2026-08-31", 1],
      ["2026-08-24", 2],
    ]);
    expect(await service.list(week)).toHaveLength(2);
  });
});

describe("optimistic concurrency", () => {
  it("refuses a save built on a stale revision", async () => {
    const { service } = createService();
    await service.save(input(), editor);
    await service.save(input(undefined, { expectedRevision: 1 }), editor);
    // The editor is still holding revision 1 while 2 is already stored.
    await expect(
      service.save(input(undefined, { expectedRevision: 1 }), editor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a second first-save of the same week", async () => {
    const { service } = createService();
    await service.save(input(), editor);
    await expect(service.save(input(), editor)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("lets exactly one of two simultaneous saves win", async () => {
    const { service, store } = createService();
    const results = await Promise.allSettled([
      service.save(input(), editor),
      service.save(input(), director),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(
      SampleProgressError,
    );
    expect(store.records.size).toBe(1);
  });

  it("says a conflict happened, not that the data was invalid", async () => {
    const { service } = createService();
    await service.save(input(), editor);
    await expect(service.save(input(), editor)).rejects.toMatchObject({
      code: "SAMPLE_PROGRESS_CONFLICT",
      status: 409,
    });
  });
});

describe("row audit stamps follow real edits", () => {
  it("re-stamps an edited row and leaves untouched rows alone", async () => {
    const { service } = createService([], "2026-09-01T01:00:00.000Z");
    const first = await service.save(
      input([
        { ...emptyRow(1), orderName: "Sofitel" },
        { ...emptyRow(2), orderName: "Togas" },
      ]),
      editor,
    );

    const { service: later } = createService(
      [first],
      "2026-09-07T09:00:00.000Z",
    );
    const second = await later.save(
      input(
        [
          toInput(first.rows[0]!),
          { ...toInput(first.rows[1]!), status: "sent" as const },
        ],
        { expectedRevision: 1 },
      ),
      director,
    );

    expect(second.rows[0]!.updatedAt).toBe(first.rows[0]!.updatedAt);
    expect(second.rows[0]!.updatedByName).toBe(editor.name);
    expect(second.rows[1]!.updatedAt).toBe("2026-09-07T09:00:00.000Z");
    expect(second.rows[1]!.updatedByName).toBe(director.name);
  });

  it("stamps a newly added row with the current save", async () => {
    const { service } = createService();
    const first = await service.save(input(), editor);
    const { service: later } = createService(
      [first],
      "2026-09-09T04:00:00.000Z",
    );
    const second = await later.save(
      input([toInput(first.rows[0]!), { ...emptyRow(2), orderName: "Mới" }], {
        expectedRevision: 1,
      }),
      editor,
    );
    expect(second.rows[1]!.updatedAt).toBe("2026-09-09T04:00:00.000Z");
  });
});

describe("inheriting into the following week", () => {
  it("copies every row into the next Monday at revision 1", async () => {
    const source = buildReport();
    const { service } = createService([source], "2026-09-07T02:00:00.000Z");
    const next = await service.inherit(source.week, editor);

    expect(next.week).toBe("2026-08-31");
    expect(next.weekEnd).toBe("2026-09-06");
    expect(next.revision).toBe(1);
    expect(next.previousRevision).toBeNull();
    expect(next.inheritedFrom).toBe(source.week);
    expect(next.rows).toHaveLength(source.rows.length);
    expect(next.rows.map((row) => row.orderName)).toEqual(
      source.rows.map((row) => row.orderName),
    );
    expect(next.changeNote).toContain(source.week);
  });

  it("does not copy the source week's revision history", async () => {
    const source = buildReport();
    const { service, store } = createService([source]);
    await service.save(
      input(source.rows.map(toInput), {
        week: source.week,
        reportDate: source.reportDate,
        expectedRevision: 1,
      }),
      editor,
    );
    await service.inherit(source.week, editor);
    expect(await service.list("2026-08-31")).toHaveLength(1);
    expect(await service.list(source.week)).toHaveLength(2);
    expect(store.records.has("2026-08-31:1")).toBe(true);
    expect(store.records.has("2026-08-31:2")).toBe(false);
  });

  it("keeps the last-updated stamp of rows that did not change", async () => {
    const source = buildReport();
    const { service } = createService([source], "2026-09-07T02:00:00.000Z");
    const next = await service.inherit(source.week, editor);
    expect(next.rows[0]!.updatedAt).toBe(source.rows[0]!.updatedAt);
    expect(next.rows[0]!.updatedByName).toBe(source.rows[0]!.updatedByName);
  });

  it("refuses to inherit over a week that already has a report", async () => {
    const source = buildReport();
    const { service } = createService([source]);
    await service.inherit(source.week, editor);
    await expect(service.inherit(source.week, editor)).rejects.toMatchObject({
      status: 409,
      code: "SAMPLE_PROGRESS_CONFLICT",
    });
  });

  it("refuses to inherit from a week that has no report", async () => {
    const { service } = createService();
    await expect(service.inherit("2026-08-24", editor)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects a source week that is not a Monday", async () => {
    const { service } = createService();
    await expect(service.inherit("2026-08-25", editor)).rejects.toThrow(
      "thứ Hai",
    );
  });
});

describe("reading", () => {
  it("reports a missing week as not found, not as a server error", async () => {
    const { service } = createService();
    await expect(service.read(week)).rejects.toMatchObject({ status: 404 });
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects revision %s", async (revision) => {
    const { service } = createService([buildReport()]);
    await expect(service.read(week, revision)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects a week that is not a Monday", async () => {
    const { service } = createService();
    await expect(service.read("2026-08-25")).rejects.toThrow("thứ Hai");
  });
});

describe("revisions saved before dates were structured stay readable", () => {
  it("reads a legacy string date forward into the current shape", () => {
    expect(normalizeStoredDate("18/07/2026")).toEqual({
      kind: "date",
      value: "2026-07-18",
    });
    expect(normalizeStoredDate("Chờ gửi")).toEqual({
      kind: "text",
      value: "Chờ gửi",
    });
    // Ambiguous wording is kept as wording rather than resolved.
    expect(normalizeStoredDate("06/05/2026")).toEqual({
      kind: "text",
      value: "06/05/2026",
    });
    expect(normalizeStoredDate("")).toEqual({ kind: "empty", value: "" });
    expect(normalizeStoredDate(undefined)).toEqual({ kind: "empty", value: "" });
  });

  it("fills in the fields a legacy snapshot never stored", () => {
    const legacy = {
      week,
      reportDate: week,
      revision: 2,
      changeNote: "Nhập từ Excel",
      savedAt: "2026-08-24T04:00:00.000Z",
      savedBy: "old-user",
      savedByName: "Biên tập nội dung (dev preview)",
      rows: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          number: 1,
          orderName: "Sofitel",
          productDetails: "1 khay",
          status: "sent",
          workshop: "Công ty",
          receivedDate: "18/07/2026",
          qcDate: "",
          sentDate: "Chờ gửi",
          notes: "Đã xong",
        },
      ],
    } as unknown as SampleReport;

    const report = normalizeStoredReport(legacy);
    expect(report.weekEnd).toBe(weekEnd(week));
    expect(report.createdAt).toBe(legacy.savedAt);
    expect(report.createdBy).toBe("old-user");
    expect(report.previousRevision).toBe(1);
    expect(report.inheritedFrom).toBeNull();
    expect(report.rows[0]!.receivedDate).toEqual(isoDate("2026-07-18"));
    expect(report.rows[0]!.sentDate).toEqual({ kind: "text", value: "Chờ gửi" });
    expect(report.rows[0]!.updatedAt).toBe(legacy.savedAt);
    expect(report.rows[0]!.updatedByName).toBe(legacy.savedByName);
    // The stored snapshot itself is never rewritten.
    expect((legacy.rows[0] as unknown as { receivedDate: string }).receivedDate).toBe(
      "18/07/2026",
    );
  });

  it("leaves an already structured snapshot untouched", () => {
    const report = buildReport({ rows: [buildRow({ number: 1 })] });
    expect(normalizeStoredReport(report)).toEqual(report);
  });
});
