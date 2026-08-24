"use client";

import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";

import { getAdminDictionary } from "@/lib/i18n/admin";

export default function AdminNotFound() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "vi" ? "vi" : "en";
  const copy = getAdminDictionary(locale).state;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f2ede4] px-6 py-16">
      <section className="max-w-xl text-center">
        <p className="eyebrow">404 · Red Door CMS</p>
        <h1 className="text-burgundy mt-4 font-serif text-4xl tracking-[-0.035em]">
          {copy.notFoundTitle}
        </h1>
        <p className="text-charcoal/65 mt-5 text-base leading-7">
          {copy.notFoundDescription}
        </p>
        <Link
          href={`/${locale}/admin` as Route}
          className="bg-lacquer text-ivory hover:bg-burgundy mt-7 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold"
        >
          {copy.backToAdmin}
        </Link>
      </section>
    </main>
  );
}
