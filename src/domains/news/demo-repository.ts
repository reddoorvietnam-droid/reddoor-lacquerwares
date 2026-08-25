import type { Locale } from "@/lib/i18n/config";

import type {
  PublicNewsArticle,
  PublicNewsImage,
  PublicNewsListOptions,
  PublicNewsRepository,
} from "./public-contract";

type NewsCopy = {
  readonly title: string;
  readonly excerpt: string;
  readonly paragraphs: readonly string[];
  readonly categoryLabel: string;
  readonly tags: readonly string[];
  readonly imageAlt: string;
};

type NewsLocaleCopy = {
  readonly assetReplacementHint: string;
  readonly author: string;
  readonly articles: readonly NewsCopy[];
};

type NewsBlueprint = {
  readonly id: string;
  readonly slug: string;
  readonly categorySlug: string;
  /** ISO `YYYY-MM-DD`. Editorial publication dates, not event dates. */
  readonly publishedAt: string;
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
 * One documented item (the Ambiente Frankfurt record) plus evergreen craft and
 * trade editorial. No article reports an event, an award, a client or a figure
 * that has not been sourced. Slugs are identical in every locale so that
 * switching language on an article cannot 404.
 */
const NEWS_BLUEPRINTS = deepFreeze([
  {
    id: "news-the-2026-collection-catalogue",
    slug: "the-2026-collection-catalogue",
    categorySlug: "collections",
    publishedAt: "2026-02-17",
    featured: false,
  },
  {
    id: "news-red-door-at-ambiente-frankfurt",
    slug: "red-door-at-ambiente-frankfurt",
    categorySlug: "trade-fairs",
    publishedAt: "2026-03-10",
    featured: true,
  },
  {
    id: "news-how-a-son-mai-surface-is-built",
    slug: "how-a-son-mai-surface-is-built",
    categorySlug: "craft",
    publishedAt: "2026-04-14",
    featured: true,
  },
  {
    id: "news-caring-for-lacquerware",
    slug: "caring-for-lacquerware",
    categorySlug: "care",
    publishedAt: "2026-05-12",
    featured: false,
  },
  {
    id: "news-working-with-buyers-on-custom-orders",
    slug: "working-with-buyers-on-custom-orders",
    categorySlug: "custom-orders",
    publishedAt: "2026-06-09",
    featured: false,
  },
  {
    id: "news-inside-the-long-bien-workshop",
    slug: "inside-the-long-bien-workshop",
    categorySlug: "workshop",
    publishedAt: "2026-07-07",
    featured: false,
  },
] satisfies readonly NewsBlueprint[]);

const NEWS_COPY = deepFreeze({
  vi: {
    assetReplacementHint:
      "Ảnh bài viết thật vẫn đang chờ. Lưu ảnh theo đúng tên tệp của khung và thay vào đây kèm publicId Cloudinary.",
    author: "Red Door Vietnam",
    articles: [
      {
        title: "Catalogue Bộ sưu tập 2026",
        excerpt:
          "Bộ sưu tập 2026 gom các dòng sản phẩm hiện hành vào một catalogue, xem được dưới dạng sách lật và có sẵn theo yêu cầu.",
        paragraphs: [
          "Bộ sưu tập 2026 là catalogue hiện hành của chúng tôi. Nó tập hợp những dòng sản phẩm đang được làm — khay, bát và đồ bàn ăn, bình dáng đứng, hộp, tranh treo tường, đồ đan và bàn nhỏ — vào một chỗ, để người mua nhìn thấy cả dải sản phẩm như một dải sản phẩm, thay vì một tập ảnh rời.",
          "Catalogue được sắp theo đúng cách chúng tôi bày đồ lên mặt bàn: theo công năng của dáng và theo nước hoàn thiện của mặt sơn, chứ không theo mã nội bộ. Mặt bóng, mặt mờ và mặt cẩn được đặt cạnh nhau có chủ ý, bởi lựa chọn giữa chúng là lựa chọn mà phần lớn người mua mất nhiều thời gian nhất.",
          "Trong catalogue không in giá. Gần như mọi thứ chúng tôi làm đều được báo giá theo một bản mô tả cụ thể — kích thước, nước hoàn thiện, số lượng và quy cách đóng gói — nên một mức giá in sẵn sẽ sai với phần lớn người đọc. Hãy gửi yêu cầu kèm những gì bạn hình dung, chúng tôi sẽ báo giá theo đúng đó.",
          "Catalogue có sẵn theo yêu cầu và có thể đọc dưới dạng sách lật. Nếu bạn muốn nhận một bản, hoặc muốn kèm theo một mẫu nước hoàn thiện cụ thể để xem song song, hãy nói với chúng tôi.",
        ],
        categoryLabel: "Bộ sưu tập",
        tags: ["Bộ sưu tập 2026", "Catalogue"],
        imageAlt:
          "Catalogue Bộ sưu tập 2026 mở ra bên cạnh vài món sơn mài trên mặt bàn",
      },
      {
        title: "Red Door Vietnam tại Ambiente Frankfurt",
        excerpt:
          "Chặng đường tham dự hội chợ Frankfurt của chúng tôi, và vì sao một cuộc gặp tại hội chợ lại quan trọng đến thế khi mặt hàng là sơn mài.",
        paragraphs: [
          "Red Door Vietnam đã tham dự Ambiente tại Frankfurt vào các năm 2016, 2018, 2019, 2020, 2024 và 2025. Đó là hội chợ chúng tôi trở lại nhiều lần, và với một xưởng sơn mài thì lý do rất đơn giản: sơn mài không sống sót qua việc bị đánh giá bằng một tấm ảnh.",
          "Mặt sơn mài đã đánh bóng là một hiệu ứng chiều sâu. Nó được dựng từ nhiều lớp, và cách nó xử lý ánh sáng phụ thuộc vào góc bạn đứng, màu của nguồn sáng và khoảng cách bạn nhìn. Một màn hình nén tất cả những thứ đó thành một vệt sáng duy nhất. Người mua chỉ mới thấy hàng của chúng tôi trên màn hình thường đổi yêu cầu ngay trong phút đầu cầm sản phẩm trên tay — thường là về nước hoàn thiện, đôi khi về màu, thỉnh thoảng là về cả dáng.",
          "Vì vậy gian hàng của chúng tôi ít giống một quầy trưng bày mà giống một bàn mẫu hơn. Những cuộc trò chuyện hữu ích nhất ở Ambiente là khi một người mua cầm lên hai món cùng màu nhưng khác nước hoàn thiện, rồi quyết định ngay trên tay xem món nào thuộc về dòng hàng của họ. Kích thước, số lượng và đóng gói đều theo sau quyết định ấy và hoàn toàn có thể chốt qua email. Cái phải quyết trực tiếp là mặt sơn.",
          "Nếu bạn dự định gặp chúng tôi ở một kỳ hội chợ sắp tới, hãy viết trước. Cho chúng tôi biết bạn muốn xem những dòng nào — khay, hộp, tranh, đồ đan — nghĩa là chúng tôi sẽ mang đúng những nước hoàn thiện đó tới bàn, thay vì một tuyển chọn chung chung.",
        ],
        categoryLabel: "Hội chợ",
        tags: ["Ambiente Frankfurt", "Hội chợ"],
        imageAlt:
          "Các món sơn mài xếp trên bàn mẫu tại hội chợ dưới ánh sáng đều",
      },
      {
        title: "Một mặt sơn mài được dựng lên như thế nào",
        excerpt:
          "Sơn mài không phải lớp phủ quét ở công đoạn cuối. Nó là toàn bộ phần thân ngoài của món đồ, được đắp lên rồi mài đi rất nhiều lần.",
        paragraphs: [
          "Điều đầu tiên cần hiểu về sơn mài là nó chậm vì vật lý, chứ không phải vì truyền thống. Sơn không khô theo cách sơn công nghiệp khô. Nó đóng rắn — một phản ứng hóa học cần độ ẩm trong không khí — nên đồ mới sơn được ủ trong tủ ẩm chứ không hong dưới đèn, và nhiệt làm mọi thứ tệ đi chứ không tốt lên.",
          "Việc bắt đầu từ bên dưới mặt sơn. Cốt, dù đặc hay đan, được bó và mài phẳng để không xê dịch dưới các lớp sẽ chồng lên. Mọi chỗ chưa phẳng còn lại ở giai đoạn này sẽ không bị chôn đi, mà bị khuếch đại lên, bởi mỗi lớp sau đều đi theo đúng hình dáng nằm bên dưới nó.",
          "Rồi vòng lặp bắt đầu: phủ một lớp mỏng, ủ cho đóng rắn, và mài nước lấy đi phần lớn những gì vừa phủ. Lớp mỏng đóng rắn đều; lớp dày se mặt bên trên mà vẫn mềm bên trong. Mài nước giữ cho bụi không bay và cho người thợ cảm được mặt sơn đang phẳng dần dưới tay mình. Một món làm tử tế đi qua vòng lặp ấy rất nhiều lần.",
          "Trang trí được đưa vào trong các lớp chứ không đắp lên trên. Vỏ trứng được ấn vào lớp sơn còn mềm cho tới khi rạn thành mảng khảm li ti; vỏ trai và vàng bạc quỳ cũng được đặt theo cách đó. Tất cả sau đó bị các lớp tiếp theo chôn đi, rồi được mài lấy lại. Đó là phần khiến nhiều người bất ngờ: hình không được vẽ lên ở công đoạn cuối, hình được lộ ra từ bên trong màng sơn.",
          "Lượt đánh bóng cuối cùng mới biến một màu phẳng thành một màu sâu. Ánh sáng đi vào các lớp, tán ra rồi trở lại, nên mặt sơn giữ một sắc màu như nằm hơi thấp hơn chỗ món đồ thực sự đứng. Đó là lý do sơn mài xứng đáng với hàng tuần nó cần, và cũng là lý do không thể vội ở đoạn cuối.",
        ],
        categoryLabel: "Nghề sơn mài",
        tags: ["Sơn mài", "Nghề thủ công"],
        imageAlt:
          "Bàn thợ với một món sơn mài đang mài nước, nước mài chảy trên mặt",
      },
      {
        title: "Giữ gìn đồ sơn mài",
        excerpt:
          "Sơn mài ưa gì, kỵ gì, và danh sách ngắn những thói quen giữ cho mặt sơn vẫn như lúc mới đóng gói.",
        paragraphs: [
          "Đồ sơn mài bền hơn vẻ ngoài của nó và mong manh hơn cảm giác khi cầm. Màng sơn cứng và chịu được nước trong tiếp xúc thông thường, nhưng đó vẫn là một màng tự nhiên trên một cái cốt tự nhiên, và cả hai đều chuyển động theo nhiệt và độ ẩm. Gần như mọi hư hại đều đến từ một trong ba thứ: nước đọng, hơi nóng kéo dài, hoặc chất mài mòn.",
          "Hằng ngày, một chiếc khăn mềm khô là đủ. Với vết không chịu đi, hãy dùng khăn hơi ẩm nước rồi lau khô ngay sau đó. Không cần gì thêm, và phần lớn những thứ thêm vào đều có hại: miếng cọ, kem tẩy, máy rửa bát, bình xịt dung môi và nước bóng đồ gỗ đa dụng đều làm xỉn mặt sơn mài, có thứ làm xỉn vĩnh viễn ngay lần đầu.",
          "Đừng ngâm đồ sơn mài và đừng để nó đứng trong nước. Món ướt hay nhiều dầu mỡ nên bày trên một lớp lót thay vì đặt thẳng lên mặt sơn, và hãy để một thứ gì đó giữa mặt sơn với bất cứ vật nào vừa nhấc khỏi bếp. Cái lót ly hay tấm lót nồi ở đây không phải sự cầu kỳ; đáy nóng tiếp xúc trực tiếp là cách nhanh nhất để để lại một vòng tròn không xóa được.",
          "Nơi món đồ sống cũng quan trọng ngang với cách nó được lau. Hãy để sơn mài tránh nắng trực tiếp, tránh lò sưởi và cửa gió điều hòa, và tránh những căn phòng lúc ẩm lúc hanh thất thường. Phòng tắm và bệ cửa sổ có nắng là hai chỗ tệ nhất. Đồ phẳng nên xếp chồng có lót vải mềm thay vì úp trần lên nhau, và đồ gỗ thì nên nhấc chứ đừng kéo lê.",
          "Nếu mặt sơn xỉn đi theo năm tháng hoặc theo mức sử dụng, chuyện vẫn chưa kết thúc. Sơn mài là một màng dày và độ bóng đã mất thường có thể phục hồi bằng tay. Hãy hỏi chúng tôi trước khi bạn tự thử bất cứ thứ gì lên nó — câu trả lời đúng phụ thuộc vào nước hoàn thiện, và một mặt mờ đánh tay thì không bao giờ được xử lý như một mặt bóng.",
        ],
        categoryLabel: "Bảo quản",
        tags: ["Bảo quản", "Sơn mài"],
        imageAlt: "Bàn tay lau một mặt sơn mài đã đánh bóng bằng khăn mềm khô",
      },
      {
        title: "Làm việc với người mua trên đơn hàng đặt riêng",
        excerpt:
          "Một đơn sơn mài đặt riêng thực sự đi từ bản vẽ đầu tiên tới mẫu được duyệt ra sao, và nên gửi gì để vòng đầu tiên có giá trị.",
        paragraphs: [
          "Phần lớn hàng rời xưởng là hàng làm theo yêu cầu chứ không phải hàng chọn sẵn trên trang giấy, nên trao đổi đầu tiên quan trọng hơn mọi trao đổi sau đó. Thông tin ban đầu càng cụ thể thì càng ít vòng lặp: một bản vẽ hoặc một tấm ảnh, những kích thước nào là cố định và những kích thước nào còn co giãn, số lượng bạn đang tính tới, và ngày hàng cần có mặt ở đâu.",
          "Dáng và nước hoàn thiện được chốt riêng, và theo đúng thứ tự đó. Dáng có thể bàn từ một bản phác. Nước hoàn thiện thì không thể bàn qua màn hình. Các màn hình không thống nhất với nhau về màu, và không màn hình nào cho thấy mặt sơn mài đã đánh bóng thay đổi ra sao khi góc nhìn thay đổi. Màu và nước hoàn thiện được đối chiếu trên mẫu vật, cầm trên tay, và đó là căn cứ duy nhất mà cả hai bên nên dựa vào.",
          "Thời gian sản xuất do số lớp quyết định, không phải do số lượng. Một món phải được phủ, ủ và mài rất nhiều lượt, mà phần ủ thì không thể rút ngắn bằng cách thêm người. Vì vậy một món mặt mờ và một món đánh bóng gương cùng kích thước có thể có lịch rất khác nhau, và vì vậy nước hoàn thiện đáng được quyết sớm.",
          "Tiếp theo là làm mẫu: chúng tôi làm, bạn đối chiếu với những gì đã yêu cầu, và hai bên thống nhất các điều chỉnh. Có những góp ý dễ tiếp thu — độ đậm của màu, dáng vành, một kích thước lòng. Có những góp ý thực chất là một dáng mới, và tốt cho cả hai bên nếu biết rõ đâu là đâu trước khi mẫu được làm.",
          "Đóng gói, in nhãn và vận chuyển đều được bàn ở bước báo giá chứ không mặc định. Hãy gửi yêu cầu kèm càng nhiều thông tin trên đây càng tốt; chúng tôi sẽ trả lời bằng một báo giá và một đánh giá thẳng thắn về lịch sản xuất.",
        ],
        categoryLabel: "Đặt hàng riêng",
        tags: ["Đơn hàng đặt riêng", "Dành cho người mua"],
        imageAlt:
          "Bản vẽ kỹ thuật và các mẫu nước hoàn thiện sơn mài đặt cạnh nhau trên bàn",
      },
      {
        title: "Bên trong xưởng Long Biên",
        excerpt:
          "Xưởng của chúng tôi ở 212 Nguyễn Sơn, Long Biên, Hà Nội. Đây là chặng đường một đơn hàng đi qua nó.",
        paragraphs: [
          "Xưởng của Red Door Vietnam nằm ở 212 Nguyễn Sơn, Long Biên, Hà Nội; văn phòng ở bên kia sông tại Tây Hồ và kho hàng ở Quốc lộ 5, thị trấn Bần, Hưng Yên. Một xưởng sơn mài được bố trí quanh một ràng buộc lớn hơn mọi ràng buộc khác, và nên nói thẳng nó ra: các lớp sơn phải đóng rắn, đóng rắn cần thời gian và độ ẩm, và không công đoạn nào phía sau có thể bắt đầu sớm hơn.",
          "Vì vậy công việc chạy theo từng chặng chứ không theo một dây chuyền. Cốt được nhận về hoặc được làm ra, rồi được chuẩn bị — bó, mài phẳng, kiểm tra độ ổn định — trước khi bất kỳ màu nào được đặt lên. Phần chuẩn bị ấy không hào nhoáng, nhưng nó quyết định món đồ hoàn thiện có thể tốt tới đâu.",
          "Phủ sơn và ủ chiếm nhiều diện tích và nhiều kiên nhẫn nhất. Một lớp mỏng được phủ, món đồ vào chỗ ủ ẩm, rồi trở ra để được mài nước trước lớp kế tiếp. Đồ ra vào vòng lặp ấy rất nhiều lần, nghĩa là một xưởng sơn mài lúc nào cũng có nhiều hàng đang dở hơn hàng đã xong.",
          "Phần cẩn, nếu món đồ cần, diễn ra bên trong vòng lặp ấy chứ không phải sau nó: vỏ trai hay quỳ được đặt vào lớp sơn còn mềm, bị các lớp sau chôn đi, rồi được lấy lại bằng tay ở bàn mài. Đánh bóng là phán đoán cuối cùng — mài tới đâu là quyết định cho từng món, không do máy đặt sẵn.",
          "Rồi tới kiểm hàng và đóng gói, và món đồ thôi là một vật trong xưởng để trở thành một lô hàng. Người mua hoàn toàn có thể hẹn tới thăm; nhìn tận mắt công đoạn ủ thường giải thích được lịch sản xuất tốt hơn bất cứ email nào.",
        ],
        categoryLabel: "Xưởng",
        tags: ["Xưởng", "Hà Nội"],
        imageAlt:
          "Đồ sơn mài đang dở nằm trên giá trong xưởng chờ lớp sơn tiếp theo",
      },
    ],
  },
  en: {
    assetReplacementHint:
      "The final photograph is still outstanding. Save the approved image under this asset key and attach its Cloudinary publicId here.",
    author: "Red Door Vietnam",
    articles: [
      {
        title: "The 2026 Collection catalogue",
        excerpt:
          "The 2026 Collection brings the current families together in one catalogue, readable as a flipbook and available on request.",
        paragraphs: [
          "The 2026 Collection is our current catalogue. It gathers the families we are actively making — trays, bowls and table pieces, standing vessels, boxes, wall panels, woven forms and small furniture — into one place, so that a buyer can see the range as a range rather than as a folder of individual photographs.",
          "It is organised the way we would put pieces on a table: by what a form is for and how its surface is finished, rather than by internal reference. Gloss, matte and inlaid finishes are shown alongside each other on purpose, because the choice between them is the choice most buyers spend the longest on.",
          "Prices are not printed in it. Almost everything we make is quoted against a specification — size, finish, quantity and packing — so a printed price would be wrong for most readers. Send an enquiry with what you have in mind and we will quote against it.",
          "The catalogue is available on request and can be read as a flipbook. If you would like a copy, or a sample of a particular finish to look at alongside it, ask us.",
        ],
        categoryLabel: "Collections",
        tags: ["2026 Collection", "Catalogue"],
        imageAlt:
          "The 2026 Collection catalogue lying open beside several lacquer pieces on a table",
      },
      {
        title: "Red Door Vietnam at Ambiente Frankfurt",
        excerpt:
          "Our exhibition record at the Frankfurt fair, and what a trade-fair meeting is actually good for when the product is lacquer.",
        paragraphs: [
          "Red Door Vietnam has exhibited at Ambiente in Frankfurt in 2016, 2018, 2019, 2020, 2024 and 2025. It is the fair we keep going back to, and for a lacquer workshop the reason is straightforward: lacquer does not survive being judged from a photograph.",
          "A polished lacquer surface is a depth effect. It is built from layers, and what it does with light depends on the angle you stand at, the colour of that light and how far away you are. A screen flattens all of it into a single specular highlight. Buyers who have only ever seen our work on a monitor tend to change their specification within a minute of holding a piece — usually about finish, sometimes about colour, occasionally about the whole form.",
          "So a stand is less a display than a sample table. The useful conversations at Ambiente are the ones where a buyer picks up two pieces in the same colour with different finishes and decides, in the hand, which one belongs in their range. Sizes, quantities and packing all follow from that, and all of them are easy to settle by email afterwards. The decision that has to happen in person is the one about surface.",
          "If you are planning to see us at a coming edition, write ahead. Telling us in advance which families you want on the table — trays, boxes, panels, woven pieces — means we can have the right finishes there rather than a general selection.",
        ],
        categoryLabel: "Trade fairs",
        tags: ["Ambiente Frankfurt", "Trade fairs"],
        imageAlt:
          "Lacquer pieces arranged on a trade-fair sample table under even light",
      },
      {
        title: "How a sơn mài surface is built, layer by layer",
        excerpt:
          "Vietnamese lacquer is not a coating applied at the end. It is the object's whole outer body, built up and cut back many times over.",
        paragraphs: [
          "The first thing to understand about sơn mài is that it is slow by physics, not by tradition. Lacquer does not dry the way paint dries. It cures — a chemical reaction that needs moisture from the air — which is why fresh work sits in a humid cabinet rather than under a lamp, and why heat makes things worse rather than better.",
          "Work starts below the surface. The core, whether solid or woven, is sealed and levelled so that it will not move under the layers that follow. Any unevenness left at this stage does not get buried; it gets amplified, because every later coat follows the shape underneath it.",
          "Then the cycle begins: lay a thin coat, cure it, and cut it back with water and abrasive until most of what was applied has been taken off again. Thin coats cure evenly; thick ones skin over and stay soft underneath. Cutting back with water keeps the dust down and lets the maker feel the surface levelling under their hand. A serious piece goes through that cycle many times over.",
          "Decoration is set into the layers rather than onto them. Eggshell is pressed into a soft coat until it crazes into a fine mosaic; shell and metal leaf are laid the same way. Everything is then buried under further coats and brought back by sanding. That is the part that surprises people: the image is not painted on at the end, it is uncovered from inside the film.",
          "The final polish is what turns a flat colour into a deep one. Light enters the layers, scatters and comes back, so the surface holds a colour that seems to sit slightly below where the object actually is. It is the reason lacquerware is worth the weeks it takes, and the reason it cannot be rushed at the end.",
        ],
        categoryLabel: "Craft",
        tags: ["Sơn mài", "Craft"],
        imageAlt:
          "A workbench with a lacquer piece being wet-sanded, water running across the surface",
      },
      {
        title: "Caring for lacquerware",
        excerpt:
          "What lacquer likes, what it does not, and the short list of habits that keep a polished surface looking the way it did when it was packed.",
        paragraphs: [
          "Lacquerware is more robust than it looks and less robust than it feels. The finish is hard and it resists water in ordinary contact, but it is a natural film on a natural core, and both of those move with heat and humidity. Almost everything that goes wrong with a piece comes from one of three things: standing water, sustained heat, or an abrasive.",
          "Day to day, a soft dry cloth is enough. For a mark that will not lift, use a cloth barely damp with water and dry the surface straight afterwards. Nothing else is needed and most things are harmful: scouring pads, cream cleansers, dishwashers, solvent sprays and general-purpose furniture polish will all dull a polished lacquer surface, some of them permanently and on the first try.",
          "Do not soak lacquerware and do not leave it standing in water. Serve wet or oily food on a liner rather than directly on the surface, and put something between the lacquer and anything that has just come off the heat. A trivet or coaster is not fussiness here; a hot base in direct contact is the fastest way to leave a permanent ring.",
          "Where a piece lives matters as much as how it is cleaned. Keep lacquer out of direct sunlight, away from radiators and air-conditioning outlets, and out of rooms that swing between very damp and very dry. Bathrooms and sunny windowsills are the two worst homes. Store flat pieces with a soft interleaf rather than stacked bare, and lift furniture rather than dragging it.",
          "If a surface does go dull with age or use, that is not the end of it. Lacquer is a thick film and a dulled polish can often be brought back by hand. Ask us before you try anything on it yourself — the right answer depends on the finish, and a matte, hand-rubbed surface should never be treated like a gloss one.",
        ],
        categoryLabel: "Care",
        tags: ["Care", "Lacquer"],
        imageAlt:
          "A hand wiping a polished lacquer surface with a soft dry cloth",
      },
      {
        title: "Working with buyers on custom orders",
        excerpt:
          "How a custom lacquer order actually moves from a first drawing to an approved sample, and what to send us to make the first round count.",
        paragraphs: [
          "Most of what leaves the workshop is made to a buyer's specification rather than picked off a page, so the first exchange matters more than any other. The more concrete that first message is, the fewer rounds it takes: a drawing or a photograph, the sizes that are fixed and the ones that are flexible, the quantities you are thinking about, and the date the goods need to be somewhere.",
          "Form and finish are settled separately, and in that order. A shape can be discussed from a sketch; a finish cannot be discussed from a screen at all. Monitors disagree with each other about colour, and none of them can show what a polished lacquer surface does when the viewing angle changes. Colour and finish are matched against a physical sample, in the hand, and that is the only approval either side should rely on.",
          "Lead time is set by the layers, not by the quantity. A piece has to be coated, cured and cut back many times over, and the curing part cannot be shortened by adding people to it. That is why a matte piece and a mirror-polished piece with the same dimensions can have quite different schedules, and why finish is worth deciding early.",
          "Sampling comes next: we make the piece, you assess it against what you asked for, and we agree the changes. Some notes are easy to absorb — a depth of colour, a rim profile, an internal dimension. Some amount to a new form, and it is better for everyone to know which is which before the sample is made.",
          "Packing, marking and shipping are all discussed at quotation rather than assumed. Send us the enquiry with as much of the above as you have, and we will come back with a quotation and an honest view of what the schedule looks like.",
        ],
        categoryLabel: "Custom orders",
        tags: ["Custom orders", "For buyers"],
        imageAlt:
          "A technical drawing and a row of lacquer finish samples laid out together on a bench",
      },
      {
        title: "Inside the Long Biên workshop",
        excerpt:
          "Our factory sits at 212 Nguyễn Sơn in Long Biên, Hà Nội. This is the route an order takes through it.",
        paragraphs: [
          "Red Door Vietnam's factory is at 212 Nguyễn Sơn, Long Biên, in Hà Nội, with the office across the river in Tây Hồ and a warehouse out on Quốc lộ 5 at Bần in Hưng Yên. A lacquer workshop is laid out around one constraint above all others, and it is worth saying plainly what it is: coats have to cure, curing takes time and humidity, and nothing downstream can start early.",
          "So the work moves in stages rather than along a line. Forms arrive or are made up and are then prepared — sealed, levelled, checked for movement — before any colour is committed to them. That preparation is unglamorous and it decides how good the finished piece can possibly be.",
          "Coating and curing take the most room and the most patience. A coat goes on thin, the piece goes into humidity, and it comes back out to be cut back with water before the next coat. Pieces move in and out of that cycle many times over, which means a lacquer workshop always has far more work in progress than it has work finished.",
          "Inlay, where a piece calls for it, happens inside that cycle rather than after it: shell or leaf is set into a soft coat, buried by the coats that follow, and brought back later by hand at the sanding bench. Polishing is the last judgement — how far to take a surface is decided piece by piece, not set by a machine.",
          "Then inspection and packing, and the piece stops being a workshop object and becomes a shipment. Buyers are welcome to arrange a visit; seeing the curing stage in particular tends to explain a schedule better than any email can.",
        ],
        categoryLabel: "Workshop",
        tags: ["Workshop", "Hà Nội"],
        imageAlt:
          "Work in progress on workshop racks, waiting for the next coat of lacquer",
      },
    ],
  },
  fr: {
    assetReplacementHint:
      "La photographie définitive reste à fournir. Enregistrez l'image approuvée sous cette clé d'actif et renseignez ici son publicId Cloudinary.",
    author: "Red Door Vietnam",
    articles: [
      {
        title: "Le catalogue de la Collection 2026",
        excerpt:
          "La Collection 2026 réunit les familles en cours dans un seul catalogue, feuilletable en ligne et disponible sur demande.",
        paragraphs: [
          "La Collection 2026 est notre catalogue en cours. Elle rassemble les familles que nous produisons aujourd'hui — plateaux, coupes et arts de la table, vases, coffrets, panneaux muraux, pièces tressées et petit mobilier — en un seul endroit, afin qu'un acheteur voie la gamme comme une gamme et non comme un dossier de photographies isolées.",
          "Elle est organisée comme nous disposerions les pièces sur une table : selon l'usage de la forme et la finition de la surface, plutôt que selon une référence interne. Brillant, mat et incrusté sont présentés côte à côte à dessein, car c'est entre eux que les acheteurs hésitent le plus longtemps.",
          "Aucun prix n'y figure. Presque tout ce que nous fabriquons est chiffré sur cahier des charges — dimensions, finition, quantité, conditionnement — de sorte qu'un prix imprimé serait faux pour la plupart des lecteurs. Adressez-nous une demande avec ce que vous avez en tête et nous chiffrerons sur cette base.",
          "Le catalogue est disponible sur demande et peut être feuilleté en ligne. Si vous en souhaitez un exemplaire, ou un échantillon d'une finition précise à regarder en parallèle, dites-le-nous.",
        ],
        categoryLabel: "Collections",
        tags: ["Collection 2026", "Catalogue"],
        imageAlt:
          "Le catalogue de la Collection 2026 ouvert à côté de plusieurs pièces en laque sur une table",
      },
      {
        title: "Red Door Vietnam à Ambiente Francfort",
        excerpt:
          "Notre parcours au salon de Francfort, et ce à quoi sert vraiment une rencontre en salon quand le produit est de la laque.",
        paragraphs: [
          "Red Door Vietnam a exposé à Ambiente, à Francfort, en 2016, 2018, 2019, 2020, 2024 et 2025. C'est le salon où nous revenons, et pour un atelier de laque la raison est simple : la laque ne survit pas à un jugement porté sur photographie.",
          "Une surface de laque polie est un effet de profondeur. Elle est bâtie par couches, et ce qu'elle fait de la lumière dépend de l'angle où l'on se place, de la couleur de cette lumière et de la distance. Un écran ramène tout cela à un unique reflet spéculaire. Les acheteurs qui n'ont vu notre travail que sur un moniteur modifient généralement leur demande dans la minute qui suit la prise en main — le plus souvent sur la finition, parfois sur la couleur, à l'occasion sur la forme entière.",
          "Un stand est donc moins une vitrine qu'une table d'échantillons. Les conversations utiles à Ambiente sont celles où un acheteur prend deux pièces de même couleur et de finitions différentes et décide, la pièce en main, laquelle a sa place dans sa gamme. Dimensions, quantités et conditionnement en découlent, et se règlent ensuite très bien par courriel. La décision qui doit se prendre en personne, c'est celle de la surface.",
          "Si vous prévoyez de nous voir lors d'une prochaine édition, écrivez-nous à l'avance. Nous indiquer quelles familles vous souhaitez trouver sur la table — plateaux, coffrets, panneaux, pièces tressées — nous permet d'apporter les bonnes finitions plutôt qu'une sélection générale.",
        ],
        categoryLabel: "Salons",
        tags: ["Ambiente Francfort", "Salons"],
        imageAlt:
          "Pièces en laque disposées sur une table d'échantillons de salon sous une lumière égale",
      },
      {
        title:
          "Comment se construit une surface de sơn mài, couche après couche",
        excerpt:
          "La laque vietnamienne n'est pas un vernis appliqué à la fin. C'est tout le corps extérieur de l'objet, monté puis repris un très grand nombre de fois.",
        paragraphs: [
          "La première chose à comprendre au sujet du sơn mài, c'est qu'il est lent par physique et non par tradition. La laque ne sèche pas comme une peinture sèche. Elle durcit — une réaction chimique qui réclame l'humidité de l'air —, raison pour laquelle une pièce fraîche repose en armoire humide et non sous une lampe, et raison pour laquelle la chaleur aggrave les choses au lieu de les hâter.",
          "Le travail commence sous la surface. L'âme, pleine ou tressée, est encollée et dressée afin qu'elle ne bouge plus sous les couches à venir. Le moindre défaut de planéité laissé à ce stade n'est pas enseveli : il est amplifié, puisque chaque couche ultérieure épouse la forme qu'elle recouvre.",
          "Puis le cycle s'engage : poser une couche mince, la laisser durcir, la reprendre à l'eau et à l'abrasif jusqu'à retirer l'essentiel de ce qui vient d'être appliqué. Les couches minces durcissent régulièrement ; les couches épaisses se peaussent en surface et restent molles dessous. Le ponçage à l'eau contient la poussière et permet à l'artisan de sentir la surface s'égaliser sous sa main. Une pièce sérieuse traverse ce cycle un très grand nombre de fois.",
          "Le décor se loge dans les couches, non par-dessus. La coquille d'œuf est pressée dans une couche fraîche jusqu'à se fendiller en fine mosaïque ; la nacre et la feuille de métal se posent de la même façon. Tout est ensuite enseveli sous d'autres couches, puis ramené au jour par le ponçage. C'est là ce qui surprend : l'image n'est pas peinte à la fin, elle est dégagée depuis l'intérieur du film.",
          "Le polissage final transforme une couleur plate en couleur profonde. La lumière entre dans les couches, s'y diffuse et revient : la surface retient une couleur qui semble se tenir un peu en deçà de l'objet lui-même. C'est ce qui justifie les semaines que réclame la laque, et ce qui interdit de précipiter la fin.",
        ],
        categoryLabel: "Métier",
        tags: ["Sơn mài", "Métier"],
        imageAlt:
          "Établi avec une pièce en laque en cours de ponçage à l'eau, l'eau ruisselant sur la surface",
      },
      {
        title: "Entretenir la laque",
        excerpt:
          "Ce que la laque aime, ce qu'elle refuse, et la courte liste d'habitudes qui gardent une surface polie telle qu'elle était à l'emballage.",
        paragraphs: [
          "La laque est plus robuste qu'elle n'en a l'air et moins robuste qu'elle n'en donne l'impression. Le film est dur et résiste à l'eau en contact ordinaire, mais c'est un film naturel sur une âme naturelle, et l'un comme l'autre travaillent avec la chaleur et l'humidité. Presque tous les accidents viennent de trois causes : l'eau stagnante, la chaleur prolongée, un abrasif.",
          "Au quotidien, un chiffon doux et sec suffit. Pour une marque tenace, employez un chiffon à peine humide et séchez aussitôt. Rien d'autre n'est nécessaire, et la plupart des autres produits nuisent : éponges abrasives, crèmes à récurer, lave-vaisselle, aérosols à solvant et cires pour meubles ternissent une laque polie, certains définitivement et dès la première tentative.",
          "Ne faites pas tremper la laque et ne la laissez pas séjourner dans l'eau. Servez les mets humides ou gras sur un support plutôt que directement sur la surface, et interposez toujours quelque chose entre la laque et ce qui sort du feu. Le dessous-de-plat n'est pas ici une manie : un fond chaud en contact direct est le moyen le plus rapide de laisser une auréole définitive.",
          "L'endroit où vit une pièce compte autant que la façon dont on la nettoie. Tenez la laque à l'écart du soleil direct, des radiateurs et des bouches de climatisation, et des pièces qui passent du très humide au très sec. La salle de bains et le rebord de fenêtre ensoleillé sont les deux pires adresses. Empilez les pièces plates en intercalant un feutre plutôt que nues, et soulevez les meubles au lieu de les traîner.",
          "Si une surface se ternit avec l'âge ou l'usage, tout n'est pas perdu. La laque est un film épais, et un poli terni peut souvent être repris à la main. Consultez-nous avant d'essayer quoi que ce soit vous-même : la bonne réponse dépend de la finition, et une surface mate frottée à la main ne doit jamais être traitée comme une surface brillante.",
        ],
        categoryLabel: "Entretien",
        tags: ["Entretien", "Laque"],
        imageAlt:
          "Une main essuyant une surface de laque polie avec un chiffon doux et sec",
      },
      {
        title: "Travailler avec les acheteurs sur les commandes spéciales",
        excerpt:
          "Comment une commande spéciale passe réellement du premier dessin à l'échantillon approuvé, et ce qu'il faut nous envoyer pour que le premier tour compte.",
        paragraphs: [
          "L'essentiel de ce qui sort de l'atelier est fabriqué sur cahier des charges plutôt que choisi sur catalogue : le premier échange compte donc plus que tous les autres. Plus ce premier message est concret, moins il faudra d'allers-retours : un dessin ou une photographie, les dimensions figées et celles qui restent souples, les quantités envisagées et la date à laquelle la marchandise doit se trouver quelque part.",
          "La forme et la finition se règlent séparément, et dans cet ordre. Une forme se discute à partir d'un croquis ; une finition ne se discute pas du tout à l'écran. Les moniteurs ne s'accordent pas entre eux sur la couleur, et aucun ne montre ce que fait une laque polie quand l'angle de vue change. Couleur et finition se valident sur un échantillon physique, en main : c'est la seule approbation sur laquelle les deux parties devraient s'appuyer.",
          "Le délai est fixé par les couches, non par la quantité. Une pièce doit être laquée, durcie et reprise un très grand nombre de fois, et l'étape de durcissement ne se raccourcit pas en y affectant plus de personnes. C'est pourquoi une pièce mate et une pièce polie miroir de mêmes dimensions peuvent suivre des calendriers très différents, et pourquoi il vaut la peine d'arrêter la finition tôt.",
          "Vient ensuite l'échantillonnage : nous réalisons la pièce, vous la confrontez à votre demande, et nous convenons des ajustements. Certaines remarques s'absorbent aisément — une profondeur de couleur, un profil de bord, une cote intérieure. D'autres reviennent à une forme nouvelle, et il vaut mieux pour tout le monde savoir de quoi il s'agit avant que l'échantillon ne soit lancé.",
          "Conditionnement, marquage et transport se discutent au devis plutôt qu'ils ne se supposent. Envoyez-nous votre demande avec le plus d'éléments possible, et nous reviendrons vers vous avec un devis et une vue honnête du calendrier.",
        ],
        categoryLabel: "Commandes spéciales",
        tags: ["Commandes spéciales", "Pour les acheteurs"],
        imageAlt:
          "Un plan technique et une série d'échantillons de finitions en laque disposés ensemble sur un établi",
      },
      {
        title: "Dans l'atelier de Long Biên",
        excerpt:
          "Notre usine se trouve au 212 Nguyễn Sơn, à Long Biên, Hanoï. Voici le trajet qu'y suit une commande.",
        paragraphs: [
          "L'usine de Red Door Vietnam se trouve au 212 Nguyễn Sơn, à Long Biên, Hanoï ; le bureau est de l'autre côté du fleuve, à Tây Hồ, et l'entrepôt sur la Quốc lộ 5, à Bần, dans la province de Hưng Yên. Un atelier de laque s'organise autour d'une contrainte qui prime toutes les autres, et autant la nommer clairement : les couches doivent durcir, le durcissement demande du temps et de l'humidité, et rien en aval ne peut commencer plus tôt.",
          "Le travail avance donc par étapes plutôt qu'en ligne. Les formes arrivent ou sont montées, puis préparées — encollées, dressées, contrôlées quant à leur stabilité — avant qu'aucune couleur ne leur soit confiée. Cette préparation n'a rien de spectaculaire et détermine pourtant le niveau que la pièce finie pourra atteindre.",
          "Le laquage et le durcissement occupent le plus de place et demandent le plus de patience. Une couche est posée mince, la pièce part en atmosphère humide, puis revient pour être reprise à l'eau avant la couche suivante. Les pièces entrent et sortent de ce cycle un grand nombre de fois : un atelier de laque a donc toujours bien plus d'ouvrage en cours que d'ouvrage terminé.",
          "L'incrustation, lorsqu'une pièce en demande, se fait à l'intérieur de ce cycle et non après : nacre ou feuille est posée dans une couche fraîche, ensevelie par les suivantes, puis ramenée au jour à la main sur l'établi de ponçage. Le polissage est le dernier jugement — jusqu'où pousser une surface se décide pièce par pièce, et non par une machine.",
          "Viennent enfin le contrôle et l'emballage : la pièce cesse d'être un objet d'atelier pour devenir une expédition. Les acheteurs sont les bienvenus pour convenir d'une visite ; voir l'étape du durcissement explique généralement un calendrier mieux que n'importe quel courriel.",
        ],
        categoryLabel: "Atelier",
        tags: ["Atelier", "Hanoï"],
        imageAlt:
          "Pièces en cours sur des claies d'atelier, en attente de la couche de laque suivante",
      },
    ],
  },
  de: {
    assetReplacementHint:
      "Die endgültige Aufnahme steht noch aus. Speichern Sie das freigegebene Bild unter diesem Asset-Key und tragen Sie hier seine Cloudinary-publicId ein.",
    author: "Red Door Vietnam",
    articles: [
      {
        title: "Der Katalog zur Kollektion 2026",
        excerpt:
          "Die Kollektion 2026 führt die aktuellen Produktfamilien in einem Katalog zusammen – als Blätterkatalog lesbar und auf Anfrage erhältlich.",
        paragraphs: [
          "Die Kollektion 2026 ist unser aktueller Katalog. Sie versammelt die Familien, die wir derzeit fertigen — Tabletts, Schalen und Tischkultur, stehende Gefäße, Schatullen, Wandpaneele, Flechtwaren und Kleinmöbel — an einem Ort, damit ein Einkäufer das Sortiment als Sortiment sieht und nicht als Ordner mit Einzelfotos.",
          "Geordnet ist er so, wie wir Stücke auf einen Tisch legen würden: danach, wofür eine Form da ist und wie ihre Oberfläche ausgeführt wurde, nicht nach interner Referenz. Glänzende, matte und eingelegte Oberflächen stehen mit Absicht nebeneinander, denn die Wahl zwischen ihnen ist die Entscheidung, für die die meisten Einkäufer am längsten brauchen.",
          "Preise sind nicht abgedruckt. Fast alles, was wir fertigen, wird gegen eine Spezifikation kalkuliert — Maß, Oberfläche, Stückzahl und Verpackung —, ein gedruckter Preis wäre für die meisten Leser also schlicht falsch. Schicken Sie uns Ihre Vorstellung, und wir kalkulieren darauf.",
          "Der Katalog ist auf Anfrage erhältlich und lässt sich als Blätterkatalog lesen. Wenn Sie ein Exemplar wünschen oder zusätzlich ein Muster einer bestimmten Oberfläche danebenlegen möchten, sagen Sie uns Bescheid.",
        ],
        categoryLabel: "Kollektionen",
        tags: ["Kollektion 2026", "Katalog"],
        imageAlt:
          "Der Katalog zur Kollektion 2026, aufgeschlagen neben mehreren Lackobjekten auf einem Tisch",
      },
      {
        title: "Red Door Vietnam auf der Ambiente in Frankfurt",
        excerpt:
          "Unsere Messebilanz in Frankfurt – und wozu ein Messetermin tatsächlich taugt, wenn das Produkt Lack heißt.",
        paragraphs: [
          "Red Door Vietnam hat 2016, 2018, 2019, 2020, 2024 und 2025 auf der Ambiente in Frankfurt ausgestellt. Es ist die Messe, zu der wir immer wieder zurückkehren, und für eine Lackwerkstatt liegt der Grund auf der Hand: Lack übersteht es nicht, nach einer Fotografie beurteilt zu werden.",
          "Eine polierte Lackfläche ist ein Tiefenphänomen. Sie ist aus Schichten aufgebaut, und was sie mit Licht macht, hängt vom Blickwinkel ab, von der Farbe dieses Lichts und vom Abstand. Ein Bildschirm presst all das in ein einziges Glanzlicht. Einkäufer, die unsere Arbeiten bisher nur am Monitor gesehen haben, ändern ihre Spezifikation meist innerhalb einer Minute, nachdem sie ein Stück in der Hand hatten — meist bei der Oberfläche, manchmal bei der Farbe, gelegentlich bei der gesamten Form.",
          "Ein Stand ist deshalb weniger Auslage als Mustertisch. Die nützlichen Gespräche auf der Ambiente sind die, in denen ein Einkäufer zwei Stücke derselben Farbe mit unterschiedlichen Oberflächen aufnimmt und in der Hand entscheidet, welches in sein Sortiment gehört. Maße, Stückzahlen und Verpackung folgen daraus und lassen sich anschließend bequem per E-Mail klären. Die Entscheidung, die persönlich fallen muss, ist die über die Oberfläche.",
          "Wenn Sie uns zu einer kommenden Ausgabe besuchen möchten, schreiben Sie uns vorher. Wenn wir wissen, welche Familien Sie auf dem Tisch sehen wollen — Tabletts, Schatullen, Paneele, Flechtwaren —, können wir die passenden Oberflächen mitbringen statt einer allgemeinen Auswahl.",
        ],
        categoryLabel: "Messen",
        tags: ["Ambiente Frankfurt", "Messen"],
        imageAlt:
          "Lackobjekte auf einem Mustertisch der Messe unter gleichmäßigem Licht",
      },
      {
        title: "Wie eine Sơn-mài-Oberfläche Schicht für Schicht entsteht",
        excerpt:
          "Vietnamesischer Lack ist keine Beschichtung, die am Ende aufgetragen wird. Er ist der gesamte äußere Körper des Objekts – viele Male aufgebaut und wieder zurückgeschliffen.",
        paragraphs: [
          "Das Erste, was man über Sơn mài verstehen muss: Es ist langsam aus physikalischen Gründen, nicht aus Tradition. Lack trocknet nicht wie Farbe trocknet. Er härtet — eine chemische Reaktion, die Feuchtigkeit aus der Luft braucht. Deshalb steht frische Arbeit im Feuchtschrank und nicht unter einer Lampe, und deshalb macht Wärme die Sache schlechter statt schneller.",
          "Die Arbeit beginnt unter der Oberfläche. Der Kern, ob massiv oder geflochten, wird grundiert und plangeschliffen, damit er sich unter den folgenden Schichten nicht mehr bewegt. Jede Unebenheit, die in diesem Stadium bleibt, wird nicht zugedeckt, sondern verstärkt, denn jede spätere Schicht folgt der Form unter sich.",
          "Dann beginnt der Zyklus: dünne Schicht auftragen, aushärten lassen, mit Wasser und Schleifmittel wieder zurücknehmen, bis das meiste des Aufgetragenen wieder ab ist. Dünne Schichten härten gleichmäßig; dicke bilden eine Haut und bleiben darunter weich. Das Nassschleifen hält den Staub unten und lässt den Handwerker spüren, wie sich die Fläche unter seiner Hand ausgleicht. Ein ernsthaftes Stück durchläuft diesen Zyklus viele Male.",
          "Dekor liegt in den Schichten, nicht auf ihnen. Eierschale wird in eine weiche Lage gedrückt, bis sie zu einem feinen Mosaik aufreißt; Perlmutt und Metallblatt werden ebenso eingelegt. Anschließend verschwindet alles unter weiteren Schichten und wird durch Schleifen zurückgeholt. Das überrascht viele: Das Bild wird nicht am Ende aufgemalt, es wird aus dem Inneren des Films freigelegt.",
          "Die abschließende Politur macht aus einer flachen Farbe eine tiefe. Licht dringt in die Schichten ein, streut und kehrt zurück, sodass die Fläche eine Farbe hält, die etwas unterhalb des Objekts zu liegen scheint. Das ist der Grund, warum Lackarbeit die Wochen wert ist, die sie braucht — und warum sie am Ende nicht beschleunigt werden kann.",
        ],
        categoryLabel: "Handwerk",
        tags: ["Sơn mài", "Handwerk"],
        imageAlt:
          "Werkbank mit einem Lackstück beim Nassschliff, Wasser läuft über die Fläche",
      },
      {
        title: "Pflege von Lackarbeiten",
        excerpt:
          "Was Lack mag, was nicht – und die kurze Liste an Gewohnheiten, die eine polierte Oberfläche so erhalten, wie sie verpackt wurde.",
        paragraphs: [
          "Lackarbeit ist robuster, als sie aussieht, und weniger robust, als sie sich anfühlt. Der Film ist hart und hält gewöhnlichem Wasserkontakt stand, aber es ist ein natürlicher Film auf einem natürlichen Kern, und beide arbeiten mit Wärme und Feuchtigkeit. Fast alles, was an einem Stück schiefgeht, geht auf drei Dinge zurück: stehendes Wasser, anhaltende Wärme oder ein Schleifmittel.",
          "Im Alltag genügt ein weiches, trockenes Tuch. Für eine Spur, die sich nicht löst, nehmen Sie ein kaum feuchtes Tuch und reiben die Fläche sofort trocken. Mehr ist nicht nötig, und das meiste andere schadet: Scheuerschwämme, Scheuermilch, Spülmaschinen, Lösemittelsprays und Allzweck-Möbelpolituren machen eine polierte Lackfläche stumpf, manche dauerhaft und schon beim ersten Versuch.",
          "Weichen Sie Lackarbeiten nicht ein und lassen Sie sie nicht in Wasser stehen. Servieren Sie Feuchtes oder Fettiges auf einer Unterlage statt direkt auf der Fläche, und legen Sie stets etwas zwischen Lack und alles, was gerade vom Herd kommt. Ein Untersetzer ist hier keine Pedanterie: ein heißer Boden in direktem Kontakt ist der schnellste Weg zu einem bleibenden Ring.",
          "Wo ein Stück steht, zählt genauso viel wie die Art der Reinigung. Halten Sie Lack von direkter Sonne, Heizkörpern und Klimaauslässen fern und aus Räumen heraus, die zwischen sehr feucht und sehr trocken schwanken. Badezimmer und sonnige Fensterbänke sind die beiden schlechtesten Adressen. Lagern Sie flache Teile mit einem weichen Zwischenblatt statt blank gestapelt, und heben Sie Möbel an, statt sie zu schieben.",
          "Wird eine Oberfläche mit den Jahren oder im Gebrauch doch stumpf, ist das kein Ende. Lack ist ein dicker Film, und eine matt gewordene Politur lässt sich oft von Hand zurückholen. Fragen Sie uns, bevor Sie selbst etwas versuchen — die richtige Antwort hängt von der Oberfläche ab, und eine matte, von Hand geriebene Fläche darf nie wie eine glänzende behandelt werden.",
        ],
        categoryLabel: "Pflege",
        tags: ["Pflege", "Lack"],
        imageAlt:
          "Eine Hand wischt eine polierte Lackfläche mit einem weichen, trockenen Tuch ab",
      },
      {
        title: "Zusammenarbeit mit Einkäufern bei Sonderanfertigungen",
        excerpt:
          "Wie eine Sonderanfertigung wirklich von der ersten Zeichnung zum freigegebenen Muster kommt – und was Sie uns schicken sollten, damit die erste Runde zählt.",
        paragraphs: [
          "Das meiste, was die Werkstatt verlässt, entsteht nach der Spezifikation eines Einkäufers und nicht aus einem Katalog. Der erste Austausch wiegt deshalb schwerer als jeder spätere. Je konkreter diese erste Nachricht ist, desto weniger Runden braucht es: eine Zeichnung oder ein Foto, welche Maße feststehen und welche beweglich sind, an welche Stückzahlen Sie denken und zu welchem Datum die Ware wo sein muss.",
          "Form und Oberfläche werden getrennt geklärt, und in dieser Reihenfolge. Über eine Form lässt sich anhand einer Skizze sprechen; über eine Oberfläche lässt sich am Bildschirm überhaupt nicht sprechen. Monitore sind sich über Farbe nicht einig, und keiner von ihnen zeigt, was eine polierte Lackfläche tut, wenn sich der Blickwinkel ändert. Farbe und Oberfläche werden am physischen Muster abgeglichen, in der Hand – und das ist die einzige Freigabe, auf die sich beide Seiten stützen sollten.",
          "Die Lieferzeit bestimmen die Schichten, nicht die Stückzahl. Ein Stück muss viele Male beschichtet, ausgehärtet und zurückgeschliffen werden, und das Aushärten lässt sich nicht durch mehr Personal verkürzen. Deshalb können ein mattes und ein spiegelpoliertes Stück gleicher Abmessung sehr unterschiedliche Termine haben – und deshalb lohnt es sich, die Oberfläche früh zu entscheiden.",
          "Dann folgt die Bemusterung: Wir fertigen das Stück, Sie prüfen es gegen Ihre Vorgabe, und wir einigen uns auf die Änderungen. Manche Anmerkungen lassen sich leicht aufnehmen — eine Farbtiefe, ein Randprofil, ein Innenmaß. Manche laufen auf eine neue Form hinaus, und es ist für alle besser, das vor der Musterfertigung zu wissen.",
          "Verpackung, Kennzeichnung und Versand werden im Angebot besprochen und nicht vorausgesetzt. Schicken Sie uns Ihre Anfrage mit so viel vom Obigen, wie Sie haben, und wir antworten mit einem Angebot und einer ehrlichen Einschätzung des Terminplans.",
        ],
        categoryLabel: "Sonderanfertigungen",
        tags: ["Sonderanfertigungen", "Für Einkäufer"],
        imageAlt:
          "Eine technische Zeichnung und eine Reihe Lack-Oberflächenmuster nebeneinander auf einer Werkbank",
      },
      {
        title: "In der Werkstatt in Long Biên",
        excerpt:
          "Unsere Fabrik liegt in der 212 Nguyễn Sơn in Long Biên, Hanoi. Das ist der Weg, den ein Auftrag dort nimmt.",
        paragraphs: [
          "Die Fabrik von Red Door Vietnam liegt in der 212 Nguyễn Sơn in Long Biên, Hanoi; das Büro befindet sich jenseits des Flusses in Tây Hồ, das Lager draußen an der Quốc lộ 5 in Bần, Provinz Hưng Yên. Eine Lackwerkstatt ist um eine Bedingung herum organisiert, die alle anderen überwiegt, und die sei klar benannt: Schichten müssen aushärten, Aushärten braucht Zeit und Feuchtigkeit, und nichts danach kann früher beginnen.",
          "Die Arbeit läuft deshalb in Etappen statt entlang einer Linie. Formen kommen an oder werden gefertigt und dann vorbereitet — grundiert, plangeschliffen, auf Bewegung geprüft —, bevor ihnen Farbe anvertraut wird. Diese Vorbereitung ist unspektakulär und entscheidet, wie gut das fertige Stück überhaupt werden kann.",
          "Beschichten und Aushärten beanspruchen den meisten Raum und die meiste Geduld. Eine Schicht kommt dünn auf, das Stück geht in die Feuchtigkeit und kommt zurück, um vor der nächsten Lage nass zurückgeschliffen zu werden. Stücke laufen viele Male durch diesen Zyklus, weshalb eine Lackwerkstatt stets weit mehr angefangene als fertige Arbeit vorhält.",
          "Einlegearbeit findet, wo ein Stück sie verlangt, innerhalb dieses Zyklus statt und nicht danach: Perlmutt oder Blatt wird in eine weiche Schicht gesetzt, von den folgenden Lagen zugedeckt und später an der Schleifbank von Hand wieder hervorgeholt. Das Polieren ist das letzte Urteil — wie weit eine Fläche geführt wird, entscheidet sich Stück für Stück und nicht an einer Maschine.",
          "Dann Prüfung und Verpackung: Das Stück hört auf, ein Werkstattobjekt zu sein, und wird zur Sendung. Einkäufer sind zu einem Besuch herzlich willkommen; gerade die Aushärtungsstufe zu sehen erklärt einen Terminplan meist besser als jede E-Mail.",
        ],
        categoryLabel: "Werkstatt",
        tags: ["Werkstatt", "Hanoi"],
        imageAlt:
          "Angefangene Arbeiten auf Werkstattregalen, die auf die nächste Lackschicht warten",
      },
    ],
  },
  ja: {
    assetReplacementHint:
      "最終的な写真はまだ届いていません。承認済みの画像をこのアセットキーの名前で保存し、Cloudinary の publicId をここに設定してください。",
    author: "Red Door Vietnam",
    articles: [
      {
        title: "2026年コレクションのカタログ",
        excerpt:
          "2026年コレクションは、現行の品目を一冊のカタログにまとめたものです。フリップブックでご覧いただけるほか、ご請求も承っております。",
        paragraphs: [
          "2026年コレクションは、当社の現行カタログです。いま実際につくっている品目——トレー、鉢とテーブルウェア、花器、箱、ウォールパネル、編み製品、小家具——を一冊にまとめ、バイヤーの方が個別の写真の束としてではなく、ひと続きの品ぞろえとしてご覧いただけるようにしています。",
          "構成は、当社が卓上に品物を並べるときと同じ考え方です。社内の型番ではなく、かたちの用途と表面の仕上げによって並べています。艶あり、艶消し、加飾の仕上げをあえて隣り合わせに載せているのは、多くのバイヤーの方がもっとも長く迷われるのが、その選択だからです。",
          "価格は掲載しておりません。当社の品はほぼすべて、仕様——寸法、仕上げ、数量、梱包——に沿ってお見積もりいたしますので、印刷された価格はほとんどの方にとって正しくありません。ご希望の内容を添えてお問い合わせいただければ、それに沿ってお見積もりいたします。",
          "カタログはご請求いただけます。フリップブックとしてもお読みいただけます。冊子をご希望の方、あるいは特定の仕上げの見本を並べてご覧になりたい方は、お申し付けください。",
        ],
        categoryLabel: "コレクション",
        tags: ["2026年コレクション", "カタログ"],
        imageAlt:
          "テーブルの上でいくつかの漆器の隣に開かれた2026年コレクションのカタログ",
      },
      {
        title: "アンビエンテ・フランクフルトへの出展について",
        excerpt:
          "フランクフルトの見本市への出展歴と、扱う品が漆であるとき、見本市での出会いが本当に果たす役割について。",
        paragraphs: [
          "Red Door Vietnam は、フランクフルトのアンビエンテに2016年、2018年、2019年、2020年、2024年、2025年に出展してまいりました。何度も戻ってくる見本市であり、漆の工房にとってその理由は単純です。漆は、写真で判断されることに耐えられないからです。",
          "磨き上げた漆の面は、奥行きそのものです。層を重ねて成り立っており、光をどう扱うかは、立つ角度、光の色、見る距離によって変わります。画面はそのすべてを、ひとつの反射のハイライトに押し潰してしまいます。モニターでしか当社の品をご覧になっていないバイヤーの方は、手に取ってから一分もしないうちに仕様を変えられることが多くあります。多くは仕上げについて、ときに色について、まれにかたちそのものについてです。",
          "ですから当社のブースは、陳列棚というより見本の卓に近いものです。アンビエンテでもっとも実りのあるやり取りは、同じ色で仕上げの違う二点を手に取り、手の中でどちらが自分の取り扱いにふさわしいかを決めていただく場面です。寸法も数量も梱包も、その決定のあとに続くもので、いずれも後日メールで詰められます。直接お会いして決めるほかないのは、面のことだけです。",
          "次回以降の会期でお会いする予定がございましたら、事前にご一報ください。どの品目を卓上でご覧になりたいか——トレー、箱、パネル、編み製品——を先にお知らせいただければ、一般的な取り合わせではなく、ご希望の仕上げをそろえてお持ちできます。",
        ],
        categoryLabel: "見本市",
        tags: ["アンビエンテ・フランクフルト", "見本市"],
        imageAlt: "均一な照明の下、見本市の見本卓に並べられた漆器",
      },
      {
        title: "ソンマイの面は、どのように積み上げられるのか",
        excerpt:
          "ベトナムの漆は、最後に塗る上塗りではありません。器の外側そのものであり、何度も積み上げては研ぎ落として成り立っています。",
        paragraphs: [
          "ソンマイについてまず知っていただきたいのは、これが伝統ゆえではなく物理ゆえに遅い仕事だということです。漆は塗料のようには乾きません。硬化します。空気中の水分を必要とする化学反応です。だからこそ塗り上がったばかりの品は、灯りの下ではなく湿度のある室に置かれますし、熱はむしろ事態を悪くします。",
          "仕事は面の下から始まります。無垢であれ編みであれ、素地を固めて面を出し、あとから重ねる層の下で動かないようにします。この段階で残った不陸は埋まりません。むしろ増幅されます。あとに来る層は、すべてその下のかたちをなぞるからです。",
          "そこから繰り返しが始まります。薄く一層引き、硬化させ、水と研磨材で、いま引いた分の大半を落とす。薄い層は均一に硬化しますが、厚い層は表面だけ皮を張り、内側は柔らかいままです。水研ぎは粉塵を抑え、面が手の下で平らになっていく感触を作り手に伝えます。きちんとした品は、この繰り返しを何度もくぐります。",
          "加飾は層の上ではなく、層の中に納めます。卵殻は柔らかい層に押し込み、細かな模様に割れるまで押さえます。貝や金属箔も同じように伏せます。そのあとすべてはさらなる層に埋もれ、研ぎによって再び現れます。ここが多くの方の意外に思われるところです。絵は最後に描かれるのではなく、塗膜の内側から現れてくるのです。",
          "最後の磨きが、平たい色を深い色に変えます。光が層に入り、散り、戻ってくる。だから面は、その品が実際にある位置よりわずかに下にあるかのような色を保ちます。漆器が数週間の手間に見合う理由であり、最後の工程を急げない理由でもあります。",
        ],
        categoryLabel: "手仕事",
        tags: ["ソンマイ", "手仕事"],
        imageAlt: "水研ぎの最中の漆器が置かれた作業台。表面を水が流れています",
      },
      {
        title: "漆器のお手入れについて",
        excerpt:
          "漆が好むもの、苦手なもの、そして磨き上がった面を梱包時のまま保つための、短い習慣の一覧です。",
        paragraphs: [
          "漆器は、見た目より丈夫で、手ざわりの印象ほどは丈夫ではありません。塗膜は硬く、日常の接触であれば水にも耐えますが、自然の素地に自然の膜を乗せたものであり、そのどちらも熱と湿度で動きます。不具合のほとんどは三つのいずれかから起こります。たまった水、長く続く熱、そして研磨剤です。",
          "日々のお手入れは、柔らかい乾いた布で十分です。落ちにくい痕には、水で固く絞った布を使い、すぐに拭き上げてください。それ以上は必要ありませんし、たいていのものは害になります。研磨剤入りのスポンジ、クレンザー、食器洗い機、溶剤スプレー、汎用の家具用ワックスは、いずれも磨いた漆の面を曇らせます。一度で取り返しがつかないものもあります。",
          "漆器を水に浸けたままにせず、水の中に立てたままにもしないでください。水気や油気の多い料理は面に直接ではなく受け皿の上に盛り、火からおろしたばかりのものと漆のあいだには必ず何かをはさんでください。鍋敷きやコースターはここでは神経質さではありません。熱い底が直に触れることこそ、消えない輪染みを残す一番の近道です。",
          "どこに置くかは、どう拭くかと同じくらい大切です。直射日光、暖房器具、エアコンの吹き出し口から離し、湿気と乾燥が大きく振れる部屋も避けてください。浴室と日の当たる窓辺は、二大最悪の置き場所です。平物は裸で重ねず、あいだに柔らかいものをはさんで保管し、家具は引きずらず持ち上げてください。",
          "年月や使用で面が曇ってしまっても、それで終わりではありません。漆は厚い膜ですから、失われた艶は手で戻せることが少なくありません。ご自身で何かを試される前に、まずご相談ください。正しい手当ては仕上げによって変わりますし、艶消しの手擦り仕上げを艶ありと同じように扱ってはいけません。",
        ],
        categoryLabel: "お手入れ",
        tags: ["お手入れ", "漆"],
        imageAlt: "柔らかい乾いた布で磨かれた漆の面を拭く手元",
      },
      {
        title: "特注のご依頼をいただくときの進め方",
        excerpt:
          "特注の漆器が、最初の図面から承認見本までどう進むのか。そして最初のやり取りを実りあるものにするために、何をお送りいただきたいか。",
        paragraphs: [
          "工房から出てゆく品の多くは、カタログから選ばれたものではなく、お客さまの仕様に沿ってつくられたものです。ですから最初のやり取りが、その後のどのやり取りよりも重要になります。最初のご連絡が具体的であるほど、往復の回数は減ります。図面か写真、動かせない寸法と動かせる寸法、お考えの数量、そして品物がいつどこにあるべきか。",
          "かたちと仕上げは分けて、この順で決めます。かたちはスケッチからでも相談できますが、仕上げは画面越しにはまったく相談できません。モニターは色について互いに一致しませんし、見る角度が変わったときに磨いた漆の面がどうふるまうかは、どのモニターにも映せません。色と仕上げは実物の見本を手にして突き合わせます。双方が拠るべき承認は、それだけです。",
          "納期を決めるのは層の数であって、数量ではありません。品は何度も塗り、硬化させ、研ぎ落とさなければならず、硬化の時間は人を増やしても短くなりません。だからこそ、同じ寸法でも艶消しと鏡面磨きでは日程がかなり変わりますし、仕上げは早めに決めていただく価値があります。",
          "次に見本づくりです。当社が品をつくり、お客さまがご依頼内容と照らして評価され、変更点を取り決めます。取り込みやすいご指摘もあります。色の深さ、縁の形、内寸などです。一方で、実質的に別のかたちになるご指摘もあります。見本に取りかかる前に、どちらであるかをはっきりさせておくほうが双方のためになります。",
          "梱包、荷印、輸送は、当然のこととせず、お見積もりの段階で必ず話し合います。以上のうち、お手元にある範囲で結構ですので添えてお問い合わせください。お見積もりと、日程についての率直な見通しをお返しいたします。",
        ],
        categoryLabel: "特注",
        tags: ["特注", "バイヤーの方へ"],
        imageAlt: "作業台に並べられた技術図面と漆の仕上げ見本",
      },
      {
        title: "ロンビエンの工房から",
        excerpt:
          "当社の工場はハノイ市ロンビエン区、グエン・ソン通り212番地にあります。ご注文がその中をどう進んでいくのかをご紹介します。",
        paragraphs: [
          "Red Door Vietnam の工場は、ハノイ市ロンビエン区グエン・ソン通り212番地にあります。事務所は川を挟んだタイホー区に、倉庫はフンイエン省バン町の国道5号沿いにございます。漆の工房は、ほかの何よりも優先される一つの制約を中心に組み立てられています。その制約をはっきり申し上げます。層は硬化しなければならず、硬化には時間と湿度が要り、その先の工程はどれも前倒しできません。",
          "ですから仕事は一本の流れ作業ではなく、段階を追って進みます。素地は仕入れるか、あるいは工房で仕立て、そのうえで下ごしらえをします。固め、面を出し、動きがないかを確かめる。色を託すのはそのあとです。この下ごしらえは地味な工程ですが、仕上がりの上限を決めてしまうのはここです。",
          "塗りと硬化が、もっとも場所と忍耐を要します。薄く一層引き、湿度のある場所へ入れ、出してきたら次の層の前に水で研ぐ。品はこの繰り返しを何度も行き来しますから、漆の工房にはいつでも、仕上がった品よりはるかに多くの仕掛かり品があります。",
          "加飾が必要な品では、その工程はこの繰り返しのあとではなく、中で行われます。貝や箔を柔らかい層に伏せ、あとの層に埋め、のちに研ぎ台で手作業により呼び戻します。磨きは最後の判断です。どこまで面を追い込むかは一点ごとに決めることであり、機械が決めることではありません。",
          "そして検品と梱包を経て、品は工房のものであることをやめ、一つの出荷品になります。ご来訪は歓迎しております。とりわけ硬化の工程をご覧いただくと、日程についてはどんなメールよりもよくご理解いただけるようです。",
        ],
        categoryLabel: "工房",
        tags: ["工房", "ハノイ"],
        imageAlt: "次の塗りを待って工房の棚に並ぶ仕掛かり品",
      },
    ],
  },
  "zh-CN": {
    assetReplacementHint:
      "最终照片尚未提供。请以此资产键名保存经批准的图片，并在此填入其 Cloudinary publicId。",
    author: "Red Door Vietnam",
    articles: [
      {
        title: "2026 系列图录",
        excerpt:
          "2026 系列把当下的各个品类汇成一本图录，可作翻页书阅读，也可按需索取。",
        paragraphs: [
          "2026 系列是我们的现行图录。它把我们正在制作的品类——托盘、钵与餐桌器物、花器、盒具、壁板、编织器物与小型家具——收在一处，让采购方看到的是一条完整的产品线，而不是一叠彼此无关的照片。",
          "它的编排方式，就是我们把器物摆上桌时的方式：按器形的用途和表面的饰面来分，而不是按内部编号。亮面、哑光与镶嵌被有意并排呈现，因为在它们之间做取舍，是大多数采购方耗时最久的一个决定。",
          "图录中不印价格。我们做的东西几乎都要按具体规格报价——尺寸、饰面、数量与包装——所以一个印好的价格对多数读者来说都是错的。请把您的设想发来，我们会据此报价。",
          "图录可按需索取，也可以翻页书形式阅读。若您想要一册，或想同时看到某一种饰面的实样，请告诉我们。",
        ],
        categoryLabel: "系列",
        tags: ["2026 系列", "图录"],
        imageAlt: "摊开的 2026 系列图录，旁边摆着几件漆器",
      },
      {
        title: "Red Door Vietnam 与法兰克福 Ambiente 展",
        excerpt:
          "我们在法兰克福展会的参展记录，以及当产品是漆器时，一次展会见面究竟解决了什么问题。",
        paragraphs: [
          "Red Door Vietnam 曾于 2016、2018、2019、2020、2024 与 2025 年参加法兰克福 Ambiente 展。这是我们一再回去的展会，而对一家漆器工坊来说，理由很直接：漆器经不起靠照片来判断。",
          "抛光的漆面是一种深度效果。它由层叠积成，它如何处理光线，取决于你站的角度、光的颜色以及你与它的距离。屏幕把这一切压成了一处高光。只在显示器上见过我们作品的采购方，往往在上手不到一分钟就会改变要求——多半是关于饰面，有时是颜色，偶尔是整个器形。",
          "所以我们的展位与其说是陈列，不如说是一张样品台。Ambiente 上真正有用的对话，是采购方拿起同色而饰面不同的两件，在手上判断哪一件属于自己的产品线。尺寸、数量与包装都跟在这个决定之后，而且事后用邮件都很好谈。必须当面完成的，只有关于表面的那个决定。",
          "如果您打算在往后的展期与我们见面，请提前来信。事先告知您希望在桌上看到哪些品类——托盘、盒具、壁板、编织器物——我们就能带上对应的饰面，而不是一份笼统的选样。",
        ],
        categoryLabel: "展会",
        tags: ["法兰克福 Ambiente", "展会"],
        imageAlt: "均匀光线下，展会样品台上排列的漆器",
      },
      {
        title: "一层一层：漆面是怎样长出来的",
        excerpt:
          "越南大漆不是最后刷上去的一道涂层，而是器物整个外身，被反复堆起来又反复磨回去。",
        paragraphs: [
          "关于大漆，首先要明白的是：它慢，是物理决定的，不是传统决定的。漆不像油漆那样“干”。它是固化——一种需要空气中水分参与的化学反应。所以刚做完的活计要放进潮湿的荫房，而不是放在灯下；也所以加热只会把事情弄糟，不会让它变快。",
          "工序从表面之下开始。不论是实心胎还是编织胎，都要先封固、找平，好让它在后续层叠之下不再变动。这一步留下的任何不平，都不会被埋掉，只会被放大，因为之后的每一层都会顺着它下面的形状走。",
          "然后循环开始：薄薄髹上一道，等它固化，再用水和磨料把刚上去的大半磨掉。薄层固化均匀；厚层表面结皮，里头还是软的。水磨能压住粉尘，也让匠人从手底下感觉到面在一点点变平。一件认真做的器物，要经历这个循环很多遍。",
          "装饰是嵌进层里的，不是贴在层上的。蛋壳按进尚软的漆层，压到自然碎成细密的纹样；贝壳与金属箔也是同样的做法。随后一切被后续的漆层埋掉，再靠打磨重新带回来。这一点常常出乎人的意料：图像不是最后画上去的，而是从漆膜内部揭出来的。",
          "最后一道抛光，才把平的颜色变成深的颜色。光进入层中，散开，再返回，于是表面留住了一种仿佛略低于器物本身所在位置的颜色。这就是漆器值得那几个星期的原因，也是最后一步急不得的原因。",
        ],
        categoryLabel: "工艺",
        tags: ["大漆", "工艺"],
        imageAlt: "工作台上正在水磨的漆器，水正从表面流过",
      },
      {
        title: "漆器的日常养护",
        excerpt:
          "漆喜欢什么、忌讳什么，以及一份很短的习惯清单，足以让抛光的表面保持出厂时的样子。",
        paragraphs: [
          "漆器比看上去结实，又比手感上觉得的脆弱。漆膜坚硬，日常接触也不怕水，但它终究是自然的膜覆在自然的胎上，两者都会随温度与湿度而动。器物出问题，几乎都出在三件事上：积水、长时间受热，或者磨料。",
          "日常清洁，一块柔软干布就够了。遇到擦不掉的痕迹，用略带水汽的布轻擦，随后立即擦干。除此之外不需要别的，而大多数别的东西都是有害的：百洁布、去污膏、洗碗机、溶剂喷剂和通用家具蜡都会让抛光的漆面变哑，其中有些一次就是永久性的。",
          "不要浸泡漆器，也不要让它长时间站在水里。带水或带油的食物请盛在衬垫上，而不是直接放在漆面上；漆面与任何刚离火的东西之间，务必隔一层。这里的隔热垫和杯垫不是讲究，而是必要——滚烫的底直接接触，是留下永久圆印最快的办法。",
          "器物放在哪里，与怎么清洁同样重要。请让漆器远离阳光直射、暖气与空调出风口，也远离忽湿忽干的房间。浴室和日晒的窗台是两个最糟的去处。平板类器物请垫上软衬再叠放，不要直接裸叠；家具请抬起搬动，不要拖拽。",
          "如果表面确实随岁月或使用而变哑，事情也还没到头。漆是一层厚膜，失去的光泽往往可以靠手工重新做回来。在您自己动手尝试之前，请先问我们——正确的做法取决于饰面，而哑光手擦的表面，绝不能按亮面的方式处理。",
        ],
        categoryLabel: "养护",
        tags: ["养护", "漆器"],
        imageAlt: "一只手用柔软干布擦拭抛光的漆面",
      },
      {
        title: "与采购方一起做定制订单",
        excerpt:
          "一张定制漆器订单，实际上是怎样从第一张图走到确认样的；以及您该发来什么，才能让第一轮不白费。",
        paragraphs: [
          "工坊出去的东西，大多是按采购方的规格做的，而不是从册子上挑的，所以第一次沟通比之后任何一次都重要。第一封信越具体，来回的次数就越少：一张图或一张照片，哪些尺寸是定死的、哪些还能调整，您考虑的数量，以及货物需要在什么时间到什么地方。",
          "器形与饰面分开定，而且按这个顺序。器形可以对着草图讨论；饰面则完全没法隔着屏幕讨论。显示器彼此之间对颜色都无法达成一致，而且没有一台能呈现抛光漆面在视角变化时的表现。颜色与饰面要对着实物样、拿在手上比对——这也是双方唯一应当依据的确认方式。",
          "交期由层数决定，不由数量决定。一件器物要反复髹涂、固化、研磨，而固化这一段并不会因为加人手而变短。所以同样尺寸的哑光件与镜面抛光件，工期可能相差不小；这也是饰面值得早点定下来的原因。",
          "接下来是打样：我们把东西做出来，您对照当初的要求评估，双方商定修改。有些意见很容易吸收——颜色的深浅、边缘的形状、某个内部尺寸。有些则等于是一个新器形，在开样之前把两者分清楚，对双方都更好。",
          "包装、唛头与运输都放在报价阶段谈，而不是默认。请把以上信息中您手头已有的部分一并发来，我们会回复报价，并对工期给出一个诚实的判断。",
        ],
        categoryLabel: "定制",
        tags: ["定制订单", "写给采购方"],
        imageAlt: "工作台上并排摆放的技术图纸与一排漆器饰面样板",
      },
      {
        title: "走进龙编工坊",
        excerpt:
          "我们的工厂位于河内市龙编郡阮山路 212 号。以下是一张订单在其中走过的路线。",
        paragraphs: [
          "Red Door Vietnam 的工厂在河内市龙编郡阮山路 212 号；办公室在河对岸的西湖郡，仓库在兴安省瓶镇的 5 号国道旁。一间漆器工坊的布局，围绕着一个高于其他一切的约束，不妨把它说明白：漆层必须固化，固化需要时间与湿度，后面的任何工序都不可能提前开始。",
          "所以活计是分段推进的，而不是排成一条流水线。胎体或是购入，或是在坊内做成，随后要做前处理——封固、找平、检查是否变形——之后才谈得上上色。这一段前处理并不好看，却决定了成品最好能好到什么程度。",
          "髹涂与固化占去最多的场地，也最考验耐心。薄薄上一道，器物进入潮湿的环境，出来后先水磨，再上下一道。器物要在这个循环里进出很多次，所以漆器工坊里在制品永远远多于成品。",
          "需要镶嵌的器物，这道工序发生在循环之中而不是之后：贝壳或金属箔嵌入尚软的漆层，被后续的层埋掉，之后在磨台上由手工重新带出来。抛光是最后一次判断——一个面要做到什么程度，是一件一件决定的，不是由机器设定的。",
          "然后是检验与包装，器物不再是工坊里的物件，成了一批货。我们欢迎采购方预约来访；亲眼看过固化这一段，通常比任何邮件都更能说明工期。",
        ],
        categoryLabel: "工坊",
        tags: ["工坊", "河内"],
        imageAlt: "工坊货架上等待下一道漆的在制品",
      },
    ],
  },
} satisfies Record<Locale, NewsLocaleCopy>);

/** 16:9, the ratio the article hero and the listing card both reserve. */
const HERO_WIDTH = 1600;
const HERO_HEIGHT = 900;

function makeImage(
  articleId: string,
  alt: string,
  replacementHint: string,
): PublicNewsImage {
  return {
    assetKey: `${articleId}-hero`,
    // Never point at a stand-in file: a null src is what makes the layout
    // render a reserved slot rather than pass a placeholder off as reportage.
    src: null,
    alt,
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    assetPending: true,
    replacementHint,
  };
}

function makeArticles(locale: Locale): readonly PublicNewsArticle[] {
  const localeCopy = NEWS_COPY[locale];

  return deepFreeze(
    NEWS_BLUEPRINTS.map((blueprint, index) => {
      const copy = localeCopy.articles[index];

      if (!copy) {
        throw new Error(`Missing news copy for ${locale} at index ${index}.`);
      }

      return {
        id: blueprint.id,
        // The copy is approved company text, so it carries no DEMO marker.
        marker: null,
        isDemo: false,
        locale,
        slug: blueprint.slug,
        title: copy.title,
        excerpt: copy.excerpt,
        content: copy.paragraphs.map((text) => ({
          type: "paragraph" as const,
          text,
        })),
        categorySlug: blueprint.categorySlug,
        categoryLabel: copy.categoryLabel,
        tags: copy.tags,
        author: localeCopy.author,
        publishedAt: blueprint.publishedAt,
        image: makeImage(
          blueprint.id,
          copy.imageAlt,
          localeCopy.assetReplacementHint,
        ),
        featured: blueprint.featured,
        sortOrder: index + 1,
      } satisfies PublicNewsArticle;
    }),
  );
}

export const DEMO_NEWS_BY_LOCALE: Readonly<
  Record<Locale, readonly PublicNewsArticle[]>
> = deepFreeze({
  vi: makeArticles("vi"),
  en: makeArticles("en"),
  fr: makeArticles("fr"),
  de: makeArticles("de"),
  ja: makeArticles("ja"),
  "zh-CN": makeArticles("zh-CN"),
});

function applyListOptions(
  articles: readonly PublicNewsArticle[],
  options?: PublicNewsListOptions,
): readonly PublicNewsArticle[] {
  if (!options) {
    return articles;
  }

  let result = articles.filter((article) => {
    if (options.featuredOnly && !article.featured) {
      return false;
    }
    if (options.categorySlug && article.categorySlug !== options.categorySlug) {
      return false;
    }
    return true;
  });

  const offset = Math.max(0, Math.trunc(options.offset ?? 0));
  result = result.slice(offset);

  if (options.limit !== undefined) {
    const limit = Math.max(0, Math.trunc(options.limit));
    result = result.slice(0, limit);
  }

  return deepFreeze(result);
}

const demoNewsRepositoryImplementation: PublicNewsRepository = {
  async list(locale, options) {
    return applyListOptions(DEMO_NEWS_BY_LOCALE[locale], options);
  },
  async getById(locale, id) {
    return (
      DEMO_NEWS_BY_LOCALE[locale].find((article) => article.id === id) ?? null
    );
  },
  async getBySlug(locale, slug) {
    return (
      DEMO_NEWS_BY_LOCALE[locale].find((article) => article.slug === slug) ??
      null
    );
  },
};

export const demoNewsRepository: PublicNewsRepository = Object.freeze(
  demoNewsRepositoryImplementation,
);
