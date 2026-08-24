import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type HeadingLevel = "h1" | "h2" | "h3";

export type SectionHeadingProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> & {
  title: string;
  eyebrow?: string;
  description?: string;
  align?: "start" | "center";
  level?: HeadingLevel;
  inverse?: boolean;
};

export function SectionHeading({
  title,
  eyebrow,
  description,
  align = "start",
  level = "h2",
  inverse = false,
  className,
  ...props
}: SectionHeadingProps) {
  const Heading = level;

  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
      {...props}
    >
      {eyebrow ? (
        <p className={cn("eyebrow", inverse && "text-gold")}>{eyebrow}</p>
      ) : null}
      <Heading
        className={cn(
          "font-serif text-4xl leading-[0.98] font-normal tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl",
          eyebrow && "mt-4",
          inverse ? "text-ivory" : "text-burgundy",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "mt-5 max-w-2xl text-base leading-8 text-pretty sm:text-lg",
            align === "center" && "mx-auto",
            inverse ? "text-ivory/70" : "text-charcoal/68",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
