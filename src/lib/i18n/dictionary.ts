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
    /**
     * Meta descriptions for the static public routes, one per page, each
     * kept within 160 code points so search snippets are not truncated.
     * On-page intros (pages.*Intro) and the OG/JSON-LD description
     * (siteDescription) stay separate and may run longer.
     */
    pageDescriptions: {
      home: string;
      about: string;
      products: string;
      collections: string;
      process: string;
      news: string;
      contact: string;
      shop: string;
      privacy: string;
      terms: string;
      accessibility: string;
    };
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
    /** aria-label of the visible breadcrumb navigation on detail pages. */
    breadcrumbs: string;
  };
  nav: {
    home: string;
    about: string;
    products: string;
    collections: string;
    process: string;
    news: string;
    shop: string;
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
    contactTitleAccent: string;
    contactBody: string;
    /** Descriptive alt text for the three home photographs. */
    heroImageAlt: string;
    craftImageAlt: string;
    closingImageAlt: string;
  };
  pages: {
    /**
     * *Title keys are short labels (eyebrows, back links, counters).
     * *Heading keys (max 48 characters) carry the search term and serve
     * as both the <title> before " | Red Door" and the page <h1>.
     */
    aboutTitle: string;
    aboutHeading: string;
    aboutIntro: string;
    productsTitle: string;
    productsHeading: string;
    productsIntro: string;
    collectionsTitle: string;
    collectionsHeading: string;
    collectionsIntro: string;
    processTitle: string;
    processHeading: string;
    processIntro: string;
    newsTitle: string;
    newsHeading: string;
    newsIntro: string;
    shopTitle: string;
    shopHeading: string;
    shopIntro: string;
    contactTitle: string;
    contactHeading: string;
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
    /** Fallback text inside <video> for browsers without inline video. */
    videoUnsupported: string;
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
  shop: {
    heroEyebrow: string;
    emptyTitle: string;
    emptyDescription: string;
    inStock: string;
    soldOut: string;
    price: string;
    quantity: string;
    viewItem: string;
    backToShop: string;
    orderTitle: string;
    orderDescription: string;
    shippingNote: string;
    fullName: string;
    phone: string;
    email: string;
    address: string;
    note: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successDescription: string;
    orderCode: string;
    errorSoldOut: string;
    errorInsufficientStock: string;
    errorRateLimited: string;
    errorInvalid: string;
    errorUnavailable: string;
  };
  contact: {
    sectionContact: string;
    sectionRequest: string;
    optional: string;
    fullName: string;
    company: string;
    email: string;
    phone: string;
    country: string;
    countryPlaceholder: string;
    requestType: string;
    requestTypeSelect: string;
    requestTypes: {
      existing_products: string;
      custom_design: string;
      samples: string;
      catalogue: string;
      other: string;
    };
    items: string;
    itemsSearch: string;
    itemsHint: string;
    itemsAddCustom: string;
    itemsEmpty: string;
    itemQuantity: string;
    itemRemove: string;
    estimatedQuantity: string;
    budget: string;
    budgetPlaceholder: string;
    deadline: string;
    deliveryTerms: string;
    deliveryTermsSelect: string;
    deliveryTermOptions: {
      EXW: string;
      FOB: string;
      CIF: string;
      DDP: string;
      unsure: string;
    };
    destination: string;
    destinationPlaceholder: string;
    message: string;
    messagePlaceholder: string;
    consent: string;
    consentHelp: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successDescription: string;
    requestCode: string;
    errorInvalid: string;
    errorRateLimited: string;
    errorUnavailable: string;
    mapTitle: string;
    mapUnavailable: string;
    openInMaps: string;
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
