import type { PublicDictionary } from "@/lib/i18n/dictionary";

import {
  ActionLink,
  PageFrame,
  PageHero,
  PageNotices,
  RichContent,
  type PublicContentBlock,
  type PublicPageLink,
  type PublicPageNotice,
} from "./shared";

export interface LegalSectionView {
  blocks: readonly PublicContentBlock[];
  id: string;
  title: string;
}

export interface LegalContactPanelView {
  description: string;
  link: PublicPageLink;
  title: string;
}

export interface LegalDocumentPageData {
  contactPanel: LegalContactPanelView | null;
  contentsLabel: string;
  eyebrow: string;
  intro: string;
  lastUpdatedLabel: string;
  sections: readonly LegalSectionView[];
}

export interface LegalDocumentPageProps {
  data: LegalDocumentPageData;
  dictionary: PublicDictionary;
  isDemo: boolean;
  notices?: readonly PublicPageNotice[];
}

type LegalDocumentKind = "privacy" | "terms" | "accessibility";

interface LegalDocumentProps extends LegalDocumentPageProps {
  kind: LegalDocumentKind;
}

function getDocumentTitle(
  dictionary: PublicDictionary,
  kind: LegalDocumentKind,
): string {
  if (kind === "privacy") {
    return dictionary.pages.privacyTitle;
  }
  if (kind === "terms") {
    return dictionary.pages.termsTitle;
  }
  return dictionary.pages.accessibilityTitle;
}

function LegalDocumentPage({
  data,
  dictionary,
  isDemo,
  kind,
  notices,
}: LegalDocumentProps) {
  const title = getDocumentTitle(dictionary, kind);

  return (
    <PageFrame>
      <PageNotices dictionary={dictionary} isDemo={isDemo} notices={notices} />
      <PageHero eyebrow={data.eyebrow} title={title} intro={data.intro} />

      <div className="mx-auto grid max-w-6xl gap-12 px-[var(--space-page)] py-16 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16 lg:py-24">
        <aside className="self-start lg:sticky lg:top-24">
          <p className="text-gold-ink text-xs font-bold tracking-[0.14em] uppercase">
            {data.lastUpdatedLabel}
          </p>
          {data.sections.length > 0 ? (
            <nav className="mt-8" aria-label={data.contentsLabel}>
              <p className="text-burgundy text-xs font-bold tracking-[0.12em] uppercase">
                {data.contentsLabel}
              </p>
              <ol className="border-burgundy/12 mt-4 space-y-1 border-l pl-4">
                {data.sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-charcoal/64 hover:text-lacquer grid grid-cols-[1.5rem_1fr] gap-2 rounded-r-md px-2 py-2 text-sm leading-5"
                    >
                      <span
                        className="text-gold-ink text-xs"
                        aria-hidden="true"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
        </aside>

        <article className="min-w-0">
          <div className="divide-burgundy/10 divide-y">
            {data.sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-24 py-10 first:pt-0"
                aria-labelledby={`${section.id}-title`}
              >
                <div className="grid gap-5 sm:grid-cols-[3rem_1fr]">
                  <span
                    className="text-gold-ink font-serif text-2xl"
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2
                      id={`${section.id}-title`}
                      className="text-burgundy font-serif text-3xl leading-tight tracking-[-0.025em] sm:text-4xl"
                    >
                      {section.title}
                    </h2>
                    <div className="mt-7">
                      <RichContent blocks={section.blocks} />
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {data.contactPanel ? (
            <aside className="bg-burgundy text-ivory relative isolate mt-12 overflow-hidden rounded-[var(--radius-display)] p-7 shadow-[var(--shadow-lacquer)] sm:p-10">
              <div className="lacquer-grain" aria-hidden="true" />
              <div className="relative">
                <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
                  {data.contactPanel.title}
                </h2>
                <p className="text-ivory/68 mt-4 max-w-2xl leading-7">
                  {data.contactPanel.description}
                </p>
                <div className="mt-7">
                  <ActionLink link={data.contactPanel.link} variant="gold" />
                </div>
              </div>
            </aside>
          ) : null}
        </article>
      </div>
    </PageFrame>
  );
}

export function PrivacyPage(props: LegalDocumentPageProps) {
  return <LegalDocumentPage {...props} kind="privacy" />;
}

export function TermsPage(props: LegalDocumentPageProps) {
  return <LegalDocumentPage {...props} kind="terms" />;
}

export function AccessibilityPage(props: LegalDocumentPageProps) {
  return <LegalDocumentPage {...props} kind="accessibility" />;
}
