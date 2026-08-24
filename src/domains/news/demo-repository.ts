import type { Locale } from "@/lib/i18n/config";

import type {
  PublicNewsArticle,
  PublicNewsImage,
  PublicNewsListOptions,
  PublicNewsRepository,
} from "./public-contract";

type DemoNewsCopy = {
  readonly title: string;
  readonly excerpt: string;
  readonly body: string;
  readonly categoryLabel: string;
  readonly tags: readonly string[];
  readonly imageAlt: string;
};

type DemoNewsLocaleCopy = {
  readonly replacementHint: string;
  readonly articles: readonly DemoNewsCopy[];
};

type DemoNewsBlueprint = {
  readonly id: string;
  readonly slug: string;
  readonly categorySlug: string;
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

const NEWS_BLUEPRINTS = deepFreeze([
  {
    id: "demo-news-approved-stories",
    slug: "demo-approved-stories",
    categorySlug: "demo-editorial",
    featured: true,
  },
  {
    id: "demo-news-collection-preview",
    slug: "demo-collection-preview",
    categorySlug: "demo-collections",
    featured: true,
  },
  {
    id: "demo-news-process-content",
    slug: "demo-process-content",
    categorySlug: "demo-process",
    featured: false,
  },
] satisfies readonly DemoNewsBlueprint[]);

const DEMO_NEWS_COPY = deepFreeze({
  vi: {
    replacementHint:
      "Thay ảnh mẫu bằng metadata/publicId Cloudinary của ảnh bài viết đã được phê duyệt.",
    articles: [
      {
        title: "Cách câu chuyện đã duyệt sẽ xuất hiện — DEMO",
        excerpt:
          "Bài giữ chỗ minh họa nhịp điệu tiêu đề, tóm tắt và thẻ nội dung mà không tự tạo tin tức doanh nghiệp.",
        body: "Nội dung DEMO này chỉ dùng để kiểm thử bố cục. Hãy thay bằng bài viết có tác giả, ngày đăng và thông tin đã được doanh nghiệp phê duyệt.",
        categoryLabel: "Biên tập — DEMO",
        tags: ["DEMO", "Chờ nội dung đã duyệt"],
        imageAlt:
          "Ảnh giữ chỗ DEMO cho một bài viết đã được phê duyệt trong tương lai",
      },
      {
        title: "Chuẩn bị câu chuyện collection — DEMO",
        excerpt:
          "Bài giữ chỗ cho nội dung giới thiệu collection, chưa đại diện cho một lần ra mắt hoặc catalogue thật.",
        body: "Khi có dữ liệu thật, bài viết này có thể liên kết landing page HTML, sản phẩm và flipbook theo locale. Hiện tại không có năm phát hành hoặc PDF nào được khẳng định.",
        categoryLabel: "Bộ sưu tập — DEMO",
        tags: ["DEMO", "Bộ sưu tập mẫu"],
        imageAlt: "Ảnh giữ chỗ DEMO cho câu chuyện collection",
      },
      {
        title: "Khung bài viết về quy trình — DEMO",
        excerpt:
          "Bài giữ chỗ cho hình ảnh, chú thích và nội dung quy trình đã được xưởng xác minh.",
        body: "Không có vật liệu, số lớp, thời gian hay phương pháp cụ thể nào được nêu như sự thật. Tất cả phải được thay bằng thông tin được phép xuất bản.",
        categoryLabel: "Quy trình — DEMO",
        tags: ["DEMO", "Chờ xác minh"],
        imageAlt: "Ảnh giữ chỗ DEMO cho bài viết về quy trình",
      },
    ],
  },
  en: {
    replacementHint:
      "Replace this placeholder with approved article-image metadata and a Cloudinary publicId.",
    articles: [
      {
        title: "How approved stories will appear — DEMO",
        excerpt:
          "A placeholder article demonstrating title, summary, and card rhythm without inventing company news.",
        body: "This DEMO content exists only to test the layout. Replace it with an approved article carrying a verified author, publication date, and facts.",
        categoryLabel: "Editorial — DEMO",
        tags: ["DEMO", "Approved content pending"],
        imageAlt: "DEMO placeholder for a future approved article",
      },
      {
        title: "Preparing a collection story — DEMO",
        excerpt:
          "A placeholder for collection editorial content that does not represent a real launch or catalogue.",
        body: "With verified data, this article can link to the localized HTML landing page, products, and flipbook. No release year or PDF is asserted here.",
        categoryLabel: "Collections — DEMO",
        tags: ["DEMO", "Sample collection"],
        imageAlt: "DEMO placeholder for a collection story",
      },
      {
        title: "A framework for process editorial — DEMO",
        excerpt:
          "A placeholder for workshop-verified process imagery, captions, and editorial copy.",
        body: "No specific material, layer count, duration, or method is presented as fact. Everything must be replaced with information approved for publication.",
        categoryLabel: "Process — DEMO",
        tags: ["DEMO", "Verification pending"],
        imageAlt: "DEMO placeholder for a process article",
      },
    ],
  },
  fr: {
    replacementHint:
      "Remplacer ce fichier par les métadonnées et le publicId Cloudinary d'une image d'article approuvée.",
    articles: [
      {
        title: "Présentation des récits approuvés — DÉMO",
        excerpt:
          "Un article temporaire illustrant le rythme des titres, résumés et cartes sans inventer d'actualité d'entreprise.",
        body: "Ce contenu DÉMO sert uniquement à tester la mise en page. Remplacez-le par un article approuvé avec auteur, date de publication et faits vérifiés.",
        categoryLabel: "Éditorial — DÉMO",
        tags: ["DÉMO", "Contenu approuvé en attente"],
        imageAlt: "Image DÉMO temporaire pour un futur article approuvé",
      },
      {
        title: "Préparer un récit de collection — DÉMO",
        excerpt:
          "Un contenu temporaire de collection qui ne représente ni lancement réel ni catalogue existant.",
        body: "Avec des données vérifiées, cet article pourra relier la page HTML localisée, les produits et le flipbook. Il n'affirme ici aucune année de sortie ni aucun PDF.",
        categoryLabel: "Collections — DÉMO",
        tags: ["DÉMO", "Collection temporaire"],
        imageAlt: "Image DÉMO temporaire pour un récit de collection",
      },
      {
        title: "Une structure éditoriale pour le procédé — DÉMO",
        excerpt:
          "Un espace réservé aux images, légendes et textes de procédé vérifiés par l'atelier.",
        body: "Aucune matière, aucun nombre de couches, aucune durée ni méthode précise n'est présenté comme un fait. Tout doit être remplacé par des informations approuvées pour publication.",
        categoryLabel: "Procédé — DÉMO",
        tags: ["DÉMO", "Vérification en attente"],
        imageAlt: "Image DÉMO temporaire pour un article sur le procédé",
      },
    ],
  },
  de: {
    replacementHint:
      "Platzhalter durch freigegebene Artikelbild-Metadaten und eine Cloudinary-publicId ersetzen.",
    articles: [
      {
        title: "So erscheinen freigegebene Geschichten — DEMO",
        excerpt:
          "Ein Platzhalterbeitrag für Titel-, Zusammenfassungs- und Kartenrhythmus, ohne Unternehmensnachrichten zu erfinden.",
        body: "Dieser DEMO-Inhalt dient ausschließlich dem Layouttest. Er ist durch einen freigegebenen Beitrag mit bestätigtem Autor, Datum und Fakten zu ersetzen.",
        categoryLabel: "Redaktion — DEMO",
        tags: ["DEMO", "Freigegebene Inhalte ausstehend"],
        imageAlt: "DEMO-Platzhalter für einen künftig freigegebenen Beitrag",
      },
      {
        title: "Eine Kollektionsgeschichte vorbereiten — DEMO",
        excerpt:
          "Ein redaktioneller Kollektionsplatzhalter, der keine echte Einführung und keinen realen Katalog darstellt.",
        body: "Mit geprüften Daten kann dieser Beitrag auf die lokalisierte HTML-Seite, Produkte und das Flipbook verweisen. Ein Erscheinungsjahr oder PDF wird hier nicht behauptet.",
        categoryLabel: "Kollektionen — DEMO",
        tags: ["DEMO", "Beispielkollektion"],
        imageAlt: "DEMO-Platzhalter für eine Kollektionsgeschichte",
      },
      {
        title: "Ein Rahmen für Prozessbeiträge — DEMO",
        excerpt:
          "Ein Platzhalter für von der Werkstatt bestätigte Prozessbilder, Bildtexte und redaktionelle Inhalte.",
        body: "Kein Material, keine Schichtzahl, Dauer oder Methode wird als Tatsache dargestellt. Alles ist durch zur Veröffentlichung freigegebene Informationen zu ersetzen.",
        categoryLabel: "Prozess — DEMO",
        tags: ["DEMO", "Bestätigung ausstehend"],
        imageAlt: "DEMO-Platzhalter für einen Prozessbeitrag",
      },
    ],
  },
  ja: {
    replacementHint:
      "仮画像を、承認済みの記事画像メタデータと Cloudinary publicId に差し替えてください。",
    articles: [
      {
        title: "承認済みの物語の見せ方 — デモ",
        excerpt:
          "架空の会社ニュースを作らず、見出し、要約、カードのリズムを確認するための仮記事です。",
        body: "このデモ文章はレイアウト確認専用です。確認済みの執筆者、公開日、事実を備えた承認済み記事に差し替えてください。",
        categoryLabel: "読み物 — デモ",
        tags: ["デモ", "承認済みコンテンツ待ち"],
        imageAlt: "今後の承認済み記事に使用するデモ画像",
      },
      {
        title: "コレクションストーリーの準備 — デモ",
        excerpt:
          "実際の発表やカタログを表さない、コレクション記事用の仮コンテンツです。",
        body: "確認済みデータが揃えば、各言語の HTML ページ、製品、フリップブックへリンクできます。ここでは発表年や PDF の存在を示しません。",
        categoryLabel: "コレクション — デモ",
        tags: ["デモ", "サンプルコレクション"],
        imageAlt: "コレクションストーリー用デモ画像",
      },
      {
        title: "工程記事のための構成 — デモ",
        excerpt: "工房が確認した工程写真、説明、文章を掲載するための仮枠です。",
        body: "特定の素材、層数、期間、手法を事実として記載していません。公開承認済みの情報へすべて差し替える必要があります。",
        categoryLabel: "工程 — デモ",
        tags: ["デモ", "確認待ち"],
        imageAlt: "工程記事用デモ画像",
      },
    ],
  },
  "zh-CN": {
    replacementHint:
      "请将占位图替换为经批准的文章图片元数据和 Cloudinary publicId。",
    articles: [
      {
        title: "经批准的故事将如何呈现 — 演示",
        excerpt: "用于测试标题、摘要和卡片节奏的占位文章，不虚构公司新闻。",
        body: "此演示内容仅用于测试布局。请替换为带有核实作者、发布日期和事实的经批准文章。",
        categoryLabel: "编辑内容 — 演示",
        tags: ["演示", "等待批准内容"],
        imageAlt: "用于未来经批准文章的演示占位图",
      },
      {
        title: "准备系列故事 — 演示",
        excerpt: "系列编辑内容的占位文章，不代表真实发布或目录。",
        body: "获得核实数据后，此文章可链接到本地化 HTML 页面、产品和翻页画册。这里不声称任何发布年份或 PDF。",
        categoryLabel: "系列 — 演示",
        tags: ["演示", "示例系列"],
        imageAlt: "系列故事的演示占位图",
      },
      {
        title: "工序编辑内容框架 — 演示",
        excerpt: "为经工坊核实的工序图片、说明和编辑文案预留的占位文章。",
        body: "本段不把任何具体材料、层数、时间或方法作为事实。所有内容均须替换为获准发布的信息。",
        categoryLabel: "工序 — 演示",
        tags: ["演示", "等待核实"],
        imageAlt: "工序文章的演示占位图",
      },
    ],
  },
} satisfies Record<Locale, DemoNewsLocaleCopy>);

function makeImage(
  articleId: string,
  alt: string,
  replacementHint: string,
): PublicNewsImage {
  return {
    assetKey: `${articleId}-hero`,
    src: "/file.svg",
    alt,
    width: 1400,
    height: 900,
    isDemo: true,
    replacementHint,
  };
}

function makeArticles(locale: Locale): readonly PublicNewsArticle[] {
  const localeCopy = DEMO_NEWS_COPY[locale];

  return deepFreeze(
    NEWS_BLUEPRINTS.map((blueprint, index) => {
      const copy = localeCopy.articles[index];

      if (!copy) {
        throw new Error(
          `Missing DEMO news copy for ${locale} at index ${index}.`,
        );
      }

      return {
        id: blueprint.id,
        marker: "DEMO",
        isDemo: true,
        locale,
        slug: blueprint.slug,
        title: copy.title,
        excerpt: copy.excerpt,
        content: [{ type: "paragraph", text: copy.body }],
        categorySlug: blueprint.categorySlug,
        categoryLabel: copy.categoryLabel,
        tags: copy.tags,
        author: null,
        publishedAt: null,
        image: makeImage(
          blueprint.id,
          copy.imageAlt,
          localeCopy.replacementHint,
        ),
        featured: blueprint.featured,
        sortOrder: index + 1,
      } satisfies PublicNewsArticle;
    }),
  );
}

export const DEMO_NEWS_BY_LOCALE: Readonly<
  Record<Locale, readonly PublicNewsArticle[]>
> = deepFreeze({
  vi: makeArticles("vi"),
  en: makeArticles("en"),
  fr: makeArticles("fr"),
  de: makeArticles("de"),
  ja: makeArticles("ja"),
  "zh-CN": makeArticles("zh-CN"),
});

function applyListOptions(
  articles: readonly PublicNewsArticle[],
  options?: PublicNewsListOptions,
): readonly PublicNewsArticle[] {
  if (!options) {
    return articles;
  }

  let result = articles.filter((article) => {
    if (options.featuredOnly && !article.featured) {
      return false;
    }
    if (options.categorySlug && article.categorySlug !== options.categorySlug) {
      return false;
    }
    return true;
  });

  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  result = result.slice(offset);

  if (options.limit !== undefined) {
    const limit = Math.max(0, Math.trunc(options.limit));
    result = result.slice(0, limit);
  }

  return deepFreeze(result);
}

const demoNewsRepositoryImplementation: PublicNewsRepository = {
  async list(locale, options) {
    return applyListOptions(DEMO_NEWS_BY_LOCALE[locale], options);
  },
  async getById(locale, id) {
    return (
      DEMO_NEWS_BY_LOCALE[locale].find((article) => article.id === id) ?? null
    );
  },
  async getBySlug(locale, slug) {
    return (
      DEMO_NEWS_BY_LOCALE[locale].find((article) => article.slug === slug) ??
      null
    );
  },
};

export const demoNewsRepository: PublicNewsRepository = Object.freeze(
  demoNewsRepositoryImplementation,
);
