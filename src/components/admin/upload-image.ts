"use client";

/**
 * Browser-side upload path shared by the admin editors: ask our server for a
 * short-lived signature, then hand the file straight to the storage provider
 * with real progress. The file never touches our own server.
 */

export type UploadedAsset = {
  publicId: string;
  assetVersion: number;
  width: number;
  height: number;
  bytes: number;
};

export type UploadTarget =
  | { kind: "collection"; id: string; locale: string }
  | { kind: "article"; id: string }
  | { kind: "product"; id: string };

export class UploadFailure extends Error {
  constructor(readonly stage: "sign" | "store") {
    super(`Upload failed while ${stage === "sign" ? "signing" : "storing"}.`);
  }
}

export async function uploadImage(
  target: UploadTarget,
  file: File,
  onProgress: (percent: number) => void,
): Promise<UploadedAsset> {
  let instruction: { uploadUrl: string; fields: Record<string, string> };
  try {
    const response = await fetch("/api/media/upload-signature", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(target),
    });
    if (!response.ok) throw new Error("sign");
    instruction = await response.json();
  } catch {
    throw new UploadFailure("sign");
  }

  const body = new FormData();
  for (const [key, value] of Object.entries(instruction.fields)) {
    body.append(key, value);
  }
  body.append("file", file);

  const asset = await new Promise<{
    public_id: string;
    version: number;
    width?: number;
    height?: number;
    bytes: number;
  }>((resolve, reject) => {
    // XMLHttpRequest rather than fetch, for upload progress events.
    const request = new XMLHttpRequest();
    request.open("POST", instruction.uploadUrl);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText));
      } else {
        reject(new UploadFailure("store"));
      }
    });
    request.addEventListener("error", () => reject(new UploadFailure("store")));
    request.send(body);
  });

  return {
    publicId: asset.public_id,
    assetVersion: asset.version,
    width: asset.width ?? 1,
    height: asset.height ?? 1,
    bytes: asset.bytes,
  };
}
