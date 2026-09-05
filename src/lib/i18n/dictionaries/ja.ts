import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — ハタイ村の漆、ベトナム",
    siteDescription:
      "Red Door はハノイ近郊の漆器の里ハタイ村で手仕事の漆器を制作しています。トレイ、箱、コースター、装飾品を幾層にも塗り重ね、水研ぎし、手で磨き上げます。SGS による欧州基準の検査に合格し、アメリカとヨーロッパへ輸出しています。",
  },
  common: {
    updatingLabel: "更新準備中",
    skipToContent: "メインコンテンツへ移動",
    learnMore: "詳しく見る",
    explore: "探る",
    viewAll: "すべて見る",
    close: "閉じる",
    previous: "前へ",
    next: "次へ",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    language: "言語",
    search: "検索",
    requestQuote: "見積もりを依頼",
    readStory: "物語を読む",
    featured: "注目",
    playVideo: "動画を再生",
    updatingNotice: "この項目は工房が内容を仕上げているところです。",
  },
  nav: {
    home: "ホーム",
    about: "私たちについて",
    products: "製品",
    collections: "コレクション",
    process: "漆の工程",
    news: "ニュース",
    shop: "ショップ",
    contact: "お問い合わせ",
  },
  home: {
    eyebrow: "RED DOOR — ハタイ村の漆",
    title: "手から生まれる、",
    titleAccent: "息づく表情",
    heroDescription:
      "ベトナム漆の真髄は一層一層に宿ります。すべての製品は、自然と職人の手の調和から生まれます。",
    craftTitle: "層が紡ぐ素材の物語",
    craftBody:
      "最初の下地から最後の一層まで、Red Door の品はいくつもの工程と、自然乾燥を待つ数週間を経て生まれます。塗り、水研ぎし、また塗る — 表面が静かな水面のような深さをたたえるまで。",
    historyTitle: "工房の歩み",
    featuredTitle: "注目の製品",
    collectionsTitle: "コレクション",
    processTitle: "漆の工程",
    newsTitle: "工房からの便り",
    contactTitle: "対話を",
    contactTitleAccent: "始める",
    contactBody:
      "お探しのものをお聞かせください — 既存のコレクション、特注のデザイン、輸出のご注文など。Red Door のチームができるだけ早くお返事します。",
  },
  pages: {
    aboutTitle: "私たちについて",
    aboutIntro:
      "Red Door は、何世代にもわたり漆の技が受け継がれてきたハノイ近郊の漆器の里、ハタイ村に工房を構えています。伝統の技法と現代のデザインを組み合わせ、ベトナムの漆を世界の暮らしの空間へ届けます。",
    productsTitle: "製品",
    productsIntro:
      "トレイ、箱、コースター、花器、装飾品 — どの品もハタイ村の工房で手作りされ、幾層にも塗り重ね、水研ぎし、手で磨き上げています。",
    collectionsTitle: "コレクション",
    collectionsIntro:
      "Red Door は毎年、新しいコレクションを発表しています。素材、色、表面の研究を重ねた工房の成果です。カタログを開いて全作品をご覧ください。",
    processTitle: "漆の工程",
    processIntro:
      "一つの漆器が完成するまでには、木地づくり、下地、塗り、水研ぎ、磨きと、数十の工程があります。どの工程も急ぐことはできません。",
    newsTitle: "ニュースと物語",
    newsIntro:
      "ハタイ村の工房からの便り。新しいコレクション、国際見本市、そして漆の表面に宿る物語をお届けします。",
    contactTitle: "お問い合わせ・見積もり依頼",
    contactIntro:
      "カタログのご請求、お見積もり、特注のご相談は Red Door まで。世界中の小売店、デザイナー、ブランドと直接お取引しています。",
    shopTitle: "ショップ",
    shopIntro:
      "工房に在庫のある漆器を直接ご注文いただけます。ご注文を確認し、発送前に送料をご案内します。",
    searchTitle: "検索",
    privacyTitle: "プライバシーポリシー",
    termsTitle: "利用規約",
    accessibilityTitle: "アクセシビリティ方針",
  },
  about: {
    highlightVillageLabel: "産地",
    highlightVillageValue: "ハタイ村、ハノイ",
    highlightComplianceLabel: "検査",
    highlightComplianceValue: "SGS — 欧州基準",
    highlightMarketsLabel: "輸出先",
    highlightMarketsValue: "アメリカ・ヨーロッパ",
    mediaFeaturesEyebrow: "メディア・テレビ放映",
    mediaFeaturesTitle: "国内外のテレビで紹介された漆芸の技と美",
    mediaFeaturesDescription:
      "ハタイ漆芸村の伝統を守り、ベトナムの手仕事の真髄を世界へ届ける歩みが数々のドキュメンタリーで紹介されています。",
    mediaVtvChannel: "VTV — ベトナム国営放送",
    mediaVtvTitle: "VTV特集：ハタイ漆芸村の伝統と魂を継承する手仕事",
    mediaVtvDescription:
      "ベトナム国営放送（VTV）による特別番組。Red Doorの工房とハタイ村における幾重もの塗り重ねや水研ぎなど、熟練の職人技を紹介。",
    mediaFranceChannel: "フランス国営テレビ — France TV",
    mediaFranceTitle:
      "フランス国営テレビ：世界を魅了するベトナム漆工芸の精緻な美",
    mediaFranceDescription:
      "フランスのテレビ局が取材したドキュメンタリー。厳しい国際基準と高い美意識を備えたRed Doorの漆器がヨーロッパで注目される理由を伝えます。",
    pillarKicker: "大切にしていること",
    pillarsDescription:
      "Red Door の工房を出るすべての品に共通する、変わらない三つのこと。",
    pillarCraftTitle: "すべて手仕事",
    pillarCraftDescription:
      "一つひとつを手で作ります。漆を塗り重ね、層の間で水研ぎし、望む深みが出るまで磨き上げる。同じものは二つとありません。",
    pillarMaterialTitle: "自然から生まれる",
    pillarMaterialDescription:
      "色にも、素材にも、光を受けとめる表面にも、自然が息づいています。長く使え、年を重ねるほど美しくなる品を目指しています。",
    pillarStandardTitle: "国際基準",
    pillarStandardDescription:
      "Red Door の製品は、化学物質と素材の安全に関する欧州の規則に基づき SGS の検査を受けています。最も厳しい市場にも応えられる品質です。",
  },
  product: {
    category: "カテゴリー",
    collection: "コレクション",
    material: "素材",
    finish: "仕上げ",
    dimensions: "寸法",
    care: "お手入れ",
    leadTime: "製作期間",
    madeToOrder: "受注製作",
    story: "製品の物語",
    specifications: "仕様",
    related: "関連製品",
    filters: "絞り込み",
    sort: "並べ替え",
    sortDefault: "推奨順",
    sortFeatured: "注目製品を先に表示",
    sortNameAscending: "名前 A–Z",
    sortNameDescending: "名前 Z–A",
    page: "ページ",
    zoomImage: "原寸画像を見る",
    zoomUnavailable: "原寸画像は準備中です",
    video: "製品動画",
    videoUnavailable: "この製品の動画は現在制作中です。",
    variants: "バリエーション",
    variantsUnavailable: "この製品には現在、他のバリエーションはありません。",
    process: "製作工程",
    processUnavailable: "この製品の製作記録は現在執筆中です。",
    noPrice: "価格はお問い合わせください",
    groupAll: "すべて",
    groupProcessing: "製作中",
    groupDevelop: "開発中",
    availableOnly: "在庫ありのみ",
    availableBadge: "在庫あり",
    resultCount: "{count} 件の製品を表示",
    searchPlaceholder: "名称・素材で検索",
    applyFilters: "適用",
  },
  collection: {
    openBook: "アートブックを開く",
    viewProducts: "製品を見る",
    download: "PDFをダウンロード",
    downloadDisabled: "このコレクションのPDFは近日公開予定です",
  },
  processPage: {
    video1Eyebrow: "ベトナム漆絵の真髄",
    video1Title: "原液の本漆から至高の漆画が生まれるまでの軌跡",
    video1Paragraph1:
      "漆画はベトナム美術の至宝であり、幾世代にもわたり受け継がれた秘伝の結晶です。",
    video1Paragraph2:
      "天然の本漆から熟練の手仕事を経て、深い文化美を宿す唯一無二の芸術作品へ。",
    playVideo1: "ベトナム漆画の動画を見る",
    video2Eyebrow: "伝統工芸の匠と本漆の技",
    video2Title: "漆工芸士 ヴー・フイ・メン：ハタイ村の伝統を守る匠の歩み",
    video2Paragraph1:
      "ハタイ漆芸村の伝統を担うヴー・フイ・メン氏は、天然本漆による絵画技法の継承に心血を注いでいます。",
    video2Paragraph2:
      "伝統技と独自の感性を融合させた作品を通じ、工業塗料の波に抗い本物の価値を守り続けています。",
    playVideo2: "ヴー・フイ・メン氏の動画を見る",
  },
  news: {
    published: "公開日",
    by: "執筆者",
    related: "関連する物語",
    share: "この記事を共有",
    shareNative: "共有",
    copyLink: "リンクをコピー",
    copySuccess: "リンクをコピーしました",
    copyFailed: "リンクをコピーできませんでした",
    shareFacebook: "Facebookで共有",
    shareLinkedIn: "LinkedInで共有",
    shareEmail: "メールで共有",
  },
  shop: {
    heroEyebrow: "Red Door ショップ",
    emptyTitle: "ショップは準備中です",
    emptyDescription:
      "まだ販売中の商品はありません。しばらくしてから再度ご覧いただくか、お見積もりをご依頼ください。",
    inStock: "在庫あり",
    soldOut: "売り切れ",
    price: "価格",
    quantity: "数量",
    viewItem: "商品を見る",
    backToShop: "ショップに戻る",
    orderTitle: "ご注文",
    orderDescription:
      "必要事項をご記入ください。お電話またはメールでご注文を確認いたします。",
    shippingNote:
      "価格に送料は含まれません。発送前にディレクターが送料をご相談します。",
    fullName: "お名前",
    phone: "電話番号",
    email: "メールアドレス",
    address: "お届け先住所",
    note: "備考（任意）",
    submit: "注文を送信",
    submitting: "送信中…",
    successTitle: "ご注文を受け付けました",
    successDescription:
      "ありがとうございます。確認メールをお送りしました。送料について追ってご連絡いたします。",
    orderCode: "注文番号",
    errorSoldOut: "この商品は売り切れました。",
    errorInsufficientStock: "数量が在庫を超えています。",
    errorRateLimited: "送信回数が多すぎます。数分後に再度お試しください。",
    errorInvalid: "必須項目をご確認ください。",
    errorUnavailable:
      "現在ご注文を送信できません。再度お試しいただくか、直接ご連絡ください。",
  },
  contact: {
    sectionContact: "ご連絡先",
    sectionRequest: "ご要望の内容",
    optional: "任意",
    fullName: "氏名",
    company: "会社名",
    email: "メールアドレス",
    phone: "電話番号",
    country: "国または地域",
    countryPlaceholder: "例：日本、アメリカ、フランス",
    requestType: "お問い合わせの種類",
    requestTypeSelect: "種類を選択",
    requestTypes: {
      existing_products: "カタログ製品の見積もり",
      custom_design: "オリジナルデザイン / OEM",
      samples: "サンプルの注文",
      catalogue: "カタログと価格表の請求",
      other: "その他",
    },
    items: "ご関心のある製品",
    itemsSearch: "製品名で検索…",
    itemsHint: "カタログから選ぶか、必要な製品名を入力してください。",
    itemsAddCustom: "他の製品を追加",
    itemsEmpty: "この製品はすでにリストにあります。",
    itemQuantity: "数量",
    itemRemove: "削除",
    estimatedQuantity: "予定総数量",
    budget: "ご予算または目標価格",
    budgetPlaceholder: "例：1点あたり8〜10 USD",
    deadline: "希望納品日",
    deliveryTerms: "納品条件",
    deliveryTermsSelect: "納品条件を選択",
    deliveryTermOptions: {
      EXW: "EXW – 工場渡し",
      FOB: "FOB – 本船渡し",
      CIF: "CIF – 運賃・保険料込み",
      DDP: "DDP – 関税込み持込渡し",
      unsure: "未定",
    },
    destination: "納品先",
    destinationPlaceholder: "都市名または到着港",
    message: "ご要望の詳細",
    messagePlaceholder: "サイズ、色、文様、パッケージ、ロゴ印刷、用途など",
    consent:
      "このお問い合わせへの回答に必要な範囲で、入力情報が使用されることに同意します。",
    consentHelp:
      "ご入力いただいた情報は、このお問い合わせへの回答にのみ使用します。",
    submit: "見積もりを依頼する",
    submitting: "送信中…",
    successTitle: "ご依頼を受け付けました",
    successDescription:
      "ありがとうございます。1〜2営業日以内にメールでお返事します。確認メールをお送りしました。",
    requestCode: "受付番号",
    errorInvalid: "必須項目をご確認ください。",
    errorRateLimited:
      "短時間に複数の送信がありました。数分後に再度お試しください。",
    errorUnavailable:
      "現在送信できません。再度お試しいただくか、メールでご連絡ください。",
    mapTitle: "地図",
    mapUnavailable:
      "地図を読み込めませんでした。Google マップで直接ご覧いただけます。",
    openInMaps: "Google マップで開く",
    fax: "ファックス",
    officeAddress: "オフィス",
    factoryAddress: "工房",
    warehouseAddress: "倉庫",
  },
  legal: {
    lastUpdated: "更新：2026年8月",
    privacyIntro:
      "Red Door は訪問者のプライバシーを尊重します。本ポリシーでは、lacquerware.vn のご利用にあたり当社が収集する情報と、その使い方を説明します。",
    privacySections: [
      {
        title: "収集する情報",
        body: "お問い合わせや見積もり依頼の際にご自身で入力いただく情報のみを収集します：氏名、会社名、メールアドレス、電話番号、お問い合わせ内容。本サイトは広告用クッキーや第三者のトラッカーを使用していません。",
      },
      {
        title: "情報の使い方",
        body: "ご連絡先は、お問い合わせへの回答とご注文に関するやり取りにのみ使用します。マーケティング目的で第三者にデータを販売、貸与、共有することはありません。",
      },
      {
        title: "プライバシーに関するお問い合わせ",
        body: "ご提供いただいた情報の確認、訂正、削除をご希望の場合は、sales@reddoor.vn までご連絡ください。速やかに対応します。",
      },
    ],
    termsIntro:
      "以下の条件は、RED DOOR Co., Ltd. が運営する lacquerware.vn へのアクセスと利用に適用されます。",
    termsSections: [
      {
        title: "知的財産",
        body: "本サイトのすべての画像、カタログ、文章、デザインは RED DOOR Co., Ltd. に帰属します。書面による同意なく、商用目的での複製・再利用はご遠慮ください。",
      },
      {
        title: "製品情報",
        body: "漆器は手仕事のため、色や表面の表情が写真とわずかに異なる場合があります。これは工芸の自然な特性であり、不良ではありません。仕様、価格、納期は正式なお見積もりで確定します。",
      },
      {
        title: "見積もりとご注文",
        body: "本サイトの内容は紹介を目的としたもので、拘束力のある販売の申し出ではありません。ご注文は直接のやり取りと書面による注文確認によって成立します。",
      },
    ],
    accessibilityIntro:
      "Red Door は、スクリーンリーダーやキーボードをお使いの方を含め、すべての訪問者が本サイトを快適に利用できることを目指しています。",
    accessibilitySections: [
      {
        title: "私たちの取り組み",
        body: "本サイトは WCAG 2.1 レベル AA のガイドラインに沿って構築しています。明確な見出し構造、十分なコントラスト、キーボード操作、画像の代替テキストに対応しています。",
      },
      {
        title: "既知の制限",
        body: "ページをめくる形式のカタログなど、一部のコンテンツは支援技術への最適化が完全ではありません。今後の更新で改善を続けます。",
      },
      {
        title: "ご意見",
        body: "本サイトのご利用で不便がありましたら、sales@reddoor.vn までお知らせください。改善します。",
      },
    ],
  },
  footer: {
    description:
      "Red Door はハノイ近郊のハタイ村で手仕事の漆器を制作しています。一層一層を手で塗り、水研ぎし、磨き上げ、世界中の暮らしの空間へ届けます。",
    navigate: "サイト案内",
    legal: "法的情報",
    privacy: "プライバシー",
    terms: "利用条件",
    accessibility: "アクセシビリティ",
    copyright: "© RED DOOR Co., Ltd. — ハタイ村、ハノイ。無断転載を禁じます。",
  },
} satisfies PublicDictionary;

export default dictionary;
