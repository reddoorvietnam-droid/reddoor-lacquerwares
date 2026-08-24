import type { AdminLocale } from "@/lib/i18n/admin";
import { getAdminDictionary } from "@/lib/i18n/admin";

export function AdminSetupRequired({ locale }: { locale: AdminLocale }) {
  const copy = getAdminDictionary(locale).setup;

  return (
    <section className="border-gold/40 bg-burgundy text-ivory mx-auto max-w-3xl rounded-[2rem] border p-8 shadow-[var(--shadow-lacquer)] md:p-12">
      <p className="eyebrow eyebrow-on-lacquer">{copy.eyebrow}</p>
      <h1 className="mt-4 font-serif text-4xl tracking-[-0.03em] md:text-5xl">
        {copy.title}
      </h1>
      <p className="text-ivory/75 mt-5 max-w-2xl text-base leading-7">
        {copy.description}
      </p>
      <ol className="border-ivory/15 mt-8 space-y-3 rounded-2xl border bg-black/10 p-5 text-sm leading-6">
        <li>1. {copy.mongo}</li>
        <li>2. {copy.auth}</li>
      </ol>
      <p className="text-gold-light mt-5 text-sm font-semibold">
        {copy.safeDefault}
      </p>
    </section>
  );
}
