import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  connect: vi.fn(),
  rowFind: vi.fn(),
  masterFind: vi.fn(),
  bulkWrite: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/domains/paint-warehouse/access", () => ({
  requirePaintAccess: mocks.access,
  paintCapabilities: vi.fn(),
}));
vi.mock("@/domains/paint-warehouse/models", () => ({
  getPaintRowModel: () => ({ find: mocks.rowFind, bulkWrite: mocks.bulkWrite }),
  getPaintMasterModel: () => ({ find: mocks.masterFind }),
}));
vi.mock("@/lib/db/mongoose", () => ({ connectToDatabase: mocks.connect }));
vi.mock("@/domains/audit/mongo-repository", () => ({
  appendAuditEventWithSession: mocks.audit,
}));

import {
  buildPaintImportPreview,
  importPaintRows,
  paintImportKey,
  parsePaintWorkbook,
  type ImportPreviewRow,
} from "@/domains/paint-warehouse/import-workbook";
import * as importRoute from "@/app/api/paint-warehouse/import/route";

/** Serial for a calendar date, independent of the machine time zone. */
const serial = (iso: string) =>
  (Date.parse(`${iso}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86_400_000;
const dateCell = (iso: string): XLSX.CellObject => ({
  t: "n",
  v: serial(iso),
  z: "dd/mm/yyyy",
});
type Row = (string | number | null)[];
const line = (
  facility: string,
  material: string,
  quantity: number,
  price: number,
  amount: number,
  note: string,
): Row => [
  null,
  facility,
  "Chị Thanh",
  material,
  "Sơn PU",
  "xuất kho",
  "Kg",
  quantity,
  price,
  amount,
  quantity,
  price,
  amount,
  note,
];

/**
 * The same sheets, title/blank/header rows and first data row as the real
 * workbook: ChiTietxuatkho from row 4, Cososx from row 5/C, Kho son from row 3/B.
 */
function buildWorkbook(): Uint8Array {
  const ledger = XLSX.utils.aoa_to_sheet([
    ["SỔ CHI TIẾT XUẤT KHO SƠN\nNĂM 2026"],
    [],
    [
      "Ngày tháng",
      "Mã cơ sở SX",
      "Tên cơ sở SX",
      "Mã vật tư",
      "Vật tư",
      "Diễn giải",
      "ĐVT",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "SL thực nhận",
      "Đơn giá chiết khấu",
      "Thành tiền thực nhận",
      "Ghi chú",
    ],
  ]);
  const rows: [number, Row][] = [
    [4, line("Thanh", "son1", 2.5, 120000, 300000, "ghi chú")],
    [5, line("Thanh", "son2", 1, 200000, 200000, " trùng ")],
    // row 6 stays empty: the parser must skip it without counting it
    [7, line("Thanh", "son1", 2, 100, 999, "sai thành tiền")],
    [8, line("Thanh", "son1", 1, 120000, 120000, "ngày sai")],
    [9, line("Thanh", "son1", 3, 120000, 360000, "")],
  ];
  for (const [r, values] of rows)
    XLSX.utils.sheet_add_aoa(ledger, [values], { origin: `A${r}` });
  ledger.A4 = dateCell("2026-01-03");
  ledger.A5 = dateCell("2026-01-05");
  ledger.A7 = dateCell("2026-01-06");
  ledger.A8 = { t: "s", v: "31/02/2026" }; // never a real calendar day
  ledger.A9 = dateCell("2026-01-07");

  const facilities = XLSX.utils.aoa_to_sheet([["CƠ SỞ SẢN XUẤT"]]);
  XLSX.utils.sheet_add_aoa(facilities, [[null, null, "Thanh", "Chị Thanh"]], {
    origin: "A5",
  });
  const materials = XLSX.utils.aoa_to_sheet([["KHO SƠN"]]);
  XLSX.utils.sheet_add_aoa(
    materials,
    [[null, "son1", "Sơn PU", "Kg", 120000]],
    { origin: "A3" },
  );

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, ledger, "ChiTietxuatkho");
  XLSX.utils.book_append_sheet(book, facilities, "Cososx");
  XLSX.utils.book_append_sheet(book, materials, "Kho son");
  return new Uint8Array(
    XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer,
  );
}

const bytes = buildWorkbook();
const parsed = () => parsePaintWorkbook(bytes);
const hash = parsed().hash;

type Chain = {
  select: () => Chain;
  session: () => Chain;
  lean: () => Chain;
  exec: () => Promise<unknown[]>;
};
const chain = (documents: unknown[]): Chain => {
  const query: Chain = {
    select: () => query,
    session: () => query,
    lean: () => query,
    exec: async () => documents,
  };
  return query;
};
/** Row 4 came from this exact file; row 5 matches a line already in the ledger. */
const ledgerState = (options: { imported?: number[]; duplicate?: boolean }) => {
  mocks.rowFind.mockImplementation((filter: Record<string, unknown>) =>
    "importKey" in filter
      ? chain(
          (options.imported ?? []).map((row) => ({
            importKey: paintImportKey(hash, row),
          })),
        )
      : chain(
          options.duplicate
            ? [
                {
                  exportDate: new Date("2026-01-05T00:00:00Z"),
                  materialCode: "SON2",
                  facilityCode: "thanh",
                  quantity: "1",
                  note: "trùng",
                },
              ]
            : [],
        ),
  );
  mocks.masterFind.mockImplementation(() =>
    chain([
      { kind: "material", key: "son1" },
      { kind: "facility", key: "thanh" },
    ]),
  );
};
const session = {};
const withTransaction = () =>
  mocks.connect.mockResolvedValue({
    connection: {
      transaction: (run: (s: unknown) => Promise<unknown>) => run(session),
    },
  });
const byRow = (rows: ImportPreviewRow[], sourceRow: number) =>
  rows.find((row) => row.sourceRow === sourceRow);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockResolvedValue({});
  mocks.audit.mockResolvedValue({ id: "audit-1", occurredAt: new Date() });
});

describe("parsing the paint workbook", () => {
  it("keeps every populated row and skips only the blank one", () => {
    const report = parsed().report;
    expect(report.sourceRows).toBe(5);
    expect(report.imported).toBe(3);
    expect(report.skippedEmptyRows).toBe(1);
    expect(report.invalidRows).toBe(2);
    expect(report.sourceAmount).toBe("860000");
    expect(report.sourceActualAmount).toBe("860000");
  });

  it("reports an invalid row instead of dropping it silently", () => {
    const issues = parsed().report.issues;
    expect(issues.map((issue) => issue.row)).toEqual([7, 8]);
    expect(issues[0]?.message).toMatch(/Tổng tiền khác phép nhân/);
  });

  it("lands dates on the calendar day the workbook shows", () => {
    expect(parsed().rows.map((row) => row.exportDate)).toEqual([
      "2026-01-03",
      "2026-01-05",
      "2026-01-07",
    ]);
  });

  it("reads the master sheets from their own start rows", () => {
    expect(parsed().masters).toEqual([
      {
        kind: "facility",
        code: "Thanh",
        name: "Chị Thanh",
        unit: "",
        unitPrice: null,
      },
      {
        kind: "material",
        code: "son1",
        name: "Sơn PU",
        unit: "Kg",
        unitPrice: "120000",
      },
    ]);
  });
});

describe("import preview", () => {
  it("separates already-imported, duplicate, invalid and valid rows", async () => {
    ledgerState({ imported: [4], duplicate: true });
    const preview = await buildPaintImportPreview(parsed(), "so-son.xlsx");
    expect(preview.hash).toBe(hash);
    expect(preview.fileName).toBe("so-son.xlsx");
    expect(preview.counts).toEqual({
      valid: 1,
      invalid: 2,
      "already-imported": 1,
      duplicate: 1,
    });
    expect(preview.rows.map((row) => row.sourceRow)).toEqual([4, 5, 7, 8, 9]);
    expect(byRow(preview.rows, 4)?.status).toBe("already-imported");
    expect(byRow(preview.rows, 5)?.status).toBe("duplicate");
    expect(byRow(preview.rows, 9)).toMatchObject({
      status: "valid",
      exportDate: "2026-01-07",
      materialCode: "son1",
      quantity: "3",
      amount: "360000",
      unknownMaterial: false,
      unknownFacility: false,
    });
    expect(byRow(preview.rows, 7)?.message).toMatch(/Tổng tiền khác phép nhân/);
    expect(byRow(preview.rows, 8)?.exportDate).toBeNull();
    expect(preview.sourceAmount).toBe("860000");
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
  });

  it("flags a code missing from the catalogue but still offers the row", async () => {
    ledgerState({});
    const preview = await buildPaintImportPreview(parsed(), "so-son.xlsx");
    expect(byRow(preview.rows, 5)).toMatchObject({
      status: "valid",
      unknownMaterial: true,
      unknownFacility: false,
    });
    expect(preview.counts.valid).toBe(3);
  });

  it("asks the ledger once per question and never for whole days it does not touch", async () => {
    ledgerState({});
    await buildPaintImportPreview(parsed(), "so-son.xlsx");
    expect(mocks.rowFind).toHaveBeenCalledTimes(2);
    expect(mocks.rowFind.mock.calls[1]?.[0]).toEqual({
      deleted: false,
      exportDate: {
        $in: [
          new Date("2026-01-03T00:00:00Z"),
          new Date("2026-01-05T00:00:00Z"),
          new Date("2026-01-07T00:00:00Z"),
        ],
      },
    });
  });
});

describe("importing rows", () => {
  it("writes the CLI import key with $setOnInsert and the acting user", async () => {
    withTransaction();
    ledgerState({ imported: [4], duplicate: true });
    mocks.bulkWrite.mockResolvedValue({ upsertedCount: 1 });
    const result = await importPaintRows(parsed(), "user-1", {
      includeDuplicates: false,
      fileName: "so-son.xlsx",
    });
    expect(result).toEqual({ hash, imported: 1, skipped: 4 });
    const operations = mocks.bulkWrite.mock.calls[0]?.[0] as {
      updateOne: {
        filter: { importKey: string };
        update: { $setOnInsert: Record<string, unknown> };
        upsert: boolean;
      };
    }[];
    expect(operations).toHaveLength(1);
    expect(operations[0]?.updateOne.filter).toEqual({
      importKey: `${hash}:9`,
    });
    expect(operations[0]?.updateOne.upsert).toBe(true);
    expect(operations[0]?.updateOne.update.$setOnInsert).toMatchObject({
      importKey: `${hash}:9`,
      deleted: false,
      createdBy: "user-1",
      updatedBy: "user-1",
      sourceRow: 9,
      exportDate: new Date("2026-01-07T00:00:00Z"),
    });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    expect(mocks.audit.mock.calls[0]?.[0]).toMatchObject({
      action: "paintWarehouse.import",
      resourceType: "paintWarehouse",
      resourceId: hash,
      actor: { type: "user", userId: "user-1" },
      metadata: {
        fileName: "so-son.xlsx",
        imported: 1,
        skipped: 4,
        sourceAmount: "860000",
      },
    });
  });

  it("re-running the same file inserts nothing", async () => {
    withTransaction();
    ledgerState({ imported: [4, 5, 9] });
    await expect(
      importPaintRows(parsed(), "user-1", { includeDuplicates: false }),
    ).rejects.toThrow("Không có dòng hợp lệ để nhập.");
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("adds the duplicates only when the storekeeper asks", async () => {
    withTransaction();
    ledgerState({ imported: [4], duplicate: true });
    mocks.bulkWrite.mockResolvedValue({ upsertedCount: 2 });
    const result = await importPaintRows(parsed(), "user-1", {
      includeDuplicates: true,
    });
    expect(result.imported).toBe(2);
    const operations = mocks.bulkWrite.mock.calls[0]?.[0] as {
      updateOne: { filter: { importKey: string } };
    }[];
    expect(operations.map((o) => o.updateOne.filter.importKey)).toEqual([
      `${hash}:5`,
      `${hash}:9`,
    ]);
  });
});

const sameOrigin = { origin: "http://localhost", host: "localhost" };
const upload = (
  fields: Record<string, string>,
  file: { bytes: Uint8Array; name: string } | null,
  headers: Record<string, string> = sameOrigin,
) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (file)
    form.append(
      "file",
      new File([file.bytes as BlobPart], file.name, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  return new Request("http://localhost/api/paint-warehouse/import", {
    method: "POST",
    headers,
    body: form,
  });
};

/**
 * An upload we stream ourselves. A `FormData` body is served by undici's own
 * producer, and cancelling it mid-flight makes undici enqueue the trailing
 * chunk into the closed stream: an unhandled rejection that fails the run.
 */
const streamedUpload = (totalBytes: number) => {
  const boundary = "lacquerware-oversized-upload";
  const head = new TextEncoder().encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\npreview\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="to.xlsx"\r\n\r\n`,
  );
  const filler = new Uint8Array(64 * 1024);
  let generated = 0;
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => controller.enqueue(head),
    pull(controller) {
      if (generated >= totalBytes) return controller.close();
      const size = Math.min(filler.length, totalBytes - generated);
      generated += size;
      controller.enqueue(filler.subarray(0, size));
    },
  });
  const request = new Request("http://localhost/api/paint-warehouse/import", {
    method: "POST",
    headers: {
      ...sameOrigin,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return { request, generated: () => generated };
};

describe("POST /api/paint-warehouse/import", () => {
  it("checks the import permission before reading the upload", async () => {
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );
    const response = await importRoute.POST(
      upload({ mode: "preview" }, { bytes, name: "so-son.xlsx" }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.access).toHaveBeenCalledWith("import");
    expect(mocks.rowFind).not.toHaveBeenCalled();
  });

  it("previews without writing and applies with the server-resolved actor", async () => {
    mocks.access.mockResolvedValue({ userId: "user-1", actorType: "user" });
    ledgerState({ imported: [4], duplicate: true });
    const preview = await importRoute.POST(
      upload({ mode: "preview" }, { bytes, name: "sổ sơn.xlsx" }),
    );
    expect(preview.status).toBe(200);
    expect(await preview.json()).toMatchObject({
      hash,
      fileName: "sổ sơn.xlsx",
      counts: { valid: 1, invalid: 2, "already-imported": 1, duplicate: 1 },
    });
    expect(mocks.bulkWrite).not.toHaveBeenCalled();

    withTransaction();
    mocks.bulkWrite.mockResolvedValue({ upsertedCount: 1 });
    const applied = await importRoute.POST(
      upload({ mode: "apply" }, { bytes, name: "sổ sơn.xlsx" }),
    );
    expect(applied.status).toBe(200);
    expect(await applied.json()).toEqual({ hash, imported: 1, skipped: 4 });
  });

  it("refuses a foreign origin, a missing file and a file that is not a ZIP", async () => {
    mocks.access.mockResolvedValue({ userId: "user-1", actorType: "user" });
    const foreign = await importRoute.POST(
      upload(
        { mode: "preview" },
        { bytes, name: "so-son.xlsx" },
        {
          origin: "https://evil.example",
          host: "localhost",
        },
      ),
    );
    expect(foreign.status).toBe(403);
    const missing = await importRoute.POST(upload({ mode: "preview" }, null));
    expect(missing.status).toBe(400);
    const notZip = await importRoute.POST(
      upload(
        { mode: "preview" },
        { bytes: new TextEncoder().encode("ngày;mã;số lượng"), name: "a.csv" },
      ),
    );
    expect(notZip.status).toBe(400);
    expect(await notZip.json()).toMatchObject({
      message: "Chỉ nhận tệp Excel .xlsx hoặc .xlsm.",
    });
    const badMode = await importRoute.POST(
      upload({ mode: "delete" }, { bytes, name: "so-son.xlsx" }),
    );
    expect(badMode.status).toBe(400);
    expect(mocks.rowFind).not.toHaveBeenCalled();
  });

  it("stops an oversized upload while it streams", async () => {
    mocks.access.mockResolvedValue({ userId: "user-1", actorType: "user" });
    const total = 50 * 1024 * 1024;
    const oversized = streamedUpload(total);
    const response = await importRoute.POST(oversized.request);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      message: "Tệp vượt quá 5 MB.",
    });
    // Hung up on the sender instead of buffering the whole upload.
    expect(oversized.generated()).toBeLessThan(total);
  });
});
