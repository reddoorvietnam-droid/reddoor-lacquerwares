"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  attachDocumentAction,
  type DocumentActionState,
} from "@/app/[locale]/admin/(portal)/finance/document-actions";
import {
  uploadImage,
  type UploadTarget,
} from "@/components/admin/upload-image";

/**
 * One button that uploads a PDF or photo straight to storage and then records
 * it on the order or invoice. Used for payment documents on an order, for the
 * files each SOP step produces (PKL, customs declaration, packing photos…),
 * and for the invoice file itself, so the accountant attaches the INV instead
 * of retyping its lines. A module whose records live elsewhere (site
 * contracts, import shipments) passes its own `attachAction`.
 */

type DocumentTarget = Extract<
  UploadTarget,
  {
    kind:
      | "orderDocument"
      | "orderFile"
      | "invoiceDocument"
      | "facilityContractDocument"
      | "importShipmentDocument";
  }
>;

/** What the button hands the server once the bytes are stored. */
export type AttachDocumentInput = {
  target: DocumentTarget;
  expectedRevision: number;
  publicId: string;
  assetVersion: number;
  format: string;
  bytes: number;
  label: string;
};

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
  compact = false,
  attachAction = attachDocumentAction,
}: {
  locale: "vi" | "en";
  target: DocumentTarget;
  expectedRevision: number;
  maxBytes: number;
  label?: string;
  /** A smaller button for checklist rows. */
  compact?: boolean;
  /**
   * The server action that records the stored file on its record. Defaults
   * to the order and invoice action.
   */
  attachAction?: (input: AttachDocumentInput) => Promise<DocumentActionState>;
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
      const result = await attachAction({
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
        className={
          compact
            ? "border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold disabled:pointer-events-none disabled:opacity-45"
            : "border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
        }
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
