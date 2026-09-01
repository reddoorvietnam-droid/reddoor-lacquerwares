/**
 * Seeds a small published catalogue so the Sản phẩm pages have something real
 * to show before the company photographs its own work.
 *
 * These are placeholder records, not company copy. Every one carries the
 * `SEED-` SKU prefix, which is the handle for removing them again:
 *
 *   npm run seed:products             insert (or top up) the sample catalogue
 *   npm run seed:products -- --remove delete every SEED- product
 *   npm run seed:products -- --dry-run  print the plan, touch nothing
 *
 * It goes through `ProductCommandService` rather than writing collections
 * directly, so each product passes the same draft → review → publish workflow
 * the portal uses and lands with matching versions, translations, routes and
 * audit entries. A record made here is therefore editable and deletable from
 * the admin portal exactly like one typed in by hand.
 *
 * No photographs are attached: images ride a separate Cloudinary sidecar, so
 * each product renders its reserved image slot until someone uploads the real
 * thing in the portal.
 */

import { Types } from "mongoose";

import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { ProductCommandService } from "@/domains/products/commands";
import { MongoProductCommandStore } from "@/domains/products/commands/mongo-store";
import { getProductModel } from "@/domains/products/persistence/models";
import { getLocalizedRouteModel } from "@/domains/content/persistence/models";
import type { AccessContext } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongoose";

const SKU_PREFIX = "SEED-";

type SeedTranslation = {
  title: string;
  slug: string;
  shortDescription: string;
  /** One entry per paragraph. */
  paragraphs: readonly string[];
  /** One entry per care instruction. */
  care: readonly string[];
};

type SeedProduct = {
  sku: string;
  categoryKey: string;
  group: "processing" | "develop";
  isAvailable: boolean;
  materials: readonly string[];
  colors: readonly string[];
  finishes: readonly string[];
  leadTimeDays: number;
  dimensions: { length: string; width: string; height: string };
  vi: SeedTranslation;
  en: SeedTranslation;
};

const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    sku: `${SKU_PREFIX}KHAY-01`,
    categoryKey: "khay-mam",
    group: "processing",
    isAvailable: true,
    materials: ["Sơn mài trên cốt gỗ mít"],
    colors: ["Đỏ son", "Vàng kim"],
    finishes: ["Đánh bóng thủ công"],
    leadTimeDays: 21,
    dimensions: { length: "36", width: "36", height: "3" },
    vi: {
      title: "Khay trà sơn mài vỏ trứng",
      slug: "khay-tra-son-mai-vo-trung",
      shortDescription:
        "Khay tròn cẩn vỏ trứng, vành thấp, mặt sơn đánh bóng phản chiếu ánh sáng dịu.",
      paragraphs: [
        "Khay được tạo vóc trên cốt gỗ mít, phủ nhiều lớp sơn ta rồi mài nước giữa từng lớp. Phần vỏ trứng được cẩn thủ công từng mảnh, tạo dải vân sáng chạy quanh lòng khay.",
        "Vành khay giữ thấp để bộ ấm chén nổi lên khi đặt vào. Mặt khay đánh bóng đến độ trong, phản chiếu ánh sáng mà không chói.",
        "Mỗi chiếc mất khoảng ba tuần chờ sơn khô tự nhiên giữa các lớp, nên vân vỏ trứng và sắc đỏ của từng khay không chiếc nào giống hệt chiếc nào.",
      ],
      care: [
        "Lau bằng khăn mềm khô hoặc hơi ẩm, không dùng chất tẩy",
        "Tránh ngâm nước và tránh đặt gần nguồn nhiệt",
        "Không để vật sắc nhọn cọ trực tiếp lên mặt sơn",
      ],
    },
    en: {
      title: "Eggshell lacquer tea tray",
      slug: "eggshell-lacquer-tea-tray",
      shortDescription:
        "A round tray inlaid with eggshell, low-rimmed, polished to a soft reflective sheen.",
      paragraphs: [
        "The body is built on jackfruit wood, coated in many layers of natural lacquer and wet-sanded between each one. The eggshell is inlaid by hand, piece by piece, forming a pale band that runs around the well of the tray.",
        "The rim is kept low so a tea set stands proud of it. The surface is polished until it is clear, reflecting light without glare.",
        "Each tray takes about three weeks of natural drying between coats, so no two share exactly the same eggshell pattern or depth of red.",
      ],
      care: [
        "Wipe with a soft dry or barely damp cloth; no detergents",
        "Never soak, and keep away from direct heat",
        "Do not drag sharp objects across the lacquer",
      ],
    },
  },
  {
    sku: `${SKU_PREFIX}BAT-01`,
    categoryKey: "do-ban-an",
    group: "processing",
    isAvailable: true,
    materials: ["Sơn mài trên cốt gỗ"],
    colors: ["Đen", "Vàng kim"],
    finishes: ["Bóng gương"],
    leadTimeDays: 18,
    dimensions: { length: "18", width: "18", height: "8" },
    vi: {
      title: "Bát sơn mài lòng vàng",
      slug: "bat-son-mai-long-vang",
      shortDescription:
        "Bát nông miệng rộng, ngoài đen sâu, lòng phủ vàng kim ấm.",
      paragraphs: [
        "Bát tiện từ cốt gỗ rồi phủ sơn cả trong lẫn ngoài, nên khi cầm lên không thấy đường nối giữa hai mặt.",
        "Mặt ngoài để đen sâu, lòng bát phủ sắc vàng kim ấm — khi ánh sáng chiếu vào, lòng bát sáng lên trước, làm thức ăn đặt trong nổi bật hơn.",
        "Dùng được cho đồ khô và trái cây. Đây là đồ thủ công phủ sơn ta, không dùng cho lò vi sóng hay máy rửa bát.",
      ],
      care: [
        "Rửa nhẹ bằng nước ấm và khăn mềm, lau khô ngay",
        "Không dùng lò vi sóng, không dùng máy rửa bát",
        "Không đựng thức ăn quá nóng hoặc nhiều dầu mỡ trong thời gian dài",
      ],
    },
    en: {
      title: "Gold-lined lacquer bowl",
      slug: "gold-lined-lacquer-bowl",
      shortDescription:
        "A shallow wide-mouthed bowl, deep black outside, lined in warm gold.",
      paragraphs: [
        "The bowl is turned from wood and then lacquered inside and out, so there is no visible seam between the two faces when you pick it up.",
        "The outside stays deep black while the interior carries a warm gold; under light the inside brightens first, lifting whatever is placed in it.",
        "Suited to dry food and fruit. This is hand-applied natural lacquer — not for microwaves or dishwashers.",
      ],
      care: [
        "Wash gently in warm water with a soft cloth and dry at once",
        "No microwave, no dishwasher",
        "Avoid holding very hot or oily food for long periods",
      ],
    },
  },
  {
    sku: `${SKU_PREFIX}BINH-01`,
    categoryKey: "binh-lo",
    group: "processing",
    isAvailable: false,
    materials: ["Sơn mài trên cốt gỗ"],
    colors: ["Đỏ son"],
    finishes: ["Bóng mờ"],
    leadTimeDays: 35,
    dimensions: { length: "16", width: "16", height: "42" },
    vi: {
      title: "Bình sơn mài dáng cao",
      slug: "binh-son-mai-dang-cao",
      shortDescription:
        "Bình dáng đứng, vai bình bắt sáng, phủ sơn kín cả mặt trong lẫn ngoài.",
      paragraphs: [
        "Bình cao 42cm, thân thon dần lên vai rồi thu lại ở miệng. Dáng này làm ra để nhìn, không phải để cắm hoa tươi ngâm nước.",
        "Toàn bộ mặt ngoài phủ đỏ son nhiều lớp, hoàn thiện bóng mờ nên bề mặt ấm chứ không gắt. Phần vai bình là nơi bắt sáng rõ nhất khi đặt cạnh cửa sổ.",
        "Vì thân bình cao và mỏng, thời gian chờ sơn khô lâu hơn đồ nhỏ — mỗi chiếc mất khoảng năm tuần.",
      ],
      care: [
        "Chỉ lau bụi bằng khăn khô mềm",
        "Không đổ nước vào lòng bình",
        "Đặt tránh ánh nắng chiếu trực tiếp kéo dài",
      ],
    },
    en: {
      title: "Tall lacquer vessel",
      slug: "tall-lacquer-vessel",
      shortDescription:
        "An upright vessel whose shoulder catches the light, lacquered inside and out.",
      paragraphs: [
        "Forty-two centimetres tall, tapering to the shoulder and drawing in again at the mouth. The shape is made to be looked at rather than filled with water and cut flowers.",
        "The whole outer surface carries many coats of vermilion finished to a soft sheen, so it reads warm rather than hard. The shoulder is where the light gathers when it stands near a window.",
        "Because the body is tall and thin the drying takes longer than it does on small pieces — roughly five weeks each.",
      ],
      care: [
        "Dust with a soft dry cloth only",
        "Do not fill with water",
        "Keep out of prolonged direct sunlight",
      ],
    },
  },
  {
    sku: `${SKU_PREFIX}HOP-01`,
    categoryKey: "hop-trap",
    group: "processing",
    isAvailable: true,
    materials: ["Sơn mài trên cốt gỗ", "Cẩn vỏ trứng"],
    colors: ["Nâu cánh gián", "Trắng vỏ trứng"],
    finishes: ["Đánh bóng thủ công"],
    leadTimeDays: 24,
    dimensions: { length: "24", width: "16", height: "9" },
    vi: {
      title: "Hộp đựng kỷ vật cẩn vỏ trứng",
      slug: "hop-dung-ky-vat-can-vo-trung",
      shortDescription:
        "Hộp có nắp rời, mặt nắp cẩn vỏ trứng rồi mài phẳng đến khi liền một mặt.",
      paragraphs: [
        "Nắp hộp được cẩn vỏ trứng kín mặt rồi mài nước nhiều lượt, đến khi sờ lên chỉ còn một mặt phẳng liền — không cảm nhận được rìa của từng mảnh vỏ.",
        "Thân hộp phủ nâu cánh gián, lòng hộp lót phẳng để đựng trang sức, thư từ hay những vật nhỏ cần cất kỹ.",
        "Nắp đậy khít nhưng không chặt, nhấc lên nhẹ tay.",
      ],
      care: [
        "Lau bằng khăn mềm khô",
        "Tránh để nơi ẩm thấp hoặc thay đổi nhiệt độ đột ngột",
        "Không đặt vật nặng lên nắp hộp",
      ],
    },
    en: {
      title: "Eggshell keepsake box",
      slug: "eggshell-keepsake-box",
      shortDescription:
        "A lift-off box whose lid is inlaid with eggshell and sanded back to one continuous surface.",
      paragraphs: [
        "The lid is inlaid with eggshell across its whole face, then wet-sanded repeatedly until the hand finds a single flat plane and cannot feel the edge of any individual piece.",
        "The body carries a deep chestnut brown and the interior is lined flat, for jewellery, letters, or small things that need putting somewhere safe.",
        "The lid seats closely without gripping, and lifts away with a light hand.",
      ],
      care: [
        "Wipe with a soft dry cloth",
        "Keep away from damp and sudden temperature changes",
        "Do not rest heavy objects on the lid",
      ],
    },
  },
  {
    sku: `${SKU_PREFIX}TRANH-01`,
    categoryKey: "tranh-panel",
    group: "develop",
    isAvailable: false,
    materials: ["Sơn mài trên vóc gỗ"],
    colors: ["Đen", "Vàng kim", "Đỏ son"],
    finishes: ["Bóng mờ"],
    leadTimeDays: 60,
    dimensions: { length: "90", width: "4", height: "60" },
    vi: {
      title: "Tranh sơn mài — mặt nước buổi sớm",
      slug: "tranh-son-mai-mat-nuoc-buoi-som",
      shortDescription:
        "Panel treo tường khổ ngang, dựng lớp từ đen sâu lên vàng kim, đang trong giai đoạn hoàn thiện mẫu.",
      paragraphs: [
        "Bức tranh dựng trên vóc gỗ, phủ từ nền đen sâu rồi mài dần để lộ các lớp vàng kim và đỏ son bên dưới — cách làm quen thuộc của sơn mài truyền thống, nơi hình ảnh hiện ra nhờ mài đi chứ không phải vẽ thêm.",
        "Mẫu này đang trong giai đoạn phát triển: chúng tôi còn thử nghiệm độ sâu của lớp nền và điểm dừng khi mài. Kích thước ghi ở đây là kích thước dự kiến.",
        "Liên hệ nếu bạn quan tâm đến khổ tranh hoặc bảng màu khác.",
      ],
      care: [
        "Treo nơi thoáng, tránh ánh nắng chiếu trực tiếp",
        "Lau bụi bằng khăn khô mềm theo chiều ngang",
        "Tránh treo ở tường ẩm",
      ],
    },
    en: {
      title: "Lacquer panel — water at first light",
      slug: "lacquer-panel-water-at-first-light",
      shortDescription:
        "A landscape-format wall panel built from deep black up to gold, still in sample development.",
      paragraphs: [
        "The panel is built on a wooden board, coated from a deep black ground and then sanded back to reveal the gold and vermilion beneath — the traditional lacquer method, where the image emerges by removal rather than addition.",
        "This design is still in development: we are testing how deep the ground should go and where the sanding should stop. The dimensions given here are the intended ones.",
        "Get in touch if a different format or palette would suit you.",
      ],
      care: [
        "Hang in a ventilated place, out of direct sun",
        "Dust horizontally with a soft dry cloth",
        "Avoid hanging on a damp wall",
      ],
    },
  },
  {
    sku: `${SKU_PREFIX}LOTLY-01`,
    categoryKey: "do-ban-an",
    group: "develop",
    isAvailable: true,
    materials: ["Sơn mài trên cốt gỗ"],
    colors: ["Đỏ son", "Đen"],
    finishes: ["Bóng mờ"],
    leadTimeDays: 14,
    dimensions: { length: "10", width: "10", height: "1" },
    vi: {
      title: "Bộ lót ly sơn mài (6 chiếc)",
      slug: "bo-lot-ly-son-mai-6-chiec",
      shortDescription:
        "Sáu chiếc lót ly vuông, ba đỏ ba đen, xếp chồng vừa một chồng thấp.",
      paragraphs: [
        "Bộ sáu chiếc, chia đều ba đỏ son và ba đen. Mỗi chiếc dày khoảng một phân, mặt trên phủ sơn hoàn thiện bóng mờ, mặt dưới để nhám nhẹ cho khỏi trượt.",
        "Kích thước vuông 10cm vừa cho ly nước, cốc cà phê và chén trà. Xếp chồng lại thành một chồng thấp, không chiếm chỗ trên bàn.",
        "Đây là mẫu mới đang hoàn thiện, nhưng lô đầu đã làm xong và có sẵn.",
      ],
      care: [
        "Lau ngay bằng khăn mềm khi có nước đọng",
        "Không ngâm nước",
        "Xếp chồng khi cất, tránh dựng nghiêng lâu ngày",
      ],
    },
    en: {
      title: "Lacquer coaster set of six",
      slug: "lacquer-coaster-set-of-six",
      shortDescription:
        "Six square coasters, three red and three black, stacking into one low pile.",
      paragraphs: [
        "A set of six, split evenly between vermilion and black. Each is about a centimetre thick, lacquered to a soft sheen on top and left lightly matte underneath so it does not slide.",
        "The ten-centimetre square suits a water glass, a coffee cup or a tea bowl alike. Stacked, they make one low pile that takes almost no room on a table.",
        "This is a new design still being finished, but the first batch is made and in stock.",
      ],
      care: [
        "Wipe spills away at once with a soft cloth",
        "Never soak",
        "Store stacked rather than standing on edge",
      ],
    },
  },
];

/**
 * A synthetic actor for the workflow. Nothing here creates or implies a user
 * account: it is an in-memory permission set so the command service can run
 * outside a request, and the audit trail records the seed as the author.
 */
const SEED_CONTEXT: AccessContext = {
  actorType: "user",
  userId: "000000000000000000000001",
  userStatus: "active",
  permissions: [
    "content.create",
    "content.read",
    "content.update",
    "content.publish",
  ].map((permission) => ({
    permission: permission as never,
    scope: "all" as const,
    businessUnitIds: [],
    roleKeys: ["seed-script"],
  })),
  authzVersion: 1,
  requestId: "seed-products",
};

const service = new ProductCommandService({
  store: new MongoProductCommandStore(),
  auditRepository: mongoAuditRepository,
  // The revalidation hook in `runtime.ts` calls next/cache, which only exists
  // inside a request. A script has no cache to bust, so this stays empty.
  postCommit: () => undefined,
});

function paragraphBlocks(paragraphs: readonly string[], prefix: string) {
  return paragraphs.map((text, index) => ({
    blockId: `${prefix}-${index + 1}`,
    type: "paragraph" as const,
    text,
  }));
}

function careBlocks(items: readonly string[], blockId: string) {
  return items.length === 0
    ? []
    : [{ blockId, type: "list" as const, style: "unordered", items: [...items] }];
}

function toTranslation(locale: "vi" | "en", entry: SeedTranslation) {
  return {
    locale,
    slug: entry.slug,
    title: entry.title,
    shortDescription: entry.shortDescription,
    description: paragraphBlocks(entry.paragraphs, `d-${locale}`),
    story: [],
    careInstructions: careBlocks(entry.care, `care-${locale}`),
    seo: { noIndex: false },
  };
}

async function createAndPublish(seed: SeedProduct): Promise<void> {
  const translations = [toTranslation("vi", seed.vi), toTranslation("en", seed.en)];

  const created = await service.createDraft(SEED_CONTEXT, {
    metadata: {
      internalId: seed.sku,
      sku: seed.sku,
      categoryKey: seed.categoryKey,
      group: seed.group,
      isAvailable: seed.isAvailable,
      collectionIds: [],
      materialKeys: [],
      finishKeys: [],
      searchTokens: [
        ...new Set(
          [seed.vi.title, seed.en.title]
            .flatMap((title) => title.toLowerCase().split(/\s+/))
            .filter(Boolean),
        ),
      ].slice(0, 100),
    },
    version: {
      dimensions: { ...seed.dimensions, unit: "cm" as const },
      weight: null,
      materials: [...seed.materials],
      colors: [...seed.colors],
      finishes: [...seed.finishes],
      leadTimeDays: seed.leadTimeDays,
      mediaIds: [],
      showPrice: false,
      publicPrice: null,
      relatedProductIds: [],
    },
    translations,
  });

  if (!created.draft) {
    throw new Error(`${seed.sku}: the draft was not created.`);
  }

  const expected = {
    productId: created.product.id,
    expectedProductRevision: created.product.revision,
    versionId: created.draft.version.id,
    expectedVersionRevision: created.draft.version.revision,
    expectedTranslations: created.draft.translations.map((translation) => ({
      locale: translation.locale,
      expectedRevision: translation.revision,
    })),
  };

  const submitted = await service.submitForReview(SEED_CONTEXT, expected);
  if (!submitted.draft) {
    throw new Error(`${seed.sku}: the draft vanished during review.`);
  }

  await service.publish(SEED_CONTEXT, {
    ...expected,
    expectedProductRevision: submitted.product.revision,
    expectedVersionRevision: submitted.draft.version.revision,
    expectedTranslations: submitted.draft.translations.map((translation) => ({
      locale: translation.locale,
      expectedRevision: translation.revision,
    })),
    routes: submitted.draft.translations.map((translation) => ({
      locale: translation.locale,
      path: `/${translation.locale}/products/${translation.slug}`,
    })),
  });
}

async function insert(dryRun: boolean): Promise<void> {
  const existing = new Set(
    (
      await getProductModel()
        .find({ sku: { $regex: `^${SKU_PREFIX}` } })
        .select("sku")
        .lean<{ sku: string }[]>()
        .exec()
    ).map(({ sku }) => sku),
  );

  const pending = SEED_PRODUCTS.filter((seed) => !existing.has(seed.sku));
  if (pending.length === 0) {
    console.info(
      `All ${SEED_PRODUCTS.length} sample products already exist. Nothing to do.`,
    );
    return;
  }

  console.info(
    `${existing.size} already present; creating ${pending.length}: ` +
      pending.map((seed) => seed.sku).join(", "),
  );
  if (dryRun) return;

  for (const seed of pending) {
    await createAndPublish(seed);
    console.info(`  published ${seed.sku} — ${seed.vi.title}`);
  }
}

/**
 * Removes the products and the localized routes they reserved. The route
 * documents have to go too, or re-seeding fails on a path that is still taken
 * by a product that no longer exists.
 */
async function remove(dryRun: boolean): Promise<void> {
  const products = await getProductModel()
    .find({ sku: { $regex: `^${SKU_PREFIX}` } })
    .select("_id sku")
    .lean<{ _id: Types.ObjectId; sku: string }[]>()
    .exec();

  if (products.length === 0) {
    console.info("No SEED- products found. Nothing to remove.");
    return;
  }

  console.info(
    `Removing ${products.length}: ${products.map(({ sku }) => sku).join(", ")}`,
  );
  if (dryRun) return;

  const ids = products.map(({ _id }) => _id);
  const routes = await getLocalizedRouteModel()
    .deleteMany({ entityType: "product", entityId: { $in: ids } })
    .exec();
  const removed = await getProductModel()
    .deleteMany({ _id: { $in: ids } })
    .exec();

  console.info(
    `Removed ${removed.deletedCount} products and ${routes.deletedCount} routes. ` +
      "Versions and translations are orphaned by design; they carry no public " +
      "route and are unreachable without their product.",
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
