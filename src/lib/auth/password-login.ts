import "server-only";

import mongoose, { type Model, Schema } from "mongoose";
import { z } from "zod";

import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import { verifyPassword } from "@/lib/auth/password-hash";
import { connectToDatabase } from "@/lib/db/mongoose";

/**
 * Error codes the password form can come back with. Wrong credentials are
 * next-auth's own `CredentialsSignin`; the others are thrown from `authorize`
 * and next-auth passes the message through as the error code.
 */
export const passwordSignInErrors = [
  "CredentialsSignin",
  "PasswordLocked",
  "Unavailable",
] as const;
export type PasswordSignInError = (typeof passwordSignInErrors)[number];

/** Ten wrong passwords inside 15 minutes lock the form for 15 minutes. */
const maxFailures = 10;
const windowMs = 15 * 60 * 1000;

/** Must match `passwordAccountEmailPattern` in the staff policy. */
export function passwordAccountEmail(username: string): string {
  return `${username}@password.local`;
}

type ThrottleRecord = {
  _id: string;
  failures: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
};

const throttleSchema = new Schema<ThrottleRecord>(
  {
    _id: { type: String, required: true },
    failures: { type: Number, required: true, default: 0 },
    windowStartedAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: null },
  },
  { strict: "throw", versionKey: false, collection: "password_login_throttle" },
);

function getThrottleModel(): Model<ThrottleRecord> {
  return (
    (mongoose.models.PasswordLoginThrottle as
      Model<ThrottleRecord> | undefined) ??
    mongoose.model<ThrottleRecord>("PasswordLoginThrottle", throttleSchema)
  );
}

async function recordFailure(username: string, now: Date): Promise<void> {
  const Throttle = getThrottleModel();
  const current = await Throttle.findById(username).lean().exec();
  const windowOpen =
    current && now.getTime() - current.windowStartedAt.getTime() < windowMs;
  const failures = (windowOpen ? current.failures : 0) + 1;

  await Throttle.updateOne(
    { _id: username },
    failures >= maxFailures
      ? {
          failures: 0,
          windowStartedAt: now,
          lockedUntil: new Date(now.getTime() + windowMs),
        }
      : {
          failures,
          windowStartedAt: windowOpen ? current.windowStartedAt : now,
          lockedUntil: null,
        },
    { upsert: true },
  ).exec();
}

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type PasswordAccount = { username: string; passwordHash: string };

/**
 * next-auth `authorize` for the shared password account: returns the user to
 * sign in, `null` for a wrong username or password, and throws
 * `PasswordLocked` / `Unavailable` for the form to explain.
 */
export async function authorizePasswordSignIn(
  account: PasswordAccount,
  credentials: unknown,
): Promise<{ id: string; email: string; name: string } | null> {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const now = new Date();
  let accepted: boolean;
  try {
    await connectToDatabase();
    const throttle = await getThrottleModel()
      .findById(account.username)
      .lean()
      .exec();
    if (throttle?.lockedUntil && throttle.lockedUntil > now) {
      throw new Error("PasswordLocked");
    }

    // Always run scrypt, so a wrong username costs as long as a wrong password.
    const passwordMatches = await verifyPassword(
      parsed.data.password,
      account.passwordHash,
    );
    accepted = passwordMatches && parsed.data.username === account.username;

    if (!accepted) {
      await recordFailure(account.username, now);
      return null;
    }
    await getThrottleModel().deleteOne({ _id: account.username }).exec();
  } catch (error) {
    if (error instanceof Error && error.message === "PasswordLocked")
      throw error;
    throw new Error("Unavailable");
  }

  try {
    const identity = await mongoIdentityRepository.synchronizePasswordIdentity({
      email: passwordAccountEmail(account.username),
      displayName: account.username,
      occurredAt: now,
    });
    return {
      id: identity.id,
      email: identity.normalizedEmail,
      name: account.username,
    };
  } catch {
    throw new Error("Unavailable");
  }
}
