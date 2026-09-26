import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY_DEFAULT,
  indexNowKey,
  indexNowKeyFilePath,
  resetIndexNowKeyVerification,
  scheduleIndexNowSubmission,
  submitToIndexNow,
} from "@/lib/seo/indexnow";

const key = INDEXNOW_KEY_DEFAULT;
const keyLocation = `https://reddoor.vn/${key}.txt`;

const fetchMock = vi.fn<typeof fetch>();

function useOrigin(origin: string): void {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
  vi.stubEnv("INDEXNOW_KEY", "");
}

function keyFileResponse(body = key, status = 200): Response {
  return new Response(body, { status });
}

function postedBody(call: number): unknown {
  const init = fetchMock.mock.calls[call]?.[1];
  return JSON.parse(String(init?.body));
}

beforeEach(() => {
  resetIndexNowKeyVerification();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("IndexNow key", () => {
  it("defaults to the committed key and lets INDEXNOW_KEY override it", () => {
    vi.stubEnv("INDEXNOW_KEY", "");
    expect(indexNowKey()).toBe(INDEXNOW_KEY_DEFAULT);
    expect(indexNowKeyFilePath()).toBe(`/${INDEXNOW_KEY_DEFAULT}.txt`);

    vi.stubEnv("INDEXNOW_KEY", "  0123456789abcdef  ");
    expect(indexNowKey()).toBe("0123456789abcdef");
    expect(indexNowKeyFilePath()).toBe("/0123456789abcdef.txt");
  });

  it("is served from the site root by the committed public file", () => {
    const keyFile = path.join(
      process.cwd(),
      "public",
      `${INDEXNOW_KEY_DEFAULT}.txt`,
    );

    // Exact equality: the protocol compares the body with the key, and the
    // library trims, so a trailing newline is tolerated but not shipped.
    expect(readFileSync(keyFile, "utf8")).toBe(INDEXNOW_KEY_DEFAULT);
    expect(INDEXNOW_KEY_DEFAULT).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("submitToIndexNow", () => {
  it("does nothing when there is nothing to submit", async () => {
    useOrigin("https://reddoor.vn");

    await expect(submitToIndexNow([])).resolves.toEqual({
      kind: "skipped",
      reason: "no-paths",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing while the origin is a loopback address", async () => {
    useOrigin("http://localhost:3000");

    await expect(submitToIndexNow(["/vi", "/vi/news"])).resolves.toEqual({
      kind: "skipped",
      reason: "loopback-origin",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies its key file, then posts a deduplicated absolute URL list", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock
      .mockResolvedValueOnce(keyFileResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const outcome = await submitToIndexNow([
      "/vi/news/bai-viet",
      "/vi/news/bai-viet",
      "vi/news",
      "/en/news/",
      "/vi/news/sơn-mài",
    ]);

    expect(outcome).toEqual({ kind: "submitted", urls: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [keyUrl, keyInit] = fetchMock.mock.calls[0] ?? [];
    expect(keyUrl).toBe(keyLocation);
    expect(keyInit?.method).toBe("GET");

    const [postUrl, postInit] = fetchMock.mock.calls[1] ?? [];
    expect(postUrl).toBe(INDEXNOW_ENDPOINT);
    expect(postUrl).toBe("https://api.indexnow.org/indexnow");
    expect(postInit?.method).toBe("POST");
    expect(postInit?.headers).toEqual({
      "Content-Type": "application/json; charset=utf-8",
    });
    expect(postedBody(1)).toEqual({
      host: "reddoor.vn",
      key,
      keyLocation,
      urlList: [
        "https://reddoor.vn/vi/news/bai-viet",
        "https://reddoor.vn/vi/news",
        "https://reddoor.vn/en/news",
        "https://reddoor.vn/vi/news/s%C6%A1n-m%C3%A0i",
      ],
    });
  });

  it("checks the key file once per process", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock
      .mockResolvedValueOnce(keyFileResponse())
      .mockResolvedValue(new Response(null, { status: 202 }));

    await submitToIndexNow(["/vi/shop"]);
    await submitToIndexNow(["/en/shop"]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(keyLocation);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(INDEXNOW_ENDPOINT);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(INDEXNOW_ENDPOINT);
  });

  it("skips the submission and warns when the key file does not serve the key", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock.mockResolvedValueOnce(keyFileResponse("another-key"));

    await expect(submitToIndexNow(["/vi/products"])).resolves.toEqual({
      kind: "skipped",
      reason: "key-file-unverified",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain(keyLocation);
  });

  it("skips the submission when the key file is missing", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock.mockResolvedValueOnce(keyFileResponse("Not found", 404));

    await expect(submitToIndexNow(["/vi/products"])).resolves.toEqual({
      kind: "skipped",
      reason: "key-file-unverified",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("treats a rate limit as a warning, not an error", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock
      .mockResolvedValueOnce(keyFileResponse())
      .mockResolvedValueOnce(new Response(null, { status: 429 }));

    await expect(submitToIndexNow(["/vi/collections"])).resolves.toEqual({
      kind: "rejected",
      urls: 1,
      status: 429,
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain("429");
  });

  it("never throws when the network is down", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(submitToIndexNow(["/vi"])).resolves.toEqual({
      kind: "skipped",
      reason: "key-file-unverified",
    });

    resetIndexNowKeyVerification();
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(keyFileResponse())
      .mockRejectedValueOnce(new Error("offline"));

    await expect(submitToIndexNow(["/vi"])).resolves.toEqual({
      kind: "failed",
      urls: 1,
      error: "offline",
    });
  });
});

describe("scheduleIndexNowSubmission", () => {
  it("hands the submission to the scheduler and runs it without throwing", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock
      .mockResolvedValueOnce(keyFileResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const scheduled: Array<() => Promise<void>> = [];

    scheduleIndexNowSubmission(["/vi/shop", "/vi/shop/hop-son-mai"], (task) => {
      scheduled.push(task);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    await expect(scheduled[0]?.()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(postedBody(1)).toMatchObject({
      urlList: [
        "https://reddoor.vn/vi/shop",
        "https://reddoor.vn/vi/shop/hop-son-mai",
      ],
    });
  });

  it("runs the submission directly when there is no request scope to defer to", async () => {
    useOrigin("https://reddoor.vn");
    fetchMock
      .mockResolvedValueOnce(keyFileResponse())
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    expect(() =>
      scheduleIndexNowSubmission(["/en/shop"], () => {
        throw new Error("`after` was called outside a request scope");
      }),
    ).not.toThrow();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
