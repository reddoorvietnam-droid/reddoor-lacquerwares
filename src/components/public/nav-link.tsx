"use client";

import type { ComponentProps } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { locales } from "@/lib/i18n/config";
import { cn } from "@/lib/utils/cn";

function stripLocale(pathname: string): string {
  const [, first = "", ...rest] = pathname.split("/");
  const isLocale = (locales as readonly string[]).includes(first);
  const remainder = (isLocale ? rest : [first, ...rest]).join("/");
  return `/${remainder}`.replace(/\/+$/, "") || "/";
}

/**
 * True when `href` points at the section the visitor is currently viewing.
 * Home only matches exactly; every other section also matches its sub-routes
 * (e.g. `/products/[slug]` highlights "Products").
 */
export function usePublicNavActive(href: Route): boolean {
  const pathname = usePathname();
  const current = stripLocale(pathname ?? "/");
  const target = stripLocale(String(href).split(/[?#]/)[0] ?? "/");

  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

export type PublicNavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: Route;
  activeClassName?: string;
};

export function PublicNavLink({
  href,
  className,
  activeClassName,
  children,
  ...props
}: PublicNavLinkProps) {
  const active = usePublicNavActive(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-active={active ? "" : undefined}
      className={cn(className, active && activeClassName)}
      {...props}
    >
      {children}
    </Link>
  );
}
