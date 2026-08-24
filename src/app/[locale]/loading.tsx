"use client";

import { usePathname } from "next/navigation";

import { localeFromPathname, stateCopy } from "./state-copy";

export default function LocaleLoading() {
  const locale = localeFromPathname(usePathname());

  return (
    <main
      className="bg-ivory min-h-screen px-[var(--space-page)] pt-32"
      aria-busy="true"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {stateCopy[locale].loading}
      </span>
      <div className="mx-auto max-w-7xl animate-pulse" aria-hidden="true">
        <div className="bg-gold/35 h-3 w-28 rounded-full" />
        <div className="bg-burgundy/10 mt-8 h-16 max-w-2xl rounded-xl sm:h-24" />
        <div className="bg-charcoal/10 mt-8 h-5 max-w-xl rounded-full" />
        <div className="bg-charcoal/10 mt-3 h-5 max-w-md rounded-full" />
        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="bg-burgundy/8 aspect-[4/5] rounded-2xl"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
