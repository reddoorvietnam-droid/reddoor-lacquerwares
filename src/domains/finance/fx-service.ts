import "server-only";

import type { AuditRepository } from "@/domains/audit/contracts";
import {
  setFxRateInputSchema,
  startOfUtcDay,
  type FxRateRecordDto,
  type FxRateStore,
} from "@/domains/finance/contracts";
import type { Permission } from "@/domains/identity/permissions";
import {
  ContentAccessDeniedError,
  type AccessContext,
} from "@/lib/auth/authorization";

export type FxRateServiceDependencies = {
  store: FxRateStore;
  auditRepository: AuditRepository;
  now?: () => Date;
};

export const FX_RATE_RESOURCE_TYPE = "fxRate";

/**
 * The USD→VND rate table the company accountant maintains by day. The
 * system never fetches a rate on its own: the bank and the customs rates
 * differ and which one applies is her call. Invoices snapshot the rate they
 * were issued with, so a later change here never rewrites an issued invoice.
 */
export class FxRateService {
  private readonly dependencies: FxRateServiceDependencies;

  constructor(dependencies: FxRateServiceDependencies) {
    this.dependencies = dependencies;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private assertHolds(context: AccessContext, permission: Permission): void {
    const holds = context.permissions.some(
      (candidate) => candidate.permission === permission,
    );
    if (!holds || context.userStatus !== "active") {
      throw new ContentAccessDeniedError("PERMISSION_DENIED");
    }
  }

  async setRate(
    context: AccessContext,
    rawInput: unknown,
  ): Promise<FxRateRecordDto> {
    this.assertHolds(context, "finance.manageFxSnapshot");
    const input = setFxRateInputSchema.parse(rawInput);

    const record = await this.dependencies.store.upsert({
      date: startOfUtcDay(input.date),
      rate: input.rate,
      source: input.source,
      actorId: context.userId,
    });

    await this.dependencies.auditRepository.append({
      actor: { type: "user", userId: context.userId },
      action: "finance.fxRateSet",
      resourceType: FX_RATE_RESOURCE_TYPE,
      resourceId: record.id,
      requestId: context.requestId,
      metadata: {
        date: record.date.toISOString().slice(0, 10),
        rate: record.rate,
        source: record.source,
      },
      occurredAt: this.now(),
    });

    return record;
  }

  async list(limit = 90): Promise<FxRateRecordDto[]> {
    return this.dependencies.store.list(limit);
  }

  /** The rate in force on a day: the latest entry on or before it. */
  async rateOn(date: Date): Promise<FxRateRecordDto | null> {
    return this.dependencies.store.findLatestOnOrBefore(startOfUtcDay(date));
  }
}
