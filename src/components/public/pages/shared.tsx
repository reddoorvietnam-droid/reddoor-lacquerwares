import Image from "next/image";
import type { ReactNode } from "react";

import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils/cn";

export interface PublicPageMedia {
  id: string;
  src: string | null;
  alt: string;
  width: number;
  height: number;
  objectPosition?: string;
  caption?: string;
}

export interface PublicPageLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface PublicPageNotice {
  id: string;
  label: string;
  message: string;
  tone: "setup" | "warning";
}

export interface PublicPagePagination {
  currentLabel: string;
  previous: PublicPageLink | null;
  next: PublicPageLink | null;
}

export type PublicContentBlock =
  | {
      id: string;
      type: "paragraph";
      text: string;
    }
  | {
      id: string;
      type: "heading";
      text: string;
      level: 2 | 3;
    }
  | {
      id: string;
      type: "list";
      style: "ordered" | "unordered";
      items: readonly string[];
    }
  | {
      attribution: string | null;
      id: string;
      type: "quote";
      text: string;
    }
  | {
      caption: string | null;
      id: string;
      media: PublicPageMedia;
      type: "media";
    };

interface PageFrameProps {
  children: ReactNode;
  className?: string;
}

export function PageFrame({ children, className }: PageFrameProps) {
  return (
    <main
      className={cn(
        "bg-ivory text-charcoal min-h-screen overflow-clip",
        className,
      )}
    >
      {children}
    </main>
  );
}

interface PageNoticesProps {
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices: readonly PublicPageNotice[] | undefined;
}

export function PageNotices({ dictionary, isDemo, notices }: PageNoticesProps) {
  if (!isDemo && (!notices || notices.length === 0)) {
    return null;
  }

  return (
    <div
      className="mx-auto grid w-full max-w-7xl gap-3 px-[var(--space-page)] pt-5"
      aria-label={isDemo ? dictionary.common.demoLabel : notices?.[0]?.label}
    >
      {isDemo ? (
        <aside className="border-gold/35 bg-gold/10 text-burgundy flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-6">
          <span className="bg-gold text-burgundy mt-0.5 rounded-full px-2 py-0.5 text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            {dictionary.common.demoLabel}
          </span>
          <p>{dictionary.common.replaceContentNotice}</p>
        </aside>
      ) : null}

      {notices?.map((notice) => (
        <aside
          key={notice.id}
          className={cn(
            "flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm leading-6",
            notice.tone === "warning"
              ? "border-lacquer/30 bg-lacquer/8 text-burgundy"
              : "border-charcoal/15 text-charcoal/75 bg-white/55",
          )}
        >
          <span className="mt-0.5 rounded-full border border-current/25 px-2 py-0.5 text-[0.68rem] font-bold tracking-[0.14em] uppercase">
            {notice.label}
          </span>
          <p>{notice.message}</p>
        </aside>
      ))}
    </div>
  );
}

interface PageHeroProps {
  actions?: readonly PublicPageLink[];
  eyebrow: string;
  intro: string;
  media?: PublicPageMedia | null;
  title: string;
}

export function PageHero({
  actions,
  eyebrow,
  intro,
  media,
  title,
}: PageHeroProps) {
  return (
    <header className="text-ivory relative isolate mx-auto mt-5 w-[calc(100%-2rem)] max-w-[96rem] overflow-hidden rounded-[var(--radius-display)] bg-[var(--surface-inverse)] shadow-[var(--shadow-lacquer)] sm:w-[calc(100%-3rem)]">
      <div className="lacquer-grain" aria-hidden="true" />
      {media ? (
        <div className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_right,transparent_10%,black_75%)] opacity-30">
          <MediaFrame
            className="h-full rounded-none border-0"
            media={media}
            sizes="100vw"
          />
        </div>
      ) : null}
      <div className="relative px-[var(--space-page)] py-20 sm:py-24 lg:py-32">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-5 max-w-5xl font-serif text-5xl leading-[0.94] font-normal tracking-[-0.045em] text-balance sm:text-7xl lg:text-8xl">
          {title}
        </h1>
        <p className="text-ivory/72 mt-7 max-w-2xl text-base leading-8 text-pretty sm:text-lg">
          {intro}
        </p>
        {actions && actions.length > 0 ? (
          <div className="mt-9 flex flex-wrap gap-3">
            {actions.map((action, index) => (
              <ActionLink
                key={`${action.href}-${action.label}`}
                link={action}
                variant={index === 0 ? "gold" : "inverse"}
              />
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

interface MediaFrameProps {
  className?: string;
  media: PublicPageMedia;
  sizes: string;
}

export function MediaFrame({ className, media, sizes }: MediaFrameProps) {
  return (
    <figure
      className={cn(
        "bg-burgundy/8 border-burgundy/12 relative isolate overflow-hidden rounded-[var(--radius-lg)] border",
        className,
      )}
    >
      {media.src ? (
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          sizes={sizes}
          className="h-full w-full object-cover transition duration-[var(--duration-slow)] ease-[var(--ease-brand)] motion-safe:group-hover:scale-[1.025]"
          {...(media.objectPosition
            ? { style: { objectPosition: media.objectPosition } }
            : {})}
        />
      ) : (
        <div
          className="from-burgundy via-lacquer to-gold/80 grid h-full min-h-56 w-full place-items-center bg-linear-to-br p-8"
          role="img"
          aria-label={media.alt}
        >
          <span className="border-ivory/30 text-ivory/85 rounded-full border px-4 py-2 text-xs tracking-[0.18em] uppercase">
            {media.alt}
          </span>
        </div>
      )}
      {media.caption ? (
        <figcaption className="bg-burgundy/90 text-ivory/80 absolute inset-x-0 bottom-0 px-4 py-3 text-xs leading-5 backdrop-blur-sm">
          {media.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

interface SectionHeadingProps {
  align?: "left" | "center";
  description: string | null;
  eyebrow: string;
  title: string;
}

export function SectionHeading({
  align = "left",
  description,
  eyebrow,
  title,
}: SectionHeadingProps) {
  return (
    <div
      className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="text-burgundy mt-4 font-serif text-4xl leading-tight tracking-[-0.035em] text-balance sm:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="text-charcoal/66 mt-5 text-base leading-8 text-pretty sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}

interface ActionLinkProps {
  link: PublicPageLink;
  variant?: "primary" | "quiet" | "gold" | "inverse";
}

export function ActionLink({ link, variant = "primary" }: ActionLinkProps) {
  return (
    <a
      href={link.href}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition duration-[var(--duration-fast)] ease-[var(--ease-brand)]",
        variant === "primary" &&
          "border-lacquer bg-lacquer hover:bg-burgundy text-white",
        variant === "quiet" &&
          "border-burgundy/18 hover:border-burgundy/35 text-burgundy hover:bg-white/70",
        variant === "gold" &&
          "border-gold bg-gold text-burgundy hover:bg-ivory hover:border-ivory",
        variant === "inverse" &&
          "border-ivory/30 text-ivory hover:border-ivory hover:bg-ivory/10",
      )}
      {...(link.external
        ? { rel: "noreferrer", target: "_blank" as const }
        : {})}
    >
      <span>{link.label}</span>
      <span aria-hidden="true">{link.external ? "↗" : "→"}</span>
    </a>
  );
}

interface RichContentProps {
  blocks: readonly PublicContentBlock[];
}

export function RichContent({ blocks }: RichContentProps) {
  return (
    <div className="text-charcoal/78 space-y-7 text-base leading-8 sm:text-lg">
      {blocks.map((block) => {
        if (block.type === "paragraph") {
          return <p key={block.id}>{block.text}</p>;
        }

        if (block.type === "heading") {
          return block.level === 2 ? (
            <h2
              key={block.id}
              id={block.id}
              className="text-burgundy scroll-mt-28 pt-5 font-serif text-3xl leading-tight tracking-[-0.025em] sm:text-4xl"
            >
              {block.text}
            </h2>
          ) : (
            <h3
              key={block.id}
              id={block.id}
              className="text-burgundy scroll-mt-28 pt-3 font-serif text-2xl leading-tight"
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === "list") {
          const listClass =
            "marker:text-gold space-y-3 pl-6 marker:font-semibold";
          return block.style === "ordered" ? (
            <ol key={block.id} className={cn(listClass, "list-decimal")}>
              {block.items.map((item, index) => (
                <li key={`${block.id}-${index}`}>{item}</li>
              ))}
            </ol>
          ) : (
            <ul key={block.id} className={cn(listClass, "list-disc")}>
              {block.items.map((item, index) => (
                <li key={`${block.id}-${index}`}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={block.id}
              className="border-gold text-burgundy my-10 border-l-2 py-2 pl-6 font-serif text-2xl leading-relaxed sm:pl-9 sm:text-3xl"
            >
              <p>{block.text}</p>
              {block.attribution ? (
                <cite className="text-charcoal/55 mt-4 block font-sans text-xs tracking-[0.14em] uppercase not-italic">
                  {block.attribution}
                </cite>
              ) : null}
            </blockquote>
          );
        }

        return (
          <MediaFrame
            key={block.id}
            media={block.media}
            sizes="(min-width: 1024px) 760px, 100vw"
          />
        );
      })}
    </div>
  );
}

interface PaginationNavProps {
  dictionary: PublicDictionary;
  pagination: PublicPagePagination | null;
}

export function PaginationNav({ dictionary, pagination }: PaginationNavProps) {
  if (!pagination) {
    return null;
  }

  return (
    <nav
      className="border-burgundy/12 mt-12 flex items-center justify-between border-t pt-6"
      aria-label={pagination.currentLabel}
    >
      {pagination.previous ? (
        <a
          href={pagination.previous.href}
          className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold"
        >
          <span aria-hidden="true">←</span>
          {dictionary.common.previous}
        </a>
      ) : (
        <span />
      )}
      <span className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
        {pagination.currentLabel}
      </span>
      {pagination.next ? (
        <a
          href={pagination.next.href}
          className="text-burgundy hover:text-lacquer inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold"
        >
          {dictionary.common.next}
          <span aria-hidden="true">→</span>
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
