/**
 * Delivery URL of a stored document (invoice file, payment advice) that was
 * uploaded as an image-type asset so a PDF can also be rendered page by page.
 * Reads the public cloud name only, so it is safe on the server and in the
 * browser alike.
 */
export function storedDocumentUrl(document: {
  publicId: string;
  assetVersion: number;
  format: string;
}): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
  const safeId = document.publicId.replace(/[^A-Za-z0-9._\-/]/g, "");
  const safeFormat = document.format.replace(/[^a-z0-9]/g, "");
  return `https://res.cloudinary.com/${cloudName}/image/upload/v${document.assetVersion}/${safeId}.${safeFormat}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
