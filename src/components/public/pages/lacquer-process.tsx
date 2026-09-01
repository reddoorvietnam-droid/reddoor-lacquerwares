import type { PublicDictionary } from "@/lib/i18n/dictionary";

import { VideoEmbed } from "@/components/public/video-embed";
import {
  ActionLink,
  MediaFrame,
  PageFrame,
  PageHero,
  PageNotices,
  SectionHeading,
  type PublicPageLink,
  type PublicPageMedia,
  type PublicPageNotice,
} from "./shared";

export interface LacquerProcessStepView {
  detailParagraphs: readonly string[];
  id: string;
  media: PublicPageMedia;
  meta: readonly string[];
  numberLabel: string;
  summary: string;
  title: string;
}

export interface LacquerProcessVideoFeature {
  eyebrow: string;
  id: string;
  paragraphs: readonly string[];
  playLabel: string;
  title: string;
  videoId: string;
}

export interface LacquerProcessPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  closingDescription: string;
  closingEyebrow: string;
  closingLink: PublicPageLink | null;
  closingTitle: string;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  overviewDescription?: string;
  overviewEyebrow?: string;
  overviewMedia?: PublicPageMedia | null;
  overviewParagraphs?: readonly string[];
  overviewTitle?: string;
  overviewVideos?: readonly LacquerProcessVideoFeature[];
  steps: readonly LacquerProcessStepView[];
  stepsLabel: string;
}

export interface LacquerProcessPageProps {
  data: LacquerProcessPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function LacquerProcessPage({
  data,
  dictionary,
  isDemo,
  notices,
}: LacquerProcessPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.processTitle}
        intro={dictionary.pages.processIntro}
        media={data.heroMedia}
      />

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28">
        {data.overviewVideos && data.overviewVideos.length > 0 ? (
          <div className="space-y-16 lg:space-y-24">
            {data.overviewVideos.map((video, index) => (
              <div
                key={video.id}
                className={`grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-center lg:gap-16 ${
                  index % 2 === 1 ? "lg:grid-cols-[1fr_1.35fr]" : ""
                }`}
              >
                <div className={`w-full ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <VideoEmbed
                    videoId={video.videoId}
                    title={video.title}
                    playLabel={video.playLabel}
                    className="aspect-video w-full rounded-[var(--radius-lg)] shadow-[var(--shadow-lacquer)]"
                  />
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <SectionHeading
                    eyebrow={video.eyebrow}
                    title={video.title}
                    description=""
                  />
                  <div className="text-charcoal/72 mt-5 space-y-3.5 text-base leading-relaxed sm:text-lg sm:leading-8">
                    {video.paragraphs.map((paragraph, pIndex) => (
                      <p key={`video-${video.id}-p-${pIndex}`}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
            {data.overviewMedia ? (
              <MediaFrame
                media={data.overviewMedia}
                sizes="(min-width: 1024px) 44vw, 100vw"
                className="aspect-4/5"
              />
            ) : (
              <div
                className="from-burgundy via-lacquer to-gold/75 text-ivory grid aspect-4/5 place-items-center rounded-[var(--radius-lg)] bg-linear-to-br p-10 text-center shadow-[var(--shadow-lacquer)]"
                aria-hidden="true"
              >
                <span
                  className="text-ivory/25 font-serif text-7xl"
                  aria-hidden="true"
                >
                  01—∞
                </span>
              </div>
            )}
            <div>
              <SectionHeading
                eyebrow={data.overviewEyebrow ?? ""}
                title={data.overviewTitle ?? ""}
                description={data.overviewDescription ?? ""}
              />
              <div className="text-charcoal/72 mt-8 space-y-5 text-base leading-relaxed sm:text-lg sm:leading-8">
                {data.overviewParagraphs?.map((paragraph, index) => (
                  <p key={`process-overview-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-burgundy text-ivory relative isolate py-20 lg:py-28">
        <div className="lacquer-grain" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-[var(--space-page)]">
          <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase">
            {data.stepsLabel}
          </p>
          <ol className="mt-10 space-y-20 lg:space-y-32">
            {data.steps.map((step, index) => (
              <li
                key={step.id}
                id={step.id}
                className="scroll-mt-24 lg:grid lg:grid-cols-[minmax(20rem,0.92fr)_minmax(0,1.08fr)] lg:gap-16"
              >
                <div className="self-start lg:sticky lg:top-24">
                  <MediaFrame
                    media={step.media}
                    sizes="(min-width: 1024px) 42vw, 100vw"
                    className="border-ivory/12 bg-burgundy aspect-4/3"
                  />
                  <div className="text-ivory/68 mt-4 flex items-center justify-between gap-4 text-xs">
                    <span className="tracking-[0.14em] uppercase">
                      {step.numberLabel}
                    </span>
                    <span>
                      {String(index + 1).padStart(2, "0")} /{" "}
                      {String(data.steps.length).padStart(2, "0")}
                    </span>
                  </div>
                </div>

                <article className="pt-10 lg:min-h-[36rem] lg:pt-6">
                  <p className="text-gold text-xs font-bold tracking-[0.16em] uppercase">
                    {step.numberLabel}
                  </p>
                  <h2 className="mt-4 font-serif text-4xl leading-tight tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
                    {step.title}
                  </h2>
                  <p className="text-ivory/78 mt-6 max-w-2xl text-xl leading-9 text-pretty">
                    {step.summary}
                  </p>
                  <div className="text-ivory/62 mt-8 max-w-2xl space-y-5 leading-8">
                    {step.detailParagraphs.map((paragraph, paragraphIndex) => (
                      <p key={`${step.id}-detail-${paragraphIndex}`}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {step.meta.length > 0 ? (
                    <ul
                      className="mt-8 flex flex-wrap gap-2"
                      aria-label={step.title}
                    >
                      {step.meta.map((item) => (
                        <li
                          key={item}
                          className="border-gold/30 bg-gold/8 text-gold rounded-full border px-3 py-1.5 text-xs"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto flex max-w-7xl flex-col items-start gap-8 px-[var(--space-page)] py-20 lg:flex-row lg:items-end lg:justify-between lg:py-28">
        <SectionHeading
          eyebrow={data.closingEyebrow}
          title={data.closingTitle}
          description={data.closingDescription}
        />
        {data.closingLink ? (
          <div className="shrink-0">
            <ActionLink link={data.closingLink} variant="primary" />
          </div>
        ) : null}
      </section>
    </PageFrame>
  );
}
