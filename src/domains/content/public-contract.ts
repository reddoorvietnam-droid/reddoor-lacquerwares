import type { Locale } from "@/lib/i18n/config";

export type PublicDemoMarker = "DEMO";

export interface PublicImageAsset {
  readonly assetKey: string;
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly isDemo: true;
  readonly replacementHint: string;
}

export interface PublicCompanyProfile {
  readonly id: string;
  readonly marker: PublicDemoMarker;
  readonly isDemo: true;
  readonly displayName: string;
  readonly legalName: string;
  readonly eyebrow: string;
  readonly tagline: string;
  readonly summary: string;
  readonly contentNotice: string;
  readonly heroImage: PublicImageAsset;
}

export interface PublicHistoryMilestone {
  readonly id: string;
  readonly marker: PublicDemoMarker;
  readonly isDemo: true;
  readonly sortOrder: number;
  readonly periodLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly image: PublicImageAsset;
}

export interface PublicProcessStage {
  readonly id: string;
  readonly marker: PublicDemoMarker;
  readonly isDemo: true;
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
  readonly href: string | null;
  readonly isDemo: true;
}

export interface PublicContactPlaceholder {
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly mapUrl: string | null;
  readonly notice: string;
  readonly isDemo: true;
}

export interface PublicSiteSettings {
  readonly id: string;
  readonly marker: PublicDemoMarker;
  readonly isDemo: true;
  readonly siteName: string;
  readonly defaultLocale: Locale;
  readonly contact: PublicContactPlaceholder;
  readonly socialLinks: readonly PublicSocialLink[];
  readonly quoteSubmissionEnabled: false;
}

export interface PublicContentSnapshot {
  readonly locale: Locale;
  readonly marker: PublicDemoMarker;
  readonly isDemo: true;
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
