import type { Locale } from "@/lib/i18n/config";

import type {
  PublicProduct,
  PublicProductImage,
  PublicProductListOptions,
  PublicProductRepository,
} from "./public-contract";

type ProductCopy = {
  readonly name: string;
  readonly categoryLabel: string;
  readonly summary: string;
  readonly storyParagraphs: readonly string[];
  readonly materialLabels: readonly string[];
  readonly finishLabel: string;
  readonly careNotes: readonly string[];
  readonly quoteCallToAction: string;
  readonly leadTime: string;
  readonly tags: readonly string[];
  /** One entry per `imageKeys` slot, in the same order. */
  readonly imageAlts: readonly string[];
};

type ProductLocaleCopy = {
  readonly assetReplacementHint: string;
  readonly products: readonly ProductCopy[];
};

type ProductBlueprint = {
  readonly id: string;
  readonly slug: string;
  readonly categorySlug: string;
  readonly imageKeys: readonly string[];
  readonly collectionIds: readonly string[];
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
 * Slugs are identical in every locale on purpose: the locale switcher rewrites
 * only the locale segment, so a translated slug would turn every language
 * change on a product page into a 404.
 */
const PRODUCT_BLUEPRINTS = deepFreeze([
  {
    id: "product-lacquer-serving-tray",
    slug: "lacquer-serving-tray",
    categorySlug: "trays",
    imageKeys: [
      "product-lacquer-serving-tray-01",
      "product-lacquer-serving-tray-02",
    ],
    collectionIds: ["collection-2026"],
    featured: true,
  },
  {
    id: "product-lacquer-bowl",
    slug: "lacquer-bowl",
    categorySlug: "tableware",
    imageKeys: ["product-lacquer-bowl-01", "product-lacquer-bowl-02"],
    collectionIds: ["collection-2026"],
    featured: true,
  },
  {
    id: "product-lacquer-vessel",
    slug: "lacquer-vessel",
    categorySlug: "vessels",
    imageKeys: ["product-lacquer-vessel-01", "product-lacquer-vessel-02"],
    collectionIds: ["collection-2026"],
    featured: true,
  },
  {
    id: "product-lacquer-keepsake-box",
    slug: "lacquer-keepsake-box",
    categorySlug: "boxes",
    imageKeys: [
      "product-lacquer-keepsake-box-01",
      "product-lacquer-keepsake-box-02",
    ],
    collectionIds: ["collection-2026"],
    featured: true,
  },
  {
    id: "product-lacquer-table-set",
    slug: "lacquer-coaster-and-placemat-set",
    categorySlug: "tableware",
    imageKeys: ["product-lacquer-table-set-01", "product-lacquer-table-set-02"],
    collectionIds: ["collection-2026"],
    featured: false,
  },
  {
    id: "product-lacquer-wall-panel",
    slug: "lacquer-wall-panel",
    categorySlug: "wall-art",
    imageKeys: [
      "product-lacquer-wall-panel-01",
      "product-lacquer-wall-panel-02",
    ],
    collectionIds: ["collection-2026"],
    featured: true,
  },
  {
    id: "product-lacquered-woven-basket",
    slug: "lacquered-woven-basket",
    categorySlug: "basketware",
    imageKeys: [
      "product-lacquered-woven-basket-01",
      "product-lacquered-woven-basket-02",
    ],
    collectionIds: ["collection-2026"],
    featured: false,
  },
  {
    id: "product-lacquer-accent-table",
    slug: "lacquer-accent-table",
    categorySlug: "furniture",
    imageKeys: [
      "product-lacquer-accent-table-01",
      "product-lacquer-accent-table-02",
    ],
    collectionIds: ["collection-2026"],
    featured: false,
  },
] satisfies readonly ProductBlueprint[]);

/**
 * Copy describes the craft and the object only. No dimension, weight, SKU,
 * price, sourcing origin or production figure is asserted anywhere below,
 * because none of those has been confirmed by the company.
 */
const PRODUCT_COPY = deepFreeze({
  vi: {
    assetReplacementHint:
      "Ảnh sản phẩm thật vẫn đang chờ. Lưu ảnh theo đúng tên tệp của khung và thay vào đây kèm publicId Cloudinary.",
    products: [
      {
        name: "Khay bày sơn mài",
        categoryLabel: "Khay",
        summary:
          "Khay nông, vành thấp chạy liền quanh mép, dựng lên từ nhiều lớp sơn mỏng và mài nước phẳng sau mỗi lớp.",
        storyParagraphs: [
          "Khay gần như là một mặt phẳng, mà phẳng lại là điều khó đòi hỏi nhất ở sơn mài. Cốt khay là một tấm gỗ nông với vành thấp chạy quanh mép; trước khi lên màu, mặt cốt phải được bó, hom rồi mài cho thật phẳng, bởi mọi gợn sóng còn sót lại trên cốt sẽ không mất đi mà chỉ hiện rõ hơn khi mặt sơn được đánh bóng.",
          "Màu ở đây được dựng lên chứ không phải quét lên. Từng lớp sơn phủ thật mỏng, ủ trong tủ ẩm chứ không hong nóng — sơn khô nhờ hút ẩm chứ không nhờ nhiệt — rồi mài nước đi phần lớn trước khi lớp kế tiếp chồng lên. Chính những lớp còn sót lại sau nhiều lần mài mới tạo nên chiều sâu riêng của sơn mài: ánh sáng đi vào màng sơn, tán bên trong rồi trở ra hơi khác đi, nên cùng một chiếc khay dưới nắng sớm và dưới ánh đèn không bao giờ giống nhau.",
          "Kết quả là một món đồ để bày biện chứ không phải tấm thớt: mặt mịn, chạm vào thấy ấm, phản chiếu dịu. Vì công đoạn cuối cùng là đánh bóng bằng tay nên trong cùng một lô không có hai chiếc khay giống hệt nhau; những khác biệt nhỏ về độ sâu của màu là dấu vết của nghề, không phải lỗi.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Bóng, đánh bóng thủ công",
        careNotes: [
          "Lau bằng khăn mềm khô; với vết cứng đầu, dùng khăn ẩm vừa phải rồi lau khô ngay.",
          "Không ngâm nước, không cho vào máy rửa bát; tránh xa miếng cọ, bột tẩy và dung môi tẩy rửa.",
          "Dùng để bày, không dùng để cắt thái; lót thêm một lớp dưới đồ ướt, đồ nhiều dầu mỡ hoặc đồ còn nóng.",
          "Để xa nắng trực tiếp, lò sưởi và luồng gió điều hòa; hơi nóng khô kéo dài mới là thứ làm cốt gỗ bên dưới xê dịch.",
        ],
        quoteCallToAction:
          "Cho chúng tôi biết đường kính, nước hoàn thiện và số lượng bạn cần, chúng tôi sẽ gửi lại báo giá.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Sơn mài thủ công", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Khay sơn mài tròn nhìn từ trên xuống, mặt sơn đánh bóng phản chiếu ánh sáng dịu",
          "Cận cảnh vành khay, thấy rõ chiều sâu của các lớp sơn mài đã đánh bóng",
        ],
      },
      {
        name: "Bát sơn mài",
        categoryLabel: "Đồ bàn ăn",
        summary:
          "Bát nông, miệng rộng, phủ sơn cả trong lẫn ngoài để mặt hoàn thiện đọc thành một khối liền.",
        storyParagraphs: [
          "Bát được tạo dáng trước, hoàn thiện sau. Thành bát mỏng vừa đủ để cầm nhẹ tay nhưng vẫn đủ dày để giữ vững đường cong suốt hàng chục lượt phủ sơn — mặt cong ăn sơn khác hẳn mặt phẳng, và lòng bát luôn là nơi một lớp sơn vội vàng sẽ đọng lại.",
          "Mỗi lớp phủ mỏng, ủ ẩm cho se rồi mài nước. Chính việc mài mới giữ cho đường cong đúng dáng, vì nó lấy đi những chỗ gồ mà nét bút để lại. Trong và ngoài được làm tới cùng một chuẩn, nên miệng bát hiện lên như một đường liền chứ không phải chỗ giáp ranh giữa hai nước sơn.",
          "Hoàn thiện theo cách đó, chiếc bát là đồ bày và đồ dùng: đựng trái cây, đựng bánh, đựng chìa khóa nơi cửa ra vào, hoặc để trống giữa bàn cũng đã đủ. Chạm vào thấy ấm chứ không lạnh, và thành bát đã đánh bóng bắt lấy mọi sắc màu đang có trong phòng.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Bóng, đánh bóng thủ công",
        careNotes: [
          "Lau khô bằng khăn mềm sau mỗi lần dùng; không để nước đọng trong lòng bát.",
          "Không ngâm nước, không cho vào máy rửa bát hay lò vi sóng.",
          "Dùng cho đồ khô hoặc đồ nguội; với món nhiều nước, nhiều dầu mỡ hãy lót thêm bên trong.",
          "Cất nơi thoáng, tránh nắng trực tiếp và nơi hanh khô kéo dài.",
        ],
        quoteCallToAction:
          "Gửi cho chúng tôi đường kính, chiều sâu lòng bát và nước hoàn thiện bạn cần, chúng tôi sẽ báo giá.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Sơn mài thủ công", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Bát sơn mài nông, miệng rộng, chụp ngang tầm mắt trên nền trơn",
          "Cận cảnh miệng bát, nơi nước sơn trong và ngoài gặp nhau thành một đường liền",
        ],
      },
      {
        name: "Bình sơn mài",
        categoryLabel: "Bình và lọ",
        summary:
          "Bình dáng đứng, phủ sơn kín mọi mặt nhìn thấy, làm ra để giữ một dáng hình chứ không phải để chứa nước.",
        storyParagraphs: [
          "Bình được nhìn từ xa trước khi được nhìn trong tầm tay, nên dáng phải chốt xong trước khi pha một mẻ sơn nào: vai bình rộng bao nhiêu, thành thu vào ở đâu, chân cần bao nhiêu để dáng đứng vững chứ không chông chênh.",
          "Sau đó sơn được phủ mỏng lên toàn bộ mặt đứng, ủ ẩm rồi mài nước giữa các lớp. Mặt đứng là phần khó chiều nhất của nghề — suốt thời gian sơn se lại, trọng lực luôn kéo ngược — nên lớp phải mỏng và lịch làm phải chậm.",
          "Khi đánh bóng, thành bình cư xử như một tấm gương mềm: nó giữ lấy hình khung cửa sổ mà không soi rõ khung cửa. Đây là bình trang trí; thứ gì cần chứa nước xin hãy chứa trong một ống lót riêng hoặc một chiếc ly đặt bên trong.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Bóng, đánh bóng thủ công",
        careNotes: [
          "Phủi bụi bằng khăn mềm khô, lau theo chiều dáng bình.",
          "Không ngâm nước và không rót nước trực tiếp vào lòng bình.",
          "Cắm hoa tươi bằng ống lót hoặc ly thủy tinh đặt bên trong; nước tràn cần lau ngay.",
          "Không đặt trên bệ cửa sổ có nắng chiếu hoặc sát nguồn nhiệt.",
        ],
        quoteCallToAction:
          "Cho chúng tôi biết chiều cao và dáng bình bạn hình dung, chúng tôi sẽ báo giá theo đúng dáng đó.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Sơn mài thủ công", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Bình sơn mài dáng cao đứng trên nền trơn, phần vai bình bắt sáng",
          "Cận cảnh vai bình, thấy rõ độ bóng đều của lớp sơn mài đã đánh bóng",
        ],
      },
      {
        name: "Hộp đựng kỷ vật và trang sức",
        categoryLabel: "Hộp",
        summary:
          "Hộp có nắp, cẩn vỏ trứng rồi mài phẳng cho vỏ trứng nằm ngang bằng với mặt sơn quanh nó.",
        storyParagraphs: [
          "Hộp được chấm ở chỗ ghép. Nắp phải đậy không cập kênh, thành hộp phải giữ vuông suốt hàng chục lượt phủ sơn, và lòng hộp phải được làm kỹ như mặt ngoài, bởi cứ mở ra là nhìn thấy.",
          "Hoa văn ở đây được cẩn chứ không phải in. Từng mảnh vỏ trứng được đặt vào lớp sơn còn ướt rồi ấn xuống cho rạn thành một mảng khảm li ti; sau đó sơn tiếp tục phủ chồng lên và được mài nước cho tới khi vỏ trứng và sơn quanh nó thành một mặt phẳng duy nhất. Đó là lý do sắc ngà của vỏ trứng đọc như một phần của mặt sơn, chứ không phải thứ nằm đè lên trên.",
          "Chiếc hộp hoàn thiện nhận dấu tay và nhận ánh sáng ngang nhau. Nó dành cho trang sức, kỷ vật nhỏ và những thứ để trên bàn làm việc — những gì đáng được cất vào một chỗ có chủ ý thay vì một chỗ tiện tay.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Cẩn vỏ trứng, mài phẳng mặt",
        careNotes: [
          "Chỉ lau bằng khăn mềm khô; giữ hộp luôn khô ráo.",
          "Không cất trong phòng tắm hay sát cửa sổ có nắng chiếu.",
          "Đóng mở bằng nắp, đừng cạy vào mép hộp.",
          "Lót vải hoặc dùng túi mềm cho trang sức kim loại có cạnh sắc để lòng hộp không bị xước.",
        ],
        quoteCallToAction:
          "Gửi cho chúng tôi kích thước lòng hộp và hướng hoa văn mong muốn, chúng tôi sẽ báo giá.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Cẩn vỏ trứng", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Hộp sơn mài có nắp cẩn vỏ trứng, chụp lúc đóng nắp trên nền trơn",
          "Cận cảnh phần cẩn vỏ trứng, các vết rạn nhỏ nằm phẳng cùng mặt sơn đã đánh bóng",
        ],
      },
      {
        name: "Bộ lót ly và lót bàn ăn sơn mài",
        categoryLabel: "Đồ bàn ăn",
        summary:
          "Những tấm phẳng đồng bộ kích thước, phủ sơn cả hai mặt để lật lên vẫn không lộ mặt trái.",
        storyParagraphs: [
          "Một bộ thì phải khớp với chính nó. Lót ly và lót bàn được cắt đồng bộ rồi phủ sơn cùng một mẻ, để màu của tấm thứ tám vẫn là màu của tấm thứ nhất — độ đồng đều giữa các tấm ở đây quan trọng hơn bất cứ món lẻ nào, bởi cả bộ nằm chung một mặt bàn dưới chung một nguồn sáng.",
          "Cả hai mặt đều được hoàn thiện. Mặt dưới nhận đủ số lớp như mặt trên, một phần để tấm lót giữ được độ phẳng khi sơn se lại và co kéo, một phần để có thể lật tấm lót ngay trong bữa mà không phơi ra một mặt thô.",
          "Trong sử dụng, đây là những tấm chịu tiếp xúc và chịu nhiệt nhiều nhất, nên nước sơn được làm cho đều tay chứ không nhằm khoe. Một tấm lót đã đánh bóng đặt dưới đĩa còn ấm vẫn cần một chút giữ gìn; đó là bản chất của sơn mài, và cũng là lý do các bộ thường được đặt kèm vài tấm dự phòng.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Bóng, đánh bóng thủ công",
        careNotes: [
          "Lau khô sau mỗi lần dùng; không ngâm nước và không xếp chồng khi còn ẩm.",
          "Xếp chồng có lót vải mềm giữa các tấm.",
          "Không đặt trực tiếp nồi, chảo vừa nhấc khỏi bếp lên mặt lót.",
          "Cất nơi tránh nắng và tránh hơi nóng từ lò sưởi hay bếp.",
        ],
        quoteCallToAction:
          "Cho chúng tôi biết số tấm trong bộ, hình dáng và nước hoàn thiện, chúng tôi sẽ báo giá cho cả lô.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Sơn mài thủ công", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Bộ lót bàn vuông và lót ly tròn bằng sơn mài xếp xòe trên nền trơn",
          "Cận cảnh cạnh một tấm lót ly, thấy nước sơn chạy vòng xuống cả mặt dưới",
        ],
      },
      {
        name: "Tranh sơn mài treo tường",
        categoryLabel: "Tranh và phù điêu",
        summary:
          "Tấm vóc làm việc như một mặt sơn duy nhất, với phần cẩn nằm trong lòng lớp sơn chứ không đắp lên trên.",
        storyParagraphs: [
          "Tranh là chỗ sơn mài đến gần hội họa nhất, và cũng là thứ khó làm nhất, vì mắt người xem không có chỗ nào để nghỉ ngoài chính mặt tranh. Tấm vóc được bó, hom và mài phẳng trước; từ đó trở đi mọi thứ đều là cộng thêm — lớp chồng lớp, lớp chồng lên phần cẩn.",
          "Vỏ trứng, màu và vàng bạc quỳ đều có thể nằm trong các lớp. Thứ gì được đặt vào lớp sơn còn ướt sẽ bị các lớp sau chôn đi, rồi được mài nước lấy lại — hình không được vẽ lên mặt tranh, hình được mài ra từ bên trong nó. Mài tới đâu là một phán đoán của tay nghề, làm riêng cho từng tấm, nên hai bức cùng một mẫu là hai bức có họ với nhau chứ không phải hai bản sao.",
          "Khi treo lên, bức tranh đổi theo căn phòng. Ánh sáng xiên tìm ra phần cẩn; ánh sáng đều lại nhường chỗ cho màu nền. Đây là thứ làm ra để sống cùng dưới ánh sáng thay đổi, chứ không phải để chụp một tấm ảnh rồi thôi.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Cẩn vỏ trứng, mài phẳng mặt",
        careNotes: [
          "Phủi bụi bằng khăn mềm khô; không dùng bình xịt, nước bóng đồ gỗ hay dung môi.",
          "Treo tránh nắng chiếu trực tiếp, tránh nguồn nhiệt và tường ẩm.",
          "Cầm vào cạnh tranh khi di chuyển, không tì tay lên mặt tranh.",
          "Nếu mặt tranh xỉn đi theo thời gian, hãy hỏi chúng tôi trước khi tự xử lý.",
        ],
        quoteCallToAction:
          "Gửi cho chúng tôi khổ tranh, chiều treo và hướng đề tài bạn muốn, chúng tôi sẽ báo giá.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Cẩn vỏ trứng", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Bức tranh sơn mài hình chữ nhật treo trên tường trơn, ánh sáng xiên làm nổi phần cẩn",
          "Cận cảnh mặt tranh, nơi vỏ trứng cẩn đã được mài lại vào nền sơn",
        ],
      },
      {
        name: "Giỏ đan phủ sơn mài",
        categoryLabel: "Hàng đan",
        summary:
          "Cốt mây đan được gia cố rồi phủ sơn, để nét đan vẫn hiện dưới một mặt sơn mờ đánh tay.",
        storyParagraphs: [
          "Món này bắt đầu từ một chỗ khác hẳn: từ một cốt đan chứ không phải cốt đặc. Nan được đan thành dáng trước, rồi mới gia cố; sơn đi theo nét đan thay vì lấp nó đi — món đồ giữ nguyên lối tư duy của nghề đan và có thêm một lớp da sơn mài.",
          "Vì nền có vân nổi nên lớp sơn phải mỏng hơn và mặt được đánh tay chứ không đánh bóng gương. Muốn bóng gương thì phải mài cho thật phẳng, mà mài phẳng nghĩa là mất đi đúng cái mà nét đan có mặt ở đó để làm. Mặt mờ giữ cho hoa văn còn đọc được và giữ nguyên những vệt bóng nằm trong lòng nan.",
          "Kết quả đứng giữa hai nghề và thuộc về cả hai: nhẹ hơn một chiếc bát tiện, ấm hơn mây để mộc, và bền hơn cả hai nếu đứng riêng. Hợp để bày, để cất đồ khô, và cho góc phòng cần chất liệu chứ không cần độ bóng.",
        ],
        materialLabels: ["Sơn mài trên cốt mây đan"],
        finishLabel: "Mờ, đánh tay",
        careNotes: [
          "Phủi bụi bằng chổi lông mềm hoặc khăn khô, đi theo chiều nan đan.",
          "Giữ khô hoàn toàn: không rửa, không ngâm nước.",
          "Chỉ đựng đồ khô.",
          "Tránh nắng trực tiếp và nơi ẩm thấp kéo dài.",
        ],
        quoteCallToAction:
          "Cho chúng tôi biết kích thước, kiểu đan và độ đậm màu bạn muốn, chúng tôi sẽ báo giá.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Cốt mây đan", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Giỏ mây đan phủ sơn mài chụp chếch để nét đan chạy suốt thân giỏ",
          "Cận cảnh nét đan dưới lớp sơn mờ, vân nổi được giữ lại chứ không bị lấp",
        ],
      },
      {
        name: "Bàn nhỏ sơn mài",
        categoryLabel: "Đồ gỗ nhỏ",
        summary:
          "Một chiếc bàn phụ hoặc bàn console nhỏ, mặt bàn làm như một mặt tranh sơn mài và khung phủ sơn cùng tông.",
        storyParagraphs: [
          "Đồ gỗ đặt sơn mài vào giữa nhịp sống thường ngày, nên các quyết định ở đây là quyết định kết cấu trước khi là quyết định trang trí: mặt bàn dựng thế nào để giữ phẳng, khung ăn vào mặt ra sao, và bao nhiêu phần của chiếc bàn phải được hoàn thiện tới cùng một chuẩn với mặt bàn. Trên thực tế là toàn bộ — một mặt bàn phủ sơn trên khung để mộc rồi sẽ già đi thành hai món đồ khác nhau.",
          "Mặt bàn nhận nhiều lớp nhất và nhiều lượt mài nhất, vì đó là mặt sẽ bị nhìn từ trên xuống. Từng lớp ủ ẩm cho se rồi mài nước; khung đi theo đúng lịch ấy để màu khớp trên cả chiếc bàn chứ không chỉ xấp xỉ.",
          "Hoàn thiện mặt mờ, chiếc bàn đọc như một khối màu đặc và trả lại hình ảnh căn phòng ít hơn hẳn một mặt bóng — thường thì đó chính là điều một chiếc bàn nhỏ ở góc phòng đông người cần. Đây là chỗ đặt đèn, đặt sách và đặt một chiếc ly có lót, không phải bàn thợ.",
        ],
        materialLabels: ["Sơn mài trên cốt gỗ"],
        finishLabel: "Mờ, đánh tay",
        careNotes: [
          "Phủi bụi bằng khăn mềm khô; nước đổ ra cần lau ngay.",
          "Luôn dùng lót ly và lót bàn.",
          "Không dùng dung môi hay nước bóng đồ gỗ.",
          "Tránh nắng trực tiếp và nguồn nhiệt; khi di chuyển hãy nhấc bàn lên, đừng kéo lê.",
        ],
        quoteCallToAction:
          "Gửi cho chúng tôi chiều cao, kích thước mặt bàn và nước hoàn thiện bạn cần, chúng tôi sẽ báo giá.",
        leadTime: "Xác nhận theo từng báo giá",
        tags: ["Sơn mài thủ công", "Báo giá theo yêu cầu"],
        imageAlts: [
          "Bàn phụ nhỏ phủ sơn mài chụp trên nền trơn, mặt bàn mờ bắt ánh sáng đều",
          "Cận cảnh chỗ mặt bàn gặp khung, nước sơn chạy liền qua cả hai phần",
        ],
      },
    ],
  },
  en: {
    assetReplacementHint:
      "The final photograph is still outstanding. Save the approved image under this asset key and attach its Cloudinary publicId here.",
    products: [
      {
        name: "Lacquered serving tray",
        categoryLabel: "Trays",
        summary:
          "A shallow tray with a low, continuous rim, built up from many thin coats of lacquer and wet-sanded flat between each one.",
        storyParagraphs: [
          "A tray is mostly flat, and flatness is the hardest thing to ask of lacquer. The form starts as a shallow wooden panel with a low rim around its edge; before any colour goes on, the surface is sealed and levelled, because every ripple left in the substrate does not disappear — it comes back, magnified, the moment the finish is polished.",
          "Colour here is built rather than painted. Coats go on thin, cure in a humid cabinet rather than in heat — lacquer sets by taking moisture out of the air, not by drying — and are wet-sanded back before the next one is laid down. The layers that survive that cycle are what give a lacquer surface its particular depth: light enters the film, scatters inside it and comes back slightly changed, which is why the same tray never looks the same at breakfast as it does under lamplight.",
          "The result is a serving piece rather than a working board: smooth, warm to the touch, quietly reflective. Because the last stage is polished by hand, no two trays in a batch are identical; small differences in the depth of colour across the field are a signature of the process, not a fault.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Hand-polished gloss",
        careNotes: [
          "Wipe with a soft dry cloth; for a stubborn mark, use a barely damp cloth and dry it immediately.",
          "Never soak it and never put it in a dishwasher; keep scouring pads, cream cleansers and solvent cleaners away from the surface.",
          "Serve on it rather than cut on it, and set a liner under anything wet, oily or still hot.",
          "Keep it out of direct sunlight and away from radiators and air-conditioning outlets; sustained dry heat is what moves the wood underneath.",
        ],
        quoteCallToAction:
          "Tell us the diameter, finish and quantity you have in mind and we will come back with a quotation.",
        leadTime: "Confirmed with each quotation",
        tags: ["Handmade lacquer", "Quote on request"],
        imageAlts: [
          "Round lacquered serving tray seen from above, its polished surface reflecting soft light",
          "Close view of the tray rim, showing the depth of the polished lacquer layers",
        ],
      },
      {
        name: "Lacquered bowl",
        categoryLabel: "Tableware",
        summary:
          "A wide, shallow bowl coated inside and out, so the finish reads as one continuous surface.",
        storyParagraphs: [
          "The bowl is shaped first and finished second. Its wall is thin enough to feel light in the hand but deep enough to hold the curve steady through dozens of coats — a curved field takes lacquer quite differently from a flat one, and the inside of a bowl is always where a hurried coat will pool.",
          "Each layer is laid thin, cured in humidity and then cut back with water. The sanding is what keeps the curve true, because it removes the high spots a brush leaves behind. Inside and outside are worked to the same standard, so the rim reads as a single line rather than as a seam between two finishes.",
          "Finished this way the bowl is both a serving and a display piece: fruit, bread, keys by the door, or a table centre with nothing in it at all. It is warm rather than cold to the touch, and the polished wall picks up whatever colour is already in the room.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Hand-polished gloss",
        careNotes: [
          "Dry it with a soft cloth after use; never leave water standing in it.",
          "Do not soak it, and keep it out of the dishwasher and the microwave.",
          "Use it for dry or cool food; line it for anything wet or oily.",
          "Store it somewhere airy, out of direct sun and away from prolonged dry heat.",
        ],
        quoteCallToAction:
          "Send us the diameter, depth and finish you need and we will quote against it.",
        leadTime: "Confirmed with each quotation",
        tags: ["Handmade lacquer", "Quote on request"],
        imageAlts: [
          "Wide, shallow lacquered bowl photographed at eye level against a plain ground",
          "Detail of the bowl rim, where the inside and outside finishes meet in one line",
        ],
      },
      {
        name: "Lacquered vessel",
        categoryLabel: "Vessels",
        summary:
          "A standing vessel finished on every visible face, made to hold a silhouette rather than water.",
        storyParagraphs: [
          "A vessel is read from across a room before it is read at arm's length, so the silhouette is settled before any lacquer is mixed: how wide the shoulder is, where the wall turns in, how much foot the form needs to look planted rather than perched.",
          "Lacquer then goes on in thin coats over the whole standing surface, cures in humidity and is cut back with water between layers. Vertical faces are the least forgiving part of the craft — gravity is working against the coat the entire time it sets — which is why the coats are kept thin and the schedule kept slow.",
          "Polished, the wall behaves like a soft mirror: it holds the shape of the window without showing the window. These are decorative vessels; anything that needs to hold water should hold it in a separate liner or a glass placed inside.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Hand-polished gloss",
        careNotes: [
          "Dust with a soft dry cloth, working with the line of the form.",
          "Do not soak it and do not pour water directly into it.",
          "Use an inner liner or a glass for cut flowers, and wipe any spill straight away.",
          "Keep it off sunny windowsills and away from heat sources.",
        ],
        quoteCallToAction:
          "Tell us the height and profile you are looking for and we will quote against it.",
        leadTime: "Confirmed with each quotation",
        tags: ["Handmade lacquer", "Quote on request"],
        imageAlts: [
          "Tall lacquered vessel standing against a plain ground, its shoulder catching the light",
          "Close view of the vessel's shoulder, showing the even sheen of the polished lacquer",
        ],
      },
      {
        name: "Keepsake and jewellery box",
        categoryLabel: "Boxes",
        summary:
          "A lidded box finished with eggshell inlay, polished until the shell sits flush with the lacquer around it.",
        storyParagraphs: [
          "Boxes are judged at the joint. The lid has to sit without rocking, the walls have to stay square through dozens of coats, and the inside has to be finished as carefully as the outside, because it is seen every time the box is opened.",
          "The pattern is inlaid rather than printed. Fragments of eggshell are set into a soft coat one piece at a time and pressed until they craze into their own fine mosaic; further coats are then laid over the top and cut back with water until the shell and the surrounding lacquer become one level plane. That is why the ivory of the shell reads as part of the surface rather than as something sitting on it.",
          "The finished box takes fingerprints and light in equal measure. It is meant for jewellery, small keepsakes and desk things — whatever benefits from being put somewhere deliberate rather than somewhere convenient.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Eggshell inlay, polished flush",
        careNotes: [
          "Clean with a soft dry cloth only, and keep the box dry.",
          "Do not store it in a bathroom or on a sunlit windowsill.",
          "Open and close it by the lid rather than levering the rim.",
          "Line it, or use a pouch, for sharp metal jewellery so the interior is not scratched.",
        ],
        quoteCallToAction:
          "Send us the internal dimensions and the direction you want the pattern to take and we will quote.",
        leadTime: "Confirmed with each quotation",
        tags: ["Eggshell inlay", "Quote on request"],
        imageAlts: [
          "Lidded lacquer box with eggshell inlay, photographed closed against a plain ground",
          "Close view of the eggshell inlay, its fine crackle sitting flush with the polished lacquer",
        ],
      },
      {
        name: "Coaster and placemat set",
        categoryLabel: "Tableware",
        summary:
          "Flat table pieces in matched sizes, finished on both faces so they can be turned over without showing a back.",
        storyParagraphs: [
          "A set has to agree with itself. Coasters and mats are cut to matched sizes and then coated together in the same runs, so that the colour of the eighth piece is the colour of the first — consistency across a batch matters more here than on any single object, because the whole set sits on one table under one light.",
          "Both faces are finished. The under-face gets the same coats as the top, partly so the piece stays flat as the lacquer cures and pulls, and partly so a mat can be turned over mid-service without exposing a raw side.",
          "In use these are the pieces that take the most contact and the most heat, so the finish is worked to be even rather than showy. A polished mat under a warm plate will still ask for a moment's care; that is the nature of lacquer, and it is why sets are usually specified with a spare or two.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Hand-polished gloss",
        careNotes: [
          "Wipe dry after use; never soak them and never stack them while damp.",
          "Stack with a soft interleaf between the pieces.",
          "Do not set a pan straight off the heat onto the surface.",
          "Store out of direct sun and away from radiators and cooking heat.",
        ],
        quoteCallToAction:
          "Tell us the set size, the shape and the finish and we will quote for the run.",
        leadTime: "Confirmed with each quotation",
        tags: ["Handmade lacquer", "Quote on request"],
        imageAlts: [
          "Set of square lacquer placemats and round coasters fanned out on a plain ground",
          "Close view of the edge of a coaster, showing the finish carried round onto the underside",
        ],
      },
      {
        name: "Lacquer wall panel",
        categoryLabel: "Wall art",
        summary:
          "A panel worked as a single lacquer field, with the inlay set inside the layers rather than laid on top of them.",
        storyParagraphs: [
          "A panel is the closest lacquer comes to painting, and the least forgiving thing to make, because there is nowhere for the eye to rest except the surface itself. The board is prepared and levelled first; from there the work is entirely additive — coat over coat, coat over inlay.",
          "Shell, pigment and metal leaf can all be carried in the layers. Whatever is set into a soft coat is buried by the coats that follow and then brought back with water and abrasive: the image is not painted onto the panel, it is uncovered from inside it. How far to take that is a judgement made by hand, panel by panel, which is why two panels from one design are related rather than identical.",
          "Hung, the panel changes with the room. Raking light finds the inlay; flat light lets the ground colour take over. It is made to be lived with under changing light rather than photographed once.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Eggshell inlay, polished flush",
        careNotes: [
          "Dust with a soft dry cloth; use no sprays, furniture polishes or solvents on it.",
          "Hang it out of direct sunlight and away from heat sources and damp walls.",
          "Handle it by the edges rather than resting a hand on the face.",
          "If the surface dulls with age, ask us before trying anything on it yourself.",
        ],
        quoteCallToAction:
          "Send us the panel size, the orientation and the direction you want the design to take and we will quote.",
        leadTime: "Confirmed with each quotation",
        tags: ["Eggshell inlay", "Quote on request"],
        imageAlts: [
          "Rectangular lacquer wall panel hung on a plain wall, raking light picking out the inlay",
          "Close view of the panel surface where inlaid shell has been sanded back into the lacquer field",
        ],
      },
      {
        name: "Lacquered woven basket",
        categoryLabel: "Basketware",
        summary:
          "A woven rattan form stabilised and coated in lacquer, so the weave stays visible under a matte, hand-rubbed surface.",
        storyParagraphs: [
          "This one starts somewhere else entirely: with a woven form rather than a solid one. The weave is worked to shape first and then stabilised, and the lacquer follows the texture instead of hiding it — the object keeps its basket logic and gains a lacquer skin.",
          "Because the ground is textured, the coats are thinner and the finish is rubbed rather than mirror-polished. A gloss polish would need the surface levelled flat, and levelling would mean losing exactly the thing the weave is there for. Matte keeps the pattern legible and the shadows inside the weave intact.",
          "The result sits between two crafts and belongs to both: lighter than a turned bowl, warmer than bare rattan, and more durable than either on its own. Good for display, for dry storage, and for the corner of a room that needs texture rather than shine.",
        ],
        materialLabels: ["Lacquer over a woven rattan core"],
        finishLabel: "Matte, hand-rubbed",
        careNotes: [
          "Dust with a soft brush or a dry cloth, following the line of the weave.",
          "Keep it dry: do not wash it and do not soak it.",
          "Use it for dry goods only.",
          "Keep it out of direct sun and out of persistently damp rooms.",
        ],
        quoteCallToAction:
          "Tell us the size, the weave and the depth of colour you want and we will quote.",
        leadTime: "Confirmed with each quotation",
        tags: ["Woven rattan core", "Quote on request"],
        imageAlts: [
          "Lacquered woven rattan basket photographed at an angle so the weave reads across the form",
          "Close view of the weave under matte lacquer, showing the texture held rather than filled",
        ],
      },
      {
        name: "Lacquered accent table",
        categoryLabel: "Small furniture",
        summary:
          "A small side or console piece whose top is finished as a lacquer field and whose frame is coated to match.",
        storyParagraphs: [
          "Furniture puts lacquer in the way of daily life, so the decisions here are structural before they are decorative: how the top is built so that it stays flat, how the frame meets it, and how much of the piece has to be finished to the same standard as the top. All of it, in practice — a coated top on a raw frame ages into two different objects.",
          "The top takes the most layers and the most sanding, because it is the surface that will be looked down onto. Coats cure slowly in humidity and are cut back with water; the frame follows the same schedule so that the colour matches across the whole piece rather than approximately.",
          "Finished matte, it reads as a solid block of colour and gives back less of the room than a polished top would — which is usually what a small table in a busy corner needs. It is a surface for a lamp, a book and a glass on a coaster, not a work bench.",
        ],
        materialLabels: ["Lacquer over a wooden core"],
        finishLabel: "Matte, hand-rubbed",
        careNotes: [
          "Dust with a soft dry cloth and wipe up spills straight away.",
          "Always use coasters and mats on the top.",
          "Use no solvents and no furniture polish on it.",
          "Keep it out of direct sun and away from heat sources; lift it rather than dragging it.",
        ],
        quoteCallToAction:
          "Send us the height, the footprint and the finish you need and we will quote.",
        leadTime: "Confirmed with each quotation",
        tags: ["Handmade lacquer", "Quote on request"],
        imageAlts: [
          "Small lacquered side table photographed against a plain ground, its matte top catching even light",
          "Close view of the join between the table top and the frame, showing the finish carried across both",
        ],
      },
    ],
  },
  fr: {
    assetReplacementHint:
      "La photographie définitive reste à fournir. Enregistrez l'image approuvée sous cette clé d'actif et renseignez ici son publicId Cloudinary.",
    products: [
      {
        name: "Plateau de service en laque",
        categoryLabel: "Plateaux",
        summary:
          "Un plateau peu profond à rebord bas et continu, construit par fines couches de laque successives, poncées à l'eau entre chaque passe.",
        storyParagraphs: [
          "Un plateau est presque entièrement plat, et la planéité est ce que la laque supporte le moins bien. La forme part d'un panneau de bois peu profond bordé d'un rebord bas ; avant toute couleur, le support est encollé et dressé, car la moindre ondulation laissée dans le support ne disparaît pas — elle ressort, amplifiée, dès que la surface est polie.",
          "La couleur se construit, elle ne s'applique pas. Les couches sont posées minces, durcissent en armoire humide et non à la chaleur — la laque prend en captant l'humidité de l'air, elle ne sèche pas — puis sont reprises au ponçage à l'eau avant la suivante. Ce sont les strates qui survivent à ces reprises qui donnent à la laque sa profondeur : la lumière entre dans le film, s'y diffuse et ressort légèrement modifiée. C'est pourquoi un même plateau n'offre jamais le même visage au matin et sous une lampe.",
          "On obtient une pièce de service, non un plan de travail : lisse, tiède au toucher, discrètement réfléchissante. Le polissage final étant manuel, deux plateaux d'un même lot ne sont jamais identiques ; les légères variations de profondeur de couleur signent le procédé, elles ne le trahissent pas.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Brillant poli à la main",
        careNotes: [
          "Essuyer avec un chiffon doux et sec ; pour une marque tenace, un chiffon à peine humide, puis séchage immédiat.",
          "Ne jamais faire tremper, ne jamais passer au lave-vaisselle ; tenir à l'écart des éponges abrasives, des crèmes à récurer et des nettoyants à solvant.",
          "Servir dessus plutôt que couper dessus, et interposer un support sous tout ce qui est humide, gras ou encore chaud.",
          "Éviter le soleil direct, les radiateurs et les bouches de climatisation : c'est la chaleur sèche prolongée qui fait travailler le bois en dessous.",
        ],
        quoteCallToAction:
          "Indiquez-nous le diamètre, la finition et la quantité envisagés : nous vous adresserons un devis.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Laque faite main", "Devis sur demande"],
        imageAlts: [
          "Plateau rond en laque vu de dessus, sa surface polie renvoyant une lumière douce",
          "Gros plan sur le rebord du plateau, révélant la profondeur des couches de laque polies",
        ],
      },
      {
        name: "Coupe en laque",
        categoryLabel: "Arts de la table",
        summary:
          "Une coupe large et peu profonde, laquée dedans comme dehors, dont la finition se lit d'un seul tenant.",
        storyParagraphs: [
          "La coupe est d'abord formée, ensuite finie. Sa paroi est assez fine pour rester légère en main et assez épaisse pour tenir la courbe pendant des dizaines de couches — une surface courbe reçoit la laque tout autrement qu'une surface plane, et l'intérieur d'une coupe est toujours l'endroit où une couche appliquée trop vite viendra s'accumuler.",
          "Chaque couche est posée mince, durcie en atmosphère humide, puis reprise à l'eau. C'est le ponçage qui maintient la courbe juste, puisqu'il enlève les reliefs que le pinceau laisse derrière lui. L'intérieur et l'extérieur sont menés au même niveau d'exigence : le bord se lit comme une ligne unique et non comme la couture entre deux finitions.",
          "Ainsi finie, la coupe sert autant qu'elle se montre : fruits, pain, clés près de la porte, ou centre de table entièrement vide. Elle est tiède plutôt que froide sous la main, et sa paroi polie capte la couleur déjà présente dans la pièce.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Brillant poli à la main",
        careNotes: [
          "Sécher au chiffon doux après usage ; ne jamais laisser d'eau stagner au fond.",
          "Ne pas faire tremper ; ni lave-vaisselle, ni micro-ondes.",
          "Réserver aux mets secs ou froids ; prévoir une doublure pour tout ce qui est humide ou gras.",
          "Ranger dans un endroit aéré, à l'abri du soleil direct et d'une chaleur sèche prolongée.",
        ],
        quoteCallToAction:
          "Communiquez-nous le diamètre, la profondeur et la finition souhaités : nous établirons un devis.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Laque faite main", "Devis sur demande"],
        imageAlts: [
          "Coupe en laque large et peu profonde photographiée à hauteur d'œil sur fond uni",
          "Détail du bord de la coupe, là où les finitions intérieure et extérieure se rejoignent en une seule ligne",
        ],
      },
      {
        name: "Vase en laque",
        categoryLabel: "Vases",
        summary:
          "Un vase debout, laqué sur toutes ses faces visibles, conçu pour tenir une silhouette plutôt que de l'eau.",
        storyParagraphs: [
          "Un vase se lit d'un bout à l'autre d'une pièce avant de se lire à bout de bras : la silhouette est donc arrêtée avant qu'une seule laque ne soit mélangée — largeur de l'épaulement, hauteur à laquelle la paroi rentre, pied nécessaire pour que la forme paraisse posée et non perchée.",
          "La laque est ensuite appliquée en couches minces sur toute la surface verticale, durcie en atmosphère humide et reprise à l'eau entre les passes. Les faces verticales sont la partie la moins indulgente du métier — la pesanteur travaille contre la couche pendant toute sa prise — d'où des couches maintenues fines et un calendrier volontairement lent.",
          "Une fois poli, le vase se comporte comme un miroir adouci : il retient la forme de la fenêtre sans en montrer le dessin. Ce sont des vases décoratifs ; ce qui doit contenir de l'eau la contiendra dans une doublure ou un verre placé à l'intérieur.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Brillant poli à la main",
        careNotes: [
          "Dépoussiérer au chiffon doux et sec, en suivant la ligne de la forme.",
          "Ne pas faire tremper et ne pas verser d'eau directement à l'intérieur.",
          "Utiliser une doublure ou un verre pour les fleurs coupées et essuyer aussitôt tout débordement.",
          "Éviter les rebords de fenêtre ensoleillés et la proximité d'une source de chaleur.",
        ],
        quoteCallToAction:
          "Dites-nous la hauteur et le profil recherchés : nous chiffrerons sur cette base.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Laque faite main", "Devis sur demande"],
        imageAlts: [
          "Vase en laque de belle hauteur posé sur fond uni, son épaulement accrochant la lumière",
          "Gros plan sur l'épaulement du vase, montrant l'égalité du brillant de la laque polie",
        ],
      },
      {
        name: "Coffret à bijoux et à souvenirs",
        categoryLabel: "Coffrets",
        summary:
          "Un coffret à couvercle incrusté de coquille d'œuf, poli jusqu'à ce que la coquille affleure la laque qui l'entoure.",
        storyParagraphs: [
          "Un coffret se juge à l'assemblage. Le couvercle doit poser sans jouer, les parois rester d'équerre pendant des dizaines de couches, et l'intérieur être fini avec autant de soin que l'extérieur, puisqu'on le voit chaque fois qu'on l'ouvre.",
          "Le motif est incrusté et non imprimé. Des fragments de coquille d'œuf sont posés un à un dans une couche encore fraîche puis pressés jusqu'à se fendiller en une mosaïque très fine ; d'autres couches viennent ensuite les recouvrir, avant d'être reprises à l'eau jusqu'à ce que la coquille et la laque environnante ne forment plus qu'un seul plan. C'est pourquoi l'ivoire de la coquille se lit comme une partie de la surface et non comme un élément posé dessus.",
          "Le coffret fini reçoit les empreintes et la lumière à parts égales. Il est destiné aux bijoux, aux petits souvenirs et aux objets de bureau — tout ce qui gagne à être rangé à un endroit choisi plutôt qu'à un endroit commode.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Incrustation de coquille d'œuf, polie à fleur",
        careNotes: [
          "Nettoyer uniquement au chiffon doux et sec, et garder le coffret au sec.",
          "Ne pas le ranger dans une salle de bains ni sur un rebord de fenêtre ensoleillé.",
          "Ouvrir et fermer par le couvercle, sans forcer sur le bord.",
          "Doubler l'intérieur ou utiliser une pochette pour les bijoux métalliques à arêtes vives.",
        ],
        quoteCallToAction:
          "Envoyez-nous les dimensions intérieures et l'orientation souhaitée du motif : nous établirons un devis.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Incrustation de coquille d'œuf", "Devis sur demande"],
        imageAlts: [
          "Coffret en laque à couvercle incrusté de coquille d'œuf, photographié fermé sur fond uni",
          "Gros plan de l'incrustation de coquille d'œuf, son fin craquelé affleurant la laque polie",
        ],
      },
      {
        name: "Service de sous-verres et de sets de table",
        categoryLabel: "Arts de la table",
        summary:
          "Des pièces plates aux formats accordés, laquées sur les deux faces pour pouvoir être retournées sans montrer d'envers.",
        storyParagraphs: [
          "Un service doit s'accorder avec lui-même. Sous-verres et sets sont découpés à des formats identiques puis laqués ensemble, dans les mêmes passes, afin que la couleur de la huitième pièce soit celle de la première — la régularité d'un lot compte ici davantage que sur n'importe quelle pièce isolée, puisque le service entier repose sur une même table sous une même lumière.",
          "Les deux faces sont finies. L'envers reçoit autant de couches que l'endroit, d'une part pour que la pièce reste plane pendant que la laque prend et tire, d'autre part pour qu'un set puisse être retourné en plein service sans laisser voir une face brute.",
          "À l'usage, ce sont les pièces les plus sollicitées par le contact et la chaleur : la finition est donc travaillée pour être régulière plutôt que spectaculaire. Un set poli sous une assiette tiède demandera toujours un instant d'attention ; c'est la nature de la laque, et la raison pour laquelle on prévoit généralement une ou deux pièces de réserve.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Brillant poli à la main",
        careNotes: [
          "Essuyer après usage ; ne jamais faire tremper ni empiler encore humide.",
          "Empiler en intercalant un feutre ou un tissu doux.",
          "Ne pas poser directement un plat sortant du feu.",
          "Ranger à l'abri du soleil et loin des radiateurs et de la chaleur de cuisson.",
        ],
        quoteCallToAction:
          "Précisez-nous la composition du service, les formes et la finition : nous chiffrerons la série.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Laque faite main", "Devis sur demande"],
        imageAlts: [
          "Ensemble de sets de table carrés et de sous-verres ronds en laque disposés en éventail sur fond uni",
          "Gros plan du bord d'un sous-verre, montrant la finition ramenée jusque sous la pièce",
        ],
      },
      {
        name: "Panneau mural en laque",
        categoryLabel: "Œuvres murales",
        summary:
          "Un panneau traité comme un champ de laque unique, dont l'incrustation vit à l'intérieur des couches plutôt qu'à leur surface.",
        storyParagraphs: [
          "Le panneau est ce que la laque produit de plus proche de la peinture, et ce qu'elle a de plus exigeant à réaliser, car l'œil n'a nulle part où se poser sinon la surface elle-même. Le support est d'abord préparé et dressé ; à partir de là, tout le travail est additif — couche sur couche, couche sur incrustation.",
          "Coquille, pigment et feuille de métal peuvent tous être portés par les couches. Ce qui est déposé dans une couche fraîche est enseveli par les suivantes, puis ramené au jour à l'eau et à l'abrasif : l'image n'est pas peinte sur le panneau, elle est dégagée depuis l'intérieur. Jusqu'où aller relève d'un jugement de la main, panneau par panneau ; c'est pourquoi deux panneaux tirés d'un même dessin sont apparentés plutôt qu'identiques.",
          "Accroché, le panneau change avec la pièce. Une lumière rasante trouve l'incrustation ; une lumière plate laisse la couleur de fond prendre le dessus. Il est fait pour être vécu sous une lumière changeante, non pour être photographié une seule fois.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Incrustation de coquille d'œuf, polie à fleur",
        careNotes: [
          "Dépoussiérer au chiffon doux et sec ; aucun aérosol, aucune cire, aucun solvant.",
          "Accrocher à l'abri du soleil direct, loin des sources de chaleur et des murs humides.",
          "Manipuler par les bords plutôt qu'en posant la main sur la face.",
          "Si la surface se ternit avec le temps, consultez-nous avant toute intervention.",
        ],
        quoteCallToAction:
          "Envoyez-nous le format, l'orientation et la direction souhaitée pour le motif : nous établirons un devis.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Incrustation de coquille d'œuf", "Devis sur demande"],
        imageAlts: [
          "Panneau mural rectangulaire en laque accroché sur un mur uni, une lumière rasante révélant l'incrustation",
          "Gros plan de la surface du panneau, là où la coquille incrustée a été ramenée au niveau du champ de laque",
        ],
      },
      {
        name: "Corbeille tressée laquée",
        categoryLabel: "Vannerie",
        summary:
          "Une forme tressée en rotin, stabilisée puis laquée, dont le tressage reste lisible sous une surface mate travaillée à la main.",
        storyParagraphs: [
          "Celle-ci commence ailleurs : par une forme tressée et non par une forme pleine. Le tressage est d'abord monté en volume puis stabilisé, et la laque suit la texture au lieu de l'effacer — l'objet garde sa logique de vannerie et gagne une peau de laque.",
          "Le fond étant texturé, les couches sont plus minces et la finition est frottée plutôt que polie au miroir. Un poli brillant exigerait de dresser la surface à plat, et la dresser reviendrait à perdre précisément ce que le tressage est venu apporter. Le mat garde le motif lisible et préserve les ombres logées dans le tressage.",
          "Le résultat se tient entre deux métiers et appartient aux deux : plus léger qu'une coupe tournée, plus chaleureux que le rotin nu, plus durable que l'un ou l'autre pris séparément. Parfait pour l'exposition, le rangement à sec, et le coin d'une pièce qui demande de la matière plutôt que de l'éclat.",
        ],
        materialLabels: ["Laque sur âme tressée en rotin"],
        finishLabel: "Mat, frotté à la main",
        careNotes: [
          "Dépoussiérer à la brosse douce ou au chiffon sec, en suivant le sens du tressage.",
          "Garder au sec : ne pas laver, ne pas faire tremper.",
          "Réserver au rangement d'articles secs.",
          "Éviter le soleil direct et les pièces durablement humides.",
        ],
        quoteCallToAction:
          "Précisez-nous la taille, le tressage et l'intensité de couleur souhaités : nous établirons un devis.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Âme en rotin tressé", "Devis sur demande"],
        imageAlts: [
          "Corbeille en rotin tressé laquée photographiée de trois quarts, le tressage courant sur toute la forme",
          "Gros plan du tressage sous la laque mate, montrant la texture conservée plutôt que comblée",
        ],
      },
      {
        name: "Petite table d'appoint laquée",
        categoryLabel: "Petit mobilier",
        summary:
          "Une petite table d'appoint ou console dont le plateau est traité comme un champ de laque et dont le piétement est laqué au même ton.",
        storyParagraphs: [
          "Le mobilier place la laque au milieu de la vie quotidienne : les décisions y sont donc structurelles avant d'être décoratives — comment construire le plateau pour qu'il reste plan, comment le piétement vient s'y raccorder, et quelle part de la pièce doit être finie au même niveau que le plateau. Toute la pièce, en pratique : un plateau laqué sur un bâti brut vieillit en deux objets distincts.",
          "Le plateau reçoit le plus de couches et le plus de ponçage, puisque c'est la surface que l'on regardera d'en haut. Les couches durcissent lentement en atmosphère humide et sont reprises à l'eau ; le piétement suit exactement le même calendrier, afin que la couleur s'accorde sur l'ensemble et non approximativement.",
          "Finie mate, la table se lit comme un bloc de couleur pleine et renvoie moins la pièce qu'un plateau poli — ce dont a précisément besoin une petite table dans un coin fréquenté. C'est une surface pour une lampe, un livre et un verre sur son sous-verre, non un établi.",
        ],
        materialLabels: ["Laque sur âme en bois"],
        finishLabel: "Mat, frotté à la main",
        careNotes: [
          "Dépoussiérer au chiffon doux et sec, et essuyer aussitôt toute projection.",
          "Toujours utiliser sous-verres et sets sur le plateau.",
          "N'employer ni solvant ni cire pour meubles.",
          "Éloigner du soleil direct et des sources de chaleur ; soulever la table plutôt que la traîner.",
        ],
        quoteCallToAction:
          "Envoyez-nous la hauteur, l'encombrement et la finition recherchés : nous établirons un devis.",
        leadTime: "Confirmé à chaque devis",
        tags: ["Laque faite main", "Devis sur demande"],
        imageAlts: [
          "Petite table d'appoint laquée photographiée sur fond uni, son plateau mat recevant une lumière égale",
          "Gros plan de la jonction entre le plateau et le piétement, la finition courant sur les deux",
        ],
      },
    ],
  },
  de: {
    assetReplacementHint:
      "Die endgültige Aufnahme steht noch aus. Speichern Sie das freigegebene Bild unter diesem Asset-Key und tragen Sie hier seine Cloudinary-publicId ein.",
    products: [
      {
        name: "Serviertablett in Lack",
        categoryLabel: "Tabletts",
        summary:
          "Ein flaches Tablett mit niedrigem, umlaufendem Rand, aufgebaut aus vielen dünnen Lackschichten, die zwischen den Aufträgen nass zurückgeschliffen werden.",
        storyParagraphs: [
          "Ein Tablett ist fast vollständig eben – und Ebenheit ist das, was man Lack am schwersten abverlangen kann. Die Form beginnt als flache Holzplatte mit niedrigem Rand; bevor Farbe ins Spiel kommt, wird der Untergrund grundiert und plangeschliffen, denn jede Welle, die im Untergrund bleibt, verschwindet nicht, sondern tritt nach dem Polieren umso deutlicher hervor.",
          "Farbe wird hier aufgebaut, nicht aufgetragen. Die Schichten kommen dünn auf, härten im Feuchtschrank statt in der Wärme – Lack härtet, indem er Feuchtigkeit aus der Luft aufnimmt, nicht durch Trocknen – und werden vor der nächsten Lage wieder nass zurückgeschliffen. Was diese Prozedur übersteht, gibt der Oberfläche ihre Tiefe: Licht dringt in den Film ein, streut darin und tritt leicht verändert wieder aus. Deshalb sieht dasselbe Tablett am Morgen anders aus als unter der Lampe.",
          "Das Ergebnis ist ein Serviertablett, kein Arbeitsbrett: glatt, warm in der Hand, zurückhaltend spiegelnd. Weil der letzte Arbeitsgang von Hand poliert wird, gleicht innerhalb einer Charge kein Tablett dem anderen; kleine Unterschiede in der Farbtiefe sind Handschrift des Verfahrens, nicht Mangel.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Handpoliert glänzend",
        careNotes: [
          "Mit einem weichen, trockenen Tuch abwischen; hartnäckige Spuren mit einem kaum feuchten Tuch abnehmen und sofort trockenreiben.",
          "Nicht einweichen, nicht in die Spülmaschine; Scheuerschwämme, Scheuermilch und lösemittelhaltige Reiniger fernhalten.",
          "Darauf servieren, nicht darauf schneiden – und unter Feuchtes, Fettiges oder Heißes stets eine Unterlage legen.",
          "Von direkter Sonne, Heizkörpern und Klimaauslässen fernhalten: Anhaltende trockene Wärme lässt den Holzkern arbeiten.",
        ],
        quoteCallToAction:
          "Nennen Sie uns Durchmesser, Oberfläche und Stückzahl – wir erstellen Ihnen ein Angebot.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Handgefertigter Lack", "Angebot auf Anfrage"],
        imageAlts: [
          "Rundes Lacktablett von oben, die polierte Oberfläche spiegelt weiches Licht",
          "Nahaufnahme des Tablettrands mit der Tiefe der polierten Lackschichten",
        ],
      },
      {
        name: "Lackschale",
        categoryLabel: "Tischkultur",
        summary:
          "Eine weite, flache Schale, innen wie außen lackiert, deren Oberfläche als eine einzige durchgehende Fläche gelesen wird.",
        storyParagraphs: [
          "Die Schale wird erst geformt und dann veredelt. Ihre Wandung ist dünn genug, um leicht in der Hand zu liegen, und stark genug, um die Rundung durch Dutzende von Schichten hindurch zu halten – eine gewölbte Fläche nimmt Lack ganz anders an als eine ebene, und das Innere einer Schale ist immer die Stelle, an der eine zu hastig aufgetragene Schicht zusammenläuft.",
          "Jede Lage wird dünn aufgetragen, in Feuchtigkeit ausgehärtet und anschließend nass zurückgeschliffen. Das Schleifen hält die Rundung wahr, weil es die Erhebungen abnimmt, die der Pinsel hinterlässt. Innen und außen werden auf dasselbe Niveau gebracht, sodass der Rand als eine einzige Linie erscheint und nicht als Naht zwischen zwei Oberflächen.",
          "So gefertigt ist die Schale ebenso Gebrauchs- wie Schaustück: Obst, Brot, Schlüssel an der Tür – oder als Tischmitte gänzlich leer. Sie fühlt sich warm an, nicht kühl, und die polierte Wandung nimmt auf, welche Farbe im Raum ohnehin vorhanden ist.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Handpoliert glänzend",
        careNotes: [
          "Nach Gebrauch mit einem weichen Tuch trockenreiben; niemals Wasser darin stehen lassen.",
          "Nicht einweichen, nicht in Spülmaschine oder Mikrowelle geben.",
          "Für trockene oder kalte Speisen verwenden; Feuchtes und Fettiges nur mit Einlage.",
          "Luftig lagern, vor direkter Sonne und anhaltender Trockenwärme geschützt.",
        ],
        quoteCallToAction:
          "Senden Sie uns Durchmesser, Tiefe und gewünschte Oberfläche – wir kalkulieren darauf.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Handgefertigter Lack", "Angebot auf Anfrage"],
        imageAlts: [
          "Weite, flache Lackschale auf Augenhöhe vor neutralem Hintergrund aufgenommen",
          "Detail des Schalenrands, an dem Innen- und Außenoberfläche zu einer Linie zusammenlaufen",
        ],
      },
      {
        name: "Lackgefäß",
        categoryLabel: "Gefäße",
        summary:
          "Ein stehendes Gefäß, auf allen sichtbaren Flächen lackiert, gemacht für eine Silhouette und nicht für Wasser.",
        storyParagraphs: [
          "Ein Gefäß wird durch den Raum hindurch gelesen, bevor es aus der Nähe gelesen wird. Deshalb steht die Silhouette fest, bevor überhaupt Lack angerührt wird: wie breit die Schulter ausfällt, wo die Wandung einzieht, wie viel Fuß die Form braucht, um gesetzt statt aufgesetzt zu wirken.",
          "Der Lack kommt dann in dünnen Schichten auf die gesamte stehende Fläche, härtet in Feuchtigkeit und wird zwischen den Lagen nass zurückgeschliffen. Senkrechte Flächen sind der unnachsichtigste Teil des Handwerks – die Schwerkraft arbeitet die ganze Abbindezeit über gegen die Schicht –, weshalb die Lagen dünn und der Ablauf langsam bleiben.",
          "Poliert verhält sich die Wandung wie ein weicher Spiegel: Sie hält die Form des Fensters fest, ohne das Fenster zu zeigen. Es sind dekorative Gefäße; was Wasser halten soll, hält es in einem separaten Einsatz oder einem eingestellten Glas.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Handpoliert glänzend",
        careNotes: [
          "Mit weichem, trockenem Tuch entstauben, der Linie der Form folgend.",
          "Nicht einweichen und kein Wasser direkt einfüllen.",
          "Für Schnittblumen einen Einsatz oder ein Glas verwenden und Übergelaufenes sofort abwischen.",
          "Nicht auf sonnige Fensterbänke und nicht neben Wärmequellen stellen.",
        ],
        quoteCallToAction:
          "Nennen Sie uns Höhe und Profil, die Ihnen vorschweben – wir kalkulieren darauf.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Handgefertigter Lack", "Angebot auf Anfrage"],
        imageAlts: [
          "Hohes Lackgefäß vor neutralem Hintergrund, dessen Schulter das Licht aufnimmt",
          "Nahaufnahme der Gefäßschulter mit dem gleichmäßigen Glanz des polierten Lacks",
        ],
      },
      {
        name: "Schmuck- und Erinnerungsschatulle",
        categoryLabel: "Schatullen",
        summary:
          "Eine Deckelschatulle mit Eierschalen-Einlage, so weit poliert, dass die Schale bündig mit dem umgebenden Lack liegt.",
        storyParagraphs: [
          "Eine Schatulle wird an der Fuge beurteilt. Der Deckel muss ohne Wackeln aufliegen, die Wandungen müssen über Dutzende von Schichten rechtwinklig bleiben, und das Innere muss so sorgfältig ausgeführt sein wie das Äußere – man sieht es bei jedem Öffnen.",
          "Das Muster ist eingelegt, nicht aufgedruckt. Eierschalenstücke werden einzeln in eine weiche Schicht gesetzt und angedrückt, bis sie zu einem feinen Mosaik aufreißen; darüber kommen weitere Schichten, die anschließend nass zurückgeschliffen werden, bis Schale und umgebender Lack eine einzige Ebene bilden. Deshalb liest sich das Elfenbeinweiß der Schale als Teil der Oberfläche und nicht als etwas, das darauf liegt.",
          "Die fertige Schatulle nimmt Fingerabdrücke und Licht zu gleichen Teilen an. Sie ist für Schmuck, kleine Erinnerungsstücke und Schreibtischdinge gedacht – für alles, dem ein bewusst gewählter Platz besser bekommt als ein bequemer.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Eierschalen-Einlage, bündig poliert",
        careNotes: [
          "Nur mit weichem, trockenem Tuch reinigen und die Schatulle trocken halten.",
          "Nicht im Badezimmer oder auf einer sonnigen Fensterbank aufbewahren.",
          "Am Deckel öffnen und schließen, nicht am Rand hebeln.",
          "Für kantigen Metallschmuck das Innere auslegen oder ein Säckchen verwenden.",
        ],
        quoteCallToAction:
          "Senden Sie uns die Innenmaße und die gewünschte Ausrichtung des Musters – wir erstellen ein Angebot.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Eierschalen-Einlage", "Angebot auf Anfrage"],
        imageAlts: [
          "Geschlossene Lackschatulle mit Eierschalen-Einlage vor neutralem Hintergrund",
          "Nahaufnahme der Eierschalen-Einlage, deren feines Craquelé bündig im polierten Lack liegt",
        ],
      },
      {
        name: "Set aus Untersetzern und Platzsets",
        categoryLabel: "Tischkultur",
        summary:
          "Flache Tischteile in aufeinander abgestimmten Formaten, beidseitig lackiert und deshalb wendbar, ohne eine Rückseite zu zeigen.",
        storyParagraphs: [
          "Ein Set muss mit sich selbst übereinstimmen. Untersetzer und Platzsets werden auf gleiche Formate zugeschnitten und anschließend in denselben Durchgängen lackiert, damit die Farbe des achten Stücks die Farbe des ersten ist – Gleichmäßigkeit über eine Charge zählt hier mehr als bei jedem Einzelstück, denn das ganze Set liegt auf einem Tisch unter einem Licht.",
          "Beide Seiten werden ausgeführt. Die Unterseite erhält dieselben Schichten wie die Oberseite, zum einen damit das Teil eben bleibt, während der Lack abbindet und zieht, zum anderen damit ein Set mitten im Service gewendet werden kann, ohne eine rohe Seite zu zeigen.",
          "Im Gebrauch sind das die Teile mit dem meisten Kontakt und der meisten Wärme, also ist die Oberfläche auf Gleichmäßigkeit hin gearbeitet und nicht auf Effekt. Ein poliertes Set unter einem warmen Teller verlangt weiterhin einen Moment Aufmerksamkeit; das liegt in der Natur des Lacks und ist der Grund, warum Sets meist mit ein bis zwei Reserveteilen bestellt werden.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Handpoliert glänzend",
        careNotes: [
          "Nach Gebrauch trockenreiben; nie einweichen und nie feucht stapeln.",
          "Beim Stapeln ein weiches Zwischenblatt einlegen.",
          "Keine Pfanne direkt vom Herd auf die Oberfläche stellen.",
          "Vor Sonne, Heizkörpern und Kochhitze geschützt lagern.",
        ],
        quoteCallToAction:
          "Nennen Sie uns Umfang des Sets, Form und Oberfläche – wir kalkulieren die Serie.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Handgefertigter Lack", "Angebot auf Anfrage"],
        imageAlts: [
          "Set aus quadratischen Lack-Platzsets und runden Untersetzern, fächerförmig auf neutralem Hintergrund ausgelegt",
          "Nahaufnahme der Kante eines Untersetzers, an der die Oberfläche bis auf die Unterseite geführt ist",
        ],
      },
      {
        name: "Wandpaneel in Lack",
        categoryLabel: "Wandarbeiten",
        summary:
          "Ein Paneel, das als eine einzige Lackfläche gearbeitet ist und dessen Einlage in den Schichten liegt statt auf ihnen.",
        storyParagraphs: [
          "Ein Paneel ist das, was Lack der Malerei am nächsten bringt, und zugleich das Unnachsichtigste, was sich daraus fertigen lässt – denn das Auge findet nirgends Halt außer auf der Fläche selbst. Der Träger wird zuerst vorbereitet und plangeschliffen; von da an ist die Arbeit rein additiv: Schicht über Schicht, Schicht über Einlage.",
          "Schale, Pigment und Metallblatt können sämtlich in den Schichten liegen. Was in eine weiche Lage gesetzt wird, verschwindet unter den folgenden und wird später mit Wasser und Schleifmittel wieder hervorgeholt: Das Bild wird nicht auf das Paneel gemalt, es wird aus ihm herausgeholt. Wie weit man dabei geht, entscheidet die Hand für jedes Paneel neu – deshalb sind zwei Paneele aus einem Entwurf verwandt, aber nicht identisch.",
          "Aufgehängt verändert sich das Paneel mit dem Raum. Streiflicht findet die Einlage; flaches Licht überlässt der Grundfarbe die Bühne. Es ist gemacht, um unter wechselndem Licht damit zu leben, nicht um einmal fotografiert zu werden.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Eierschalen-Einlage, bündig poliert",
        careNotes: [
          "Mit weichem, trockenem Tuch entstauben; keine Sprays, Möbelpolituren oder Lösemittel verwenden.",
          "Vor direkter Sonne, Wärmequellen und feuchten Wänden geschützt aufhängen.",
          "An den Kanten anfassen, nicht mit der Hand auf der Bildfläche.",
          "Wird die Oberfläche mit der Zeit stumpf, fragen Sie uns, bevor Sie selbst etwas versuchen.",
        ],
        quoteCallToAction:
          "Senden Sie uns Format, Ausrichtung und die gewünschte Richtung des Entwurfs – wir erstellen ein Angebot.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Eierschalen-Einlage", "Angebot auf Anfrage"],
        imageAlts: [
          "Rechteckiges Lack-Wandpaneel an neutraler Wand, Streiflicht hebt die Einlage hervor",
          "Nahaufnahme der Paneelfläche, wo eingelegte Schale in die Lackfläche zurückgeschliffen wurde",
        ],
      },
      {
        name: "Lackierter Flechtkorb",
        categoryLabel: "Flechtwaren",
        summary:
          "Eine geflochtene Rattanform, stabilisiert und lackiert, deren Geflecht unter einer matten, von Hand geriebenen Oberfläche sichtbar bleibt.",
        storyParagraphs: [
          "Dieses Stück beginnt an einer ganz anderen Stelle: mit einer geflochtenen statt einer massiven Form. Das Geflecht wird zuerst in Form gebracht und dann stabilisiert; der Lack folgt der Textur, statt sie zuzudecken – das Objekt behält seine Korblogik und bekommt eine Lackhaut.",
          "Weil der Grund strukturiert ist, fallen die Schichten dünner aus und die Oberfläche wird gerieben statt spiegelpoliert. Eine Hochglanzpolitur verlangte eine plan geschliffene Fläche, und Planschleifen hieße, genau das zu verlieren, wofür das Geflecht da ist. Matt hält das Muster lesbar und die Schatten im Geflecht intakt.",
          "Das Ergebnis steht zwischen zwei Gewerken und gehört zu beiden: leichter als eine gedrechselte Schale, wärmer als nacktes Rattan und haltbarer als beide für sich. Gut zum Zeigen, zum trockenen Verstauen und für die Ecke eines Raums, die Struktur braucht statt Glanz.",
        ],
        materialLabels: ["Lack auf geflochtenem Rattankern"],
        finishLabel: "Matt, von Hand gerieben",
        careNotes: [
          "Mit weicher Bürste oder trockenem Tuch entstauben, der Richtung des Geflechts folgend.",
          "Trocken halten: nicht waschen, nicht einweichen.",
          "Nur für trockene Güter verwenden.",
          "Vor direkter Sonne und dauerhaft feuchten Räumen schützen.",
        ],
        quoteCallToAction:
          "Nennen Sie uns Größe, Flechtart und gewünschte Farbtiefe – wir erstellen ein Angebot.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Geflochtener Rattankern", "Angebot auf Anfrage"],
        imageAlts: [
          "Lackierter Rattan-Flechtkorb schräg aufgenommen, sodass das Geflecht über die ganze Form läuft",
          "Nahaufnahme des Geflechts unter mattem Lack: die Struktur bleibt erhalten und wird nicht zugespachtelt",
        ],
      },
      {
        name: "Lackierter Beistelltisch",
        categoryLabel: "Kleinmöbel",
        summary:
          "Ein kleines Beistell- oder Konsolmöbel, dessen Platte als Lackfläche ausgeführt und dessen Gestell farblich darauf abgestimmt lackiert ist.",
        storyParagraphs: [
          "Möbel stellen Lack mitten in den Alltag, also sind die Entscheidungen hier konstruktiv, bevor sie dekorativ werden: wie die Platte aufgebaut ist, damit sie eben bleibt, wie das Gestell an sie anschließt und wie viel des Möbels auf demselben Niveau ausgeführt sein muss wie die Platte. In der Praxis: alles. Eine lackierte Platte auf rohem Gestell altert zu zwei verschiedenen Objekten.",
          "Die Platte bekommt die meisten Schichten und den meisten Schliff, denn sie ist die Fläche, auf die man herabsieht. Die Lagen härten langsam in Feuchtigkeit und werden nass zurückgeschliffen; das Gestell folgt demselben Ablauf, damit die Farbe über das ganze Möbel stimmt und nicht bloß ungefähr.",
          "Matt ausgeführt liest sich der Tisch als geschlossener Farbblock und gibt weniger vom Raum zurück als eine polierte Platte – meist genau das, was ein kleiner Tisch in einer belebten Ecke braucht. Er ist eine Fläche für eine Lampe, ein Buch und ein Glas auf dem Untersetzer, keine Werkbank.",
        ],
        materialLabels: ["Lack auf Holzkern"],
        finishLabel: "Matt, von Hand gerieben",
        careNotes: [
          "Mit weichem, trockenem Tuch entstauben und Verschüttetes sofort aufnehmen.",
          "Auf der Platte stets Untersetzer und Sets verwenden.",
          "Keine Lösemittel und keine Möbelpolitur einsetzen.",
          "Vor direkter Sonne und Wärmequellen schützen; das Möbel anheben statt schieben.",
        ],
        quoteCallToAction:
          "Senden Sie uns Höhe, Grundfläche und gewünschte Oberfläche – wir erstellen ein Angebot.",
        leadTime: "Wird mit jedem Angebot bestätigt",
        tags: ["Handgefertigter Lack", "Angebot auf Anfrage"],
        imageAlts: [
          "Kleiner lackierter Beistelltisch vor neutralem Hintergrund, die matte Platte nimmt gleichmäßiges Licht auf",
          "Nahaufnahme der Verbindung von Tischplatte und Gestell, die Oberfläche läuft über beide hinweg",
        ],
      },
    ],
  },
  ja: {
    assetReplacementHint:
      "最終的な写真はまだ届いていません。承認済みの画像をこのアセットキーの名前で保存し、Cloudinary の publicId をここに設定してください。",
    products: [
      {
        name: "漆塗りのサービングトレー",
        categoryLabel: "トレー",
        summary:
          "低い縁が一続きになった浅いトレーです。薄い漆を何層も重ね、一層ごとに水研ぎをして平らに整えています。",
        storyParagraphs: [
          "トレーはほぼ平面であり、平面こそ漆にもっとも求めにくい形です。低い縁をめぐらせた浅い木地から始まりますが、色を入れる前に下地を固め、面を出しておきます。木地に残ったわずかなうねりは塗り重ねても隠れることはなく、研ぎ出して磨いた段階でかえってはっきりと現れるからです。",
          "色は塗るというより、積み上げていきます。漆は薄く引き、熱ではなく湿度のある室（むろ）で硬化させます。漆は乾くのではなく、空気中の水分を取り込みながら固まるためです。硬化したら、次の層を重ねる前に水研ぎで大半を落とします。この繰り返しを経て残った層が、漆特有の深みをつくります。光が塗膜に入り、内部で散り、わずかに姿を変えて戻ってくる。だからこそ、朝の光の下と灯りの下とでは同じトレーには見えないのです。",
          "仕上がるのは、まな板ではなく供するための器です。手ざわりはなめらかで温かく、映り込みは控えめです。最後の磨きは手仕事ですから、同じ一群のなかに同じトレーは二つとありません。色の深さにわずかな差が出るのは欠点ではなく、この工程の証です。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "手磨きの艶あり仕上げ",
        careNotes: [
          "柔らかい乾いた布で拭いてください。落ちにくい汚れは固く絞った布で拭き、すぐに水気を取ってください。",
          "水に浸けたり食器洗い機に入れたりしないでください。研磨剤入りのスポンジ、クレンザー、溶剤系の洗剤は避けてください。",
          "切る用途には使わず、盛り付けにお使いください。水気や油気の多いもの、熱いものには受け皿を敷いてください。",
          "直射日光、暖房器具、エアコンの吹き出し口から離してください。木地を動かすのは、長く続く乾いた熱です。",
        ],
        quoteCallToAction:
          "ご希望の直径、仕上げ、数量をお知らせください。お見積もりをお送りいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["手仕事の漆", "見積もり承ります"],
        imageAlts: [
          "丸い漆塗りトレーを真上から見た様子。磨かれた表面が柔らかな光を映しています",
          "トレーの縁の接写。磨き上げた漆の層の深さが見て取れます",
        ],
      },
      {
        name: "漆塗りの鉢",
        categoryLabel: "テーブルウェア",
        summary:
          "口の広い浅鉢です。内も外も同じように塗り重ね、仕上がりがひと続きの面として読めるようにしています。",
        storyParagraphs: [
          "鉢はまず形をつくり、仕上げはそのあとです。手に持って軽く感じられるだけの薄さと、何十回もの塗り重ねに耐えて曲面を保つだけの厚みを両立させます。曲面は平面とはまるで違う受け止め方をしますし、急いで引いた漆がたまるのは、いつも鉢の内側です。",
          "一層ずつ薄く引き、湿度のなかで硬化させ、水で研ぎ落とす。曲面を正しく保つのはこの研ぎです。刷毛が残した高い部分を取り去ってくれるからです。内と外を同じ基準で仕上げるため、口縁は二つの仕上げの継ぎ目ではなく、一本の線として現れます。",
          "こうして仕上げた鉢は、使う器であり見せる器でもあります。果物、パン、玄関先の鍵。何も入れずにテーブルの中央へ置くだけでも成立します。触れると冷たくなく温かく、磨かれた側面は、その部屋にある色をそのまま拾います。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "手磨きの艶あり仕上げ",
        careNotes: [
          "使用後は柔らかい布で水気を拭き取り、水を溜めたままにしないでください。",
          "水に浸けないでください。食器洗い機・電子レンジのご使用はお控えください。",
          "乾いたもの、冷たいものにお使いください。水気や油気の多いものには内敷きをお使いください。",
          "風通しのよい場所で保管し、直射日光と長く続く乾燥した熱を避けてください。",
        ],
        quoteCallToAction:
          "ご希望の口径、深さ、仕上げをお知らせください。それに沿ってお見積もりいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["手仕事の漆", "見積もり承ります"],
        imageAlts: [
          "口の広い浅い漆塗りの鉢を、無地の背景で目線の高さから撮影した様子",
          "鉢の口縁の接写。内側と外側の仕上げが一本の線で出会っています",
        ],
      },
      {
        name: "漆塗りの花器",
        categoryLabel: "花器",
        summary:
          "立ち姿の器です。見えるすべての面を塗り上げており、水を入れるためではなく、姿を保つためにつくられています。",
        storyParagraphs: [
          "器は、手元で見られるよりも先に、部屋の向こうから見られます。ですから漆を練る前に姿を決めます。肩の張り、胴が内へ入る位置、そして据わって見えるために必要な高台の量です。",
          "その上で、立ち上がる面すべてに薄く漆を引き、湿度のなかで硬化させ、層と層のあいだで水研ぎをします。垂直な面はこの仕事のなかでもっとも手厳しい部分です。漆が固まるあいだ、重力はずっと逆向きに働いているからです。だからこそ層は薄く、日程はゆっくりと組みます。",
          "磨き上がった胴は、やわらかな鏡のようにふるまいます。窓の形は留めても、窓そのものは映しません。これは飾るための器です。水を入れる必要があるものは、内側に落とし込む筒やグラスにお入れください。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "手磨きの艶あり仕上げ",
        careNotes: [
          "柔らかい乾いた布で、形の流れに沿って埃を払ってください。",
          "水に浸けたり、直接水を注いだりしないでください。",
          "切り花には落とし筒かグラスをお使いになり、こぼれた水はすぐに拭き取ってください。",
          "日の当たる窓辺や暖房器具のそばには置かないでください。",
        ],
        quoteCallToAction:
          "ご希望の高さと姿かたちをお知らせください。それに沿ってお見積もりいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["手仕事の漆", "見積もり承ります"],
        imageAlts: [
          "無地の背景に立つ背の高い漆塗りの花器。肩の部分が光を受けています",
          "花器の肩の接写。磨き上げた漆の艶が均一に出ています",
        ],
      },
      {
        name: "小物入れ・ジュエリーボックス",
        categoryLabel: "箱",
        summary:
          "蓋物の箱です。卵殻を伏せ込み、殻が周囲の漆と同じ高さになるまで研ぎ出しています。",
        storyParagraphs: [
          "箱は合わせ目で評価されます。蓋はがたつかずに納まらなければならず、側板は何十回もの塗り重ねのあいだ直角を保たなければならず、内側は外側と同じだけ丁寧に仕上げなければなりません。開けるたびに目に入る場所だからです。",
          "文様は印刷ではなく、伏せ込みです。卵の殻を一片ずつ、まだ柔らかい漆の層に置いて押し、細かな貝割れの模様になるまで割ります。その上からさらに漆を重ね、殻と周囲の漆がひとつの平らな面になるまで水研ぎをします。だからこそ、殻の乳白色は表面に載っているものではなく、表面の一部として見えるのです。",
          "仕上がった箱は、指紋も光も等しく受け止めます。装身具、小さな記念の品、机まわりのもの――「置きやすい場所」ではなく「置くと決めた場所」に納めたいものに向いています。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "卵殻伏せ、面一に研ぎ出し",
        careNotes: [
          "柔らかい乾いた布のみでお手入れし、箱は乾いた状態を保ってください。",
          "浴室や日の当たる窓辺での保管はお避けください。",
          "蓋を持って開閉してください。縁をこじ開けないでください。",
          "角のある金属製の装身具には、内敷きや小袋をお使いください。",
        ],
        quoteCallToAction:
          "内寸と文様の方向性をお知らせください。お見積もりをお送りいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["卵殻伏せ", "見積もり承ります"],
        imageAlts: [
          "卵殻を伏せた蓋つきの漆箱を、閉じた状態で無地の背景に置いた様子",
          "卵殻伏せの接写。細かなひび割れが磨いた漆と同じ高さに納まっています",
        ],
      },
      {
        name: "コースターとランチョンマットの組",
        categoryLabel: "テーブルウェア",
        summary:
          "寸法をそろえた平物の組です。両面を仕上げてあるため、裏返しても裏面が現れません。",
        storyParagraphs: [
          "組物は、それ自体で調子が合っていなければなりません。コースターとマットは寸法をそろえて切り出し、同じ工程でまとめて塗ります。八枚目の色が一枚目の色であるためです。一枚ものよりも組物のほうが、色の揃いはずっと重く効いてきます。組全体がひとつの卓の上、ひとつの灯りの下に並ぶからです。",
          "両面とも仕上げます。裏面にも表と同じだけ漆を重ねるのは、ひとつには漆が硬化して引くあいだも平らを保つため、もうひとつには供している最中にマットを裏返しても、塗っていない面が出ないようにするためです。",
          "使ううえでは、接触も熱ももっとも多く受ける品です。ですから仕上げは見栄えよりも均一さを優先しています。磨いたマットも、温かい皿の下では少しだけ気を配っていただく必要があります。それが漆の性質であり、組にひと組かふた組の予備を添えてご注文いただくことが多い理由でもあります。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "手磨きの艶あり仕上げ",
        careNotes: [
          "使用後は拭いて乾かしてください。水に浸けたり、湿ったまま重ねたりしないでください。",
          "重ねる際は、あいだに柔らかい布や紙をはさんでください。",
          "火からおろしたばかりの鍋を直接置かないでください。",
          "直射日光、暖房器具、調理の熱から離して保管してください。",
        ],
        quoteCallToAction:
          "組の枚数、形、仕上げをお知らせください。ロットでお見積もりいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["手仕事の漆", "見積もり承ります"],
        imageAlts: [
          "角形のランチョンマットと丸いコースターの漆器一式を、無地の背景に扇状に並べた様子",
          "コースターの縁の接写。仕上げが裏面まで回り込んでいるのが見て取れます",
        ],
      },
      {
        name: "漆のウォールパネル",
        categoryLabel: "壁面作品",
        summary:
          "一枚の漆面として仕上げたパネルです。加飾は表面に載せるのではなく、塗り重ねた層のなかに納めています。",
        storyParagraphs: [
          "パネルは、漆が絵画にもっとも近づく仕事であり、同時にもっとも手厳しい仕事でもあります。見る人の目が休められる場所が、面そのものしかないからです。まず板を下地固めして面を出し、そこから先はひたすら足していく作業になります。層の上に層、加飾の上に層。",
          "貝、顔料、金銀の箔――いずれも層のなかに納めることができます。柔らかい層に置いたものは、あとから重ねる層に埋もれ、そして水と研ぎによって再び現れます。絵はパネルの上に描かれるのではなく、内側から研ぎ出されるのです。どこまで出すかは一枚ごとの手の判断ですから、同じ図案から生まれた二枚は、同一ではなく血縁のような関係になります。",
          "掛けてみると、パネルは部屋とともに変わります。斜めから差す光は加飾を見つけ出し、均一な光のもとでは地の色が前に出ます。一度写真に撮るためではなく、移ろう光のなかで暮らしをともにするためのものです。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "卵殻伏せ、面一に研ぎ出し",
        careNotes: [
          "柔らかい乾いた布で埃を払ってください。スプレー類、家具用ワックス、溶剤はお使いにならないでください。",
          "直射日光、熱源、湿った壁面を避けて掛けてください。",
          "画面に手を置かず、縁を持って扱ってください。",
          "経年で艶が落ちてきた場合は、ご自身で処置なさる前にご相談ください。",
        ],
        quoteCallToAction:
          "パネルの寸法、縦横の向き、図案の方向性をお知らせください。お見積もりをお送りいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["卵殻伏せ", "見積もり承ります"],
        imageAlts: [
          "無地の壁に掛けた長方形の漆パネル。斜めからの光が加飾を浮かび上がらせています",
          "パネル面の接写。伏せ込んだ貝が漆の地と同じ高さまで研ぎ出されています",
        ],
      },
      {
        name: "漆塗りの編みバスケット",
        categoryLabel: "編み製品",
        summary:
          "籐で編んだ形を固め、漆を塗った品です。艶を抑えた手擦り仕上げの下に、編み目がそのまま見えています。",
        storyParagraphs: [
          "これだけは出発点がまったく違います。無垢の木地ではなく、編んだ形から始まります。まず籐を編んで立体にし、そのうえで固めます。漆は編み目の凹凸を埋めるのではなく、それをたどっていきます。籠としての成り立ちを残したまま、漆の皮膚をまとうわけです。",
          "地に凹凸があるため、漆は薄めに引き、仕上げは鏡面ではなく手擦りにします。鏡面に磨くには面を平らにしなければならず、平らにするということは、編み目がそこにある意味をそのまま失うことだからです。艶を抑えた仕上げなら、文様は読みやすいまま、編み目のなかの陰影も残ります。",
          "できあがるものは二つの手仕事のあいだに立ち、その両方に属します。挽物の鉢より軽く、素の籐より温かく、どちらか一方だけよりも丈夫です。飾るのにも、乾いたものをしまうのにも、艶よりも質感を必要とする部屋の一角にも向いています。",
        ],
        materialLabels: ["籐の編み地に漆塗り"],
        finishLabel: "艶消し・手擦り仕上げ",
        careNotes: [
          "柔らかい刷毛か乾いた布で、編み目に沿って埃を払ってください。",
          "乾いた状態を保ってください。水洗い、浸け置きはなさらないでください。",
          "乾いたものの収納にお使いください。",
          "直射日光と、湿気の多い場所を避けてください。",
        ],
        quoteCallToAction:
          "ご希望の寸法、編み方、色の濃さをお知らせください。お見積もりをお送りいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["籐の編み地", "見積もり承ります"],
        imageAlts: [
          "漆を塗った籐の編みバスケットを斜めから撮影し、編み目が全体を走る様子",
          "艶消しの漆の下の編み目の接写。凹凸が埋められずに残っています",
        ],
      },
      {
        name: "漆塗りのサイドテーブル",
        categoryLabel: "小家具",
        summary:
          "小ぶりのサイドテーブルやコンソールです。天板は一枚の漆面として仕上げ、脚部も同じ色調で塗り上げています。",
        storyParagraphs: [
          "家具は、漆を日々の暮らしのただなかに置きます。ですからここでの判断は、装飾である前にまず構造です。天板をどう組めば反らずに済むか、脚部をどう取り付けるか、そして天板と同じ基準で仕上げるべき範囲はどこまでか。実際には全体です。天板だけを塗り、脚を素地のまま残せば、やがて二つの別々の家具に育っていきます。",
          "天板がもっとも層を重ね、もっとも研ぎを受けます。見下ろされる面だからです。層は湿度のなかでゆっくり硬化させ、水で研ぎ落とす。脚部も同じ日程をたどるため、色は「だいたい合っている」ではなく、全体で揃います。",
          "艶を抑えて仕上げると、テーブルは色のかたまりとして読め、磨いた天板ほどには部屋を映し返しません。人の行き来が多い一角に置く小さなテーブルには、たいていそれが求められます。ここは、灯りと本と、コースターに載せたグラスのための面であって、作業台ではありません。",
        ],
        materialLabels: ["木地に漆塗り"],
        finishLabel: "艶消し・手擦り仕上げ",
        careNotes: [
          "柔らかい乾いた布で埃を払い、こぼれたものはすぐに拭き取ってください。",
          "天板の上では必ずコースターやマットをお使いください。",
          "溶剤や家具用ワックスはお使いにならないでください。",
          "直射日光と熱源を避けてください。移動の際は引きずらず、持ち上げてください。",
        ],
        quoteCallToAction:
          "ご希望の高さ、設置寸法、仕上げをお知らせください。お見積もりをお送りいたします。",
        leadTime: "お見積もりごとにご確認いたします",
        tags: ["手仕事の漆", "見積もり承ります"],
        imageAlts: [
          "無地の背景に置いた小ぶりの漆塗りサイドテーブル。艶を抑えた天板が均一な光を受けています",
          "天板と脚部の接合部の接写。仕上げが両方にわたって続いています",
        ],
      },
    ],
  },
  "zh-CN": {
    assetReplacementHint:
      "最终照片尚未提供。请以此资产键名保存经批准的图片，并在此填入其 Cloudinary publicId。",
    products: [
      {
        name: "大漆托盘",
        categoryLabel: "托盘",
        summary: "浅口托盘，边缘低平连贯，由多层薄漆逐层髹涂、层层水磨而成。",
        storyParagraphs: [
          "托盘几乎是一整片平面，而平面恰恰是最难向漆要求的形状。它从一块带低边的浅木胎开始；上色之前，胎体须先封固、找平，因为留在胎体上的任何起伏都不会被盖住，反而会在打磨抛光之后被放大出来。",
          "颜色是一层层累起来的，不是刷上去的。每道漆都髹得很薄，在潮湿的荫房中固化而非烘干——漆是靠吸收空气中的水分固化的，并非“晾干”——随后用水磨掉大半，再上下一层。经过反复研磨仍留下来的那些层，才形成漆特有的深度：光进入漆膜，在其中散开，再略带改变地返回。同一只托盘，晨光下与灯下看起来从来都不一样。",
          "做成的是一件用来盛放的器物，而不是砧板：面光滑，触手温润，映光含蓄。最后一道抛光出自手工，所以同一批里没有两只完全相同的托盘；色泽深浅的细微差别是工艺的印记，不是瑕疵。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "手工抛光亮面",
        careNotes: [
          "用柔软干布擦拭；顽固痕迹可用微湿的布轻擦，随即擦干。",
          "请勿浸泡，请勿放入洗碗机；远离百洁布、去污粉和含溶剂的清洁剂。",
          "用于盛放而非切割；盛放带水、带油或较烫的食物时请加衬垫。",
          "远离阳光直射、暖气与空调出风口；真正会让木胎变形的，是长时间的干热。",
        ],
        quoteCallToAction: "请告知所需的直径、饰面与数量，我们会回复报价。",
        leadTime: "随每次报价确认",
        tags: ["手工大漆", "按需报价"],
        imageAlts: [
          "俯视一只圆形大漆托盘，抛光表面映出柔和光线",
          "托盘边缘的特写，可见抛光漆层的厚度与深度",
        ],
      },
      {
        name: "大漆钵",
        categoryLabel: "餐桌器物",
        summary: "口宽而浅的钵，内外同髹，使整个饰面读起来是一整片连续的表面。",
        storyParagraphs: [
          "钵先成形，后成面。器壁薄到上手轻盈，又厚到能在数十道髹涂中稳住那道弧线——弧面吃漆与平面完全不同，而钵的内壁，永远是仓促一道漆会积住的地方。",
          "每层髹得薄，入荫房固化，再以水研磨。真正让弧线保持准确的正是研磨，因为它削去了漆刷留下的高点。内外按同一标准做到底，口沿因此呈现为一条完整的线，而不是两种饰面之间的接缝。",
          "这样完成的钵，既是用器也是陈设：水果、面包、门口的钥匙，或者什么都不放，只作案头的中心。触手温润而非冰凉，抛光的器壁会把房间里原有的颜色收进来。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "手工抛光亮面",
        careNotes: [
          "用后以柔软干布擦干；切勿让水长时间留在钵内。",
          "请勿浸泡，请勿放入洗碗机或微波炉。",
          "适合盛放干爽或凉的食物；带水、带油之物请加内衬。",
          "存放于通风处，避开阳光直射与长期干热。",
        ],
        quoteCallToAction:
          "请把所需的口径、深度与饰面发给我们，我们会据此报价。",
        leadTime: "随每次报价确认",
        tags: ["手工大漆", "按需报价"],
        imageAlts: [
          "口宽而浅的大漆钵，在素色背景前以平视角度拍摄",
          "钵口沿的细部，内外饰面在此汇成一条线",
        ],
      },
      {
        name: "大漆花器",
        categoryLabel: "瓶器",
        summary:
          "立式器皿，可见的每一面都髹漆，为承载一个轮廓而作，而非为盛水而作。",
        storyParagraphs: [
          "器皿是先被隔着房间读到，然后才被拿到手边细看的。所以在调漆之前，轮廓就要定下来：肩部多宽，器壁在哪里收进去，圈足要有多少，才让形体看起来是稳稳落在那里，而不是勉强立着。",
          "随后，漆薄薄地髹满整个立面，在湿气中固化，层与层之间以水研磨。立面是这门手艺里最不宽容的部分——漆凝固的整个过程中，重力都在与它作对——所以漆要薄，工期要慢。",
          "抛光之后，器壁像一面柔和的镜子：它留住窗的形状，却不显出窗本身。这是陈设用器；需要盛水的，请用内胆或放入其中的玻璃杯来盛。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "手工抛光亮面",
        careNotes: [
          "用柔软干布顺着器形除尘。",
          "请勿浸泡，也不要直接往器内注水。",
          "插鲜花请使用内胆或玻璃杯，溢出的水须立即擦净。",
          "请勿放在日晒的窗台上或热源近旁。",
        ],
        quoteCallToAction: "请告知您想要的高度与器形，我们会据此报价。",
        leadTime: "随每次报价确认",
        tags: ["手工大漆", "按需报价"],
        imageAlts: [
          "素色背景前的高身大漆花器，肩部承着光",
          "花器肩部的特写，可见抛光漆面均匀的光泽",
        ],
      },
      {
        name: "珍藏盒与首饰盒",
        categoryLabel: "盒具",
        summary: "带盖的盒子，以蛋壳镶嵌装饰，打磨至蛋壳与四周漆面齐平。",
        storyParagraphs: [
          "盒子看的是接缝。盖要合得稳不晃动，壁板要在数十道髹涂中保持方正，内里要与外面一样讲究——因为每开一次盒子就会看见一次。",
          "纹样是嵌进去的，不是印上去的。蛋壳一片片按入尚软的漆层，压至自然碎裂成细密的镶嵌；随后再髹上数道漆，以水磨到蛋壳与四周的漆成为同一个平面。这正是壳的象牙白读起来像是表面的一部分，而不是浮在表面上的原因。",
          "做成的盒子，接住指纹与光的分量是一样的。它为首饰、细小的纪念物与案头之物而设——为那些值得放在特意选定之处、而非顺手之处的东西。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "蛋壳镶嵌，磨至齐平",
        careNotes: [
          "仅以柔软干布清洁，并保持盒体干燥。",
          "请勿存放于浴室或日晒的窗台。",
          "请以盒盖开合，不要撬动盒沿。",
          "存放带尖角的金属首饰时，请加内衬或使用绒袋。",
        ],
        quoteCallToAction:
          "请把所需的内部尺寸与纹样走向发给我们，我们会回复报价。",
        leadTime: "随每次报价确认",
        tags: ["蛋壳镶嵌", "按需报价"],
        imageAlts: [
          "嵌有蛋壳的带盖大漆盒，闭合状态置于素色背景前",
          "蛋壳镶嵌的特写，细密的碎纹与抛光漆面齐平",
        ],
      },
      {
        name: "杯垫与餐垫套组",
        categoryLabel: "餐桌器物",
        summary: "尺寸成套的平板器物，两面同髹，翻过来也不会露出背面。",
        storyParagraphs: [
          "一套东西必须自己跟自己对得上。杯垫与餐垫按统一尺寸开料，再放在同一批次里一起髹涂，让第八件的颜色就是第一件的颜色——同一批的色泽一致，在这里比任何单件都更要紧，因为整套东西要摆在同一张桌上、同一盏灯下。",
          "两面都做完。背面上的漆与正面一样多，一是为了让器物在漆固化收缩时保持平整，二是为了让餐垫在席间可以随手翻面，而不会露出未做的一侧。",
          "使用中，这是接触最多、受热最多的一类器物，所以饰面追求的是均匀而非炫目。抛光的餐垫垫在温热的盘子下，仍需片刻留心；这是漆的天性，也是套组通常会多配一两件备用的原因。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "手工抛光亮面",
        careNotes: [
          "用后擦干；请勿浸泡，也不要在潮湿状态下叠放。",
          "叠放时请在件与件之间垫一层软布或软纸。",
          "请勿将刚离火的锅具直接放在垫面上。",
          "存放时避开阳光直射、暖气与灶台热源。",
        ],
        quoteCallToAction: "请告知套组的件数、形状与饰面，我们会按批量报价。",
        leadTime: "随每次报价确认",
        tags: ["手工大漆", "按需报价"],
        imageAlts: [
          "方形大漆餐垫与圆形杯垫成套摊开呈扇形，置于素色背景上",
          "杯垫边缘的特写，可见饰面一路做到背面",
        ],
      },
      {
        name: "大漆壁板",
        categoryLabel: "壁上作品",
        summary:
          "作为一整片漆面来处理的壁板，镶嵌活在漆层之内，而不是浮在漆层之上。",
        storyParagraphs: [
          "壁板是漆最接近绘画的一种做法，也是最不容差错的一种，因为除了这片表面本身，眼睛无处停留。板要先封固、找平；此后的全部工序都是往上加——层压层，层压嵌。",
          "壳、颜料与金属箔都可以被带进漆层。放进软层里的东西，会被后面的层埋掉，再用水与磨料把它重新带出来：图像不是画到板上去的，而是从板的内部揭出来的。揭到什么程度，是一板一板由手来判断的，所以同一个图稿出来的两块壁板，是亲属关系而非复制关系。",
          "挂上墙后，壁板随房间而变。掠过的光会找出镶嵌；平铺的光则让底色占上风。它是为在变化的光线里长久相处而做的，不是为拍一张照片而做的。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "蛋壳镶嵌，磨至齐平",
        careNotes: [
          "以柔软干布除尘；请勿使用喷雾、家具蜡或溶剂。",
          "悬挂时避开阳光直射、热源与潮湿的墙面。",
          "搬动时请持边缘，不要用手按在画面上。",
          "若表面随年月变哑，请先咨询我们，不要自行处理。",
        ],
        quoteCallToAction:
          "请把壁板尺寸、悬挂方向与图稿走向发给我们，我们会回复报价。",
        leadTime: "随每次报价确认",
        tags: ["蛋壳镶嵌", "按需报价"],
        imageAlts: [
          "长方形大漆壁板挂在素色墙面上，掠射光线勾出镶嵌纹样",
          "壁板表面的特写，嵌入的贝壳已被磨回漆面之中",
        ],
      },
      {
        name: "髹漆编织篮",
        categoryLabel: "编织器物",
        summary: "藤编成形后加固再髹漆，编纹在哑光手擦饰面之下依然清晰可见。",
        storyParagraphs: [
          "这一件的起点完全不同：是编出来的形，而不是实心的胎。先把藤编成形，再作加固，漆随着纹理走而不是把纹理盖掉——器物保住了篮子的逻辑，又多了一层漆的皮肤。",
          "因为底子有肌理，漆要髹得更薄，饰面用手擦而非镜面抛光。要做镜面就得把面磨平，而磨平就意味着失去编纹存在的全部意义。哑光让纹样保持可读，也保住了编缝里的阴影。",
          "做成的东西站在两门手艺之间，也同属两门手艺：比旋制的木钵轻，比素藤温润，比二者单独更耐用。宜于陈设，宜于收纳干物，也宜于房间里那个需要质感而非光泽的角落。",
        ],
        materialLabels: ["藤编胎大漆"],
        finishLabel: "哑光手擦",
        careNotes: [
          "用软毛刷或干布顺着编纹方向除尘。",
          "保持干燥：请勿水洗，请勿浸泡。",
          "仅用于收纳干燥物品。",
          "避开阳光直射与长期潮湿的房间。",
        ],
        quoteCallToAction: "请告知所需的尺寸、编法与颜色深浅，我们会回复报价。",
        leadTime: "随每次报价确认",
        tags: ["藤编胎", "按需报价"],
        imageAlts: [
          "髹漆的藤编篮以斜角拍摄，编纹贯穿整个器形",
          "哑光漆下编纹的特写，肌理被保留而未被填平",
        ],
      },
      {
        name: "大漆小边几",
        categoryLabel: "小型家具",
        summary: "小型边几或玄关条几，台面作为一整片漆面处理，框架同色髹涂。",
        storyParagraphs: [
          "家具把漆放进了日常生活的动线里，所以这里的决定先是结构性的，然后才是装饰性的：台面怎么做才不会变形，框架怎么与之相接，以及有多少部分必须做到与台面同一标准。实际上是全部——髹漆的台面配素身的框架，用久了会长成两件不同的东西。",
          "台面用的层最多，磨的次数也最多，因为那是会被俯视的面。漆层在湿气中缓慢固化，再以水磨去；框架走同一套工期，好让颜色在整件家具上真正一致，而不只是差不多。",
          "做成哑光，几子读起来像一整块实色，比抛光台面少映出许多房间的影像——而这通常正是热闹角落里的一张小几所需要的。它是给一盏灯、一本书和一只放在杯垫上的杯子用的面，不是工作台。",
        ],
        materialLabels: ["木胎大漆"],
        finishLabel: "哑光手擦",
        careNotes: [
          "以柔软干布除尘，洒出的液体请立即擦净。",
          "台面上请始终使用杯垫与餐垫。",
          "请勿使用溶剂或家具蜡。",
          "避开阳光直射与热源；移动时请抬起，不要拖拽。",
        ],
        quoteCallToAction:
          "请把所需的高度、占地尺寸与饰面发给我们，我们会回复报价。",
        leadTime: "随每次报价确认",
        tags: ["手工大漆", "按需报价"],
        imageAlts: [
          "素色背景前的大漆小边几，哑光台面承着均匀的光",
          "台面与框架接合处的特写，饰面在两者之间连贯延续",
        ],
      },
    ],
  },
} satisfies Record<Locale, ProductLocaleCopy>);

/** Portrait 4:5, the ratio the gallery reserves for a product photograph. */
const PRODUCT_IMAGE_WIDTH = 1200;
const PRODUCT_IMAGE_HEIGHT = 1500;

function makeImages(
  imageKeys: readonly string[],
  imageAlts: readonly string[],
  replacementHint: string,
  productId: string,
): readonly PublicProductImage[] {
  return imageKeys.map((assetKey, index) => {
    const alt = imageAlts[index];

    if (!alt) {
      throw new Error(
        `Missing localized alt text for ${productId} image slot ${index + 1}.`,
      );
    }

    return {
      assetKey,
      // Never point at a stand-in file: a null src is what makes the layout
      // render a reserved slot rather than pass a placeholder off as the piece.
      src: null,
      alt,
      width: PRODUCT_IMAGE_WIDTH,
      height: PRODUCT_IMAGE_HEIGHT,
      isPrimary: index === 0,
      assetPending: true,
      replacementHint,
    } satisfies PublicProductImage;
  });
}

function makeProducts(locale: Locale): readonly PublicProduct[] {
  const localeCopy = PRODUCT_COPY[locale];

  return deepFreeze(
    PRODUCT_BLUEPRINTS.map((blueprint, index) => {
      const copy = localeCopy.products[index];

      if (!copy) {
        throw new Error(
          `Missing product copy for ${locale} at index ${index}.`,
        );
      }

      return {
        id: blueprint.id,
        // The copy is approved company text, so it carries no DEMO marker.
        marker: null,
        isDemo: false,
        locale,
        slug: blueprint.slug,
        internalReference: null,
        name: copy.name,
        categorySlug: blueprint.categorySlug,
        categoryLabel: copy.categoryLabel,
        summary: copy.summary,
        story: copy.storyParagraphs.join("\n\n"),
        storyParagraphs: copy.storyParagraphs,
        materialLabels: copy.materialLabels,
        finishLabel: copy.finishLabel,
        careNotes: copy.careNotes,
        quoteCallToAction: copy.quoteCallToAction,
        // Measurements and SKUs are physical facts the company has not
        // confirmed, so they stay absent rather than being approximated.
        dimensions: null,
        leadTime: copy.leadTime,
        showPrice: false,
        price: null,
        images: makeImages(
          blueprint.imageKeys,
          copy.imageAlts,
          localeCopy.assetReplacementHint,
          blueprint.id,
        ),
        video: null,
        // Colourways, sizes and per-product process breakdowns are unconfirmed;
        // an empty list is honest where an invented one would not be.
        variants: [],
        processSteps: [],
        tags: copy.tags,
        collectionIds: blueprint.collectionIds,
        featured: blueprint.featured,
        sortOrder: index + 1,
      } satisfies PublicProduct;
    }),
  );
}

export const DEMO_PRODUCTS_BY_LOCALE: Readonly<
  Record<Locale, readonly PublicProduct[]>
> = deepFreeze({
  vi: makeProducts("vi"),
  en: makeProducts("en"),
  fr: makeProducts("fr"),
  de: makeProducts("de"),
  ja: makeProducts("ja"),
  "zh-CN": makeProducts("zh-CN"),
});

function applyListOptions(
  products: readonly PublicProduct[],
  options?: PublicProductListOptions,
): readonly PublicProduct[] {
  if (!options) {
    return products;
  }

  let result = products.filter((product) => {
    if (options.featuredOnly && !product.featured) {
      return false;
    }
    if (
      options.collectionId &&
      !product.collectionIds.includes(options.collectionId)
    ) {
      return false;
    }
    if (options.categorySlug && product.categorySlug !== options.categorySlug) {
      return false;
    }
    return true;
  });

  if (options.limit !== undefined) {
    const limit = Math.max(0, Math.trunc(options.limit));
    result = result.slice(0, limit);
  }

  return deepFreeze(result);
}

const demoProductRepositoryImplementation: PublicProductRepository = {
  async list(locale, options) {
    return applyListOptions(DEMO_PRODUCTS_BY_LOCALE[locale], options);
  },
  async getById(locale, id) {
    return (
      DEMO_PRODUCTS_BY_LOCALE[locale].find((product) => product.id === id) ??
      null
    );
  },
  async getBySlug(locale, slug) {
    return (
      DEMO_PRODUCTS_BY_LOCALE[locale].find(
        (product) => product.slug === slug,
      ) ?? null
    );
  },
};

export const demoProductRepository: PublicProductRepository = Object.freeze(
  demoProductRepositoryImplementation,
);
