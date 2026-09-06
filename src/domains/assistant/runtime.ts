import "server-only";

import { mongoApprovalRepository } from "@/domains/approvals/mongo-repository";
import { approvalService } from "@/domains/approvals/runtime";
import { mongoAttachmentStore } from "@/domains/assistant/attachments/persistence/mongo-store";
import { AttachmentService } from "@/domains/assistant/attachments/service";
import { mongoConversationStore } from "@/domains/assistant/conversations/persistence/mongo-store";
import { ConversationService } from "@/domains/assistant/conversations/service";
import { mongoProposalStore } from "@/domains/assistant/persistence/mongo-store";
import { AnthropicAssistantProvider } from "@/domains/assistant/providers/anthropic";
import { MockAssistantProvider } from "@/domains/assistant/providers/mock";
import { OpenAiCompatibleAssistantProvider } from "@/domains/assistant/providers/openai-compatible";
import type { AssistantProvider } from "@/domains/assistant/providers/types";
import { AssistantProposalService } from "@/domains/assistant/service";
import type {
  ToolContext,
  ToolServices,
} from "@/domains/assistant/tools/types";
import { mongoAuditRepository } from "@/domains/audit/mongo-repository";
import { customerCommandService } from "@/domains/customers/runtime";
import {
  financeCommandService,
  invoiceCommandService,
} from "@/domains/finance/runtime";
import { mongoUserDirectory } from "@/domains/identity/user-directory";
import { articleCommandService } from "@/domains/news/runtime";
import { mongoOrderStore } from "@/domains/orders/persistence/mongo-store";
import { orderCommandService } from "@/domains/orders/runtime";
import { productCommandService } from "@/domains/products/runtime";
import { sheetCheckService } from "@/domains/sheet-checks/runtime";
import { shopService } from "@/domains/shop/runtime";
import { taskCommandService } from "@/domains/tasks/runtime";
import {
  requireListAccess,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getNotificationEnv, inspectAiEnv } from "@/lib/env/server";

export const assistantProposalService = new AssistantProposalService({
  store: mongoProposalStore,
  orderStore: mongoOrderStore,
  taskService: taskCommandService,
  userDirectory: mongoUserDirectory,
  auditRepository: mongoAuditRepository,
  timeZone: getNotificationEnv().BUSINESS_TIMEZONE,
});

/**
 * Attachments and stored conversations. Both are owner-scoped by
 * construction rather than by permission: the Director holds the whole
 * permission catalogue at `all`, so "only the person who wrote it" cannot
 * be expressed as a scope and has to live in the store's filter.
 */
export const assistantAttachmentService = new AttachmentService({
  store: mongoAttachmentStore,
});

export const assistantConversationService = new ConversationService({
  store: mongoConversationStore,
  attachments: mongoAttachmentStore,
});

export const assistantToolServices: ToolServices = {
  orders: orderCommandService,
  finance: financeCommandService,
  invoices: invoiceCommandService,
  customers: customerCommandService,
  approvals: approvalService,
  tasks: taskCommandService,
  proposals: assistantProposalService,
  userDirectory: mongoUserDirectory,
  articles: articleCommandService,
  products: productCommandService,
  shop: shopService,
  sheetChecks: sheetCheckService,
};

// Referenced so the approvals repository module is part of the runtime
// graph even when the approvals service is swapped in tests.
void mongoApprovalRepository;

export type AssistantAvailability =
  | { configured: false; missing: readonly string[] }
  | { configured: true; provider: AssistantProvider };

/** The provider named by the environment, or the reason there is none. */
export function resolveAssistantProvider(): AssistantAvailability {
  const env = inspectAiEnv();
  if (!env.configured) {
    return { configured: false, missing: env.invalidKeys };
  }
  if (env.value.AI_PROVIDER === "mock") {
    return { configured: true, provider: new MockAssistantProvider() };
  }
  if (env.value.AI_PROVIDER === "openai-compatible") {
    return {
      configured: true,
      provider: new OpenAiCompatibleAssistantProvider({
        baseUrl: env.value.OPENAI_COMPAT_BASE_URL!,
        apiKey: env.value.OPENAI_COMPAT_API_KEY!,
        model: env.value.AI_MODEL,
        timeoutMs: env.value.AI_REQUEST_TIMEOUT_MS,
        reasoningEffort: env.value.OPENAI_COMPAT_REASONING_EFFORT,
      }),
    };
  }
  return {
    configured: true,
    provider: new AnthropicAssistantProvider({
      apiKey: env.value.ANTHROPIC_API_KEY!,
      model: env.value.AI_MODEL,
      timeoutMs: env.value.AI_REQUEST_TIMEOUT_MS,
    }),
  };
}

export function buildToolContext(input: {
  userId: string;
  locale: "vi" | "en";
  requestId: string;
  now?: Date;
}): ToolContext {
  return {
    userId: input.userId,
    locale: input.locale,
    now: input.now ?? new Date(),
    timeZone: getNotificationEnv().BUSINESS_TIMEZONE,
    requestId: input.requestId,
    auth: {
      requirePermission: (permission, options) =>
        requirePermission(permission, {
          ...(options ?? {}),
          requestId: input.requestId,
        }),
      requireListAccess,
      coverages: resolvePermissionCoverages,
    },
    services: assistantToolServices,
  };
}
