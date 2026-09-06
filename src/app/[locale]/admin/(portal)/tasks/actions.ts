"use server";

import type { Route } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { AssistantError } from "@/domains/assistant/contracts";
import { assistantProposalService } from "@/domains/assistant/runtime";
import { NotificationError } from "@/domains/notifications/contracts";
import {
  channelLinkService,
  runScheduledReminderJob,
} from "@/domains/notifications/runtime";
import { orderCommandService } from "@/domains/orders/runtime";
import {
  TaskCommandError,
  type TaskRecordDto,
} from "@/domains/tasks/contracts";
import { taskCommandService } from "@/domains/tasks/runtime";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import type { AccessContext } from "@/lib/auth/authorization";
import { resolveSessionIdentity } from "@/lib/auth/session";

/**
 * Server actions behind the task list and the assistant's proposal cards.
 * Every action re-authorizes against the exact record on the server; the
 * task service re-judges the transition; results travel back as a query
 * parameter (or, for the chat, as a returned result) so the pages stay
 * server-rendered.
 */

const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/);
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);

function errorCode(error: unknown): string {
  if (error instanceof ContentAccessDeniedError) return "FORBIDDEN";
  if (error instanceof TaskCommandError) return error.code;
  if (error instanceof AssistantError) return error.code;
  if (error instanceof NotificationError) return error.code;
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "UNAVAILABLE";
}

function backToTasks(
  locale: string,
  outcome: { error?: string; notice?: string; extra?: Record<string, string> },
): never {
  const params = new URLSearchParams();
  if (outcome.error) params.set("error", outcome.error);
  else if (outcome.notice) params.set("notice", outcome.notice);
  for (const [key, value] of Object.entries(outcome.extra ?? {})) {
    params.set(key, value);
  }
  const query = params.toString();
  redirect(`/${locale}/admin/tasks${query ? `?${query}` : ""}` as Route);
}

async function currentUserId(): Promise<string | null> {
  const resolution = await resolveSessionIdentity();
  return resolution.configured ? (resolution.identity?.userId ?? null) : null;
}

/**
 * Guard target for a task: a participant (assignee or creator) presents
 * themself as the owner so an `own` grant reaches it; anyone else presents
 * the real owner so the evaluator refuses unless the task's units are in
 * their scope.
 */
function taskTarget(task: TaskRecordDto, userId: string) {
  const participant =
    task.assigneeUserId === userId || task.createdBy === userId;
  return {
    resourceId: task.id,
    businessUnitIds: task.businessUnitIds,
    ownerUserId: participant ? userId : (task.assigneeUserId ?? task.createdBy),
  };
}

function merge(base: AccessContext, extra: AccessContext): AccessContext {
  return { ...base, permissions: [...base.permissions, ...extra.permissions] };
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  let code: string | null = null;

  try {
    const userId = await currentUserId();
    if (!userId) throw new ContentAccessDeniedError("UNAUTHENTICATED");

    const orderCode = String(formData.get("orderCode") ?? "").trim();
    let orderId: string | null = null;
    let businessUnitIds: readonly string[] = [];
    if (orderCode) {
      const order =
        await orderCommandService.findByCodeForAuthorization(orderCode);
      if (!order)
        throw new TaskCommandError("ORDER_NOT_FOUND", "Order not found.");
      await requirePermission("orders.read", {
        resourceId: order.id,
        businessUnitIds: order.businessUnitIds,
      });
      orderId = order.id;
      businessUnitIds = order.businessUnitIds;
    }

    // A task without an order is stamped with the creator's own granted
    // units (from their grants, never from the form) so a unit-bound grant
    // reaches it later.
    const coverage = (
      await resolvePermissionCoverages(["tasks.create"] as const)
    )["tasks.create"];
    const fallbackUnits = coverage.global ? [] : [...coverage.businessUnitIds];
    const targetUnits = orderId ? businessUnitIds : fallbackUnits;

    const assigneeUserId =
      String(formData.get("assigneeUserId") ?? "").trim() || userId;
    let context = await requirePermission("tasks.create", {
      businessUnitIds: targetUnits,
      ownerUserId: userId,
    });
    if (assigneeUserId !== userId) {
      context = merge(
        context,
        await requirePermission("tasks.assign", {
          businessUnitIds: targetUnits,
          ownerUserId: userId,
        }),
      );
    }

    await taskCommandService.create(
      context,
      {
        title: String(formData.get("title") ?? ""),
        note: String(formData.get("note") ?? "").trim() || null,
        priority: String(formData.get("priority") ?? "normal"),
        orderId: orderId ?? "",
        assigneeUserId,
        dueDate: String(formData.get("dueDate") ?? "").trim(),
      },
      { fallbackBusinessUnitIds: fallbackUnits },
    );
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToTasks(locale, code ? { error: code } : { notice: "created" });
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const returnTo = String(formData.get("returnTo") ?? "");
  let code: string | null = null;
  let notice = "updated";

  try {
    const userId = await currentUserId();
    if (!userId) throw new ContentAccessDeniedError("UNAUTHENTICATED");
    const taskId = idSchema.parse(formData.get("taskId"));
    const task = await taskCommandService.findForAuthorization(taskId);
    if (!task) throw new TaskCommandError("NOT_FOUND", "Task not found.");

    const context = await requirePermission(
      "tasks.update",
      taskTarget(task, userId),
    );
    const status = String(formData.get("status") ?? "");
    await taskCommandService.setStatus(context, {
      taskId,
      expectedRevision: String(formData.get("expectedRevision") ?? ""),
      status,
      reason: String(formData.get("reason") ?? "").trim() || null,
    });
    notice =
      status === "done"
        ? "done"
        : status === "cancelled"
          ? "cancelled"
          : "reopened";
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  if (returnTo.startsWith("order:")) {
    const orderId = returnTo.slice(6);
    if (idSchema.safeParse(orderId).success) {
      redirect(
        `/${locale}/admin/orders/${orderId}${code ? `?error=${code}` : `?notice=task_${notice}`}` as Route,
      );
    }
  }
  backToTasks(locale, code ? { error: code } : { notice });
}

export type DecideProposalResult =
  | { ok: true; status: "approved" | "rejected"; taskIds: string[] }
  | { ok: false; code: string; details: string[] };

/**
 * Approves or rejects an assistant proposal and returns the outcome (used
 * by the chat, which must keep its transcript on screen). The guard names
 * the permission the proposal's kind demands, against the proposal's
 * order and units.
 */
export async function decideProposalAction(input: {
  proposalId: string;
  expectedRevision: number;
  decision: "approved" | "rejected";
  reason: string | null;
}): Promise<DecideProposalResult> {
  try {
    const userId = await currentUserId();
    if (!userId) throw new ContentAccessDeniedError("UNAUTHENTICATED");
    const proposalId = idSchema.parse(input.proposalId);
    const proposal =
      await assistantProposalService.findForAuthorization(proposalId);
    if (!proposal) throw new AssistantError("NOT_FOUND", "Proposal not found.");

    const target = {
      resourceId: proposal.orderId ?? proposal.id,
      businessUnitIds: proposal.businessUnitIds,
      ownerUserId: userId,
    };
    // Releasing a plan takes the approval permission AND the right to
    // create the tasks it becomes; both are judged against the order.
    let context = await requirePermission("tasks.create", target);
    if (proposal.kind === "orderPlan") {
      context = merge(
        context,
        await requirePermission("tasks.approvePlan", target),
      );
    }
    const outcome = await assistantProposalService.decide(context, {
      proposalId,
      expectedRevision: input.expectedRevision,
      decision: input.decision,
      reason: input.reason,
    });
    return {
      ok: true,
      status: outcome.proposal.status === "approved" ? "approved" : "rejected",
      taskIds: outcome.tasks.map((task) => task.id),
    };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      code: errorCode(error),
      details: error instanceof AssistantError ? [...error.details] : [],
    };
  }
}

export async function decideProposalFormAction(
  formData: FormData,
): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  const decision = z
    .enum(["approved", "rejected"])
    .parse(formData.get("decision"));
  const result = await decideProposalAction({
    proposalId: String(formData.get("proposalId") ?? ""),
    expectedRevision: Number(formData.get("expectedRevision") ?? ""),
    decision,
    reason: String(formData.get("reason") ?? "").trim() || null,
  });
  backToTasks(
    locale,
    result.ok
      ? {
          notice:
            result.status === "approved"
              ? "proposalApproved"
              : "proposalRejected",
        }
      : { error: result.code },
  );
}

export async function runRemindersAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  let code: string | null = null;
  let extra: Record<string, string> = {};

  try {
    const context = await requirePermission("notifications.retry");
    const summary = await runScheduledReminderJob({
      trigger: "manual",
      actorUserId: context.userId,
    });
    extra = {
      created: String(summary.intentsCreated),
      sent: String(summary.sent),
      skipped: String(summary.skipped),
      failed: String(summary.failed + summary.deadLettered),
    };
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }

  backToTasks(
    locale,
    code ? { error: code } : { notice: "remindersRan", extra },
  );
}

export async function retryIntentAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  let code: string | null = null;
  try {
    const context = await requirePermission("notifications.retry");
    await channelLinkService.retryIntent(
      context,
      idSchema.parse(formData.get("intentId")),
    );
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }
  backToTasks(locale, code ? { error: code } : { notice: "requeued" });
}

export async function startZaloLinkAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  let code: string | null = null;
  try {
    const userId = await currentUserId();
    if (!userId) throw new ContentAccessDeniedError("UNAUTHENTICATED");
    const context = await requirePermission("notifications.manageOwnChannels", {
      ownerUserId: userId,
      resourceId: userId,
    });
    await channelLinkService.startZaloLink(context);
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }
  backToTasks(locale, code ? { error: code } : { notice: "zaloCode" });
}

export async function revokeZaloLinkAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  let code: string | null = null;
  try {
    const userId = await currentUserId();
    if (!userId) throw new ContentAccessDeniedError("UNAUTHENTICATED");
    const context = await requirePermission("notifications.manageOwnChannels", {
      ownerUserId: userId,
      resourceId: userId,
    });
    await channelLinkService.revokeZaloLink(context);
  } catch (error) {
    unstable_rethrow(error);
    code = errorCode(error);
  }
  backToTasks(locale, code ? { error: code } : { notice: "zaloRevoked" });
}
