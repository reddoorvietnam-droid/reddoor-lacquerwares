import type { Locale } from "@/lib/i18n/config";

/**
 * `"DEMO"` marks copy that is a stand-in and must not be read as a company
 * statement. `null` marks copy the company stands behind. The distinction is
 * kept in the data rather than in the components, so a page cannot accidentally
 * present unapproved text as fact.
 */
export type PublicContentMarker = "DEMO" | null;

/** @deprecated Retained for callers written before real copy landed. */
export type PublicDemoMarker = PublicContentMarker;

export interface PublicImageAsset {
  /** Stable file name the final photograph should be saved as. */
  readonly assetKey: string;
  /** Delivered image, or `null` while the photograph is still outstanding. */
  readonly src: string | null;
  readonly alt: string;
  /** Intended pixel size; the layout reserves this box either way. */
  readonly width: number;
  readonly height: number;
  /** True until a real photograph replaces the reserved slot. */
  readonly assetPending: boolean;
  readonly replacementHint: string;
}

export interface PublicCompanyProfile {
  readonly id: string;
  readonly marker: PublicContentMarker;
  readonly isDemo: boolean;
  readonly displayName: string;
  readonly legalName: string;
  readonly eyebrow: string;
  readonly tagline: string;
  readonly summary: string;
  /** Shown only while `isDemo` is true. */
  readonly contentNotice: string;
  readonly heroImage: PublicImageAsset;
}

export interface PublicHistoryMilestone {
  readonly id: string;
  readonly marker: PublicContentMarker;
  readonly isDemo: boolean;
  readonly sortOrder: number;
  readonly periodLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly image: PublicImageAsset;
}

export interface PublicProcessStage {
  readonly id: string;
  readonly marker: PublicContentMarker;
  readonly isDemo: boolean;
  readonly sortOrder: number;
  readonly stepLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly image: PublicImageAsset;
}

export type PublicSocialPlatform =
  "facebook" | "instagram" | "linkedin" | "pinterest" | "youtube";

export interface PublicSocialLink {
  readonly id: string;
  readonly platform: PublicSocialPlatform;
  readonly label: string;
  /** `null` while the company has not confirmed the account URL. */
  readonly href: string | null;
  readonly isDemo: boolean;
}

export interface PublicContactDetails {
  readonly email: string | null;
  readonly phone: string | null;
  readonly fax: string | null;
  readonly address: string | null;
  readonly factoryAddress: string | null;
  readonly warehouseAddress: string | null;
  /** Canonical Google Maps place link, opened in a new tab. */
  readonly mapUrl: string | null;
  /**
   * Embeddable map URL. Deliberately separate from `mapUrl`: Google refuses to
   * render a `/maps/place/…` link inside a frame, so pasting the browser URL
   * into an iframe yields a blank box.
   */
  readonly mapEmbedUrl: string | null;
  /** Shown only while `isDemo` is true. */
  readonly notice: string;
  readonly isDemo: boolean;
}

/** @deprecated Renamed once the details became real. */
export type PublicContactPlaceholder = PublicContactDetails;

export interface PublicSiteSettings {
  readonly id: string;
  readonly marker: PublicContentMarker;
  readonly isDemo: boolean;
  readonly siteName: string;
  readonly defaultLocale: Locale;
  readonly contact: PublicContactDetails;
  readonly socialLinks: readonly PublicSocialLink[];
  /** Still false: submission persistence belongs to a later phase. */
  readonly quoteSubmissionEnabled: boolean;
}

export interface PublicContentSnapshot {
  readonly locale: Locale;
  readonly marker: PublicContentMarker;
  readonly isDemo: boolean;
  readonly company: PublicCompanyProfile;
  readonly history: readonly PublicHistoryMilestone[];
  readonly process: readonly PublicProcessStage[];
  readonly settings: PublicSiteSettings;
}

export interface PublicContentRepository {
  getSnapshot(locale: Locale): Promise<PublicContentSnapshot>;
  getCompany(locale: Locale): Promise<PublicCompanyProfile>;
  listHistory(locale: Locale): Promise<readonly PublicHistoryMilestone[]>;
  listProcess(locale: Locale): Promise<readonly PublicProcessStage[]>;
  getSettings(locale: Locale): Promise<PublicSiteSettings>;
}
