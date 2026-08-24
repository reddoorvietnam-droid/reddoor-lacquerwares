import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] leading-none font-semibold tracking-[0.12em] uppercase",
  {
    variants: {
      variant: {
        lacquer: "border-lacquer/20 bg-lacquer/8 text-lacquer",
        gold: "border-gold/35 bg-gold/12 text-burgundy",
        neutral: "border-charcoal/15 bg-charcoal/5 text-charcoal/70",
        inverse: "border-ivory/20 bg-ivory/8 text-ivory",
      },
    },
    defaultVariants: {
      variant: "lacquer",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
