import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
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

/**
 * Photograph behind the closing plate: the workshop's red door. The page
 * opens inside the workshop and ends at its door, beside the address. Swap
 * the path here to change the picture; nothing else references it.
 */
const CLOSING_IMAGE = "/about-us/red_door.jpg";

/** Lacquer texture behind the dark middle movement; the process page uses the same file. */
const LACQUER_TEXTURE = "/lacquer-process/nen.jpg";

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
        Hero with full-bleed background photograph. The image path lives in one
        place ("/hinh_nen_rd.jpg") so it can be swapped later without touching
        any layout code.
      */}
      <section className="relative isolate flex h-svh max-h-[64rem] min-h-[36rem] items-center overflow-hidden">
        {/* Background photograph — swap src to change the image */}
        <Image
          src="/hinh_nen_rd1.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          aria-hidden="true"
        />
        {/*
          Gradient scrim: opaque warm ivory on the left fading to transparent
          on the right, keeping text legible over the photograph.
        */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to right, rgba(245,240,231,0.72) 0%, rgba(245,240,231,0.45) 28%, rgba(245,240,231,0.15) 45%, transparent 58%)",
          }}
        />
        <Container className="relative z-[2]">
          <div className="max-w-[54%] min-w-[22rem]">
            <MotionReveal distance={18}>
              <p className="text-[0.72rem] font-semibold tracking-[0.2em] text-[#5a3a2a] uppercase">
                {home.eyebrow}
              </p>
            </MotionReveal>
            <MotionReveal delay={0.1} distance={34} blur={10}>
              <h1 className="mt-5 font-serif text-[clamp(2.8rem,5.5vw,4.8rem)] leading-[1.05] font-normal tracking-[-0.035em] whitespace-pre-line text-[var(--lacquer-red)]">
                {home.title}
                <span className="text-gold mt-1 block translate-x-[0.08em] italic sm:mt-2">
                  {home.titleAccent}
                </span>
              </h1>
            </MotionReveal>
            <MotionReveal delay={0.2} distance={18}>
              <p className="text-charcoal/65 mt-7 max-w-[30rem] text-[0.95rem] leading-[1.75] italic">
                {home.heroDescription}
              </p>
            </MotionReveal>
            <MotionReveal delay={0.32} className="mt-8">
              <Link
                href={href("/collections")}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                {common.explore}
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </MotionReveal>
          </div>
        </Container>
        {/* Vertical brand text on the right edge */}
        <p
          className="text-burgundy/25 absolute right-5 bottom-8 z-[2] hidden rotate-180 text-[0.58rem] tracking-[0.3em] uppercase [writing-mode:vertical-rl] xl:block"
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
            <div className="relative mx-auto aspect-[1000/1250] w-full max-w-lg overflow-hidden rounded-[var(--radius-display)] lg:mx-0">
              <Image
                src="/cau_chuyen.jpg"
                alt={content.company.eyebrow}
                fill
                sizes="(min-width: 1024px) 500px, 100vw"
                className="object-cover"
              />
            </div>
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

      <section className="bg-ivory pb-20 sm:pb-28 lg:pb-36">
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

      <section className="bg-ivory pb-20 sm:pb-28 lg:pb-36">
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
        One dark movement, not two: the collections and the workshop film share
        a single section on the same lacquer texture the process page uses,
        meeting the ivory above and below with hard edges. The texture is
        pinned to the viewport so the tall section never stretches it.
      */}
      <section className="bg-burgundy text-ivory relative isolate py-20 sm:py-28 lg:py-36">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <div className="sticky top-0 h-screen w-full">
            <div className="relative h-full w-full">
              <Image
                src={LACQUER_TEXTURE}
                alt=""
                fill
                sizes="100vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
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
            {collections.map((collection, index) => {
              const hasCatalogue =
                collection.flipbook.pageCount !== null &&
                collection.flipbook.pageCount > 0;
              return (
                <MotionReveal key={collection.id} delay={index * 0.07}>
                  <Link
                    href={
                      hasCatalogue
                        ? href(`/collections/${collection.slug}/catalogue`)
                        : href("/collections")
                    }
                    className="group block focus-visible:outline-offset-8"
                  >
                    {/*
                      The same presentation as the collections page: the real
                      first page of the catalogue on a lacquer mat. The cover
                      is the object — no copy competes with it.
                    */}
                    <div className="relative mx-auto max-w-sm overflow-hidden rounded-[var(--radius-md)] shadow-[0_1rem_2.5rem_rgb(0_0_0/0.4)] transition-all duration-[var(--duration-medium)] ease-[var(--ease-brand)] group-hover:-translate-y-1.5 group-hover:shadow-[0_1.75rem_3.5rem_rgb(0_0_0/0.55)]">
                      <div className="relative aspect-3/4 overflow-hidden">
                        {collection.cover.src ? (
                          <Image
                            src={collection.cover.src}
                            alt={collection.cover.alt}
                            fill
                            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="bg-burgundy border-gold/30 flex size-full flex-col items-center justify-center gap-4 border p-6 text-center">
                            <p className="text-ivory font-serif text-2xl leading-tight">
                              {collection.title}
                            </p>
                            <p className="text-gold/80 text-xs tracking-[0.18em] uppercase">
                              {collection.editionLabel}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mx-auto mt-5 flex max-w-sm items-baseline justify-between gap-4 px-1">
                      <h3 className="text-ivory group-hover:text-gold-light font-serif text-2xl leading-tight tracking-[-0.02em] transition-colors">
                        {collection.title}
                      </h3>
                      <span className="text-gold shrink-0 text-sm font-semibold tracking-[0.08em]">
                        {collection.editionLabel}
                      </span>
                    </div>
                    {hasCatalogue ? (
                      <p className="text-ivory/45 mx-auto mt-1 max-w-sm px-1 text-xs tracking-[0.06em]">
                        {dictionary.collection.openBook}
                      </p>
                    ) : null}
                  </Link>
                </MotionReveal>
              );
            })}
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

      <section className="bg-ivory pb-20 sm:pb-28 lg:pb-36">
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
        Closing plate. The page opens on a photograph under an ivory scrim with
        the type on the left; it closes the same way, mirrored: the red door
        under a burgundy scrim, the same eyebrow / serif / gold-italic stack at
        the same measure. The ground runs out to the footer's burgundy along
        the bottom edge, so plate and footer read as one surface.
      */}
      <section className="bg-burgundy text-ivory relative isolate flex min-h-[34rem] items-center overflow-hidden py-24 sm:py-28 lg:min-h-[46rem] lg:py-36">
        <Image
          src={CLOSING_IMAGE}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-[72%_42%]"
          aria-hidden="true"
        />
        {/*
          The hero's scrim mirrored: opaque lacquer on the left thinning to a
          tint on the right, so the door and its gold sign stay in view.
        */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to right, rgb(61 13 16 / 0.97) 0%, rgb(61 13 16 / 0.92) 32%, rgb(61 13 16 / 0.6) 56%, rgb(61 13 16 / 0.28) 100%)",
          }}
        />
        {/* Below lg the type spans the photograph, so it needs a flat tint too. */}
        <div
          className="bg-burgundy/55 pointer-events-none absolute inset-0 z-[1] lg:hidden"
          aria-hidden="true"
        />
        {/* Lands on the footer's burgundy so there is no edge between the two. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(to top, var(--deep-burgundy) 0%, rgb(61 13 16 / 0) 100%)",
          }}
        />
        <Container className="relative z-[2]">
          <div className="max-w-[54%] min-w-[22rem]">
            <MotionReveal distance={18}>
              <p className="text-gold text-[0.72rem] font-semibold tracking-[0.2em] uppercase">
                {dictionary.nav.contact}
              </p>
            </MotionReveal>
            <MotionReveal delay={0.1} distance={34} blur={10}>
              <h2 className="text-ivory mt-5 font-serif text-[clamp(2.8rem,5.5vw,4.8rem)] leading-[1.05] font-normal tracking-[-0.035em]">
                {home.contactTitle}
                <span className="text-gold mt-1 block translate-x-[0.08em] italic sm:mt-2">
                  {home.contactTitleAccent}
                </span>
              </h2>
            </MotionReveal>
            <MotionReveal delay={0.2} distance={18}>
              <p className="text-ivory/70 mt-7 max-w-[30rem] text-[0.95rem] leading-[1.75] italic">
                {home.contactBody}
              </p>
            </MotionReveal>
            <MotionReveal delay={0.32} className="mt-8">
              <Link
                href={href("/contact")}
                className={buttonVariants({ variant: "gold", size: "md" })}
              >
                {common.requestQuote}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </MotionReveal>
          </div>
        </Container>
        {/* Vertical brand text on the right edge, as in the hero */}
        <p
          className="text-ivory/30 absolute right-5 bottom-8 z-[2] hidden rotate-180 text-[0.58rem] tracking-[0.3em] uppercase [writing-mode:vertical-rl] xl:block"
          aria-hidden="true"
        >
          {content.company.displayName} · {content.company.tagline}
        </p>
      </section>
    </main>
  );
}
