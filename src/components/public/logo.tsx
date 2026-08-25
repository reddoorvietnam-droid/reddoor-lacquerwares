import Image from "next/image";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

import logoPlaque from "../../../public/logo_rd.jpg";

/**
 * The company mark: a gold geometric lattice on a lacquer-red plaque.
 *
 * Only the issued artwork is used. An earlier vector redraw was removed once the
 * real file was available — an approximation of a registered mark is a liability
 * the moment someone reaches for it by mistake.
 *
 * - `BrandPlaque` renders the artwork on its own.
 * - `LogoWordmark` pairs it with the typeset company name, because the plaque's
 *   own lettering is unreadable at header size.
 *
 * Replacing the artwork means replacing `public/logo_rd.jpg`; no other module
 * references that path.
 */

export type BrandPlaqueProps = {
  /** Accessible name; omit for a decorative plaque beside a visible wordmark. */
  label?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
};

export function BrandPlaque({
  label,
  priority = false,
  className,
  sizes = "(min-width: 768px) 12rem, 8rem",
}: BrandPlaqueProps) {
  return (
    <Image
      src={logoPlaque}
      alt={label ?? ""}
      {...(label ? {} : { "aria-hidden": true })}
      priority={priority}
      sizes={sizes}
      placeholder="blur"
      className={cn("h-auto w-full max-w-full object-contain", className)}
    />
  );
}

export type LogoWordmarkProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  descriptor?: string;
  inverse?: boolean;
  /** Set where the lockup sits above the fold, so the mark does not pop in. */
  priority?: boolean;
};

export function LogoWordmark({
  name,
  descriptor,
  inverse = false,
  priority = false,
  className,
  ...props
}: LogoWordmarkProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)} {...props}>
      {/*
        The issued plaque carries the company name at a size that is unreadable
        in a slim header, so it is paired with the typeset name rather than used
        alone. The plaque is decorative here because the adjacent text already
        names the brand.
      */}
      <BrandPlaque
        className="ring-gold/30 w-12 shrink-0 rounded-sm ring-1 sm:w-16"
        sizes="4rem"
        priority={priority}
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-serif text-[0.9rem] leading-none tracking-[0.03em] whitespace-nowrap uppercase sm:text-xl sm:tracking-[0.08em]",
            inverse ? "text-ivory" : "text-burgundy",
          )}
        >
          {name}
        </span>
        {descriptor ? (
          <span
            className={cn(
              "mt-1.5 hidden text-[0.5625rem] leading-none font-semibold tracking-[0.2em] whitespace-nowrap uppercase sm:block",
              inverse ? "text-gold" : "text-charcoal/64",
            )}
          >
            {descriptor}
          </span>
        ) : null}
      </span>
    </div>
  );
}
