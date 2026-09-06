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

/**
 * Google credentials are optional as a PAIR: the working group previews the
 * portal through the dev sign-in before the director's Google OAuth client
 * exists. Auth still requires at least one usable provider, so a secret with
 * neither Google nor a dev password remains unconfigured, and one Google key
 * without the other names the missing half instead of half-configuring.
 */
const authSchema = baseSchema
  .extend({
    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET must contain at least 32 characters"),
    AUTH_GOOGLE_ID: optionalText,
    AUTH_GOOGLE_SECRET: optionalText,
    ADMIN_EMAILS: optionalText,
    /**
     * Enables the local role-preview sign-in and sets its shared password.
     * Development only: leave unset in any deployed environment, where Google
     * sign-in is the sole way in.
     */
    DEV_LOGIN_PASSWORD: optionalText,
  })
  .check((ctx) => {
    const { AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, DEV_LOGIN_PASSWORD } =
      ctx.value;

    if (Boolean(AUTH_GOOGLE_ID) !== Boolean(AUTH_GOOGLE_SECRET)) {
      const missing = AUTH_GOOGLE_ID ? "AUTH_GOOGLE_SECRET" : "AUTH_GOOGLE_ID";
      ctx.issues.push({
        code: "custom",
        message: `${missing} is required when its counterpart is set`,
        path: [missing],
        input: ctx.value,
      });
    }

    if (!AUTH_GOOGLE_ID && !AUTH_GOOGLE_SECRET && !DEV_LOGIN_PASSWORD) {
      ctx.issues.push({
        code: "custom",
        message:
          "Configure AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or DEV_LOGIN_PASSWORD for local development",
        path: ["AUTH_GOOGLE_ID"],
        input: ctx.value,
      });
    }
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

const optionalUrl = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.url().optional(),
);

/**
 * The AI assistant provider. `anthropic` calls Claude through the official
 * SDK and needs a key; `openai-compatible` calls any endpoint that speaks the
 * OpenAI Chat Completions protocol (Gemini's compatibility layer, Groq,
 * Ollama) and needs the base URL, a key and an explicit model; `mock` is a
 * deterministic scripted provider for development and tests that never
 * calls a model — it is refused outright in production so a demo can never
 * masquerade as the live integration.
 */
const aiSchema = baseSchema
  .extend({
    AI_PROVIDER: z
      .enum(["anthropic", "openai-compatible", "mock"])
      .default("anthropic"),
    ANTHROPIC_API_KEY: optionalText,
    OPENAI_COMPAT_BASE_URL: optionalUrl,
    OPENAI_COMPAT_API_KEY: optionalText,
    /** Sent as `reasoning_effort` when set (Gemini: none/low/medium/high). */
    OPENAI_COMPAT_REASONING_EFFORT: optionalText,
    /** Defaults to claude-opus-5 for `anthropic`; required otherwise. */
    AI_MODEL: optionalText,
    AI_MAX_TOOL_ROUNDS: z.coerce.number().int().min(1).max(12).default(6),
    AI_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(300_000)
      .default(90_000),
  })
  .check((ctx) => {
    const { AI_PROVIDER, NODE_ENV } = ctx.value;
    const requireKey = (key: keyof typeof ctx.value) => {
      if (ctx.value[key]) return;
      ctx.issues.push({
        code: "custom",
        message: `${key} is required when AI_PROVIDER=${AI_PROVIDER}`,
        path: [key],
        input: ctx.value,
      });
    };
    if (AI_PROVIDER === "anthropic") {
      requireKey("ANTHROPIC_API_KEY");
    }
    if (AI_PROVIDER === "openai-compatible") {
      requireKey("OPENAI_COMPAT_BASE_URL");
      requireKey("OPENAI_COMPAT_API_KEY");
      requireKey("AI_MODEL");
    }
    if (AI_PROVIDER === "mock" && NODE_ENV === "production") {
      ctx.issues.push({
        code: "custom",
        message: "AI_PROVIDER=mock is not allowed in production",
        path: ["AI_PROVIDER"],
        input: ctx.value,
      });
    }
  })
  .transform((value) => ({
    ...value,
    AI_MODEL: value.AI_MODEL ?? "claude-opus-5",
  }));

/** Bearer secret for the scheduled reminder route; never reuse AUTH_SECRET. */
const cronSchema = baseSchema.extend({
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET must contain at least 32 characters"),
});

/**
 * Zalo Official Account application credentials: the app id, the OA secret
 * key (webhook signature) and the app secret key (OAuth). No token lives
 * here — the token pair is obtained once through "Connect Zalo" on the
 * settings page, stored in the database and renewed by the platform.
 */
const zaloSchema = baseSchema.extend({
  ZALO_APP_ID: z.string().trim().min(1),
  ZALO_OA_SECRET_KEY: z.string().trim().min(1),
  ZALO_APP_SECRET_KEY: z.string().trim().min(1),
});

/**
 * Reminder delivery policy. `off` (the default) records every notification
 * intent but sends nothing; `test` redirects every message to
 * `NOTIFICATION_TEST_RECIPIENT`; `live` sends to the real recipients. The
 * default is deliberately silent so a freshly deployed job can never message
 * staff before the company has opted in.
 */
const notificationSchema = baseSchema
  .extend({
    BUSINESS_TIMEZONE: z.string().trim().min(1).default("Asia/Ho_Chi_Minh"),
    NOTIFICATION_DELIVERY: z.enum(["off", "test", "live"]).default("off"),
    NOTIFICATION_TEST_RECIPIENT: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.email().optional(),
    ),
    /** Days before the due date the first reminder goes out. */
    REMINDER_LEAD_DAYS: z.coerce.number().int().min(0).max(14).default(1),
    /** Local hours (start-end, 24h) during which nothing is sent. */
    REMINDER_QUIET_HOURS: z
      .string()
      .trim()
      .regex(/^\d{1,2}-\d{1,2}$/)
      .default("21-7"),
  })
  .check((ctx) => {
    if (
      ctx.value.NOTIFICATION_DELIVERY === "test" &&
      !ctx.value.NOTIFICATION_TEST_RECIPIENT
    ) {
      ctx.issues.push({
        code: "custom",
        message:
          "NOTIFICATION_TEST_RECIPIENT is required when NOTIFICATION_DELIVERY=test",
        path: ["NOTIFICATION_TEST_RECIPIENT"],
        input: ctx.value,
      });
    }
  });

export type BaseEnv = z.infer<typeof baseSchema>;
export type MongoEnv = z.infer<typeof mongoSchema>;
export type AuthEnv = z.infer<typeof authSchema>;
export type CloudinaryEnv = z.infer<typeof cloudinarySchema>;
export type EmailEnv = z.infer<typeof emailSchema>;
export type AiEnv = z.infer<typeof aiSchema>;
export type CronEnv = z.infer<typeof cronSchema>;
export type ZaloEnv = z.infer<typeof zaloSchema>;
export type NotificationEnv = z.infer<typeof notificationSchema>;

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

/**
 * Development-only escape hatch: with DEV_OPEN_ACCESS=true every signed-in
 * portal user passes every permission check at global scope, so the whole
 * team can browse the portal while RBAC is still being wired up. Denial
 * audits are skipped for these bypassed checks. Leave unset in any real
 * deployment — the RBAC rules in the role definitions apply again the
 * moment it is removed.
 */
export function isDevOpenAccessEnabled(): boolean {
  return process.env.DEV_OPEN_ACCESS?.trim().toLowerCase() === "true";
}

export function getCloudinaryEnv(): CloudinaryEnv {
  return parseFeatureEnv(cloudinarySchema, "Cloudinary");
}

export function inspectCloudinaryEnv(): OptionalFeatureEnv<CloudinaryEnv> {
  const result = cloudinarySchema.safeParse(process.env);

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

export function getEmailEnv(): EmailEnv {
  return parseFeatureEnv(emailSchema, "Email");
}

export function inspectEmailEnv(): OptionalFeatureEnv<EmailEnv> {
  const result = emailSchema.safeParse(process.env);

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

function inspect<T>(schema: z.ZodType<T>): OptionalFeatureEnv<T> {
  const result = schema.safeParse(process.env);
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

export function inspectAiEnv(): OptionalFeatureEnv<AiEnv> {
  return inspect(aiSchema);
}

export function inspectCronEnv(): OptionalFeatureEnv<CronEnv> {
  return inspect(cronSchema);
}

export function inspectZaloEnv(): OptionalFeatureEnv<ZaloEnv> {
  return inspect(zaloSchema);
}

/** Always resolves: every field has a default and only `test` mode can fail. */
export function inspectNotificationEnv(): OptionalFeatureEnv<NotificationEnv> {
  return inspect(notificationSchema);
}

export function getNotificationEnv(): NotificationEnv {
  return parseFeatureEnv(notificationSchema, "Notifications");
}
