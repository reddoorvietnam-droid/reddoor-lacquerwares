"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

export type GoogleSignInError =
  "AccessDenied" | "Configuration" | "Unavailable" | "default";

/** Google's multicolour "G", drawn inline so no external asset is loaded. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
      <path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3C33.65 32.66 29.22 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92z"
      />
      <path
        fill="#FF3D00"
        d="m6.31 14.69 6.57 4.82C14.66 15.11 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.66 8.34 6.31 14.69z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.17 0 9.86-1.98 13.41-5.19l-6.19-5.24A11.9 11.9 0 0 1 24 36c-5.2 0-9.62-3.32-11.28-7.95l-6.52 5.03C9.51 39.56 16.23 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3a12.04 12.04 0 0 1-4.09 5.57l6.19 5.24C36.97 39.21 44 34 44 24c0-1.34-.14-2.65-.39-3.92z"
      />
    </svg>
  );
}

export function GoogleSignIn({
  locale,
  error = null,
}: {
  locale: AdminLocale;
  error?: GoogleSignInError | null;
}) {
  const copy = getAdminDictionary(locale).auth;
  const [pending, setPending] = useState(false);

  return (
    <section className="border-burgundy/15 mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border bg-white shadow-[var(--shadow-soft)] md:grid-cols-[1.1fr_1fr]">
      <div className="bg-burgundy text-ivory relative isolate overflow-hidden p-8 md:p-12">
        <div
          aria-hidden="true"
          className="border-gold/20 pointer-events-none absolute -top-24 -right-24 -z-10 size-72 rounded-full border"
        />
        <div
          aria-hidden="true"
          className="bg-lacquer/45 pointer-events-none absolute -bottom-32 -left-16 -z-10 size-80 rounded-full blur-3xl"
        />
        <p className="eyebrow eyebrow-on-lacquer">{copy.eyebrow}</p>
        <h1 className="mt-4 font-serif text-4xl tracking-[-0.035em] md:text-5xl">
          {copy.title}
        </h1>
        <p className="text-ivory/75 mt-5 text-base leading-7">
          {copy.description}
        </p>
        <ol className="mt-8 grid gap-4">
          {copy.steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm leading-6">
              <span
                aria-hidden="true"
                className="border-gold/55 bg-gold/15 text-gold-light grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <span className="text-ivory/85 pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col justify-center p-8 md:p-12">
        <h2 className="text-burgundy font-serif text-3xl tracking-[-0.02em]">
          {copy.cardTitle}
        </h2>
        <p className="text-charcoal/60 mt-3 text-sm leading-6">
          {copy.cardHint}
        </p>

        {error ? (
          <p
            role="alert"
            className="border-lacquer/35 bg-lacquer/5 text-lacquer mt-6 rounded-2xl border px-4 py-3 text-sm leading-6"
          >
            {copy.signInErrors[error]}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void signIn("google", { callbackUrl: `/${locale}/admin` });
          }}
          className="border-charcoal/15 text-charcoal hover:border-burgundy/40 hover:bg-ivory/60 focus-visible:outline-burgundy mt-7 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border bg-white px-6 text-sm font-semibold shadow-[0_0.5rem_1.5rem_rgb(61_13_16/0.08)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60"
        >
          <GoogleMark />
          {pending ? copy.googleRedirecting : copy.googleButton}
        </button>

        <p className="text-charcoal/50 mt-6 text-xs leading-5">
          {copy.privacyNote}
        </p>
      </div>
    </section>
  );
}
