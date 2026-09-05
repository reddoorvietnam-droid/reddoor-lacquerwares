import "server-only";

import { Types } from "mongoose";
import { unstable_cache } from "next/cache";

import {
  getContentEntryModel,
  getContentTranslationModel,
} from "@/domains/content/persistence/models";
import { MongoSiteSettingsRepository } from "@/domains/content/persistence/repositories";
import type {
  PublicCompanyProfile,
  PublicContactDetails,
  PublicContentRepository,
  PublicContentSnapshot,
  PublicHistoryMilestone,
  PublicProcessStage,
  PublicSiteSettings,
  PublicSocialLink,
  PublicSocialPlatform,
} from "@/domains/content/public-contract";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { Locale } from "@/lib/i18n/config";
import {
  deliveredImage,
  pendingImage,
  pickTranslation,
} from "@/lib/public/published-mapping";

/**
 * Builds the public content snapshot from what the CMS has published.
 *
 * Two sources feed it:
 *
 * - **Site settings** (the published singleton) carry the company profile and
 *   contact details. Until settings are published, those fields render empty
 *   rather than falling back to DEMO copy — an empty footer is a truthful
 *   statement of what the company has approved so far; DEMO copy is not.
 *
 * - **Content entries** carry the two editorial lists, by convention on the
 *   fields the Content Studio already exposes:
 *   · process stages — entries of type `processStage`; `placement` is the
 *     step label (for example "01 · Làm vóc") and orders the list.
 *   · history milestones — entries of type `section` whose `placement`
 *     starts with `history` (for example "history.01 · Làng nghề"); after
 *     stripping the prefix and the ordering digits, the remainder is the
 *     period label shown beside the milestone.
 */

type LeanEntry = {
  _id: Types.ObjectId;
  code: string;
  type: string;
  placement: string;
  currentPublishedRevisionId?: Types.ObjectId;
};

type LeanTranslation = {
  entryId: Types.ObjectId;
  revisionId: Types.ObjectId;
  locale: Locale;
  title: string;
  summary?: string;
};

const SOCIAL_PLATFORMS: readonly PublicSocialPlatform[] = [
  "facebook",
  "instagram",
  "linkedin",
  "pinterest",
  "youtube",
];

const settingsRepository = new MongoSiteSettingsRepository();

/**
 * Everything returned here crosses `unstable_cache`, which serializes to
 * JSON: an ObjectId survives the first in-process call and comes back as a
 * plain object on every cached read. Only plain strings may leave.
 */
type ResolvedEntry = {
  id: string;
  code: string;
  type: string;
  placement: string;
  title: string;
  summary: string;
};

async function loadEntries(locale: Locale): Promise<ResolvedEntry[]> {
  await connectToDatabase();

  const entries = await getContentEntryModel()
    .find({
      status: "published",
      deletedAt: { $exists: false },
      currentPublishedRevisionId: { $exists: true, $ne: null },
      $or: [
        { type: "processStage" },
        { type: "section", placement: /^history/ },
      ],
    })
    .select("_id code type placement currentPublishedRevisionId")
    .sort({ placement: 1 })
    .lean<LeanEntry[]>()
    .exec();
  if (entries.length === 0) return [];

  const translations = await getContentTranslationModel()
    .find({
      revisionId: {
        $in: entries
          .map((entry) => entry.currentPublishedRevisionId)
          .filter((id): id is Types.ObjectId => id !== undefined),
      },
      translationStatus: "published",
    })
    .select("entryId revisionId locale title summary")
    .lean<LeanTranslation[]>()
    .exec();
  const byRevision = new Map<string, LeanTranslation[]>();
  for (const translation of translations) {
    const key = translation.revisionId.toHexString();
    byRevision.set(key, [...(byRevision.get(key) ?? []), translation]);
  }

  const resolved: ResolvedEntry[] = [];
  for (const entry of entries) {
    const key = entry.currentPublishedRevisionId?.toHexString();
    if (!key) continue;
    const translation = pickTranslation(byRevision.get(key) ?? [], locale);
    if (!translation) continue;
    resolved.push({
      id: entry._id.toHexString(),
      code: entry.code,
      type: entry.type,
      placement: entry.placement,
      title: translation.title,
      summary: translation.summary ?? "",
    });
  }
  return resolved;
}

const cachedEntries = unstable_cache(loadEntries, ["public-content-lists-v1"], {
  revalidate: 300,
  tags: ["content:public"],
});

const cachedSettings = unstable_cache(
  async (locale: Locale) => settingsRepository.findPublished(locale),
  ["public-site-settings-v1"],
  { revalidate: 300, tags: ["content:public"] },
);

function emptyContact(): PublicContactDetails {
  return {
    email: null,
    phone: null,
    fax: null,
    address: null,
    factoryAddress: null,
    warehouseAddress: null,
    mapUrl: null,
    mapEmbedUrl: null,
    notice: "",
    isDemo: false,
  };
}

async function getSettings(locale: Locale): Promise<PublicSiteSettings> {
  const settings = await cachedSettings(locale);

  const socialLinks: PublicSocialLink[] = (settings?.socialLinks ?? [])
    .map((link, index): PublicSocialLink | null => {
      const platform = link.platform.trim().toLowerCase();
      if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) {
        return null;
      }
      return {
        id: `social-${platform}-${index}`,
        platform: platform as PublicSocialPlatform,
        label: link.label,
        href: link.url,
        isDemo: false,
      };
    })
    .filter((link): link is PublicSocialLink => link !== null);

  // The map is derived from the published address rather than stored
  // separately: a keyless Google Maps query needs nothing but the address
  // text, so the two can never drift apart.
  const address = settings?.translation.addressLabel ?? null;
  const mapQuery = address ? encodeURIComponent(address) : null;

  return {
    id: settings?.id ?? "site-settings",
    marker: null,
    isDemo: false,
    siteName: settings?.translation.companyName ?? "",
    defaultLocale: "vi",
    contact: {
      ...emptyContact(),
      email: settings?.publicEmail ?? null,
      phone: settings?.publicPhone ?? null,
      address,
      mapUrl: mapQuery ? `https://www.google.com/maps?q=${mapQuery}` : null,
      mapEmbedUrl: mapQuery
        ? `https://maps.google.com/maps?q=${mapQuery}&output=embed`
        : null,
    },
    socialLinks,
  };
}

// Brand text is hardcoded on purpose — display copy must not follow the
// MongoDB settings document.
const BRAND_DISPLAY_NAME = "RED DOOR VIET NAM";
const BRAND_TAGLINE = "Nghệ thuật sơn mài Việt Nam";

async function getCompany(locale: Locale): Promise<PublicCompanyProfile> {
  const settings = await cachedSettings(locale);
  const name = settings?.translation.companyName ?? "";

  return {
    id: settings?.id ?? "company",
    marker: null,
    isDemo: false,
    displayName: BRAND_DISPLAY_NAME,
    legalName: name,
    eyebrow: BRAND_TAGLINE,
    tagline: BRAND_TAGLINE,
    summary: settings?.translation.description ?? "",
    contentNotice: "",
    heroImage: pendingImage("home-hero-01", name, 3200, 2000),
  };
}

/**
 * Photographs already delivered for the history timeline, keyed by the
 * content entry `code`. No media pipeline serves CMS uploads yet, so these
 * files live under `public/about-us/` and are matched here; a milestone
 * without an entry keeps rendering its reserved slot.
 */
const HISTORY_IMAGES: Readonly<Record<string, string>> = {
  "history-lang-nghe": "/about-us/ha_thai.jpg",
  "history-red-door": "/about-us/red_door.jpg",
  "history-xuat-khau": "/about-us/vuon_ra_the_gioi.jpg",
  "history-sgs": "/about-us/chuan_muc_chau_au.jpg",
  "history-moi-nam": "/about-us/bo_su_tap.jpg",
};

async function listHistory(
  locale: Locale,
): Promise<readonly PublicHistoryMilestone[]> {
  const resolved = await cachedEntries(locale);
  return resolved
    .filter((entry) => entry.type === "section")
    .map((entry, index) => {
      const delivered = HISTORY_IMAGES[entry.code];
      return {
        id: entry.id,
        marker: null,
        isDemo: false,
        sortOrder: index,
        // "history.01 · Làng nghề" → "Làng nghề": the digits exist only to
        // order the timeline; the visitor sees the era label alone.
        periodLabel: entry.placement.replace(
          /^history[\s.·-]*(?:\d+[\s.·-]*)?/,
          "",
        ),
        title: entry.title,
        summary: entry.summary,
        image: delivered
          ? deliveredImage(
              `history-${entry.code}`,
              delivered,
              entry.title,
              3000,
              2000,
            )
          : pendingImage(`history-${entry.code}`, entry.title, 1000, 750),
      };
    });
}

/**
 * Photographs already delivered for the lacquer process steps, keyed by the
 * content entry `code`; files live under `public/lacquer-process/`. A stage
 * without a delivered photo keeps rendering its reserved slot.
 */
const PROCESS_IMAGES: Readonly<Record<string, string>> = {
  "process-lam-voc": "/lacquer-process/lam_voc.jpg",
  "process-hom-lot": "/lacquer-process/hom_va_lot.jpg",
  "process-phu-son-mai-nuoc": "/lacquer-process/phu_son.jpg",
  "process-trang-tri": "/lacquer-process/trang_tri.jpg",
  "process-danh-bong": "/lacquer-process/danh_bong.jpg",
};

async function listProcess(
  locale: Locale,
): Promise<readonly PublicProcessStage[]> {
  const resolved = await cachedEntries(locale);
  return resolved
    .filter((entry) => entry.type === "processStage")
    .map((entry, index) => {
      const delivered = PROCESS_IMAGES[entry.code];
      return {
        id: entry.id,
        marker: null,
        isDemo: false,
        sortOrder: index,
        stepLabel: entry.placement,
        title: entry.title,
        summary: entry.summary,
        image: delivered
          ? deliveredImage(
              `process-${entry.code}`,
              delivered,
              entry.title,
              2400,
              1792,
            )
          : pendingImage(`process-${entry.code}`, entry.title, 1200, 900),
      };
    });
}

export const mongoPublicContentRepository: PublicContentRepository = {
  getCompany,
  listHistory,
  listProcess,
  getSettings,
  async getSnapshot(locale: Locale): Promise<PublicContentSnapshot> {
    const [company, history, process, settings] = await Promise.all([
      getCompany(locale),
      listHistory(locale),
      listProcess(locale),
      getSettings(locale),
    ]);

    return {
      locale,
      marker: null,
      isDemo: false,
      company,
      history,
      process,
      settings,
    };
  },
};
