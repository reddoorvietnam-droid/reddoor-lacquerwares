"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

/**
 * Ends the Google session and returns to the sign-in card — also the way to
 * switch to another Gmail while an account waits for approval.
 */
export function SignOutButton({
  locale,
  variant = "header",
  label,
}: {
  locale: AdminLocale;
  /** `header` sits on the burgundy bar; `solid` on a white card. */
  variant?: "header" | "solid";
  label?: string;
}) {
  const copy = getAdminDictionary(locale).auth;
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ callbackUrl: `/${locale}/admin/sign-in` });
      }}
      className={
        variant === "header"
          ? "border-ivory/25 hover:border-gold/60 hover:bg-ivory/10 inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-semibold transition-colors disabled:opacity-60"
          : "bg-lacquer text-ivory hover:bg-burgundy mt-7 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-60"
      }
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? copy.signingOut : (label ?? copy.signOut)}
    </button>
  );
}
