import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — Laque de Ha Thai, Vietnam",
    siteDescription:
      "Red Door fabrique des objets en laque artisanale dans le village de métier de Ha Thai, près de Hanoï : plateaux, coffrets, dessous de verre et objets décoratifs laqués en couches, poncés à l'eau et polis à la main. Produits testés par SGS selon les normes européennes, exportés vers les États-Unis et l'Europe.",
    pageDescriptions: {
      home: "Laque vietnamienne faite main par Red Door au village de Ha Thai, près de Hanoï : plateaux, coffrets, dessous de verre, bols et vases. Testés SGS aux normes UE.",
      about:
        "Red Door, atelier de laque vietnamienne au village de Ha Thai près de Hanoï : technique traditionnelle, dessin contemporain, pièces testées SGS aux normes UE.",
      products:
        "Objets en laque vietnamienne faits main : plateaux, coffrets, dessous de verre, bols, vases et objets décoratifs Red Door, laqués en couches, polis à la main.",
      collections:
        "Collections et catalogues de laque vietnamienne Red Door : chaque année, plateaux, coffrets, bols, vases et objets décoratifs faits main à Ha Thai.",
      process:
        "Comment naît la laque vietnamienne à l'atelier Red Door : support, apprêts, couches de laque, ponçage à l'eau et polissage — des dizaines d'étapes, sans hâte.",
      news: "Actualités de la laque vietnamienne et récits de l'atelier Red Door à Ha Thai : nouvelles collections, salons internationaux et coulisses de chaque pièce.",
      contact:
        "Contactez Red Door pour un catalogue ou un devis d'objets en laque vietnamienne : plateaux, coffrets, bols, vases, créations sur mesure et commandes à l'export.",
      shop: "Boutique Red Door : objets en laque vietnamienne faits main, disponibles à l'atelier — plateaux, coffrets, dessous de verre et bols, prix en VND et USD.",
      privacy:
        "Politique de confidentialité de Red Door : les informations recueillies lorsque vous nous contactez ou demandez un devis, et l'usage que nous en faisons.",
      terms:
        "Conditions d'utilisation du site Red Door, exploité par RED DOOR Co., Ltd : propriété intellectuelle, informations produits, devis et commandes.",
      accessibility:
        "Déclaration d'accessibilité du site Red Door : notre engagement WCAG 2.1 AA, les limites connues et la façon de nous faire part de vos remarques.",
    },
  },
  common: {
    updatingLabel: "En cours de mise à jour",
    skipToContent: "Aller au contenu principal",
    learnMore: "Voir comment nous fabriquons la laque",
    explore: "Explorer",
    viewAll: "Tout voir",
    close: "Fermer",
    previous: "Précédent",
    next: "Suivant",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    language: "Langue",
    search: "Rechercher",
    requestQuote: "Demander un devis",
    readStory: "Lire l'histoire",
    featured: "À la une",
    playVideo: "Lire la vidéo",
    updatingNotice: "Cette section est en cours de finition par l'atelier.",
    breadcrumbs: "Fil d'Ariane",
  },
  nav: {
    home: "Accueil",
    about: "À propos",
    products: "Produits",
    collections: "Collections",
    process: "Procédé de laque",
    news: "Actualités",
    shop: "Boutique",
    contact: "Contact",
  },
  home: {
    eyebrow: "RED DOOR — LAQUE DE HA THAI",
    title: "Objets en laque vietnamienne,",
    titleAccent: "façonnés à la main, couche après couche",
    heroDescription:
      "L'essence de la laque vietnamienne est préservée dans chaque couche — chaque produit est une harmonie entre nature et main de l'artisan.",
    craftTitle: "Un récit de matière, couche après couche",
    craftBody:
      "Du premier apprêt à la dernière couche, chaque pièce Red Door traverse des dizaines d'étapes et des semaines de séchage naturel. Nous laquons, ponçons à l'eau, puis laquons encore — jusqu'à ce que la surface prenne la profondeur d'une eau calme.",
    historyTitle: "Le chemin de l'atelier",
    featuredTitle: "Produits à la une",
    collectionsTitle: "Collections",
    processTitle: "Le procédé de laque",
    newsTitle: "Carnet d'atelier",
    contactTitle: "Commençons",
    contactTitleAccent: "la conversation",
    contactBody:
      "Dites-nous ce que vous recherchez — une collection disponible, un dessin sur mesure ou une commande à l'export. L'équipe Red Door vous répondra au plus vite.",
    heroImageAlt:
      "Ensemble en laque Red Door : plateau, vase, coffrets, dessous de verre, bol et panneau de laque au lotus, rouge et or",
    craftImageAlt:
      "Artisan polissant à la main un plateau en laque rouge au motif de fleurs dorées, à côté de feuilles d'or",
    closingImageAlt:
      "Les portes rouges de l'atelier Red Door Co., Ltd au Vietnam",
  },
  pages: {
    aboutTitle: "À propos",
    aboutHeading: "À propos — atelier de laque à Ha Thai, Hanoï",
    aboutIntro:
      "Red Door est un atelier de laque installé dans le village de métier de Ha Thai, près de Hanoï, où le savoir-faire se transmet de génération en génération. Nous associons techniques traditionnelles et dessin contemporain pour porter la laque vietnamienne dans les intérieurs du monde entier.",
    productsTitle: "Produits",
    productsHeading: "Objets en laque : plateaux, coffrets, bols",
    productsIntro:
      "Plateaux, coffrets, dessous de verre, vases et objets décoratifs — chaque pièce est façonnée à la main à l'atelier de Ha Thai, laquée en couches, poncée à l'eau et polie à la main.",
    collectionsTitle: "Collections",
    collectionsHeading: "Collections de laque et catalogues",
    collectionsIntro:
      "Chaque année, Red Door présente une nouvelle collection — fruit du travail de l'atelier sur les matières, les couleurs et les surfaces. Ouvrez chaque catalogue pour découvrir l'ensemble.",
    processTitle: "Procédé de laque",
    processHeading: "Fabrication de la laque vietnamienne",
    processIntro:
      "Une pièce de laque achevée traverse des dizaines d'étapes : préparation du support, apprêts, couches de laque, ponçage à l'eau et polissage. Aucune ne peut être précipitée.",
    newsTitle: "Actualités et récits",
    newsHeading: "Actualités de la laque et récits d'atelier",
    newsIntro:
      "Notes de l'atelier de Ha Thai : nouvelles collections, salons internationaux et histoires derrière chaque surface laquée.",
    contactTitle: "Contact et demande de devis",
    contactHeading: "Contact et devis pour objets en laque",
    contactIntro:
      "Contactez Red Door pour recevoir un catalogue, un devis ou échanger sur une commande particulière. Nous travaillons en direct avec détaillants, designers et marques du monde entier.",
    shopTitle: "Boutique",
    shopHeading: "Boutique de laque — commander à l'atelier",
    shopIntro:
      "Des pièces en laque disponibles à l’atelier, à commander directement. Nous confirmons chaque commande et indiquons les frais de port avant l’expédition.",
    searchTitle: "Rechercher",
    privacyTitle: "Politique de confidentialité",
    termsTitle: "Conditions d'utilisation",
    accessibilityTitle: "Déclaration d'accessibilité",
  },
  about: {
    highlightVillageLabel: "Village de métier",
    highlightVillageValue: "Ha Thai, Hanoï",
    highlightComplianceLabel: "Contrôles",
    highlightComplianceValue: "SGS — normes UE",
    highlightMarketsLabel: "Marchés",
    highlightMarketsValue: "États-Unis et Europe",
    mediaFeaturesEyebrow: "Médias & Télévision",
    mediaFeaturesTitle:
      "L'art de la laque à l'honneur sur les chaînes de télévision",
    mediaFeaturesDescription:
      "Le voyage pour préserver l'héritage du village de laque de Ha Thai et faire rayonner l'artisanat vietnamien à l'international à travers des reportages d'exception.",
    mediaVtvChannel: "VTV — Télévision Nationale du Vietnam",
    mediaVtvTitle:
      "Reportage VTV : Préserver l'âme de la laque traditionnelle de Ha Thai",
    mediaVtvDescription:
      "Un reportage exclusif de la Télévision Nationale du Vietnam (VTV) capturant les étapes minutieuses de création dans l'atelier Red Door et au village artisanal de Ha Thai.",
    mediaFranceChannel: "France TV — Télévision Française",
    mediaFranceTitle:
      "Télévision Française : Le rayonnement de la laque d'art vietnamienne",
    mediaFranceDescription:
      "Un documentaire de la télévision française mettant à l'honneur le savoir-faire unique de la laque vietnamienne, ses standards de qualité rigoureux et son succès auprès des passionnés d'artisanat d'art en Europe.",
    videoUnsupported:
      "Votre navigateur ne prend pas en charge la lecture vidéo.",
    pillarKicker: "Valeurs fondatrices",
    pillarsDescription:
      "Trois constantes dans chaque pièce qui quitte l'atelier Red Door.",
    pillarCraftTitle: "Entièrement fait main",
    pillarCraftDescription:
      "Chaque pièce est réalisée à la main : couche après couche de laque, ponçage à l'eau entre les couches, puis polissage jusqu'à la profondeur voulue. Il n'existe pas deux pièces identiques.",
    pillarMaterialTitle: "Inspiré par la nature",
    pillarMaterialDescription:
      "La nature habite les couleurs, les matières et la façon dont chaque surface prend la lumière. Nous voulons des objets durables, utiles, qui embellissent avec les années.",
    pillarStandardTitle: "Normes internationales",
    pillarStandardDescription:
      "Les produits Red Door sont testés par SGS selon la réglementation européenne sur la sécurité des substances et des matériaux, prêts pour les marchés les plus exigeants.",
  },
  product: {
    category: "Catégorie",
    collection: "Collection",
    material: "Matière",
    finish: "Finition",
    dimensions: "Dimensions",
    care: "Entretien",
    leadTime: "Délai de fabrication",
    madeToOrder: "Fabriqué sur commande",
    story: "Histoire du produit",
    specifications: "Caractéristiques",
    related: "Produits associés",
    filters: "Filtres",
    sort: "Trier",
    sortDefault: "Ordre éditorial",
    sortFeatured: "Sélection en premier",
    sortNameAscending: "Nom A–Z",
    sortNameDescending: "Nom Z–A",
    page: "Page",
    zoomImage: "Voir l’image en taille réelle",
    zoomUnavailable: "Image en taille réelle en attente",
    video: "Vidéo du produit",
    videoUnavailable: "La vidéo de ce produit est en cours de réalisation.",
    variants: "Variantes",
    variantsUnavailable: "Ce produit n'a pas d'autre variante pour le moment.",
    process: "Processus de fabrication",
    processUnavailable:
      "Les notes de fabrication de ce produit sont en cours de rédaction.",
    noPrice: "Prix sur demande",
    groupAll: "Tout",
    groupProcessing: "En production",
    groupDevelop: "En développement",
    availableOnly: "En stock uniquement",
    availableBadge: "En stock",
    resultCount: "{count} produits affichés",
    searchPlaceholder: "Rechercher par nom, matériau…",
    applyFilters: "Appliquer",
  },
  collection: {
    openBook: "Ouvrir le livre d'art",
    viewProducts: "Voir les produits",
    download: "Télécharger le PDF",
    downloadDisabled: "Le PDF de cette collection arrive bientôt",
  },
  processPage: {
    video1Eyebrow: "L'art de la laque vietnamienne",
    video1Title: "Le voyage minutieux de la laque brute aux chefs-d'œuvre",
    video1Paragraph1:
      "La peinture sur laque est un fleuron des beaux-arts vietnamiens, héritière d'un savoir-faire séculaire transmis avec passion.",
    video1Paragraph2:
      "Un cheminement patient de la sève naturelle aux mains du maître artisan, donnant vie à des œuvres d'une profondeur inestimable.",
    playVideo1: "Regarder la vidéo sur l'art de la laque",
    video2Eyebrow: "Artisan & Savoir-faire de la laque naturelle",
    video2Title:
      "L'artisan Vu Huy Men : Gardien de la laque traditionnelle de Ha Thai",
    video2Paragraph1:
      "L'artisan Vu Huy Men perpétue avec ferveur les secrets de la laque naturelle traditionnelle au cœur du village de Ha Thai.",
    video2Paragraph2:
      "Ses créations allient maîtrise ancestrale et sensibilité moderne, défendant l'authenticité de la laque face aux produits industriels.",
    playVideo2: "Regarder la vidéo de l'artisan Vu Huy Men",
  },
  news: {
    published: "Publié le",
    by: "Par",
    related: "Récits associés",
    share: "Partager ce récit",
    shareNative: "Partager",
    copyLink: "Copier le lien",
    copySuccess: "Lien copié",
    copyFailed: "Impossible de copier le lien",
    shareFacebook: "Partager sur Facebook",
    shareLinkedIn: "Partager sur LinkedIn",
    shareEmail: "Partager par e-mail",
  },
  shop: {
    heroEyebrow: "Boutique Red Door",
    emptyTitle: "La boutique se prépare",
    emptyDescription:
      "Aucun article n’est encore en vente. Revenez bientôt ou contactez-nous pour un devis.",
    inStock: "En stock",
    soldOut: "Épuisé",
    price: "Prix",
    quantity: "Quantité",
    viewItem: "Voir l’article",
    backToShop: "Retour à la boutique",
    orderTitle: "Passer commande",
    orderDescription:
      "Renseignez vos coordonnées ; nous vous contacterons par téléphone ou e-mail pour confirmer la commande.",
    shippingNote:
      "Prix hors frais de port. Le directeur conviendra des frais de port avec vous avant l’expédition.",
    fullName: "Nom complet",
    phone: "Téléphone",
    email: "E-mail",
    address: "Adresse de livraison",
    note: "Remarque (facultatif)",
    submit: "Envoyer la commande",
    submitting: "Envoi…",
    successTitle: "Nous avons reçu votre commande",
    successDescription:
      "Merci. Un e-mail de confirmation vous est envoyé et nous vous recontacterons rapidement au sujet de la livraison.",
    orderCode: "Numéro de commande",
    errorSoldOut: "Cet article vient d’être épuisé.",
    errorInsufficientStock: "La quantité dépasse le stock disponible.",
    errorRateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    errorInvalid: "Veuillez vérifier les champs obligatoires.",
    errorUnavailable:
      "La commande n’a pas pu être envoyée. Réessayez ou contactez-nous directement.",
  },
  contact: {
    sectionContact: "Vos coordonnées",
    sectionRequest: "Votre besoin",
    optional: "facultatif",
    fullName: "Nom complet",
    company: "Entreprise",
    email: "E-mail",
    phone: "Téléphone",
    country: "Pays ou région",
    countryPlaceholder: "ex. France, Belgique, Suisse",
    requestType: "Type de demande",
    requestTypeSelect: "Sélectionner un type de demande",
    requestTypes: {
      existing_products: "Devis sur des produits du catalogue",
      custom_design: "Création sur mesure / OEM",
      samples: "Commande d'échantillons",
      catalogue: "Catalogue et tarifs",
      other: "Autre",
    },
    items: "Produits recherchés",
    itemsSearch: "Rechercher un produit par nom…",
    itemsHint: "Choisissez dans le catalogue ou saisissez le produit souhaité.",
    itemsAddCustom: "Ajouter un autre produit",
    itemsEmpty: "Ce produit figure déjà dans la liste.",
    itemQuantity: "Quantité",
    itemRemove: "Retirer",
    estimatedQuantity: "Quantité totale estimée",
    budget: "Budget ou prix cible",
    budgetPlaceholder: "ex. 8 à 10 USD la pièce",
    deadline: "Date de livraison souhaitée",
    deliveryTerms: "Conditions de livraison",
    deliveryTermsSelect: "Sélectionner les conditions de livraison",
    deliveryTermOptions: {
      EXW: "EXW – départ atelier",
      FOB: "FOB – franco à bord",
      CIF: "CIF – coût, assurance et fret",
      DDP: "DDP – rendu droits acquittés",
      unsure: "Pas encore défini",
    },
    destination: "Destination",
    destinationPlaceholder: "Ville ou port d'arrivée",
    message: "Décrivez votre demande",
    messagePlaceholder:
      "Dimensions, couleurs, motifs, emballage, marquage logo, usage prévu…",
    consent:
      "J'accepte que mes informations soient utilisées pour répondre à cette demande.",
    consentHelp:
      "Les informations transmises servent uniquement à répondre à cette demande.",
    submit: "Envoyer la demande de devis",
    submitting: "Envoi en cours…",
    successTitle: "Votre demande a bien été reçue",
    successDescription:
      "Merci. Nous vous répondrons par e-mail sous un à deux jours ouvrés. Une confirmation vient de vous être envoyée.",
    requestCode: "Référence de la demande",
    errorInvalid: "Veuillez vérifier les champs obligatoires.",
    errorRateLimited:
      "Vous avez envoyé plusieurs demandes à la suite. Réessayez dans quelques minutes.",
    errorUnavailable:
      "Impossible d'envoyer la demande pour le moment. Réessayez ou écrivez-nous par e-mail.",
    mapTitle: "Plan",
    mapUnavailable:
      "La carte n'a pas pu être chargée. Vous pouvez l'ouvrir directement dans Google Maps.",
    openInMaps: "Ouvrir dans Google Maps",
    fax: "Fax",
    officeAddress: "Bureau",
    factoryAddress: "Atelier",
    warehouseAddress: "Entrepôt",
  },
  legal: {
    lastUpdated: "Mise à jour : août 2026",
    privacyIntro:
      "Red Door respecte la vie privée de ses visiteurs. Cette politique décrit les informations que nous recueillons lorsque vous utilisez reddoor.vn et l'usage que nous en faisons.",
    privacySections: [
      {
        title: "Les informations recueillies",
        body: "Nous ne recueillons que les informations que vous choisissez de transmettre en nous contactant ou en demandant un devis : nom, entreprise, adresse e-mail, téléphone et contenu de la demande. Le site n'utilise ni cookies publicitaires ni traceurs tiers.",
      },
      {
        title: "L'usage de ces informations",
        body: "Vos coordonnées servent uniquement à répondre à votre demande et à échanger sur votre commande. Nous ne vendons, ne louons ni ne partageons vos données à des tiers à des fins commerciales.",
      },
      {
        title: "Vos droits",
        body: "Pour consulter, corriger ou supprimer les informations transmises, écrivez à sales@reddoor.vn — nous traiterons votre demande dans les meilleurs délais.",
      },
    ],
    termsIntro:
      "Les conditions suivantes régissent l'accès et l'utilisation de reddoor.vn, exploité par RED DOOR Co., Ltd.",
    termsSections: [
      {
        title: "Propriété intellectuelle",
        body: "L'ensemble des images, catalogues, textes et dessins de ce site appartient à RED DOOR Co., Ltd. Merci de ne pas les reproduire ni les réutiliser à des fins commerciales sans accord écrit.",
      },
      {
        title: "Informations produits",
        body: "La laque étant un travail manuel, chaque pièce peut présenter de légères variations de couleur et de surface par rapport aux photographies — c'est le propre du métier, non un défaut. Caractéristiques, prix et délais sont confirmés dans un devis officiel.",
      },
      {
        title: "Devis et commandes",
        body: "Le contenu de ce site est présenté à titre d'information et ne constitue pas une offre ferme. Toute commande s'établit par échange direct et confirmation écrite.",
      },
    ],
    accessibilityIntro:
      "Red Door souhaite que chaque visiteur puisse utiliser ce site confortablement, y compris avec un lecteur d'écran ou au clavier.",
    accessibilitySections: [
      {
        title: "Notre engagement",
        body: "Le site suit les recommandations WCAG 2.1 niveau AA : structure de titres claire, contrastes suffisants, navigation au clavier et textes alternatifs pour les images.",
      },
      {
        title: "Limites connues",
        body: "Certains contenus, comme les catalogues à effet de feuilletage, ne sont pas encore pleinement optimisés pour les technologies d'assistance. Nous continuons d'améliorer cette expérience.",
      },
      {
        title: "Vos retours",
        body: "Si un élément du site vous gêne, signalez-le à sales@reddoor.vn et nous y remédierons.",
      },
    ],
  },
  footer: {
    description:
      "Red Door fabrique des objets en laque artisanale au village de Ha Thai, près de Hanoï — chaque couche est appliquée, poncée à l'eau et polie à la main pour des intérieurs du monde entier.",
    navigate: "Navigation",
    legal: "Informations légales",
    privacy: "Confidentialité",
    terms: "Conditions",
    accessibility: "Accessibilité",
    copyright:
      "© RED DOOR Co., Ltd — village de métier de Ha Thai, Hanoï. Tous droits réservés.",
  },
} satisfies PublicDictionary;

export default dictionary;
