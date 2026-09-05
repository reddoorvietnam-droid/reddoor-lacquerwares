import type { AuditActor, AuditRepository } from "@/domains/audit/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  generateQuoteRequestCode,
  QuoteRequestError,
  submitQuoteRequestSchema,
  type AccessContext,
  type NewQuoteRequestRecord,
  type QuoteRequestDto,
  type QuoteRequestListFilter,
  type QuoteRequestServiceDependencies,
  type QuoteRequestStatus,
  type QuoteRequestStore,
} from "@/domains/quote-requests/contracts";
import { ContentAccessDeniedError } from "@/lib/auth/authorization";
import { isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Visitors submit without an account — the caller owns the honeypot and the
 * rate limit, this service the validation and the record. Staff verbs
 * re-check the permission on the context they are handed, and each
 * transition maps to its own permission so "close" and "mark spam" can be
 * granted separately from ordinary handling.
 */

const transitions: Record<QuoteRequestStatus, readonly QuoteRequestStatus[]> = {
  new: ["in_progress", "quoted", "closed", "spam"],
  in_progress: ["quoted", "closed", "spam"],
  quoted: ["in_progress", "closed"],
  closed: ["in_progress"],
  spam: ["new"],
};

export function canTransitionQuoteRequest(
  from: QuoteRequestStatus,
  to: QuoteRequestStatus,
): boolean {
  return transitions[from].includes(to);
}

export function allowedQuoteRequestTransitions(
  from: QuoteRequestStatus,
): readonly QuoteRequestStatus[] {
  return transitions[from];
}

export type QuoteRequestTransitionPermission = Extract<
  Permission,
  "quoteRequests.update" | "quoteRequests.close" | "quoteRequests.markSpam"
>;

/** The permission a transition needs; restoring from spam is the spam verb. */
export function permissionForQuoteRequestTransition(
  to: QuoteRequestStatus,
): QuoteRequestTransitionPermission {
  switch (to) {
    case "closed":
      return "quoteRequests.close";
    case "spam":
    case "new":
      return "quoteRequests.markSpam";
    default:
      return "quoteRequests.update";
  }
}

function requireGranted(context: AccessContext, permission: Permission): void {
  const granted = context.permissions.find(
    (candidate) => candidate.permission === permission,
  );
  if (!granted || context.userStatus !== "active") {
    throw new ContentAccessDeniedError("PERMISSION_DENIED");
  }
}

function requireRequest(request: QuoteRequestDto | null): QuoteRequestDto {
  if (!request) {
    throw new QuoteRequestError("NOT_FOUND", "Quote request not found.");
  }
  return request;
}

export class QuoteRequestService {
  readonly #store: QuoteRequestStore;
  readonly #audit: AuditRepository;
  readonly #now: () => Date;

  constructor(dependencies: QuoteRequestServiceDependencies) {
    this.#store = dependencies.store;
    this.#audit = dependencies.auditRepository;
    this.#now = dependencies.now ?? (() => new Date());
  }

  /* ---------------------------------------------------------------- */
  /* Visitor                                                           */
  /* ---------------------------------------------------------------- */

  async submit(input: unknown): Promise<QuoteRequestDto> {
    const parsed = submitQuoteRequestSchema.parse(input);
    if (!isLocale(parsed.locale)) {
      throw new QuoteRequestError("INVALID_INPUT", "Unknown locale.");
    }
    const locale: Locale = parsed.locale;
    const occurredAt = this.#now();
    const record: NewQuoteRequestRecord = {
      requestCode: generateQuoteRequestCode(occurredAt),
      contact: parsed.contact,
      details: parsed.details,
      locale,
      status: "new",
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
    let request: QuoteRequestDto;
    try {
      request = await this.#store.insert(record);
    } catch (error) {
      if (
        error instanceof QuoteRequestError &&
        error.code === "DUPLICATE_REQUEST_CODE"
      ) {
        request = await this.#store.insert({
          ...record,
          requestCode: generateQuoteRequestCode(occurredAt),
        });
      } else {
        throw error;
      }
    }

    await this.#appendAudit(
      { type: "system", systemName: "public-contact" },
      "quoteRequest.submitted",
      request.id,
      `quote-request-${request.id}`,
      occurredAt,
      {
        after: {
          requestCode: request.requestCode,
          requestType: request.details.requestType,
          items: request.details.items.length,
          email: request.contact.email,
        },
      },
    );
    return request;
  }

  /* ---------------------------------------------------------------- */
  /* Staff                                                             */
  /* ---------------------------------------------------------------- */

  async list(
    context: AccessContext,
    filter: QuoteRequestListFilter = {},
  ): Promise<QuoteRequestDto[]> {
    requireGranted(context, "quoteRequests.read");
    return this.#store.list(filter);
  }

  async read(
    context: AccessContext,
    requestId: string,
  ): Promise<QuoteRequestDto | null> {
    requireGranted(context, "quoteRequests.read");
    return this.#store.findById(requestId);
  }

  async transition(
    context: AccessContext,
    input: {
      requestId: string;
      expectedRevision: number;
      to: QuoteRequestStatus;
      reason?: string | null;
    },
  ): Promise<QuoteRequestDto> {
    requireGranted(context, permissionForQuoteRequestTransition(input.to));
    const before = requireRequest(await this.#store.findById(input.requestId));
    if (before.revision !== input.expectedRevision) {
      throw new QuoteRequestError(
        "REVISION_CONFLICT",
        "The request changed while you were looking at it.",
      );
    }
    if (!canTransitionQuoteRequest(before.status, input.to)) {
      throw new QuoteRequestError(
        "STATUS_MISMATCH",
        `A request cannot move from ${before.status} to ${input.to}.`,
      );
    }

    const occurredAt = this.#now();
    const request = await this.#store.applyTransition({
      requestId: before.id,
      expectedRevision: before.revision,
      to: input.to,
      historyEntry: {
        from: before.status,
        to: input.to,
        byUserId: context.userId,
        reason: input.reason?.trim() ? input.reason.trim() : null,
        at: occurredAt,
      },
      updatedBy: context.userId,
    });
    if (!request) {
      throw new QuoteRequestError(
        "REVISION_CONFLICT",
        "The request changed while you were looking at it.",
      );
    }

    await this.#appendAudit(
      { type: "user", userId: context.userId },
      "quoteRequest.transitioned",
      request.id,
      context.requestId,
      occurredAt,
      { before: { status: before.status }, after: { status: request.status } },
    );
    return request;
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
        resourceType: "quoteRequest",
        resourceId,
        requestId,
        changes,
        occurredAt,
      });
    } catch (error) {
      // The write has committed; a missing audit row is logged, not fatal.
      console.error("[quote-requests] audit append failed", {
        action,
        resourceId,
        error,
      });
    }
  }
}
