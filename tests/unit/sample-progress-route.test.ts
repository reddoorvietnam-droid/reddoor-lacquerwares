import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { SampleProgressError } from "@/domains/sample-progress/service";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  editor: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  inherit: vi.fn(),
  remove: vi.fn(),
  parse: vi.fn(),
  export: vi.fn(),
  fileName: vi.fn(),
  user: vi.fn(),
}));
vi.mock("@/domains/sample-progress/access", () => ({
  requireSampleProgressAccess: mocks.access,
  requireSampleProgressEditor: mocks.editor,
}));
vi.mock("@/domains/sample-progress/runtime", () => ({
  sampleProgressService: {
    list: mocks.list,
    read: mocks.read,
    save: mocks.save,
    inherit: mocks.inherit,
    remove: mocks.remove,
  },
}));
vi.mock("@/domains/sample-progress/import-workbook", () => ({
  importSampleWorkbook: mocks.parse,
  maxWorkbookBytes: 2_000_000,
}));
vi.mock("@/domains/sample-progress/export-workbook", () => ({
  exportSampleWorkbook: mocks.export,
  buildReportFileName: mocks.fileName,
}));
vi.mock("@/domains/identity/models", () => ({ getUserModel: mocks.user }));
import { DELETE, GET, POST } from "@/app/api/sample-progress/route";

const editorAccess = { userId: "editor-1", role: "editor", context: {} };
const viewerAccess = { userId: "director-1", role: "viewer", context: {} };
const sameOrigin = { origin: "http://localhost", host: "localhost" };

function post(query: string, init: RequestInit = {}) {
  return POST(
    new Request(`http://localhost/api/sample-progress${query}`, {
      method: "POST",
      headers: { ...sameOrigin, ...(init.headers ?? {}) },
      body: init.body ?? "{}",
      ...(init.body instanceof Uint8Array ? {} : {}),
    }),
  );
}

function namedUser(displayName: string | null) {
  mocks.user.mockReturnValue({
    findById: () => ({
      select: () => ({
        lean: () => ({ exec: async () => (displayName ? { displayName } : null) }),
      }),
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("reads are guarded before any data is touched", () => {
  it.each([
    "",
    "?week=2026-08-24",
    "?week=2026-08-24&history=1",
    "?week=2026-08-24&revision=1",
    "?week=2026-08-24&export=1",
  ])("denies direct read %s", async (query) => {
    mocks.access.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );
    const response = await GET(
      new Request(`http://localhost/api/sample-progress${query}`),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.export).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["AUTH_NOT_CONFIGURED", 503],
    ["USER_SUSPENDED", 403],
  ] as const)("maps denial %s to %i", async (code, status) => {
    mocks.access.mockRejectedValue(new ContentAccessDeniedError(code));
    const response = await GET(
      new Request("http://localhost/api/sample-progress"),
    );
    expect(response.status).toBe(status);
  });

  it("returns the listing and the caller's role without shared caching", async () => {
    mocks.access.mockResolvedValue(viewerAccess);
    mocks.list.mockResolvedValue([]);
    const response = await GET(
      new Request("http://localhost/api/sample-progress"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: "viewer", reports: [] });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("rejects a malformed week without reaching the service", async () => {
    mocks.access.mockResolvedValue(viewerAccess);
    const response = await GET(
      new Request("http://localhost/api/sample-progress?week=not-a-date"),
    );
    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("passes a not-found week through as 404", async () => {
    mocks.access.mockResolvedValue(viewerAccess);
    mocks.read.mockRejectedValue(
      new SampleProgressError("Không tìm thấy báo cáo cho tuần này.", 404),
    );
    const response = await GET(
      new Request("http://localhost/api/sample-progress?week=2026-08-24"),
    );
    expect(response.status).toBe(404);
  });

  it("exports as an attachment the director may download", async () => {
    mocks.access.mockResolvedValue(viewerAccess);
    mocks.read.mockResolvedValue({ week: "2026-08-24", revision: 2 });
    mocks.export.mockReturnValue(new Uint8Array([1, 2, 3]));
    mocks.fileName.mockReturnValue(
      "Bao-cao-tien-do-mau-Red-Door-2026-W35-v2.xlsx",
    );
    const response = await GET(
      new Request(
        "http://localhost/api/sample-progress?week=2026-08-24&revision=2&export=1",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("content-disposition")).toContain(
      "2026-W35-v2.xlsx",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
});

describe("writes require the editor role and a same-origin request", () => {
  it.each(["", "?action=import", "?action=inherit"])(
    "denies an unauthenticated write %s before reading the body",
    async (query) => {
      mocks.editor.mockRejectedValue(
        new ContentAccessDeniedError("UNAUTHENTICATED"),
      );
      const response = await post(query, { body: "private data" });
      expect(response.status).toBe(401);
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
      expect(mocks.inherit).not.toHaveBeenCalled();
    },
  );

  it.each(["", "?action=import", "?action=inherit"])(
    "denies the read-only director on %s",
    async (query) => {
      // requireSampleProgressEditor is what rejects a viewer.
      mocks.editor.mockRejectedValue(
        new ContentAccessDeniedError("PERMISSION_DENIED"),
      );
      const response = await post(query);
      expect(response.status).toBe(403);
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.parse).not.toHaveBeenCalled();
      expect(mocks.inherit).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["https://evil.example", "localhost"],
    ["", "localhost"],
    ["not a url", "localhost"],
  ])("rejects origin %s against host %s", async (origin, host) => {
    mocks.editor.mockResolvedValue(editorAccess);
    const response = await POST(
      new Request("http://localhost/api/sample-progress", {
        method: "POST",
        headers: origin ? { origin, host } : { host },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("bounds an upload by its declared length before parsing", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    const response = await post("?action=import", {
      headers: { "content-length": "2000001" },
      body: "small",
    });
    expect(response.status).toBe(413);
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("bounds an upload that lies about its length", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    const response = await post("?action=import", {
      body: "x".repeat(2_000_050),
    });
    expect(response.status).toBe(413);
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it("bounds an oversized JSON save", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    const response = await post("", { body: "x".repeat(1_000_050) });
    expect(response.status).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    const response = await post("", { body: "not json" });
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

describe("saving a revision", () => {
  it("saves with the actor the server resolved, not one the client sent", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    mocks.save.mockImplementation(async (_input, actor) => ({
      revision: 3,
      savedByName: actor.name,
    }));
    const response = await post("", {
      body: JSON.stringify({ savedBy: "someone-else", savedByName: "Kẻ giả mạo" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      role: "editor",
      report: { revision: 3, savedByName: "Chị Nương" },
    });
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), {
      userId: "editor-1",
      name: "Chị Nương",
    });
  });

  it("falls back to the user id when the account has no display name", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser(null);
    mocks.save.mockResolvedValue({ revision: 1 });
    await post("", { body: "{}" });
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), {
      userId: "editor-1",
      name: "editor-1",
    });
  });

  it("passes a stale save through as 409", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    mocks.save.mockRejectedValue(
      new SampleProgressError(
        "Người khác vừa lưu phiên bản 2 của tuần này.",
        409,
        "SAMPLE_PROGRESS_CONFLICT",
      ),
    );
    const response = await post("", { body: "{}" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "SAMPLE_PROGRESS_CONFLICT",
    });
  });

  it("turns a validation failure into 400 and names the field", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    mocks.save.mockRejectedValue(
      new ZodError([
        { code: "custom", path: ["changeNote"], message: "Hãy ghi nội dung cập nhật lần này." },
      ]),
    );
    const response = await post("", { body: "{}" });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("changeNote");
  });
});

describe("inheriting and importing", () => {
  it("inherits from the requested week", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    mocks.inherit.mockResolvedValue({ week: "2026-08-31", revision: 1 });
    const response = await post("?action=inherit", {
      body: JSON.stringify({ week: "2026-08-24" }),
    });
    expect(response.status).toBe(201);
    expect(mocks.inherit).toHaveBeenCalledWith("2026-08-24", {
      userId: "editor-1",
      name: "Chị Nương",
    });
  });

  it("rejects an inherit without a valid week", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    const response = await post("?action=inherit", {
      body: JSON.stringify({ week: "tuần trước" }),
    });
    expect(response.status).toBe(400);
    expect(mocks.inherit).not.toHaveBeenCalled();
  });

  it("returns the import preview", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    mocks.parse.mockReturnValue({
      reportDate: "2026-08-24",
      week: "2026-08-24",
      rows: [],
      issues: [],
    });
    const response = await post("?action=import", { body: "PK binary" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ week: "2026-08-24" });
  });

  it("reports an unreadable file as a client error", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    mocks.parse.mockImplementation(() => {
      throw new SampleProgressError("File không phải định dạng .xlsx hoặc .xlsm.");
    });
    const response = await post("?action=import", { body: "nope" });
    expect(response.status).toBe(400);
  });
});

describe("deleting a week", () => {
  const del = (body: unknown, headers: Record<string, string> = sameOrigin) =>
    DELETE(
      new Request("http://localhost/api/sample-progress", {
        method: "DELETE",
        headers,
        body: JSON.stringify(body),
      }),
    );

  it("denies a reader before touching data", async () => {
    mocks.editor.mockRejectedValue(
      new ContentAccessDeniedError("PERMISSION_DENIED"),
    );
    const response = await del({ week: "2026-08-24", reason: "Nhập nhầm" });
    expect(response.status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin delete", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    const response = await del(
      { week: "2026-08-24", reason: "Nhập nhầm file" },
      { origin: "https://evil.example", host: "localhost" },
    );
    expect(response.status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects a malformed week without reaching the service", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    const response = await del({ week: "tuần rồi", reason: "Nhập nhầm file" });
    expect(response.status).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes the week with the server-resolved actor", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    mocks.remove.mockResolvedValue({
      week: "2026-08-24",
      revisions: 2,
      rows: 24,
    });
    const response = await del({
      week: "2026-08-24",
      reason: "Nhập nhầm file tuần khác",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      role: "editor",
      removed: { week: "2026-08-24", revisions: 2, rows: 24 },
    });
    expect(mocks.remove).toHaveBeenCalledWith(
      "2026-08-24",
      "Nhập nhầm file tuần khác",
      { userId: "editor-1", name: "Chị Nương" },
    );
  });

  it("passes a missing week through as 404", async () => {
    mocks.editor.mockResolvedValue(editorAccess);
    namedUser("Chị Nương");
    mocks.remove.mockRejectedValue(
      new SampleProgressError("Không tìm thấy báo cáo.", 404),
    );
    const response = await del({ week: "2026-08-24", reason: "Nhập nhầm file" });
    expect(response.status).toBe(404);
  });
});

describe("unexpected failures never leak internals", () => {
  it("hides the message and stack of an unknown error", async () => {
    mocks.access.mockResolvedValue(viewerAccess);
    mocks.list.mockRejectedValue(
      new Error("MongoServerError: connection string mongodb+srv://user:pw@host"),
    );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(
      new Request("http://localhost/api/sample-progress"),
    );
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("mongodb+srv");
    expect(JSON.stringify(body)).not.toContain("MongoServerError");
    expect(body.error).toBe("SAMPLE_PROGRESS_UNAVAILABLE");
    // Only the error's class name is logged, never the report or the message.
    expect(errors).toHaveBeenCalledWith(
      "sample-progress request failed",
      "Error",
    );
  });
});
