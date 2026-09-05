"use client";

import Image from "next/image";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  deleteShopItemAction,
  saveShopItemAction,
  saveShopItemImagesAction,
  setShopItemStatusAction,
} from "@/app/[locale]/admin/(portal)/shop/actions";
import { uploadImage } from "@/components/admin/upload-image";
import type { ShopItemStatus } from "@/domains/shop/contracts";
import type { AdminLocale } from "@/lib/i18n/admin";
import { slugify } from "@/lib/utils/slug";

/**
 * The shop item editor: one form, no versions. Vietnamese and English copy,
 * a VND and a USD price, the stock count, the photograph gallery, and the
 * three verbs — save, put on sale / take down, delete.
 */

export type ShopEditorText = {
  name: string;
  summary: string;
  description: string;
};

export type ShopEditorImage = {
  publicId: string;
  assetVersion: number;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
};

export type ShopItemEditorInitial = {
  itemId: string | null;
  revision: number | null;
  status: ShopItemStatus;
  slug: string;
  priceVnd: string;
  priceUsd: string;
  stockQuantity: string;
  sortOrder: string;
  images: readonly ShopEditorImage[];
  text: { vi: ShopEditorText; en: ShopEditorText };
  /** Whether the reader may put items on sale (`shop.publish`). */
  canPublish: boolean;
};

const emptyText: ShopEditorText = { name: "", summary: "", description: "" };

const copy = {
  vi: {
    eyebrowNew: "Mặt hàng mới",
    eyebrowEdit: "Biên tập mặt hàng",
    statusDraft: "Nháp",
    statusLive: "Đang bán",
    statusHidden: "Đã ẩn",
    identity: "Bán hàng",
    slug: "Slug (tự sinh từ tên)",
    priceVnd: "Giá VND (trang tiếng Việt)",
    priceUsd: "Giá USD (các ngôn ngữ khác)",
    stock: "Số lượng tồn",
    stockHint:
      "Nhập tay. Trừ khi đơn được xác nhận, cộng lại khi đơn đã xác nhận bị huỷ.",
    sortOrder: "Thứ tự hiển thị (nhỏ lên trước)",
    gallery: "Ảnh",
    galleryHint: "Lưu trước rồi mới tải ảnh. Ảnh đầu tiên là ảnh chính.",
    addImage: "Thêm ảnh",
    uploading: "Đang tải…",
    removeImage: "Gỡ",
    copyTitle: "Nội dung",
    name: "Tên mặt hàng",
    summary: "Mô tả ngắn",
    description: "Mô tả chi tiết — mỗi đoạn cách nhau một dòng trống",
    enOptional:
      "Bản tiếng Anh không bắt buộc: bỏ trống thì khách quốc tế đọc bản tiếng Việt.",
    save: "Lưu",
    saving: "Đang lưu…",
    publish: "Đưa lên bán",
    publishing: "Đang cập nhật…",
    hide: "Ẩn khỏi cửa hàng",
    unhide: "Bán lại",
    remove: "Xóa mặt hàng",
    removeConfirm: "Xóa hẳn? Bấm lần nữa",
    removing: "Đang xóa…",
    saved: "Đã lưu.",
    statusChanged: "Đã cập nhật trạng thái.",
    uploadFailed: "Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      INVALID_INPUT:
        "Dữ liệu chưa hợp lệ — kiểm tra tên, slug, giá và tồn kho.",
      SLUG_UNAVAILABLE: "Slug đã được dùng ở mặt hàng khác.",
      REVISION_CONFLICT: "Mặt hàng vừa được người khác sửa. Tải lại trang.",
      EMPTY_CONTENT: "Cần có tên tiếng Việt trước khi đưa lên bán.",
      NOT_FOUND: "Không tìm thấy mặt hàng.",
      UNAVAILABLE: "Không thực hiện được. Thử lại sau.",
    } as Record<string, string>,
  },
  en: {
    eyebrowNew: "New shop item",
    eyebrowEdit: "Edit shop item",
    statusDraft: "Draft",
    statusLive: "On sale",
    statusHidden: "Hidden",
    identity: "Selling",
    slug: "Slug (generated from the name)",
    priceVnd: "Price in VND (Vietnamese pages)",
    priceUsd: "Price in USD (all other locales)",
    stock: "Stock quantity",
    stockHint:
      "Entered by hand. Deducted when an order is confirmed, restored when a confirmed order is cancelled.",
    sortOrder: "Display order (lowest first)",
    gallery: "Photos",
    galleryHint: "Save first, then upload. The first image is primary.",
    addImage: "Add image",
    uploading: "Uploading…",
    removeImage: "Remove",
    copyTitle: "Copy",
    name: "Item name",
    summary: "Short description",
    description: "Description — blank line between paragraphs",
    enOptional:
      "The English copy is optional: left empty, international visitors read the Vietnamese one.",
    save: "Save",
    saving: "Saving…",
    publish: "Put on sale",
    publishing: "Updating…",
    hide: "Hide from shop",
    unhide: "Put back on sale",
    remove: "Delete item",
    removeConfirm: "Really delete? Click again",
    removing: "Deleting…",
    saved: "Saved.",
    statusChanged: "Status updated.",
    uploadFailed: "Image upload failed — check the format (JPG/PNG/WebP).",
    errors: {
      FORBIDDEN: "You do not have permission for this action.",
      INVALID_INPUT:
        "The input is not valid — check name, slug, prices and stock.",
      SLUG_UNAVAILABLE: "That slug is taken by another item.",
      REVISION_CONFLICT: "Someone else just edited this item. Reload the page.",
      EMPTY_CONTENT:
        "A Vietnamese name is required before the item goes on sale.",
      NOT_FOUND: "Item not found.",
      UNAVAILABLE: "The action failed. Try again shortly.",
    } as Record<string, string>,
  },
} as const;

const inputClass =
  "border-burgundy/20 focus:border-burgundy/50 min-h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none";
const areaClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm leading-6 outline-none";
const labelClass =
  "text-charcoal/70 text-xs font-semibold tracking-[0.08em] uppercase";
const cardClass =
  "border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8";

export function ShopItemEditor({
  locale,
  initial,
}: {
  locale: AdminLocale;
  initial: ShopItemEditorInitial;
}) {
  const text = copy[locale];
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [itemId, setItemId] = useState(initial.itemId);
  const [revision, setRevision] = useState(initial.revision);
  const [status, setStatus] = useState<ShopItemStatus>(initial.status);
  const [slug, setSlug] = useState(initial.slug);
  const [priceVnd, setPriceVnd] = useState(initial.priceVnd);
  const [priceUsd, setPriceUsd] = useState(initial.priceUsd);
  const [stockQuantity, setStockQuantity] = useState(initial.stockQuantity);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);
  const [images, setImages] = useState<readonly ShopEditorImage[]>(
    initial.images,
  );
  const [vi, setVi] = useState(initial.text.vi ?? emptyText);
  const [en, setEn] = useState(initial.text.en ?? emptyText);
  const [tab, setTab] = useState<"vi" | "en">("vi");

  const [busy, setBusy] = useState<
    "save" | "status" | "delete" | "upload" | null
  >(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    message: string;
  } | null>(null);
  const [armedToDelete, setArmedToDelete] = useState(false);

  const active = tab === "vi" ? vi : en;
  const setActive = tab === "vi" ? setVi : setEn;

  function fail(code: string) {
    setNotice({
      kind: "error",
      message: text.errors[code] ?? text.errors.UNAVAILABLE ?? "",
    });
  }

  async function handleSave() {
    setBusy("save");
    setNotice(null);
    const result = await saveShopItemAction({
      itemId,
      expectedRevision: revision,
      data: {
        slug: slugify(slug || vi.name),
        text: { vi, en },
        priceVnd: priceVnd.trim(),
        priceUsd: priceUsd.trim(),
        stockQuantity: Number(stockQuantity || "0"),
        categoryKey: "",
        sortOrder: Number(sortOrder || "0"),
      },
    });
    setBusy(null);
    if (result.status === "success") {
      setNotice({ kind: "ok", message: text.saved });
      if (!itemId && result.itemId) {
        setItemId(result.itemId);
        window.history.replaceState(
          null,
          "",
          `/${locale}/admin/shop/${result.itemId}`,
        );
      }
      // The revision advanced on the server; the refresh below re-reads it
      // through the page props, but a second save before that lands must
      // not race with a stale number.
      setRevision((current) => (current === null ? 1 : current + 1));
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handleStatus(next: ShopItemStatus) {
    if (!itemId) return;
    setBusy("status");
    setNotice(null);
    const result = await setShopItemStatusAction({ itemId, status: next });
    setBusy(null);
    if (result.status === "success") {
      setStatus(next);
      setRevision((current) => (current === null ? 1 : current + 1));
      setNotice({ kind: "ok", message: text.statusChanged });
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handleDelete() {
    if (!itemId) return;
    if (!armedToDelete) {
      setArmedToDelete(true);
      return;
    }
    setBusy("delete");
    const result = await deleteShopItemAction({ itemId });
    setBusy(null);
    if (result.status === "success") {
      router.push(`/${locale}/admin/shop` as Route);
      router.refresh();
    } else {
      setArmedToDelete(false);
      fail(result.message);
    }
  }

  async function persistImages(next: readonly ShopEditorImage[]) {
    if (!itemId) return;
    const result = await saveShopItemImagesAction({
      itemId,
      images: next.map((image) => ({
        publicId: image.publicId,
        assetVersion: image.assetVersion,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        alt: vi.name || null,
      })),
    });
    if (result.status === "success") {
      setImages(next);
      setRevision((current) => (current === null ? 1 : current + 1));
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handleAddImage(file: File) {
    if (!itemId) return;
    setBusy("upload");
    setUploadPercent(0);
    setNotice(null);
    try {
      const asset = await uploadImage(
        { kind: "shopItem", id: itemId },
        file,
        setUploadPercent,
      );
      const previewUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_320,c_limit,f_auto,q_auto/v${asset.assetVersion}/${asset.publicId}`;
      await persistImages([...images, { ...asset, previewUrl }]);
    } catch {
      setNotice({ kind: "error", message: text.uploadFailed });
    } finally {
      setBusy(null);
    }
  }

  const statusLabel =
    status === "live"
      ? text.statusLive
      : status === "hidden"
        ? text.statusHidden
        : text.statusDraft;

  return (
    <div className="max-w-4xl">
      <p className="eyebrow">{itemId ? text.eyebrowEdit : text.eyebrowNew}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-burgundy font-serif text-4xl tracking-[-0.035em] md:text-5xl">
          {vi.name || text.eyebrowNew}
        </h1>
        {itemId ? (
          <span
            className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.08em] uppercase ${
              status === "live"
                ? "bg-gold/15 text-gold-ink"
                : "bg-charcoal/8 text-charcoal/60"
            }`}
          >
            {statusLabel}
          </span>
        ) : null}
      </div>

      {notice ? (
        <p
          role="alert"
          className={`mt-5 text-sm ${notice.kind === "ok" ? "text-gold-ink" : "text-lacquer"}`}
        >
          {notice.message}
        </p>
      ) : null}

      {/* ---- Selling --------------------------------------------------- */}
      <section className={`${cardClass} mt-8`}>
        <h2 className="text-burgundy font-serif text-2xl">{text.identity}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelClass}>{text.slug}</span>
            <input
              value={slug || slugify(vi.name)}
              onChange={(event) => setSlug(slugify(event.target.value))}
              maxLength={120}
              className={`${inputClass} font-mono text-xs`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.priceVnd}</span>
            <input
              value={priceVnd}
              onChange={(event) =>
                setPriceVnd(event.target.value.replace(/[^0-9]/g, ""))
              }
              inputMode="numeric"
              placeholder="1500000"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.priceUsd}</span>
            <input
              value={priceUsd}
              onChange={(event) =>
                setPriceUsd(event.target.value.replace(/[^0-9.]/g, ""))
              }
              inputMode="decimal"
              placeholder="59.00"
              className={inputClass}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>{text.stock}</span>
              <input
                value={stockQuantity}
                onChange={(event) =>
                  setStockQuantity(event.target.value.replace(/[^0-9]/g, ""))
                }
                inputMode="numeric"
                className={inputClass}
              />
            </label>
            <p className="text-charcoal/50 text-xs leading-5">
              {text.stockHint}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.sortOrder}</span>
            <input
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value.replace(/[^0-9-]/g, ""))
              }
              inputMode="numeric"
              className={inputClass}
            />
          </label>
        </div>
      </section>

      {/* ---- Gallery -------------------------------------------------- */}
      <section className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-burgundy font-serif text-2xl">{text.gallery}</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleAddImage(file);
            }}
          />
          <button
            type="button"
            disabled={!itemId || busy !== null}
            onClick={() => fileInputRef.current?.click()}
            className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
          >
            {busy === "upload"
              ? `${text.uploading} ${uploadPercent}%`
              : text.addImage}
          </button>
        </div>
        <p className="text-charcoal/50 mt-1.5 text-xs">{text.galleryHint}</p>

        {images.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-3">
            {images.map((image, index) => (
              <li key={image.publicId} className="relative">
                <div className="bg-ivory border-burgundy/10 relative h-28 w-28 overflow-hidden rounded-lg border">
                  <Image
                    src={image.previewUrl}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                  {index === 0 ? (
                    <span className="bg-gold text-burgundy absolute top-1 left-1 rounded-full px-2 py-0.5 text-[0.55rem] font-bold tracking-[0.08em] uppercase">
                      1
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void persistImages(images.filter((_, i) => i !== index))
                  }
                  className="text-lacquer mt-1 block w-full text-center text-xs font-semibold hover:underline"
                >
                  {text.removeImage}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ---- Copy ------------------------------------------------------ */}
      <section className={cardClass}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-burgundy font-serif text-2xl">
            {text.copyTitle}
          </h2>
          <div className="flex gap-1.5">
            {(["vi", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setTab(code)}
                className={`min-h-9 rounded-full px-4 text-xs font-bold tracking-[0.1em] uppercase transition-colors ${
                  tab === code
                    ? "bg-burgundy text-ivory"
                    : "border-burgundy/20 text-burgundy border"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
        {tab === "en" ? (
          <p className="text-charcoal/55 mt-2 text-xs leading-5">
            {text.enOptional}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.name}</span>
            <input
              value={active.name}
              onChange={(event) =>
                setActive({ ...active, name: event.target.value })
              }
              maxLength={200}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.summary}</span>
            <textarea
              value={active.summary}
              onChange={(event) =>
                setActive({ ...active, summary: event.target.value })
              }
              rows={2}
              maxLength={500}
              className={areaClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.description}</span>
            <textarea
              value={active.description}
              onChange={(event) =>
                setActive({ ...active, description: event.target.value })
              }
              rows={8}
              className={areaClass}
            />
          </label>
        </div>
      </section>

      {/* ---- Verbs ------------------------------------------------------ */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={
            busy !== null ||
            !vi.name.trim() ||
            !priceVnd.trim() ||
            !priceUsd.trim()
          }
          onClick={() => void handleSave()}
          className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
        >
          {busy === "save" ? text.saving : text.save}
        </button>
        {initial.canPublish && status !== "live" ? (
          <button
            type="button"
            disabled={busy !== null || !itemId}
            onClick={() => void handleStatus("live")}
            className="bg-gold text-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold hover:brightness-105 disabled:pointer-events-none disabled:opacity-45"
          >
            {busy === "status"
              ? text.publishing
              : status === "hidden"
                ? text.unhide
                : text.publish}
          </button>
        ) : null}
        {status === "live" ? (
          <button
            type="button"
            disabled={busy !== null || !itemId}
            onClick={() => void handleStatus("hidden")}
            className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
          >
            {busy === "status" ? text.publishing : text.hide}
          </button>
        ) : null}
        {itemId ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleDelete()}
            onBlur={() => setArmedToDelete(false)}
            className={`ml-auto inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45 ${
              armedToDelete
                ? "border-lacquer bg-lacquer text-ivory"
                : "border-lacquer/30 text-lacquer hover:border-lacquer/60"
            }`}
          >
            {busy === "delete"
              ? text.removing
              : armedToDelete
                ? text.removeConfirm
                : text.remove}
          </button>
        ) : null}
      </div>
    </div>
  );
}
