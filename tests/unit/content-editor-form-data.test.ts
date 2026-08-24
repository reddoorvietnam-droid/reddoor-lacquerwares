import { describe, expect, it } from "vitest";

import { parseContentEditorFormData } from "@/app/[locale]/admin/(portal)/content/form-data";
import { locales } from "@/lib/i18n/config";

function baseFormData() {
  const formData = new FormData();
  formData.set("entryId", "");
  formData.set("revisionId", "");
  formData.set("expectedEntryRevision", "0");
  formData.set("expectedRevision", "0");
  formData.set("code", "home-hero");
  formData.set("type", "section");
  formData.set("placement", "home.hero");
  formData.set("sourceLocale", "vi");

  locales.forEach((locale, index) => {
    const prefix = `translations.${index}`;
    formData.set(`${prefix}.locale`, locale);
    formData.set(`${prefix}.translationId`, "");
    formData.set(`${prefix}.expectedRevision`, "0");
    formData.set(`${prefix}.title`, "");
    formData.set(`${prefix}.slug`, "");
    formData.set(`${prefix}.summary`, "");
    formData.set(`${prefix}.body`, "");
    formData.set(`${prefix}.seoTitle`, "");
    formData.set(`${prefix}.seoDescription`, "");
  });

  formData.set("translations.0.title", "Cánh cửa sơn mài");
  formData.set("translations.0.body", "Đoạn thứ nhất.\n\nĐoạn thứ hai.");
  formData.set("translations.0.noIndex", "on");
  return formData;
}

describe("content editor FormData boundary", () => {
  it("maps a create form to allowlisted structured blocks", () => {
    const result = parseContentEditorFormData(baseFormData());

    expect(result.mode).toBe("create");
    if (result.mode !== "create") return;
    expect(result.input.translations).toHaveLength(1);
    expect(result.input.blocks).toEqual([
      {
        blockId: "vi-paragraph-1",
        type: "paragraph",
        text: "Đoạn thứ nhất.",
      },
      {
        blockId: "vi-paragraph-2",
        type: "paragraph",
        text: "Đoạn thứ hai.",
      },
    ]);
    expect(result.input.translations[0]?.seo.noIndex).toBe(true);
  });

  it("includes optimistic translation revisions only for persisted translations", () => {
    const formData = baseFormData();
    formData.set("entryId", "64b000000000000000000001");
    formData.set("revisionId", "64b000000000000000000002");
    formData.set("expectedEntryRevision", "4");
    formData.set("expectedRevision", "7");
    formData.set("translations.0.translationId", "64b000000000000000000003");
    formData.set("translations.0.expectedRevision", "3");
    formData.set("translations.1.title", "Red Door");

    const result = parseContentEditorFormData(formData);

    expect(result.mode).toBe("update");
    if (result.mode !== "update") return;
    expect(result.input.translations[0]?.expectedRevision).toBe(3);
    expect(result.input.translations[1]?.expectedRevision).toBeUndefined();
  });

  it("rejects body content without a title instead of dropping it", () => {
    const formData = baseFormData();
    formData.set("translations.0.title", "");

    expect(() => parseContentEditorFormData(formData)).toThrow();
  });

  it("ignores unexpected mass-assignment keys", () => {
    const formData = baseFormData();
    formData.set("status", "published");
    formData.set("createdBy", "64b000000000000000000099");

    const result = parseContentEditorFormData(formData);
    expect(result.mode).toBe("create");
    expect(result.input).not.toHaveProperty("status");
    expect(result.input).not.toHaveProperty("createdBy");
  });
});
