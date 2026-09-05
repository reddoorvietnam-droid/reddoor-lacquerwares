import { describe, expect, it, vi } from "vitest";

import type {
  AuditEventInput,
  AuditRepository,
} from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  generateQuoteRequestCode,
  QuoteRequestError,
  type NewQuoteRequestRecord,
  type QuoteRequestDto,
  type QuoteRequestHistoryEntry,
  type QuoteRequestListFilter,
  type QuoteRequestNotificationState,
  type QuoteRequestStatus,
  type QuoteRequestStore,
} from "@/domains/quote-requests/contracts";
import {
  canTransitionQuoteRequest,
  permissionForQuoteRequestTransition,
  QuoteRequestService,
} from "@/domains/quote-requests/service";
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

class FakeStore implements QuoteRequestStore {
  requests = new Map<string, QuoteRequestDto>();
  private sequence = 0;

  async list(filter: QuoteRequestListFilter): Promise<QuoteRequestDto[]> {
    return [...this.requests.values()].filter(
      (request) => !filter.status || request.status === filter.status,
    );
  }

  async findById(requestId: string): Promise<QuoteRequestDto | null> {
    return this.requests.get(requestId) ?? null;
  }

  async insert(record: NewQuoteRequestRecord): Promise<QuoteRequestDto> {
    if (
      [...this.requests.values()].some(
        (request) => request.requestCode === record.requestCode,
      )
    ) {
      throw new QuoteRequestError("DUPLICATE_REQUEST_CODE", "dup");
    }
    const id = `${++this.sequence}`.padStart(24, "c");
    const request: QuoteRequestDto = {
      ...record,
      id,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      revision: 0,
    };
    this.requests.set(id, request);
    return request;
  }

  async applyTransition(input: {
    requestId: string;
    expectedRevision: number;
    to: QuoteRequestStatus;
    historyEntry: QuoteRequestHistoryEntry;
  }): Promise<QuoteRequestDto | null> {
    const request = this.requests.get(input.requestId);
    if (!request || request.revision !== input.expectedRevision) return null;
    const next: QuoteRequestDto = {
      ...request,
      status: input.to,
      history: [...request.history, input.historyEntry],
      revision: request.revision + 1,
    };
    this.requests.set(request.id, next);
    return next;
  }

  async recordNotification(input: {
    requestId: string;
    notifications: QuoteRequestNotificationState;
  }): Promise<void> {
    const request = this.requests.get(input.requestId);
    if (request) {
      this.requests.set(request.id, {
        ...request,
        notifications: input.notifications,
      });
    }
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
  const store = new FakeStore();
  const audit = auditRepository();
  const service = new QuoteRequestService({
    store,
    auditRepository: audit,
    now: () => occurredAt,
  });
  return { store, audit, service };
}

const submission = {
  locale: "en",
  contact: {
    fullName: "Marie Dupont",
    company: "Maison Dupont",
    email: "marie@example.com",
    phone: "+33 6 12 34 56 78",
    country: "France",
  },
  details: {
    requestType: "existing_products",
    items: [
      { productId: "p1", productName: "Lacquer tray", quantity: 200 },
      { productId: null, productName: "Bamboo coasters", quantity: null },
    ],
    estimatedQuantity: null,
    budget: "USD 8–10 / pc",
    deadline: "2026-11-15",
    deliveryTerms: "FOB",
    destination: "Le Havre",
    message:
      "Please quote for a first container of trays for our spring range.",
  },
};

describe("quote request codes", () => {
  it("encodes the date and a four-character suffix", () => {
    expect(generateQuoteRequestCode(occurredAt, () => 0)).toBe(
      "RQ-20260905-AAAA",
    );
  });
});

describe("quote request workflow", () => {
  it("allows only the agreed moves", () => {
    expect(canTransitionQuoteRequest("new", "in_progress")).toBe(true);
    expect(canTransitionQuoteRequest("new", "spam")).toBe(true);
    expect(canTransitionQuoteRequest("in_progress", "quoted")).toBe(true);
    expect(canTransitionQuoteRequest("quoted", "closed")).toBe(true);
    expect(canTransitionQuoteRequest("closed", "in_progress")).toBe(true);
    expect(canTransitionQuoteRequest("closed", "quoted")).toBe(false);
    expect(canTransitionQuoteRequest("spam", "new")).toBe(true);
    expect(canTransitionQuoteRequest("spam", "quoted")).toBe(false);
  });

  it("maps each target status to its own permission", () => {
    expect(permissionForQuoteRequestTransition("in_progress")).toBe(
      "quoteRequests.update",
    );
    expect(permissionForQuoteRequestTransition("quoted")).toBe(
      "quoteRequests.update",
    );
    expect(permissionForQuoteRequestTransition("closed")).toBe(
      "quoteRequests.close",
    );
    expect(permissionForQuoteRequestTransition("spam")).toBe(
      "quoteRequests.markSpam",
    );
    expect(permissionForQuoteRequestTransition("new")).toBe(
      "quoteRequests.markSpam",
    );
  });
});

describe("visitor submission", () => {
  it("stores the request as new with a code, history and audit trail", async () => {
    const { audit, service } = build();

    const request = await service.submit(submission);

    expect(request.requestCode).toMatch(/^RQ-20260905-[A-Z2-9]{4}$/);
    expect(request.status).toBe("new");
    expect(request.contact.company).toBe("Maison Dupont");
    expect(request.details.items).toHaveLength(2);
    expect(request.details.items[1]?.productId).toBeNull();
    expect(request.details.deliveryTerms).toBe("FOB");
    expect(request.history).toEqual([
      { from: null, to: "new", byUserId: null, reason: null, at: occurredAt },
    ]);
    expect(request.notifications.adminSentAt).toBeNull();
    expect(audit.events.map((event) => event.action)).toEqual([
      "quoteRequest.submitted",
    ]);
    expect(audit.events[0]?.actor).toEqual({
      type: "system",
      systemName: "public-contact",
    });
  });

  it("turns blank optional fields into nulls", async () => {
    const { service } = build();

    const request = await service.submit({
      ...submission,
      contact: { ...submission.contact, company: "", phone: "" },
      details: {
        ...submission.details,
        items: [],
        budget: "   ",
        deadline: null,
        deliveryTerms: null,
        destination: "",
      },
    });

    expect(request.contact.company).toBeNull();
    expect(request.contact.phone).toBeNull();
    expect(request.details.budget).toBeNull();
    expect(request.details.destination).toBeNull();
    expect(request.details.items).toEqual([]);
  });

  it("rejects an unknown locale, a short message and a bad email", async () => {
    const { service } = build();

    await expect(
      service.submit({ ...submission, locale: "xx" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.submit({
        ...submission,
        details: { ...submission.details, message: "short" },
      }),
    ).rejects.toThrow();
    await expect(
      service.submit({
        ...submission,
        contact: { ...submission.contact, email: "not-an-email" },
      }),
    ).rejects.toThrow();
  });

  it("retries once on a request-code collision", async () => {
    const { store, service } = build();
    const first = await service.submit(submission);
    // Force the next generated code to collide with the first one.
    const insert = store.insert.bind(store);
    let attempts = 0;
    store.insert = async (record) => {
      attempts += 1;
      return insert(
        attempts === 1 ? { ...record, requestCode: first.requestCode } : record,
      );
    };

    const second = await service.submit(submission);

    expect(attempts).toBe(2);
    expect(second.requestCode).not.toBe(first.requestCode);
  });
});

describe("staff handling", () => {
  it("hides the inbox from anyone without the read permission", async () => {
    const { service } = build();
    await service.submit(submission);

    await expect(service.list(accessContext([]))).rejects.toBeInstanceOf(
      ContentAccessDeniedError,
    );
    await expect(
      service.list(accessContext(["quoteRequests.read"])),
    ).resolves.toHaveLength(1);
  });

  it("moves a request through handling with the matching permissions", async () => {
    const { audit, service } = build();
    const request = await service.submit(submission);
    const handler = accessContext([
      "quoteRequests.read",
      "quoteRequests.update",
      "quoteRequests.close",
    ]);

    const inProgress = await service.transition(handler, {
      requestId: request.id,
      expectedRevision: request.revision,
      to: "in_progress",
      reason: "Checking factory capacity",
    });
    expect(inProgress.status).toBe("in_progress");
    expect(inProgress.history.at(-1)).toMatchObject({
      from: "new",
      to: "in_progress",
      byUserId: actorId,
      reason: "Checking factory capacity",
    });

    const quoted = await service.transition(handler, {
      requestId: request.id,
      expectedRevision: inProgress.revision,
      to: "quoted",
    });
    expect(quoted.status).toBe("quoted");

    // Spam needs its own permission, which this handler lacks.
    await expect(
      service.transition(handler, {
        requestId: request.id,
        expectedRevision: quoted.revision,
        to: "spam",
      }),
    ).rejects.toBeInstanceOf(ContentAccessDeniedError);

    const closed = await service.transition(handler, {
      requestId: request.id,
      expectedRevision: quoted.revision,
      to: "closed",
    });
    expect(closed.status).toBe("closed");
    expect(
      audit.events.filter(
        (event) => event.action === "quoteRequest.transitioned",
      ),
    ).toHaveLength(3);
  });

  it("refuses stale revisions and illegal moves", async () => {
    const { service } = build();
    const request = await service.submit(submission);
    const handler = accessContext(["quoteRequests.update"]);

    await expect(
      service.transition(handler, {
        requestId: request.id,
        expectedRevision: request.revision + 1,
        to: "in_progress",
      }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT" });

    const quoted = await service.transition(handler, {
      requestId: request.id,
      expectedRevision: request.revision,
      to: "quoted",
    });
    await expect(
      service.transition(accessContext(["quoteRequests.markSpam"]), {
        requestId: request.id,
        expectedRevision: quoted.revision,
        to: "spam",
      }),
    ).rejects.toMatchObject({ code: "STATUS_MISMATCH" });
  });
});
