import { notFound } from "next/navigation";

import { attachmentLimits } from "@/domains/assistant/attachments/limits";
import {
  ConversationError,
  conversationIdSchema,
} from "@/domains/assistant/conversations/contracts";
import {
  assistantConversationService,
  resolveAssistantProvider,
} from "@/domains/assistant/runtime";
import { availableTools, toolPermissions } from "@/domains/assistant/tools";
import {
  AssistantChat,
  type ConversationSummary,
  type StoredMessage,
} from "@/components/admin/assistant-chat";
import {
  ContentAccessDeniedError,
  requireListAccess,
  resolvePermissionCoverages,
} from "@/lib/auth";
import { getNotificationEnv } from "@/lib/env/server";
import { isLocale } from "@/lib/i18n/config";
import { resolveAdminLocale } from "@/lib/i18n/admin";

export const dynamic = "force-dynamic";

const copy = {
  vi: {
    eyebrow: "Trợ lý",
    title: "Trợ lý AI",
    description:
      "Tra cứu và tóm tắt dữ liệu thật theo đúng quyền của bạn, đề xuất kế hoạch và việc cần làm để bạn duyệt. Trợ lý không tự thay đổi dữ liệu; mọi câu trả lời ghi rõ nguồn.",
  },
  en: {
    eyebrow: "Assistant",
    title: "AI assistant",
    description:
      "Looks up and summarises real data within your permissions and drafts plans and tasks for you to approve. It never changes data on its own; every answer names its sources.",
  },
} as const;

/** Prompts that make sense for the tools this reader actually has. */
function suggestionsFor(
  toolNames: readonly string[],
  locale: "vi" | "en",
): string[] {
  const has = (name: string) => toolNames.includes(name);
  const vi = locale === "vi";
  const list: string[] = [];
  if (has("list_my_tasks"))
    list.push(vi ? "Hôm nay tôi cần làm gì?" : "What do I need to do today?");
  if (has("list_my_tasks"))
    list.push(vi ? "Việc nào đã quá hạn?" : "Which tasks are overdue?");
  if (has("list_orders"))
    list.push(
      vi
        ? "Tóm tắt tiến độ các đơn hàng đang mở."
        : "Summarise the open orders.",
    );
  if (has("list_pending_approvals"))
    list.push(
      vi
        ? "Có gì đang chờ Giám đốc phê duyệt?"
        : "What is waiting for the Director?",
    );
  if (has("get_receivables_overview"))
    list.push(
      vi
        ? "Khách nào còn công nợ quá hạn?"
        : "Which customers have overdue receivables?",
    );
  if (has("propose_order_plan"))
    list.push(vi ? "Lập kế hoạch cho đơn RD-… " : "Plan order RD-…");
  if (has("list_editorial_work"))
    list.push(
      vi
        ? "Bài viết nào còn ở bản nháp?"
        : "Which articles are still in draft?",
    );
  return list;
}

/**
 * The reader's own stored conversations, newest first.
 *
 * The owner comes from the session and goes straight into the store's
 * filter; there is no parameter for whose list this is. Dates are handed to
 * the browser as ISO strings so the list the page renders and the list the
 * API returns after a new turn have exactly one shape.
 *
 * A store that is down costs the history panel, not the chat: the assistant
 * still answers, and the turn is simply not recorded.
 */
async function listConversations(
  userId: string,
): Promise<ConversationSummary[]> {
  try {
    const stored = await assistantConversationService.list(userId, {
      limit: attachmentLimits.conversationPageSize,
    });
    return stored.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
    }));
  } catch (error) {
    console.error("[assistant] conversation list unavailable", error);
    return [];
  }
}

/**
 * The transcript named by `?c=`, read here rather than in the browser.
 *
 * The conversation lives in the URL the way it does in any chat app, so a
 * reload comes back to what was on screen instead of quietly starting a new
 * one. Reading it on the server is what makes the first paint the right
 * one; the id is still the owner's own, because the service takes the owner
 * from the session and has no parameter that could widen it.
 *
 * Every failure is the same failure: an id that expired, was deleted, was
 * never anybody's, or a store that is down all open an empty chat. A link
 * someone kept for eight days must not turn the assistant into a 404.
 */
async function readConversation(
  userId: string,
  candidate: string | undefined,
): Promise<{ id: string; messages: StoredMessage[] } | null> {
  if (typeof candidate !== "string") return null;
  if (!conversationIdSchema.safeParse(candidate).success) return null;
  try {
    const { conversation, messages } = await assistantConversationService.read(
      userId,
      candidate,
      attachmentLimits.messagePageSize,
    );
    return {
      id: conversation.id,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          format: attachment.format,
          kind: attachment.kind,
          byteSize: attachment.byteSize,
          preview: attachment.preview,
          notes: [...attachment.notes],
          truncated: attachment.truncated,
        })),
        trace: message.trace.map((entry) => ({ ...entry })),
        sources: message.sources.map((source) => ({ ...source })),
        proposalIds: [...message.proposalIds],
        truncated: message.truncated,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    // A conversation that is simply gone is routine and says nothing worth
    // logging; anything else is the store failing and is worth a line.
    if (!(error instanceof ConversationError)) {
      console.error("[assistant] conversation read unavailable", error);
    }
    return null;
  }
}

export default async function AdminAssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; c?: string }>;
}) {
  const [{ locale: requestedLocale }, { q, c }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  let userId: string;
  try {
    // `requireListAccess`, not a bare `requirePermission`: three roles are
    // granted `assistant.use` only inside their assigned business units, and
    // a check with no target finds no candidate for them. The nav entry is
    // drawn from coverage and would show, so the mismatch showed up as a
    // menu item leading to a 404.
    userId = (await requireListAccess("assistant.use")).context.userId;
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const [conversations, active, coverages] = await Promise.all([
    listConversations(userId),
    readConversation(userId, c),
    resolvePermissionCoverages(toolPermissions),
  ]);
  const tools = availableTools(coverages).map((tool) => tool.name);
  const availability = resolveAssistantProvider();

  // A compact masthead: the chat below wants the height, and the sentence
  // explaining what the assistant is for now opens the empty transcript,
  // where a person is actually looking when they need it.
  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-2 max-w-4xl font-serif text-3xl tracking-[-0.045em] md:text-4xl">
        {text.title}
      </h1>
      <AssistantChat
        locale={locale}
        configured={availability.configured}
        missing={availability.configured ? [] : availability.missing}
        providerKind={
          availability.configured ? availability.provider.kind : null
        }
        description={text.description}
        suggestions={suggestionsFor(tools, locale)}
        initialPrompt={typeof q === "string" ? q.slice(0, 4000) : undefined}
        initialConversationId={active?.id ?? null}
        initialMessages={active?.messages ?? []}
        initialConversations={conversations}
        timeZone={getNotificationEnv().BUSINESS_TIMEZONE}
        limits={{
          maxFiles: attachmentLimits.maxFilesPerTurn,
          maxFileBytes: attachmentLimits.maxFileBytes,
          maxTotalBytes: attachmentLimits.maxTotalBytes,
          retentionDays: attachmentLimits.retentionDays,
        }}
      />
    </div>
  );
}
