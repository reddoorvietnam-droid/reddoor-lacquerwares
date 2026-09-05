"use client";

import type { PublicDictionary } from "@/lib/i18n/dictionary";

import {
  QuoteRequestForm,
  type QuoteRequestFormPayload,
  type QuoteRequestProductOption,
  type QuoteRequestSubmitResult,
} from "./quote-request-form";
import {
  PageFrame,
  PageHero,
  PageNotices,
  SectionHeading,
  type PublicPageLink,
  type PublicPageMedia,
  type PublicPageNotice,
} from "./shared";

export interface ContactPointView {
  href: string | null;
  id: string;
  label: string;
  note: string | null;
  value: string;
}

export interface ContactMapView {
  embedUrl: string | null;
  /** Opens the place in Google Maps, where directions are available. */
  placeUrl: string | null;
  placeLinkLabel: string;
  title: string;
  unavailableDescription: string;
}

export interface ContactRequestQuotePageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  consentDescription: string;
  consentLink: PublicPageLink | null;
  contactDescription: string;
  contactEyebrow: string;
  contactPoints: readonly ContactPointView[];
  contactTitle: string;
  formDescription: string;
  formEyebrow: string;
  formTitle: string;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  locale: string;
  map: ContactMapView;
  /** Catalogue pieces the visitor can pick in the form. */
  productOptions: readonly QuoteRequestProductOption[];
}

export interface ContactRequestQuotePageProps {
  data: ContactRequestQuotePageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
  /** Product ids to start with selected, from `?product=` on the URL. */
  preselectedProductIds?: readonly string[];
  submitQuoteRequest: (
    input: QuoteRequestFormPayload,
  ) => Promise<QuoteRequestSubmitResult>;
}

/**
 * The map is embedded straight away: the customer asked for it to be visible
 * without a click, accepting the third-party request on page load.
 */
function ContactMapPreview({ map }: { map: ContactMapView }) {
  return (
    <section
      className="border-burgundy/12 bg-burgundy/3 mt-8 overflow-hidden rounded-[var(--radius-lg)] border"
      aria-labelledby="contact-map-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <h3
          id="contact-map-title"
          className="text-burgundy font-serif text-2xl"
        >
          {map.title}
        </h3>
        {map.placeUrl ? (
          <a
            href={map.placeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="border-burgundy/25 text-burgundy hover:border-gold hover:text-lacquer inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
          >
            {map.placeLinkLabel}
          </a>
        ) : null}
      </div>
      {map.embedUrl ? (
        <iframe
          src={map.embedUrl}
          title={map.title}
          loading="lazy"
          className="border-burgundy/12 h-80 w-full border-t sm:h-96"
          referrerPolicy="no-referrer"
        />
      ) : (
        <p
          className="border-burgundy/12 bg-ivory text-charcoal/68 border-t px-6 py-5 text-sm leading-6"
          role="status"
        >
          {map.unavailableDescription}
        </p>
      )}
    </section>
  );
}

export function ContactRequestQuotePage({
  data,
  dictionary,
  isDemo,
  notices,
  preselectedProductIds = [],
  submitQuoteRequest,
}: ContactRequestQuotePageProps) {
  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero
        eyebrow={data.heroEyebrow}
        title={dictionary.pages.contactTitle}
        intro={dictionary.pages.contactIntro}
        media={data.heroMedia}
      />

      <section
        id="request-quote"
        className="mx-auto grid max-w-7xl scroll-mt-24 gap-12 px-[var(--space-page)] py-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:py-28"
      >
        <aside className="self-start lg:sticky lg:top-24">
          <SectionHeading
            eyebrow={data.contactEyebrow}
            title={data.contactTitle}
            description={data.contactDescription}
          />
          {data.contactPoints.length > 0 ? (
            <dl className="border-burgundy/12 divide-burgundy/10 mt-9 divide-y border-y">
              {data.contactPoints.map((point) => (
                <div key={point.id} className="py-5">
                  <dt className="text-charcoal/64 text-xs font-semibold tracking-[0.12em] uppercase">
                    {point.label}
                  </dt>
                  <dd className="text-burgundy mt-2 text-base font-semibold break-words">
                    {point.href ? (
                      <a href={point.href} className="hover:text-lacquer">
                        {point.value}
                      </a>
                    ) : (
                      point.value
                    )}
                  </dd>
                  {point.note ? (
                    <dd className="text-charcoal/64 mt-1 text-sm leading-6">
                      {point.note}
                    </dd>
                  ) : null}
                </div>
              ))}
            </dl>
          ) : null}
          <ContactMapPreview map={data.map} />
        </aside>

        <div className="border-burgundy/12 rounded-[var(--radius-display)] border bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-soft)] sm:p-9 lg:p-12">
          <SectionHeading
            eyebrow={data.formEyebrow}
            title={data.formTitle}
            description={data.formDescription}
          />
          <QuoteRequestForm
            dictionary={dictionary}
            locale={data.locale}
            products={data.productOptions}
            preselectedProductIds={preselectedProductIds}
            consentDescription={data.consentDescription}
            consentLink={data.consentLink}
            submit={submitQuoteRequest}
          />
        </div>
      </section>
    </PageFrame>
  );
}
