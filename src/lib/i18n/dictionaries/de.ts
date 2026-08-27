import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — Handgefertigte Lackkunst aus Vietnam",
    siteDescription:
      "Red Door fertigt Lackwaren in Hanoi: Tabletts, Schalen, Gefäße, Schatullen und Dekorobjekte, in Schichten lackiert, nass geschliffen und von Hand poliert. Weltweiter Export.",
  },
  common: {
    demoLabel: "DEMO-Inhalt",
    skipToContent: "Zum Hauptinhalt springen",
    learnMore: "Mehr erfahren",
    explore: "Entdecken",
    viewAll: "Alle anzeigen",
    close: "Schließen",
    previous: "Zurück",
    next: "Weiter",
    openMenu: "Menü öffnen",
    closeMenu: "Menü schließen",
    language: "Sprache",
    search: "Suchen",
    requestQuote: "Angebot anfragen",
    readStory: "Geschichte lesen",
    featured: "Im Fokus",
    playVideo: "Video abspielen",
    replaceContentNotice:
      "DEMO-Inhalt — durch vom Unternehmen freigegebene Texte und Medien ersetzen.",
  },
  nav: {
    home: "Startseite",
    about: "Über uns",
    products: "Produkte",
    collections: "Kollektionen",
    process: "Lackverfahren",
    news: "Neuigkeiten",
    contact: "Kontakt",
  },
  home: {
    eyebrow: "RED DOOR — LEBENDIGER LACK",
    title: "Eine lebendige Oberfläche,",
    titleAccent: "von Hand geformt",
    craftTitle: "Eine Materialgeschichte in Schichten",
    craftBody:
      "Ein DEMO-Redaktionstext als Platz für freigegebene Werkstattbilder, Prozessnotizen und Produktgeschichten.",
    historyTitle: "Unternehmensgeschichte",
    featuredTitle: "Ausgewählte Produkte",
    collectionsTitle: "Kollektionen",
    processTitle: "Das Lackverfahren",
    newsTitle: "Werkstattnotizen",
    contactTitle: "Ein Gespräch beginnen",
    contactBody:
      "Beschreiben Sie, wonach Sie suchen. Das endgültige Formular leitet Ihre Anfrage an das zuständige Team weiter.",
  },
  pages: {
    aboutTitle: "Über uns",
    aboutIntro:
      "Ein DEMO-Rahmen für die geprüfte Unternehmensgeschichte sowie bestätigte Angaben zu Werten, Menschen und Werkstatt.",
    productsTitle: "Produkte",
    productsIntro:
      "Entdecken Sie DEMO-Produktdatensätze, die durch freigegebene Katalogdaten ersetzt werden.",
    collectionsTitle: "Kollektionen",
    collectionsIntro:
      "Öffnen Sie DEMO-Kunstbuchcover, während freigegebene Jahre, PDFs und Kollektionsgeschichten vorbereitet werden.",
    processTitle: "Lackverfahren",
    processIntro:
      "Eine DEMO-Abfolge, die durch geprüfte Materialien, Arbeitsschritte und Werkstattpraktiken des Unternehmens ersetzt werden muss.",
    newsTitle: "Neuigkeiten und Geschichten",
    newsIntro:
      "DEMO-Beiträge schaffen die Struktur für künftige freigegebene Mitteilungen und Geschichten.",
    contactTitle: "Kontakt und Angebotsanfrage",
    contactIntro:
      "Schildern Sie Ihr Anliegen. In der Entwicklung angezeigte Kontaktdaten sind Platzhalter, sofern sie nicht als geprüft gekennzeichnet sind.",
    searchTitle: "Suchen",
    privacyTitle: "Datenschutzerklärung",
    termsTitle: "Nutzungsbedingungen",
    accessibilityTitle: "Erklärung zur Barrierefreiheit",
  },
  about: {
    contentStatusLabel: "Inhaltsstatus",
    contentStatusValue: "DEMO — Freigabe durch das Unternehmen ausstehend",
    claimsStatusLabel: "Tatsachenangaben",
    claimsStatusValue: "Keine Veröffentlichung ohne Prüfung",
    assetStatusLabel: "Markenmaterial",
    assetStatusValue: "Freigegebene Fotografie ausstehend",
    principlesDescription:
      "Diese DEMO-Karten benennen die Nachweise, die vor der Veröffentlichung von Unternehmensangaben erforderlich sind.",
    principleKicker: "Redaktionelle Absicherung",
    verifiedStoryTitle: "Eine geprüfte Unternehmensgeschichte",
    verifiedStoryDescription:
      "Gründungsdaten, Meilensteine, Kunden, Auszeichnungen und Zertifizierungen bleiben Platzhalter, bis eine befugte Quelle sie bestätigt.",
    approvedCapabilitiesTitle: "Freigegebene Leistungsangaben",
    approvedCapabilitiesDescription:
      "Aussagen zu Materialien, Techniken, Kapazitäten und Lieferzeiten erscheinen erst nach Bereitstellung und Freigabe durch das Unternehmen.",
    documentedPeopleTitle: "Dokumentierte Menschen und Werkstatt",
    documentedPeopleDescription:
      "Profile, Werkstattbilder, Namen und Rollen benötigen vor der Veröffentlichung Einwilligungen und freigegebenes Quellenmaterial.",
    archiveNotice:
      "Alle Kapitel der Zeitleiste sind als DEMO gekennzeichnet und verzichten auf ungeprüfte Jahre, Auszeichnungen, Kunden oder Zertifizierungen.",
  },
  product: {
    category: "Kategorie",
    collection: "Kollektion",
    material: "Material",
    finish: "Oberfläche",
    dimensions: "Abmessungen",
    leadTime: "Produktionszeit",
    madeToOrder: "Auf Bestellung gefertigt",
    story: "Produktgeschichte",
    specifications: "Spezifikationen",
    related: "Ähnliche Produkte",
    filters: "Filter",
    sort: "Sortieren",
    sortDefault: "Kuratierte Reihenfolge",
    sortFeatured: "Empfehlungen zuerst",
    sortNameAscending: "Name A–Z",
    sortNameDescending: "Name Z–A",
    page: "Seite",
    zoomImage: "Bild in voller Größe ansehen",
    zoomUnavailable: "Bild in voller Größe steht noch aus",
    video: "Produktvideo",
    videoUnavailable:
      "In dieser DEMO ist kein freigegebenes Produktvideo verfügbar.",
    variants: "Varianten",
    variantsUnavailable:
      "In dieser DEMO sind keine freigegebenen Varianten verfügbar.",
    process: "Herstellungsprozess",
    processUnavailable:
      "In dieser DEMO sind keine freigegebenen Herstellungsnotizen verfügbar.",
    noPrice: "Preis auf Anfrage",
  },
  collection: {
    openBook: "Kunstbuch öffnen",
    viewProducts: "Produkte ansehen",
    download: "PDF herunterladen",
    downloadDisabled:
      "Für diese DEMO-Kollektion ist kein PDF-Download verfügbar",
  },
  news: {
    published: "Veröffentlicht",
    by: "Von",
    related: "Ähnliche Geschichten",
    share: "Diesen Beitrag teilen",
    shareNative: "Teilen",
    copyLink: "Link kopieren",
    copySuccess: "Link kopiert",
    copyFailed: "Der Link konnte nicht kopiert werden",
    shareFacebook: "Auf Facebook teilen",
    shareLinkedIn: "Auf LinkedIn teilen",
    shareEmail: "Per E-Mail teilen",
  },
  contact: {
    fullName: "Vollständiger Name",
    company: "Unternehmen",
    email: "E-Mail",
    phone: "Telefon",
    country: "Land oder Region",
    countrySelect: "Land oder Region auswählen",
    countryOther: "Anderes Land oder andere Region",
    interests: "Produkte oder Kollektionen von Interesse",
    quantity: "Geschätzte Menge",
    deadline: "Gewünschter Termin",
    notes: "Anmerkungen",
    attachment: "Optionaler Anhang",
    attachmentHelp:
      "Nur DEMO — Dateiauswahl und Upload sind deaktiviert. Nach Aktivierung werden PDF, JPG, PNG oder WebP bis 10 MB akzeptiert; bitte keine sensiblen personenbezogenen Daten anhängen.",
    mapTitle: "Karte",
    mapDescription:
      "Die Karte lädt erst auf Ihren Wunsch, damit die Seite von sich aus keine Drittanbieter-Anfrage stellt.",
    loadMap: "Karte laden",
    mapUnavailable:
      "Die Karte konnte nicht geladen werden. Sie können sie direkt in Google Maps öffnen.",
    openInMaps: "In Google Maps öffnen",
    consent:
      "Ich stimme zu, dass meine Angaben zur Beantwortung dieser Anfrage verwendet werden.",
    submit: "Anfrage senden",
    demoNotice:
      "DEMO-Formular — Speicherung und Benachrichtigungen werden in einer späteren Phase aktiviert.",
    fax: "Fax",
    officeAddress: "Büro",
    factoryAddress: "Werkstatt",
    warehouseAddress: "Lager",
  },
  footer: {
    description:
      "Ein DEMO-Markenerlebnis für Red Door Vietnam. Vor dem Start sind alle Platzhaltertexte und Kontaktdaten zu ersetzen.",
    navigate: "Navigation",
    legal: "Rechtliches",
    privacy: "Datenschutz",
    terms: "Bedingungen",
    accessibility: "Barrierefreiheit",
    copyright: "© Red Door Vietnam. Alle Rechte vorbehalten.",
  },
} satisfies PublicDictionary;

export default dictionary;
