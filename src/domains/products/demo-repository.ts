import type { Locale } from "@/lib/i18n/config";

import type {
  PublicProduct,
  PublicProductImage,
  PublicProductListOptions,
  PublicProductRepository,
} from "./public-contract";

type DemoProductCopy = {
  readonly name: string;
  readonly categoryLabel: string;
  readonly summary: string;
  readonly story: string;
  readonly materialLabel: string;
  readonly finishLabel: string;
  readonly imageAlt: string;
  readonly demoTag: string;
  readonly placeholderTag: string;
};

type DemoProductLocaleCopy = {
  readonly replacementHint: string;
  readonly products: readonly DemoProductCopy[];
};

type DemoProductBlueprint = {
  readonly id: string;
  readonly slug: string;
  readonly internalReference: string;
  readonly categorySlug: string;
  readonly collectionIds: readonly string[];
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

const PRODUCT_BLUEPRINTS = deepFreeze([
  {
    id: "demo-product-sculptural-tray",
    slug: "demo-sculptural-tray",
    internalReference: "DEMO-RD-001",
    categorySlug: "demo-trays",
    collectionIds: [
      "demo-collection-material-dialogue",
      "demo-collection-surface-studies",
    ],
    featured: true,
  },
  {
    id: "demo-product-tall-vessel",
    slug: "demo-tall-vessel",
    internalReference: "DEMO-RD-002",
    categorySlug: "demo-vessels",
    collectionIds: ["demo-collection-material-dialogue"],
    featured: true,
  },
  {
    id: "demo-product-keepsake-box",
    slug: "demo-keepsake-box",
    internalReference: "DEMO-RD-003",
    categorySlug: "demo-boxes",
    collectionIds: [
      "demo-collection-quiet-geometry",
      "demo-collection-surface-studies",
    ],
    featured: true,
  },
  {
    id: "demo-product-table-object",
    slug: "demo-table-object",
    internalReference: "DEMO-RD-004",
    categorySlug: "demo-objects",
    collectionIds: ["demo-collection-quiet-geometry"],
    featured: false,
  },
] satisfies readonly DemoProductBlueprint[]);

const DEMO_PRODUCT_COPY = deepFreeze({
  vi: {
    replacementHint:
      "Thay ảnh mẫu bằng metadata/publicId Cloudinary của ảnh sản phẩm đã được phê duyệt.",
    products: [
      {
        name: "Nghiên cứu khay tạo hình — DEMO",
        categoryLabel: "Khay — DEMO",
        summary:
          "Bản ghi giữ chỗ để kiểm thử tỷ lệ ảnh, tiêu đề và lời kêu gọi yêu cầu báo giá.",
        story:
          "Câu chuyện DEMO này không mô tả sản phẩm thật. Hãy thay bằng nội dung, vật liệu và hình ảnh đã được phê duyệt.",
        materialLabel: "DEMO — vật liệu chưa được xác minh",
        finishLabel: "DEMO — bề mặt hoàn thiện chưa được xác minh",
        imageAlt: "Ảnh giữ chỗ DEMO cho một mẫu khay tạo hình",
        demoTag: "DEMO",
        placeholderTag: "Chờ dữ liệu catalogue",
      },
      {
        name: "Nghiên cứu bình dáng đứng — DEMO",
        categoryLabel: "Bình — DEMO",
        summary:
          "Bản ghi giữ chỗ cho một bố cục sản phẩm có dáng đứng và thông tin báo giá theo yêu cầu.",
        story:
          "Không có vật liệu, kích thước hay kỹ thuật sản xuất nào được khẳng định trong bản ghi DEMO này.",
        materialLabel: "DEMO — vật liệu chưa được xác minh",
        finishLabel: "DEMO — màu và hoàn thiện đang chờ phê duyệt",
        imageAlt: "Ảnh giữ chỗ DEMO cho một mẫu bình dáng đứng",
        demoTag: "DEMO",
        placeholderTag: "Chờ dữ liệu catalogue",
      },
      {
        name: "Nghiên cứu hộp lưu trữ — DEMO",
        categoryLabel: "Hộp — DEMO",
        summary:
          "Bản ghi giữ chỗ để kiểm thử gallery, thông số rỗng và nội dung liên quan.",
        story:
          "Hãy thay câu chuyện DEMO bằng mô tả đã duyệt của sản phẩm thực tế trước khi xuất bản.",
        materialLabel: "DEMO — vật liệu chưa được xác minh",
        finishLabel: "DEMO — hoàn thiện đang chờ phê duyệt",
        imageAlt: "Ảnh giữ chỗ DEMO cho một mẫu hộp lưu trữ",
        demoTag: "DEMO",
        placeholderTag: "Chờ dữ liệu catalogue",
      },
      {
        name: "Nghiên cứu vật thể để bàn — DEMO",
        categoryLabel: "Vật thể trang trí — DEMO",
        summary:
          "Bản ghi giữ chỗ cho sản phẩm không công khai giá và chưa có thông số được xác minh.",
        story:
          "Bản ghi DEMO chỉ phục vụ phát triển giao diện và không đại diện cho catalogue thật.",
        materialLabel: "DEMO — vật liệu chưa được xác minh",
        finishLabel: "DEMO — hoàn thiện đang chờ phê duyệt",
        imageAlt: "Ảnh giữ chỗ DEMO cho một vật thể để bàn",
        demoTag: "DEMO",
        placeholderTag: "Chờ dữ liệu catalogue",
      },
    ],
  },
  en: {
    replacementHint:
      "Replace this placeholder with approved product-image metadata and a Cloudinary publicId.",
    products: [
      {
        name: "Sculptural tray study — DEMO",
        categoryLabel: "Trays — DEMO",
        summary:
          "A placeholder record for testing image proportions, titles, and the quote-request call to action.",
        story:
          "This DEMO story does not describe a real product. Replace it with approved copy, materials, and imagery.",
        materialLabel: "DEMO — material not verified",
        finishLabel: "DEMO — finish not verified",
        imageAlt: "DEMO placeholder for a sculptural tray study",
        demoTag: "DEMO",
        placeholderTag: "Catalogue data pending",
      },
      {
        name: "Tall vessel study — DEMO",
        categoryLabel: "Vessels — DEMO",
        summary:
          "A placeholder record for a vertical product composition and an enquiry-only price treatment.",
        story:
          "No material, dimension, or production technique is asserted by this DEMO record.",
        materialLabel: "DEMO — material not verified",
        finishLabel: "DEMO — colour and finish pending approval",
        imageAlt: "DEMO placeholder for a tall vessel study",
        demoTag: "DEMO",
        placeholderTag: "Catalogue data pending",
      },
      {
        name: "Keepsake box study — DEMO",
        categoryLabel: "Boxes — DEMO",
        summary:
          "A placeholder record for testing a gallery, intentionally empty specifications, and related content.",
        story:
          "Replace this DEMO story with the approved description of an actual product before publication.",
        materialLabel: "DEMO — material not verified",
        finishLabel: "DEMO — finish pending approval",
        imageAlt: "DEMO placeholder for a keepsake box study",
        demoTag: "DEMO",
        placeholderTag: "Catalogue data pending",
      },
      {
        name: "Table object study — DEMO",
        categoryLabel: "Decorative objects — DEMO",
        summary:
          "A placeholder record for a product without a public price or verified specifications.",
        story:
          "This DEMO record exists only for interface development and does not represent the real catalogue.",
        materialLabel: "DEMO — material not verified",
        finishLabel: "DEMO — finish pending approval",
        imageAlt: "DEMO placeholder for a table object study",
        demoTag: "DEMO",
        placeholderTag: "Catalogue data pending",
      },
    ],
  },
  fr: {
    replacementHint:
      "Remplacer ce fichier par les métadonnées et le publicId Cloudinary d'une image produit approuvée.",
    products: [
      {
        name: "Étude de plateau sculptural — DÉMO",
        categoryLabel: "Plateaux — DÉMO",
        summary:
          "Une fiche temporaire pour tester les proportions d'image, les titres et l'appel à demander un devis.",
        story:
          "Ce récit DÉMO ne décrit aucun produit réel. Remplacez-le par les textes, matières et images approuvés.",
        materialLabel: "DÉMO — matière non vérifiée",
        finishLabel: "DÉMO — finition non vérifiée",
        imageAlt: "Image DÉMO temporaire pour une étude de plateau sculptural",
        demoTag: "DÉMO",
        placeholderTag: "Données catalogue en attente",
      },
      {
        name: "Étude de vase élancé — DÉMO",
        categoryLabel: "Vases — DÉMO",
        summary:
          "Une fiche temporaire pour une composition verticale et un prix communiqué uniquement sur demande.",
        story:
          "Cette fiche DÉMO n'affirme aucune matière, dimension ou technique de fabrication.",
        materialLabel: "DÉMO — matière non vérifiée",
        finishLabel: "DÉMO — couleur et finition en attente d'approbation",
        imageAlt: "Image DÉMO temporaire pour une étude de vase élancé",
        demoTag: "DÉMO",
        placeholderTag: "Données catalogue en attente",
      },
      {
        name: "Étude de boîte à souvenirs — DÉMO",
        categoryLabel: "Boîtes — DÉMO",
        summary:
          "Une fiche temporaire pour tester la galerie, l'absence volontaire de caractéristiques et les contenus associés.",
        story:
          "Remplacez ce récit DÉMO par la description approuvée d'un produit réel avant publication.",
        materialLabel: "DÉMO — matière non vérifiée",
        finishLabel: "DÉMO — finition en attente d'approbation",
        imageAlt: "Image DÉMO temporaire pour une étude de boîte à souvenirs",
        demoTag: "DÉMO",
        placeholderTag: "Données catalogue en attente",
      },
      {
        name: "Étude d'objet de table — DÉMO",
        categoryLabel: "Objets décoratifs — DÉMO",
        summary:
          "Une fiche temporaire pour un produit sans prix public ni caractéristiques vérifiées.",
        story:
          "Cette fiche DÉMO sert uniquement au développement de l'interface et ne représente pas le véritable catalogue.",
        materialLabel: "DÉMO — matière non vérifiée",
        finishLabel: "DÉMO — finition en attente d'approbation",
        imageAlt: "Image DÉMO temporaire pour une étude d'objet de table",
        demoTag: "DÉMO",
        placeholderTag: "Données catalogue en attente",
      },
    ],
  },
  de: {
    replacementHint:
      "Platzhalter durch freigegebene Produktbild-Metadaten und eine Cloudinary-publicId ersetzen.",
    products: [
      {
        name: "Studie eines skulpturalen Tabletts — DEMO",
        categoryLabel: "Tabletts — DEMO",
        summary:
          "Ein Platzhalterdatensatz zum Testen von Bildproportionen, Titeln und Angebotsanfragen.",
        story:
          "Diese DEMO-Geschichte beschreibt kein echtes Produkt. Sie ist durch freigegebene Texte, Materialien und Bilder zu ersetzen.",
        materialLabel: "DEMO — Material nicht bestätigt",
        finishLabel: "DEMO — Oberfläche nicht bestätigt",
        imageAlt: "DEMO-Platzhalter für die Studie eines skulpturalen Tabletts",
        demoTag: "DEMO",
        placeholderTag: "Katalogdaten ausstehend",
      },
      {
        name: "Studie eines hohen Gefäßes — DEMO",
        categoryLabel: "Gefäße — DEMO",
        summary:
          "Ein Platzhalterdatensatz für eine vertikale Produktkomposition und Preisangaben nur auf Anfrage.",
        story:
          "Dieser DEMO-Datensatz macht keine Angaben zu Material, Abmessungen oder Fertigungstechnik.",
        materialLabel: "DEMO — Material nicht bestätigt",
        finishLabel: "DEMO — Farbe und Oberfläche warten auf Freigabe",
        imageAlt: "DEMO-Platzhalter für die Studie eines hohen Gefäßes",
        demoTag: "DEMO",
        placeholderTag: "Katalogdaten ausstehend",
      },
      {
        name: "Studie einer Erinnerungsbox — DEMO",
        categoryLabel: "Boxen — DEMO",
        summary:
          "Ein Platzhalterdatensatz zum Testen von Galerie, bewusst leeren Spezifikationen und verwandten Inhalten.",
        story:
          "Vor der Veröffentlichung ist diese DEMO-Geschichte durch die freigegebene Beschreibung eines echten Produkts zu ersetzen.",
        materialLabel: "DEMO — Material nicht bestätigt",
        finishLabel: "DEMO — Oberfläche wartet auf Freigabe",
        imageAlt: "DEMO-Platzhalter für die Studie einer Erinnerungsbox",
        demoTag: "DEMO",
        placeholderTag: "Katalogdaten ausstehend",
      },
      {
        name: "Studie eines Tischobjekts — DEMO",
        categoryLabel: "Dekorative Objekte — DEMO",
        summary:
          "Ein Platzhalterdatensatz für ein Produkt ohne öffentlichen Preis oder bestätigte Spezifikationen.",
        story:
          "Dieser DEMO-Datensatz dient nur der Oberflächenentwicklung und stellt nicht den echten Katalog dar.",
        materialLabel: "DEMO — Material nicht bestätigt",
        finishLabel: "DEMO — Oberfläche wartet auf Freigabe",
        imageAlt: "DEMO-Platzhalter für die Studie eines Tischobjekts",
        demoTag: "DEMO",
        placeholderTag: "Katalogdaten ausstehend",
      },
    ],
  },
  ja: {
    replacementHint:
      "仮画像を、承認済みの製品画像メタデータと Cloudinary publicId に差し替えてください。",
    products: [
      {
        name: "造形トレーのスタディ — デモ",
        categoryLabel: "トレー — デモ",
        summary:
          "画像比率、見出し、見積もり依頼への導線を確認するための仮データです。",
        story:
          "このデモ文章は実在製品を説明するものではありません。承認済みの文章、素材情報、画像に差し替えてください。",
        materialLabel: "デモ — 素材未確認",
        finishLabel: "デモ — 仕上げ未確認",
        imageAlt: "造形トレーのスタディ用デモ画像",
        demoTag: "デモ",
        placeholderTag: "カタログデータ待ち",
      },
      {
        name: "縦長の器のスタディ — デモ",
        categoryLabel: "器 — デモ",
        summary:
          "縦長の製品構図と、問い合わせ時にのみ価格を提示する表示を確認するための仮データです。",
        story:
          "このデモデータは、素材、寸法、製造技法について事実を示しません。",
        materialLabel: "デモ — 素材未確認",
        finishLabel: "デモ — 色と仕上げは承認待ち",
        imageAlt: "縦長の器のスタディ用デモ画像",
        demoTag: "デモ",
        placeholderTag: "カタログデータ待ち",
      },
      {
        name: "小箱のスタディ — デモ",
        categoryLabel: "箱 — デモ",
        summary:
          "ギャラリー、意図的に空の仕様、関連コンテンツを確認するための仮データです。",
        story:
          "公開前に、このデモ文章を実際の製品について承認された説明へ差し替えてください。",
        materialLabel: "デモ — 素材未確認",
        finishLabel: "デモ — 仕上げは承認待ち",
        imageAlt: "小箱のスタディ用デモ画像",
        demoTag: "デモ",
        placeholderTag: "カタログデータ待ち",
      },
      {
        name: "卓上オブジェのスタディ — デモ",
        categoryLabel: "装飾オブジェ — デモ",
        summary:
          "公開価格と確認済み仕様を持たない製品表示を確認するための仮データです。",
        story:
          "このデモデータは画面開発専用であり、実際のカタログを表すものではありません。",
        materialLabel: "デモ — 素材未確認",
        finishLabel: "デモ — 仕上げは承認待ち",
        imageAlt: "卓上オブジェのスタディ用デモ画像",
        demoTag: "デモ",
        placeholderTag: "カタログデータ待ち",
      },
    ],
  },
  "zh-CN": {
    replacementHint:
      "请将占位图替换为经批准的产品图片元数据和 Cloudinary publicId。",
    products: [
      {
        name: "造型托盘研究 — 演示",
        categoryLabel: "托盘 — 演示",
        summary: "用于测试图片比例、标题和报价申请按钮的占位记录。",
        story:
          "此演示故事不描述真实产品。请替换为经批准的文案、材料信息和图片。",
        materialLabel: "演示 — 材料未经核实",
        finishLabel: "演示 — 表面处理未经核实",
        imageAlt: "造型托盘研究的演示占位图",
        demoTag: "演示",
        placeholderTag: "等待目录数据",
      },
      {
        name: "高挑器皿研究 — 演示",
        categoryLabel: "器皿 — 演示",
        summary: "用于测试纵向产品构图和仅咨询报价显示方式的占位记录。",
        story: "此演示记录不对材料、尺寸或生产技法作任何事实陈述。",
        materialLabel: "演示 — 材料未经核实",
        finishLabel: "演示 — 颜色和表面处理等待批准",
        imageAlt: "高挑器皿研究的演示占位图",
        demoTag: "演示",
        placeholderTag: "等待目录数据",
      },
      {
        name: "珍藏盒研究 — 演示",
        categoryLabel: "盒具 — 演示",
        summary: "用于测试图集、特意留空的规格和相关内容的占位记录。",
        story: "发布前请将此演示故事替换为真实产品的经批准说明。",
        materialLabel: "演示 — 材料未经核实",
        finishLabel: "演示 — 表面处理等待批准",
        imageAlt: "珍藏盒研究的演示占位图",
        demoTag: "演示",
        placeholderTag: "等待目录数据",
      },
      {
        name: "桌面摆件研究 — 演示",
        categoryLabel: "装饰摆件 — 演示",
        summary: "用于测试无公开价格、无核实规格产品的占位记录。",
        story: "此演示记录仅用于界面开发，不代表真实目录。",
        materialLabel: "演示 — 材料未经核实",
        finishLabel: "演示 — 表面处理等待批准",
        imageAlt: "桌面摆件研究的演示占位图",
        demoTag: "演示",
        placeholderTag: "等待目录数据",
      },
    ],
  },
} satisfies Record<Locale, DemoProductLocaleCopy>);

function makeImage(
  productId: string,
  alt: string,
  replacementHint: string,
): PublicProductImage {
  return {
    assetKey: `${productId}-primary`,
    src: "/file.svg",
    alt,
    width: 1200,
    height: 1500,
    isPrimary: true,
    isDemo: true,
    replacementHint,
  };
}

function makeProducts(locale: Locale): readonly PublicProduct[] {
  const localeCopy = DEMO_PRODUCT_COPY[locale];

  return deepFreeze(
    PRODUCT_BLUEPRINTS.map((blueprint, index) => {
      const copy = localeCopy.products[index];

      if (!copy) {
        throw new Error(
          `Missing DEMO product copy for ${locale} at index ${index}.`,
        );
      }

      return {
        id: blueprint.id,
        marker: "DEMO",
        isDemo: true,
        locale,
        slug: blueprint.slug,
        internalReference: blueprint.internalReference,
        name: copy.name,
        categorySlug: blueprint.categorySlug,
        categoryLabel: copy.categoryLabel,
        summary: copy.summary,
        story: copy.story,
        materialLabels: [copy.materialLabel],
        finishLabel: copy.finishLabel,
        dimensions: null,
        leadTime: null,
        showPrice: false,
        price: null,
        images: [
          makeImage(blueprint.id, copy.imageAlt, localeCopy.replacementHint),
        ],
        video: null,
        variants: [],
        processSteps: [],
        tags: [copy.demoTag, copy.placeholderTag],
        collectionIds: blueprint.collectionIds,
        featured: blueprint.featured,
        sortOrder: index + 1,
      } satisfies PublicProduct;
    }),
  );
}

export const DEMO_PRODUCTS_BY_LOCALE: Readonly<
  Record<Locale, readonly PublicProduct[]>
> = deepFreeze({
  vi: makeProducts("vi"),
  en: makeProducts("en"),
  fr: makeProducts("fr"),
  de: makeProducts("de"),
  ja: makeProducts("ja"),
  "zh-CN": makeProducts("zh-CN"),
});

function applyListOptions(
  products: readonly PublicProduct[],
  options?: PublicProductListOptions,
): readonly PublicProduct[] {
  if (!options) {
    return products;
  }

  let result = products.filter((product) => {
    if (options.featuredOnly && !product.featured) {
      return false;
    }
    if (
      options.collectionId &&
      !product.collectionIds.includes(options.collectionId)
    ) {
      return false;
    }
    if (options.categorySlug && product.categorySlug !== options.categorySlug) {
      return false;
    }
    return true;
  });

  if (options.limit !== undefined) {
    const limit = Math.max(0, Math.trunc(options.limit));
    result = result.slice(0, limit);
  }

  return deepFreeze(result);
}

const demoProductRepositoryImplementation: PublicProductRepository = {
  async list(locale, options) {
    return applyListOptions(DEMO_PRODUCTS_BY_LOCALE[locale], options);
  },
  async getById(locale, id) {
    return (
      DEMO_PRODUCTS_BY_LOCALE[locale].find((product) => product.id === id) ??
      null
    );
  },
  async getBySlug(locale, slug) {
    return (
      DEMO_PRODUCTS_BY_LOCALE[locale].find(
        (product) => product.slug === slug,
      ) ?? null
    );
  },
};

export const demoProductRepository: PublicProductRepository = Object.freeze(
  demoProductRepositoryImplementation,
);
