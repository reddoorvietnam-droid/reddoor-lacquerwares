import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-transparent px-5 text-sm font-semibold tracking-[0.01em] transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-brand)] motion-safe:hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "bg-lacquer text-ivory shadow-[0_0.75rem_2rem_rgb(61_13_16/0.18)] hover:bg-burgundy",
        gold: "bg-gold text-burgundy hover:bg-[#d2b46c]",
        outline:
          "border-burgundy/25 bg-transparent text-burgundy hover:border-burgundy/45 hover:bg-burgundy/5",
        inverse:
          "border-ivory/25 bg-ivory/8 text-ivory hover:border-gold/60 hover:bg-ivory/14",
        ghost:
          "bg-transparent text-current hover:bg-current/[0.07] hover:shadow-none",
      },
      size: {
        sm: "min-h-9 px-4 text-xs",
        md: "min-h-11 px-5 text-sm",
        lg: "min-h-12 px-7 text-sm",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof buttonVariants>;

export function Button({
  ref,
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      type={type}
      {...props}
    />
  );
}
