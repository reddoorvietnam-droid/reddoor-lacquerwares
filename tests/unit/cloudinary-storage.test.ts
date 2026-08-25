import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  buildCloudinarySignature,
  CloudinaryMediaStorage,
} from "@/lib/media/cloudinary-storage";
import { allowedPageWidths, MediaStorageError } from "@/lib/media/storage-port";

const API_SECRET = "test-secret-value";

function storage() {
  return new CloudinaryMediaStorage({
    cloudName: "reddoor-test",
    apiKey: "111222333",
    apiSecret: API_SECRET,
    rootFolder: "reddoor",
  });
}

const uploadRequest = {
  folder: "reddoor/collections/2026/vi",
  resourceType: "raw" as const,
  maxBytes: 10 * 1024 * 1024,
  allowedFormats: ["pdf"],
  requestedByUserId: "user-1",
  issuedAt: new Date("2026-08-25T10:00:00.000Z"),
};

describe("cloudinary signature", () => {
  it("signs the sorted parameters with the secret appended", () => {
    const signature = buildCloudinarySignature(
      { timestamp: 1_700_000_000, folder: "reddoor/a" },
      API_SECRET,
    );

    const expected = createHash("sha1")
      .update(`folder=reddoor/a&timestamp=1700000000${API_SECRET}`)
      .digest("hex");

    expect(signature).toBe(expected);
  });

  it("produces a different signature when any parameter changes", () => {
    const base = buildCloudinarySignature({ a: "1", b: "2" }, API_SECRET);

    expect(buildCloudinarySignature({ a: "1", b: "3" }, API_SECRET)).not.toBe(
      base,
    );
    expect(buildCloudinarySignature({ a: "1", b: "2" }, "other")).not.toBe(
      base,
    );
  });

  it("is order independent, because parameters are sorted before signing", () => {
    expect(buildCloudinarySignature({ b: "2", a: "1" }, API_SECRET)).toBe(
      buildCloudinarySignature({ a: "1", b: "2" }, API_SECRET),
    );
  });
});

describe("signed upload instruction", () => {
  it("never returns the api secret in any field", async () => {
    const instruction = await storage().createSignedUpload(uploadRequest);
    const serialised = JSON.stringify(instruction);

    expect(serialised).not.toContain(API_SECRET);
    expect(Object.values(instruction.fields)).not.toContain(API_SECRET);
  });

  it("points the browser at the provider, not at our own server", async () => {
    const instruction = await storage().createSignedUpload(uploadRequest);

    expect(instruction.uploadUrl).toBe(
      "https://api.cloudinary.com/v1_1/reddoor-test/raw/upload",
    );
  });

  it("binds the folder, size ceiling and accepted format into the signature", async () => {
    const instruction = await storage().createSignedUpload(uploadRequest);

    expect(instruction.fields.folder).toBe("reddoor/collections/2026/vi");
    expect(instruction.fields.max_bytes).toBe(String(10 * 1024 * 1024));
    expect(instruction.fields.allowed_formats).toBe("pdf");
    expect(instruction.fields.overwrite).toBe("false");

    // Recomputing the signature over exactly the signed fields must match, so a
    // client that tampers with any of them is rejected by the provider.
    const { signature, ...rest } = instruction.fields;
    const signed = Object.fromEntries(
      Object.entries(rest).filter(([key]) => key !== "api_key"),
    );
    expect(buildCloudinarySignature(signed, API_SECRET)).toBe(signature);
  });

  it("refuses a folder outside the configured root", async () => {
    await expect(
      storage().createSignedUpload({
        ...uploadRequest,
        folder: "somewhere-else/collections",
      }),
    ).rejects.toThrow(MediaStorageError);
  });
});

describe("page delivery urls", () => {
  it("requests one page of the stored pdf at a permitted width", () => {
    const url = storage().buildPageImageUrl({
      publicId: "reddoor/collections/abc/vi/catalogue",
      pageNumber: 4,
      width: 960,
      version: 1_700_000_000,
    });

    expect(url).toContain("pg_4");
    expect(url).toContain("w_960");
    expect(url).toContain("f_auto,q_auto");
    expect(url).toContain("v1700000000");
  });

  it.each(allowedPageWidths)("accepts the permitted width %i", (width) => {
    expect(() =>
      storage().buildPageImageUrl({
        publicId: "reddoor/a",
        pageNumber: 1,
        width,
        version: 1,
      }),
    ).not.toThrow();
  });

  it("rejects a width outside the permitted set", () => {
    expect(() =>
      storage().buildPageImageUrl({
        publicId: "reddoor/a",
        pageNumber: 1,
        // An arbitrary width would let a visitor mint unlimited derived images.
        width: 1_337 as (typeof allowedPageWidths)[number],
        version: 1,
      }),
    ).toThrow(MediaStorageError);
  });

  it.each([0, -1, 1.5, 5_000])(
    "rejects the out-of-range page number %s",
    (pageNumber) => {
      expect(() =>
        storage().buildPageImageUrl({
          publicId: "reddoor/a",
          pageNumber,
          width: 640,
          version: 1,
        }),
      ).toThrow(MediaStorageError);
    },
  );

  it.each(["../../etc/passwd", "reddoor/../secret", "a b", "a?f_auto"])(
    "rejects the unsafe public id %s",
    (publicId) => {
      expect(() => storage().buildDocumentUrl(publicId, 1)).toThrow(
        MediaStorageError,
      );
    },
  );

  it("rejects a missing or invalid version", () => {
    expect(() => storage().buildDocumentUrl("reddoor/a", 0)).toThrow(
      MediaStorageError,
    );
  });

  it("builds a bounded thumbnail url", () => {
    const url = storage().buildThumbnailUrl({
      publicId: "reddoor/a",
      pageNumber: 2,
      version: 9,
    });

    expect(url).toContain("pg_2");
    expect(url).toContain("w_160");
  });
});
