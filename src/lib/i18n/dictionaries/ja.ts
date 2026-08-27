import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — ベトナムの手仕事の漆",
    siteDescription:
      "レッドドアはハノイの漆器メーカーです。トレイ、ボウル、花器、箱、装飾品を塗り重ね、水研ぎし、手作業で磨き上げます。海外へ輸出しています。",
  },
  common: {
    demoLabel: "デモコンテンツ",
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
    replaceContentNotice:
      "デモコンテンツです。会社が承認した文章と画像に差し替えてください。",
  },
  nav: {
    home: "ホーム",
    about: "私たちについて",
    products: "製品",
    collections: "コレクション",
    process: "漆の工程",
    news: "ニュース",
    contact: "お問い合わせ",
  },
  home: {
    eyebrow: "RED DOOR — 息づく漆",
    title: "手から生まれる、",
    titleAccent: "息づく表情",
    craftTitle: "層が紡ぐ素材の物語",
    craftBody:
      "承認済みの工房写真、工程解説、製品ストーリーを掲載するためのデモ文章です。",
    historyTitle: "会社の歩み",
    featuredTitle: "注目の製品",
    collectionsTitle: "コレクション",
    processTitle: "漆の工程",
    newsTitle: "工房からの便り",
    contactTitle: "対話を始める",
    contactBody:
      "ご希望の概要をお知らせください。正式版のフォームでは、内容に応じて担当チームへ送信します。",
  },
  pages: {
    aboutTitle: "私たちについて",
    aboutIntro:
      "確認済みの会社沿革、価値観、人々、工房情報を掲載するためのデモ構成です。",
    productsTitle: "製品",
    productsIntro:
      "承認済みの商品カタログに差し替えるためのデモ製品データをご覧いただけます。",
    collectionsTitle: "コレクション",
    collectionsIntro:
      "正式な発表年、PDF、物語の準備中に表示するデモ版アートブックです。",
    processTitle: "漆の工程",
    processIntro:
      "会社が確認した素材、工程、工房での実践に差し替える必要があるデモ構成です。",
    newsTitle: "ニュースと物語",
    newsIntro: "今後の承認済みのお知らせや物語を掲載するためのデモ記事です。",
    contactTitle: "お問い合わせ・見積もり依頼",
    contactIntro:
      "お問い合わせの概要をお知らせください。開発中の連絡先は、確認済みと明記されていない限り仮情報です。",
    searchTitle: "検索",
    privacyTitle: "プライバシーポリシー",
    termsTitle: "利用規約",
    accessibilityTitle: "アクセシビリティ方針",
  },
  about: {
    contentStatusLabel: "コンテンツの状態",
    contentStatusValue: "デモ — 会社の承認待ち",
    claimsStatusLabel: "事実に関する記載",
    claimsStatusValue: "確認前の情報は公開しません",
    assetStatusLabel: "ブランド素材",
    assetStatusValue: "承認済み写真を準備中",
    principlesDescription:
      "これらのデモカードは、会社情報を公開する前に必要な根拠を示しています。",
    principleKicker: "公開時の保護方針",
    verifiedStoryTitle: "確認済みの会社沿革",
    verifiedStoryDescription:
      "創業日、節目、顧客、受賞歴、認証は、権限のある情報源による確認が完了するまで仮表示のままです。",
    approvedCapabilitiesTitle: "承認済みの対応力情報",
    approvedCapabilitiesDescription:
      "素材、技法、生産能力、納期に関する記載は、会社からの提供と承認後にのみ掲載します。",
    documentedPeopleTitle: "記録に基づく人と工房",
    documentedPeopleDescription:
      "職人紹介、工房写真、氏名、役割の公開には、同意と承認済み資料が必要です。",
    archiveNotice:
      "沿革の全章はデモと明記し、未確認の年、受賞歴、顧客、認証を掲載していません。",
  },
  product: {
    category: "カテゴリー",
    collection: "コレクション",
    material: "素材",
    finish: "仕上げ",
    dimensions: "寸法",
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
    videoUnavailable: "このデモには承認済みの製品動画がありません。",
    variants: "バリエーション",
    variantsUnavailable:
      "このデモには承認済みの製品バリエーションがありません。",
    process: "製作工程",
    processUnavailable: "このデモには承認済みの製作工程情報がありません。",
    noPrice: "価格はお問い合わせください",
  },
  collection: {
    openBook: "アートブックを開く",
    viewProducts: "製品を見る",
    download: "PDFをダウンロード",
    downloadDisabled: "このデモコレクションではPDFをダウンロードできません",
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
  contact: {
    fullName: "氏名",
    company: "会社名",
    email: "メールアドレス",
    phone: "電話番号",
    country: "国または地域",
    countrySelect: "国または地域を選択",
    countryOther: "その他の国または地域",
    interests: "関心のある製品またはコレクション",
    quantity: "予定数量",
    deadline: "希望納期",
    notes: "備考",
    attachment: "任意の添付ファイル",
    attachmentHelp:
      "デモのみ — ファイルの選択とアップロードは無効です。有効化後は10 MBまでのPDF、JPG、PNG、WebPを受け付けます。機密性の高い個人情報は添付しないでください。",
    mapTitle: "地図",
    mapDescription:
      "地図はお客さまが操作したときにのみ読み込まれます。ページ表示の時点で外部への通信は行いません。",
    loadMap: "地図を読み込む",
    mapUnavailable:
      "地図を読み込めませんでした。Google マップで直接ご覧いただけます。",
    openInMaps: "Google マップで開く",
    consent:
      "このお問い合わせへの回答に必要な範囲で、入力情報が使用されることに同意します。",
    submit: "問い合わせを送信",
    demoNotice:
      "デモフォームです。保存と通知の機能は今後のフェーズで有効になります。",
    fax: "ファックス",
    officeAddress: "オフィス",
    factoryAddress: "工房",
    warehouseAddress: "倉庫",
  },
  footer: {
    description:
      "Red Door Vietnam のデモ版ブランド体験です。公開前に、すべての仮文章と連絡先を差し替えてください。",
    navigate: "サイト案内",
    legal: "法的情報",
    privacy: "プライバシー",
    terms: "利用条件",
    accessibility: "アクセシビリティ",
    copyright: "© Red Door Vietnam. 無断転載を禁じます。",
  },
} satisfies PublicDictionary;

export default dictionary;
