import type { PublicDictionary } from "@/lib/i18n/dictionary";

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

export interface AboutPrincipleView {
  description: string;
  id: string;
  kicker: string;
  media: PublicPageMedia | null;
  title: string;
}

export interface HistoryMilestoneView {
  description: string;
  id: string;
  media: PublicPageMedia | null;
  periodLabel: string;
  title: string;
}

export interface AboutMediaFeatureView {
  channel: string;
  description: string;
  id: string;
  poster?: string;
  title: string;
  videoSrc: string;
}

export interface AboutHighlightView {
  id: string;
  label: string;
  value: string;
}

export interface AboutHistoryPageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  archiveNote: string | null;
  closingLink: PublicPageLink | null;
  closingText: string;
  closingTitle: string;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  highlights?: readonly AboutHighlightView[];
  historyDescription: string;
  historyEyebrow: string;
  historyTitle: string;
  mediaFeatures: readonly AboutMediaFeatureView[];
  mediaFeaturesDescription: string;
  mediaFeaturesEyebrow: string;
  mediaFeaturesTitle: string;
  milestones: readonly HistoryMilestoneView[];
  overviewParagraphs?: readonly string[];
  principles: readonly AboutPrincipleView[];
  principlesDescription: string;
  principlesEyebrow: string;
  principlesTitle: string;
}

export interface AboutHistoryPageProps {
  data: AboutHistoryPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

export function AboutHistoryPage({
  data,
  dictionary,
  isDemo,
  notices,
}: AboutHistoryPageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.aboutTitle}
        intro={dictionary.pages.aboutIntro}
        media={data.heroMedia}
      />

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28">
        <SectionHeading
          eyebrow={data.mediaFeaturesEyebrow}
          title={data.mediaFeaturesTitle}
          description={data.mediaFeaturesDescription}
        />
        <div className="mt-16 space-y-12 lg:space-y-16">
          {data.mediaFeatures.map((feature, index) => (
            <article
              key={feature.id}
              className={`border-burgundy/12 flex flex-col gap-8 rounded-[var(--radius-lg)] border bg-white/70 p-6 shadow-[var(--shadow-soft)] transition duration-[var(--duration-base)] hover:shadow-[var(--shadow-elevated)] sm:p-8 lg:items-center lg:gap-12 ${
                index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"
              }`}
            >
              <div className="bg-lacquer/95 relative aspect-video w-full overflow-hidden rounded-[var(--radius-md)] lg:w-7/12 shrink-0 shadow-md">
                <video
                  controls
                  preload="metadata"
                  aria-label={feature.title}
                  className="h-full w-full object-cover"
                  {...(feature.poster ? { poster: feature.poster } : {})}
                >
                  <source src={feature.videoSrc} type="video/mp4" />
                  Trình duyệt không hỗ trợ xem video trực tiếp.
                </video>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <div>
                  <span className="bg-burgundy/10 text-burgundy inline-block rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase">
                    {feature.channel}
                  </span>
                </div>
                <h3 className="text-burgundy mt-4 font-serif text-2xl leading-snug sm:text-3xl">
                  {feature.title}
                </h3>
                <p className="text-charcoal/75 mt-4 text-base leading-relaxed text-pretty sm:text-lg sm:leading-8">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[var(--surface-raised)] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-[var(--space-page)]">
          <SectionHeading
            eyebrow={data.principlesEyebrow}
            title={data.principlesTitle}
            description={data.principlesDescription}
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.principles.map((principle, index) => (
              <article
                key={principle.id}
                className="group border-burgundy/12 overflow-hidden rounded-[var(--radius-lg)] border bg-white/60 shadow-[var(--shadow-soft)]"
              >
                {principle.media ? (
                  <MediaFrame
                    media={principle.media}
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="aspect-4/3 rounded-none border-0"
                  />
                ) : (
                  <div className="from-burgundy to-lacquer text-ivory flex aspect-4/3 items-end bg-linear-to-br p-6">
                    <span
                      className="text-ivory/25 font-serif text-6xl"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <p className="text-gold-ink text-xs font-semibold tracking-[0.16em] uppercase">
                    {principle.kicker}
                  </p>
                  <h3 className="text-burgundy mt-3 font-serif text-2xl leading-tight">
                    {principle.title}
                  </h3>
                  <p className="text-charcoal/64 mt-4 leading-7">
                    {principle.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-[var(--space-page)] py-20 lg:py-28">
        <SectionHeading
          eyebrow={data.historyEyebrow}
          title={data.historyTitle}
          description={data.historyDescription}
        />
        {data.archiveNote ? (
          <p className="border-gold/35 bg-gold/8 text-charcoal/68 mt-8 max-w-3xl rounded-[var(--radius-md)] border px-5 py-4 text-sm leading-6">
            {data.archiveNote}
          </p>
        ) : null}

        <ol className="before:bg-gold/45 relative mt-14 space-y-4 before:absolute before:top-4 before:bottom-4 before:left-[0.95rem] before:w-px md:before:left-[11.95rem]">
          {data.milestones.map((milestone, index) => (
            <li
              key={milestone.id}
              className="relative grid gap-5 pl-14 md:grid-cols-[10rem_1fr] md:gap-12 md:pl-0"
            >
              <div className="md:text-right">
                <span className="text-gold-ink text-xs font-bold tracking-[0.14em] uppercase">
                  {milestone.periodLabel}
                </span>
              </div>
              <span
                className="bg-lacquer ring-ivory absolute top-1.5 left-[0.62rem] size-3 rounded-full ring-8 md:left-[11.62rem]"
                aria-hidden="true"
              />
              <article className="border-burgundy/12 mb-8 grid gap-6 rounded-[var(--radius-lg)] border bg-white/45 p-6 md:grid-cols-[1fr_auto] md:p-8">
                <div>
                  <p className="text-charcoal/64 text-xs font-semibold tracking-[0.12em] uppercase">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="text-burgundy mt-2 font-serif text-2xl leading-tight sm:text-3xl">
                    {milestone.title}
                  </h3>
                  <p className="text-charcoal/65 mt-4 max-w-2xl leading-7">
                    {milestone.description}
                  </p>
                </div>
                {milestone.media ? (
                  <MediaFrame
                    media={milestone.media}
                    sizes="(min-width: 768px) 240px, 100vw"
                    className="aspect-4/3 w-full md:w-60"
                  />
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-burgundy text-ivory">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-7 px-[var(--space-page)] py-16 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="font-serif text-4xl leading-tight tracking-[-0.03em] sm:text-5xl">
              {data.closingTitle}
            </h2>
            <p className="text-ivory/70 mt-5 max-w-2xl leading-8">
              {data.closingText}
            </p>
          </div>
          {data.closingLink ? (
            <ActionLink link={data.closingLink} variant="gold" />
          ) : null}
        </div>
      </section>
    </PageFrame>
  );
}
