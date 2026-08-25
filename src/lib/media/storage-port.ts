/**
 * Binary media storage boundary.
 *
 * MongoDB is the system of record for what a catalogue *is* — its publicId,
 * checksum, page count, version, workflow state and who approved it. This port
 * covers only where the bytes live, so that choice stays replaceable.
 *
 * The chosen driver is Cloudinary. See `docs/DECISIONS.md` ADR-007 and ADR-012
 * for why the bytes are deliberately not kept in MongoDB.
 *
 * Nothing here is allowed to leak a credential: an implementation returns
 * either a signed instruction for the browser, or a public delivery URL.
 */

export type MediaResourceType = "image" | "raw" | "video";

/** What the browser needs to upload straight to the storage provider. */
export type SignedUploadInstruction = {
  /** Endpoint the browser posts the file to. Never our own server. */
  readonly uploadUrl: string;
  /**
   * Form fields to send alongside the file. Contains a signature, never the
   * API secret itself.
   */
  readonly fields: Readonly<Record<string, string>>;
  /** Seconds until the signature stops being accepted. */
  readonly expiresInSeconds: number;
  /** Folder the asset is pinned to; the signature binds the upload to it. */
  readonly folder: string;
};

export type SignedUploadRequest = {
  readonly folder: string;
  readonly resourceType: MediaResourceType;
  readonly maxBytes: number;
  /** Restricts what the signature will accept, enforced by the provider. */
  readonly allowedFormats: readonly string[];
  /** Ties the upload to the actor who asked for it, for the audit trail. */
  readonly requestedByUserId: string;
  readonly issuedAt: Date;
};

/** Bounded set of widths, so a viewer cannot mint unlimited derived images. */
export const allowedPageWidths = [320, 640, 960, 1280, 1600] as const;
export type AllowedPageWidth = (typeof allowedPageWidths)[number];

export type PageImageRequest = {
  readonly publicId: string;
  /** 1-based, matching how the provider numbers PDF pages. */
  readonly pageNumber: number;
  readonly width: AllowedPageWidth;
  /** Provider version, so a replaced asset never serves a stale cached page. */
  readonly version: number;
};

export interface MediaStoragePort {
  /**
   * Issues upload parameters for the browser. The file never passes through
   * our own server: a serverless function is the wrong place to move tens of
   * megabytes, and doing so would burn the request budget for no benefit.
   */
  createSignedUpload(
    request: SignedUploadRequest,
  ): Promise<SignedUploadInstruction>;

  /** Delivery URL for one rendered page of a stored PDF. */
  buildPageImageUrl(request: PageImageRequest): string;

  /** Delivery URL for a small thumbnail of one page. */
  buildThumbnailUrl(request: Omit<PageImageRequest, "width">): string;

  /** Delivery URL for the original PDF, when downloads are permitted. */
  buildDocumentUrl(publicId: string, version: number): string;

  /**
   * Removes an asset. Callers must confirm no record still references it; the
   * port does not know about references and will not check on their behalf.
   */
  destroyAsset(
    publicId: string,
    resourceType: MediaResourceType,
  ): Promise<void>;
}

export const mediaStorageErrorCodes = [
  "NOT_CONFIGURED",
  "SIGNING_FAILED",
  "INVALID_REQUEST",
  "DELETE_FAILED",
] as const;

export type MediaStorageErrorCode = (typeof mediaStorageErrorCodes)[number];

export class MediaStorageError extends Error {
  readonly code: MediaStorageErrorCode;

  constructor(code: MediaStorageErrorCode, message: string) {
    super(message);
    this.name = "MediaStorageError";
    this.code = code;
  }
}
