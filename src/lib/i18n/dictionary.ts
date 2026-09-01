/** One titled passage of a legal document. */
export type LegalSectionCopy = {
  title: string;
  body: string;
};

export type PublicDictionary = {
  meta: {
    /**
     * Short brand name used in the browser tab and the title template. Not
     * translated: the mark reads "Red Door" in every market.
     */
    siteName: string;
    /** Full home-page title, brand plus tagline. */
    siteTitle: string;
    siteDescription: string;
  };
  common: {
    /** Neutral status label for records whose media or copy is still coming. */
    updatingLabel: string;
    skipToContent: string;
    learnMore: string;
    explore: string;
    viewAll: string;
    close: string;
    previous: string;
    next: string;
    openMenu: string;
    closeMenu: string;
    language: string;
    search: string;
    requestQuote: string;
    readStory: string;
    featured: string;
    /** Play button on the poster frame of an embedded film. */
    playVideo: string;
    updatingNotice: string;
  };
  nav: {
    home: string;
    about: string;
    products: string;
    collections: string;
    process: string;
    news: string;
    contact: string;
  };
  home: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    heroDescription: string;
    craftTitle: string;
    craftBody: string;
    historyTitle: string;
    featuredTitle: string;
    collectionsTitle: string;
    processTitle: string;
    newsTitle: string;
    contactTitle: string;
    contactBody: string;
  };
  pages: {
    aboutTitle: string;
    aboutIntro: string;
    productsTitle: string;
    productsIntro: string;
    collectionsTitle: string;
    collectionsIntro: string;
    processTitle: string;
    processIntro: string;
    newsTitle: string;
    newsIntro: string;
    contactTitle: string;
    contactIntro: string;
    searchTitle: string;
    privacyTitle: string;
    termsTitle: string;
    accessibilityTitle: string;
  };
  about: {
    /**
     * The three fact cards beside the company overview. Every value here is a
     * verifiable statement about the workshop — village, testing, markets.
     */
    highlightVillageLabel: string;
    highlightVillageValue: string;
    highlightComplianceLabel: string;
    highlightComplianceValue: string;
    highlightMarketsLabel: string;
    highlightMarketsValue: string;
    mediaFeaturesEyebrow: string;
    mediaFeaturesTitle: string;
    mediaFeaturesDescription: string;
    mediaVtvChannel: string;
    mediaVtvTitle: string;
    mediaVtvDescription: string;
    mediaFranceChannel: string;
    mediaFranceTitle: string;
    mediaFranceDescription: string;
    pillarKicker: string;
    pillarsDescription: string;
    pillarCraftTitle: string;
    pillarCraftDescription: string;
    pillarMaterialTitle: string;
    pillarMaterialDescription: string;
    pillarStandardTitle: string;
    pillarStandardDescription: string;
  };
  product: {
    category: string;
    collection: string;
    material: string;
    finish: string;
    dimensions: string;
    care: string;
    leadTime: string;
    madeToOrder: string;
    story: string;
    specifications: string;
    related: string;
    filters: string;
    sort: string;
    sortDefault: string;
    sortFeatured: string;
    sortNameAscending: string;
    sortNameDescending: string;
    page: string;
    zoomImage: string;
    zoomUnavailable: string;
    video: string;
    videoUnavailable: string;
    variants: string;
    variantsUnavailable: string;
    process: string;
    processUnavailable: string;
    noPrice: string;
    /** Availability + production-stage labels for the catalogue listing. */
    groupAll: string;
    groupProcessing: string;
    groupDevelop: string;
    availableOnly: string;
    availableBadge: string;
    resultCount: string;
    searchPlaceholder: string;
    applyFilters: string;
  };
  collection: {
    openBook: string;
    viewProducts: string;
    download: string;
    downloadDisabled: string;
  };
  processPage: {
    video1Eyebrow: string;
    video1Title: string;
    video1Paragraph1: string;
    video1Paragraph2: string;
    playVideo1: string;
    video2Eyebrow: string;
    video2Title: string;
    video2Paragraph1: string;
    video2Paragraph2: string;
    playVideo2: string;
  };
  news: {
    published: string;
    by: string;
    related: string;
    share: string;
    shareNative: string;
    copyLink: string;
    copySuccess: string;
    copyFailed: string;
    shareFacebook: string;
    shareLinkedIn: string;
    shareEmail: string;
  };
  contact: {
    fullName: string;
    company: string;
    email: string;
    phone: string;
    country: string;
    countrySelect: string;
    countryOther: string;
    interests: string;
    quantity: string;
    deadline: string;
    deadlineHelp: string;
    notes: string;
    attachment: string;
    attachmentHelp: string;
    mapTitle: string;
    mapDescription: string;
    loadMap: string;
    mapUnavailable: string;
    openInMaps: string;
    consent: string;
    consentHelp: string;
    submit: string;
    /** Status banner while online submission is not yet wired up. */
    formNoticeTitle: string;
    formNotice: string;
    fax: string;
    officeAddress: string;
    factoryAddress: string;
    warehouseAddress: string;
  };
  legal: {
    lastUpdated: string;
    privacyIntro: string;
    privacySections: readonly LegalSectionCopy[];
    termsIntro: string;
    termsSections: readonly LegalSectionCopy[];
    accessibilityIntro: string;
    accessibilitySections: readonly LegalSectionCopy[];
  };
  footer: {
    description: string;
    navigate: string;
    legal: string;
    privacy: string;
    terms: string;
    accessibility: string;
    copyright: string;
  };
};
