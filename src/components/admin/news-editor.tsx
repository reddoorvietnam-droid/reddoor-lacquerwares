"use client";

import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  attachArticleCoverAction,
  deleteArticleAction,
  publishArticleAction,
  registerArticleBodyImageAction,
  saveArticleAction,
} from "@/app/[locale]/admin/(portal)/news/actions";
import { uploadImage } from "@/components/admin/upload-image";
import {
  emptyEditorBlock,
  type ArticleEditorBlock,
  type ArticleEditorBlockType,
} from "@/lib/content/article-editor-blocks";
import type { AdminLocale } from "@/lib/i18n/admin";
import { slugify } from "@/lib/utils/slug";

/**
 * The newsroom editor.
 *
 * The body is a bilingual block list — every block shows its Vietnamese and
 * English sides together, so a translator never scrolls two screens apart.
 * Metadata (title, summary, SEO) stays per-locale under the VI/EN tabs.
 * Every mutation goes through a server action that re-authorizes; images go
 * browser → Cloudinary against a short-lived signature, and their delivery
 * URLs are minted server-side at save time.
 */

export type EditorTranslation = {
  title: string;
  slug: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  noIndex: boolean;
};

export type NewsEditorInitial = {
  articleId: string | null;
  status: string;
  hasDraft: boolean;
  categorySlug: string | null;
  tags: string;
  authorLabel: string;
  coverUrl: string | null;
  blocks: readonly ArticleEditorBlock[];
  translations: Partial<Record<"vi" | "en", EditorTranslation>>;
};

const emptyTranslation: EditorTranslation = {
  title: "",
  slug: "",
  summary: "",
  seoTitle: "",
  seoDescription: "",
  noIndex: false,
};

const copy = {
  vi: {
    eyebrowNew: "Bài viết mới",
    eyebrowEdit: "Biên tập bài viết",
    back: "Quay lại danh sách",
    general: "Thông tin chung",
    category: "Danh mục",
    noCategory: "— Không chọn —",
    tags: "Thẻ (phân cách bằng dấu phẩy)",
    author: "Tác giả hiển thị",
    cover: "Ảnh đại diện",
    coverHint: "Lưu bản nháp trước rồi mới tải ảnh.",
    uploadCover: "Tải ảnh",
    replaceCover: "Thay ảnh",
    uploading: "Đang tải…",
    body: "Nội dung bài viết song ngữ",
    bodyHint:
      "Mỗi khối có cột tiếng Việt và tiếng Anh cạnh nhau. Bỏ trống cột tiếng Anh thì khối dùng bản tiếng Việt.",
    addBlock: "Thêm khối",
    moveUp: "Lên",
    moveDown: "Xuống",
    removeBlock: "Xóa khối",
    viColumn: "Tiếng Việt",
    enColumn: "English",
    level: "Cấp",
    attribution: "Nguồn trích dẫn (không bắt buộc)",
    listHint: "Mỗi dòng một mục",
    imageEmpty: "Lưu bản nháp trước rồi tải ảnh lên.",
    imageUpload: "Tải ảnh cho khối",
    imageAlt: "Mô tả ảnh (alt)",
    imageCaption: "Chú thích",
    embedHref: "Dán link YouTube",
    ctaHref: "Đường dẫn nút",
    ctaLabel: "Nhãn nút",
    blockNames: {
      heading: "Tiêu đề",
      paragraph: "Đoạn văn",
      quote: "Trích dẫn",
      list: "Danh sách",
      image: "Hình ảnh",
      divider: "Phân cách",
      embed: "Nhúng YouTube",
      callToAction: "Nút CTA",
    } as Record<ArticleEditorBlockType, string>,
    meta: "Tiêu đề & SEO",
    title: "Tiêu đề",
    slug: "Slug (tự sinh từ tiêu đề)",
    summary: "Tóm tắt",
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
    remove: "Xóa bài",
    removeConfirm: "Xóa hẳn? Bấm lần nữa",
    removing: "Đang xóa…",
    saved: "Đã lưu.",
    publishedOk: "Đã xuất bản.",
    uploadFailed: "Tải ảnh thất bại — kiểm tra định dạng (JPG/PNG/WebP).",
    errors: {
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      INVALID_INPUT: "Dữ liệu chưa hợp lệ — kiểm tra các trường bắt buộc.",
      DUPLICATE_INTERNAL_ID: "Đã có bài viết trùng slug tiếng Việt.",
      SLUG_UNAVAILABLE: "Slug đã được dùng ở bài khác.",
      ROUTE_UNAVAILABLE: "Đường dẫn đã được dùng ở bài khác.",
      NO_DRAFT: "Không có bản nháp để xuất bản.",
      NOT_FOUND: "Không tìm thấy bài viết.",
      EMPTY_CONTENT: "Bản dịch cần tiêu đề và tóm tắt trước khi xuất bản.",
      UNAVAILABLE: "Không thực hiện được. Thử lại sau.",
    } as Record<string, string>,
  },
  en: {
    eyebrowNew: "New article",
    eyebrowEdit: "Edit article",
    back: "Back to the list",
    general: "General",
    category: "Category",
    noCategory: "— None —",
    tags: "Tags (comma separated)",
    author: "Displayed author",
    cover: "Cover photograph",
    coverHint: "Save the draft first, then upload the cover.",
    uploadCover: "Upload image",
    replaceCover: "Replace image",
    uploading: "Uploading…",
    body: "Bilingual article body",
    bodyHint:
      "Each block shows its Vietnamese and English columns together. An empty English column falls back to the Vietnamese.",
    addBlock: "Add block",
    moveUp: "Up",
    moveDown: "Down",
    removeBlock: "Remove block",
    viColumn: "Vietnamese",
    enColumn: "English",
    level: "Level",
    attribution: "Attribution (optional)",
    listHint: "One item per line",
    imageEmpty: "Save the draft first, then upload.",
    imageUpload: "Upload block image",
    imageAlt: "Image description (alt)",
    imageCaption: "Caption",
    embedHref: "Paste a YouTube link",
    ctaHref: "Button link",
    ctaLabel: "Button label",
    blockNames: {
      heading: "Heading",
      paragraph: "Paragraph",
      quote: "Quote",
      list: "List",
      image: "Image",
      divider: "Divider",
      embed: "Embed YouTube",
      callToAction: "CTA button",
    } as Record<ArticleEditorBlockType, string>,
    meta: "Titles & SEO",
    title: "Title",
    slug: "Slug (generated from the title)",
    summary: "Summary",
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
    remove: "Delete",
    removeConfirm: "Really delete? Click again",
    removing: "Deleting…",
    saved: "Saved.",
    publishedOk: "Published.",
    uploadFailed: "Image upload failed — check the format (JPG/PNG/WebP).",
    errors: {
      FORBIDDEN: "You do not have permission for this action.",
      INVALID_INPUT: "The input is not valid — check the required fields.",
      DUPLICATE_INTERNAL_ID: "An article with this Vietnamese slug exists.",
      SLUG_UNAVAILABLE: "That slug is taken by another article.",
      ROUTE_UNAVAILABLE: "That path is taken by another article.",
      NO_DRAFT: "There is no draft to publish.",
      NOT_FOUND: "Article not found.",
      EMPTY_CONTENT: "Every translation needs a title and summary to publish.",
      UNAVAILABLE: "The action failed. Try again shortly.",
    } as Record<string, string>,
  },
} as const;

const BLOCK_PALETTE: readonly ArticleEditorBlockType[] = [
  "heading",
  "paragraph",
  "image",
  "quote",
  "list",
  "divider",
  "callToAction",
  "embed",
];

const inputClass =
  "border-burgundy/20 focus:border-burgundy/50 min-h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none";
const areaClass =
  "border-burgundy/20 focus:border-burgundy/50 w-full rounded-xl border bg-white px-4 py-3 text-sm leading-6 outline-none";
const labelClass =
  "text-charcoal/70 text-xs font-semibold tracking-[0.08em] uppercase";

let blockCounter = 0;
function nextBlockId(): string {
  blockCounter += 1;
  return `b${Date.now().toString(36)}${blockCounter}`;
}

export function NewsEditor({
  locale,
  categories,
  initial,
}: {
  locale: AdminLocale;
  categories: readonly { slug: string; label: string }[];
  initial: NewsEditorInitial;
}) {
  const text = copy[locale];
  const router = useRouter();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const blockImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(
    null,
  );

  const [articleId, setArticleId] = useState(initial.articleId);
  const [categorySlug, setCategorySlug] = useState(initial.categorySlug ?? "");
  const [tags, setTags] = useState(initial.tags);
  const [authorLabel, setAuthorLabel] = useState(initial.authorLabel);
  const [coverUrl, setCoverUrl] = useState(initial.coverUrl);
  const [blocks, setBlocks] = useState<readonly ArticleEditorBlock[]>(
    initial.blocks,
  );
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

  /* ---- block operations ------------------------------------------- */

  function updateBlock(id: string, patch: Partial<ArticleEditorBlock>) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...patch } : block,
      ),
    );
  }

  function moveBlock(id: string, direction: -1 | 1) {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const moved = next[index];
      const displaced = next[target];
      if (!moved || !displaced) return current;
      next[index] = displaced;
      next[target] = moved;
      return next;
    });
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function addBlock(type: ArticleEditorBlockType) {
    setBlocks((current) => [...current, emptyEditorBlock(nextBlockId(), type)]);
  }

  async function handleBlockImage(file: File) {
    const blockId = uploadingBlockId;
    if (!articleId || !blockId) return;
    setBusy("upload");
    setUploadPercent(0);
    setNotice(null);
    try {
      const asset = await uploadImage(
        { kind: "article", id: articleId },
        file,
        setUploadPercent,
      );
      const registered = await registerArticleBodyImageAction({
        articleId,
        ...asset,
      });
      if (registered.status !== "success") {
        throw new Error(registered.message);
      }
      updateBlock(blockId, {
        image: {
          publicId: asset.publicId,
          assetVersion: asset.assetVersion,
          width: asset.width,
          height: asset.height,
          previewUrl: `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_640,c_limit,f_auto,q_auto/v${asset.assetVersion}/${asset.publicId}`,
        },
      });
    } catch {
      setNotice({ kind: "error", message: text.uploadFailed });
    } finally {
      setUploadingBlockId(null);
      setBusy(null);
    }
  }

  /* ---- article verbs ----------------------------------------------- */

  function translationsPayload() {
    const toPayload = (code: "vi" | "en", entry: EditorTranslation) => ({
      locale: code,
      title: entry.title,
      slug: slugify(entry.slug || entry.title),
      summary: entry.summary,
      ...(entry.seoTitle ? { seoTitle: entry.seoTitle } : {}),
      ...(entry.seoDescription ? { seoDescription: entry.seoDescription } : {}),
      noIndex: entry.noIndex,
    });

    const payload = [toPayload("vi", vi)];
    if (en.title.trim() && en.summary.trim()) {
      payload.push(toPayload("en", en));
    }
    return payload;
  }

  function blocksPayload() {
    return blocks.map((block) => ({
      id: block.id,
      type: block.type,
      vi: block.vi,
      en: block.en,
      level: block.level,
      attribution: block.attribution,
      href: block.href,
      alt: block.alt,
      image: block.image
        ? {
            publicId: block.image.publicId,
            assetVersion: block.image.assetVersion,
            width: block.image.width,
            height: block.image.height,
          }
        : null,
    }));
  }

  async function handleSave() {
    setBusy("save");
    setNotice(null);
    const result = await saveArticleAction({
      articleId,
      categorySlug: categorySlug || null,
      tags,
      authorLabel: authorLabel || null,
      blocks: blocksPayload(),
      translations: translationsPayload(),
    });
    setBusy(null);
    if (result.status === "success") {
      setNotice({ kind: "ok", message: text.saved });
      if (!articleId && result.articleId) {
        setArticleId(result.articleId);
        window.history.replaceState(
          null,
          "",
          `/${locale}/admin/news/${result.articleId}`,
        );
      }
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handlePublish() {
    if (!articleId) return;
    setBusy("publish");
    setNotice(null);
    const result = await publishArticleAction({ articleId });
    setBusy(null);
    if (result.status === "success") {
      setNotice({ kind: "ok", message: text.publishedOk });
      router.refresh();
    } else {
      fail(result.message);
    }
  }

  async function handleDelete() {
    if (!articleId) return;
    if (!armedToDelete) {
      setArmedToDelete(true);
      return;
    }
    setBusy("delete");
    const result = await deleteArticleAction({ articleId });
    setBusy(null);
    if (result.status === "success") {
      router.push(`/${locale}/admin/news` as Route);
      router.refresh();
    } else {
      setArmedToDelete(false);
      fail(result.message);
    }
  }

  async function handleCover(file: File) {
    if (!articleId) return;
    setBusy("upload");
    setUploadPercent(0);
    setNotice(null);
    try {
      const asset = await uploadImage(
        { kind: "article", id: articleId },
        file,
        setUploadPercent,
      );
      const saved = await attachArticleCoverAction({
        articleId,
        ...asset,
        alt: vi.title || undefined,
      });
      if (saved.status !== "success") throw new Error(saved.message);
      setCoverUrl(
        `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_640,c_limit,f_auto,q_auto/v${asset.assetVersion}/${asset.publicId}`,
      );
      router.refresh();
    } catch {
      setNotice({ kind: "error", message: text.uploadFailed });
    } finally {
      setBusy(null);
    }
  }

  const isPublished = initial.status === "published";

  return (
    <div className="max-w-5xl">
      <Link
        href={`/${locale}/admin/news` as Route}
        className="text-burgundy hover:text-lacquer text-sm font-semibold"
      >
        ← {text.back}
      </Link>
      <p className="eyebrow mt-4">
        {articleId ? text.eyebrowEdit : text.eyebrowNew}
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

      {/* ---- General + cover --------------------------------------- */}
      <section className="border-burgundy/15 mt-8 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.general}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.category}</span>
            <select
              value={categorySlug}
              onChange={(event) => setCategorySlug(event.target.value)}
              className={inputClass}
            >
              <option value="">{text.noCategory}</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>{text.author}</span>
            <input
              value={authorLabel}
              onChange={(event) => setAuthorLabel(event.target.value)}
              maxLength={200}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelClass}>{text.tags}</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              maxLength={1000}
              className={inputClass}
            />
          </label>
        </div>

        <div className="mt-6">
          <span className={labelClass}>{text.cover}</span>
          <div className="mt-2 flex items-center gap-5">
            <div className="bg-ivory border-burgundy/10 relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt=""
                  fill
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-burgundy/30 absolute inset-0 grid place-items-center font-serif text-xl"
                >
                  ◈
                </span>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleCover(file);
              }}
            />
            <div>
              <button
                type="button"
                disabled={!articleId || busy !== null}
                onClick={() => coverInputRef.current?.click()}
                className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
              >
                {busy === "upload" && uploadingBlockId === null
                  ? `${text.uploading} ${uploadPercent}%`
                  : coverUrl
                    ? text.replaceCover
                    : text.uploadCover}
              </button>
              {!articleId ? (
                <p className="text-charcoal/50 mt-1.5 text-xs">
                  {text.coverHint}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Bilingual body blocks ---------------------------------- */}
      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <h2 className="text-burgundy font-serif text-2xl">{text.body}</h2>
        <p className="text-charcoal/55 mt-1.5 text-xs leading-5">
          {text.bodyHint}
        </p>

        <input
          ref={blockImageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleBlockImage(file);
          }}
        />

        <div className="mt-5 grid gap-4">
          {blocks.map((block, index) => (
            <article
              key={block.id}
              className="border-burgundy/12 bg-ivory/40 rounded-xl border p-4"
            >
              <header className="flex items-center justify-between gap-3">
                <p className="text-burgundy text-sm font-bold tracking-[0.06em] uppercase">
                  {text.blockNames[block.type]}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={text.moveUp}
                    disabled={index === 0}
                    onClick={() => moveBlock(block.id, -1)}
                    className="border-burgundy/20 text-burgundy grid size-9 place-items-center rounded-full border text-sm disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={text.moveDown}
                    disabled={index === blocks.length - 1}
                    onClick={() => moveBlock(block.id, 1)}
                    className="border-burgundy/20 text-burgundy grid size-9 place-items-center rounded-full border text-sm disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={text.removeBlock}
                    onClick={() => removeBlock(block.id)}
                    className="border-lacquer/30 text-lacquer hover:border-lacquer/60 grid size-9 place-items-center rounded-full border text-sm"
                  >
                    ✕
                  </button>
                </div>
              </header>

              <div className="mt-3">
                <BlockFields
                  block={block}
                  text={text}
                  articleId={articleId}
                  busy={busy !== null}
                  uploadPercent={
                    uploadingBlockId === block.id ? uploadPercent : null
                  }
                  onChange={(patch) => updateBlock(block.id, patch)}
                  onPickImage={() => {
                    setUploadingBlockId(block.id);
                    blockImageInputRef.current?.click();
                  }}
                />
              </div>
            </article>
          ))}
        </div>

        <div className="border-burgundy/15 mt-5 rounded-xl border border-dashed p-4">
          <p className={labelClass}>{text.addBlock}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {BLOCK_PALETTE.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addBlock(type)}
                className="border-burgundy/25 text-burgundy hover:border-burgundy/50 hover:bg-ivory inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold"
              >
                + {text.blockNames[type]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Per-locale titles & SEO --------------------------------- */}
      <section className="border-burgundy/15 mt-6 rounded-2xl border bg-white p-6 shadow-[0_1rem_3rem_rgb(61_13_16/0.05)] sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-burgundy font-serif text-2xl">{text.meta}</h2>
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
            <span className={labelClass}>{text.summary}</span>
            <textarea
              value={active.summary}
              onChange={(event) =>
                setActive({ ...active, summary: event.target.value })
              }
              rows={2}
              maxLength={1000}
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

      {/* ---- Verbs ---------------------------------------------------- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy !== null || !vi.title.trim() || !vi.summary.trim()}
          onClick={() => void handleSave()}
          className="bg-burgundy text-ivory hover:bg-lacquer inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
        >
          {busy === "save" ? text.saving : text.save}
        </button>
        <button
          type="button"
          disabled={busy !== null || !articleId}
          onClick={() => void handlePublish()}
          className="bg-gold text-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold hover:brightness-105 disabled:pointer-events-none disabled:opacity-45"
        >
          {busy === "publish" ? text.publishing : text.publish}
        </button>
        {articleId ? (
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

/* -------------------------------------------------------------------- */
/* Per-type block fields                                                 */
/* -------------------------------------------------------------------- */

function BlockFields({
  block,
  text,
  articleId,
  busy,
  uploadPercent,
  onChange,
  onPickImage,
}: {
  block: ArticleEditorBlock;
  text: (typeof copy)["vi" | "en"];
  articleId: string | null;
  busy: boolean;
  uploadPercent: number | null;
  onChange: (patch: Partial<ArticleEditorBlock>) => void;
  onPickImage: () => void;
}) {
  const twoColumns = (
    rows: number,
    placeholderVi: string,
    placeholderEn: string,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1">
        <span className="text-charcoal/55 text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
          {text.viColumn}
        </span>
        <textarea
          value={block.vi}
          onChange={(event) => onChange({ vi: event.target.value })}
          rows={rows}
          placeholder={placeholderVi}
          className={areaClass}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-charcoal/55 text-[0.65rem] font-semibold tracking-[0.1em] uppercase">
          {text.enColumn}
        </span>
        <textarea
          value={block.en}
          onChange={(event) => onChange({ en: event.target.value })}
          rows={rows}
          placeholder={placeholderEn}
          className={areaClass}
        />
      </label>
    </div>
  );

  switch (block.type) {
    case "paragraph":
      return twoColumns(4, "Nội dung tiếng Việt…", "English content…");
    case "heading":
      return (
        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className={labelClass}>{text.level}</span>
            <select
              value={block.level}
              onChange={(event) =>
                onChange({ level: Number(event.target.value) === 3 ? 3 : 2 })
              }
              className="border-burgundy/20 min-h-9 rounded-lg border bg-white px-2 text-sm"
            >
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </label>
          {twoColumns(1, "Tiêu đề mục…", "Section heading…")}
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-3">
          {twoColumns(2, "Câu trích dẫn…", "Quotation…")}
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{text.attribution}</span>
            <input
              value={block.attribution}
              onChange={(event) =>
                onChange({ attribution: event.target.value })
              }
              maxLength={300}
              className={inputClass}
            />
          </label>
        </div>
      );
    case "list":
      return (
        <div className="grid gap-1.5">
          <p className="text-charcoal/50 text-xs">{text.listHint}</p>
          {twoColumns(
            4,
            "Mục thứ nhất\nMục thứ hai",
            "First item\nSecond item",
          )}
        </div>
      );
    case "image":
      return (
        <div className="grid gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-ivory border-burgundy/10 relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border">
              {block.image ? (
                <Image
                  src={block.image.previewUrl}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-burgundy/30 absolute inset-0 grid place-items-center font-serif text-lg"
                >
                  ◈
                </span>
              )}
            </div>
            <div>
              <button
                type="button"
                disabled={!articleId || busy}
                onClick={onPickImage}
                className="border-burgundy/25 text-burgundy hover:border-burgundy/50 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45"
              >
                {uploadPercent !== null
                  ? `${text.uploading} ${uploadPercent}%`
                  : text.imageUpload}
              </button>
              {!articleId ? (
                <p className="text-charcoal/50 mt-1.5 text-xs">
                  {text.imageEmpty}
                </p>
              ) : null}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{text.imageAlt}</span>
            <input
              value={block.alt}
              onChange={(event) => onChange({ alt: event.target.value })}
              maxLength={300}
              className={inputClass}
            />
          </label>
          <div className="grid gap-1.5">
            <p className={labelClass}>{text.imageCaption}</p>
            {twoColumns(1, "Chú thích tiếng Việt…", "English caption…")}
          </div>
        </div>
      );
    case "divider":
      return <hr className="border-gold/50 mx-auto my-2 w-24 border-t" />;
    case "embed":
      return (
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{text.embedHref}</span>
          <input
            value={block.href}
            onChange={(event) => onChange({ href: event.target.value })}
            placeholder="https://youtu.be/…"
            maxLength={2048}
            className={inputClass}
          />
        </label>
      );
    case "callToAction":
      return (
        <div className="grid gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{text.ctaHref}</span>
            <input
              value={block.href}
              onChange={(event) => onChange({ href: event.target.value })}
              placeholder="https://… hoặc /vi/contact"
              maxLength={2048}
              className={inputClass}
            />
          </label>
          <div className="grid gap-1.5">
            <p className={labelClass}>{text.ctaLabel}</p>
            {twoColumns(1, "Nhãn tiếng Việt…", "English label…")}
          </div>
        </div>
      );
    default:
      return null;
  }
}
