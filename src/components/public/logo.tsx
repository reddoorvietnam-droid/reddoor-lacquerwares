import type { HTMLAttributes, SVGProps } from "react";

import { cn } from "@/lib/utils/cn";

export type LogoMarkProps = Omit<SVGProps<SVGSVGElement>, "aria-label"> & {
  label?: string;
  decorative?: boolean;
};

export function LogoMark({
  label,
  decorative = false,
  className,
  ...props
}: LogoMarkProps) {
  const isDecorative = decorative || !label;

  return (
    <svg
      viewBox="0 0 48 56"
      className={cn("h-auto w-10 shrink-0", className)}
      role={isDecorative ? undefined : "img"}
      aria-hidden={isDecorative ? true : undefined}
      aria-label={isDecorative ? undefined : label}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M5 52V4h38v48" className="stroke-gold" strokeWidth="2.25" />
      <path
        d="M10.5 52V9.5h27V52"
        className="fill-lacquer stroke-burgundy"
        strokeWidth="1.25"
      />
      <path
        d="M13 13h22v39H13zM13 13l22 39M35 13 13 52"
        className="stroke-gold/75"
        strokeWidth="0.8"
      />
      <path
        d="M24 13v39M13 32.5h22"
        className="stroke-gold/45"
        strokeWidth="0.65"
      />
      <circle cx="31.75" cy="33" r="1.35" className="fill-gold" />
    </svg>
  );
}

export type LogoWordmarkProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  descriptor?: string;
  inverse?: boolean;
};

export function LogoWordmark({
  name,
  descriptor,
  inverse = false,
  className,
  ...props
}: LogoWordmarkProps) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)} {...props}>
      <LogoMark decorative className="w-8 sm:w-9" />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-serif text-xl leading-none tracking-[0.08em] uppercase",
            inverse ? "text-ivory" : "text-burgundy",
          )}
        >
          {name}
        </span>
        {descriptor ? (
          <span
            className={cn(
              "mt-1 hidden text-[0.5625rem] leading-none font-semibold tracking-[0.2em] uppercase sm:block",
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
