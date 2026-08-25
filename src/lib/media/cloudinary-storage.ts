import "server-only";

import { createHash } from "node:crypto";

import { getCloudinaryEnv } from "@/lib/env/server";
import {
  allowedPageWidths,
  MediaStorageError,
  type MediaResourceType,
  type MediaStoragePort,
  type PageImageRequest,
  type SignedUploadInstruction,
  type SignedUploadRequest,
} from "@/lib/media/storage-port";

/**
 * Cloudinary driver.
 *
 * Two rules govern this file:
 *
 * 1. `CLOUDINARY_API_SECRET` never leaves the server. It is used to compute a
 *    signature and is never placed in a response, a log, or an error message.
 * 2. The browser uploads directly to Cloudinary. A serverless function must not
 *    relay a multi-megabyte PDF.
 *
 * Delivery URLs are built from a fixed set of widths. An unbounded width
 * parameter would let a visitor mint arbitrary derived images, each of which
 * counts against the transformation quota.
 */

const UPLOAD_SIGNATURE_TTL_SECONDS = 600;

/**
 * Cloudinary's signature is the SHA-1 of the signed parameters, sorted by key
 * and joined as a query string, with the API secret appended.
 */
export function buildCloudinarySignature(
  parameters: Readonly<Record<string, string | number>>,
  apiSecret: string,
): string {
  const payload = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

function assertSafePublicId(publicId: string): void {
  // A public id reaches the URL builder from persisted data, but a traversal or
  // injected transformation segment would still be a delivery-layer bug.
  if (!/^[A-Za-z0-9._\-/]{1,255}$/.test(publicId) || publicId.includes("..")) {
    throw new MediaStorageError(
      "INVALID_REQUEST",
      "The asset identifier is not in an acceptable form.",
    );
  }
}

function assertPageNumber(pageNumber: number): void {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 2_000) {
    throw new MediaStorageError(
      "INVALID_REQUEST",
      "The page number is outside the supported range.",
    );
  }
}

function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < 1) {
    throw new MediaStorageError(
      "INVALID_REQUEST",
      "The asset version is not valid.",
    );
  }
}

export class CloudinaryMediaStorage implements MediaStoragePort {
  #cloudName: string;
  #apiKey: string;
  #apiSecret: string;
  #rootFolder: string;

  constructor(config: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    rootFolder: string;
  }) {
    this.#cloudName = config.cloudName;
    this.#apiKey = config.apiKey;
    this.#apiSecret = config.apiSecret;
    this.#rootFolder = config.rootFolder;
  }

  static fromEnvironment(): CloudinaryMediaStorage {
    try {
      const env = getCloudinaryEnv();
      return new CloudinaryMediaStorage({
        cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        apiSecret: env.CLOUDINARY_API_SECRET,
        rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
      });
    } catch {
      // The underlying message names the missing variables; it is not repeated
      // here so a configuration detail cannot reach a client response.
      throw new MediaStorageError(
        "NOT_CONFIGURED",
        "Media storage is not configured.",
      );
    }
  }

  async createSignedUpload(
    request: SignedUploadRequest,
  ): Promise<SignedUploadInstruction> {
    if (!request.folder.startsWith(`${this.#rootFolder}/`)) {
      throw new MediaStorageError(
        "INVALID_REQUEST",
        "Uploads must target a folder inside the configured root.",
      );
    }

    const timestamp = Math.floor(request.issuedAt.getTime() / 1000);

    // Every one of these is covered by the signature, so the browser cannot
    // raise the size limit, change the folder, or widen the accepted formats.
    const signedParameters: Record<string, string | number> = {
      folder: request.folder,
      timestamp,
      allowed_formats: request.allowedFormats.join(","),
      // Cloudinary rejects the upload itself once this is exceeded, so an
      // oversized file never consumes storage.
      max_bytes: request.maxBytes,
      // A deterministic id would let one upload overwrite another.
      unique_filename: "true",
      overwrite: "false",
      // Tagged with the requesting user so an orphan can be traced later.
      context: `requestedBy=${request.requestedByUserId}`,
    };

    let signature: string;
    try {
      signature = buildCloudinarySignature(signedParameters, this.#apiSecret);
    } catch {
      throw new MediaStorageError(
        "SIGNING_FAILED",
        "The upload could not be authorised.",
      );
    }

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.#cloudName}/${request.resourceType}/upload`,
      fields: {
        ...Object.fromEntries(
          Object.entries(signedParameters).map(([key, value]) => [
            key,
            String(value),
          ]),
        ),
        api_key: this.#apiKey,
        signature,
      },
      expiresInSeconds: UPLOAD_SIGNATURE_TTL_SECONDS,
      folder: request.folder,
    };
  }

  #deliveryUrl(
    publicId: string,
    version: number,
    transformation: string,
  ): string {
    assertSafePublicId(publicId);
    assertVersion(version);

    return [
      `https://res.cloudinary.com/${this.#cloudName}/image/upload`,
      transformation,
      `v${version}`,
      publicId,
    ].join("/");
  }

  buildPageImageUrl(request: PageImageRequest): string {
    assertPageNumber(request.pageNumber);

    if (!allowedPageWidths.includes(request.width)) {
      throw new MediaStorageError(
        "INVALID_REQUEST",
        "That page width is not one of the permitted sizes.",
      );
    }

    // `pg_N` renders one page of the stored PDF; `f_auto,q_auto` lets the CDN
    // pick the format and quality per browser.
    return this.#deliveryUrl(
      `${request.publicId}.jpg`,
      request.version,
      `pg_${request.pageNumber},w_${request.width},c_limit,f_auto,q_auto`,
    );
  }

  buildThumbnailUrl(request: Omit<PageImageRequest, "width">): string {
    assertPageNumber(request.pageNumber);

    return this.#deliveryUrl(
      `${request.publicId}.jpg`,
      request.version,
      `pg_${request.pageNumber},w_160,c_limit,f_auto,q_auto`,
    );
  }

  buildDocumentUrl(publicId: string, version: number): string {
    assertSafePublicId(publicId);
    assertVersion(version);
    return `https://res.cloudinary.com/${this.#cloudName}/raw/upload/v${version}/${publicId}`;
  }

  async destroyAsset(
    publicId: string,
    resourceType: MediaResourceType,
  ): Promise<void> {
    assertSafePublicId(publicId);

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = buildCloudinarySignature(
      { public_id: publicId, timestamp },
      this.#apiSecret,
    );

    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: this.#apiKey,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.#cloudName}/${resourceType}/destroy`,
      { method: "POST", body },
    );

    if (!response.ok) {
      // The provider's response body may echo request parameters, so it is not
      // included in the error that propagates.
      throw new MediaStorageError(
        "DELETE_FAILED",
        "The asset could not be removed from storage.",
      );
    }
  }
}
