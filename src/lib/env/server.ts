import "server-only";

import { z } from "zod";

const optionalText = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATA_SOURCE: z.enum(["auto", "demo", "mongo"]).default("auto"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  MONGODB_DB_NAME: z.string().trim().min(1).default("reddoor"),
});

const mongoSchema = baseSchema.extend({
  MONGODB_URI: z
    .string()
    .trim()
    .min(1, "MONGODB_URI is required for MongoDB features"),
});

const authSchema = baseSchema.extend({
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must contain at least 32 characters"),
  AUTH_GOOGLE_ID: z.string().trim().min(1),
  AUTH_GOOGLE_SECRET: z.string().trim().min(1),
  ADMIN_EMAILS: optionalText,
});

const cloudinarySchema = baseSchema.extend({
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().trim().min(1),
  CLOUDINARY_API_KEY: z.string().trim().min(1),
  CLOUDINARY_API_SECRET: z.string().trim().min(1),
  CLOUDINARY_UPLOAD_FOLDER: z.string().trim().min(1).default("reddoor"),
  MAX_PDF_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(10),
});

const emailSchema = baseSchema.extend({
  RESEND_API_KEY: z.string().trim().min(1),
  EMAIL_FROM: z.email(),
  ORDER_NOTIFICATION_EMAILS: z.string().trim().min(1),
});

export type BaseEnv = z.infer<typeof baseSchema>;
export type MongoEnv = z.infer<typeof mongoSchema>;
export type AuthEnv = z.infer<typeof authSchema>;
export type CloudinaryEnv = z.infer<typeof cloudinarySchema>;
export type EmailEnv = z.infer<typeof emailSchema>;

export type OptionalFeatureEnv<T> =
  | { configured: true; value: T }
  | { configured: false; invalidKeys: readonly string[] };

function parseFeatureEnv<T>(schema: z.ZodType<T>, feature: string): T {
  const result = schema.safeParse(process.env);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues
    .map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`,
    )
    .join("; ");

  throw new Error(`${feature} configuration is invalid: ${issues}`);
}

export function getBaseEnv(): BaseEnv {
  return parseFeatureEnv(baseSchema, "Application");
}

export function getMongoEnv(): MongoEnv {
  return parseFeatureEnv(mongoSchema, "MongoDB");
}

export function inspectMongoEnv(): OptionalFeatureEnv<MongoEnv> {
  const result = mongoSchema.safeParse(process.env);

  if (result.success) {
    return { configured: true, value: result.data };
  }

  return {
    configured: false,
    invalidKeys: [
      ...new Set(
        result.error.issues.map(
          (issue) => issue.path.join(".") || "environment",
        ),
      ),
    ],
  };
}

export function getAuthEnv(): AuthEnv {
  return parseFeatureEnv(authSchema, "Authentication");
}

export function inspectAuthEnv(): OptionalFeatureEnv<AuthEnv> {
  const result = authSchema.safeParse(process.env);

  if (result.success) {
    return { configured: true, value: result.data };
  }

  return {
    configured: false,
    invalidKeys: [
      ...new Set(
        result.error.issues.map(
          (issue) => issue.path.join(".") || "environment",
        ),
      ),
    ],
  };
}

export function getCloudinaryEnv(): CloudinaryEnv {
  return parseFeatureEnv(cloudinarySchema, "Cloudinary");
}

export function getEmailEnv(): EmailEnv {
  return parseFeatureEnv(emailSchema, "Email");
}
