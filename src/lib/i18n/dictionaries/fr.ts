import type { PublicDictionary } from "../dictionary";

const dictionary = {
  meta: {
    siteName: "Red Door",
    siteTitle: "Red Door — Laque artisanale du Vietnam",
    siteDescription:
      "Red Door est un fabricant de laque à Hanoï : plateaux, bols, vases, coffrets et objets décoratifs, laqués en couches, poncés à l'eau et polis à la main. Export international.",
  },
  common: {
    demoLabel: "Contenu DÉMO",
    skipToContent: "Aller au contenu principal",
    learnMore: "En savoir plus",
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
    replaceContentNotice:
      "Contenu DÉMO — à remplacer par les textes et médias approuvés par l'entreprise.",
  },
  nav: {
    home: "Accueil",
    about: "À propos",
    products: "Produits",
    collections: "Collections",
    process: "Procédé de laque",
    news: "Actualités",
    contact: "Contact",
  },
  home: {
    eyebrow: "RED DOOR — LA LAQUE VIVANTE",
    title: "Une surface vivante,",
    titleAccent: "façonnée à la main",
    craftTitle: "Un récit de matière, couche après couche",
    craftBody:
      "Un passage éditorial DÉMO destiné aux images d'atelier, aux notes de fabrication et aux récits produits approuvés.",
    historyTitle: "Histoire de l'entreprise",
    featuredTitle: "Produits à la une",
    collectionsTitle: "Collections",
    processTitle: "Le procédé de laque",
    newsTitle: "Carnet d'atelier",
    contactTitle: "Commençons la conversation",
    contactBody:
      "Décrivez votre recherche. Le formulaire définitif transmettra votre demande à l'équipe concernée.",
  },
  pages: {
    aboutTitle: "À propos",
    aboutIntro:
      "Une structure DÉMO pour le récit, les valeurs, les personnes et les informations d'atelier vérifiés.",
    productsTitle: "Produits",
    productsIntro:
      "Découvrez des fiches produits DÉMO destinées à être remplacées par les données approuvées du catalogue.",
    collectionsTitle: "Collections",
    collectionsIntro:
      "Ouvrez des couvertures de livres d'art DÉMO en attendant les années, PDF et récits de collection approuvés.",
    processTitle: "Procédé de laque",
    processIntro:
      "Une séquence DÉMO à remplacer par les matériaux, étapes et pratiques d'atelier vérifiés par l'entreprise.",
    newsTitle: "Actualités et récits",
    newsIntro:
      "Des articles DÉMO structurent les futures annonces et histoires approuvées.",
    contactTitle: "Contact et demande de devis",
    contactIntro:
      "Présentez les grandes lignes de votre demande. Les coordonnées affichées en développement restent temporaires sauf mention de vérification.",
    searchTitle: "Rechercher",
    privacyTitle: "Politique de confidentialité",
    termsTitle: "Conditions d'utilisation",
    accessibilityTitle: "Déclaration d'accessibilité",
  },
  about: {
    contentStatusLabel: "Statut du contenu",
    contentStatusValue: "DÉMO — en attente de validation par l'entreprise",
    claimsStatusLabel: "Informations factuelles",
    claimsStatusValue: "Aucune publication sans vérification",
    assetStatusLabel: "Ressources de marque",
    assetStatusValue: "Photographies approuvées en attente",
    principlesDescription:
      "Ces cartes DÉMO définissent les preuves requises avant la publication d'informations sur l'entreprise.",
    principleKicker: "Garantie éditoriale",
    verifiedStoryTitle: "Une histoire d'entreprise vérifiée",
    verifiedStoryDescription:
      "Les dates de fondation, étapes, clients, prix et certifications restent temporaires jusqu'à leur confirmation par une source habilitée.",
    approvedCapabilitiesTitle: "Des capacités approuvées",
    approvedCapabilitiesDescription:
      "Les affirmations sur les matières, techniques, capacités et délais ne paraîtront qu'après transmission et validation par l'entreprise.",
    documentedPeopleTitle: "Des personnes et un atelier documentés",
    documentedPeopleDescription:
      "Les portraits d'artisans, images d'atelier, noms et fonctions nécessitent un consentement et des sources approuvées avant publication.",
    archiveNotice:
      "Tous les chapitres de la chronologie portent la mention DÉMO et évitent les années, prix, clients ou certifications non vérifiés.",
  },
  product: {
    category: "Catégorie",
    collection: "Collection",
    material: "Matière",
    finish: "Finition",
    dimensions: "Dimensions",
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
    videoUnavailable:
      "Aucune vidéo produit approuvée n’est disponible dans cette DÉMO.",
    variants: "Variantes",
    variantsUnavailable:
      "Aucune variante approuvée n’est disponible dans cette DÉMO.",
    process: "Processus de fabrication",
    processUnavailable:
      "Aucune note de fabrication approuvée n’est disponible dans cette DÉMO.",
    noPrice: "Prix sur demande",
  },
  collection: {
    openBook: "Ouvrir le livre d'art",
    viewProducts: "Voir les produits",
    download: "Télécharger le PDF",
    downloadDisabled:
      "Le téléchargement PDF est indisponible pour cette collection DÉMO",
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
  contact: {
    fullName: "Nom complet",
    company: "Entreprise",
    email: "E-mail",
    phone: "Téléphone",
    country: "Pays ou région",
    countrySelect: "Sélectionner un pays ou une région",
    countryOther: "Autre pays ou région",
    interests: "Produits ou collections recherchés",
    quantity: "Quantité estimée",
    deadline: "Échéance souhaitée",
    notes: "Remarques",
    attachment: "Pièce jointe facultative",
    attachmentHelp:
      "DÉMO uniquement — la sélection et l'envoi de fichiers sont désactivés. Une fois activés, les formats PDF, JPG, PNG ou WebP seront acceptés jusqu'à 10 Mo ; n'ajoutez aucune donnée personnelle sensible.",
    mapTitle: "Plan",
    mapDescription:
      "La carte ne se charge qu'à votre demande : la page n'envoie ainsi aucune requête tierce au départ.",
    loadMap: "Charger le plan",
    mapUnavailable:
      "La carte n'a pas pu être chargée. Vous pouvez l'ouvrir directement dans Google Maps.",
    openInMaps: "Ouvrir dans Google Maps",
    consent:
      "J'accepte que mes informations soient utilisées pour répondre à cette demande.",
    submit: "Envoyer la demande",
    demoNotice:
      "Formulaire DÉMO — l'enregistrement et les notifications seront activés dans une phase ultérieure.",
    fax: "Fax",
    officeAddress: "Bureau",
    factoryAddress: "Atelier",
    warehouseAddress: "Entrepôt",
  },
  footer: {
    description:
      "Une expérience de marque DÉMO pour Red Door Vietnam. Remplacez tous les textes et coordonnées temporaires avant la mise en ligne.",
    navigate: "Navigation",
    legal: "Informations légales",
    privacy: "Confidentialité",
    terms: "Conditions",
    accessibility: "Accessibilité",
    copyright: "© Red Door Vietnam. Tous droits réservés.",
  },
} satisfies PublicDictionary;

export default dictionary;
