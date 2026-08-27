"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  attachCatalogueAction,
  createCollectionAction,
  deleteCollectionAction,
  publishCollectionAction,
  type CollectionActionState,
} from "@/app/[locale]/admin/(portal)/collections/actions";
import type { AdminLocale } from "@/lib/i18n/admin";

/**
 * The collections manager surface: a create form and one row per collection
 * with the three verbs that matter — upload the catalogue PDF, publish, view.
 *
 * The PDF goes from the browser straight to the storage provider against a
 * short-lived signature; this client never sends the file to our own server.
 * What comes back (public id, version, page count) is reported to a server
 * action that re-validates everything before persisting.
 */

export type CollectionManagerRow = {
  id: string;
  title: string;
  slug: string;
  year: number | null;
  status: string;
  translationStatus: string | null;
  publishedLocales: readonly string[];
  pageCount: number | null;
  coverUrl: string | null;
};

const copy = {
  vi: {
    eyebrow: "Bộ sưu tập",
    title: "Quản lý bộ sưu tập",
    description:
      "Tạo bộ sưu tập, tải catalogue PDF và xuất bản. PDF được đưa thẳng lên kho lưu trữ có chữ ký; trang public chỉ hiển thị những gì đã xuất bản.",
    createTitle: "Tạo bộ sưu tập mới",
    name: "Tên bộ sưu tập",
    year: "Năm",
    summary: "Mô tả ngắn (không bắt buộc)",
    create: "Tạo bản nháp",
    creating: "Đang tạo…",
    uploadPdf: "Tải PDF",
    replacePdf: "Thay PDF",
    uploading: "Đang tải lên…",
    publish: "Xuất bản",
    publishing: "Đang xuất bản…",
    published: "Đã xuất bản",
    draft: "Bản nháp",
    inReview: "Chờ duyệt",
    archived: "Lưu trữ",
    pages: "trang",
    noCatalogue: "Chưa có catalogue",
    view: "Xem trên website",
    storageMissing:
      "Chưa cấu hình Cloudinary — khai báo các biến CLOUDINARY_* trong .env để bật tải PDF.",
    uploadFailedSign: "Không xin được chữ ký tải lên.",
    uploadFailedStore:
      "Kho lưu trữ từ chối file. Kiểm tra kích thước và định dạng PDF.",
    uploadFailedSave: "Đã tải lên nhưng chưa lưu được bản ghi.",
    maxSize: "Tối đa",
    empty: "Chưa có bộ sưu tập nào. Tạo bộ đầu tiên ở trên.",
    remove: "Xóa",
    removeConfirm: "Xóa hẳn? Bấm lần nữa",
    removing: "Đang xóa…",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      INVALID_INPUT: "Dữ liệu chưa hợp lệ — kiểm tra lại các trường.",
      DUPLICATE_CODE: "Đã có bộ sưu tập trùng tên (slug).",
      NOT_FOUND: "Không tìm thấy bộ sưu tập.",
      UNAVAILABLE: "Không thực hiện được. Thử lại sau.",
    } as Record<string, string>,
  },
  en: {
    eyebrow: "Collections",
    title: "Manage collections",
    description:
      "Create a collection, attach its catalogue PDF, publish. The PDF goes straight to signed storage; the public site shows only what is published.",
    createTitle: "New collection",
    name: "Collection name",
    year: "Year",
    summary: "Short summary (optional)",
    create: "Create draft",
    creating: "Creating…",
    uploadPdf: "Upload PDF",
    replacePdf: "Replace PDF",
    uploading: "Uploading…",
    publish: "Publish",
    publishing: "Publishing…",
    published: "Published",
    draft: "Draft",
    inReview: "In review",
    archived: "Archived",
    pages: "pages",
    noCatalogue: "No catalogue yet",
    view: "View on site",
    storageMissing:
      "Cloudinary is not configured — set the CLOUDINARY_* variables in .env to enable PDF upload.",
    uploadFailedSign: "Could not obtain an upload signature.",
    uploadFailedStore:
      "Storage rejected the file. Check the size and that it is a PDF.",
    uploadFailedSave: "Uploaded, but recording it failed.",
    maxSize: "Max",
    empty: "No collections yet. Create the first one above.",
    remove: "Delete",
    removeConfirm: "Really delete? Click again",
    removing: "Deleting…",
    errors: {
      FORBIDDEN: "You do not have permission for this action.",
      INVALID_INPUT: "The input is not valid — check the fields.",
      DUPLICATE_CODE: "A collection with this name (slug) already exists.",
      NOT_FOUND: "Collection not found.",
      UNAVAILABLE: "The action failed. Try again shortly.",
    } as Record<string, string>,
  },
} as const;

const idleState: CollectionActionState = { status: "idle", message: "" };

function statusLabel(text: (typeof copy)["vi" | "en"], status: string): string {
  if (status === "published") return text.published;
  if (status === "inReview") return text.inReview;
  if (status === "archived") return text.archived;
  return text.draft;
}

export function CollectionsManager({
  locale,
  rows,
  uploadReady,
  maxUploadMb,
}: {
  locale: AdminLocale;
  rows: readonly CollectionManagerRow[];
  uploadReady: boolean;
  maxUploadMb: number;
}) {
  const text = copy[locale];
  const [createState, createFormAction, createPending] = useActionState(
    createCollectionAction,
    idleState,
  );

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>

      {!uploadReady ? (
        <p
          role="alert"
          className="border-gold/50 bg-gold/10 text-gold-ink mt-6 max-w-3xl rounded-xl border px-4 py-3 text-sm"
        >
          {text.storageMissing}
        </p>
      ) : null}

      <section className="border-burgundy/15 mt-10 max-w-3xl rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">
          {text.createTitle}
        </h2>
        <form
          action={createFormAction}
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_8rem]"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-charcoal/70 text-xs font-semibold tracking-[0.08em] uppercase">
              {text.name}
            </span>
            <input
              name="title"
              required
              maxLength={300}
              className="border-burgundy/20 focus:border-burgundy/50 min-h-11 rounded-xl border bg-white px-4 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-charcoal/70 text-xs font-semibold tracking-[0.08em] uppercase">
              {text.year}
            </span>
            <input
              name="year"
              type="number"
              min={1000}
              max={9999}
              className="border-burgundy/20 focus:border-burgundy/50 min-h-11 rounded-xl border bg-white px-4 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-charcoal/70 text-xs font-semibold tracking-[0.08em] uppercase">
              {text.summary}
            </span>
            <textarea
              name="summary"
              rows={2}
              maxLength={1000}
              className="border-burgundy/20 focus:border-burgundy/50 rounded-xl border bg-white px-4 py-3 text-sm outline-none"
            />
          </label>
          {createState.status === "error" ? (
            <p role="alert" className="text-lacquer text-sm sm:col-span-2">
              {text.errors[createState.message] ?? text.errors.UNAVAILABLE}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createPending}
              className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
            >
              {createPending ? text.creating : text.create}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        {rows.length === 0 ? (
          <p className="border-burgundy/15 text-charcoal/60 max-w-3xl rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            {text.empty}
          </p>
        ) : (
          <ul className="grid gap-4">
            {rows.map((row) => (
              <CollectionRow
                key={row.id}
                row={row}
                locale={locale}
                text={text}
                uploadReady={uploadReady}
                maxUploadMb={maxUploadMb}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type UploadPhase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "error"; message: string };

function CollectionRow({
  row,
  locale,
  text,
  uploadReady,
  maxUploadMb,
}: {
  row: CollectionManagerRow;
  locale: AdminLocale;
  text: (typeof copy)["vi" | "en"];
  uploadReady: boolean;
  maxUploadMb: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadPhase>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const [publishState, publishFormAction, publishPending] = useActionState(
    publishCollectionAction,
    idleState,
  );

  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteCollectionAction,
    idleState,
  );
  // Two-step confirmation: the first press only arms the button, and moving
  // on to anything else disarms it again.
  const [armedToDelete, setArmedToDelete] = useState(false);

  // The row status lives in server-rendered props; pull them again the moment
  // an action reports success instead of waiting for a navigation.
  useEffect(() => {
    if (publishState.status === "success" || deleteState.status === "success") {
      router.refresh();
    }
  }, [publishState.status, deleteState.status, router]);

  async function handleFile(file: File) {
    if (file.size > maxUploadMb * 1024 * 1024) {
      setUpload({
        kind: "error",
        message: `${text.uploadFailedStore} (${text.maxSize} ${maxUploadMb}MB)`,
      });
      return;
    }
    setUpload({ kind: "uploading", percent: 0 });

    let instruction: {
      uploadUrl: string;
      fields: Record<string, string>;
    };
    try {
      const response = await fetch("/api/media/upload-signature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "collection", id: row.id, locale: "vi" }),
      });
      if (!response.ok) throw new Error("sign");
      instruction = await response.json();
    } catch {
      setUpload({ kind: "error", message: text.uploadFailedSign });
      return;
    }

    const body = new FormData();
    for (const [key, value] of Object.entries(instruction.fields)) {
      body.append(key, value);
    }
    body.append("file", file);

    let asset: {
      public_id: string;
      version: number;
      pages?: number;
      width?: number;
      height?: number;
      bytes: number;
    };
    try {
      const result = await new Promise<typeof asset>((resolve, reject) => {
        // XMLHttpRequest rather than fetch, for real upload progress.
        const request = new XMLHttpRequest();
        request.open("POST", instruction.uploadUrl);
        request.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUpload({
              kind: "uploading",
              percent: Math.round((event.loaded / event.total) * 100),
            });
          }
        });
        request.addEventListener("load", () => {
          if (request.status >= 200 && request.status < 300) {
            resolve(JSON.parse(request.responseText) as typeof asset);
          } else {
            reject(new Error("store"));
          }
        });
        request.addEventListener("error", () => reject(new Error("store")));
        request.send(body);
      });
      asset = result;
    } catch {
      setUpload({ kind: "error", message: text.uploadFailedStore });
      return;
    }

    const saved = await attachCatalogueAction({
      collectionId: row.id,
      locale: "vi",
      publicId: asset.public_id,
      assetVersion: asset.version,
      pageCount: asset.pages ?? 1,
      pageWidth: asset.width ?? 1,
      pageHeight: asset.height ?? 1,
      bytes: asset.bytes,
    });

    if (saved.status !== "success") {
      setUpload({ kind: "error", message: text.uploadFailedSave });
      return;
    }

    setUpload({ kind: "idle" });
    startTransition(() => router.refresh());
  }

  const isPublished = row.status === "published";

  return (
    <li className="border-burgundy/15 flex flex-col gap-5 rounded-2xl border bg-white p-5 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)] sm:flex-row sm:items-center">
      <div className="bg-ivory border-burgundy/10 relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border">
        {row.coverUrl ? (
          <Image
            src={row.coverUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-burgundy/30 absolute inset-0 grid place-items-center font-serif text-2xl"
          >
            ◈
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-burgundy font-serif text-xl">{row.title}</h3>
          {row.year ? (
            <span className="text-gold-ink text-sm font-semibold">
              {row.year}
            </span>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold tracking-[0.08em] uppercase ${
              isPublished
                ? "bg-gold/15 text-gold-ink"
                : "bg-burgundy/8 text-burgundy/70"
            }`}
          >
            {statusLabel(text, row.status)}
          </span>
        </div>
        <p className="text-charcoal/55 mt-1 text-sm">
          {row.pageCount ? `${row.pageCount} ${text.pages}` : text.noCatalogue}
          {" · "}
          <span className="font-mono text-xs">/{row.slug}</span>
        </p>
        {upload.kind === "error" ? (
          <p role="alert" className="text-lacquer mt-1.5 text-sm">
            {upload.message}
          </p>
        ) : null}
        {publishState.status === "error" ? (
          <p role="alert" className="text-lacquer mt-1.5 text-sm">
            {text.errors[publishState.message] ?? text.errors.UNAVAILABLE}
          </p>
        ) : null}
        {deleteState.status === "error" ? (
          <p role="alert" className="text-lacquer mt-1.5 text-sm">
            {text.errors[deleteState.message] ?? text.errors.UNAVAILABLE}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={!uploadReady || upload.kind === "uploading"}
          onClick={() => fileInputRef.current?.click()}
          title={`${text.maxSize} ${maxUploadMb}MB`}
          className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
        >
          {upload.kind === "uploading"
            ? `${text.uploading} ${upload.percent}%`
            : row.pageCount
              ? text.replacePdf
              : text.uploadPdf}
        </button>

        <form action={publishFormAction}>
          <input type="hidden" name="collectionId" value={row.id} />
          <button
            type="submit"
            disabled={publishPending || isPublished}
            className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
          >
            {publishPending
              ? text.publishing
              : isPublished
                ? text.published
                : text.publish}
          </button>
        </form>

        {isPublished ? (
          <a
            href={`/${locale}/collections/${row.slug}/catalogue`}
            target="_blank"
            rel="noreferrer"
            className="text-gold-ink hover:text-lacquer text-sm font-semibold"
          >
            {text.view}
          </a>
        ) : null}

        <form
          action={deleteFormAction}
          onSubmit={(event) => {
            if (!armedToDelete) {
              event.preventDefault();
              setArmedToDelete(true);
            }
          }}
          onBlur={() => setArmedToDelete(false)}
        >
          <input type="hidden" name="collectionId" value={row.id} />
          <button
            type="submit"
            disabled={deletePending}
            className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 ${
              armedToDelete
                ? "border-lacquer bg-lacquer text-ivory"
                : "border-lacquer/30 text-lacquer hover:border-lacquer/60"
            }`}
          >
            {deletePending
              ? text.removing
              : armedToDelete
                ? text.removeConfirm
                : text.remove}
          </button>
        </form>
      </div>
    </li>
  );
}
