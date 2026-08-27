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
import { ImageSlot } from "./image-slot";
import { MotionReveal } from "./motion-reveal";
import { MotionRule } from "./motion-rule";
import { ScrollParallax } from "./scroll-parallax";
import { VideoEmbed } from "./video-embed";

/**
 * Workshop film shown beside the craft quote. It is the id from the share
 * link — the part after `youtu.be/` — and is swapped here when a new cut is
 * approved. The film is one fixed piece of brand storytelling rather than
 * editable content, so it lives in the page and not in the content snapshot.
 */
const CRAFT_VIDEO_ID = "dg0B-xHWYj0";

type HomePageProps = {
  locale: Locale;
  dictionary: PublicDictionary;
  content: PublicContentSnapshot;
  products: readonly PublicProduct[];
  collections: readonly PublicCollection[];
  news: readonly PublicNewsArticle[];
};

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
      {/*
        On a phone the artwork sits behind the text rather than beside it, so
        bottom-aligning the content inside a near-full-height section left a
        large void above it. Small screens centre the content in a shorter
        section; the editorial bottom alignment returns from `lg` up, where the
        artwork occupies the right half and the space is no longer empty.
      */}
      <section className="surface-deep seam-bottom text-ivory relative isolate flex min-h-[76svh] items-center overflow-hidden pt-12 pb-14 sm:pt-16 sm:pb-20 lg:min-h-[min(86svh,50rem)] lg:items-end lg:pt-24 lg:pb-20">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-75 lg:block"
          aria-hidden="true"
        >
          <ScrollParallax distance={22} className="size-full">
            <svg viewBox="0 0 720 900" className="size-full" fill="none">
              <circle cx="470" cy="310" r="230" className="fill-gold/8" />
              <circle cx="470" cy="310" r="178" className="stroke-gold/35" />
              <path
                d="M260 900V102h420v798M302 900V158h336v742"
                className="stroke-gold/55"
                strokeWidth="2"
              />
              <path
                d="m302 158 336 742m0-742L302 900M470 158v742M302 529h336"
                className="stroke-gold/18"
              />
            </svg>
          </ScrollParallax>
        </div>
        <Container className="relative">
          <div className="max-w-5xl">
            <MotionReveal distance={18}>
              <p className="eyebrow eyebrow-inverse">{home.eyebrow}</p>
            </MotionReveal>
            {/*
              Line height is looser than a Latin-only display setting would use:
              Vietnamese stacks tone marks above already-accented vowels (ề, ố,
              ộ), and a tighter leading collides them with the line above.
            */}
            <MotionReveal delay={0.1} distance={34} blur={10}>
              <h1 className="mt-7 font-serif text-[clamp(3.15rem,9.5vw,8.5rem)] leading-[0.92] font-normal tracking-[-0.045em] text-balance">
                {home.title}
                <span className="text-gold mt-3 block translate-x-[0.18em] italic sm:mt-5">
                  {home.titleAccent}
                </span>
              </h1>
            </MotionReveal>
            <MotionReveal
              delay={0.26}
              className="border-ivory/15 mt-12 max-w-md border-t pt-8"
            >
              <Link
                href={href("/collections")}
                className={buttonVariants({ variant: "gold", size: "lg" })}
              >
                {common.explore}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </MotionReveal>
          </div>
        </Container>
        {/*
          Vertical writing mode rather than a rotation: rotating a horizontal
          box about its bottom-right corner pushed most of the line below the
          section, where `overflow-hidden` clipped all but the last word.
        */}
        <p
          className="text-ivory/35 absolute right-6 bottom-10 hidden rotate-180 text-[0.65rem] tracking-[0.28em] uppercase [writing-mode:vertical-rl] xl:block"
          aria-hidden="true"
        >
          {content.company.displayName} · {content.company.tagline}
        </p>
      </section>

      {/* Shown only while the snapshot is still stand-in copy. */}
      {content.isDemo ? (
        <section className="bg-ivory py-10">
          <Container>
            <DemoNotice common={common} />
          </Container>
        </section>
      ) : null}

      <section className="bg-ivory overflow-hidden py-20 sm:py-28 lg:py-36">
        <Container className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
          <MotionReveal>
            <ImageSlot
              width={1000}
              height={1250}
              label={content.company.eyebrow}
              assetKey="home-craft-01"
              display
              className="mx-auto max-w-lg lg:mx-0"
            />
          </MotionReveal>
          <MotionReveal delay={0.08}>
            <SectionHeading
              eyebrow={content.company.eyebrow}
              title={home.craftTitle}
              description={home.craftBody}
            />
            <p className="text-charcoal/68 mt-7 max-w-2xl leading-8">
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

      <section className="bg-ivory py-20 sm:py-28 lg:py-36">
        <Container>
          <MotionRule className="mb-16 lg:mb-24" />
          <SectionHeading
            title={home.historyTitle}
            eyebrow={dictionary.nav.about}
          />
          <div className="border-burgundy/20 mt-14 border-t lg:mt-20">
            {content.history.map((item, index) => (
              <MotionReveal
                key={item.id}
                className="border-burgundy/15 grid gap-5 border-b py-8 last:border-b-0 sm:grid-cols-[8rem_1fr] lg:grid-cols-[10rem_0.7fr_1fr] lg:items-start lg:py-10"
              >
                <p className="text-lacquer font-mono text-xs tracking-[0.18em] uppercase">
                  {item.periodLabel}
                </p>
                <h3 className="text-burgundy font-serif text-2xl leading-tight sm:text-3xl">
                  {item.title}
                </h3>
                <p className="text-charcoal/65 max-w-xl leading-7">
                  <span className="text-gold-ink mr-3 text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.summary}
                </p>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-ivory py-20 sm:py-28 lg:py-36">
        <Container>
          <MotionRule className="mb-16 lg:mb-24" />
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title={home.featuredTitle}
              eyebrow={dictionary.nav.products}
            />
            <Link
              href={href("/products")}
              className={buttonVariants({ variant: "ghost" })}
            >
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
                  <ImageSlot
                    width={1200}
                    height={1500}
                    label={product.name}
                    assetKey={`product-${product.slug}-01`}
                    display
                    className="transition-transform duration-[var(--duration-medium)] group-hover:-translate-y-1"
                  />
                  <div className="mt-6 flex items-start justify-between gap-5">
                    <div>
                      <p className="text-lacquer text-[0.65rem] tracking-[0.18em] uppercase">
                        {product.categoryLabel}
                        {product.marker ? ` · ${product.marker}` : ""}
                      </p>
                      <h3 className="text-burgundy mt-2 font-serif text-2xl">
                        {product.name}
                      </h3>
                      <p className="text-charcoal/64 mt-2 line-clamp-2 text-sm leading-6">
                        {product.summary}
                      </p>
                    </div>
                    <ArrowUpRight
                      className="text-gold mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      {/*
        One dark movement, not two. The collections and the workshop film share
        a single section: giving each its own dark section would restart the
        vertical gradient at the join and draw back the very seam this layout
        is built to remove.
      */}
      <section className="surface-deep seam-top seam-bottom text-ivory relative overflow-hidden py-20 sm:py-28 lg:py-36">
        <Container className="relative">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title={home.collectionsTitle}
              eyebrow={dictionary.nav.collections}
              inverse
            />
            <Link
              href={href("/collections")}
              className={buttonVariants({ variant: "inverse" })}
            >
              {common.viewAll}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
            {collections.map((collection, index) => (
              <MotionReveal key={collection.id} delay={index * 0.07}>
                <Link
                  href={href(`/collections/${collection.slug}`)}
                  className="group block focus-visible:outline-offset-8"
                >
                  <div className="border-gold/35 relative mx-auto aspect-[3/4] max-w-sm rounded-r-xl border-y border-r bg-[#541015] p-3 shadow-[1.5rem_2rem_4rem_rgb(0_0_0/0.28)] transition duration-[var(--duration-medium)] group-hover:-translate-y-1 group-hover:rotate-[0.5deg] before:absolute before:inset-y-0 before:left-0 before:w-4 before:bg-gradient-to-r before:from-black/45 before:to-transparent">
                    <div className="border-gold/30 flex size-full flex-col justify-between border p-7 text-center">
                      <p className="text-gold text-[0.62rem] tracking-[0.25em] uppercase">
                        {content.company.displayName}
                        {collection.marker ? ` · ${collection.marker}` : ""}
                      </p>
                      <div>
                        <p className="text-ivory font-serif text-3xl leading-none">
                          {collection.title}
                        </p>
                        <div
                          className="border-gold/45 mx-auto my-5 size-12 rotate-45 border"
                          aria-hidden="true"
                        />
                        <p className="text-ivory/55 text-xs tracking-[0.18em] uppercase">
                          {collection.editionLabel}
                        </p>
                      </div>
                      <p className="text-gold/80 text-xs">
                        {collection.year ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="text-ivory/60 mx-auto mt-6 max-w-sm text-sm leading-7">
                    {collection.summary}
                  </p>
                </Link>
              </MotionReveal>
            ))}
          </div>
        </Container>

        {/*
          The film runs the full width of the wide container. A 16:9 frame
          parked in a half column reads as a thumbnail; this is the only moving
          image on the page and it should carry the weight of the movement it
          closes.
        */}
        <Container size="wide" className="relative">
          <MotionRule inverse className="mt-20 lg:mt-28" />
          <div className="mt-14 flex flex-col gap-6 lg:mt-20 lg:flex-row lg:items-end lg:justify-between">
            <MotionReveal className="max-w-3xl">
              <p className="eyebrow eyebrow-inverse">{home.eyebrow}</p>
              <blockquote className="mt-6 font-serif text-[clamp(1.9rem,3.5vw,3.3rem)] leading-[1.06] tracking-[-0.04em] text-balance">
                “{home.craftBody}”
              </blockquote>
            </MotionReveal>
            <MotionReveal delay={0.08}>
              <p className="text-ivory/50 text-[0.68rem] tracking-[0.22em] uppercase lg:text-right">
                {home.craftTitle}
              </p>
            </MotionReveal>
          </div>
          <MotionReveal delay={0.14} className="mt-12 lg:mt-16">
            <ScrollParallax distance={16}>
              <VideoEmbed
                videoId={CRAFT_VIDEO_ID}
                title={home.craftTitle}
                playLabel={common.playVideo}
              />
            </ScrollParallax>
          </MotionReveal>
        </Container>
      </section>

      <section className="bg-ivory py-20 sm:py-28 lg:py-36">
        <Container>
          <MotionRule className="mb-16 lg:mb-24" />
          <SectionHeading
            title={home.processTitle}
            eyebrow={dictionary.nav.process}
            description={dictionary.pages.processIntro}
          />
          <ol className="border-burgundy/12 bg-burgundy/12 mt-14 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border lg:mt-20 lg:grid-cols-3">
            {content.process.slice(0, 3).map((stage, index) => (
              <li
                key={stage.id}
                className="bg-[var(--surface-raised)] p-7 sm:p-9"
              >
                <MotionReveal delay={index * 0.09} distance={20}>
                  <div className="flex items-center justify-between">
                    <span className="text-gold-ink font-serif text-4xl">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-lacquer text-[0.62rem] tracking-[0.2em] uppercase">
                      {stage.stepLabel}
                    </span>
                  </div>
                  <h3 className="text-burgundy mt-12 font-serif text-2xl">
                    {stage.title}
                  </h3>
                  <p className="text-charcoal/62 mt-4 text-sm leading-7">
                    {stage.summary}
                  </p>
                </MotionReveal>
              </li>
            ))}
          </ol>
          <Link
            href={href("/process")}
            className={`${buttonVariants({ variant: "outline" })} mt-10`}
          >
            {common.learnMore}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Container>
      </section>

      <section className="bg-ivory py-20 sm:py-28 lg:py-36">
        <Container>
          <MotionRule className="mb-16 lg:mb-24" />
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              title={home.newsTitle}
              eyebrow={dictionary.nav.news}
            />
            <Link
              href={href("/news")}
              className={buttonVariants({ variant: "ghost" })}
            >
              {common.viewAll}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="divide-burgundy/15 border-burgundy/15 mt-14 divide-y border-y lg:mt-20">
            {news.map((article, index) => (
              <MotionReveal key={article.id} delay={index * 0.05} distance={18}>
                <Link
                  href={href(`/news/${article.slug}`)}
                  className="group grid gap-5 py-8 focus-visible:outline-offset-4 sm:grid-cols-[7rem_1fr_auto] sm:items-center lg:py-10"
                >
                  <p className="text-lacquer font-mono text-xs tracking-[0.16em] uppercase">
                    {article.categoryLabel}
                  </p>
                  <div>
                    <h3 className="text-burgundy group-hover:text-lacquer font-serif text-2xl transition-colors sm:text-3xl">
                      {article.title}
                    </h3>
                    <p className="text-charcoal/64 mt-2 line-clamp-1 text-sm">
                      {article.excerpt}
                    </p>
                  </div>
                  <span className="text-charcoal/64 flex items-center gap-3 text-xs">
                    {String(index + 1).padStart(2, "0")}
                    <ArrowUpRight
                      aria-hidden="true"
                      className="text-gold size-4"
                    />
                  </span>
                </Link>
              </MotionReveal>
            ))}
          </div>
        </Container>
      </section>

      {/*
        The page used to end on a flat bright red wedged between an ivory
        section and the burgundy footer, which is the hardest colour jump on
        the site. Same heat, but thrown up into the lacquer ground as light, so
        the closing section and the footer read as one piece.
      */}
      <section className="surface-deep surface-deep-warm seam-top text-ivory py-24 sm:py-32 lg:py-40">
        <Container className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <MotionReveal className="max-w-4xl">
            <p className="eyebrow eyebrow-inverse">{dictionary.nav.contact}</p>
            <h2 className="mt-6 font-serif text-[clamp(2.5rem,6.2vw,5.5rem)] leading-[0.98] tracking-[-0.045em] text-balance">
              {home.contactTitle}
            </h2>
            <p className="text-ivory/72 mt-7 max-w-2xl text-base leading-8 sm:text-lg">
              {home.contactBody}
            </p>
          </MotionReveal>
          <Link
            href={href("/contact")}
            className={buttonVariants({ variant: "gold", size: "lg" })}
          >
            {common.requestQuote}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </Container>
      </section>
    </main>
  );
}
