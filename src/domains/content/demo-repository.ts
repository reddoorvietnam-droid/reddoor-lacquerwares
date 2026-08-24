import type { Locale } from "@/lib/i18n/config";

import type {
  PublicCompanyProfile,
  PublicContentRepository,
  PublicContentSnapshot,
  PublicHistoryMilestone,
  PublicImageAsset,
  PublicProcessStage,
  PublicSiteSettings,
  PublicSocialLink,
} from "./public-contract";

type DemoHistoryCopy = {
  readonly periodLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly imageAlt: string;
};

type DemoProcessCopy = {
  readonly stepLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly imageAlt: string;
};

type DemoContentCopy = {
  readonly company: {
    readonly eyebrow: string;
    readonly tagline: string;
    readonly summary: string;
    readonly contentNotice: string;
    readonly heroAlt: string;
  };
  readonly assetReplacementHint: string;
  readonly contactNotice: string;
  readonly history: readonly DemoHistoryCopy[];
  readonly process: readonly DemoProcessCopy[];
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

const DEMO_CONTENT_COPY = deepFreeze({
  vi: {
    company: {
      eyebrow: "HỒ SƠ DOANH NGHIỆP — DEMO",
      tagline: "Không gian dành cho tuyên ngôn thương hiệu đã duyệt",
      summary:
        "Đây là nội dung DEMO. Hãy thay bằng câu chuyện, giá trị và năng lực chính thức do Cửa Đỏ Việt Nam xác nhận; đoạn này không đưa ra tuyên bố về lịch sử, khách hàng hay chứng nhận.",
      contentNotice:
        "DEMO — chưa phải nội dung doanh nghiệp được phép xuất bản.",
      heroAlt: "Khung ảnh thương hiệu DEMO đang chờ tài sản được phê duyệt",
    },
    assetReplacementHint:
      "Thay tệp mẫu bằng publicId Cloudinary hoặc tài sản thương hiệu đã được phê duyệt.",
    contactNotice:
      "DEMO — email, số điện thoại, địa chỉ và bản đồ chưa được cung cấp hoặc xác minh.",
    history: [
      {
        periodLabel: "Chương DEMO 01",
        title: "Điểm khởi đầu đang chờ xác minh",
        summary:
          "Vị trí này dành cho mốc thành lập và bối cảnh doanh nghiệp sau khi được người có thẩm quyền xác nhận.",
        imageAlt: "Khung ảnh DEMO cho chương mở đầu của lịch sử công ty",
      },
      {
        periodLabel: "Chương DEMO 02",
        title: "Câu chuyện xưởng đang chờ nội dung thật",
        summary:
          "Vị trí này dành cho thông tin đã duyệt về con người, không gian làm việc và quá trình phát triển sản phẩm.",
        imageAlt: "Khung ảnh DEMO cho câu chuyện xưởng được xác minh",
      },
      {
        periodLabel: "Chương DEMO 03",
        title: "Hướng đi tiếp theo đang chờ phê duyệt",
        summary:
          "Vị trí này dành cho định hướng tương lai do doanh nghiệp cung cấp, không phải lời khẳng định hiện tại.",
        imageAlt: "Khung ảnh DEMO cho định hướng tương lai đã được phê duyệt",
      },
    ],
    process: [
      {
        stepLabel: "Bước DEMO 01",
        title: "Ý tưởng và yêu cầu vật liệu",
        summary:
          "Khung nội dung để mô tả cách một dự án bắt đầu sau khi quy trình thật được xưởng xác nhận.",
        imageAlt: "Khung ảnh DEMO cho giai đoạn ý tưởng",
      },
      {
        stepLabel: "Bước DEMO 02",
        title: "Chuẩn bị bề mặt",
        summary:
          "Khung nội dung để giải thích việc chuẩn bị nền; chưa mô tả vật liệu, số lớp hoặc kỹ thuật cụ thể của doanh nghiệp.",
        imageAlt: "Khung ảnh DEMO cho giai đoạn chuẩn bị bề mặt",
      },
      {
        stepLabel: "Bước DEMO 03",
        title: "Tạo lớp và hoàn thiện chi tiết",
        summary:
          "Khung nội dung dành cho các công đoạn đã được xác minh, hình ảnh xưởng thật và chú thích an toàn.",
        imageAlt: "Khung ảnh DEMO cho công đoạn tạo lớp",
      },
      {
        stepLabel: "Bước DEMO 04",
        title: "Kiểm tra và hoàn thiện",
        summary:
          "Khung nội dung để trình bày tiêu chí hoàn thiện đã được doanh nghiệp phê duyệt.",
        imageAlt: "Khung ảnh DEMO cho giai đoạn kiểm tra hoàn thiện",
      },
    ],
  },
  en: {
    company: {
      eyebrow: "COMPANY PROFILE — DEMO",
      tagline: "Space for an approved brand statement",
      summary:
        "This is DEMO copy. Replace it with Red Door Vietnam's verified story, values, and capabilities; it makes no claim about company history, clients, awards, or certifications.",
      contentNotice: "DEMO — not approved company copy for publication.",
      heroAlt: "DEMO brand-image frame awaiting an approved asset",
    },
    assetReplacementHint:
      "Replace the placeholder with an approved Cloudinary publicId or brand asset.",
    contactNotice:
      "DEMO — no email, phone number, address, or map has been supplied or verified.",
    history: [
      {
        periodLabel: "DEMO chapter 01",
        title: "An origin awaiting verification",
        summary:
          "Reserved for the founding milestone and company context after confirmation by an authorized source.",
        imageAlt: "DEMO image frame for the opening chapter of company history",
      },
      {
        periodLabel: "DEMO chapter 02",
        title: "A workshop story awaiting real content",
        summary:
          "Reserved for approved information about people, working spaces, and product development.",
        imageAlt: "DEMO image frame for a verified workshop story",
      },
      {
        periodLabel: "DEMO chapter 03",
        title: "A future direction awaiting approval",
        summary:
          "Reserved for a company-supplied outlook and not presented as a current factual claim.",
        imageAlt: "DEMO image frame for an approved future direction",
      },
    ],
    process: [
      {
        stepLabel: "DEMO step 01",
        title: "Concept and material brief",
        summary:
          "A content frame for explaining how a project begins once the actual workflow is verified by the workshop.",
        imageAlt: "DEMO image frame for the concept stage",
      },
      {
        stepLabel: "DEMO step 02",
        title: "Surface preparation",
        summary:
          "A content frame for approved preparation details; it does not state company-specific materials, layer counts, or techniques.",
        imageAlt: "DEMO image frame for surface preparation",
      },
      {
        stepLabel: "DEMO step 03",
        title: "Layering and detail",
        summary:
          "A content frame for verified stages, real workshop imagery, and approved safety-conscious captions.",
        imageAlt: "DEMO image frame for the layering stage",
      },
      {
        stepLabel: "DEMO step 04",
        title: "Review and finish",
        summary:
          "A content frame for presenting finishing criteria approved by the company.",
        imageAlt: "DEMO image frame for final review",
      },
    ],
  },
  fr: {
    company: {
      eyebrow: "PROFIL DE L'ENTREPRISE — DÉMO",
      tagline: "Un espace réservé à une déclaration de marque approuvée",
      summary:
        "Ce texte est une DÉMO. Remplacez-le par l'histoire, les valeurs et les capacités vérifiées de Red Door Vietnam ; il ne formule aucune affirmation sur son histoire, ses clients, ses prix ou ses certifications.",
      contentNotice:
        "DÉMO — ce texte d'entreprise n'est pas approuvé pour publication.",
      heroAlt: "Cadre d'image de marque DÉMO en attente d'un visuel approuvé",
    },
    assetReplacementHint:
      "Remplacer le fichier temporaire par un publicId Cloudinary ou un visuel de marque approuvé.",
    contactNotice:
      "DÉMO — aucune adresse, aucun e-mail, numéro de téléphone ou plan n'a été fourni ou vérifié.",
    history: [
      {
        periodLabel: "Chapitre DÉMO 01",
        title: "Une origine en attente de vérification",
        summary:
          "Espace réservé à la date de fondation et au contexte de l'entreprise après confirmation par une source habilitée.",
        imageAlt:
          "Cadre DÉMO pour le premier chapitre de l'histoire de l'entreprise",
      },
      {
        periodLabel: "Chapitre DÉMO 02",
        title: "Un récit d'atelier en attente de contenu réel",
        summary:
          "Espace réservé aux informations approuvées sur les personnes, les lieux de travail et le développement des produits.",
        imageAlt: "Cadre DÉMO pour un récit d'atelier vérifié",
      },
      {
        periodLabel: "Chapitre DÉMO 03",
        title: "Une orientation future en attente d'approbation",
        summary:
          "Espace réservé à une vision fournie par l'entreprise, sans la présenter comme un fait actuel.",
        imageAlt: "Cadre DÉMO pour une orientation future approuvée",
      },
    ],
    process: [
      {
        stepLabel: "Étape DÉMO 01",
        title: "Concept et cahier des matières",
        summary:
          "Cadre permettant d'expliquer le début d'un projet lorsque le processus réel aura été vérifié par l'atelier.",
        imageAlt: "Cadre DÉMO pour l'étape de conception",
      },
      {
        stepLabel: "Étape DÉMO 02",
        title: "Préparation de la surface",
        summary:
          "Cadre réservé aux détails approuvés ; il ne précise ni matières, ni nombre de couches, ni techniques propres à l'entreprise.",
        imageAlt: "Cadre DÉMO pour la préparation de la surface",
      },
      {
        stepLabel: "Étape DÉMO 03",
        title: "Couches et détails",
        summary:
          "Cadre pour les étapes vérifiées, les vraies images d'atelier et les légendes approuvées.",
        imageAlt: "Cadre DÉMO pour l'étape des couches",
      },
      {
        stepLabel: "Étape DÉMO 04",
        title: "Contrôle et finition",
        summary:
          "Cadre destiné à présenter les critères de finition approuvés par l'entreprise.",
        imageAlt: "Cadre DÉMO pour le contrôle final",
      },
    ],
  },
  de: {
    company: {
      eyebrow: "UNTERNEHMENSPROFIL — DEMO",
      tagline: "Raum für eine freigegebene Markenaussage",
      summary:
        "Dies ist ein DEMO-Text. Er ist durch die geprüfte Geschichte, Werte und Fähigkeiten von Red Door Vietnam zu ersetzen und enthält keine Aussagen zu Historie, Kunden, Auszeichnungen oder Zertifizierungen.",
      contentNotice:
        "DEMO — kein zur Veröffentlichung freigegebener Unternehmenstext.",
      heroAlt: "DEMO-Rahmen für ein noch freizugebendes Markenbild",
    },
    assetReplacementHint:
      "Platzhalter durch eine freigegebene Cloudinary-publicId oder ein Markenmotiv ersetzen.",
    contactNotice:
      "DEMO — E-Mail, Telefonnummer, Adresse und Karte wurden weder bereitgestellt noch geprüft.",
    history: [
      {
        periodLabel: "DEMO-Kapitel 01",
        title: "Ein Ursprung wartet auf Bestätigung",
        summary:
          "Reserviert für Gründungsdaten und Unternehmenskontext nach Bestätigung durch eine befugte Quelle.",
        imageAlt:
          "DEMO-Bildrahmen für das erste Kapitel der Unternehmensgeschichte",
      },
      {
        periodLabel: "DEMO-Kapitel 02",
        title: "Eine Werkstattgeschichte wartet auf echte Inhalte",
        summary:
          "Reserviert für freigegebene Informationen über Menschen, Arbeitsräume und Produktentwicklung.",
        imageAlt: "DEMO-Bildrahmen für eine bestätigte Werkstattgeschichte",
      },
      {
        periodLabel: "DEMO-Kapitel 03",
        title: "Eine künftige Ausrichtung wartet auf Freigabe",
        summary:
          "Reserviert für einen vom Unternehmen bereitgestellten Ausblick, nicht als aktuelle Tatsachenbehauptung.",
        imageAlt: "DEMO-Bildrahmen für eine freigegebene Zukunftsausrichtung",
      },
    ],
    process: [
      {
        stepLabel: "DEMO-Schritt 01",
        title: "Konzept und Materialbriefing",
        summary:
          "Inhaltsrahmen zur Erläuterung des Projektstarts, sobald der tatsächliche Ablauf von der Werkstatt bestätigt wurde.",
        imageAlt: "DEMO-Bildrahmen für die Konzeptphase",
      },
      {
        stepLabel: "DEMO-Schritt 02",
        title: "Vorbereitung der Oberfläche",
        summary:
          "Rahmen für freigegebene Details; er nennt keine unternehmensspezifischen Materialien, Schichtzahlen oder Techniken.",
        imageAlt: "DEMO-Bildrahmen für die Oberflächenvorbereitung",
      },
      {
        stepLabel: "DEMO-Schritt 03",
        title: "Schichten und Details",
        summary:
          "Rahmen für bestätigte Arbeitsschritte, echte Werkstattbilder und freigegebene Bildtexte.",
        imageAlt: "DEMO-Bildrahmen für die Schichtphase",
      },
      {
        stepLabel: "DEMO-Schritt 04",
        title: "Prüfung und Finish",
        summary:
          "Inhaltsrahmen zur Darstellung der vom Unternehmen freigegebenen Endkriterien.",
        imageAlt: "DEMO-Bildrahmen für die Endprüfung",
      },
    ],
  },
  ja: {
    company: {
      eyebrow: "会社プロフィール — デモ",
      tagline: "承認済みのブランドメッセージを掲載するための仮枠",
      summary:
        "これはデモ文章です。Red Door Vietnam が確認した沿革、価値観、対応内容に差し替えてください。会社の歴史、顧客、受賞歴、認証についての事実を示すものではありません。",
      contentNotice: "デモ — 公開承認済みの会社文章ではありません。",
      heroAlt: "承認済み素材への差し替えを待つデモブランド画像枠",
    },
    assetReplacementHint:
      "仮ファイルを、承認済みの Cloudinary publicId またはブランド素材に差し替えてください。",
    contactNotice:
      "デモ — メール、電話番号、住所、地図はいずれも提供・確認されていません。",
    history: [
      {
        periodLabel: "デモ章 01",
        title: "確認待ちの原点",
        summary:
          "権限のある情報源による確認後、創業時期と会社の背景を掲載するための仮枠です。",
        imageAlt: "会社沿革の導入章に使用するデモ画像枠",
      },
      {
        periodLabel: "デモ章 02",
        title: "実際の内容を待つ工房の物語",
        summary:
          "人、仕事場、製品開発に関する承認済み情報を掲載するための仮枠です。",
        imageAlt: "確認済みの工房ストーリー用デモ画像枠",
      },
      {
        periodLabel: "デモ章 03",
        title: "承認待ちのこれから",
        summary:
          "会社から提供された将来像を掲載するための枠で、現在の事実としては扱いません。",
        imageAlt: "承認済みの将来像に使用するデモ画像枠",
      },
    ],
    process: [
      {
        stepLabel: "デモ工程 01",
        title: "構想と素材要件",
        summary:
          "実際の進め方が工房により確認された後、プロジェクトの始まりを説明するための枠です。",
        imageAlt: "構想段階に使用するデモ画像枠",
      },
      {
        stepLabel: "デモ工程 02",
        title: "表面の準備",
        summary:
          "承認済みの準備内容を掲載する枠です。会社固有の素材、層数、技法は記載していません。",
        imageAlt: "表面準備に使用するデモ画像枠",
      },
      {
        stepLabel: "デモ工程 03",
        title: "層と細部",
        summary:
          "確認済みの工程、実際の工房写真、承認済みの説明を掲載するための枠です。",
        imageAlt: "層を重ねる段階に使用するデモ画像枠",
      },
      {
        stepLabel: "デモ工程 04",
        title: "確認と仕上げ",
        summary: "会社が承認した仕上げ基準を紹介するための仮枠です。",
        imageAlt: "最終確認に使用するデモ画像枠",
      },
    ],
  },
  "zh-CN": {
    company: {
      eyebrow: "公司简介 — 演示",
      tagline: "为经批准的品牌陈述预留空间",
      summary:
        "这是演示文案。请替换为 Red Door Vietnam 核实过的故事、价值观和能力；本段不对公司历史、客户、奖项或认证作任何事实陈述。",
      contentNotice: "演示——并非获准发布的公司文案。",
      heroAlt: "等待替换为经批准素材的演示品牌图片框",
    },
    assetReplacementHint:
      "请将占位文件替换为经批准的 Cloudinary publicId 或品牌素材。",
    contactNotice: "演示——电子邮箱、电话号码、地址和地图均未提供或核实。",
    history: [
      {
        periodLabel: "演示章节 01",
        title: "等待核实的起点",
        summary: "用于在授权来源确认后放置创立节点和公司背景。",
        imageAlt: "用于公司历程开篇的演示图片框",
      },
      {
        periodLabel: "演示章节 02",
        title: "等待真实内容的工坊故事",
        summary: "用于放置经批准的团队、工作空间和产品开发信息。",
        imageAlt: "用于经核实工坊故事的演示图片框",
      },
      {
        periodLabel: "演示章节 03",
        title: "等待批准的未来方向",
        summary: "用于放置公司提供的未来展望，不代表当前事实。",
        imageAlt: "用于经批准未来方向的演示图片框",
      },
    ],
    process: [
      {
        stepLabel: "演示步骤 01",
        title: "构思与材料需求",
        summary: "在工坊核实真实流程后，用于说明项目如何开始的内容框架。",
        imageAlt: "用于构思阶段的演示图片框",
      },
      {
        stepLabel: "演示步骤 02",
        title: "表面准备",
        summary: "用于放置经批准的准备细节；不陈述公司特定的材料、层数或技法。",
        imageAlt: "用于表面准备阶段的演示图片框",
      },
      {
        stepLabel: "演示步骤 03",
        title: "层次与细节",
        summary: "用于放置经核实步骤、真实工坊图片和经批准说明的内容框架。",
        imageAlt: "用于层次制作阶段的演示图片框",
      },
      {
        stepLabel: "演示步骤 04",
        title: "检查与完成",
        summary: "用于呈现公司批准的完成标准的内容框架。",
        imageAlt: "用于最终检查阶段的演示图片框",
      },
    ],
  },
} satisfies Record<Locale, DemoContentCopy>);

function makeImage(
  assetKey: string,
  alt: string,
  replacementHint: string,
  width = 1200,
  height = 900,
): PublicImageAsset {
  return {
    assetKey,
    src: "/file.svg",
    alt,
    width,
    height,
    isDemo: true,
    replacementHint,
  };
}

function makeSocialLinks(): readonly PublicSocialLink[] {
  return [
    {
      id: "demo-social-instagram",
      platform: "instagram",
      label: "Instagram — DEMO",
      href: null,
      isDemo: true,
    },
    {
      id: "demo-social-facebook",
      platform: "facebook",
      label: "Facebook — DEMO",
      href: null,
      isDemo: true,
    },
    {
      id: "demo-social-youtube",
      platform: "youtube",
      label: "YouTube — DEMO",
      href: null,
      isDemo: true,
    },
  ];
}

function makeSnapshot(locale: Locale): PublicContentSnapshot {
  const copy = DEMO_CONTENT_COPY[locale];
  const company: PublicCompanyProfile = {
    id: "demo-company-red-door-vietnam",
    marker: "DEMO",
    isDemo: true,
    displayName: "Red Door Vietnam",
    legalName: "Công ty TNHH Cửa Đỏ Việt Nam",
    eyebrow: copy.company.eyebrow,
    tagline: copy.company.tagline,
    summary: copy.company.summary,
    contentNotice: copy.company.contentNotice,
    heroImage: makeImage(
      "demo-company-hero",
      copy.company.heroAlt,
      copy.assetReplacementHint,
      1600,
      1000,
    ),
  };

  const history: readonly PublicHistoryMilestone[] = copy.history.map(
    (item, index) => ({
      id: `demo-history-${String(index + 1).padStart(2, "0")}`,
      marker: "DEMO",
      isDemo: true,
      sortOrder: index + 1,
      periodLabel: item.periodLabel,
      title: item.title,
      summary: item.summary,
      image: makeImage(
        `demo-history-${String(index + 1).padStart(2, "0")}`,
        item.imageAlt,
        copy.assetReplacementHint,
      ),
    }),
  );

  const process: readonly PublicProcessStage[] = copy.process.map(
    (item, index) => ({
      id: `demo-process-${String(index + 1).padStart(2, "0")}`,
      marker: "DEMO",
      isDemo: true,
      sortOrder: index + 1,
      stepLabel: item.stepLabel,
      title: item.title,
      summary: item.summary,
      image: makeImage(
        `demo-process-${String(index + 1).padStart(2, "0")}`,
        item.imageAlt,
        copy.assetReplacementHint,
      ),
    }),
  );

  const settings: PublicSiteSettings = {
    id: "demo-public-settings",
    marker: "DEMO",
    isDemo: true,
    siteName: "Red Door Vietnam",
    defaultLocale: "vi",
    contact: {
      email: null,
      phone: null,
      address: null,
      mapUrl: null,
      notice: copy.contactNotice,
      isDemo: true,
    },
    socialLinks: makeSocialLinks(),
    quoteSubmissionEnabled: false,
  };

  return deepFreeze({
    locale,
    marker: "DEMO",
    isDemo: true,
    company,
    history,
    process,
    settings,
  });
}

export const DEMO_CONTENT_BY_LOCALE: Readonly<
  Record<Locale, PublicContentSnapshot>
> = deepFreeze({
  vi: makeSnapshot("vi"),
  en: makeSnapshot("en"),
  fr: makeSnapshot("fr"),
  de: makeSnapshot("de"),
  ja: makeSnapshot("ja"),
  "zh-CN": makeSnapshot("zh-CN"),
});

const demoContentRepositoryImplementation: PublicContentRepository = {
  async getSnapshot(locale) {
    return DEMO_CONTENT_BY_LOCALE[locale];
  },
  async getCompany(locale) {
    return DEMO_CONTENT_BY_LOCALE[locale].company;
  },
  async listHistory(locale) {
    return DEMO_CONTENT_BY_LOCALE[locale].history;
  },
  async listProcess(locale) {
    return DEMO_CONTENT_BY_LOCALE[locale].process;
  },
  async getSettings(locale) {
    return DEMO_CONTENT_BY_LOCALE[locale].settings;
  },
};

export const demoContentRepository: PublicContentRepository = Object.freeze(
  demoContentRepositoryImplementation,
);
