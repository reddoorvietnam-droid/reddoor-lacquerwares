import "server-only";

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import {
  parseBootstrapAdminEmails,
  tryBootstrapInitialDirector,
} from "@/domains/identity/bootstrap";
import {
  findDevPreviewAccount,
  provisionDevPreviewIdentity,
} from "@/domains/identity/dev-login";
import { mongoIdentityRepository } from "@/domains/identity/mongo-repository";
import { inspectAuthEnv, inspectMongoEnv } from "@/lib/env/server";

const googleProfileSchema = z.object({
  sub: z.string().trim().min(1).max(255),
  email: z.email().max(320),
  email_verified: z.literal(true),
  name: z.string().trim().min(1).max(200).optional(),
  picture: z.url().max(2_048).optional(),
});

function removePersonalTokenClaims(token: {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
}): void {
  delete token.name;
  delete token.email;
  delete token.picture;
}

function removeAuthorizationTokenClaims(token: {
  sub?: string;
  userId?: string;
  userStatus?: "pending" | "active" | "suspended";
  authzVersion?: number;
}): void {
  delete token.sub;
  delete token.userId;
  delete token.userStatus;
  delete token.authzVersion;
}

/**
 * The role-preview provider, present only while `DEV_LOGIN_PASSWORD` is set
 * in the environment. The variable is a switch, not a checked secret: the
 * working group asked for one-click role switching, so knowing a role's
 * username is the whole ceremony. The gate against the outside world is that
 * the variable is never set in a deployed environment.
 *
 * It provisions a real user and access grant, then hands the email to the
 * ordinary JWT callback: from that point the session is indistinguishable
 * from one a Google account would produce, so what the portal shows is what
 * each role will really see.
 */
function createDevPreviewProvider() {
  return CredentialsProvider({
    id: "dev-preview",
    name: "Role preview",
    credentials: {
      username: { label: "Username", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.username) {
        return null;
      }

      const account = findDevPreviewAccount(credentials.username);
      if (!account) {
        return null;
      }

      try {
        const identity = await provisionDevPreviewIdentity(account, new Date());
        return { id: identity.userId, email: identity.email };
      } catch {
        // A provisioning failure (for example, MongoDB being unreachable)
        // must read as a failed sign-in, never as a thrown page error.
        return null;
      }
    },
  });
}

function createAuthOptions(input: {
  secret: string;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  bootstrapAdminEmails: string | undefined;
  devLoginPassword: string | undefined;
}): NextAuthOptions {
  const allowedBootstrapEmails = parseBootstrapAdminEmails(
    input.bootstrapAdminEmails,
  );

  return {
    secret: input.secret,
    providers: [
      ...(input.googleClientId && input.googleClientSecret
        ? [
            GoogleProvider({
              clientId: input.googleClientId,
              clientSecret: input.googleClientSecret,
            }),
          ]
        : []),
      ...(input.devLoginPassword ? [createDevPreviewProvider()] : []),
    ],
    session: {
      strategy: "jwt",
      maxAge: 8 * 60 * 60,
      updateAge: 30 * 60,
    },
    jwt: { maxAge: 8 * 60 * 60 },
    callbacks: {
      async signIn({ account, profile, user }) {
        if (account?.provider === "dev-preview") {
          // authorize() already provisioned the identity; record the sign-in
          // through the same audit trail Google sign-ins use.
          try {
            await mongoAuditRepository.append({
              actor: { type: "user", userId: user.id },
              action: "auth.signIn",
              resourceType: "user",
              resourceId: user.id,
              requestId: globalThis.crypto.randomUUID(),
              metadata: { devPreview: true },
              occurredAt: new Date(),
            });
          } catch {
            // The preview sign-in must not depend on audit storage.
          }
          return true;
        }

        if (account?.provider !== "google") {
          return false;
        }

        const parsedProfile = googleProfileSchema.safeParse(profile);
        if (!parsedProfile.success) {
          return false;
        }

        try {
          const occurredAt = new Date();
          const identity =
            await mongoIdentityRepository.synchronizeGoogleIdentity({
              googleSubject: parsedProfile.data.sub,
              email: parsedProfile.data.email,
              displayName: parsedProfile.data.name ?? null,
              avatarUrl: parsedProfile.data.picture ?? null,
              occurredAt,
            });
          await tryBootstrapInitialDirector({
            userId: identity.id,
            normalizedEmail: identity.normalizedEmail,
            allowedEmails: allowedBootstrapEmails,
            occurredAt,
            requestId: globalThis.crypto.randomUUID(),
          });

          const currentSnapshot =
            await mongoIdentityRepository.findSnapshotByUserId(identity.id);
          if (!currentSnapshot) {
            return false;
          }

          await mongoAuditRepository.append({
            actor: { type: "user", userId: identity.id },
            action:
              currentSnapshot.user.status === "active"
                ? "auth.signIn"
                : currentSnapshot.user.status === "pending"
                  ? "auth.accessPending"
                  : "auth.accessSuspended",
            resourceType: "user",
            resourceId: identity.id,
            requestId: globalThis.crypto.randomUUID(),
            metadata: { userStatus: currentSnapshot.user.status },
            occurredAt,
          });
          return true;
        } catch {
          return false;
        }
      },
      async jwt({ token, user }) {
        removePersonalTokenClaims(token);

        try {
          if (user?.email) {
            const identity =
              await mongoIdentityRepository.findIdentityByNormalizedEmail(
                user.email,
              );

            if (!identity) {
              removeAuthorizationTokenClaims(token);
              return token;
            }

            token.sub = identity.id;
            token.userId = identity.id;
            token.userStatus = identity.status;
            token.authzVersion = identity.authzVersion;
            return token;
          }

          if (!token.userId) {
            removeAuthorizationTokenClaims(token);
            return token;
          }

          const snapshot = await mongoIdentityRepository.findSnapshotByUserId(
            token.userId,
          );
          if (!snapshot) {
            removeAuthorizationTokenClaims(token);
            return token;
          }

          token.sub = snapshot.user.id;
          token.userStatus = snapshot.user.status;
          token.authzVersion = snapshot.user.authzVersion;
          return token;
        } catch {
          removeAuthorizationTokenClaims(token);
          return token;
        }
      },
      async session({ session, token }) {
        if (
          !token.userId ||
          !token.userStatus ||
          typeof token.authzVersion !== "number"
        ) {
          delete session.user;
          return session;
        }

        session.user = {
          id: token.userId,
          status: token.userStatus,
          authzVersion: token.authzVersion,
          name: null,
          email: null,
          image: null,
        };
        return session;
      },
    },
    events: {
      async signOut({ token }) {
        if (!token?.userId) {
          return;
        }

        try {
          await mongoAuditRepository.append({
            actor: { type: "user", userId: token.userId },
            action: "auth.signOut",
            resourceType: "user",
            resourceId: token.userId,
            requestId: globalThis.crypto.randomUUID(),
            occurredAt: new Date(),
          });
        } catch {
          // Logout must still clear the session when audit storage is unavailable.
        }
      },
    },
  };
}

export type AuthConfiguration =
  | { configured: false; invalidKeys: readonly string[] }
  | { configured: true; options: NextAuthOptions };

export function getAuthConfiguration(): AuthConfiguration {
  const authEnv = inspectAuthEnv();
  const mongoEnv = inspectMongoEnv();

  if (!authEnv.configured || !mongoEnv.configured) {
    return {
      configured: false,
      invalidKeys: [
        ...new Set([
          ...(authEnv.configured ? [] : authEnv.invalidKeys),
          ...(mongoEnv.configured ? [] : mongoEnv.invalidKeys),
        ]),
      ],
    };
  }

  return {
    configured: true,
    options: createAuthOptions({
      secret: authEnv.value.AUTH_SECRET,
      googleClientId: authEnv.value.AUTH_GOOGLE_ID,
      googleClientSecret: authEnv.value.AUTH_GOOGLE_SECRET,
      bootstrapAdminEmails: authEnv.value.ADMIN_EMAILS,
      devLoginPassword: authEnv.value.DEV_LOGIN_PASSWORD,
    }),
  };
}
