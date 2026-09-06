import { z } from "zod";

import { adminHref, guarded } from "@/domains/assistant/tools/shared";
import type { AssistantTool } from "@/domains/assistant/tools/types";

const input = z.object({
  limit: z.number().int().min(1).max(100).default(30),
});

/**
 * The pending Director queue, narrowed like the approvals page. Summaries
 * were written price-free by the requesting service, so this projection
 * is safe for every role that may read the queue.
 */
export const listPendingApprovalsTool: AssistantTool<z.infer<typeof input>> = {
  name: "list_pending_approvals",
  description:
    "List Director approval requests still waiting for a decision inside the user's scope: subject, record, who asked and when. Use it for 'what is waiting for the Director', 'is order X waiting for approval'. Deciding is done in the portal, never here.",
  inputSchema: input,
  requires: ["approvals.read"],
  async run(value, context) {
    return guarded(async () => {
      const { context: access, scope } =
        await context.auth.requireListAccess("approvals.read");
      const pending = await context.services.approvals.listPending(
        access,
        scope.kind === "all"
          ? null
          : scope.kind === "businessUnits"
            ? scope.businessUnitIds
            : [],
      );
      return {
        ok: true,
        data: {
          items: pending.slice(0, value.limit).map((request) => ({
            id: request.id,
            subject: request.subject,
            resourceType: request.resourceType,
            resourceId: request.resourceId,
            summary: request.summary,
            requestedAt: request.requestedAt.toISOString(),
            requestedByUserId: request.requestedByUserId,
          })),
          total: pending.length,
        },
        sources: [
          {
            label: context.locale === "vi" ? "Phê duyệt" : "Approvals",
            href: adminHref(context.locale, "/approvals"),
          },
        ],
      };
    });
  },
};
