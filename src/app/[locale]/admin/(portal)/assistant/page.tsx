import { notFound } from "next/navigation";

import { resolveAssistantProvider } from "@/domains/assistant/runtime";
import { availableTools, toolPermissions } from "@/domains/assistant/tools";
import { AssistantChat } from "@/components/admin/assistant-chat";
import {
  ContentAccessDeniedError,
  requirePermission,
  resolvePermissionCoverages,
} from "@/lib/auth";
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

export default async function AdminAssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ locale: requestedLocale }, { q }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!isLocale(requestedLocale)) notFound();
  const locale = resolveAdminLocale(requestedLocale);
  const text = copy[locale];

  try {
    await requirePermission("assistant.use");
  } catch (cause) {
    if (cause instanceof ContentAccessDeniedError) notFound();
    throw cause;
  }

  const coverages = await resolvePermissionCoverages(toolPermissions);
  const tools = availableTools(coverages).map((tool) => tool.name);
  const availability = resolveAssistantProvider();

  return (
    <div>
      <p className="eyebrow">{text.eyebrow}</p>
      <h1 className="text-burgundy mt-3 max-w-4xl font-serif text-5xl tracking-[-0.045em] md:text-6xl">
        {text.title}
      </h1>
      <p className="text-charcoal/65 mt-5 max-w-3xl text-base leading-7">
        {text.description}
      </p>
      <AssistantChat
        locale={locale}
        configured={availability.configured}
        missing={availability.configured ? [] : availability.missing}
        providerKind={
          availability.configured ? availability.provider.kind : null
        }
        suggestions={suggestionsFor(tools, locale)}
        initialPrompt={typeof q === "string" ? q.slice(0, 4000) : undefined}
      />
    </div>
  );
}
