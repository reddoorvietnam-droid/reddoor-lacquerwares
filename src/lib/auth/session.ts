import "server-only";

import { getServerSession } from "next-auth";

import type { SessionIdentityResolution } from "@/lib/auth/guard";
import { getAuthConfiguration } from "@/lib/auth/config";

export async function resolveSessionIdentity(): Promise<SessionIdentityResolution> {
  const configuration = getAuthConfiguration();

  if (!configuration.configured) {
    return { configured: false };
  }

  const session = await getServerSession(configuration.options);
  const user = session?.user;

  if (
    !user?.id ||
    !user.status ||
    !Number.isInteger(user.authzVersion) ||
    user.authzVersion < 1
  ) {
    return { configured: true, identity: null };
  }

  return {
    configured: true,
    identity: {
      userId: user.id,
      status: user.status,
      authzVersion: user.authzVersion,
    },
  };
}
