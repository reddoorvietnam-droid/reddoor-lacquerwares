/**
 * Seeds a showcase for the public site: a handful of published news articles
 * and a small set of items on sale in the shop. Photographs already shipped
 * with the site (under `public/`) are uploaded to Cloudinary so every page
 * renders the way it will once the company adds its own material.
 *
 * Everything here is placeholder editorial, not company copy. Articles carry
 * the `SEED-NEWS-` internal id prefix and shop items use the fixed slugs
 * listed below; that is how they are found again for removal:
 *
 *   npm run seed:showcase               insert (or top up) articles and items
 *   npm run seed:showcase -- --remove   delete them and their Cloudinary assets
 *   npm run seed:showcase -- --dry-run  print the plan, touch nothing
 *
 * Writes go through the same command services the portal uses, so every
 * article passes draft → review → publish and every shop item is created,
 * given images, then put on sale exactly as an editor would do it. A record
 * made here is editable and deletable from the admin portal like any other.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Types } from "mongoose";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import { categoryTag } from "@/domains/news/categories";
import { ArticleCommandService } from "@/domains/news/commands";
import { MongoArticleCommandStore } from "@/domains/news/commands/mongo-store";
import {
  getArticleModel,
  getArticleRevisionModel,
  getArticleTranslationModel,
} from "@/domains/news/persistence/models";
import { getShopItemModel } from "@/domains/shop/models";
import {
  MongoShopItemStore,
  MongoShopOrderStore,
} from "@/domains/shop/mongo-store";
import { ShopService } from "@/domains/shop/service";
import type { AccessContext } from "@/lib/auth/authorization";
import type { StructuredBlock } from "@/lib/content/contracts";
import { connectToDatabase } from "@/lib/db/mongoose";
import { getCloudinaryEnv } from "@/lib/env/server";
import {
  buildCloudinarySignature,
  CloudinaryMediaStorage,
} from "@/lib/media/cloudinary-storage";
import { getEntityImagesModel } from "@/lib/media/entity-images";

const ARTICLE_PREFIX = "SEED-NEWS-";
const SEED_ACTOR_ID = "000000000000000000000001";
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

type SeedLocale = "vi" | "en";
type Localized = Readonly<Record<SeedLocale, string>>;

/* ------------------------------------------------------------------ */
/* Articles                                                            */
/* ------------------------------------------------------------------ */

type SeedBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; style: "ordered" | "unordered"; items: readonly string[] }
  | { type: "quote"; text: string; attribution?: string }
  /** Rendered with the article's body photograph, if it has one. */
  | { type: "image"; alt: string; caption?: string }
  | { type: "callToAction"; label: string; href: string };

type SeedArticleText = {
  slug: string;
  title: string;
  summary: string;
  body: readonly SeedBlock[];
};

type SeedArticle = {
  internalId: string;
  /** One of the slugs in `src/domains/news/categories.ts`. */
  category: string;
  tags: readonly string[];
  cover: { file: string; alt: Localized };
  bodyImage: { file: string } | null;
  vi: SeedArticleText;
  en: SeedArticleText;
};

const SEED_ARTICLES: readonly SeedArticle[] = [
  {
    internalId: `${ARTICLE_PREFIX}01`,
    category: "xuong",
    tags: ["quy-trinh", "son-ta"],
    cover: {
      file: "lacquer-process/phu_son.jpg",
      alt: {
        vi: "Người thợ dùng thép quét lớp sơn đỏ lên vóc khay trong xưởng",
        en: "A craftsman spreading a coat of red lacquer over a tray form",
      },
    },
    bodyImage: { file: "lacquer-process/lam_voc.jpg" },
    vi: {
      slug: "mot-ngay-o-xuong-tu-voc-moc-den-lop-son-cuoi",
      title: "Một ngày ở xưởng: từ vóc mộc đến lớp sơn cuối",
      summary:
        "Theo chân một chiếc khay đi qua các bàn làm việc trong xưởng Red Door — từ cốt gỗ mộc, lớp hom vải, những lượt sơn và mài nước, đến buổi đánh bóng cuối cùng.",
      body: [
        {
          type: "paragraph",
          text: "Buổi sáng ở xưởng bắt đầu bằng việc kiểm tra độ ẩm. Sơn ta chỉ khô đúng cách khi không khí đủ ẩm, nên trước khi ai đó cầm bút, người phụ trách phòng ủ đã đi một vòng, mở hoặc đóng cửa và ghi lại con số trên ẩm kế.",
        },
        { type: "heading", text: "Vóc: nền của mọi thứ" },
        {
          type: "paragraph",
          text: "Chiếc khay đến bàn đầu tiên dưới dạng cốt gỗ mộc. Thợ làm vóc bọc một lớp vải mỏng lên cốt, quét hỗn hợp sơn sống trộn đất phù sa rồi để khô. Lớp hom này giữ cho gỗ không nứt theo mùa và cho bề mặt một độ dày đủ để mài sau này.",
        },
        {
          type: "image",
          alt: "Thợ làm vóc miết lớp hom lên cốt khay bọc vải",
          caption: "Lớp hom vải là phần không ai nhìn thấy nhưng quyết định tuổi thọ của món đồ.",
        },
        { type: "heading", text: "Sơn, chờ, mài — rồi lặp lại" },
        {
          type: "paragraph",
          text: "Mỗi lượt sơn được quét mỏng bằng thép hoặc chổi, cho vào phòng ủ từ một đến ba ngày, rồi đem ra mài nước bằng đá và giấy nhám mịn. Mài không phải để làm mỏng lớp sơn mà để tạo mặt phẳng tuyệt đối cho lớp kế tiếp bám vào. Một chiếc khay đơn giản đi qua vòng này chừng mười lần; đồ có trang trí dày hơn có thể gấp đôi.",
        },
        {
          type: "list",
          style: "unordered",
          items: [
            "Sơn lót: tạo nền, thường màu nâu cánh gián hoặc đen",
            "Sơn màu: son đỏ, vàng, hoặc màu pha theo mẫu",
            "Trang trí: vẽ vàng, cẩn vỏ trứng, dát bạc — tuỳ mẫu",
            "Sơn phủ: hai đến ba lớp trong để khoá bề mặt",
          ],
        },
        { type: "heading", text: "Đánh bóng bằng tay" },
        {
          type: "paragraph",
          text: "Buổi chiều là lúc yên tĩnh nhất. Người đánh bóng dùng lòng bàn tay, một chút bột than và tóc rối để chà từng vòng cho đến khi mặt sơn phản chiếu rõ khuôn mặt mình. Không có máy nào thay được bước này, vì lực và nhiệt của bàn tay là thứ làm lớp sơn lên nước.",
        },
        {
          type: "quote",
          text: "Sơn mài không vội được. Mình chỉ làm phần việc của mình rồi để thời gian làm phần còn lại.",
          attribution: "Một người thợ lâu năm của xưởng",
        },
        {
          type: "paragraph",
          text: "Chiếc khay rời xưởng khi đã qua kiểm tra dưới ánh sáng nghiêng — cách dễ nhất để thấy một vết xước, một chỗ đục hay một hạt bụi kẹt dưới lớp phủ. Nếu có, nó quay lại bàn mài.",
        },
      ],
    },
    en: {
      slug: "a-day-in-the-workshop-from-bare-form-to-final-coat",
      title: "A day in the workshop: from bare form to final coat",
      summary:
        "Following one tray across the benches of the Red Door workshop — from raw wooden form, through cloth priming, coats and wet sanding, to the last hand polish.",
      body: [
        {
          type: "paragraph",
          text: "Mornings in the workshop begin with a humidity check. Natural lacquer only cures properly in moist air, so before anyone picks up a brush the person in charge of the curing room has already done a round, opened or closed the doors, and noted the reading on the hygrometer.",
        },
        { type: "heading", text: "The form: the ground under everything" },
        {
          type: "paragraph",
          text: "The tray reaches the first bench as a bare wooden form. The primer wraps a thin cloth over it, spreads a mix of raw lacquer and alluvial clay, and leaves it to dry. This priming layer keeps the wood from cracking with the seasons and gives the surface enough depth to be sanded later.",
        },
        {
          type: "image",
          alt: "A craftsman pressing the priming layer onto a cloth-wrapped tray form",
          caption: "The cloth priming is the layer nobody sees, and the one that decides how long the piece lasts.",
        },
        { type: "heading", text: "Coat, wait, sand — and again" },
        {
          type: "paragraph",
          text: "Each coat is spread thin with a spatula or brush, rested in the curing room for one to three days, then wet-sanded with stone and fine paper. Sanding is not there to thin the coat but to make a perfectly flat plane for the next one to grip. A plain tray goes around this loop about ten times; a heavily decorated piece can take twice that.",
        },
        {
          type: "list",
          style: "unordered",
          items: [
            "Base coats: build the ground, usually deep brown or black",
            "Colour coats: vermilion, gold, or a colour mixed to the sample",
            "Decoration: gold painting, eggshell inlay, silver leaf — depending on the design",
            "Top coats: two or three clear layers to seal the surface",
          ],
        },
        { type: "heading", text: "Polished by hand" },
        {
          type: "paragraph",
          text: "The afternoon is the quietest time. The polisher works with the palm of the hand, a little charcoal powder and a bundle of hair, rubbing in circles until the surface reflects their own face. No machine replaces this step; the pressure and warmth of the hand are what bring the lacquer to its depth.",
        },
        {
          type: "quote",
          text: "Lacquer cannot be hurried. I do my part and let time do the rest.",
          attribution: "A long-serving craftsman at the workshop",
        },
        {
          type: "paragraph",
          text: "The tray leaves the workshop once it has passed inspection under raking light — the easiest way to catch a scratch, a dull patch, or a speck of dust trapped under the top coat. If there is one, it goes back to the sanding bench.",
        },
      ],
    },
  },
  {
    internalId: `${ARTICLE_PREFIX}02`,
    category: "huong-dan",
    tags: ["bao-quan"],
    cover: {
      file: "about-us/Chuan_muc_quoc_te_03.jpg",
      alt: {
        vi: "Góc khay sơn mài đỏ với hoạ tiết hoa đào vàng, viền vàng mảnh",
        en: "Corner of a red lacquer tray with gold peach blossom and a fine gold rim",
      },
    },
    bodyImage: null,
    vi: {
      slug: "bao-quan-do-son-mai-trong-khi-hau-nong-am",
      title: "Bảo quản đồ sơn mài trong khí hậu nóng ẩm",
      summary:
        "Sơn ta bền hàng chục năm nếu được đối xử đúng cách. Vài nguyên tắc đơn giản về ánh sáng, nhiệt, nước và cách lau chùi giúp món đồ giữ được độ bóng ban đầu.",
      body: [
        {
          type: "paragraph",
          text: "Đồ sơn mài truyền thống được làm từ nhựa cây sơn, một vật liệu tự nhiên tiếp tục biến đổi sau khi khô: nó cứng thêm theo thời gian nhưng cũng phản ứng với ánh nắng và nhiệt độ. Hiểu điều này là đủ để biết cách chăm sóc.",
        },
        { type: "heading", text: "Ba thứ cần tránh" },
        {
          type: "list",
          style: "unordered",
          items: [
            "Nắng trực tiếp kéo dài: tia cực tím làm màu sơn bạc dần, nhất là sắc đỏ son",
            "Nguồn nhiệt gần: bếp, lò sưởi, nóc tủ lạnh — nhiệt làm cốt gỗ co giãn và có thể gây rạn",
            "Ngâm nước hoặc để đọng nước lâu: lớp sơn không thấm, nhưng mép và đáy thì có",
          ],
        },
        { type: "heading", text: "Lau chùi hằng ngày" },
        {
          type: "paragraph",
          text: "Dùng khăn cotton mềm, khô hoặc hơi ẩm. Lau theo một chiều, không xoay tròn mạnh tay. Không dùng nước rửa chén, cồn hay bất kỳ dung dịch tẩy nào — chúng làm mờ lớp phủ. Nếu có vết dầu mỡ, một chút nước ấm là đủ, rồi lau khô ngay.",
        },
        { type: "heading", text: "Khi lâu không dùng" },
        {
          type: "paragraph",
          text: "Cất ở nơi thoáng, tránh bọc kín trong ni lông vì hơi ẩm bị giữ lại có thể gây mốc trên mặt cốt gỗ. Nếu xếp chồng khay hay đĩa, lót một lớp vải mỏng giữa các món để không bị xước.",
        },
        { type: "heading", text: "Nếu mặt sơn bị mờ" },
        {
          type: "paragraph",
          text: "Đồ sơn mài mờ đi sau nhiều năm là bình thường và có thể đánh bóng lại. Bạn có thể mang về xưởng; chúng tôi phục hồi được hầu hết các món do Red Door làm ra, kể cả những chiếc đã dùng lâu năm.",
        },
        {
          type: "quote",
          text: "Đồ sơn mài càng dùng càng đẹp. Đừng cất kỹ quá.",
        },
      ],
    },
    en: {
      slug: "caring-for-lacquerware-in-a-hot-humid-climate",
      title: "Caring for lacquerware in a hot, humid climate",
      summary:
        "Natural lacquer lasts for decades when treated well. A few simple rules about light, heat, water and cleaning keep a piece looking the way it did the day it left the workshop.",
      body: [
        {
          type: "paragraph",
          text: "Traditional lacquerware is made from the sap of the lacquer tree, a natural material that keeps changing after it has dried: it hardens further with age, but it also responds to sunlight and temperature. Knowing that much is enough to look after it.",
        },
        { type: "heading", text: "Three things to avoid" },
        {
          type: "list",
          style: "unordered",
          items: [
            "Prolonged direct sun: ultraviolet light fades the colour, vermilion most of all",
            "Nearby heat: stoves, radiators, the top of a refrigerator — heat makes the wooden core move and can cause cracking",
            "Soaking or standing water: the lacquer itself is waterproof, but edges and bases are not",
          ],
        },
        { type: "heading", text: "Everyday cleaning" },
        {
          type: "paragraph",
          text: "Use a soft cotton cloth, dry or barely damp. Wipe in one direction rather than scrubbing in circles. No dish soap, alcohol or any cleaning solution — they dull the top coat. For grease, a little warm water is enough; dry at once.",
        },
        { type: "heading", text: "When a piece is put away" },
        {
          type: "paragraph",
          text: "Store it somewhere ventilated, and avoid sealing it in plastic: trapped moisture can raise mould on the wooden core. If trays or plates are stacked, put a thin cloth between them so they do not scratch each other.",
        },
        { type: "heading", text: "If the surface goes dull" },
        {
          type: "paragraph",
          text: "Lacquer dulling after years of use is normal, and it can be re-polished. Bring the piece back to the workshop; we can restore almost anything Red Door has made, including pieces that have been in daily use for a long time.",
        },
        {
          type: "quote",
          text: "Lacquerware gets more beautiful with use. Do not keep it too safe.",
        },
      ],
    },
  },
  {
    internalId: `${ARTICLE_PREFIX}03`,
    category: "tin-tuc",
    tags: ["cua-hang"],
    cover: {
      file: "about-us/red_door.jpg",
      alt: {
        vi: "Cửa gỗ đỏ của xưởng Red Door mở vào gian trưng bày",
        en: "The red wooden doors of the Red Door workshop opening onto the showroom",
      },
    },
    bodyImage: { file: "hinh_nen_rd1.jpg" },
    vi: {
      slug: "cua-hang-truc-tuyen-cua-red-door-chinh-thuc-mo",
      title: "Cửa hàng trực tuyến của Red Door chính thức mở",
      summary:
        "Từ nay bạn có thể đặt mua trực tiếp những món sơn mài có sẵn tại xưởng qua mục Cửa hàng trên trang web, không cần qua bước báo giá.",
      body: [
        {
          type: "paragraph",
          text: "Nhiều năm qua, phần lớn đơn hàng của Red Door là đơn sản xuất theo yêu cầu cho đối tác trong và ngoài nước. Nhưng luôn có những món làm ra trong lúc thử mẫu, hoặc làm dư một lượng nhỏ, được khách ghé xưởng hỏi mua. Mục Cửa hàng ra đời để những món ấy đến được với nhiều người hơn.",
        },
        { type: "heading", text: "Cửa hàng bán gì" },
        {
          type: "paragraph",
          text: "Đó là những sản phẩm có sẵn, đã hoàn thiện và được kiểm tra: khay, hộp, bình hoa, đĩa và một vài món nhỏ cho bàn ăn. Số lượng mỗi mẫu không nhiều; khi hết, mẫu sẽ tạm ẩn cho đến khi lô sau xong.",
        },
        {
          type: "image",
          alt: "Bộ khay, hộp, bình hoa và lót ly sơn mài đỏ bày trên bàn",
          caption: "Một phần những món đang có sẵn tại xưởng.",
        },
        { type: "heading", text: "Đặt hàng như thế nào" },
        {
          type: "list",
          style: "ordered",
          items: [
            "Chọn món, số lượng, và điền thông tin nhận hàng",
            "Chúng tôi xác nhận đơn qua điện thoại hoặc email trong ngày làm việc",
            "Phí vận chuyển được báo khi xác nhận, tuỳ địa chỉ và kích thước gói",
            "Thanh toán sau khi xác nhận; hàng được đóng gói bằng vật liệu chống sốc và giao trong vài ngày",
          ],
        },
        {
          type: "paragraph",
          text: "Với đơn hàng số lượng lớn, mẫu riêng, hoặc xuất khẩu, mục Yêu cầu báo giá vẫn là con đường phù hợp hơn.",
        },
        { type: "callToAction", label: "Ghé Cửa hàng", href: "/vi/shop" },
      ],
    },
    en: {
      slug: "the-red-door-online-shop-is-open",
      title: "The Red Door online shop is open",
      summary:
        "You can now order lacquerware that is finished and in stock at the workshop directly from the Shop section of the site, without going through a quotation.",
      body: [
        {
          type: "paragraph",
          text: "For years most of Red Door's work has been made to order for partners at home and abroad. But there have always been pieces made while trying out a design, or a few left over from a batch, that visitors to the workshop asked to buy. The Shop exists so those pieces can reach more people.",
        },
        { type: "heading", text: "What the shop sells" },
        {
          type: "paragraph",
          text: "Finished, inspected pieces that are in stock: trays, boxes, vases, plates and a few small things for the table. Quantities are small; when a design sells out it is hidden until the next batch is done.",
        },
        {
          type: "image",
          alt: "A set of red lacquer trays, boxes, a vase and coasters arranged on a table",
          caption: "Some of the pieces currently in stock at the workshop.",
        },
        { type: "heading", text: "How ordering works" },
        {
          type: "list",
          style: "ordered",
          items: [
            "Choose a piece and a quantity, and fill in your delivery details",
            "We confirm the order by phone or email within the working day",
            "Shipping is quoted at confirmation, depending on the address and the size of the parcel",
            "Payment follows confirmation; the piece is packed in shock-absorbing material and shipped within a few days",
          ],
        },
        {
          type: "paragraph",
          text: "For larger quantities, custom designs or export orders, the Request a quote form remains the better route.",
        },
        { type: "callToAction", label: "Visit the shop", href: "/en/shop" },
      ],
    },
  },
  {
    internalId: `${ARTICLE_PREFIX}04`,
    category: "xuong",
    tags: ["son-ta", "phong-u"],
    cover: {
      file: "lacquer-process/danh_bong.jpg",
      alt: {
        vi: "Chổi quét lớp sơn đỏ cuối cùng lên mặt đĩa rắc vảy vàng",
        en: "A brush laying the final red coat over a plate scattered with gold flakes",
      },
    },
    bodyImage: { file: "lacquer-process/trang_tri.jpg" },
    vi: {
      slug: "vi-sao-moi-lop-son-phai-cho-kho-tu-nhien",
      title: "Vì sao mỗi lớp sơn phải chờ khô tự nhiên",
      summary:
        "Sơn ta không khô bằng cách bay hơi mà bằng phản ứng với hơi ẩm trong không khí. Đó là lý do xưởng có phòng ủ, và là lý do một món đồ mất nhiều tuần để hoàn thành.",
      body: [
        {
          type: "paragraph",
          text: "Người mới đến xưởng thường ngạc nhiên khi thấy đồ vừa sơn xong được cất vào một căn phòng kín, ẩm và tối. Với hầu hết các loại sơn, đó là cách nhanh nhất để hỏng việc. Với sơn ta thì ngược lại.",
        },
        { type: "heading", text: "Khô nhờ hơi ẩm" },
        {
          type: "paragraph",
          text: "Nhựa sơn chứa một loại men tự nhiên. Khi gặp oxy và độ ẩm cao, men này kích hoạt phản ứng khiến các phân tử liên kết lại thành một màng cứng. Không khí quá khô, phản ứng chậm hẳn; quá nóng, mặt sơn khô trước ruột và nhăn lại.",
        },
        {
          type: "image",
          alt: "Hai người thợ vẽ hoạ tiết vàng và dát vàng lên khay sơn mài đỏ",
          caption: "Lớp trang trí chỉ được làm khi lớp màu bên dưới đã khô hẳn.",
        },
        { type: "heading", text: "Phòng ủ" },
        {
          type: "paragraph",
          text: "Phòng ủ của xưởng là một gian nhỏ, tường quét vôi, nền đất giữ ẩm, có kệ gỗ nhiều tầng. Đồ được xếp vào theo ngày, ghi phấn lên mép kệ. Người phụ trách mỗi sáng kiểm tra ẩm kế và thêm nước xuống nền nếu cần.",
        },
        {
          type: "list",
          style: "unordered",
          items: [
            "Lớp lót: một đến hai ngày",
            "Lớp màu: hai đến ba ngày",
            "Lớp phủ và sau khi đánh bóng: có thể tới một tuần trước khi giao",
          ],
        },
        { type: "heading", text: "Vì sao không dùng máy sấy" },
        {
          type: "paragraph",
          text: "Có những cách rút ngắn thời gian, và chúng tôi từng thử. Kết quả là lớp sơn cứng nhanh nhưng giòn, dễ rạn ở góc sau vài mùa. Món đồ sơn mài đúng nghĩa phải bền vài chục năm, nên chúng tôi giữ cách làm chậm.",
        },
        {
          type: "quote",
          text: "Muốn nhanh thì làm loại sơn khác. Sơn ta thì phải chờ.",
          attribution: "Trưởng xưởng Red Door",
        },
      ],
    },
    en: {
      slug: "why-every-coat-of-lacquer-must-dry-on-its-own-time",
      title: "Why every coat of lacquer must dry on its own time",
      summary:
        "Natural lacquer does not dry by evaporation but by reacting with moisture in the air. That is why the workshop has a curing room, and why a single piece takes weeks to finish.",
      body: [
        {
          type: "paragraph",
          text: "Newcomers to the workshop are often surprised to see freshly coated pieces carried into a closed, damp, dark room. For almost any other finish that would be the quickest way to ruin the work. For natural lacquer it is the opposite.",
        },
        { type: "heading", text: "Cured by humidity" },
        {
          type: "paragraph",
          text: "The sap contains a natural enzyme. In the presence of oxygen and high humidity it sets off a reaction that links the molecules into a hard film. Air that is too dry slows the reaction right down; air that is too hot cures the surface before the body and leaves it wrinkled.",
        },
        {
          type: "image",
          alt: "Two craftspeople painting gold motifs and laying gold leaf on red lacquer trays",
          caption: "Decoration only begins once the colour coat beneath has fully cured.",
        },
        { type: "heading", text: "The curing room" },
        {
          type: "paragraph",
          text: "The workshop's curing room is a small chamber with limewashed walls, an earth floor that holds moisture, and tiers of wooden shelving. Pieces go in by date, chalked onto the shelf edge. Every morning someone checks the hygrometer and wets the floor if it needs it.",
        },
        {
          type: "list",
          style: "unordered",
          items: [
            "Base coats: one to two days",
            "Colour coats: two to three days",
            "Top coats and after polishing: up to a week before the piece ships",
          ],
        },
        { type: "heading", text: "Why not a drying cabinet" },
        {
          type: "paragraph",
          text: "There are ways to shorten the wait, and we have tried them. The result was lacquer that hardened fast but stayed brittle, and cracked at the corners after a few seasons. A proper piece of lacquerware should last for decades, so we keep to the slow way.",
        },
        {
          type: "quote",
          text: "If you want fast, use a different finish. Natural lacquer means waiting.",
          attribution: "Head of the Red Door workshop",
        },
      ],
    },
  },
  {
    internalId: `${ARTICLE_PREFIX}05`,
    category: "trien-lam",
    tags: ["hoi-cho", "xuat-khau"],
    cover: {
      file: "about-us/vuon_ra_the_gioi.jpg",
      alt: {
        vi: "Khay và hộp sơn mài đỏ trước bản đồ thế giới dát vàng, cạnh thùng hàng xuất khẩu",
        en: "Red lacquer trays and boxes in front of a gilded world map, next to export crates",
      },
    },
    bodyImage: { file: "about-us/bo_su_tap.jpg" },
    vi: {
      slug: "chuan-bi-mot-gian-hang-hoi-cho-nhung-gi-chung-toi-mang-theo",
      title: "Chuẩn bị một gian hàng hội chợ: những gì chúng tôi mang theo",
      summary:
        "Mỗi mùa hội chợ, xưởng dành vài tuần để chọn mẫu, đóng thùng và dựng gian hàng. Đây là cách chúng tôi làm để một chiếc khay sơn mài kể được câu chuyện của nó ở nơi xa.",
      body: [
        {
          type: "paragraph",
          text: "Một gian hàng hội chợ chỉ có vài mét vuông và khách chỉ dừng lại vài giây. Trong khoảng đó, món đồ phải tự nói được nó là gì, làm bằng gì, và vì sao lại đáng giá như thế. Chuẩn bị cho điều ấy bắt đầu từ trước ngày mở cửa khá lâu.",
        },
        { type: "heading", text: "Chọn mẫu" },
        {
          type: "paragraph",
          text: "Chúng tôi thường mang theo ba nhóm: những mẫu đang sản xuất ổn định cho đối tác, một vài mẫu mới của bộ sưu tập năm, và một số món chưa hoàn thiện — cốt mộc, vóc đã hom, mặt sơn mới mài — để khách nhìn thấy các lớp bên dưới lớp bóng.",
        },
        {
          type: "image",
          alt: "Tường trưng bày các mẫu bộ sưu tập theo năm cùng khay, hộp và bảng màu sơn",
          caption: "Bộ sưu tập theo năm là phần khách hỏi nhiều nhất ở mỗi gian hàng.",
        },
        { type: "heading", text: "Đóng gói" },
        {
          type: "list",
          style: "unordered",
          items: [
            "Mỗi món bọc giấy mềm rồi mút chống sốc, không dùng ni lông trực tiếp lên mặt sơn",
            "Thùng gỗ cho đồ lớn; thùng carton hai lớp cho đồ nhỏ, có nhãn mặt trên và dễ vỡ",
            "Một bộ dụng cụ nhỏ đi kèm: khăn, bột đánh bóng, keo, để xử lý xước nhẹ tại chỗ",
          ],
        },
        { type: "heading", text: "Tại gian hàng" },
        {
          type: "paragraph",
          text: "Ánh sáng là thứ quan trọng nhất. Đèn chiếu nghiêng làm mặt sơn sống dậy — thấy được chiều sâu của các lớp — trong khi đèn chiếu thẳng chỉ cho một mặt bóng phẳng. Chúng tôi luôn mang theo đèn riêng thay vì dựa vào ánh sáng của hội trường.",
        },
        {
          type: "paragraph",
          text: "Và luôn có một người thợ đi cùng. Khách hỏi về kỹ thuật thì người bán hàng trả lời được, nhưng khi một người thợ cầm miếng đá mài và làm thử ngay tại bàn, câu chuyện trở nên thật hơn bất cứ tờ giới thiệu nào.",
        },
      ],
    },
    en: {
      slug: "preparing-a-trade-fair-booth-what-we-bring",
      title: "Preparing a trade fair booth: what we bring",
      summary:
        "Every fair season the workshop spends a few weeks choosing samples, packing crates and building the stand. This is how we make sure a lacquer tray can tell its own story far from home.",
      body: [
        {
          type: "paragraph",
          text: "A fair booth is a few square metres, and a visitor stops for a few seconds. In that time the piece has to say what it is, what it is made of, and why it is worth what it costs. Preparing for that begins long before opening day.",
        },
        { type: "heading", text: "Choosing what to show" },
        {
          type: "paragraph",
          text: "We usually bring three groups: designs in steady production for partners, a few new pieces from the year's collection, and some unfinished work — bare forms, primed forms, freshly sanded surfaces — so visitors can see the layers under the shine.",
        },
        {
          type: "image",
          alt: "A display wall of yearly collection samples with trays, boxes and lacquer colour swatches",
          caption: "The yearly collection is what visitors ask about most at every stand.",
        },
        { type: "heading", text: "Packing" },
        {
          type: "list",
          style: "unordered",
          items: [
            "Each piece wrapped in soft paper and then foam; never plastic directly against the lacquer",
            "Wooden crates for large pieces; double-walled cartons for small ones, labelled this way up and fragile",
            "A small kit travels with them: cloths, polishing powder and glue, to deal with a light scratch on the spot",
          ],
        },
        { type: "heading", text: "On the stand" },
        {
          type: "paragraph",
          text: "Light matters most. Raking light brings the surface alive — the depth of the layers becomes visible — where light from straight ahead shows only a flat shine. We always bring our own lamps rather than rely on the hall's.",
        },
        {
          type: "paragraph",
          text: "And a craftsman always comes along. A salesperson can answer questions about technique, but when a craftsman picks up a sanding stone and shows it at the table, the story becomes more real than any brochure.",
        },
      ],
    },
  },
  {
    internalId: `${ARTICLE_PREFIX}06`,
    category: "huong-dan",
    tags: ["khay", "chon-mua"],
    cover: {
      file: "cau_chuyen.jpg",
      alt: {
        vi: "Đôi tay đánh bóng chiếc khay sơn mài đỏ vẽ hoa đào vàng",
        en: "Hands polishing a red lacquer tray painted with gold peach blossom",
      },
    },
    bodyImage: { file: "about-us/Cam_hung_tu_nhien_02.jpg" },
    vi: {
      slug: "chon-khay-son-mai-kich-thuoc-cot-go-va-hoan-thien",
      title: "Chọn khay sơn mài: kích thước, cốt gỗ và hoàn thiện",
      summary:
        "Khay là món sơn mài được mua nhiều nhất và cũng dễ chọn sai nhất. Vài câu hỏi trước khi mua giúp bạn tìm được chiếc khay dùng được hằng ngày thay vì chỉ để trưng.",
      body: [
        {
          type: "paragraph",
          text: "Một chiếc khay sơn mài tốt nằm ở ba thứ: kích thước hợp với việc bạn định dùng, cốt bên trong đủ ổn định, và lớp hoàn thiện phù hợp với mức độ sử dụng.",
        },
        { type: "heading", text: "Kích thước" },
        {
          type: "list",
          style: "unordered",
          items: [
            "Khay trà, 30–36 cm: vừa một bộ ấm bốn chén",
            "Khay bàn ăn, 40–50 cm: mang được hai bát canh và vài đĩa nhỏ",
            "Khay trang trí, 20–28 cm: đặt trên bàn phòng khách để chìa khoá, nến, đồ nhỏ",
          ],
        },
        {
          type: "paragraph",
          text: "Vành khay thấp nhìn đẹp hơn nhưng khó bưng khi có đồ nặng; vành cao hơn ba phân và có tay nắm là lựa chọn thực tế cho khay dùng bữa.",
        },
        {
          type: "image",
          alt: "Mặt sơn mài đỏ với bóng cành trúc và ánh kim sa lấp lánh",
          caption: "Bóng mờ giấu vết xước tốt hơn bóng gương và hợp với đồ dùng hằng ngày.",
        },
        { type: "heading", text: "Cốt bên trong" },
        {
          type: "paragraph",
          text: "Khay cốt gỗ tự nhiên như gỗ mít hay gỗ dổi là cách làm truyền thống, nhẹ và ấm tay, nhưng cần được hom kỹ để không cong theo mùa. Cốt gỗ ép ổn định hơn và giá thấp hơn, phù hợp với khay khổ lớn. Cốt tre ép rất chắc nhưng nặng. Hỏi người bán khay làm bằng cốt gì là câu hỏi đầu tiên nên đặt.",
        },
        { type: "heading", text: "Hoàn thiện" },
        {
          type: "paragraph",
          text: "Bóng gương cho cảm giác sang nhưng lộ vết xước; bóng mờ giấu xước tốt hơn và hợp với đồ dùng hằng ngày. Trang trí vẽ vàng nằm dưới lớp phủ trong nên bền; trang trí nổi hoặc cẩn vỏ trứng ở mặt lòng khay thì nên dành cho khay ít phải cọ rửa.",
        },
        {
          type: "paragraph",
          text: "Nếu còn phân vân, hãy chọn khay chữ nhật vành vừa, bóng mờ, màu đỏ son hoặc đen. Đó là chiếc khay chúng tôi làm nhiều nhất, và cũng là chiếc ít bị trả lại nhất.",
        },
      ],
    },
    en: {
      slug: "choosing-a-lacquer-tray-size-base-and-finish",
      title: "Choosing a lacquer tray: size, base and finish",
      summary:
        "Trays are the most-bought piece of lacquerware and the easiest to get wrong. A few questions before buying will find you a tray for daily use rather than one that only sits on a shelf.",
      body: [
        {
          type: "paragraph",
          text: "A good lacquer tray comes down to three things: a size that suits what you mean to do with it, a base that is stable enough, and a finish that matches how hard it will be used.",
        },
        { type: "heading", text: "Size" },
        {
          type: "list",
          style: "unordered",
          items: [
            "Tea tray, 30–36 cm: holds a pot and four cups",
            "Dining tray, 40–50 cm: carries two soup bowls and a few small dishes",
            "Display tray, 20–28 cm: on a coffee table for keys, candles, small things",
          ],
        },
        {
          type: "paragraph",
          text: "A low rim looks better but is hard to carry when loaded; a rim over three centimetres with cut-out handles is the practical choice for a tray used at meals.",
        },
        {
          type: "image",
          alt: "A red lacquer surface with the shadow of bamboo and a shimmer of gold dust",
          caption: "A satin finish hides scratches better than a mirror gloss and suits daily use.",
        },
        { type: "heading", text: "The base inside" },
        {
          type: "paragraph",
          text: "A natural wood base such as jackfruit or magnolia is the traditional way, light and warm in the hand, but it needs careful priming so it does not warp with the seasons. An engineered wood base is more stable and cheaper, and suits large trays. Pressed bamboo is very strong but heavy. Asking what the base is made of is the first question worth putting to a seller.",
        },
        { type: "heading", text: "Finish" },
        {
          type: "paragraph",
          text: "A mirror gloss feels luxurious but shows every scratch; a satin finish hides them better and suits everyday use. Gold painting sits under the clear top coat and lasts; raised decoration or eggshell inlay on the inside of the tray is better kept for trays that will rarely be scrubbed.",
        },
        {
          type: "paragraph",
          text: "If in doubt, choose a rectangular tray with a medium rim, satin finish, in vermilion or black. It is the tray we make most of, and the one that comes back least.",
        },
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/* Shop items                                                          */
/* ------------------------------------------------------------------ */

type SeedShopText = { name: string; summary: string; description: string };

type SeedShopItem = {
  slug: string;
  /** Whole VND, no separators. */
  priceVnd: string;
  /** USD with up to two decimals. */
  priceUsd: string;
  stockQuantity: number;
  sortOrder: number;
  images: readonly { file: string; alt: string }[];
  vi: SeedShopText;
  en: SeedShopText;
};

const SEED_ITEMS: readonly SeedShopItem[] = [
  {
    slug: "khay-chu-nhat-son-mai-hoa-dao",
    priceVnd: "1850000",
    priceUsd: "75",
    stockQuantity: 8,
    sortOrder: 1,
    images: [
      {
        file: "cau_chuyen.jpg",
        alt: "Khay chữ nhật sơn mài đỏ vẽ hoa đào vàng đang được đánh bóng",
      },
      {
        file: "about-us/Chuan_muc_quoc_te_03.jpg",
        alt: "Góc khay sơn mài đỏ với hoạ tiết hoa đào vàng và viền vàng mảnh",
      },
    ],
    vi: {
      name: "Khay chữ nhật sơn mài đỏ vẽ hoa đào",
      summary:
        "Khay chữ nhật 40 × 28 cm, nền đỏ son, hoạ tiết hoa đào vẽ vàng dưới lớp phủ trong, có tay nắm hai bên.",
      description: [
        "Khay được làm trên cốt gỗ dổi, hom vải và phủ nhiều lớp sơn ta trước khi vẽ hoạ tiết hoa đào bằng bột vàng. Hoạ tiết nằm dưới hai lớp sơn phủ trong nên không bị mòn khi lau chùi.",
        "Kích thước 40 × 28 × 3,5 cm. Tay nắm khoét hai đầu, vừa cho khay trà hoặc bữa sáng cho hai người.",
        "Hoàn thiện bóng mờ, mặt trong và ngoài đều được sơn kín. Mỗi chiếc được đóng gói trong hộp giấy cứng với lớp mút chống sốc.",
        "Ảnh chụp cùng các món khác trong bộ; sản phẩm bán là chiếc khay.",
      ].join("\n\n"),
    },
    en: {
      name: "Rectangular red lacquer tray with peach blossom",
      summary:
        "A 40 × 28 cm rectangular tray, vermilion ground, peach blossom painted in gold under a clear top coat, cut-out handles at both ends.",
      description: [
        "The tray is built on a magnolia wood base, cloth-primed and coated in many layers of natural lacquer before the peach blossom is painted in gold powder. The motif sits under two clear top coats, so it does not wear with cleaning.",
        "Dimensions 40 × 28 × 3.5 cm. Cut-out handles at both ends; the right size for a tea set or breakfast for two.",
        "Satin finish, lacquered inside and out. Each tray ships in a rigid box with foam padding.",
        "Photographed with other pieces from the set; the item sold is the tray.",
      ].join("\n\n"),
    },
  },
  {
    slug: "hop-tron-son-mai-do-van-may",
    priceVnd: "980000",
    priceUsd: "40",
    stockQuantity: 12,
    sortOrder: 2,
    images: [
      {
        file: "about-us/vuon_ra_the_gioi.jpg",
        alt: "Hộp tròn sơn mài đỏ vân mây đặt trên khay cùng hộp vuông",
      },
      {
        file: "about-us/chuan_muc_chau_au.jpg",
        alt: "Hộp tròn, hộp vuông và khay sơn mài đỏ vân mây trên bàn gỗ",
      },
    ],
    vi: {
      name: "Hộp tròn sơn mài đỏ vân mây",
      summary:
        "Hộp tròn đường kính 14 cm, nắp rời, sơn đỏ vân mây tạo bằng kỹ thuật mài lộ lớp, viền vàng mảnh.",
      description: [
        "Vân mây trên hộp không phải vẽ mà là kết quả của việc chồng nhiều lớp sơn màu khác nhau rồi mài nước cho lộ dần từng lớp. Vì vậy không hai chiếc nào có vân giống nhau.",
        "Đường kính 14 cm, cao 6 cm. Lòng hộp sơn đen, đủ chỗ cho một gói trà, đồ trang sức hoặc những vật nhỏ cần cất kỹ.",
        "Nắp đậy khít nhưng nhấc lên nhẹ tay. Hoàn thiện bóng, đánh bằng tay.",
        "Ảnh chụp cùng các món khác trong bộ; sản phẩm bán là chiếc hộp tròn.",
      ].join("\n\n"),
    },
    en: {
      name: "Round red lacquer box with cloud grain",
      summary:
        "A 14 cm round box with a lift-off lid, red cloud-grain lacquer revealed by sanding through the layers, with a fine gold rim.",
      description: [
        "The cloud pattern is not painted: it comes from layering several colours of lacquer and then wet-sanding until each layer shows through in turn. No two boxes carry the same grain.",
        "Diameter 14 cm, height 6 cm. The interior is lacquered black, with room for a packet of tea, jewellery, or small things that need keeping safe.",
        "The lid seats closely but lifts away with a light hand. Gloss finish, polished by hand.",
        "Photographed with other pieces from the set; the item sold is the round box.",
      ].join("\n\n"),
    },
  },
  {
    slug: "hop-vuong-son-mai-nap-num-dong",
    priceVnd: "1150000",
    priceUsd: "47",
    stockQuantity: 10,
    sortOrder: 3,
    images: [
      {
        file: "about-us/chuan_muc_chau_au.jpg",
        alt: "Hộp vuông sơn mài đỏ vân mây với núm nắp bằng đồng trên bàn gỗ",
      },
      {
        file: "about-us/vuon_ra_the_gioi.jpg",
        alt: "Hộp vuông sơn mài đỏ đặt cạnh khay và hộp tròn cùng bộ",
      },
    ],
    vi: {
      name: "Hộp vuông sơn mài nắp núm đồng",
      summary:
        "Hộp vuông 18 cm, thân và nắp sơn đỏ vân mây, núm nắp bằng đồng tiện, viền vàng chạy quanh mép nắp.",
      description: [
        "Hộp làm trên cốt gỗ, sơn kín cả trong lẫn ngoài. Mặt ngoài phủ đỏ vân mây mài lộ lớp; lòng hộp sơn đen bóng.",
        "Kích thước 18 × 18 × 7 cm. Núm nắp bằng đồng tiện, gắn cố định. Viền vàng ở mép nắp được kẻ tay bằng bột vàng dưới lớp phủ trong.",
        "Dùng làm hộp trà, hộp đựng đồ trang sức hoặc hộp quà. Có thể khắc tên theo yêu cầu, liên hệ trước khi đặt.",
        "Ảnh chụp cùng các món khác trong bộ; sản phẩm bán là chiếc hộp vuông.",
      ].join("\n\n"),
    },
    en: {
      name: "Square lacquer box with brass knob",
      summary:
        "An 18 cm square box, body and lid in red cloud-grain lacquer, a turned brass knob on the lid and a gold line around its edge.",
      description: [
        "Built on a wooden base and lacquered inside and out. The outside carries red cloud grain revealed by sanding; the interior is gloss black.",
        "Dimensions 18 × 18 × 7 cm. The knob is turned brass, fixed in place. The gold line at the edge of the lid is ruled by hand in gold powder under the clear top coat.",
        "Suits tea, jewellery, or a gift. Engraving of a name is possible on request; get in touch before ordering.",
        "Photographed with other pieces from the set; the item sold is the square box.",
      ].join("\n\n"),
    },
  },
  {
    slug: "binh-hoa-son-mai-dang-thon",
    priceVnd: "1650000",
    priceUsd: "68",
    stockQuantity: 5,
    sortOrder: 4,
    images: [
      {
        file: "hinh_nen_rd1.jpg",
        alt: "Bình hoa sơn mài đỏ dáng thon vẽ hoa vàng cắm cành lá, cùng bộ khay và hộp",
      },
    ],
    vi: {
      name: "Bình hoa sơn mài dáng thon vẽ hoa vàng",
      summary:
        "Bình cao 28 cm, thân thon dần lên miệng, nền đỏ đậm với cành hoa vẽ vàng, lòng bình có ống lót để cắm cành khô hoặc hoa tươi ít nước.",
      description: [
        "Bình tiện từ gỗ nguyên khối rồi phủ sơn ta nhiều lớp. Phần thân vẽ một cành hoa nhỏ bằng bột vàng, mảnh và không chiếm hết mặt bình, để dáng bình vẫn là điểm nhìn chính.",
        "Cao 28 cm, đường kính đáy 9 cm, miệng 5 cm. Lòng bình được phủ kín và có ống lót để cắm hoa tươi với lượng nước ít; hợp nhất với cành khô hoặc một vài nhành lá.",
        "Không đổ đầy nước và không để nước đọng qua đêm.",
        "Ảnh chụp cùng các món khác trong bộ; sản phẩm bán là chiếc bình.",
      ].join("\n\n"),
    },
    en: {
      name: "Slender lacquer vase with gold blossom",
      summary:
        "A 28 cm vase tapering towards the mouth, deep red ground with a painted gold branch, lined inside for dried stems or fresh flowers in a little water.",
      description: [
        "Turned from solid wood and coated in many layers of natural lacquer. A small flowering branch is painted on the body in gold powder, fine and deliberately not covering the whole surface, so the shape stays the main thing to look at.",
        "Height 28 cm, base 9 cm, mouth 5 cm. The interior is fully lacquered and fitted with a liner for fresh flowers in a small amount of water; it suits dried stems or a few sprigs of foliage best.",
        "Do not fill to the top, and do not leave water standing overnight.",
        "Photographed with other pieces from the set; the item sold is the vase.",
      ].join("\n\n"),
    },
  },
  {
    slug: "dia-tron-son-mai-kim-sa",
    priceVnd: "1250000",
    priceUsd: "52",
    stockQuantity: 6,
    sortOrder: 5,
    images: [
      {
        file: "lacquer-process/danh_bong.jpg",
        alt: "Mặt đĩa sơn mài đỏ rắc vảy vàng đang được phủ lớp sơn cuối",
      },
    ],
    vi: {
      name: "Đĩa tròn sơn mài đỏ rắc kim sa",
      summary:
        "Đĩa tròn đường kính 30 cm, nền đỏ son, rắc vảy vàng theo vòng xoáy, viền vàng, dùng làm đĩa trưng hoặc đĩa đựng trái cây khô.",
      description: [
        "Vảy vàng được rắc lên lớp sơn còn ướt rồi phủ thêm hai lớp sơn trong, nên khi nhìn nghiêng thấy vảy nằm ở nhiều độ sâu khác nhau. Vòng xoáy là vết chổi quét sơn được giữ lại có chủ ý.",
        "Đường kính 30 cm, cao 2,5 cm. Mặt sau sơn đen, có ba chân đệm nhỏ.",
        "Dùng cho đồ khô, trái cây, hoặc đặt trên bàn làm điểm nhấn. Không dùng cho lò vi sóng hay máy rửa bát.",
      ].join("\n\n"),
    },
    en: {
      name: "Round red lacquer plate with gold flakes",
      summary:
        "A 30 cm round plate, vermilion ground, gold flakes scattered in a spiral, gold rim; for display or dried fruit.",
      description: [
        "The gold flakes are scattered onto a coat that is still wet and then sealed under two clear coats, so seen at an angle they sit at different depths. The spiral is the brush stroke of the coat, kept on purpose.",
        "Diameter 30 cm, height 2.5 cm. The underside is lacquered black with three small pad feet.",
        "For dry food, fruit, or as a centrepiece on a table. Not for the microwave or the dishwasher.",
      ].join("\n\n"),
    },
  },
  {
    slug: "bo-lot-ly-son-mai-4-chiec",
    priceVnd: "450000",
    priceUsd: "18",
    stockQuantity: 20,
    sortOrder: 6,
    images: [
      {
        file: "hinh_nen_rd1.jpg",
        alt: "Bộ lót ly sơn mài đen và vàng vẽ cành trúc xếp chồng trên bàn, cùng bộ khay và bình",
      },
    ],
    vi: {
      name: "Bộ lót ly sơn mài 4 chiếc",
      summary:
        "Bốn lót ly vuông 10 cm: hai đen, hai vàng, mặt trên vẽ cành trúc, mặt dưới nhám nhẹ chống trượt.",
      description: [
        "Bộ bốn chiếc lót ly vuông, cạnh 10 cm, dày 1 cm, làm trên cốt gỗ ép. Hai chiếc nền đen vẽ cành trúc vàng, hai chiếc nền vàng vẽ cành trúc đen.",
        "Mặt trên hoàn thiện bóng mờ để không lộ vết nước; mặt dưới để nhám nhẹ nên không trượt trên mặt bàn kính.",
        "Xếp chồng lại thành một chồng thấp, đóng trong hộp giấy cứng — hợp làm quà nhỏ.",
        "Ảnh chụp cùng các món khác trong bộ; sản phẩm bán là bộ lót ly.",
      ].join("\n\n"),
    },
    en: {
      name: "Lacquer coaster set of four",
      summary:
        "Four 10 cm square coasters: two black, two gold, a bamboo sprig painted on top, lightly matte underneath so they do not slide.",
      description: [
        "A set of four square coasters, 10 cm across and 1 cm thick, on an engineered wood base. Two have a black ground with a gold bamboo sprig, two a gold ground with the sprig in black.",
        "The top is finished satin so water marks do not show; the underside is left lightly matte so they stay put on a glass table.",
        "They stack into one low pile and come in a rigid box — a good small gift.",
        "Photographed with other pieces from the set; the item sold is the coaster set.",
      ].join("\n\n"),
    },
  },
];

/* ------------------------------------------------------------------ */
/* Actor and services                                                  */
/* ------------------------------------------------------------------ */

/**
 * A synthetic actor for the workflow. Nothing here creates or implies a user
 * account: it is an in-memory permission set so the command services can run
 * outside a request, and the audit trail records the seed as the author.
 */
const SEED_CONTEXT: AccessContext = {
  actorType: "user",
  userId: SEED_ACTOR_ID,
  userStatus: "active",
  permissions: [
    "content.create",
    "content.read",
    "content.update",
    "content.publish",
    "shop.read",
    "shop.manage",
    "shop.publish",
  ].map((permission) => ({
    permission: permission as never,
    scope: "all" as const,
    businessUnitIds: [],
    roleKeys: ["seed-script"],
  })),
  authzVersion: 1,
  requestId: "seed-showcase",
};

// The revalidation hooks in the runtime modules call next/cache, which only
// exists inside a request. A script has no cache to bust, so these stay empty.
const articleService = new ArticleCommandService({
  store: new MongoArticleCommandStore(),
  auditRepository: mongoAuditRepository,
  postCommit: () => undefined,
});

const shopService = new ShopService({
  itemStore: new MongoShopItemStore(),
  orderStore: new MongoShopOrderStore(),
  auditRepository: mongoAuditRepository,
  postCommit: () => undefined,
});

/* ------------------------------------------------------------------ */
/* Cloudinary                                                          */
/* ------------------------------------------------------------------ */

type UploadedImage = {
  publicId: string;
  assetVersion: number;
  width: number;
  height: number;
  bytes: number;
};

function seedFolder(): string {
  return `${getCloudinaryEnv().CLOUDINARY_UPLOAD_FOLDER}/seed`;
}

/**
 * Uploads one file from `public/` under a fixed public id. `overwrite` makes
 * a re-run replace the asset in place (with a new version) instead of
 * accumulating copies.
 */
async function uploadImage(
  file: string,
  publicId: string,
): Promise<UploadedImage> {
  const env = getCloudinaryEnv();
  const signed: Record<string, string | number> = {
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
    overwrite: "true",
    invalidate: "true",
  };

  const form = new FormData();
  const bytes = await readFile(path.join(PUBLIC_DIR, file));
  form.append("file", new Blob([new Uint8Array(bytes)]), path.basename(file));
  for (const [key, value] of Object.entries(signed)) {
    form.append(key, String(value));
  }
  form.append("api_key", env.CLOUDINARY_API_KEY);
  form.append(
    "signature",
    buildCloudinarySignature(signed, env.CLOUDINARY_API_SECRET),
  );

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ? `: ${body.error.message}` : "";
    } catch {
      // Non-JSON error body; the status alone will have to do.
    }
    throw new Error(
      `Cloudinary refused ${publicId} (HTTP ${response.status})${detail}`,
    );
  }

  const result = (await response.json()) as {
    public_id: string;
    version: number;
    width: number;
    height: number;
    bytes: number;
  };
  return {
    publicId: result.public_id,
    assetVersion: result.version,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
}

function storageOrNull(): CloudinaryMediaStorage | null {
  try {
    return CloudinaryMediaStorage.fromEnvironment();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Articles: create → review → publish → cover                         */
/* ------------------------------------------------------------------ */

function articleBlocks(
  locale: SeedLocale,
  blocks: readonly SeedBlock[],
  bodyImage: UploadedImage | null,
  storage: CloudinaryMediaStorage,
): StructuredBlock[] {
  const out: StructuredBlock[] = [];
  blocks.forEach((block, index) => {
    const blockId = `${locale}-${index + 1}`;
    switch (block.type) {
      case "heading":
        out.push({ blockId, type: "heading", level: 2, text: block.text });
        break;
      case "paragraph":
        out.push({ blockId, type: "paragraph", text: block.text });
        break;
      case "list":
        out.push({
          blockId,
          type: "list",
          style: block.style,
          items: [...block.items],
        });
        break;
      case "quote":
        out.push({
          blockId,
          type: "quote",
          text: block.text,
          ...(block.attribution ? { attribution: block.attribution } : {}),
        });
        break;
      case "image":
        // Without a photograph the block is dropped rather than rendered
        // broken; the surrounding prose reads fine on its own.
        if (bodyImage) {
          out.push({
            blockId,
            type: "image",
            src: storage.buildImageUrl(
              bodyImage.publicId,
              bodyImage.assetVersion,
              1600,
            ),
            width: bodyImage.width,
            height: bodyImage.height,
            alt: block.alt,
            ...(block.caption ? { caption: block.caption } : {}),
          });
        }
        break;
      case "callToAction":
        out.push({
          blockId,
          type: "callToAction",
          label: block.label,
          href: block.href,
        });
        break;
    }
  });
  return out;
}

async function createAndPublishArticle(
  seed: SeedArticle,
  storage: CloudinaryMediaStorage,
): Promise<void> {
  const assetBase = `${seedFolder()}/news/${seed.internalId.toLowerCase()}`;
  const cover = await uploadImage(seed.cover.file, `${assetBase}/cover`);
  const bodyImage = seed.bodyImage
    ? await uploadImage(seed.bodyImage.file, `${assetBase}/body`)
    : null;

  const toTranslation = (locale: SeedLocale) => {
    const text = seed[locale];
    return {
      locale,
      slug: text.slug,
      title: text.title,
      summary: text.summary,
      body: articleBlocks(locale, text.body, bodyImage, storage),
      seo: { noIndex: false },
    };
  };
  const vi = toTranslation("vi");
  const translations = [vi, toTranslation("en")];

  const created = await articleService.createDraft(SEED_CONTEXT, {
    metadata: {
      internalId: seed.internalId,
      tagKeys: [categoryTag(seed.category), ...seed.tags],
      authorLabel: "Red Door Viet Nam",
    },
    revision: {
      sourceLocale: "vi",
      sourceBlocks: vi.body,
    },
    translations,
  });
  if (!created.draft) {
    throw new Error(`${seed.internalId}: the draft was not created.`);
  }

  const expected = (aggregate: typeof created) => {
    const draft = aggregate.draft;
    if (!draft) {
      throw new Error(`${seed.internalId}: the draft vanished mid-workflow.`);
    }
    return {
      articleId: aggregate.article.id,
      expectedArticleRevision: aggregate.article.revision,
      revisionId: draft.revision.id,
      expectedRevision: draft.revision.revision,
      expectedTranslations: draft.translations.map((translation) => ({
        locale: translation.locale,
        expectedRevision: translation.revision,
      })),
    };
  };

  const submitted = await articleService.submitForReview(
    SEED_CONTEXT,
    expected(created),
  );
  const published = await articleService.publish(SEED_CONTEXT, {
    ...expected(submitted),
    routes: (submitted.draft?.translations ?? []).map((translation) => ({
      locale: translation.locale,
      path: `/${translation.locale}/news/${translation.slug}`,
    })),
  });

  // The cover rides the same image sidecar the portal writes, so it can be
  // replaced from the article's admin page later.
  const articleId = new Types.ObjectId(published.article.id);
  const actor = new Types.ObjectId(SEED_ACTOR_ID);
  await getEntityImagesModel()
    .findOneAndUpdate(
      { entityType: "article", entityId: articleId },
      {
        $set: {
          images: [
            {
              publicId: cover.publicId,
              assetVersion: cover.assetVersion,
              width: cover.width,
              height: cover.height,
              bytes: cover.bytes,
              alt: seed.cover.alt.vi,
            },
          ],
          updatedBy: actor,
        },
        $setOnInsert: {
          entityType: "article",
          entityId: articleId,
          createdBy: actor,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
    .exec();
}

/* ------------------------------------------------------------------ */
/* Shop items: create → images → live                                  */
/* ------------------------------------------------------------------ */

async function createAndPublishItem(seed: SeedShopItem): Promise<void> {
  const item = await shopService.createItem(SEED_CONTEXT, {
    slug: seed.slug,
    text: { vi: seed.vi, en: seed.en },
    priceVnd: seed.priceVnd,
    priceUsd: seed.priceUsd,
    stockQuantity: seed.stockQuantity,
    categoryKey: "",
    sortOrder: seed.sortOrder,
  });

  const images = [];
  for (const [index, image] of seed.images.entries()) {
    const uploaded = await uploadImage(
      image.file,
      `${seedFolder()}/shop/${seed.slug}/${index + 1}`,
    );
    images.push({ ...uploaded, alt: image.alt });
  }
  await shopService.setItemImages(SEED_CONTEXT, { itemId: item.id, images });
  await shopService.setItemStatus(SEED_CONTEXT, {
    itemId: item.id,
    status: "live",
  });
}

/* ------------------------------------------------------------------ */
/* Insert / remove                                                     */
/* ------------------------------------------------------------------ */

async function insert(dryRun: boolean): Promise<void> {
  const existingArticles = new Set(
    (
      await getArticleModel()
        .find({ internalId: { $in: SEED_ARTICLES.map((a) => a.internalId) } })
        .select("internalId")
        .lean<{ internalId: string }[]>()
        .exec()
    ).map(({ internalId }) => internalId),
  );
  const existingItems = new Set(
    (
      await getShopItemModel()
        .find({
          slug: { $in: SEED_ITEMS.map((item) => item.slug) },
          deletedAt: { $exists: false },
        })
        .select("slug")
        .lean<{ slug: string }[]>()
        .exec()
    ).map(({ slug }) => slug),
  );

  const pendingArticles = SEED_ARTICLES.filter(
    (seed) => !existingArticles.has(seed.internalId),
  );
  const pendingItems = SEED_ITEMS.filter(
    (seed) => !existingItems.has(seed.slug),
  );

  console.info(
    `Articles: ${existingArticles.size} present, ${pendingArticles.length} to create` +
      (pendingArticles.length
        ? ` (${pendingArticles.map((a) => a.internalId).join(", ")})`
        : ""),
  );
  console.info(
    `Shop items: ${existingItems.size} present, ${pendingItems.length} to create` +
      (pendingItems.length
        ? ` (${pendingItems.map((item) => item.slug).join(", ")})`
        : ""),
  );
  if (dryRun || (pendingArticles.length === 0 && pendingItems.length === 0)) {
    return;
  }

  // Fails early with the missing variable names if Cloudinary is not set up,
  // before anything has been written.
  const storage = CloudinaryMediaStorage.fromEnvironment();

  for (const seed of pendingArticles) {
    await createAndPublishArticle(seed, storage);
    console.info(`  published ${seed.internalId} — ${seed.vi.title}`);
  }
  for (const seed of pendingItems) {
    await createAndPublishItem(seed);
    console.info(`  on sale   ${seed.slug} — ${seed.vi.name}`);
  }
}

/**
 * Removes the seeded records and everything hanging off them: article
 * revisions, translations, routes and cover sidecars; shop items with their
 * embedded images; and the Cloudinary assets both referenced. Orders placed
 * against a seeded item keep their snapshot and are left alone.
 */
async function remove(dryRun: boolean): Promise<void> {
  const articles = await getArticleModel()
    .find({ internalId: { $regex: `^${ARTICLE_PREFIX}` } })
    .select("_id internalId")
    .lean<{ _id: Types.ObjectId; internalId: string }[]>()
    .exec();
  const items = await getShopItemModel()
    .find({
      slug: { $in: SEED_ITEMS.map((item) => item.slug) },
      createdBy: new Types.ObjectId(SEED_ACTOR_ID),
    })
    .select("_id slug images")
    .lean<
      { _id: Types.ObjectId; slug: string; images: { publicId: string }[] }[]
    >()
    .exec();

  if (articles.length === 0 && items.length === 0) {
    console.info("No seeded articles or shop items found. Nothing to remove.");
    return;
  }
  console.info(
    `Removing ${articles.length} articles (${articles.map((a) => a.internalId).join(", ") || "none"}) ` +
      `and ${items.length} shop items (${items.map((i) => i.slug).join(", ") || "none"}).`,
  );
  if (dryRun) return;

  const storage = storageOrNull();
  const destroy = async (publicId: string) => {
    if (!storage) return;
    await storage.destroyAsset(publicId, "image").catch(() => undefined);
  };

  const articleIds = articles.map(({ _id }) => _id);
  if (articleIds.length > 0) {
    const covers = await getEntityImagesModel()
      .find({ entityType: "article", entityId: { $in: articleIds } })
      .select("images")
      .lean<{ images: { publicId: string }[] }[]>()
      .exec();
    for (const cover of covers) {
      for (const image of cover.images) await destroy(image.publicId);
    }
    if (storage) {
      // Body photographs are not recorded anywhere but the block src, so
      // they are addressed by the fixed id they were uploaded under.
      for (const article of articles) {
        await destroy(
          `${seedFolder()}/news/${article.internalId.toLowerCase()}/body`,
        );
      }
    }
    await getEntityImagesModel()
      .deleteMany({ entityType: "article", entityId: { $in: articleIds } })
      .exec();
    await getLocalizedRouteModel()
      .deleteMany({ entityType: "article", entityId: { $in: articleIds } })
      .exec();
    await getArticleTranslationModel()
      .deleteMany({ articleId: { $in: articleIds } })
      .exec();
    await getArticleRevisionModel()
      .deleteMany({ articleId: { $in: articleIds } })
      .exec();
    await getArticleModel()
      .deleteMany({ _id: { $in: articleIds } })
      .exec();
  }

  if (items.length > 0) {
    for (const item of items) {
      for (const image of item.images) await destroy(image.publicId);
    }
    await getShopItemModel()
      .deleteMany({ _id: { $in: items.map(({ _id }) => _id) } })
      .exec();
  }

  console.info(
    `Removed ${articles.length} articles and ${items.length} shop items` +
      (storage ? " and their Cloudinary assets." : "; Cloudinary is not configured, so assets were left in place."),
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const removing = argv.includes("--remove");

  await connectToDatabase();
  if (removing) {
    await remove(dryRun);
  } else {
    await insert(dryRun);
  }
  console.info(dryRun ? "Dry run complete; nothing was written." : "Done.");
}

main()
  .then(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.stack : error);
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
