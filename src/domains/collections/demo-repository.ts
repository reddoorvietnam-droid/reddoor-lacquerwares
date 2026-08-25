import type { Locale } from "@/lib/i18n/config";

import type {
  PublicCollection,
  PublicCollectionCover,
  PublicCollectionListOptions,
  PublicCollectionRepository,
} from "./public-contract";

type CollectionCopy = {
  readonly title: string;
  readonly editionLabel: string;
  readonly summary: string;
  readonly introParagraphs: readonly string[];
  readonly flipbookNote: string;
  readonly coverAlt: string;
};

type CollectionLocaleCopy = {
  readonly assetReplacementHint: string;
  readonly collections: readonly CollectionCopy[];
};

type CollectionBlueprint = {
  readonly id: string;
  readonly slug: string;
  /** `null` until the company confirms the edition year. */
  readonly year: number | null;
  readonly productIds: readonly string[];
  readonly flipbookStatus: "notConfigured" | "availableOnRequest";
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

/**
 * Only the 2026 Collection is stated as fact: its catalogue exists. Earlier
 * editions are deliberately absent — we can source the company's trade-fair
 * record but not a year-by-year collection history, and a plausible-sounding
 * back catalogue would be an invention.
 *
 * Slugs are identical in every locale so that switching language on a
 * collection page cannot 404.
 */
const COLLECTION_BLUEPRINTS = deepFreeze([
  {
    id: "collection-2026",
    slug: "collection-2026",
    year: 2026,
    productIds: [
      "product-lacquer-serving-tray",
      "product-lacquer-bowl",
      "product-lacquer-vessel",
      "product-lacquer-keepsake-box",
      "product-lacquer-table-set",
      "product-lacquer-wall-panel",
      "product-lacquered-woven-basket",
      "product-lacquer-accent-table",
    ],
    flipbookStatus: "availableOnRequest",
    featured: true,
  },
  {
    id: "collection-forthcoming",
    slug: "next-collection",
    year: null,
    productIds: [],
    flipbookStatus: "notConfigured",
    featured: false,
  },
] satisfies readonly CollectionBlueprint[]);

const COLLECTION_COPY = deepFreeze({
  vi: {
    assetReplacementHint:
      "Ảnh bìa thật vẫn đang chờ. Lưu ảnh theo đúng tên tệp của khung và thay vào đây kèm publicId Cloudinary.",
    collections: [
      {
        title: "Bộ sưu tập 2026",
        editionLabel: "Ấn bản 2026",
        summary:
          "Catalogue hiện hành: những dòng sản phẩm xưởng đang làm, tập hợp một chỗ và xếp theo dáng và nước hoàn thiện.",
        introParagraphs: [
          "Bộ sưu tập 2026 là một catalogue để làm việc chứ không phải một cuốn lookbook. Nó tập hợp những dòng sản phẩm xưởng đang thực sự làm — khay, bát và đồ bàn ăn, bình dáng đứng, hộp, tranh treo tường, đồ đan và bàn nhỏ — rồi bày ra đúng theo cách chúng tôi vẫn bày lên mặt bàn cho khách xem.",
          "Cách nhóm ở đây dựa vào dáng và nước hoàn thiện chứ không dựa vào mã nội bộ, bởi nước hoàn thiện mới là thứ người mua thật sự phải chọn giữa. Mặt bóng, mặt mờ và mặt cẩn được đặt cạnh nhau có chủ ý: cùng một màu sẽ cư xử khác đi dưới mỗi nước hoàn thiện, và nhìn thấy chúng kề nhau là cách nhanh nhất để quyết định cái nào hợp với dòng hàng của mình.",
          "Không có giá in trong catalogue. Mọi thứ đều được báo giá theo một bản mô tả cụ thể — kích thước, nước hoàn thiện, số lượng, quy cách đóng gói — nên catalogue là nơi bạn tìm thấy dáng hình, còn con số nằm trong báo giá.",
        ],
        flipbookNote:
          "Catalogue Bộ sưu tập 2026 có sẵn theo yêu cầu và có thể xem dưới dạng sách lật.",
        coverAlt: "Bìa catalogue Bộ sưu tập 2026 của Red Door Vietnam",
      },
      {
        title: "Bộ sưu tập tiếp theo",
        editionLabel: "Đang chuẩn bị",
        summary:
          "Catalogue tiếp theo đang được chuẩn bị. Chưa có gì được chốt, và chúng tôi chọn để trang này trung thực thay vì lấp đầy nó.",
        introParagraphs: [
          "Chúng tôi đang làm bộ sưu tập tiếp theo. Chừng nào nội dung và thời điểm chưa được chốt thì ở đây chưa có điều gì chúng tôi sẵn sàng khẳng định, nên trang này cố ý để trống thay vì được lấp bằng một thông báo mà chúng tôi chưa thể đứng ra bảo đảm.",
          "Trong lúc chờ, Bộ sưu tập 2026 vẫn là catalogue hiện hành. Nếu bạn muốn được báo khi bộ tiếp theo sẵn sàng, hãy nhắn cho chúng tôi.",
        ],
        flipbookNote: "Chưa có catalogue nào được xuất bản cho bộ sưu tập này.",
        coverAlt: "Khung bìa dành cho catalogue bộ sưu tập sắp tới",
      },
    ],
  },
  en: {
    assetReplacementHint:
      "The final cover photograph is still outstanding. Save the approved image under this asset key and attach its Cloudinary publicId here.",
    collections: [
      {
        title: "The 2026 Collection",
        editionLabel: "2026 Edition",
        summary:
          "The current catalogue: the families the workshop is actively making, gathered in one place and grouped by form and finish.",
        introParagraphs: [
          "The 2026 Collection is a working catalogue rather than a look book. It gathers the families the workshop is actively making — trays, bowls and table pieces, standing vessels, boxes, wall panels, woven forms and small furniture — and sets them out the way we would set them out on a table for a visiting buyer.",
          "Grouping is by form and finish rather than by internal reference, because finish is what buyers actually choose between. Gloss, matte and inlaid surfaces are shown next to each other on purpose: the same colour behaves differently under each of them, and seeing them adjacent is the fastest way to decide which one belongs in a range.",
          "Nothing here carries a printed price. Everything is quoted against a specification — size, finish, quantity, packing — so the catalogue is where you find the form, and the quotation is where you find the number.",
        ],
        flipbookNote:
          "The 2026 Collection catalogue is available on request and can be read as a flipbook.",
        coverAlt: "Cover of the Red Door Vietnam 2026 Collection catalogue",
      },
      {
        title: "The next collection",
        editionLabel: "In preparation",
        summary:
          "The next catalogue is in preparation. Nothing is confirmed for it yet, and we would rather leave this page honest than fill it.",
        introParagraphs: [
          "We are working on the next collection. Until its contents and its date are settled there is nothing here we are prepared to state as fact, so this page stays deliberately empty rather than being filled with an announcement we cannot yet stand behind.",
          "The 2026 Collection remains the current catalogue in the meantime. If you would like to hear when the next one is ready, tell us and we will let you know.",
        ],
        flipbookNote:
          "No catalogue has been published for this collection yet.",
        coverAlt:
          "Reserved cover slot for the forthcoming collection catalogue",
      },
    ],
  },
  fr: {
    assetReplacementHint:
      "La photographie de couverture définitive reste à fournir. Enregistrez l'image approuvée sous cette clé d'actif et renseignez ici son publicId Cloudinary.",
    collections: [
      {
        title: "La Collection 2026",
        editionLabel: "Édition 2026",
        summary:
          "Le catalogue en cours : les familles que l'atelier produit aujourd'hui, réunies en un seul lieu et classées par forme et par finition.",
        introParagraphs: [
          "La Collection 2026 est un catalogue de travail, non un look book. Elle rassemble les familles que l'atelier produit réellement — plateaux, coupes et arts de la table, vases, coffrets, panneaux muraux, pièces tressées et petit mobilier — et les présente comme nous les présenterions sur une table à un acheteur de passage.",
          "Le classement suit la forme et la finition plutôt qu'une référence interne, car c'est bien entre des finitions que les acheteurs tranchent. Brillant, mat et incrusté sont volontairement montrés côte à côte : une même couleur se comporte différemment sous chacune d'elles, et les voir voisines reste la façon la plus rapide de décider laquelle a sa place dans une gamme.",
          "Aucun prix n'y est imprimé. Tout est chiffré sur cahier des charges — dimensions, finition, quantité, conditionnement — de sorte que le catalogue vous donne la forme, et le devis le chiffre.",
        ],
        flipbookNote:
          "Le catalogue de la Collection 2026 est disponible sur demande et peut être feuilleté en ligne.",
        coverAlt:
          "Couverture du catalogue de la Collection 2026 de Red Door Vietnam",
      },
      {
        title: "La prochaine collection",
        editionLabel: "En préparation",
        summary:
          "Le prochain catalogue est en préparation. Rien n'y est encore arrêté, et nous préférons laisser cette page honnête plutôt que de la remplir.",
        introParagraphs: [
          "Nous travaillons à la prochaine collection. Tant que son contenu et sa date ne sont pas arrêtés, rien ici ne peut être affirmé : cette page reste donc volontairement vide plutôt que d'accueillir une annonce que nous ne pourrions pas encore assumer.",
          "Dans l'intervalle, la Collection 2026 demeure le catalogue en cours. Si vous souhaitez être prévenu de la parution de la suivante, dites-le-nous.",
        ],
        flipbookNote:
          "Aucun catalogue n'a encore été publié pour cette collection.",
        coverAlt:
          "Emplacement réservé à la couverture du prochain catalogue de collection",
      },
    ],
  },
  de: {
    assetReplacementHint:
      "Die endgültige Titelaufnahme steht noch aus. Speichern Sie das freigegebene Bild unter diesem Asset-Key und tragen Sie hier seine Cloudinary-publicId ein.",
    collections: [
      {
        title: "Die Kollektion 2026",
        editionLabel: "Ausgabe 2026",
        summary:
          "Der aktuelle Katalog: die Produktfamilien, die in der Werkstatt derzeit entstehen – an einem Ort versammelt und nach Form und Oberfläche geordnet.",
        introParagraphs: [
          "Die Kollektion 2026 ist ein Arbeitskatalog, kein Lookbook. Sie versammelt die Familien, die tatsächlich in der Werkstatt entstehen – Tabletts, Schalen und Tischkultur, stehende Gefäße, Schatullen, Wandpaneele, Flechtwaren und Kleinmöbel – und legt sie so aus, wie wir sie einem Einkäufer auf dem Tisch ausbreiten würden.",
          "Geordnet wird nach Form und Oberfläche, nicht nach interner Referenz, denn zwischen Oberflächen entscheiden Einkäufer tatsächlich. Glänzende, matte und eingelegte Flächen stehen mit Absicht nebeneinander: Dieselbe Farbe verhält sich unter jeder von ihnen anders, und sie nebeneinander zu sehen ist der schnellste Weg zur Entscheidung, welche in ein Sortiment gehört.",
          "Gedruckte Preise finden Sie hier nicht. Alles wird gegen eine Spezifikation kalkuliert – Maß, Oberfläche, Stückzahl, Verpackung. Der Katalog zeigt also die Form, die Zahl steht im Angebot.",
        ],
        flipbookNote:
          "Der Katalog zur Kollektion 2026 ist auf Anfrage erhältlich und lässt sich als Blätterkatalog lesen.",
        coverAlt:
          "Titelseite des Katalogs zur Kollektion 2026 von Red Door Vietnam",
      },
      {
        title: "Die nächste Kollektion",
        editionLabel: "In Vorbereitung",
        summary:
          "Der nächste Katalog ist in Vorbereitung. Bestätigt ist dazu noch nichts, und wir lassen diese Seite lieber ehrlich als gefüllt.",
        introParagraphs: [
          "Wir arbeiten an der nächsten Kollektion. Solange Inhalt und Termin nicht feststehen, gibt es hier nichts, was wir als Tatsache formulieren wollen. Diese Seite bleibt deshalb bewusst leer, statt eine Ankündigung zu tragen, für die wir noch nicht geradestehen können.",
          "Bis dahin bleibt die Kollektion 2026 der aktuelle Katalog. Wenn Sie erfahren möchten, sobald die nächste fertig ist, sagen Sie uns Bescheid.",
        ],
        flipbookNote:
          "Für diese Kollektion wurde noch kein Katalog veröffentlicht.",
        coverAlt:
          "Reservierter Titelplatz für den kommenden Kollektionskatalog",
      },
    ],
  },
  ja: {
    assetReplacementHint:
      "最終的な表紙写真はまだ届いていません。承認済みの画像をこのアセットキーの名前で保存し、Cloudinary の publicId をここに設定してください。",
    collections: [
      {
        title: "2026年コレクション",
        editionLabel: "2026年版",
        summary:
          "現行のカタログです。工房がいま実際につくっている品目を一冊にまとめ、かたちと仕上げで並べています。",
        introParagraphs: [
          "2026年コレクションは、ルックブックではなく実務のためのカタログです。工房がいま実際につくっている品目——トレー、鉢とテーブルウェア、花器、箱、ウォールパネル、編み製品、小家具——をまとめ、お越しいただいたバイヤーの方に卓上でお見せするときと同じ並べ方で掲載しています。",
          "分類は社内の型番ではなく、かたちと仕上げによります。バイヤーの方が実際に迷われるのは仕上げだからです。艶あり、艶消し、加飾の面をあえて隣り合わせに載せています。同じ色でも仕上げによってふるまいが変わりますし、並べて見ていただくのが、どれを取り扱いに加えるかを決める一番の近道だからです。",
          "価格は掲載しておりません。すべて仕様——寸法、仕上げ、数量、梱包——に沿ってお見積もりいたしますので、カタログではかたちをご覧いただき、数字はお見積もりでご確認いただく形になります。",
        ],
        flipbookNote:
          "2026年コレクションのカタログはご請求いただけます。フリップブックとしてもご覧いただけます。",
        coverAlt: "Red Door Vietnam 2026年コレクションのカタログ表紙",
      },
      {
        title: "次のコレクション",
        editionLabel: "準備中",
        summary:
          "次のカタログを準備しています。まだ確定した事柄がないため、無理に埋めるより、正直なままにしておきます。",
        introParagraphs: [
          "次のコレクションを準備しております。内容も時期も定まらないうちは、事実として申し上げられることがありません。ですから、まだ責任をもってお伝えできない告知で埋めるより、このページはあえて空けたままにしております。",
          "それまでのあいだ、現行のカタログは引き続き2026年コレクションです。次のカタログができましたらお知らせいたしますので、ご希望の方はお申し付けください。",
        ],
        flipbookNote: "このコレクションのカタログはまだ刊行されておりません。",
        coverAlt: "次のコレクションのカタログ表紙のための予約枠",
      },
    ],
  },
  "zh-CN": {
    assetReplacementHint:
      "最终封面照片尚未提供。请以此资产键名保存经批准的图片，并在此填入其 Cloudinary publicId。",
    collections: [
      {
        title: "2026 系列",
        editionLabel: "2026 年版",
        summary:
          "现行图录：工坊当下正在制作的各个品类，集于一处，按器形与饰面编排。",
        introParagraphs: [
          "2026 系列是一本用于工作的图录，不是一本形象册。它汇集了工坊当下真正在做的品类——托盘、钵与餐桌器物、花器、盒具、壁板、编织器物与小型家具——并按照我们当面在桌上摊给采购方看的方式来编排。",
          "分类依据的是器形与饰面，而不是内部编号，因为采购方真正需要在其间取舍的正是饰面。亮面、哑光与镶嵌被有意并置：同一种颜色在不同饰面下表现并不相同，而把它们放在一起看，是决定哪一种适合自己产品线的最快方式。",
          "图录中不印价格。所有产品都按具体规格报价——尺寸、饰面、数量、包装——因此图录给的是器形，数字在报价里。",
        ],
        flipbookNote: "2026 系列图录可按需索取，也可以翻页书形式在线阅读。",
        coverAlt: "Red Door Vietnam 2026 系列图录封面",
      },
      {
        title: "下一个系列",
        editionLabel: "筹备中",
        summary:
          "下一本图录正在筹备。目前尚无任何确定内容，我们宁可让这一页保持诚实，也不愿把它填满。",
        introParagraphs: [
          "我们正在筹备下一个系列。在内容与时间确定之前，这里没有任何可以作为事实陈述的信息，因此这一页有意留白，而不是放上一则我们还无法负责的公告。",
          "在此期间，2026 系列仍是现行图录。若您希望在下一本出版时收到通知，请告诉我们。",
        ],
        flipbookNote: "本系列尚未出版图录。",
        coverAlt: "为下一本系列图录封面预留的图位",
      },
    ],
  },
} satisfies Record<Locale, CollectionLocaleCopy>);

/** Portrait 5:7, the ratio the listing reserves for a catalogue cover. */
const COVER_WIDTH = 1000;
const COVER_HEIGHT = 1400;

function makeCover(
  collectionId: string,
  alt: string,
  replacementHint: string,
): PublicCollectionCover {
  return {
    assetKey: `${collectionId}-cover`,
    // Never point at a stand-in file: a null src is what makes the layout
    // render a reserved slot rather than pass a placeholder off as the cover.
    src: null,
    alt,
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    assetPending: true,
    replacementHint,
  };
}

function makeCollections(locale: Locale): readonly PublicCollection[] {
  const localeCopy = COLLECTION_COPY[locale];

  return deepFreeze(
    COLLECTION_BLUEPRINTS.map((blueprint, index) => {
      const copy = localeCopy.collections[index];

      if (!copy) {
        throw new Error(
          `Missing collection copy for ${locale} at index ${index}.`,
        );
      }

      return {
        id: blueprint.id,
        // The copy is approved company text, so it carries no DEMO marker.
        marker: null,
        isDemo: false,
        locale,
        slug: blueprint.slug,
        title: copy.title,
        editionLabel: copy.editionLabel,
        year: blueprint.year,
        summary: copy.summary,
        introParagraphs: copy.introParagraphs,
        cover: makeCover(
          blueprint.id,
          copy.coverAlt,
          localeCopy.assetReplacementHint,
        ),
        productIds: blueprint.productIds,
        flipbook: {
          status: blueprint.flipbookStatus,
          // The catalogue exists as an object, but no hosted file and no page
          // count have been supplied, so both stay null.
          pdfUrl: null,
          pageCount: null,
          downloadAllowed: false,
          availabilityNote: copy.flipbookNote,
        },
        featured: blueprint.featured,
        sortOrder: index + 1,
      } satisfies PublicCollection;
    }),
  );
}

export const DEMO_COLLECTIONS_BY_LOCALE: Readonly<
  Record<Locale, readonly PublicCollection[]>
> = deepFreeze({
  vi: makeCollections("vi"),
  en: makeCollections("en"),
  fr: makeCollections("fr"),
  de: makeCollections("de"),
  ja: makeCollections("ja"),
  "zh-CN": makeCollections("zh-CN"),
});

function applyListOptions(
  collections: readonly PublicCollection[],
  options?: PublicCollectionListOptions,
): readonly PublicCollection[] {
  if (!options) {
    return collections;
  }

  let result = collections.filter(
    (collection) => !options.featuredOnly || collection.featured,
  );

  if (options.limit !== undefined) {
    const limit = Math.max(0, Math.trunc(options.limit));
    result = result.slice(0, limit);
  }

  return deepFreeze(result);
}

const demoCollectionRepositoryImplementation: PublicCollectionRepository = {
  async list(locale, options) {
    return applyListOptions(DEMO_COLLECTIONS_BY_LOCALE[locale], options);
  },
  async getById(locale, id) {
    return (
      DEMO_COLLECTIONS_BY_LOCALE[locale].find(
        (collection) => collection.id === id,
      ) ?? null
    );
  },
  async getBySlug(locale, slug) {
    return (
      DEMO_COLLECTIONS_BY_LOCALE[locale].find(
        (collection) => collection.slug === slug,
      ) ?? null
    );
  },
};

export const demoCollectionRepository: PublicCollectionRepository =
  Object.freeze(demoCollectionRepositoryImplementation);
