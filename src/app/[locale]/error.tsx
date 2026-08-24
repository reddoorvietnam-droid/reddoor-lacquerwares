"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { localeFromPathname, stateCopy } from "./state-copy";

export default function LocaleError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = localeFromPathname(usePathname());
  const text = stateCopy[locale];
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="brand-surface flex min-h-screen items-center px-6 py-24">
      <section
        className="mx-auto w-full max-w-3xl rounded-[var(--radius-display)] border bg-[var(--surface-raised)] p-8 shadow-[var(--shadow-soft)] sm:p-14"
        aria-labelledby="locale-error-title"
        role="alert"
      >
        <p className="eyebrow">{text.error.eyebrow}</p>
        <h1
          ref={headingRef}
          id="locale-error-title"
          tabIndex={-1}
          className="text-burgundy mt-5 font-serif text-4xl outline-none sm:text-6xl"
        >
          {text.error.title}
        </h1>
        <p className="text-charcoal/70 mt-6 max-w-xl leading-8">
          {text.error.body}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={retry}
            className="bg-lacquer text-ivory hover:bg-burgundy rounded-full px-6 py-3 text-sm font-semibold transition"
          >
            {text.error.retry}
          </button>
          <Link
            href={`/${locale}` as Route}
            className="border-burgundy/20 text-burgundy hover:bg-burgundy/5 rounded-full border px-6 py-3 text-sm font-semibold transition"
          >
            {text.notFound.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
