"use client";

import { useParams } from "next/navigation";

import { getAdminDictionary } from "@/lib/i18n/admin";

export default function AdminLoading() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "vi" ? "vi" : "en";
  const copy = getAdminDictionary(locale).state;

  return (
    <main
      aria-busy="true"
      aria-label={copy.loading}
      className="min-h-screen bg-[#f2ede4] px-[var(--space-page)] py-12"
    >
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="bg-gold/30 h-3 w-32 rounded-full" />
        <div className="bg-burgundy/10 mt-5 h-14 max-w-2xl rounded-2xl" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-48 rounded-2xl bg-white" />
          ))}
        </div>
      </div>
      <span className="sr-only">{copy.loading}</span>
    </main>
  );
}
