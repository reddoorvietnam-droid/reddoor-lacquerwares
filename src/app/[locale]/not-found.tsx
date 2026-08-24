"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { localeFromPathname, stateCopy } from "./state-copy";

export default function LocaleNotFound() {
  const locale = localeFromPathname(usePathname());
  const text = stateCopy[locale].notFound;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="brand-surface flex min-h-screen items-center px-6 py-24">
      <section
        className="mx-auto w-full max-w-3xl text-center"
        aria-labelledby="not-found-title"
      >
        <p className="eyebrow">{text.eyebrow}</p>
        <h1
          ref={headingRef}
          id="not-found-title"
          tabIndex={-1}
          className="text-burgundy mt-6 font-serif text-5xl leading-none outline-none sm:text-7xl"
        >
          {text.title}
        </h1>
        <p className="text-charcoal/65 mx-auto mt-6 max-w-xl leading-8">
          {text.body}
        </p>
        <Link
          href={`/${locale}` as Route}
          className="bg-lacquer text-ivory hover:bg-burgundy mt-9 inline-flex rounded-full px-7 py-3.5 text-sm font-semibold transition"
        >
          {text.home}
        </Link>
      </section>
    </main>
  );
}
