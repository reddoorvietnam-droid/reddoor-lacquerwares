import type { Route } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Calculator,
  Crown,
  Factory,
  Landmark,
  PenLine,
  Sparkles,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { SystemRoleKey } from "@/domains/identity/role-definitions";

export type WelcomeShortcut = {
  href: Route;
  label: string;
  description: string | null;
  /** A count worth acting on, such as accounts waiting for approval. */
  badge: string | null;
};

const roleIcons: Record<SystemRoleKey, LucideIcon> = {
  DIRECTOR: Crown,
  WAREHOUSE_MANAGER: Warehouse,
  FACTORY_MANAGER: Factory,
  FACTORY_ACCOUNTANT: Calculator,
  COMPANY_ACCOUNTANT: Landmark,
  CONTENT_CREATOR: PenLine,
};

/**
 * The page each role lands on after signing in: a greeting that names the
 * person and their position, then the screens that position works in.
 */
export function AdminWelcome({
  greeting,
  name,
  roleKey,
  roleLabel,
  tagline,
  startHeading,
  shortcuts,
}: {
  greeting: string;
  name: string;
  roleKey: SystemRoleKey | null;
  roleLabel: string;
  tagline: string | null;
  startHeading: string;
  shortcuts: readonly WelcomeShortcut[];
}) {
  const RoleIcon = roleKey ? roleIcons[roleKey] : Sparkles;

  return (
    <div>
      <section
        data-role={roleKey ?? undefined}
        className="bg-burgundy text-ivory relative isolate overflow-hidden rounded-[2rem] p-8 shadow-[var(--shadow-lacquer)] md:p-12"
      >
        <div
          aria-hidden="true"
          className="border-gold/20 pointer-events-none absolute -top-32 -right-24 -z-10 size-96 rounded-full border"
        />
        <div
          aria-hidden="true"
          className="border-gold/10 pointer-events-none absolute -top-16 -right-8 -z-10 size-64 rounded-full border"
        />
        <div
          aria-hidden="true"
          className="bg-lacquer/45 pointer-events-none absolute -bottom-40 -left-20 -z-10 size-96 rounded-full blur-3xl"
        />

        <div className="flex items-start justify-between gap-8">
          <div className="max-w-3xl min-w-0">
            <p className="eyebrow eyebrow-on-lacquer">{greeting}</p>
            <h1 className="mt-4 font-serif text-4xl tracking-[-0.04em] break-words md:text-6xl">
              {name}
            </h1>
            <p className="border-gold/40 bg-ivory/10 text-gold-light mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold">
              <RoleIcon aria-hidden="true" className="size-4" />
              {roleLabel}
            </p>
            {tagline ? (
              <p className="text-ivory/80 mt-5 max-w-2xl text-base leading-7 md:text-lg md:leading-8">
                {tagline}
              </p>
            ) : null}
          </div>
          <div
            aria-hidden="true"
            className="border-gold/30 bg-ivory/5 hidden size-28 shrink-0 place-items-center rounded-full border md:grid"
          >
            <RoleIcon className="text-gold-light size-12" strokeWidth={1.25} />
          </div>
        </div>
      </section>

      {shortcuts.length > 0 ? (
        <section className="mt-10" aria-labelledby="welcome-start">
          <h2
            id="welcome-start"
            className="text-burgundy font-serif text-3xl tracking-[-0.02em]"
          >
            {startHeading}
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.href}>
                <Link
                  href={shortcut.href}
                  className="group border-burgundy/15 hover:border-burgundy/40 focus-visible:outline-burgundy flex h-full flex-col rounded-2xl border bg-white p-5 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_1.25rem_3rem_rgb(61_13_16/0.09)] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-burgundy font-serif text-xl leading-snug">
                      {shortcut.label}
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="text-charcoal/30 group-hover:text-lacquer size-5 shrink-0 transition-colors"
                    />
                  </span>
                  {shortcut.description ? (
                    <span className="text-charcoal/60 mt-2 text-sm leading-6">
                      {shortcut.description}
                    </span>
                  ) : null}
                  {shortcut.badge ? (
                    <span className="bg-lacquer text-ivory mt-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold">
                      {shortcut.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
