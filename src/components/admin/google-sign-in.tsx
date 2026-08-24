"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

export function GoogleSignIn({ locale }: { locale: AdminLocale }) {
  const copy = getAdminDictionary(locale).auth;
  const [pending, setPending] = useState(false);

  return (
    <section className="border-burgundy/15 mx-auto max-w-2xl rounded-[2rem] border bg-white p-8 text-center shadow-[var(--shadow-soft)] md:p-12">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 className="text-burgundy mt-4 font-serif text-4xl tracking-[-0.035em] md:text-5xl">
        {copy.title}
      </h1>
      <p className="text-charcoal/65 mx-auto mt-5 max-w-xl text-base leading-7">
        {copy.description}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void signIn("google", { callbackUrl: `/${locale}/admin` });
        }}
        className="bg-lacquer text-ivory hover:bg-burgundy mt-8 inline-flex min-h-12 items-center rounded-full px-7 text-sm font-semibold shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)] disabled:pointer-events-none disabled:opacity-45"
      >
        {copy.googleButton}
      </button>
      <p className="text-charcoal/50 mx-auto mt-6 max-w-lg text-xs leading-5">
        {copy.privacyNote}
      </p>
    </section>
  );
}
