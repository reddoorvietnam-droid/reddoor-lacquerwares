import type { AuditActor, AuditRepository } from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  generateShopOrderCode,
  placeShopOrderSchema,
  ShopError,
  shopCurrencyForLocale,
  shopItemImagesSchema,
  shopItemWriteSchema,
  shopTextLocaleFor,
  type AccessContext,
  type NewShopOrderRecord,
  type ShopItemDto,
  type ShopItemStatus,
  type ShopItemStore,
  type ShopOrderDto,
  type ShopOrderListFilter,
  type ShopOrderStatus,
  type ShopOrderStore,
  type ShopPostCommitEvent,
  type ShopServiceDependencies,
} from "@/domains/shop/contracts";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { money, multiply } from "@/lib/money";

/**
 * The retail shop's command surface: staff manage items and move guest
 * orders through their four states; visitors place orders without an
 * account.
 *
 * Every staff verb re-checks the permission on the context it is handed,
 * so a page that resolved `shop.read` cannot be reused to write. Guest
 * order placement carries no context at all — the caller is responsible for
 * the honeypot and the rate limit, this service for the business rules.
 */

const shopOrderTransitions: Record<
  ShopOrderStatus,
  readonly ShopOrderStatus[]
> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionShopOrder(
  from: ShopOrderStatus,
  to: ShopOrderStatus,
): boolean {
  return shopOrderTransitions[from].includes(to);
}

export function allowedShopOrderTransitions(
  from: ShopOrderStatus,
): readonly ShopOrderStatus[] {
  return shopOrderTransitions[from];
}

function requireGranted(
  context: AccessContext,
  permission: Permission,
  options: { global?: boolean } = {},
): void {
  const granted = context.permissions.find(
    (candidate) => candidate.permission === permission,
  );
  if (!granted || context.userStatus !== "active") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
  if (options.global && granted.scope !== "all") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
}

function requireItem(item: ShopItemDto | null): ShopItemDto {
  if (!item) throw new ShopError("NOT_FOUND", "Shop item not found.");
  return item;
}

function requireOrder(order: ShopOrderDto | null): ShopOrderDto {
  if (!order) throw new ShopError("NOT_FOUND", "Shop order not found.");
  return order;
}

export class ShopService {
  readonly #items: ShopItemStore;
  readonly #orders: ShopOrderStore;
  readonly #audit: AuditRepository;
  readonly #now: () => Date;
  readonly #postCommit: ShopServiceDependencies["postCommit"];

  constructor(dependencies: ShopServiceDependencies) {
    this.#items = dependencies.itemStore;
    this.#orders = dependencies.orderStore;
    this.#audit = dependencies.auditRepository;
    this.#now = dependencies.now ?? (() => new Date());
    this.#postCommit = dependencies.postCommit;
  }

  /* ---------------------------------------------------------------- */
  /* Items                                                             */
  /* ---------------------------------------------------------------- */

  async listItems(context: AccessContext): Promise<ShopItemDto[]> {
    requireGranted(context, "shop.read");
    return this.#items.list({});
  }

  async readItem(
    context: AccessContext,
    itemId: string,
  ): Promise<ShopItemDto | null> {
    requireGranted(context, "shop.read");
    return this.#items.findById(itemId);
  }

  async createItem(
    context: AccessContext,
    input: unknown,
  ): Promise<ShopItemDto> {
    requireGranted(context, "shop.manage");
    const data = shopItemWriteSchema.parse(input);
    const occurredAt = this.#now();
    const item = await this.#items.insert({
      data,
      actorId: context.userId,
      occurredAt,
    });
    await this.#afterCommit(context, "shopItem.created", item.id, occurredAt, {
      after: { slug: item.slug, status: item.status },
    });
    await this.#emit({ kind: "itemChanged", itemId: item.id, slug: item.slug });
    return item;
  }

  async updateItem(
    context: AccessContext,
    input: { itemId: string; expectedRevision: number; data: unknown },
  ): Promise<ShopItemDto> {
    requireGranted(context, "shop.manage");
    const data = shopItemWriteSchema.parse(input.data);
    const before = requireItem(await this.#items.findById(input.itemId));
    const occurredAt = this.#now();
    const item = await this.#items.update({
      itemId: before.id,
      expectedRevision: input.expectedRevision,
      data,
      actorId: context.userId,
      occurredAt,
    });
    if (!item) {
      throw new ShopError(
        "REVISION_CONFLICT",
        "The shop item changed while you were editing it.",
      );
    }
    await this.#afterCommit(context, "shopItem.updated", item.id, occurredAt, {
      before: { slug: before.slug, stockQuantity: before.stockQuantity },
      after: { slug: item.slug, stockQuantity: item.stockQuantity },
    });
    await this.#emit({ kind: "itemChanged", itemId: item.id, slug: item.slug });
    if (before.slug !== item.slug) {
      await this.#emit({
        kind: "itemChanged",
        itemId: item.id,
        slug: before.slug,
      });
    }
    return item;
  }

  async setItemStatus(
    context: AccessContext,
    input: { itemId: string; status: ShopItemStatus },
  ): Promise<ShopItemDto> {
    // Putting an item on sale is the commercial act; taking it down or
    // parking it as a draft is ordinary management.
    if (input.status === "live") {
      requireGranted(context, "shop.publish", { global: true });
    } else {
      requireGranted(context, "shop.manage");
    }
    const before = requireItem(await this.#items.findById(input.itemId));
    if (input.status === "live" && !before.text.vi.name.trim()) {
      throw new ShopError(
        "EMPTY_CONTENT",
        "A shop item needs a Vietnamese name before it goes on sale.",
      );
    }
    const occurredAt = this.#now();
    const item = requireItem(
      await this.#items.setStatus({
        itemId: before.id,
        status: input.status,
        actorId: context.userId,
        occurredAt,
      }),
    );
    await this.#afterCommit(
      context,
      `shopItem.${input.status === "live" ? "published" : "statusChanged"}`,
      item.id,
      occurredAt,
      { before: { status: before.status }, after: { status: item.status } },
    );
    await this.#emit({ kind: "itemChanged", itemId: item.id, slug: item.slug });
    return item;
  }

  async setItemImages(
    context: AccessContext,
    input: { itemId: string; images: unknown },
  ): Promise<ShopItemDto> {
    requireGranted(context, "shop.manage");
    const images = shopItemImagesSchema.parse(input.images);
    const before = requireItem(await this.#items.findById(input.itemId));
    const occurredAt = this.#now();
    const item = requireItem(
      await this.#items.setImages({
        itemId: before.id,
        images,
        actorId: context.userId,
        occurredAt,
      }),
    );
    await this.#afterCommit(
      context,
      "shopItem.imagesChanged",
      item.id,
      occurredAt,
      {
        before: { count: before.images.length },
        after: { count: item.images.length },
      },
    );
    await this.#emit({ kind: "itemChanged", itemId: item.id, slug: item.slug });
    return item;
  }

  async deleteItem(context: AccessContext, itemId: string): Promise<void> {
    requireGranted(context, "shop.manage");
    const before = requireItem(await this.#items.findById(itemId));
    const occurredAt = this.#now();
    const deleted = await this.#items.softDelete({
      itemId: before.id,
      actorId: context.userId,
      occurredAt,
    });
    if (!deleted) throw new ShopError("NOT_FOUND", "Shop item not found.");
    await this.#afterCommit(
      context,
      "shopItem.deleted",
      before.id,
      occurredAt,
      {
        before: { slug: before.slug, status: before.status },
      },
    );
    await this.#emit({
      kind: "itemChanged",
      itemId: before.id,
      slug: before.slug,
    });
  }

  /* ---------------------------------------------------------------- */
  /* Guest orders                                                      */
  /* ---------------------------------------------------------------- */

  async placeOrder(input: unknown): Promise<ShopOrderDto> {
    const parsed = placeShopOrderSchema.parse(input);
    if (!isLocale(parsed.locale)) {
      throw new ShopError("INVALID_INPUT", "Unknown locale.");
    }
    const locale: Locale = parsed.locale;

    const item = requireItem(await this.#items.findById(parsed.itemId));
    if (item.status !== "live") {
      throw new ShopError("ITEM_NOT_LIVE", "This item is not on sale.");
    }
    if (item.stockQuantity <= 0) {
      throw new ShopError("SOLD_OUT", "This item is sold out.");
    }
    if (parsed.quantity > item.stockQuantity) {
      throw new ShopError(
        "INSUFFICIENT_STOCK",
        "Not enough stock for that quantity.",
      );
    }

    const currency = shopCurrencyForLocale(locale);
    const unitPrice = money(
      currency === "VND" ? item.priceVnd : item.priceUsd,
      currency,
    );
    const total = multiply(unitPrice, String(parsed.quantity));
    const textLocale = shopTextLocaleFor(locale);
    const itemName = item.text[textLocale].name.trim() || item.text.vi.name;
    const occurredAt = this.#now();

    const record: NewShopOrderRecord = {
      orderCode: generateShopOrderCode(occurredAt),
      itemId: item.id,
      itemSlug: item.slug,
      itemName,
      quantity: parsed.quantity,
      unitPrice: { amount: unitPrice.amount, currency },
      total: { amount: total.amount, currency },
      customer: {
        fullName: parsed.customer.fullName,
        phone: parsed.customer.phone,
        email: parsed.customer.email,
        address: parsed.customer.address,
        note: parsed.customer.note?.trim() ? parsed.customer.note.trim() : null,
      },
      locale,
      status: "new",
      stockDeducted: false,
      history: [
        { from: null, to: "new", byUserId: null, reason: null, at: occurredAt },
      ],
      notifications: {
        adminSentAt: null,
        customerSentAt: null,
        lastError: null,
      },
    };

    // A code collision is a one-in-a-million retry, not a failure.
    let order: ShopOrderDto;
    try {
      order = await this.#orders.insert(record);
    } catch (error) {
      if (error instanceof ShopError && error.code === "DUPLICATE_ORDER_CODE") {
        order = await this.#orders.insert({
          ...record,
          orderCode: generateShopOrderCode(occurredAt),
        });
      } else {
        throw error;
      }
    }

    await this.#appendAudit(
      { type: "system", systemName: "public-shop" },
      "shopOrder.placed",
      order.id,
      `shop-order-${order.id}`,
      occurredAt,
      {
        after: {
          orderCode: order.orderCode,
          itemId: order.itemId,
          quantity: order.quantity,
          total: order.total,
        },
      },
    );
    await this.#emit({
      kind: "orderPlaced",
      orderId: order.id,
      itemId: item.id,
    });
    return order;
  }

  /* ---------------------------------------------------------------- */
  /* Staff order handling                                              */
  /* ---------------------------------------------------------------- */

  async listOrders(
    context: AccessContext,
    filter: ShopOrderListFilter = {},
  ): Promise<ShopOrderDto[]> {
    requireGranted(context, "shopOrders.read");
    return this.#orders.list(filter);
  }

  async readOrder(
    context: AccessContext,
    orderId: string,
  ): Promise<ShopOrderDto | null> {
    requireGranted(context, "shopOrders.read");
    return this.#orders.findById(orderId);
  }

  async transitionOrder(
    context: AccessContext,
    input: {
      orderId: string;
      expectedRevision: number;
      to: ShopOrderStatus;
      reason?: string | null;
    },
  ): Promise<ShopOrderDto> {
    requireGranted(context, "shopOrders.manage");
    const before = requireOrder(await this.#orders.findById(input.orderId));
    if (before.revision !== input.expectedRevision) {
      throw new ShopError(
        "REVISION_CONFLICT",
        "The order changed while you were looking at it.",
      );
    }
    if (!canTransitionShopOrder(before.status, input.to)) {
      throw new ShopError(
        "STATUS_MISMATCH",
        `An order cannot move from ${before.status} to ${input.to}.`,
      );
    }

    const occurredAt = this.#now();
    let stockDeducted = before.stockDeducted;

    // Stock moves with confirmation, not with placement, so an order nobody
    // ever confirms never hides units from the next visitor. Cancelling a
    // confirmed order gives the units back.
    if (input.to === "confirmed" && !before.stockDeducted) {
      const adjusted = await this.#items.adjustStock({
        itemId: before.itemId,
        delta: -before.quantity,
        actorId: context.userId,
        occurredAt,
      });
      if (!adjusted) {
        throw new ShopError(
          "INSUFFICIENT_STOCK",
          "Not enough stock left to confirm this order.",
        );
      }
      stockDeducted = true;
    } else if (input.to === "cancelled" && before.stockDeducted) {
      await this.#items.adjustStock({
        itemId: before.itemId,
        delta: before.quantity,
        actorId: context.userId,
        occurredAt,
      });
      stockDeducted = false;
    }

    const order = await this.#orders.applyTransition({
      orderId: before.id,
      expectedRevision: before.revision,
      to: input.to,
      stockDeducted,
      historyEntry: {
        from: before.status,
        to: input.to,
        byUserId: context.userId,
        reason: input.reason?.trim() ? input.reason.trim() : null,
        at: occurredAt,
      },
      updatedBy: context.userId,
    });
    if (!order) {
      // The record moved on between our read and our write. Undo the stock
      // move we just made so the shelf count stays honest.
      if (stockDeducted !== before.stockDeducted) {
        await this.#items.adjustStock({
          itemId: before.itemId,
          delta: stockDeducted ? before.quantity : -before.quantity,
          actorId: context.userId,
          occurredAt,
        });
      }
      throw new ShopError(
        "REVISION_CONFLICT",
        "The order changed while you were looking at it.",
      );
    }

    await this.#afterCommit(
      context,
      `shopOrder.${input.to}`,
      order.id,
      occurredAt,
      {
        before: { status: before.status, stockDeducted: before.stockDeducted },
        after: { status: order.status, stockDeducted: order.stockDeducted },
      },
    );
    await this.#emit({
      kind: "orderTransitioned",
      orderId: order.id,
      itemId: order.itemId,
    });
    return order;
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                         */
  /* ---------------------------------------------------------------- */

  async #afterCommit(
    context: AccessContext,
    action: string,
    resourceId: string,
    occurredAt: Date,
    changes: { before?: unknown; after?: unknown },
  ): Promise<void> {
    await this.#appendAudit(
      { type: "user", userId: context.userId },
      action,
      resourceId,
      context.requestId,
      occurredAt,
      changes,
    );
  }

  async #appendAudit(
    actor: AuditActor,
    action: string,
    resourceId: string,
    requestId: string,
    occurredAt: Date,
    changes: { before?: unknown; after?: unknown },
  ): Promise<void> {
    try {
      await this.#audit.append({
        actor,
        action,
        resourceType: action.startsWith("shopOrder") ? "shopOrder" : "shopItem",
        resourceId,
        requestId,
        changes,
        occurredAt,
      });
    } catch (error) {
      // The write has committed; a missing audit row is logged, not fatal.
      console.error("[shop] audit append failed", {
        action,
        resourceId,
        error,
      });
    }
  }

  async #emit(event: ShopPostCommitEvent): Promise<void> {
    if (!this.#postCommit) return;
    try {
      await this.#postCommit(event);
    } catch (error) {
      console.error("[shop] post-commit hook failed", { event, error });
    }
  }
}
