import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import type { PublicCollection } from "@/domains/collections/public-contract";
import type { PublicContentSnapshot } from "@/domains/content/public-contract";
import type { PublicNewsArticle } from "@/domains/news/public-contract";
import type { PublicProduct } from "@/domains/products/public-contract";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { PublicDictionary } from "@/lib/i18n/dictionary";

import { buttonVariants, Container, SectionHeading } from "../ui";
import { DemoNotice } from "./demo-notice";
import { LacquerArt, type LacquerArtVariant } from "./lacquer-art";
import { MotionReveal } from "./motion-reveal";

type HomePageProps = {
  locale: Locale;
  dictionary: PublicDictionary;
  content: PublicContentSnapshot;
  products: readonly PublicProduct[];
  collections: readonly PublicCollection[];
  news: readonly PublicNewsArticle[];
};

const artVariants: readonly LacquerArtVariant[] = ["portal", "moon", "layers"];

function artVariant(index: number): LacquerArtVariant {
  return artVariants[index % artVariants.length] ?? "portal";
}

export function HomePage({
  locale,
  dictionary,
  content,
  products,
  collections,
  news,
}: HomePageProps) {
  const { common, home } = dictionary;
  const href = (path = "") => localePath(locale, path) as Route;

  return (
    <main id="main-content">
      <section className="relative isolate flex min-h-[92svh] items-end overflow-hidden bg-burgundy pb-16 pt-36 text-ivory sm:pb-20 lg:min-h-[min(94svh,60rem)] lg:pb-24">
        <div className="lacquer-grain" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-75 lg:block"
          aria-hidden="true"
        >
          <svg viewBox="0 0 720 900" className="size-full" fill="none">
            <circle cx="470" cy="310" r="230" className="fill-gold/8" />
            <circle cx="470" cy="310" r="178" className="stroke-gold/35" />
            <path d="M260 900V102h420v798M302 900V158h336v742" className="stroke-gold/55" strokeWidth="2" />
            <path d="m302 158 336 742m0-742L302 900M470 158v742M302 529h336" className="stroke-gold/18" />
          </svg>
        </div>
        <Container className="relative">
          <div className="max-w-5xl">
            <p className="eyebrow">{home.eyebrow}</p>
            <h1 className="mt-7 font-serif text-[clamp(4.2rem,13vw,10.5rem)] leading-[0.78] font-normal tracking-[-0.065em] text-balance">
              {home.title}
              <span className="mt-3 block translate-x-[0.18em] text-gold italic sm:mt-5">
                {home.titleAccent}
              </span>
            </h1>
            <div className="mt-10 flex max-w-3xl flex-col gap-7 border-t border-ivory/15 pt-7 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-xl text-base leading-8 text-ivory/72 sm:text-lg">
                {home.intro}
              </p>
              <Link
                href={href("/collections")}
                className={buttonVariants({ variant: "gold", size: "lg" })}
              >
                {common.explore}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </div>
        </Container>
        <p className="absolute right-[var(--space-page)] bottom-8 hidden origin-bottom-right -rotate-90 text-[0.65rem] tracking-[0.28em] text-ivory/35 uppercase xl:block">
          {content.company.displayName} · {content.company.tagline}
        </p>
      </section>

      <section className="bg-ivory py-10">
        <Container>
          <DemoNotice common={common} />
        </Container>
      </section>

      <section className="overflow-hidden bg-ivory py-20 sm:py-28 lg:py-36">
        <Container className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <MotionReveal>
            <LacquerArt variant="moon" className="mx-auto max-w-lg lg:mx-0" />
          </MotionReveal>
          <MotionReveal delay={0.08}>
            <SectionHeading
              eyebrow={content.company.eyebrow}
              title={home.craftTitle}
              description={home.craftBody}
            />
            <p className="mt-7 max-w-2xl leading-8 text-charcoal/68">
              {content.company.summary}
            </p>
            <Link
              href={href("/about")}
              className={`${buttonVariants({ variant: "outline", size: "lg" })} mt-9`}
            >
              {common.readStory}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </MotionReveal>
        </Container>
      </section>

      <section className="bg-[#eadfce] py-20 sm:py-28 lg:py-36">
        <Container>
          <SectionHeading title={home.historyTitle} eyebrow={dictionary.nav.about} />
          <div className="mt-14 border-t border-burgundy/20 lg:mt-20">
            {content.history.map((item, index) => (
              <MotionReveal
                key={item.id}
                className="grid gap-5 border-b border-burgundy/15 py-8 last:border-b-0 sm:grid-cols-[8rem_1fr] lg:grid-cols-[10rem_0.7fr_1fr] lg:items-start lg:py-10"
              >
                <p className="font-mono text-xs tracking-[0.18em] text-lacquer uppercase">
                  {item.periodLabel}
                </p>
                <h3 className="font-serif text-2xl leading-tight text-burgundy sm:text-3xl">
                  {item.title}
                </h3>
                <p className="max-w-xl leading-7 text-charcoal/65">
                  <span className="mr-3 text-xs text-gold">{String(index + 1).padStart(2, "0")}</span>
                  {item.summary}
                </p>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-ivory py-20 sm:py-28 lg:py-36">
        <Container>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading title={home.featuredTitle} eyebrow={dictionary.nav.products} />
            <Link href={href("/products")} className={buttonVariants({ variant: "ghost" })}>
              {common.viewAll}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
            {products.map((product, index) => (
              <MotionReveal key={product.id} delay={index * 0.06}>
                <Link
                  href={href(`/products/${product.slug}`)}
                  className="group block rounded-[var(--radius-lg)] focus-visible:outline-offset-8"
                >
                  <LacquerArt
                    variant={artVariant(index)}
                    className="transition-transform duration-[var(--duration-medium)] group-hover:-translate-y-1"
                  />
                  <div className="mt-6 flex items-start justify-between gap-5">
                    <div>
                      <p className="text-[0.65rem] tracking-[0.18em] text-lacquer uppercase">
                        {product.categoryLabel} · {product.marker}
                      </p>
                      <h3 className="mt-2 font-serif text-2xl text-burgundy">
                        {product.name}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-charcoal/60">
                        {product.summary}
                      </p>
                    </div>
                    <ArrowUpRight className="mt-1 size-5 shrink-0 text-gold transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </div>
                </Link>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="relative overflow-hidden bg-burgundy py-20 text-ivory sm:py-28 lg:py-36">
        <div className="lacquer-grain" aria-hidden="true" />
        <Container className="relative">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading title={home.collectionsTitle} eyebrow={dictionary.nav.collections} inverse />
            <Link href={href("/collections")} className={buttonVariants({ variant: "inverse" })}>
              {common.viewAll}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
            {collections.map((collection, index) => (
              <MotionReveal key={collection.id} delay={index * 0.07}>
                <Link href={href(`/collections/${collection.slug}`)} className="group block focus-visible:outline-offset-8">
                  <div className="relative mx-auto aspect-[3/4] max-w-sm rounded-r-xl border-y border-r border-gold/35 bg-[#541015] p-3 shadow-[1.5rem_2rem_4rem_rgb(0_0_0/0.28)] transition duration-[var(--duration-medium)] group-hover:-translate-y-1 group-hover:rotate-[0.5deg] before:absolute before:inset-y-0 before:left-0 before:w-4 before:bg-gradient-to-r before:from-black/45 before:to-transparent">
                    <div className="flex size-full flex-col justify-between border border-gold/30 p-7 text-center">
                      <p className="text-[0.62rem] tracking-[0.25em] text-gold uppercase">{content.company.displayName} · {collection.marker}</p>
                      <div>
                        <p className="font-serif text-3xl leading-none text-ivory">{collection.title}</p>
                        <div className="mx-auto my-5 size-12 rotate-45 border border-gold/45" aria-hidden="true" />
                        <p className="text-xs tracking-[0.18em] text-ivory/55 uppercase">{collection.editionLabel}</p>
                      </div>
                      <p className="text-xs text-gold/80">{collection.year ?? "—"}</p>
                    </div>
                  </div>
                  <p className="mx-auto mt-6 max-w-sm text-sm leading-7 text-ivory/60">{collection.summary}</p>
                </Link>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-[var(--surface-raised)] py-20 sm:py-28 lg:py-36">
        <Container>
          <SectionHeading title={home.processTitle} eyebrow={dictionary.nav.process} description={dictionary.pages.processIntro} />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-burgundy/12 bg-burgundy/12 lg:mt-20 lg:grid-cols-3">
            {content.process.slice(0, 3).map((stage, index) => (
              <li key={stage.id} className="bg-[var(--surface-raised)] p-7 sm:p-9">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-4xl text-gold/70">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-[0.62rem] tracking-[0.2em] text-lacquer uppercase">{stage.stepLabel}</span>
                </div>
                <h3 className="mt-12 font-serif text-2xl text-burgundy">{stage.title}</h3>
                <p className="mt-4 text-sm leading-7 text-charcoal/62">{stage.summary}</p>
              </li>
            ))}
          </ol>
          <Link href={href("/process")} className={`${buttonVariants({ variant: "outline" })} mt-10`}>
            {common.learnMore}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Container>
      </section>

      <section className="bg-charcoal py-20 text-ivory sm:py-28 lg:py-36">
        <Container className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-24">
          <MotionReveal>
            <p className="eyebrow">{home.eyebrow}</p>
            <blockquote className="mt-7 font-serif text-[clamp(2.7rem,6vw,5.7rem)] leading-[0.95] tracking-[-0.045em] text-balance">
              “{home.craftBody}”
            </blockquote>
          </MotionReveal>
          <MotionReveal delay={0.08}>
            <LacquerArt variant="layers" className="mx-auto max-w-md" />
          </MotionReveal>
        </Container>
      </section>

      <section className="bg-ivory py-20 sm:py-28 lg:py-36">
        <Container>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading title={home.newsTitle} eyebrow={dictionary.nav.news} />
            <Link href={href("/news")} className={buttonVariants({ variant: "ghost" })}>
              {common.viewAll}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-14 divide-y divide-burgundy/15 border-y border-burgundy/15 lg:mt-20">
            {news.map((article, index) => (
              <Link key={article.id} href={href(`/news/${article.slug}`)} className="group grid gap-5 py-8 focus-visible:outline-offset-4 sm:grid-cols-[7rem_1fr_auto] sm:items-center lg:py-10">
                <p className="font-mono text-xs tracking-[0.16em] text-lacquer uppercase">{article.categoryLabel}</p>
                <div>
                  <h3 className="font-serif text-2xl text-burgundy transition-colors group-hover:text-lacquer sm:text-3xl">{article.title}</h3>
                  <p className="mt-2 line-clamp-1 text-sm text-charcoal/58">{article.excerpt}</p>
                </div>
                <span className="flex items-center gap-3 text-xs text-charcoal/45">
                  {String(index + 1).padStart(2, "0")}
                  <ArrowUpRight aria-hidden="true" className="size-4 text-gold" />
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-lacquer py-20 text-ivory sm:py-28">
        <Container className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="eyebrow text-gold">{dictionary.nav.contact}</p>
            <h2 className="mt-6 font-serif text-[clamp(3.1rem,8vw,7rem)] leading-[0.88] tracking-[-0.05em] text-balance">{home.contactTitle}</h2>
            <p className="mt-7 max-w-2xl text-base leading-8 text-ivory/72 sm:text-lg">{home.contactBody}</p>
          </div>
          <Link href={href("/contact")} className={buttonVariants({ variant: "gold", size: "lg" })}>
            {common.requestQuote}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </Container>
      </section>
    </main>
  );
}
