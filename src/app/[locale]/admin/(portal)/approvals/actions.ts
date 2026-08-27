"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ApprovalError } from "@/domains/approvals/contracts";
import { decisionPermissionFor } from "@/domains/approvals/policy";
import { mongoApprovalRepository } from "@/domains/approvals/mongo-repository";
import { approvalService } from "@/domains/approvals/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";

/**
 * The decision half of the Director approval gate. The permission that may
 * release a request depends on its subject, so the action loads the request
 * first, then guards with exactly that permission — most decision permissions
 * are globally scoped, and the evaluator refuses a unit-narrowed grant.
 */

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof ApprovalError) return error.code;
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));

  let code: string | null = null;

  try {
    const requestId = idSchema.parse(formData.get("requestId"));
    const decision = z
      .enum(["approved", "rejected"])
      .parse(formData.get("decision"));
    const expectedRevision = z.coerce
      .number()
      .int()
      .min(0)
      .parse(formData.get("expectedRevision"));
    const decisionReason =
      String(formData.get("decisionReason") ?? "").trim() || null;

    const request = await mongoApprovalRepository.findById(requestId);
    if (!request) {
      throw new ApprovalError("NOT_FOUND", "Approval request not found.");
    }

    const context = await requirePermission(
      decisionPermissionFor(request.subject),
      {
        resourceId: request.resourceId,
        businessUnitIds: request.businessUnitIds,
      },
    );

    await approvalService.decide(context, {
      requestId,
      decision,
      decisionReason,
      expectedRevision,
    });
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  const suffix = code ? `?error=${code}` : "?notice=decided";
  redirect(`/${locale}/admin/approvals${suffix}` as Route);
}
