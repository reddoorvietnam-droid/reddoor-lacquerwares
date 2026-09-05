"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { attachDocumentAction } from "@/app/[locale]/admin/(portal)/finance/document-actions";
import { uploadImage, type UploadTarget } from "@/components/admin/upload-image";

/**
 * One button that uploads a PDF or photo straight to storage and then records
 * it on the order or invoice. Used for payment documents on an order and for
 * the invoice file itself, so the accountant attaches the INV instead of
 * retyping its lines.
 */

type DocumentTarget = Extract<
  UploadTarget,
  { kind: "orderDocument" | "invoiceDocument" }
>;

const copy = {
  vi: {
    add: "Tải chứng từ lên",
    uploading: "Đang tải",
    saving: "Đang lưu…",
    failed: "Tải lên không thành công. Thử lại.",
    tooLarge: "Tệp vượt quá dung lượng cho phép.",
  },
  en: {
    add: "Upload document",
    uploading: "Uploading",
    saving: "Saving…",
    failed: "The upload failed. Try again.",
    tooLarge: "The file is larger than allowed.",
  },
} as const;

export function DocumentUpload({
  locale,
  target,
  expectedRevision,
  maxBytes,
  label,
}: {
  locale: "vi" | "en";
  target: DocumentTarget;
  expectedRevision: number;
  maxBytes: number;
  label?: string;
}) {
  const router = useRouter();
  const text = copy[locale];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > maxBytes) {
      setError(text.tooLarge);
      return;
    }
    setBusy("upload");
    setPercent(0);
    try {
      const asset = await uploadImage(target, file, setPercent);
      setBusy("save");
      const result = await attachDocumentAction({
        target,
        expectedRevision,
        publicId: asset.publicId,
        assetVersion: asset.assetVersion,
        format: asset.format,
        bytes: asset.bytes,
        label: file.name.slice(0, 200),
      });
      if (result.status !== "success") {
        setError(`${text.failed} (${result.message})`);
        return;
      }
      router.refresh();
    } catch {
      setError(text.failed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => fileInputRef.current?.click()}
        className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
      >
        {busy === "upload"
          ? `${text.uploading} ${percent}%`
          : busy === "save"
            ? text.saving
            : (label ?? text.add)}
      </button>
      {error ? <span className="text-lacquer text-xs">{error}</span> : null}
    </div>
  );
}
