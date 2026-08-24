import type { Route } from "next";
import Link from "next/link";

export default function LocaleNotFound() {
  return (
    <main className="brand-surface flex min-h-screen items-center px-6 py-24">
      <section className="mx-auto w-full max-w-3xl text-center">
        <p className="eyebrow">404 · Not found</p>
        <h1 className="mt-6 font-serif text-5xl leading-none text-burgundy sm:text-7xl">
          Lối này chưa mở
        </h1>
        <p className="mx-auto mt-6 max-w-xl leading-8 text-charcoal/65">
          The requested page does not exist or its translation has not been published.
        </p>
        <Link href={"/vi" as Route} className="mt-9 inline-flex rounded-full bg-lacquer px-7 py-3.5 text-sm font-semibold text-ivory transition hover:bg-burgundy">
          Red Door · Trang chủ
        </Link>
      </section>
    </main>
  );
}
