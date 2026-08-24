import type { DefaultSession } from "next-auth";

import type { UserStatus } from "@/domains/identity/contracts";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      status: UserStatus;
      authzVersion: number;
    } & Pick<DefaultSession["user"], "name" | "email" | "image">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    userStatus?: UserStatus;
    authzVersion?: number;
  }
}
