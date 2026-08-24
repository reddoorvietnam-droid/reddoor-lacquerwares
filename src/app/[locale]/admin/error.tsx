"use client";

import { useParams } from "next/navigation";

import { getAdminDictionary } from "@/lib/i18n/admin";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "vi" ? "vi" : "en";
  const copy = getAdminDictionary(locale).state;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f2ede4] px-6 py-16">
      <section className="border-burgundy/15 max-w-2xl rounded-[2rem] border bg-white p-8 text-center shadow-[var(--shadow-soft)] md:p-12">
        <p className="eyebrow">Red Door CMS</p>
        <h1 className="text-burgundy mt-4 font-serif text-4xl tracking-[-0.035em]">
          {copy.unexpectedTitle}
        </h1>
        <p className="text-charcoal/65 mt-5 text-base leading-7">
          {copy.unexpectedDescription}
        </p>
        {error.digest ? (
          <p className="text-charcoal/45 mt-4 font-mono text-xs">
            {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="bg-lacquer text-ivory hover:bg-burgundy mt-7 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold"
        >
          {copy.retry}
        </button>
      </section>
    </main>
  );
}
