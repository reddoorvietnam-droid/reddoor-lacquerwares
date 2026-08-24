import { z } from "zod";

import { localeSchema, objectIdStringSchema } from "@/lib/content/contracts";
import { locales } from "@/lib/i18n/config";

const optimisticRevisionSchema = z.number().int().min(0);

const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();

export const siteSettingsSocialPlatformSchema = z.enum([
  "facebook",
  "instagram",
  "youtube",
  "linkedin",
  "pinterest",
  "x",
  "tiktok",
  "whatsapp",
]);

export const siteSettingsSocialLinkSchema = z
  .object({
    platform: siteSettingsSocialPlatformSchema,
    label: z.string().trim().min(1).max(120),
    url: z
      .string()
      .trim()
      .max(2_048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            Boolean(url.hostname) &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      }, "Social links must be credential-free HTTPS URLs."),
  })
  .strict();

export const siteSettingsTranslationInputSchema = z
  .object({
    locale: localeSchema,
    companyName: z.string().trim().min(1).max(200),
    tagline: optionalText(300),
    description: optionalText(2_000),
    addressLabel: optionalText(500),
  })
  .strict();

const payloadFields = {
  translations: z
    .array(siteSettingsTranslationInputSchema)
    .min(1)
    .max(locales.length),
  publicEmail: z.string().trim().toLowerCase().email().max(320).optional(),
  publicPhone: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[+()0-9 .-]+$/, "Public phone contains unsupported characters.")
    .optional(),
  socialLinks: z.array(siteSettingsSocialLinkSchema).max(20).default([]),
} as const;

function validateUniquePayloadValues(
  value: {
    translations: ReadonlyArray<{ locale: string }>;
    socialLinks: ReadonlyArray<{ platform: string }>;
  },
  context: z.RefinementCtx,
): void {
  const translationLocales = new Set<string>();
  value.translations.forEach((translation, index) => {
    if (translationLocales.has(translation.locale)) {
      context.addIssue({
        code: "custom",
        message: "Site settings can contain only one translation per locale.",
        path: ["translations", index, "locale"],
      });
    }
    translationLocales.add(translation.locale);
  });

  const socialPlatforms = new Set<string>();
  value.socialLinks.forEach((link, index) => {
    if (socialPlatforms.has(link.platform)) {
      context.addIssue({
        code: "custom",
        message: "Site settings can contain only one link per social platform.",
        path: ["socialLinks", index, "platform"],
      });
    }
    socialPlatforms.add(link.platform);
  });
}

export const siteSettingsPayloadSchema = z
  .object(payloadFields)
  .strict()
  .superRefine(validateUniquePayloadValues);

export const publishedSettingsExpectationSchema = z.discriminatedUnion(
  "exists",
  [
    z.object({ exists: z.literal(false) }).strict(),
    z
      .object({
        exists: z.literal(true),
        settingsId: objectIdStringSchema,
        expectedRevision: optimisticRevisionSchema,
      })
      .strict(),
  ],
);

export const createSiteSettingsDraftInputSchema = z
  .object({
    basePublished: publishedSettingsExpectationSchema,
    ...payloadFields,
  })
  .strict()
  .superRefine(validateUniquePayloadValues);

export const updateSiteSettingsDraftInputSchema = z
  .object({
    settingsId: objectIdStringSchema,
    expectedRevision: optimisticRevisionSchema,
    ...payloadFields,
  })
  .strict()
  .superRefine(validateUniquePayloadValues);

const workflowFields = {
  settingsId: objectIdStringSchema,
  expectedRevision: optimisticRevisionSchema,
} as const;

export const submitSiteSettingsForReviewInputSchema = z
  .object(workflowFields)
  .strict();

export const returnSiteSettingsToDraftInputSchema = z
  .object({
    ...workflowFields,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const publishSiteSettingsInputSchema = z.object(workflowFields).strict();

export type SiteSettingsSocialPlatform = z.output<
  typeof siteSettingsSocialPlatformSchema
>;
export type SiteSettingsSocialLinkInput = z.output<
  typeof siteSettingsSocialLinkSchema
>;
export type SiteSettingsTranslationInput = z.output<
  typeof siteSettingsTranslationInputSchema
>;
export type SiteSettingsPayload = z.output<typeof siteSettingsPayloadSchema>;
export type PublishedSettingsExpectation = z.output<
  typeof publishedSettingsExpectationSchema
>;
export type CreateSiteSettingsDraftInput = z.output<
  typeof createSiteSettingsDraftInputSchema
>;
export type UpdateSiteSettingsDraftInput = z.output<
  typeof updateSiteSettingsDraftInputSchema
>;
export type SubmitSiteSettingsForReviewInput = z.output<
  typeof submitSiteSettingsForReviewInputSchema
>;
export type ReturnSiteSettingsToDraftInput = z.output<
  typeof returnSiteSettingsToDraftInputSchema
>;
export type PublishSiteSettingsInput = z.output<
  typeof publishSiteSettingsInputSchema
>;
