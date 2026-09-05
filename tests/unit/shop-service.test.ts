import { describe, expect, it, vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  generateShopOrderCode,
  ShopError,
  type NewShopOrderRecord,
  type ShopItemDto,
  type ShopItemImagesInput,
  type ShopItemListFilter,
  type ShopItemStatus,
  type ShopItemStore,
  type ShopItemWriteInput,
  type ShopOrderDto,
  type ShopOrderHistoryEntry,
  type ShopOrderListFilter,
  type ShopOrderNotificationState,
  type ShopOrderStatus,
  type ShopOrderStore,
} from "@/domains/shop/contracts";
import { canTransitionShopOrder, ShopService } from "@/domains/shop/service";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import type {
  AccessContext,
  EffectivePermission,
} from "@/lib/auth/authorization";

const actorId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const occurredAt = new Date("2026-09-05T09:30:00.000Z");

function accessContext(
  permissions: readonly Permission[],
  scope: EffectivePermission["scope"] = "all",
): AccessContext {
  return {
    actorType: "user",
    userId: actorId,
    userStatus: "active",
    authzVersion: 1,
    requestId: "request-123",
    permissions: permissions.map((permission) => ({
      permission,
      scope,
      businessUnitIds: [],
      roleKeys: ["TEST"],
    })),
  };
}

class FakeItemStore implements ShopItemStore {
  items = new Map<string, ShopItemDto>();
  private sequence = 0;

  seed(partial: Partial<ShopItemDto> = {}): ShopItemDto {
    const id = partial.id ?? `${++this.sequence}`.padStart(24, "0");
    const item: ShopItemDto = {
      id,
      slug: partial.slug ?? `item-${this.sequence}`,
      status: partial.status ?? "live",
      text: partial.text ?? {
        vi: { name: "Khay sơn mài", summary: "", description: "" },
        en: { name: "Lacquer tray", summary: "", description: "" },
      },
      priceVnd: partial.priceVnd ?? "1500000",
      priceUsd: partial.priceUsd ?? "59.00",
      stockQuantity: partial.stockQuantity ?? 5,
      categoryKey: "",
      images: [],
      sortOrder: 0,
      publishedAt: null,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: partial.revision ?? 0,
    };
    this.items.set(id, item);
    return item;
  }

  async list(filter: ShopItemListFilter): Promise<ShopItemDto[]> {
    return [...this.items.values()].filter(
      (item) => !filter.status || item.status === filter.status,
    );
  }

  async findById(itemId: string): Promise<ShopItemDto | null> {
    return this.items.get(itemId) ?? null;
  }

  async insert(input: {
    data: ShopItemWriteInput;
    actorId: string;
  }): Promise<ShopItemDto> {
    if (
      [...this.items.values()].some((item) => item.slug === input.data.slug)
    ) {
      throw new ShopError("SLUG_UNAVAILABLE", "taken");
    }
    return this.seed({
      slug: input.data.slug,
      status: "draft",
      text: input.data.text,
      priceVnd: input.data.priceVnd,
      priceUsd: input.data.priceUsd,
      stockQuantity: input.data.stockQuantity,
    });
  }

  async update(input: {
    itemId: string;
    expectedRevision: number;
    data: ShopItemWriteInput;
  }): Promise<ShopItemDto | null> {
    const item = this.items.get(input.itemId);
    if (!item || item.revision !== input.expectedRevision) return null;
    const next = {
      ...item,
      slug: input.data.slug,
      text: input.data.text,
      priceVnd: input.data.priceVnd,
      priceUsd: input.data.priceUsd,
      stockQuantity: input.data.stockQuantity,
      revision: item.revision + 1,
    };
    this.items.set(item.id, next);
    return next;
  }

  async setStatus(input: {
    itemId: string;
    status: ShopItemStatus;
  }): Promise<ShopItemDto | null> {
    const item = this.items.get(input.itemId);
    if (!item) return null;
    const next = { ...item, status: input.status, revision: item.revision + 1 };
    this.items.set(item.id, next);
    return next;
  }

  async setImages(input: {
    itemId: string;
    images: ShopItemImagesInput;
  }): Promise<ShopItemDto | null> {
    const item = this.items.get(input.itemId);
    if (!item) return null;
    const next = { ...item, images: input.images, revision: item.revision + 1 };
    this.items.set(item.id, next);
    return next;
  }

  async softDelete(input: { itemId: string }): Promise<boolean> {
    return this.items.delete(input.itemId);
  }

  async adjustStock(input: {
    itemId: string;
    delta: number;
    actorId: string | null;
    occurredAt: Date;
  }): Promise<ShopItemDto | null> {
    const item = this.items.get(input.itemId);
    if (!item) return null;
    if (item.stockQuantity + input.delta < 0) return null;
    const next = {
      ...item,
      stockQuantity: item.stockQuantity + input.delta,
      revision: item.revision + 1,
    };
    this.items.set(item.id, next);
    return next;
  }
}

class FakeOrderStore implements ShopOrderStore {
  orders = new Map<string, ShopOrderDto>();
  private sequence = 0;

  async list(filter: ShopOrderListFilter): Promise<ShopOrderDto[]> {
    return [...this.orders.values()].filter(
      (order) => !filter.status || order.status === filter.status,
    );
  }

  async findById(orderId: string): Promise<ShopOrderDto | null> {
    return this.orders.get(orderId) ?? null;
  }

  async insert(record: NewShopOrderRecord): Promise<ShopOrderDto> {
    if (
      [...this.orders.values()].some((o) => o.orderCode === record.orderCode)
    ) {
      throw new ShopError("DUPLICATE_ORDER_CODE", "dup");
    }
    const id = `${++this.sequence}`.padStart(24, "b");
    const order: ShopOrderDto = {
      ...record,
      id,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: 0,
    };
    this.orders.set(id, order);
    return order;
  }

  async applyTransition(input: {
    orderId: string;
    expectedRevision: number;
    to: ShopOrderStatus;
    stockDeducted: boolean;
    historyEntry: ShopOrderHistoryEntry;
  }): Promise<ShopOrderDto | null> {
    const order = this.orders.get(input.orderId);
    if (!order || order.revision !== input.expectedRevision) return null;
    const next: ShopOrderDto = {
      ...order,
      status: input.to,
      stockDeducted: input.stockDeducted,
      history: [...order.history, input.historyEntry],
      revision: order.revision + 1,
    };
    this.orders.set(order.id, next);
    return next;
  }

  async recordNotification(input: {
    orderId: string;
    notifications: ShopOrderNotificationState;
  }): Promise<void> {
    const order = this.orders.get(input.orderId);
    if (order)
      this.orders.set(order.id, {
        ...order,
        notifications: input.notifications,
      });
  }
}

function auditRepository(): AuditRepository & { events: AuditEventInput[] } {
  const events: AuditEventInput[] = [];
  return {
    events,
    append: vi.fn(async (event: AuditEventInput) => {
      events.push(event);
      return { id: `audit-${events.length}`, occurredAt: event.occurredAt };
    }),
  };
}

function build() {
  const itemStore = new FakeItemStore();
  const orderStore = new FakeOrderStore();
  const audit = auditRepository();
  const service = new ShopService({
    itemStore,
    orderStore,
    auditRepository: audit,
    now: () => occurredAt,
  });
  return { itemStore, orderStore, audit, service };
}

const customer = {
  fullName: "Nguyễn Văn A",
  phone: "+84 912 345 678",
  email: "a@example.com",
  address: "12 Phố Huế, Hà Nội",
};

describe("shop order codes", () => {
  it("encodes the date and a four-character suffix", () => {
    const code = generateShopOrderCode(occurredAt, () => 0);
    expect(code).toBe("SH-20260905-AAAA");
  });
});

describe("shop order workflow", () => {
  it("allows only the agreed moves", () => {
    expect(canTransitionShopOrder("new", "confirmed")).toBe(true);
    expect(canTransitionShopOrder("new", "cancelled")).toBe(true);
    expect(canTransitionShopOrder("new", "completed")).toBe(false);
    expect(canTransitionShopOrder("confirmed", "completed")).toBe(true);
    expect(canTransitionShopOrder("confirmed", "cancelled")).toBe(true);
    expect(canTransitionShopOrder("completed", "cancelled")).toBe(false);
    expect(canTransitionShopOrder("cancelled", "new")).toBe(false);
  });
});

describe("guest order placement", () => {
  it("prices a Vietnamese order in VND and an English one in USD", async () => {
    const { itemStore, service } = build();
    const item = itemStore.seed({ stockQuantity: 10 });

    const vietnamese = await service.placeOrder({
      itemId: item.id,
      locale: "vi",
      quantity: 2,
      customer,
    });
    expect(vietnamese.unitPrice).toEqual({
      amount: "1500000",
      currency: "VND",
    });
    expect(vietnamese.total).toEqual({ amount: "3000000", currency: "VND" });
    expect(vietnamese.itemName).toBe("Khay sơn mài");
    expect(vietnamese.status).toBe("new");
    expect(vietnamese.stockDeducted).toBe(false);

    const french = await service.placeOrder({
      itemId: item.id,
      locale: "fr",
      quantity: 3,
      customer,
    });
    expect(french.unitPrice).toEqual({ amount: "59.00", currency: "USD" });
    expect(french.total).toEqual({ amount: "177.00", currency: "USD" });
    expect(french.itemName).toBe("Lacquer tray");
  });

  it("does not touch stock when an order is placed", async () => {
    const { itemStore, service } = build();
    const item = itemStore.seed({ stockQuantity: 4 });
    await service.placeOrder({
      itemId: item.id,
      locale: "vi",
      quantity: 4,
      customer,
    });
    expect((await itemStore.findById(item.id))?.stockQuantity).toBe(4);
  });

  it("refuses items that are not on sale, sold out, or short on stock", async () => {
    const { itemStore, service } = build();
    const draft = itemStore.seed({ status: "draft" });
    const soldOut = itemStore.seed({ stockQuantity: 0 });
    const scarce = itemStore.seed({ stockQuantity: 1 });

    await expect(
      service.placeOrder({
        itemId: draft.id,
        locale: "vi",
        quantity: 1,
        customer,
      }),
    ).rejects.toMatchObject({ code: "ITEM_NOT_LIVE" });
    await expect(
      service.placeOrder({
        itemId: soldOut.id,
        locale: "vi",
        quantity: 1,
        customer,
      }),
    ).rejects.toMatchObject({ code: "SOLD_OUT" });
    await expect(
      service.placeOrder({
        itemId: scarce.id,
        locale: "vi",
        quantity: 2,
        customer,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("rejects malformed customer details", async () => {
    const { itemStore, service } = build();
    const item = itemStore.seed();
    await expect(
      service.placeOrder({
        itemId: item.id,
        locale: "vi",
        quantity: 1,
        customer: { ...customer, email: "not-an-email" },
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("records a system audit event for the placement", async () => {
    const { itemStore, audit, service } = build();
    const item = itemStore.seed();
    await service.placeOrder({
      itemId: item.id,
      locale: "en",
      quantity: 1,
      customer,
    });
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.actor).toEqual({
      type: "system",
      systemName: "public-shop",
    });
    expect(audit.events[0]?.action).toBe("shopOrder.placed");
  });
});

describe("staff order handling", () => {
  async function placed(stock = 5) {
    const built = build();
    const item = built.itemStore.seed({ stockQuantity: stock });
    const order = await built.service.placeOrder({
      itemId: item.id,
      locale: "vi",
      quantity: 2,
      customer,
    });
    return { ...built, item, order };
  }

  it("deducts stock on confirmation and restores it on cancellation", async () => {
    const { service, itemStore, item, order } = await placed(5);
    const context = accessContext(["shopOrders.manage"]);

    const confirmed = await service.transitionOrder(context, {
      orderId: order.id,
      expectedRevision: order.revision,
      to: "confirmed",
    });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.stockDeducted).toBe(true);
    expect((await itemStore.findById(item.id))?.stockQuantity).toBe(3);

    const cancelled = await service.transitionOrder(context, {
      orderId: order.id,
      expectedRevision: confirmed.revision,
      to: "cancelled",
      reason: "Khách đổi ý",
    });
    expect(cancelled.stockDeducted).toBe(false);
    expect((await itemStore.findById(item.id))?.stockQuantity).toBe(5);
    expect(cancelled.history.at(-1)?.reason).toBe("Khách đổi ý");
  });

  it("leaves stock alone when a never-confirmed order is cancelled", async () => {
    const { service, itemStore, item, order } = await placed(5);
    await service.transitionOrder(accessContext(["shopOrders.manage"]), {
      orderId: order.id,
      expectedRevision: order.revision,
      to: "cancelled",
    });
    expect((await itemStore.findById(item.id))?.stockQuantity).toBe(5);
  });

  it("refuses to confirm when stock has run out since placement", async () => {
    const { service, itemStore, item, order } = await placed(2);
    await itemStore.adjustStock({
      itemId: item.id,
      delta: -1,
      actorId: null,
      occurredAt,
    });
    await expect(
      service.transitionOrder(accessContext(["shopOrders.manage"]), {
        orderId: order.id,
        expectedRevision: order.revision,
        to: "confirmed",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("rejects illegal moves and stale revisions", async () => {
    const { service, order } = await placed();
    const context = accessContext(["shopOrders.manage"]);
    await expect(
      service.transitionOrder(context, {
        orderId: order.id,
        expectedRevision: order.revision,
        to: "completed",
      }),
    ).rejects.toMatchObject({ code: "STATUS_MISMATCH" });
    await expect(
      service.transitionOrder(context, {
        orderId: order.id,
        expectedRevision: order.revision + 5,
        to: "confirmed",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });

  it("keeps orders away from anyone without the order permissions", async () => {
    const { service, order } = await placed();
    const creator = accessContext(["shop.read", "shop.manage", "shop.publish"]);
    await expect(service.listOrders(creator)).rejects.toBeInstanceOf(
      ContentAccessDeniedError,
    );
    await expect(
      service.transitionOrder(creator, {
        orderId: order.id,
        expectedRevision: order.revision,
        to: "confirmed",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);
  });
});

describe("item management", () => {
  const draft: ShopItemWriteInput = {
    slug: "hop-son-mai",
    text: {
      vi: { name: "Hộp sơn mài", summary: "", description: "" },
      en: { name: "", summary: "", description: "" },
    },
    priceVnd: "800000",
    priceUsd: "32.00",
    stockQuantity: 3,
    categoryKey: "",
    sortOrder: 0,
  };

  it("creates drafts, then needs the global publish grant to go live", async () => {
    const { service } = build();
    const manager = accessContext(["shop.read", "shop.manage"]);
    const item = await service.createItem(manager, draft);
    expect(item.status).toBe("draft");

    await expect(
      service.setItemStatus(manager, { itemId: item.id, status: "live" }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const unitScoped = accessContext(["shop.publish"], "assignedBusinessUnits");
    await expect(
      service.setItemStatus(unitScoped, { itemId: item.id, status: "live" }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const publisher = accessContext(["shop.publish"]);
    const live = await service.setItemStatus(publisher, {
      itemId: item.id,
      status: "live",
    });
    expect(live.status).toBe("live");
  });

  it("refuses to put an item without a Vietnamese name on sale", async () => {
    const { itemStore, service } = build();
    const nameless = itemStore.seed({
      status: "draft",
      text: {
        vi: { name: "   ", summary: "", description: "" },
        en: { name: "Tray", summary: "", description: "" },
      },
    });
    await expect(
      service.setItemStatus(accessContext(["shop.publish"]), {
        itemId: nameless.id,
        status: "live",
      }),
    ).rejects.toMatchObject({ code: "EMPTY_CONTENT" });
  });

  it("validates prices at the currency scale", async () => {
    const { service } = build();
    const manager = accessContext(["shop.manage"]);
    await expect(
      service.createItem(manager, { ...draft, priceVnd: "1500.5" }),
    ).rejects.toBeInstanceOf(Error);
    await expect(
      service.createItem(manager, { ...draft, priceUsd: "12.345" }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("surfaces a stale edit as a revision conflict", async () => {
    const { service } = build();
    const manager = accessContext(["shop.manage"]);
    const item = await service.createItem(manager, draft);
    await expect(
      service.updateItem(manager, {
        itemId: item.id,
        expectedRevision: item.revision + 1,
        data: draft,
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });
  });
});
