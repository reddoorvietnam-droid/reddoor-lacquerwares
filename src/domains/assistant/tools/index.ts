import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { listPendingApprovalsTool } from "@/domains/assistant/tools/approvals";
import { listEditorialWorkTool } from "@/domains/assistant/tools/editorial";
import {
  findCustomerTool,
  getCustomerReceivablesTool,
  getReceivablesOverviewTool,
} from "@/domains/assistant/tools/finance";
import { getOrderTool, listOrdersTool } from "@/domains/assistant/tools/orders";
import { sheetCheckTools } from "@/domains/assistant/tools/sheet-checks";
import {
  listMyTasksTool,
  proposeOrderPlanTool,
  proposeTasksTool,
} from "@/domains/assistant/tools/tasks";
import type { AssistantTool } from "@/domains/assistant/tools/types";
import type { Permission } from "@/domains/identity/permissions";
import type { PermissionCoverage } from "@/lib/auth";

/**
 * The complete tool catalog. Order matters for prompt caching: the list is
 * filtered per user but never reordered, so two users with the same grants
 * send byte-identical tool definitions.
 */
export const assistantTools: readonly AssistantTool<never>[] = [
  listMyTasksTool,
  listOrdersTool,
  getOrderTool,
  listPendingApprovalsTool,
  findCustomerTool,
  getCustomerReceivablesTool,
  getReceivablesOverviewTool,
  proposeOrderPlanTool,
  proposeTasksTool,
  listEditorialWorkTool,
  // Spreadsheet checks come last so the catalog order (and prompt cache) of
  // the earlier tools is unchanged for users without documents.read.
  ...sheetCheckTools,
] as unknown as readonly AssistantTool<never>[];

/** Every permission any tool asks about, for one coverage read per request. */
export const toolPermissions = [
  ...new Set(assistantTools.flatMap((tool) => tool.requires)),
] as Permission[];

/**
 * Tools offered to a user: only those whose every required permission is
 * granted somewhere (globally or in at least one unit). A tool that cannot
 * possibly succeed is not described to the model at all, so a Content
 * Creator's assistant does not even know an order tool exists.
 */
export function availableTools(
  coverages: Partial<Record<Permission, PermissionCoverage>>,
): AssistantTool<never>[] {
  return assistantTools.filter((tool) =>
    tool.requires.every((permission) => {
      const coverage = coverages[permission];
      return Boolean(
        coverage && (coverage.global || coverage.businessUnitIds.length > 0),
      );
    }),
  );
}

export function toAnthropicTool(tool: AssistantTool<never>): Anthropic.Tool {
  const schema = z.toJSONSchema(tool.inputSchema, {
    target: "draft-7",
    unrepresentable: "any",
  }) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      ...schema,
      type: "object",
    } as Anthropic.Tool.InputSchema,
  };
}

export function findTool(name: string): AssistantTool<never> | null {
  return assistantTools.find((tool) => tool.name === name) ?? null;
}
