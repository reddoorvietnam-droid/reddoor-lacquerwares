"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { DocumentActionState } from "@/app/[locale]/admin/(portal)/finance/document-actions";
import { ApprovalError } from "@/domains/approvals/contracts";
import {
  FacilityContractError,
  facilityContractDocumentKinds,
  type FacilityContractDocumentKind,
} from "@/domains/facility-contracts/contracts";
import { facilityContractService } from "@/domains/facility-contracts/runtime";
import { ContentAccessDeniedError, requirePermission } from "@/lib/auth";
import { MoneyError } from "@/lib/money";

/**
 * Server actions behind the production-site contracts. Every action
 * re-authorizes on the server, then hands the input to the service, which
 * re-asserts the permission, the record's status and its revision. Results
 * travel back as a query parameter so the pages stay server-rendered.
 */

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof FacilityContractError) return error.code;
  if (error instanceof ApprovalError) return error.code;
  if (error instanceof MoneyError) return "INVALID_PRICE";
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  console.error("[facility-contracts] action failed", error);
  return "UNAVAILABLE";
}

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "").trim();

function parseLines(raw: string): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function back(
  locale: string,
  contractId: string | null,
  outcome: { error?: string; notice?: string },
): never {
  const query = outcome.error
    ? `?error=${outcome.error}`
    : outcome.notice
      ? `?notice=${outcome.notice}`
      : "";
  const path = contractId
    ? `/${locale}/admin/facility-contracts/${contractId}`
    : `/${locale}/admin/facility-contracts`;
  redirect(`${path}${query}` as Route);
}

function contractFields(formData: FormData) {
  return {
    facilityId: field(formData, "facilityId"),
    orderId: field(formData, "orderId"),
    lines: parseLines(field(formData, "linesJson")),
    startDate: field(formData, "startDate"),
    deliveryDate: field(formData, "deliveryDate"),
    note: field(formData, "note"),
  };
}

export async function createFacilityContractAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  let createdId: string | null = null;
  let code: string | null = null;

  try {
    const context = await requirePermission("facilityContracts.manage");
    const record = await facilityContractService.createContract(context, {
      ...contractFields(formData),
      code: field(formData, "code") || null,
    });
    createdId = record.id;
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (createdId) back(locale, createdId, { notice: "created" });
  back(locale, null, { error: code ?? "UNAVAILABLE" });
}

/**
 * Runs one contract command and redirects back to the contract with its
 * outcome.
 */
async function onContract(
  formData: FormData,
  permission: Parameters<typeof requirePermission>[0],
  notice: string,
  run: (
    context: Awaited<ReturnType<typeof requirePermission>>,
    contractId: string,
  ) => Promise<unknown>,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const contractId = idSchema.parse(formData.get("contractId"));
  let code: string | null = null;

  try {
    const context = await requirePermission(permission, {
      resourceId: contractId,
    });
    await run(context, contractId);
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  back(locale, contractId, code ? { error: code } : { notice });
}

export async function updateFacilityContractAction(
  formData: FormData,
): Promise<void> {
  await onContract(
    formData,
    "facilityContracts.manage",
    "saved",
    (context, contractId) =>
      facilityContractService.updateContract(context, {
        ...contractFields(formData),
        contractId,
        expectedRevision: field(formData, "expectedRevision"),
      }),
  );
}

export async function requestContractPriceApprovalAction(
  formData: FormData,
): Promise<void> {
  await onContract(
    formData,
    "facilityContracts.manage",
    "approvalRequested",
    (context, contractId) =>
      facilityContractService.requestPriceApproval(context, {
        contractId,
        expectedRevision: field(formData, "expectedRevision"),
      }),
  );
}

export async function activateFacilityContractAction(
  formData: FormData,
): Promise<void> {
  await onContract(
    formData,
    "facilityContracts.manage",
    "activated",
    (context, contractId) =>
      facilityContractService.activateContract(context, {
        contractId,
        expectedRevision: field(formData, "expectedRevision"),
      }),
  );
}

export async function cancelFacilityContractAction(
  formData: FormData,
): Promise<void> {
  await onContract(
    formData,
    "facilityContracts.manage",
    "cancelled",
    (context, contractId) =>
      facilityContractService.cancelContract(context, {
        contractId,
        expectedRevision: field(formData, "expectedRevision"),
        reason: field(formData, "reason"),
      }),
  );
}

export async function removeFacilityContractDocumentAction(
  formData: FormData,
): Promise<void> {
  await onContract(
    formData,
    "facilityContracts.manage",
    "documentRemoved",
    (context, contractId) =>
      facilityContractService.removeDocument(context, {
        contractId,
        expectedRevision: field(formData, "expectedRevision"),
        documentId: field(formData, "documentId"),
      }),
  );
}

export async function proposeFacilityPaymentAction(
  formData: FormData,
): Promise<void> {
  await onContract(
    formData,
    "facilityPayments.propose",
    "proposed",
    (context, contractId) =>
      facilityContractService.proposePayment(context, {
        contractId,
        amount: field(formData, "amount"),
        note: field(formData, "note"),
      }),
  );
}

const paymentSteps = {
  check: { permission: "facilityPayments.check", notice: "checked" },
  approve: { permission: "facilityPayments.approve", notice: "approved" },
  reRequest: { permission: "facilityPayments.approve", notice: "reRequested" },
  markPaid: { permission: "facilityPayments.markPaid", notice: "paid" },
} as const;

/**
 * One step of a payment request. The rejection is guarded by whichever of
 * the check and approve permissions its stage needs, re-judged in the
 * service.
 */
export async function facilityPaymentStepAction(
  formData: FormData,
): Promise<void> {
  const step = field(formData, "step");
  const paymentInput = {
    paymentId: field(formData, "paymentId"),
    expectedRevision: field(formData, "expectedRevision"),
  };

  if (step === "reject") {
    const stage = field(formData, "stage");
    await onContract(
      formData,
      stage === "proposed"
        ? "facilityPayments.check"
        : "facilityPayments.approve",
      "rejected",
      (context) =>
        facilityContractService.rejectPayment(context, {
          ...paymentInput,
          reason: field(formData, "reason"),
        }),
    );
    return;
  }

  const definition =
    step in paymentSteps
      ? paymentSteps[step as keyof typeof paymentSteps]
      : null;
  if (!definition) {
    const locale = localeSchema.parse(formData.get("locale"));
    back(locale, idSchema.parse(formData.get("contractId")), {
      error: "INVALID_INPUT",
    });
  }

  await onContract(
    formData,
    definition.permission,
    definition.notice,
    (context) => {
      switch (step) {
        case "check":
          return facilityContractService.checkPayment(context, paymentInput);
        case "approve":
          return facilityContractService.approvePayment(context, paymentInput);
        case "reRequest":
          return facilityContractService.requestPaymentDecisionAgain(
            context,
            paymentInput,
          );
        default:
          return facilityContractService.markPaymentPaid(context, {
            ...paymentInput,
            paidOn: field(formData, "paidOn"),
            paidNote: field(formData, "paidNote"),
          });
      }
    },
  );
}

const attachPayloadSchema = z.object({
  target: z.object({
    kind: z.literal("facilityContractDocument"),
    id: idSchema,
  }),
  expectedRevision: z.number().int().min(0),
  publicId: z.string().min(1).max(500),
  assetVersion: z.number().int().min(1),
  format: z.string().min(1).max(10),
  bytes: z.number().int().min(1),
  label: z.string().min(1).max(200),
});

/**
 * The `DocumentUpload` attach action for a contract file. The page binds the
 * document kind: `attachFacilityContractDocumentAction.bind(null, kind)`.
 */
export async function attachFacilityContractDocumentAction(
  kind: FacilityContractDocumentKind,
  input: unknown,
): Promise<DocumentActionState> {
  try {
    const documentKind = z.enum(facilityContractDocumentKinds).parse(kind);
    const payload = attachPayloadSchema.parse(input);
    const context = await requirePermission("facilityContracts.manage", {
      resourceId: payload.target.id,
    });
    await facilityContractService.attachDocument(context, {
      contractId: payload.target.id,
      expectedRevision: payload.expectedRevision,
      kind: documentKind,
      publicId: payload.publicId,
      assetVersion: payload.assetVersion,
      format: payload.format,
      bytes: payload.bytes,
      label: payload.label,
    });
    return { status: "success", message: "ATTACHED" };
  } catch (error) {
    return { status: "error", message: errorCode(error) };
  }
}
