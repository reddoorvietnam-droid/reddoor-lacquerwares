"use client";

import Image from "next/image";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  deleteProductAction,
  publishProductAction,
  saveProductAction,
  saveProductImagesAction,
} from "@/app/[locale]/admin/(portal)/products/actions";
import { uploadImage } from "@/components/admin/upload-image";
import type { AdminLocale } from "@/lib/i18n/admin";
import { slugify } from "@/lib/utils/slug";

/**
 * The product editor: catalogue identity (SKU, collections), the physical
 * specification, a Vietnamese and an English translation, the photograph
 * gallery, and the workflow verbs. Mirrors the newsroom editor's
 * architecture; see that file's note.
 */

export type ProductEditorTranslation = {
  title: string;
  slug: string;
  shortDescription: string;
  descriptionText: string;
  careText: string;
  seoTitle: string;
  seoDescription: string;
  noIndex: boolean;
};

export type GalleryImage = {
  publicId: string;
  assetVersion: number;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
};

export type ProductEditorInitial = {
  productId: string | null;
  status: string;
  hasDraft: boolean;
  sku: string;
  collectionIds: readonly string[];
  materials: string;
  colors: string;
  finishes: string;
  leadTimeDays: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
    unit: "mm" | "cm";
  };
  images: readonly GalleryImage[];
  translations: Partial<Record<"vi" | "en", ProductEditorTranslation>>;
};

const emptyTranslation: ProductEditorTranslation = {
  title: "",
  slug: "",
  shortDescription: "",
  descriptionText: "",
  careText: "",
  seoTitle: "",
  seoDescription: "",
  noIndex: false,
};

const copy = {
  vi: {
    eyebrowNew: "Sản phẩm mới",
    eyebrowEdit: "Biên tập sản phẩm",
    identity: "Định danh",
    sku: "Mã SKU",
    collections: "Thuộc bộ sưu tập",
    noCollections: "Chưa có bộ sưu tập nào được tạo.",
    spec: "Thông số",
    materials: "Chất liệu (phân cách bằng dấu phẩy)",
    colors: "Màu (phân cách bằng dấu phẩy)",
    finishes: "Hoàn thiện (phân cách bằng dấu phẩy)",
    leadTime: "Thời gian sản xuất (ngày)",
    dimensions: "Kích thước (D × R × C)",
    gallery: "Thư viện ảnh",
    galleryHint:
      "Lưu bản nháp trước rồi mới tải ảnh. Ảnh đầu tiên là ảnh chính.",
    addImage: "Thêm ảnh",
    uploading: "Đang tải…",
    removeImage: "Gỡ",
    translations: "Bản dịch",
    title: "Tên sản phẩm",
    slug: "Slug (tự sinh từ tên)",
    shortDescription: "Mô tả ngắn",
    description: "Mô tả chi tiết — mỗi đoạn cách nhau một dòng trống",
    care: "Hướng dẫn bảo quản — mỗi dòng một mục",
    seoTitle: "Tiêu đề SEO",
    seoDescription: "Mô tả SEO",
    noIndexLabel: "Không cho công cụ tìm kiếm index bản dịch này",
    enOptional:
      "Bản tiếng Anh không bắt buộc: bỏ trống thì khách quốc tế đọc bản tiếng Việt.",
    save: "Lưu bản nháp",
    saving: "Đang lưu…",
    publish: "Xuất bản",
    publishing: "Đang xuất bản…",
    published: "Đã xuất bản",
    hasDraftNote: "Có bản nháp chưa xuất bản.",
    remove: "Xóa sản phẩm",
    removeConfirm: "Xóa hẳn? Bấm lần nữa",
    removing: "Đang xóa…",
    saved: "Đã lưu.",
    publishedOk: "Đã xuất bản.",
    uploadFailed: "Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      INVALID_INPUT: "Dữ liệu chưa hợp lệ — kiểm tra các trường bắt buộc.",
      DUPLICATE_SKU: "Đã có sản phẩm trùng SKU.",
      DUPLICATE_INTERNAL_ID: "Đã có sản phẩm trùng SKU.",
      SLUG_UNAVAILABLE: "Slug đã được dùng ở sản phẩm khác.",
      ROUTE_UNAVAILABLE: "Đường dẫn đã được dùng ở sản phẩm khác.",
      NO_DRAFT: "Không có bản nháp để xuất bản.",
      NOT_FOUND: "Không tìm thấy sản phẩm.",
      EMPTY_CONTENT: "Bản dịch cần tên sản phẩm trước khi xuất bản.",
      UNAVAILABLE: "Không thực hiện được. Thử lại sau.",
    } as Record<string, string>,
  },
  en: {
    eyebrowNew: "New product",
    eyebrowEdit: "Edit product",
    identity: "Identity",
    sku: "SKU",
    collections: "Collections",
    noCollections: "No collections exist yet.",
    spec: "Specification",
    materials: "Materials (comma separated)",
    colors: "Colours (comma separated)",
    finishes: "Finishes (comma separated)",
    leadTime: "Lead time (days)",
    dimensions: "Dimensions (L × W × H)",
    gallery: "Photo gallery",
    galleryHint:
      "Save the draft first, then upload. The first image is primary.",
    addImage: "Add image",
    uploading: "Uploading…",
    removeImage: "Remove",
    translations: "Translations",
    title: "Product name",
    slug: "Slug (generated from the name)",
    shortDescription: "Short description",
    description: "Description — blank line between paragraphs",
    care: "Care instructions — one item per line",
    seoTitle: "SEO title",
    seoDescription: "SEO description",
    noIndexLabel: "Ask search engines not to index this translation",
    enOptional:
      "The English translation is optional: left empty, international readers see the Vietnamese one.",
    save: "Save draft",
    saving: "Saving…",
    publish: "Publish",
    publishing: "Publishing…",
    published: "Published",
    hasDraftNote: "There is an unpublished draft.",
    remove: "Delete product",
    removeConfirm: "Really delete? Click again",
    removing: "Deleting…",
    saved: "Saved.",
    publishedOk: "Published.",
    uploadFailed: "Image upload failed — check the format (JPG/PNG/WebP).",
    errors: {
      FORBIDDEN: "You do not have permission for this action.",
      INVALID_INPUT: "The input is not valid — check the required fields.",
      DUPLICATE_SKU: "A product with this SKU exists.",
      DUPLICATE_INTERNAL_ID: "A product with this SKU exists.",
      SLUG_UNAVAILABLE: "That slug is taken by another product.",
      ROUTE_UNAVAILABLE: "That path is taken by another product.",
      NO_DRAFT: "There is no draft to publish.",
      NOT_FOUND: "Product not found.",
      EMPTY_CONTENT: "Every translation needs a product name to publish.",
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

export function ProductEditor({
  locale,
  collectionOptions,
  initial,
}: {
  locale: AdminLocale;
  collectionOptions: readonly { id: string; title: string }[];
  initial: ProductEditorInitial;
}) {
  const text = copy[locale];
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productId, setProductId] = useState(initial.productId);
  const [sku, setSku] = useState(initial.sku);
  const [collectionIds, setCollectionIds] = useState<readonly string[]>(
    initial.collectionIds,
  );
  const [materials, setMaterials] = useState(initial.materials);
  const [colors, setColors] = useState(initial.colors);
  const [finishes, setFinishes] = useState(initial.finishes);
  const [leadTimeDays, setLeadTimeDays] = useState(initial.leadTimeDays);
  const [dimensions, setDimensions] = useState(initial.dimensions);
  const [images, setImages] = useState<readonly GalleryImage[]>(initial.images);
  const [vi, setVi] = useState(initial.translations.vi ?? emptyTranslation);
  const [en, setEn] = useState(initial.translations.en ?? emptyTranslation);
  const [tab, setTab] = useState<"vi" | "en">("vi");

  const [busy, setBusy] = useState<
    "save" | "publish" | "delete" | "upload" | null
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

  function translationsPayload() {
    const toPayload = (code: "vi" | "en", entry: ProductEditorTranslation) => ({
      locale: code,
      title: entry.title,
      slug: slugify(entry.slug || entry.title),
      shortDescription: entry.shortDescription,
      descriptionText: entry.descriptionText,
      careText: entry.careText,
      ...(entry.seoTitle ? { seoTitle: entry.seoTitle } : {}),
      ...(entry.seoDescription ? { seoDescription: entry.seoDescription } : {}),
      noIndex: entry.noIndex,
    });

    const payload = [toPayload("vi", vi)];
    if (en.title.trim()) payload.push(toPayload("en", en));
    return payload;
  }

  async function handleSave() {
    setBusy("save");
    setNotice(null);
    const result = await saveProductAction({
      productId,
      sku,
      collectionIds,
      materials,
      colors,
      finishes,
      leadTimeDays: leadTimeDays.trim() ? Number(leadTimeDays) : null,
      dimensions,
      translations: translationsPayload(),
    });
    setBusy(null);
    if (result.status === "success") {
      setNotice({ kind: "ok", message: text.saved });
      if (!productId && result.productId) {
        setProductId(result.productId);
        window.history.replaceState(
          null,
          "",
          `/${locale}/admin/products/${result.productId}`,
        );
      }
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handlePublish() {
    if (!productId) return;
    setBusy("publish");
    setNotice(null);
    const result = await publishProductAction({ productId });
    setBusy(null);
    if (result.status === "success") {
      setNotice({ kind: "ok", message: text.publishedOk });
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handleDelete() {
    if (!productId) return;
    if (!armedToDelete) {
      setArmedToDelete(true);
      return;
    }
    setBusy("delete");
    const result = await deleteProductAction({ productId });
    setBusy(null);
    if (result.status === "success") {
      router.push(`/${locale}/admin/products` as Route);
      router.refresh();
    } else {
      setArmedToDelete(false);
      fail(result.message);
    }
  }

  async function persistImages(next: readonly GalleryImage[]) {
    if (!productId) return;
    const result = await saveProductImagesAction({
      productId,
      images: next.map((image) => ({
        publicId: image.publicId,
        assetVersion: image.assetVersion,
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        ...(vi.title ? { alt: vi.title } : {}),
      })),
    });
    if (result.status === "success") {
      setImages(next);
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handleAddImage(file: File) {
    if (!productId) return;
    setBusy("upload");
    setUploadPercent(0);
    setNotice(null);
    try {
      const asset = await uploadImage(
        { kind: "product", id: productId },
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

  const isPublished = initial.status === "published";

  return (
    <div className="max-w-4xl">
      <p className="eyebrow">
        {productId ? text.eyebrowEdit : text.eyebrowNew}
      </p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-burgundy font-serif text-4xl tracking-[-0.035em] md:text-5xl">
          {vi.title || text.eyebrowNew}
        </h1>
        {isPublished ? (
          <span className="bg-gold/15 text-gold-ink rounded-full px-3 py-1 text-[0.65rem] font-semibold tracking-[0.08em] uppercase">
            {text.published}
          </span>
        ) : null}
        {initial.hasDraft && isPublished ? (
          <span className="text-charcoal/55 text-xs">{text.hasDraftNote}</span>
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

      {/* ---- Identity ------------------------------------------------ */}
      <section className="border-burgundy/15 mt-8 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.identity}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.sku}</span>
            <input
              value={sku}
              onChange={(event) => setSku(event.target.value.toUpperCase())}
              maxLength={80}
              className={`${inputClass} font-mono`}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.collections}</span>
            {collectionOptions.length === 0 ? (
              <p className="text-charcoal/50 text-sm">{text.noCollections}</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
                {collectionOptions.map((option) => (
                  <label
                    key={option.id}
                    className="text-charcoal/75 flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={collectionIds.includes(option.id)}
                      onChange={(event) =>
                        setCollectionIds(
                          event.target.checked
                            ? [...collectionIds, option.id]
                            : collectionIds.filter((id) => id !== option.id),
                        )
                      }
                    />
                    {option.title}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---- Specification ------------------------------------------- */}
      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.spec}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.materials}</span>
            <input
              value={materials}
              onChange={(event) => setMaterials(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.finishes}</span>
            <input
              value={finishes}
              onChange={(event) => setFinishes(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.colors}</span>
            <input
              value={colors}
              onChange={(event) => setColors(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.leadTime}</span>
            <input
              value={leadTimeDays}
              onChange={(event) =>
                setLeadTimeDays(event.target.value.replace(/[^0-9]/g, ""))
              }
              inputMode="numeric"
              className={inputClass}
            />
          </label>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelClass}>{text.dimensions}</span>
            <div className="flex items-center gap-2">
              {(["length", "width", "height"] as const).map((axis) => (
                <input
                  key={axis}
                  value={dimensions[axis]}
                  onChange={(event) =>
                    setDimensions({
                      ...dimensions,
                      [axis]: event.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                  inputMode="decimal"
                  placeholder={
                    axis === "length" ? "D" : axis === "width" ? "R" : "C"
                  }
                  className={`${inputClass} w-24`}
                />
              ))}
              <select
                value={dimensions.unit}
                onChange={(event) =>
                  setDimensions({
                    ...dimensions,
                    unit: event.target.value as "mm" | "cm",
                  })
                }
                className={`${inputClass} w-24`}
              >
                <option value="cm">cm</option>
                <option value="mm">mm</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Gallery -------------------------------------------------- */}
      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
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
            disabled={!productId || busy !== null}
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

      {/* ---- Translations ---------------------------------------------- */}
      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-burgundy font-serif text-2xl">
            {text.translations}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>{text.title}</span>
              <input
                value={active.title}
                onChange={(event) =>
                  setActive({ ...active, title: event.target.value })
                }
                maxLength={300}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>{text.slug}</span>
              <input
                value={active.slug || slugify(active.title)}
                onChange={(event) =>
                  setActive({ ...active, slug: slugify(event.target.value) })
                }
                maxLength={160}
                className={`${inputClass} font-mono text-xs`}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.shortDescription}</span>
            <textarea
              value={active.shortDescription}
              onChange={(event) =>
                setActive({
                  ...active,
                  shortDescription: event.target.value,
                })
              }
              rows={2}
              maxLength={500}
              className={areaClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.description}</span>
            <textarea
              value={active.descriptionText}
              onChange={(event) =>
                setActive({ ...active, descriptionText: event.target.value })
              }
              rows={8}
              className={areaClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.care}</span>
            <textarea
              value={active.careText}
              onChange={(event) =>
                setActive({ ...active, careText: event.target.value })
              }
              rows={4}
              className={areaClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>{text.seoTitle}</span>
              <input
                value={active.seoTitle}
                onChange={(event) =>
                  setActive({ ...active, seoTitle: event.target.value })
                }
                maxLength={70}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>{text.seoDescription}</span>
              <input
                value={active.seoDescription}
                onChange={(event) =>
                  setActive({ ...active, seoDescription: event.target.value })
                }
                maxLength={180}
                className={inputClass}
              />
            </label>
          </div>
          <label className="text-charcoal/70 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active.noIndex}
              onChange={(event) =>
                setActive({ ...active, noIndex: event.target.checked })
              }
            />
            {text.noIndexLabel}
          </label>
        </div>
      </section>

      {/* ---- Verbs ------------------------------------------------------ */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy !== null || !vi.title.trim() || !sku.trim()}
          onClick={() => void handleSave()}
          className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
        >
          {busy === "save" ? text.saving : text.save}
        </button>
        <button
          type="button"
          disabled={busy !== null || !productId}
          onClick={() => void handlePublish()}
          className="bg-gold text-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold hover:brightness-105 disabled:pointer-events-none disabled:opacity-45"
        >
          {busy === "publish" ? text.publishing : text.publish}
        </button>
        {productId ? (
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
