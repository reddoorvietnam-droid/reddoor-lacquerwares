import type { Locale } from "@/lib/i18n/config";

import type {
  PublicCollection,
  PublicCollectionCover,
  PublicCollectionListOptions,
  PublicCollectionRepository,
} from "./public-contract";

type DemoCollectionCopy = {
  readonly title: string;
  readonly editionLabel: string;
  readonly summary: string;
  readonly coverAlt: string;
};

type DemoCollectionLocaleCopy = {
  readonly replacementHint: string;
  readonly collections: readonly DemoCollectionCopy[];
};

type DemoCollectionBlueprint = {
  readonly id: string;
  readonly slug: string;
  readonly productIds: readonly string[];
  readonly featured: boolean;
};

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }

  Object.freeze(value as object);
  return value;
}

const COLLECTION_BLUEPRINTS = deepFreeze([
  {
    id: "demo-collection-material-dialogue",
    slug: "demo-material-dialogue",
    productIds: ["demo-product-sculptural-tray", "demo-product-tall-vessel"],
    featured: true,
  },
  {
    id: "demo-collection-quiet-geometry",
    slug: "demo-quiet-geometry",
    productIds: ["demo-product-keepsake-box", "demo-product-table-object"],
    featured: true,
  },
  {
    id: "demo-collection-surface-studies",
    slug: "demo-surface-studies",
    productIds: ["demo-product-sculptural-tray", "demo-product-keepsake-box"],
    featured: false,
  },
] satisfies readonly DemoCollectionBlueprint[]);

const DEMO_COLLECTION_COPY = deepFreeze({
  vi: {
    replacementHint:
      "Thay bìa mẫu bằng metadata/publicId Cloudinary của bìa collection đã được phê duyệt.",
    collections: [
      {
        title: "Đối thoại vật liệu — DEMO",
        editionLabel: "Niên bản đang chờ xác minh",
        summary:
          "Khung collection DEMO để kiểm thử bìa dạng art book và liên kết sản phẩm; không đại diện cho bộ sưu tập đã phát hành.",
        coverAlt: "Bìa art book DEMO cho Đối thoại vật liệu",
      },
      {
        title: "Hình học tĩnh — DEMO",
        editionLabel: "Niên bản đang chờ xác minh",
        summary:
          "Khung collection DEMO dành cho câu chuyện và PDF chính thức sau khi doanh nghiệp phê duyệt.",
        coverAlt: "Bìa art book DEMO cho Hình học tĩnh",
      },
      {
        title: "Nghiên cứu bề mặt — DEMO",
        editionLabel: "Niên bản đang chờ xác minh",
        summary:
          "Khung collection DEMO để kiểm thử danh sách theo năm mà không tự tạo năm phát hành hoặc catalogue thật.",
        coverAlt: "Bìa art book DEMO cho Nghiên cứu bề mặt",
      },
    ],
  },
  en: {
    replacementHint:
      "Replace this cover with approved collection-cover metadata and a Cloudinary publicId.",
    collections: [
      {
        title: "Material dialogue — DEMO",
        editionLabel: "Edition awaiting verification",
        summary:
          "A DEMO collection frame for testing art-book covers and product links; it does not represent a released collection.",
        coverAlt: "DEMO art-book cover for Material dialogue",
      },
      {
        title: "Quiet geometry — DEMO",
        editionLabel: "Edition awaiting verification",
        summary:
          "A DEMO collection frame reserved for an approved story and official PDF.",
        coverAlt: "DEMO art-book cover for Quiet geometry",
      },
      {
        title: "Surface studies — DEMO",
        editionLabel: "Edition awaiting verification",
        summary:
          "A DEMO collection frame for testing a year-based listing without inventing a release year or real catalogue.",
        coverAlt: "DEMO art-book cover for Surface studies",
      },
    ],
  },
  fr: {
    replacementHint:
      "Remplacer cette couverture par les métadonnées et le publicId Cloudinary d'une couverture approuvée.",
    collections: [
      {
        title: "Dialogue des matières — DÉMO",
        editionLabel: "Édition en attente de vérification",
        summary:
          "Un cadre de collection DÉMO pour tester les couvertures de livres d'art et les liens produits ; il ne représente aucune collection publiée.",
        coverAlt: "Couverture de livre d'art DÉMO pour Dialogue des matières",
      },
      {
        title: "Géométrie silencieuse — DÉMO",
        editionLabel: "Édition en attente de vérification",
        summary:
          "Un cadre de collection DÉMO réservé à un récit approuvé et à un PDF officiel.",
        coverAlt: "Couverture de livre d'art DÉMO pour Géométrie silencieuse",
      },
      {
        title: "Études de surface — DÉMO",
        editionLabel: "Édition en attente de vérification",
        summary:
          "Un cadre DÉMO pour tester la liste par année sans inventer de date de parution ni de véritable catalogue.",
        coverAlt: "Couverture de livre d'art DÉMO pour Études de surface",
      },
    ],
  },
  de: {
    replacementHint:
      "Cover durch freigegebene Kollektions-Metadaten und eine Cloudinary-publicId ersetzen.",
    collections: [
      {
        title: "Dialog der Materialien — DEMO",
        editionLabel: "Edition wartet auf Bestätigung",
        summary:
          "Ein DEMO-Kollektionsrahmen zum Testen von Kunstbuchcovern und Produktverknüpfungen; er stellt keine veröffentlichte Kollektion dar.",
        coverAlt: "DEMO-Kunstbuchcover für Dialog der Materialien",
      },
      {
        title: "Stille Geometrie — DEMO",
        editionLabel: "Edition wartet auf Bestätigung",
        summary:
          "Ein DEMO-Kollektionsrahmen für eine später freigegebene Geschichte und ein offizielles PDF.",
        coverAlt: "DEMO-Kunstbuchcover für Stille Geometrie",
      },
      {
        title: "Oberflächenstudien — DEMO",
        editionLabel: "Edition wartet auf Bestätigung",
        summary:
          "Ein DEMO-Rahmen zum Testen einer Jahresliste, ohne ein Erscheinungsjahr oder einen echten Katalog zu erfinden.",
        coverAlt: "DEMO-Kunstbuchcover für Oberflächenstudien",
      },
    ],
  },
  ja: {
    replacementHint:
      "仮表紙を、承認済みのコレクション表紙メタデータと Cloudinary publicId に差し替えてください。",
    collections: [
      {
        title: "素材の対話 — デモ",
        editionLabel: "発表年は確認待ち",
        summary:
          "アートブック表紙と製品リンクを確認するためのデモ枠で、発表済みコレクションを表すものではありません。",
        coverAlt: "「素材の対話」用デモ版アートブック表紙",
      },
      {
        title: "静かな幾何学 — デモ",
        editionLabel: "発表年は確認待ち",
        summary:
          "承認済みの物語と正式な PDF を後から掲載するためのデモコレクション枠です。",
        coverAlt: "「静かな幾何学」用デモ版アートブック表紙",
      },
      {
        title: "表面のスタディ — デモ",
        editionLabel: "発表年は確認待ち",
        summary:
          "架空の発表年や実在カタログを作らず、年別一覧を確認するためのデモ枠です。",
        coverAlt: "「表面のスタディ」用デモ版アートブック表紙",
      },
    ],
  },
  "zh-CN": {
    replacementHint:
      "请将占位封面替换为经批准的系列封面元数据和 Cloudinary publicId。",
    collections: [
      {
        title: "材料对话 — 演示",
        editionLabel: "版本年份等待核实",
        summary:
          "用于测试艺术画册封面和产品链接的演示系列框架，不代表已发布的真实系列。",
        coverAlt: "“材料对话”的演示艺术画册封面",
      },
      {
        title: "静谧几何 — 演示",
        editionLabel: "版本年份等待核实",
        summary: "为经批准的系列故事和正式 PDF 预留的演示系列框架。",
        coverAlt: "“静谧几何”的演示艺术画册封面",
      },
      {
        title: "表面研究 — 演示",
        editionLabel: "版本年份等待核实",
        summary: "用于测试按年份显示的演示框架，不虚构发布时间或真实目录。",
        coverAlt: "“表面研究”的演示艺术画册封面",
      },
    ],
  },
} satisfies Record<Locale, DemoCollectionLocaleCopy>);

function makeCover(
  collectionId: string,
  alt: string,
  replacementHint: string,
): PublicCollectionCover {
  return {
    assetKey: `${collectionId}-cover`,
    src: "/file.svg",
    alt,
    width: 1200,
    height: 1600,
    isDemo: true,
    replacementHint,
  };
}

function makeCollections(locale: Locale): readonly PublicCollection[] {
  const localeCopy = DEMO_COLLECTION_COPY[locale];

  return deepFreeze(
    COLLECTION_BLUEPRINTS.map((blueprint, index) => {
      const copy = localeCopy.collections[index];

      if (!copy) {
        throw new Error(
          `Missing DEMO collection copy for ${locale} at index ${index}.`,
        );
      }

      return {
        id: blueprint.id,
        marker: "DEMO",
        isDemo: true,
        locale,
        slug: blueprint.slug,
        title: copy.title,
        editionLabel: copy.editionLabel,
        year: null,
        summary: copy.summary,
        cover: makeCover(
          blueprint.id,
          copy.coverAlt,
          localeCopy.replacementHint,
        ),
        productIds: blueprint.productIds,
        flipbook: {
          status: "notConfigured",
          pdfUrl: null,
          pageCount: null,
          downloadAllowed: false,
        },
        featured: blueprint.featured,
        sortOrder: index + 1,
      } satisfies PublicCollection;
    }),
  );
}

export const DEMO_COLLECTIONS_BY_LOCALE: Readonly<
  Record<Locale, readonly PublicCollection[]>
> = deepFreeze({
  vi: makeCollections("vi"),
  en: makeCollections("en"),
  fr: makeCollections("fr"),
  de: makeCollections("de"),
  ja: makeCollections("ja"),
  "zh-CN": makeCollections("zh-CN"),
});

function applyListOptions(
  collections: readonly PublicCollection[],
  options?: PublicCollectionListOptions,
): readonly PublicCollection[] {
  if (!options) {
    return collections;
  }

  let result = collections.filter(
    (collection) => !options.featuredOnly || collection.featured,
  );

  if (options.limit !== undefined) {
    const limit = Math.max(0, Math.trunc(options.limit));
    result = result.slice(0, limit);
  }

  return deepFreeze(result);
}

const demoCollectionRepositoryImplementation: PublicCollectionRepository = {
  async list(locale, options) {
    return applyListOptions(DEMO_COLLECTIONS_BY_LOCALE[locale], options);
  },
  async getById(locale, id) {
    return (
      DEMO_COLLECTIONS_BY_LOCALE[locale].find(
        (collection) => collection.id === id,
      ) ?? null
    );
  },
  async getBySlug(locale, slug) {
    return (
      DEMO_COLLECTIONS_BY_LOCALE[locale].find(
        (collection) => collection.slug === slug,
      ) ?? null
    );
  },
};

export const demoCollectionRepository: PublicCollectionRepository =
  Object.freeze(demoCollectionRepositoryImplementation);
