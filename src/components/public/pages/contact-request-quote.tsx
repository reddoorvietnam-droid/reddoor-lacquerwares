"use client";

import { useState, type FormEvent } from "react";

import type { PublicDictionary } from "@/lib/i18n/dictionary";

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

export interface QuoteFormOptionView {
  label: string;
  value: string;
}

export interface ContactMapView {
  description: string;
  embedUrl: string | null;
  /** Opens the place in Google Maps, where directions are available. */
  placeUrl: string | null;
  placeLinkLabel: string;
  loadLabel: string;
  title: string;
  unavailableDescription: string;
}

export interface ContactRequestQuotePageData {
  /** True while the records behind this page are still placeholders. */
  contentIsDemo: boolean;
  acceptedAttachmentTypes: string;
  attachmentHelp: string;
  consentDescription: string;
  consentLink: PublicPageLink | null;
  contactDescription: string;
  contactEyebrow: string;
  contactPoints: readonly ContactPointView[];
  contactTitle: string;
  countryOptions: readonly QuoteFormOptionView[];
  deadlineHelp: string;
  formDescription: string;
  formEyebrow: string;
  formTitle: string;
  heroEyebrow: string;
  heroMedia: PublicPageMedia | null;
  interestOptions: readonly QuoteFormOptionView[];
  map: ContactMapView;
  quantityPlaceholder: string;
  submissionUnavailableDescription: string;
  submissionUnavailableTitle: string;
}

export interface ContactRequestQuotePageProps {
  data: ContactRequestQuotePageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

const fieldClassName =
  "border-burgundy/18 bg-ivory text-charcoal placeholder:text-charcoal/64 min-h-12 w-full rounded-[var(--radius-sm)] border px-4 py-3 text-base focus:border-lacquer";

function ContactMapPreview({ map }: { map: ContactMapView }) {
  const [requested, setRequested] = useState(false);
  const contentId = "contact-map-content";

  return (
    <section
      className="border-burgundy/12 bg-burgundy/3 mt-8 overflow-hidden rounded-[var(--radius-lg)] border"
      aria-labelledby="contact-map-title"
    >
      <div className="relative min-h-48 overflow-hidden p-6">
        <svg
          aria-hidden="true"
          className="text-gold/18 absolute inset-0 size-full"
          viewBox="0 0 400 220"
          fill="none"
          preserveAspectRatio="none"
        >
          <path d="M0 55h400M0 110h400M0 165h400" stroke="currentColor" />
          <path
            d="M80 0v220M160 0v220M240 0v220M320 0v220"
            stroke="currentColor"
          />
          <path
            d="M-10 190C75 140 108 174 166 108S283 39 410 74"
            stroke="currentColor"
            strokeWidth="6"
          />
          <circle cx="235" cy="82" r="12" fill="currentColor" />
        </svg>
        <div className="relative z-10 max-w-sm">
          <h3
            id="contact-map-title"
            className="text-burgundy font-serif text-2xl"
          >
            {map.title}
          </h3>
          <p className="text-charcoal/64 mt-3 text-sm leading-6">
            {map.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!requested ? (
              <button
                type="button"
                aria-controls={contentId}
                aria-expanded="false"
                onClick={() => setRequested(true)}
                className="bg-burgundy text-ivory hover:bg-lacquer min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold"
              >
                {map.loadLabel}
              </button>
            ) : null}
            {map.placeUrl ? (
              <a
                href={map.placeUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="border-burgundy/25 text-burgundy hover:border-gold hover:text-lacquer inline-flex min-h-11 items-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors"
              >
                {map.placeLinkLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <div id={contentId} hidden={!requested}>
        {requested && map.embedUrl ? (
          <iframe
            src={map.embedUrl}
            title={map.title}
            loading="lazy"
            className="border-burgundy/12 h-72 w-full border-t"
            referrerPolicy="no-referrer"
          />
        ) : requested ? (
          <p
            className="border-burgundy/12 bg-ivory text-charcoal/68 border-t px-6 py-5 text-sm leading-6"
            role="status"
          >
            {map.unavailableDescription}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function ContactRequestQuotePage({
  data,
  dictionary,
  isDemo,
  notices,
}: ContactRequestQuotePageProps) {
  function preventUnconfiguredSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

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

          <div
            id="quote-form-status"
            className="border-gold/40 bg-gold/10 text-burgundy mt-8 rounded-[var(--radius-md)] border px-5 py-4"
            role="status"
          >
            <p className="text-sm font-semibold">
              {data.submissionUnavailableTitle}
            </p>
            <p className="text-charcoal/62 mt-1 text-sm leading-6">
              {data.submissionUnavailableDescription}
            </p>
          </div>

          <form
            className="mt-9 space-y-7"
            onSubmit={preventUnconfiguredSubmission}
            aria-describedby="quote-form-status quote-form-privacy"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="text-burgundy grid gap-2 text-sm font-semibold">
                <span>{dictionary.contact.fullName}</span>
                <input
                  className={fieldClassName}
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  required
                />
              </label>
              <label className="text-burgundy grid gap-2 text-sm font-semibold">
                <span>{dictionary.contact.company}</span>
                <input
                  className={fieldClassName}
                  type="text"
                  name="company"
                  autoComplete="organization"
                />
              </label>
              <label className="text-burgundy grid gap-2 text-sm font-semibold">
                <span>{dictionary.contact.email}</span>
                <input
                  className={fieldClassName}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </label>
              <label className="text-burgundy grid gap-2 text-sm font-semibold">
                <span>{dictionary.contact.phone}</span>
                <input
                  className={fieldClassName}
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </label>
              <label className="text-burgundy grid gap-2 text-sm font-semibold sm:col-span-2">
                <span>{dictionary.contact.country}</span>
                <select
                  className={fieldClassName}
                  name="country"
                  autoComplete="country-name"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    {dictionary.contact.countrySelect}
                  </option>
                  {data.countryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-burgundy text-sm font-semibold">
                {dictionary.contact.interests}
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.interestOptions.map((option) => (
                  <label
                    key={option.value}
                    className="border-burgundy/14 hover:border-gold/60 bg-ivory flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="interests"
                      value={option.value}
                      className="accent-lacquer size-4"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-6 sm:grid-cols-2">
              <label className="text-burgundy grid gap-2 text-sm font-semibold">
                <span>{dictionary.contact.quantity}</span>
                <input
                  className={fieldClassName}
                  type="text"
                  name="quantity"
                  inputMode="numeric"
                  placeholder={data.quantityPlaceholder}
                />
              </label>
              <label className="text-burgundy grid gap-2 text-sm font-semibold">
                <span>{dictionary.contact.deadline}</span>
                <input
                  className={fieldClassName}
                  type="date"
                  name="deadline"
                  aria-describedby="quote-deadline-help"
                />
                <span
                  id="quote-deadline-help"
                  className="text-charcoal/64 text-xs leading-5 font-normal"
                >
                  {data.deadlineHelp}
                </span>
              </label>
            </div>

            <label className="text-burgundy grid gap-2 text-sm font-semibold">
              <span>{dictionary.contact.notes}</span>
              <textarea
                className={`${fieldClassName} min-h-36 resize-y`}
                name="notes"
                rows={6}
              />
            </label>

            <label className="text-burgundy grid gap-2 text-sm font-semibold">
              <span>{dictionary.contact.attachment}</span>
              <input
                className="border-burgundy/18 bg-ivory file:bg-burgundy file:text-ivory file:hover:bg-lacquer w-full rounded-[var(--radius-sm)] border p-2 text-sm file:mr-4 file:rounded-full file:border-0 file:px-4 file:py-2.5 file:font-semibold"
                type="file"
                name="attachment"
                accept={data.acceptedAttachmentTypes}
                disabled
                aria-disabled="true"
                aria-describedby="quote-attachment-help"
              />
              <span
                id="quote-attachment-help"
                className="text-charcoal/64 text-xs leading-5 font-normal"
              >
                {data.attachmentHelp}
              </span>
            </label>

            <label className="text-charcoal/68 flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                name="consent"
                required
                className="accent-lacquer mt-1 size-4 shrink-0"
              />
              <span>
                {dictionary.contact.consent} {data.consentDescription}
                {data.consentLink ? (
                  <>
                    {" "}
                    <a
                      href={data.consentLink.href}
                      className="text-burgundy decoration-gold hover:text-lacquer underline underline-offset-4"
                    >
                      {data.consentLink.label}
                    </a>
                  </>
                ) : null}
              </span>
            </label>

            <div
              id="quote-form-privacy"
              className="flex flex-wrap items-center gap-4"
            >
              <button
                type="submit"
                disabled
                aria-disabled="true"
                className="border-burgundy/15 bg-burgundy/8 text-charcoal/40 min-h-12 cursor-not-allowed rounded-full border px-6 py-3 text-sm font-semibold"
              >
                {dictionary.contact.submit}
              </button>
              <p className="text-charcoal/64 max-w-xl text-xs leading-5">
                {dictionary.contact.demoNotice}
              </p>
            </div>
          </form>
        </div>
      </section>
    </PageFrame>
  );
}
