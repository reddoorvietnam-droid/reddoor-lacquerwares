import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type ContainerSize = "standard" | "wide" | "narrow";

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  size?: ContainerSize;
};

const sizeClasses: Record<ContainerSize, string> = {
  standard: "max-w-7xl",
  wide: "max-w-[100rem]",
  narrow: "max-w-4xl",
};

export function Container({
  className,
  size = "standard",
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-[var(--space-page)]",
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
