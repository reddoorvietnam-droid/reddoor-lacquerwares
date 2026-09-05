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

/**
 * Brand content for the public site.
 *
 * Everything here is either a verifiable fact about the company or a
 * description of the lacquer craft itself. Two categories are deliberately
 * absent, because no source was found for them and inventing them would put
 * false claims on a company's own website:
 *
 * - a founding year, and any dated origin story;
 * - customer names. Public US customs records do name buyers, but publishing a
 *   client list is the company's decision to make, not ours.
 *
 * Photographs have not been supplied. Each image is a reserved slot carrying
 * its intended pixel size and a stable `assetKey`; `ImageSlot` draws that box
 * so the layout is settled before the photography arrives.
 *
 * Sources for the factual claims: the company's own contact page, its Vietnam
 * trade-directory listings, and public United States import records.
 */

type MilestoneCopy = {
  readonly periodLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly imageAlt: string;
};

type ProcessCopy = {
  readonly stepLabel: string;
  readonly title: string;
  readonly summary: string;
  readonly imageAlt: string;
};

type ContentCopy = {
  readonly company: {
    readonly eyebrow: string;
    readonly tagline: string;
    readonly summary: string;
    readonly contentNotice: string;
    readonly heroAlt: string;
  };
  readonly assetReplacementHint: string;
  readonly contactNotice: string;
  readonly history: readonly MilestoneCopy[];
  readonly process: readonly ProcessCopy[];
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

const SITE_CONTENT_COPY = deepFreeze({
  vi: {
    company: {
      eyebrow: "Nghệ thuật sơn mài Việt Nam",
      tagline: "Nghệ thuật sơn mài Việt Nam",
      summary:
        "Red Door là nhà sản xuất sơn mài Việt Nam đặt tại Hà Nội. Chúng tôi làm khay, bát, bình, hộp và các vật dụng trang trí bằng kỹ thuật sơn mài truyền thống — phủ từng lớp, mài nước giữa các lớp, đánh bóng bằng tay cho tới khi bề mặt sâu và ấm. Xưởng của chúng tôi ở Long Biên; kho hàng đặt tại Hưng Yên, ngay trên trục quốc lộ 5 đi cảng Hải Phòng.",
      contentNotice: "",
      heroAlt:
        "Bề mặt sơn mài đỏ với vân sơn sâu, chụp nghiêng dưới ánh sáng ấm",
    },
    assetReplacementHint:
      "Ô ảnh đang chờ hình thật. Lưu ảnh đúng tên tệp và kích thước ghi trên ô.",
    contactNotice: "",
    history: [
      {
        periodLabel: "Hà Nội",
        title: "Xưởng sơn mài tại Long Biên",
        summary:
          "Xưởng chính của chúng tôi nằm trên phố Nguyễn Sơn, quận Long Biên. Đây là nơi tạo vóc, phủ lớp, mài và đánh bóng — toàn bộ các công đoạn quyết định chiều sâu của bề mặt sơn mài.",
        imageAlt: "Không gian xưởng sơn mài với các sản phẩm đang phơi khô",
      },
      {
        periodLabel: "Xuất khẩu",
        title: "Hàng đi thị trường quốc tế",
        summary:
          "Sản phẩm của Red Door xuất qua cảng Hải Phòng tới các thị trường quốc tế; riêng Hoa Kỳ có hồ sơ nhập khẩu công khai từ năm 2007. Chúng tôi tự làm chứng từ xuất nhập khẩu và tờ khai hải quan.",
        imageAlt: "Sản phẩm sơn mài được đóng gói chuẩn bị xuất khẩu",
      },
      {
        periodLabel: "2016 – 2025",
        title: "Ambiente Frankfurt",
        summary:
          "Chúng tôi giới thiệu bộ sưu tập tại hội chợ Ambiente Frankfurt qua nhiều kỳ, nơi nhà mua hàng quốc tế xem trực tiếp mẫu và trao đổi yêu cầu riêng.",
        imageAlt: "Gian hàng trưng bày sản phẩm sơn mài tại hội chợ quốc tế",
      },
      {
        periodLabel: "Hưng Yên",
        title: "Kho và hậu cần",
        summary:
          "Kho hàng của chúng tôi nằm trên quốc lộ 5 tại thị trấn Bần, Hưng Yên — đúng trục đường nối Hà Nội với cảng Hải Phòng, giúp rút ngắn thời gian từ khi đóng gói tới khi lên tàu.",
        imageAlt: "Kho hàng với các thùng carton xếp theo lô xuất",
      },
    ],
    process: [
      {
        stepLabel: "Công đoạn 01",
        title: "Làm vóc",
        summary:
          "Mỗi món bắt đầu từ cốt — gỗ, tre hoặc vật liệu composite tùy sản phẩm. Cốt được bọc vải, trám và làm phẳng để tạo nền ổn định, không xê dịch khi đi qua nhiều lớp sơn.",
        imageAlt: "Người thợ đang làm phẳng cốt gỗ trước khi phủ sơn",
      },
      {
        stepLabel: "Công đoạn 02",
        title: "Phủ lớp và mài",
        summary:
          "Sơn được phủ thành nhiều lớp mỏng. Mỗi lớp phải khô hoàn toàn rồi mài nước trước khi phủ lớp kế tiếp. Đây là công đoạn dài nhất, và cũng là thứ tạo nên chiều sâu mà sơn phun công nghiệp không có.",
        imageAlt: "Bề mặt sơn mài đang được mài nước giữa hai lớp phủ",
      },
      {
        stepLabel: "Công đoạn 03",
        title: "Trang trí bề mặt",
        summary:
          "Tùy yêu cầu từng đơn hàng, bề mặt có thể được thếp vàng, thếp bạc, khảm trứng hoặc khảm trai, vẽ tay, hoặc pha màu theo bảng màu riêng của khách.",
        imageAlt: "Người thợ đang thếp lá vàng lên bề mặt sơn mài",
      },
      {
        stepLabel: "Công đoạn 04",
        title: "Đánh bóng",
        summary:
          "Lớp phủ cuối được mài mịn dần rồi đánh bóng bằng tay cho tới khi ánh sáng chạy đều trên toàn bề mặt. Độ bóng đến từ chính thao tác mài, không phải từ một lớp phủ bóng bên ngoài.",
        imageAlt: "Bàn tay đang đánh bóng bề mặt sơn mài hoàn thiện",
      },
      {
        stepLabel: "Công đoạn 05",
        title: "Kiểm tra và đóng gói",
        summary:
          "Từng món được kiểm màu, độ phẳng và độ hoàn thiện của cạnh trước khi đóng gói. Hàng không đạt quay lại xưởng để khắc phục chứ không đi tiếp xuống khâu đóng hàng.",
        imageAlt: "Kiểm tra chất lượng sản phẩm sơn mài trước khi đóng gói",
      },
    ],
  },
  en: {
    company: {
      eyebrow: "Handcrafted lacquer · Hanoi",
      tagline: "Vietnamese handcrafted lacquer",
      summary:
        "Red Door is a Vietnamese lacquerware manufacturer based in Hanoi. We make trays, bowls, vessels, boxes and decorative objects using traditional lacquer technique — coat upon coat, wet-sanded between layers, hand-polished until the surface reads deep and warm. Our workshop is in Long Bien; our warehouse sits in Hung Yen, on the highway that runs to Hai Phong port.",
      contentNotice: "",
      heroAlt:
        "Red lacquer surface with deep grain, photographed at an angle in warm light",
    },
    assetReplacementHint:
      "This slot is waiting for a real photograph. Save the asset under the file name and pixel size shown.",
    contactNotice: "",
    history: [
      {
        periodLabel: "Hanoi",
        title: "The Long Bien workshop",
        summary:
          "Our main workshop stands on Nguyen Son Street in Long Bien district. This is where bodies are built, coats are laid, surfaces are sanded and pieces are polished — every stage that decides how deep a lacquer surface finally reads.",
        imageAlt: "Lacquer workshop interior with pieces drying on racks",
      },
      {
        periodLabel: "Export",
        title: "Shipping to international markets",
        summary:
          "Our work leaves through Hai Phong port for international markets; United States import records for our shipments have been public since 2007. We prepare our own export documentation and customs declarations.",
        imageAlt: "Finished lacquerware packed and ready for export",
      },
      {
        periodLabel: "2016 – 2025",
        title: "Ambiente Frankfurt",
        summary:
          "We have shown our collections at Ambiente Frankfurt across several editions, where international buyers handle the pieces themselves and talk through bespoke requirements.",
        imageAlt: "Lacquerware display stand at an international trade fair",
      },
      {
        periodLabel: "Hung Yen",
        title: "Warehousing and logistics",
        summary:
          "Our warehouse sits on National Road 5 at Ban Town, Hung Yen — on the corridor linking Hanoi to Hai Phong port, which shortens the time between packing and loading.",
        imageAlt: "Warehouse with cartons staged by shipment batch",
      },
    ],
    process: [
      {
        stepLabel: "Stage 01",
        title: "Building the body",
        summary:
          "Every piece starts as a body — wood, bamboo or a composite, depending on the object. It is covered in cloth, filled and levelled to give a stable ground that will not move under the coats to come.",
        imageAlt: "An artisan levelling a wooden body before lacquering",
      },
      {
        stepLabel: "Stage 02",
        title: "Coating and sanding",
        summary:
          "Lacquer goes on in thin layers. Each one must cure fully and be wet-sanded before the next is laid. This is the longest stage in the making, and it is what gives the surface a depth that sprayed finishes cannot reach.",
        imageAlt: "A lacquer surface being wet-sanded between coats",
      },
      {
        stepLabel: "Stage 03",
        title: "Surface decoration",
        summary:
          "Depending on the order, a surface may be gilded in gold or silver leaf, inlaid with eggshell or mother-of-pearl, hand-painted, or matched to a client's own colourway.",
        imageAlt: "An artisan applying gold leaf to a lacquer surface",
      },
      {
        stepLabel: "Stage 04",
        title: "Polishing",
        summary:
          "The final coats are sanded progressively finer, then polished by hand until light runs evenly across the whole surface. The shine comes from the polishing itself, not from a gloss layer added on top.",
        imageAlt: "Hands polishing a finished lacquer surface",
      },
      {
        stepLabel: "Stage 05",
        title: "Inspection and packing",
        summary:
          "Each piece is checked for colour, flatness and edge finish before it is packed. Anything that fails goes back to the workshop for rework rather than forward to the packing line.",
        imageAlt: "Quality inspection of lacquerware before packing",
      },
    ],
  },
  fr: {
    company: {
      eyebrow: "Laque artisanale · Hanoï",
      tagline: "Laque artisanale du Vietnam",
      summary:
        "Red Door est un fabricant vietnamien de laque établi à Hanoï. Nous réalisons plateaux, bols, vases, coffrets et objets décoratifs selon la technique traditionnelle de la laque — couche après couche, poncées à l'eau entre chaque passe, polies à la main jusqu'à obtenir une surface profonde et chaleureuse. Notre atelier se trouve à Long Bien ; notre entrepôt à Hung Yen, sur la route qui mène au port de Hai Phong.",
      contentNotice: "",
      heroAlt:
        "Surface de laque rouge au grain profond, photographiée de biais sous une lumière chaude",
    },
    assetReplacementHint:
      "Cet emplacement attend une photographie. Enregistrez le fichier sous le nom et à la taille indiqués.",
    contactNotice: "",
    history: [
      {
        periodLabel: "Hanoï",
        title: "L'atelier de Long Bien",
        summary:
          "Notre atelier principal se situe rue Nguyen Son, dans le district de Long Bien. C'est là que les corps sont montés, les couches appliquées, les surfaces poncées et les pièces polies — toutes les étapes qui décident de la profondeur finale de la laque.",
        imageAlt: "Intérieur de l'atelier de laque, pièces en cours de séchage",
      },
      {
        periodLabel: "Export",
        title: "Expéditions vers les marchés internationaux",
        summary:
          "Nos pièces partent du port de Hai Phong vers les marchés internationaux ; les registres d'importation des États-Unis concernant nos expéditions sont publics depuis 2007. Nous établissons nous-mêmes nos documents d'export et nos déclarations douanières.",
        imageAlt: "Laques emballées, prêtes à l'expédition",
      },
      {
        periodLabel: "2016 – 2025",
        title: "Ambiente Francfort",
        summary:
          "Nous présentons nos collections au salon Ambiente de Francfort depuis plusieurs éditions, où les acheteurs internationaux manipulent les pièces et exposent leurs demandes sur mesure.",
        imageAlt: "Stand de laques lors d'un salon international",
      },
      {
        periodLabel: "Hung Yen",
        title: "Entreposage et logistique",
        summary:
          "Notre entrepôt se trouve sur la route nationale 5 à Ban Town, Hung Yen — sur l'axe reliant Hanoï au port de Hai Phong, ce qui raccourcit le délai entre l'emballage et le chargement.",
        imageAlt: "Entrepôt avec cartons regroupés par lot d'expédition",
      },
    ],
    process: [
      {
        stepLabel: "Étape 01",
        title: "Le montage du corps",
        summary:
          "Chaque pièce commence par un corps — bois, bambou ou composite selon l'objet. Il est entoilé, mastiqué et dressé pour offrir un support stable qui ne travaillera pas sous les couches à venir.",
        imageAlt: "Artisan dressant un corps en bois avant laquage",
      },
      {
        stepLabel: "Étape 02",
        title: "Couches et ponçage",
        summary:
          "La laque s'applique en couches fines. Chacune doit sécher complètement et être poncée à l'eau avant la suivante. C'est l'étape la plus longue, et c'est elle qui donne à la surface une profondeur qu'aucune finition pulvérisée n'atteint.",
        imageAlt: "Surface laquée poncée à l'eau entre deux couches",
      },
      {
        stepLabel: "Étape 03",
        title: "Décor de surface",
        summary:
          "Selon la commande, une surface peut être dorée à la feuille d'or ou d'argent, incrustée de coquille d'œuf ou de nacre, peinte à la main, ou accordée au nuancier du client.",
        imageAlt: "Artisan posant une feuille d'or sur une surface laquée",
      },
      {
        stepLabel: "Étape 04",
        title: "Polissage",
        summary:
          "Les dernières couches sont poncées de plus en plus finement, puis polies à la main jusqu'à ce que la lumière glisse uniformément sur toute la surface. Le brillant naît du polissage, non d'un vernis ajouté.",
        imageAlt: "Mains polissant une surface laquée achevée",
      },
      {
        stepLabel: "Étape 05",
        title: "Contrôle et emballage",
        summary:
          "Chaque pièce est contrôlée en couleur, en planéité et en finition d'arête avant emballage. Ce qui ne passe pas retourne à l'atelier plutôt que d'avancer vers la ligne de conditionnement.",
        imageAlt: "Contrôle qualité de laques avant emballage",
      },
    ],
  },
  de: {
    company: {
      eyebrow: "Handgefertigte Lackkunst · Hanoi",
      tagline: "Handgefertigte Lackkunst",
      summary:
        "Red Door ist ein vietnamesischer Lackwaren-Hersteller mit Sitz in Hanoi. Wir fertigen Tabletts, Schalen, Gefäße, Schatullen und dekorative Objekte in traditioneller Lacktechnik — Schicht auf Schicht, zwischen den Aufträgen nass geschliffen, von Hand poliert, bis die Oberfläche tief und warm wirkt. Unsere Werkstatt liegt in Long Bien; unser Lager in Hung Yen, an der Fernstraße zum Hafen Hai Phong.",
      contentNotice: "",
      heroAlt:
        "Rote Lackoberfläche mit tiefer Maserung, schräg im warmen Licht aufgenommen",
    },
    assetReplacementHint:
      "Dieser Platz wartet auf eine echte Aufnahme. Speichern Sie die Datei unter dem angegebenen Namen und in der angegebenen Größe.",
    contactNotice: "",
    history: [
      {
        periodLabel: "Hanoi",
        title: "Die Werkstatt in Long Bien",
        summary:
          "Unsere Hauptwerkstatt steht in der Nguyen-Son-Straße im Bezirk Long Bien. Hier entstehen die Korpusse, hier werden Schichten aufgetragen, Flächen geschliffen und Stücke poliert — all das entscheidet, wie tief eine Lackoberfläche am Ende wirkt.",
        imageAlt: "Innenraum der Lackwerkstatt mit trocknenden Stücken",
      },
      {
        periodLabel: "Export",
        title: "Versand in internationale Märkte",
        summary:
          "Unsere Arbeiten verlassen das Land über den Hafen Hai Phong; die US-Einfuhrunterlagen zu unseren Sendungen sind seit 2007 öffentlich einsehbar. Exportdokumente und Zollanmeldungen erstellen wir selbst.",
        imageAlt: "Fertige Lackwaren verpackt und versandbereit",
      },
      {
        periodLabel: "2016 – 2025",
        title: "Ambiente Frankfurt",
        summary:
          "Wir zeigen unsere Kollektionen seit mehreren Ausgaben auf der Ambiente in Frankfurt, wo internationale Einkäufer die Stücke selbst in die Hand nehmen und Sonderwünsche besprechen.",
        imageAlt: "Messestand mit Lackwaren auf einer internationalen Messe",
      },
      {
        periodLabel: "Hung Yen",
        title: "Lager und Logistik",
        summary:
          "Unser Lager liegt an der Fernstraße 5 in Ban Town, Hung Yen — auf der Achse zwischen Hanoi und dem Hafen Hai Phong, was die Zeit zwischen Verpacken und Verladen verkürzt.",
        imageAlt: "Lager mit nach Sendungen sortierten Kartons",
      },
    ],
    process: [
      {
        stepLabel: "Schritt 01",
        title: "Den Korpus aufbauen",
        summary:
          "Jedes Stück beginnt als Korpus — je nach Objekt aus Holz, Bambus oder einem Verbundwerkstoff. Er wird mit Gewebe überzogen, gespachtelt und abgezogen, damit ein stabiler Grund entsteht, der sich unter den folgenden Schichten nicht bewegt.",
        imageAlt: "Handwerker zieht einen Holzkorpus vor dem Lackieren ab",
      },
      {
        stepLabel: "Schritt 02",
        title: "Auftragen und Schleifen",
        summary:
          "Der Lack wird in dünnen Lagen aufgetragen. Jede muss vollständig aushärten und nass geschliffen werden, bevor die nächste folgt. Das ist der längste Abschnitt der Fertigung — und der Grund für eine Tiefe, die gespritzte Oberflächen nicht erreichen.",
        imageAlt:
          "Lackoberfläche wird zwischen zwei Schichten nass geschliffen",
      },
      {
        stepLabel: "Schritt 03",
        title: "Oberflächengestaltung",
        summary:
          "Je nach Auftrag kann eine Fläche mit Blattgold oder Blattsilber vergoldet, mit Eierschale oder Perlmutt eingelegt, von Hand bemalt oder auf die Farbwelt des Kunden abgestimmt werden.",
        imageAlt: "Handwerker legt Blattgold auf eine Lackoberfläche",
      },
      {
        stepLabel: "Schritt 04",
        title: "Polieren",
        summary:
          "Die letzten Schichten werden zunehmend feiner geschliffen und dann von Hand poliert, bis das Licht gleichmäßig über die ganze Fläche läuft. Der Glanz entsteht durch das Polieren, nicht durch eine aufgesetzte Klarschicht.",
        imageAlt: "Hände polieren eine fertige Lackoberfläche",
      },
      {
        stepLabel: "Schritt 05",
        title: "Prüfung und Verpackung",
        summary:
          "Vor dem Verpacken wird jedes Stück auf Farbe, Ebenheit und Kantenverarbeitung geprüft. Was nicht besteht, geht zur Nacharbeit zurück in die Werkstatt statt weiter zur Packlinie.",
        imageAlt: "Qualitätsprüfung von Lackwaren vor dem Verpacken",
      },
    ],
  },
  ja: {
    company: {
      eyebrow: "手仕事の漆 · ハノイ",
      tagline: "ベトナムの手仕事の漆",
      summary:
        "レッドドアは、ハノイに拠点を置くベトナムの漆器メーカーです。トレイ、ボウル、花器、箱、装飾品を伝統的な漆の技法で制作しています。塗りを重ね、層のあいだで水研ぎを行い、深く温かい表情が出るまで手作業で磨き上げます。工房はロンビエン地区に、倉庫はハイフォン港へ向かう街道沿いのフンイエン省にあります。",
      contentNotice: "",
      heroAlt: "温かな光を斜めから受けた、深い木目のある赤い漆の表面",
    },
    assetReplacementHint:
      "この枠は写真の差し替えを待っています。表示されたファイル名と画素サイズで保存してください。",
    contactNotice: "",
    history: [
      {
        periodLabel: "ハノイ",
        title: "ロンビエンの工房",
        summary:
          "主要な工房はロンビエン地区のグエンソン通りにあります。素地づくり、塗り重ね、研ぎ、磨き——漆の表情の深さを決めるすべての工程がここで行われます。",
        imageAlt: "漆器が乾燥棚に並ぶ工房の内部",
      },
      {
        periodLabel: "輸出",
        title: "海外市場への出荷",
        summary:
          "製品はハイフォン港から海外市場へ出荷されます。米国向けの輸入記録は2007年以降公開されています。輸出書類と税関申告は自社で作成しています。",
        imageAlt: "梱包され出荷を待つ完成した漆器",
      },
      {
        periodLabel: "2016 – 2025",
        title: "アンビエンテ・フランクフルト",
        summary:
          "フランクフルトの見本市アンビエンテに複数回出展しています。海外のバイヤーが実際に手に取り、個別の仕様について直接ご相談いただける場です。",
        imageAlt: "国際見本市に設けられた漆器の展示ブース",
      },
      {
        periodLabel: "フンイエン",
        title: "倉庫と物流",
        summary:
          "倉庫はフンイエン省バンの国道5号線沿いにあります。ハノイとハイフォン港を結ぶ幹線上に位置するため、梱包から船積みまでの時間を短くできます。",
        imageAlt: "出荷ロットごとに積まれた段ボールのある倉庫",
      },
    ],
    process: [
      {
        stepLabel: "工程 01",
        title: "素地をつくる",
        summary:
          "どの品も素地から始まります。品物に応じて木、竹、または複合材を用い、布を着せ、目を埋めて平らに整えます。以後の塗り重ねに動かされない、安定した下地をつくる工程です。",
        imageAlt: "漆を塗る前に木の素地を平らに整える職人",
      },
      {
        stepLabel: "工程 02",
        title: "塗りと研ぎ",
        summary:
          "漆は薄く塗り重ねます。一層ごとに完全に乾かし、水研ぎをしてから次を塗ります。制作の中で最も時間を要する工程であり、吹き付け塗装では届かない深みはここから生まれます。",
        imageAlt: "塗りの合間に水研ぎされている漆の表面",
      },
      {
        stepLabel: "工程 03",
        title: "加飾",
        summary:
          "ご注文に応じて、金箔・銀箔の箔置き、卵殻や螺鈿の象嵌、手描き、あるいはお客さまのご指定色への調色を行います。",
        imageAlt: "漆の表面に金箔を置く職人",
      },
      {
        stepLabel: "工程 04",
        title: "磨き",
        summary:
          "仕上げの層を段階的に細かく研ぎ、光が面全体へ均一に流れるまで手で磨き上げます。この艶は磨きそのものから生まれるもので、上塗りの光沢層によるものではありません。",
        imageAlt: "仕上がった漆の表面を磨く手元",
      },
      {
        stepLabel: "工程 05",
        title: "検品と梱包",
        summary:
          "梱包前に、色、平滑さ、縁の仕上がりを一点ずつ確認します。基準に満たないものは梱包工程へ進めず、工房へ戻して手直しします。",
        imageAlt: "梱包前に行う漆器の品質検査",
      },
    ],
  },
  "zh-CN": {
    company: {
      eyebrow: "手工漆艺 · 河内",
      tagline: "越南手工漆艺",
      summary:
        "红门是一家位于河内的越南漆器制造商。我们以传统漆艺制作托盘、碗、器皿、盒具与装饰摆件——层层髹涂，层间水磨，手工推光，直至表面呈现温润而有深度的光泽。工坊设在龙编郡；仓库位于兴安省，就在通往海防港的干线旁。",
      contentNotice: "",
      heroAlt: "暖光斜照下纹理深邃的红色漆面",
    },
    assetReplacementHint:
      "此处预留给正式照片。请按图框标示的文件名与像素尺寸保存素材。",
    contactNotice: "",
    history: [
      {
        periodLabel: "河内",
        title: "龙编工坊",
        summary:
          "主工坊位于龙编郡阮山街。制胎、髹涂、打磨、推光——决定漆面最终深度的每一道工序都在这里完成。",
        imageAlt: "漆器在晾架上阴干的工坊内景",
      },
      {
        periodLabel: "出口",
        title: "发往国际市场",
        summary:
          "产品经海防港发往国际市场；美国方面的进口记录自 2007 年起公开可查。出口单证与报关文件由我们自行办理。",
        imageAlt: "已包装待出口的成品漆器",
      },
      {
        periodLabel: "2016 – 2025",
        title: "法兰克福 Ambiente 展",
        summary:
          "我们多次参加法兰克福 Ambiente 消费品展，国际买家可在现场亲手品鉴样品，并当面沟通定制需求。",
        imageAlt: "国际展会上的漆器展位",
      },
      {
        periodLabel: "兴安",
        title: "仓储与物流",
        summary:
          "仓库位于兴安省槟镇 5 号国道旁，正处河内至海防港的干线之上，可缩短从包装到装船的周转时间。",
        imageAlt: "按出货批次码放纸箱的仓库",
      },
    ],
    process: [
      {
        stepLabel: "工序 01",
        title: "制胎",
        summary:
          "每件作品都始于胎体——依器型选用木、竹或复合材料。裹布、批灰、找平，做出一个在后续多层髹涂下不会走形的稳固底子。",
        imageAlt: "髹漆前正在找平木胎的工匠",
      },
      {
        stepLabel: "工序 02",
        title: "髹涂与打磨",
        summary:
          "漆需薄涂多层。每一层都要彻底干透并经水磨，才能髹下一层。这是制作中最耗时的工序，也正是喷涂工艺无法企及的深度所在。",
        imageAlt: "两层髹涂之间正在水磨的漆面",
      },
      {
        stepLabel: "工序 03",
        title: "表面装饰",
        summary:
          "可依订单需求进行贴金箔或银箔、嵌蛋壳或螺钿、手绘，或按客户指定色系调色。",
        imageAlt: "正在漆面上贴金箔的工匠",
      },
      {
        stepLabel: "工序 04",
        title: "推光",
        summary:
          "最后几层由粗至细逐级研磨，再以手工推光，直至光线在整个表面均匀流转。这份光泽来自推光本身，而非另加的罩光层。",
        imageAlt: "正在推光成品漆面的双手",
      },
      {
        stepLabel: "工序 05",
        title: "检验与包装",
        summary:
          "包装前逐件检验颜色、平整度与边口修饰。未达标准者退回工坊返修，不进入包装环节。",
        imageAlt: "包装前进行的漆器质量检验",
      },
    ],
  },
} satisfies Record<Locale, ContentCopy>);

/**
 * Reserves the space a photograph will occupy. `src` stays `null` until the
 * asset is delivered, so nothing can ship a stand-in image as though it were
 * the company's own work.
 */
function reserveImage(
  assetKey: string,
  alt: string,
  replacementHint: string,
  width = 1200,
  height = 900,
): PublicImageAsset {
  return {
    assetKey,
    src: null,
    alt,
    width,
    height,
    assetPending: true,
    replacementHint,
  };
}

/**
 * Social accounts are listed but left unlinked: no profile URL for this company
 * was confirmed, and guessing a handle would send visitors to someone else's
 * page. The footer hides an entry whose `href` is null.
 */
function makeSocialLinks(): readonly PublicSocialLink[] {
  return [
    {
      id: "social-facebook",
      platform: "facebook",
      label: "Facebook",
      href: null,
      isDemo: false,
    },
    {
      id: "social-instagram",
      platform: "instagram",
      label: "Instagram",
      href: null,
      isDemo: false,
    },
  ];
}

function makeSnapshot(locale: Locale): PublicContentSnapshot {
  const copy = SITE_CONTENT_COPY[locale];

  const company: PublicCompanyProfile = {
    id: "company-red-door-vietnam",
    marker: null,
    isDemo: false,
    displayName: "Red Door Vietnam",
    legalName: "Công ty TNHH Red Door",
    eyebrow: copy.company.eyebrow,
    tagline: copy.company.tagline,
    summary: copy.company.summary,
    contentNotice: copy.company.contentNotice,
    heroImage: reserveImage(
      "company-hero",
      copy.company.heroAlt,
      copy.assetReplacementHint,
      1600,
      1000,
    ),
  };

  const history: readonly PublicHistoryMilestone[] = copy.history.map(
    (item, index) => ({
      id: `milestone-${String(index + 1).padStart(2, "0")}`,
      marker: null,
      isDemo: false,
      sortOrder: index + 1,
      periodLabel: item.periodLabel,
      title: item.title,
      summary: item.summary,
      image: reserveImage(
        `milestone-${String(index + 1).padStart(2, "0")}`,
        item.imageAlt,
        copy.assetReplacementHint,
      ),
    }),
  );

  const process: readonly PublicProcessStage[] = copy.process.map(
    (item, index) => ({
      id: `process-${String(index + 1).padStart(2, "0")}`,
      marker: null,
      isDemo: false,
      sortOrder: index + 1,
      stepLabel: item.stepLabel,
      title: item.title,
      summary: item.summary,
      image: reserveImage(
        `process-${String(index + 1).padStart(2, "0")}`,
        item.imageAlt,
        copy.assetReplacementHint,
      ),
    }),
  );

  const settings: PublicSiteSettings = {
    id: "public-settings",
    marker: null,
    isDemo: false,
    siteName: "Red Door Vietnam",
    defaultLocale: "vi",
    contact: {
      email: "sales@reddoor.vn",
      phone: "+84 24 3872 7560",
      fax: "+84 24 3872 7563",
      address: "46B/12 Đặng Thai Mai, Tây Hồ, Hà Nội, Việt Nam",
      factoryAddress: "212 Nguyễn Sơn, Long Biên, Hà Nội, Việt Nam",
      warehouseAddress: "Quốc lộ 5, thị trấn Bần, Hưng Yên, Việt Nam",
      // The company's own Google Maps listing. Tracking parameters (`entry`,
      // `g_ep`) and the `hl=en-AU` language pin were stripped from the pasted
      // URL: the first two are session noise, and the third would force
      // Australian English on every visitor regardless of their locale.
      mapUrl:
        "https://www.google.com/maps/place/RED+DOOR+Co.,+Ltd/@20.9030297,105.8657105,17z/data=!3m1!1e3!4m6!3m5!1s0x3135b2053e9230c3:0x120da3e5de8ab0b3!8m2!3d20.9030297!4d105.8657105!16s%2Fg%2F11g88bhbs8",
      // Keyless embed form, which is the only variant Google allows in a frame.
      // The locale is appended per request so map labels match the page.
      mapEmbedUrl:
        "https://maps.google.com/maps?q=20.9030297,105.8657105&z=16&output=embed",
      notice: copy.contactNotice,
      isDemo: false,
    },
    socialLinks: makeSocialLinks(),
  };

  return deepFreeze({
    locale,
    marker: null,
    isDemo: false,
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

const contentRepositoryImplementation: PublicContentRepository = {
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
  contentRepositoryImplementation,
);
