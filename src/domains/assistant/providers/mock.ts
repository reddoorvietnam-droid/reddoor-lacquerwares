import type Anthropic from "@anthropic-ai/sdk";

import type {
  AssistantProvider,
  ProviderRequest,
  ProviderResult,
} from "@/domains/assistant/providers/types";

/**
 * A scripted provider for development and automated tests.
 *
 * It never calls a model. It reads the latest user message, picks the tool
 * a reasonable assistant would call — only from the tools it was offered,
 * exactly as the real model is constrained — and, once the tool results
 * come back, writes a plain rendering of them. Its value is that the whole
 * pipeline around the model (guards, tool execution, proposals, audit, UI)
 * can be proven end to end without a key, and that eval cases assert on
 * facts and tool calls rather than on prose. It is refused in production
 * by the environment schema, and the UI labels every answer it produces.
 */

const ORDER_CODE = /\bRD-\d{8}-[A-Z0-9]{4}\b/i;
const INJECTION =
  /(ignore (all )?(previous|prior) instructions|bỏ qua (mọi |các )?(chỉ thị|hướng dẫn)|you are now (the )?(admin|director)|từ giờ bạn là (admin|giám đốc))/i;

function lastUserText(messages: readonly Anthropic.MessageParam[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content;
    const text = message.content
      .filter(
        (block): block is Anthropic.TextBlockParam => block.type === "text",
      )
      .map((block) => block.text)
      .join("\n");
    if (text) return text;
    // A user turn made only of tool results: keep looking back for the text.
    const hasToolResult = message.content.some(
      (block) => block.type === "tool_result",
    );
    if (!hasToolResult) return "";
  }
  return "";
}

function lastToolResults(
  messages: readonly Anthropic.MessageParam[],
): { name: string; text: string; isError: boolean }[] | null {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || typeof last.content === "string") {
    return null;
  }
  const results = last.content.filter(
    (block): block is Anthropic.ToolResultBlockParam =>
      block.type === "tool_result",
  );
  if (results.length === 0) return null;

  // Tool names live on the preceding assistant turn's tool_use blocks.
  const assistant = messages[messages.length - 2];
  const names = new Map<string, string>();
  if (
    assistant &&
    assistant.role === "assistant" &&
    typeof assistant.content !== "string"
  ) {
    for (const block of assistant.content) {
      if (block.type === "tool_use") names.set(block.id, block.name);
    }
  }
  return results.map((result) => ({
    name: names.get(result.tool_use_id) ?? "tool",
    text:
      typeof result.content === "string"
        ? result.content
        : (result.content ?? [])
            .map((block) => (block.type === "text" ? block.text : ""))
            .join("\n"),
    isError: result.is_error === true,
  }));
}

function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, date! + days))
    .toISOString()
    .slice(0, 10);
}

function todayFromSystem(system: string): string {
  const match = /Today \(business timezone\): (\d{4}-\d{2}-\d{2})/.exec(system);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
}

let sequence = 0;
function toolUse(
  name: string,
  input: Record<string, unknown>,
): Anthropic.ToolUseBlock {
  sequence += 1;
  return {
    type: "tool_use",
    id: `mock_${sequence}`,
    name,
    input,
    caller: { type: "direct" },
  };
}

function text(value: string): Anthropic.TextBlock {
  return { type: "text", text: value, citations: null };
}

function render(name: string, raw: string, locale: "vi" | "en"): string {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return raw.slice(0, 1_500);
  }
  const record = (data ?? {}) as Record<string, unknown>;
  const payload = (record.data ?? record) as Record<string, unknown>;
  const vi = locale === "vi";

  switch (name) {
    case "get_order": {
      const lines = [
        `${vi ? "Đơn" : "Order"} ${payload.orderCode} · ${payload.customerName}`,
        `${vi ? "Bước hiện tại" : "Current stage"}: ${payload.stageLabel} (${payload.stage})`,
        `${vi ? "Vị trí phụ trách" : "Owner"}: ${payload.ownerRole}`,
      ];
      if (payload.approval) {
        lines.push(
          `${vi ? "Phê duyệt" : "Approval"}: ${JSON.stringify(payload.approval)}`,
        );
      }
      if (payload.expectedReadyDate) {
        lines.push(
          `${vi ? "Dự kiến sẵn hàng" : "Expected ready"}: ${payload.expectedReadyDate}`,
        );
      }
      if (payload.sellingPrice) {
        lines.push(
          `${vi ? "Giá bán" : "Selling price"}: ${(payload.sellingPrice as { display: string }).display}`,
        );
      }
      const tasks = payload.tasks as
        { title: string; status: string; dueDate: string | null }[] | undefined;
      if (tasks && tasks.length > 0) {
        lines.push(
          `${vi ? "Việc liên quan" : "Tasks"}: ${tasks.map((t) => `${t.title} [${t.status}${t.dueDate ? `, ${t.dueDate}` : ""}]`).join("; ")}`,
        );
      }
      return lines.join("\n");
    }
    case "list_orders": {
      const items =
        (payload.items as {
          orderCode: string;
          customerName: string;
          stageLabel: string;
        }[]) ?? [];
      if (items.length === 0)
        return vi
          ? "Không có đơn hàng nào trong phạm vi của bạn."
          : "No orders in your scope.";
      return items
        .map((o) => `${o.orderCode} · ${o.customerName} · ${o.stageLabel}`)
        .join("\n");
    }
    case "list_my_tasks": {
      const items =
        (payload.items as {
          title: string;
          status: string;
          dueDate: string | null;
          overdue: boolean;
          orderCode: string | null;
        }[]) ?? [];
      if (items.length === 0)
        return vi ? "Không có việc nào phù hợp." : "No matching tasks.";
      return items
        .map(
          (t) =>
            `${t.overdue ? (vi ? "[QUÁ HẠN] " : "[OVERDUE] ") : ""}${t.title}${t.orderCode ? ` (${t.orderCode})` : ""}${t.dueDate ? ` — ${vi ? "hạn" : "due"} ${t.dueDate}` : ""}`,
        )
        .join("\n");
    }
    case "list_pending_approvals": {
      const items =
        (payload.items as { subject: string; summary: string }[]) ?? [];
      if (items.length === 0)
        return vi
          ? "Không có yêu cầu phê duyệt nào đang chờ."
          : "No pending approvals.";
      return items.map((a) => `${a.subject}: ${a.summary}`).join("\n");
    }
    case "find_customer": {
      const items =
        (payload.items as {
          name: string;
          code: string | null;
          id: string;
        }[]) ?? [];
      if (items.length === 0)
        return vi ? "Không tìm thấy khách hàng." : "No customer found.";
      if (items.length > 1) {
        return (
          (vi
            ? "Có nhiều khách hàng khớp, cần làm rõ: "
            : "Several customers match, please clarify: ") +
          items
            .map((c) => `${c.name}${c.code ? ` (${c.code})` : ""}`)
            .join("; ")
        );
      }
      return `${items[0]!.name}${items[0]!.code ? ` (${items[0]!.code})` : ""}`;
    }
    case "get_customer_receivables": {
      const rows =
        (payload.customerRows as {
          currency: string;
          invoiced: { display: string };
          received: { display: string };
          outstanding: { display: string };
          credit: { display: string };
          balance: { display: string };
          overdueInvoiceCount: number;
        }[]) ?? [];
      if (rows.length === 0)
        return vi
          ? "Khách hàng này chưa có hóa đơn hay tiền thu nào."
          : "This customer has no invoice or receipt yet.";
      return rows
        .map(
          (r) =>
            `${r.currency}: ${vi ? "đã xuất hóa đơn" : "invoiced"} ${r.invoiced.display}, ${vi ? "đã thu" : "received"} ${r.received.display}, ${vi ? "còn phải thu" : "outstanding"} ${r.outstanding.display}, ${vi ? "trả trước" : "credit"} ${r.credit.display}, ${vi ? "cân đối" : "balance"} ${r.balance.display}, ${r.overdueInvoiceCount} ${vi ? "hóa đơn quá hạn" : "overdue invoice(s)"}`,
        )
        .join("\n");
    }
    case "get_receivables_overview": {
      const totals = payload.totals as
        | {
            outstanding: { display: string }[];
            credit: { display: string }[];
            overdueInvoiceCount: number;
          }
        | undefined;
      if (!totals) return raw.slice(0, 1_000);
      return `${vi ? "Tổng còn phải thu" : "Total outstanding"}: ${totals.outstanding.map((m) => m.display).join(" · ") || "0"}; ${vi ? "tổng trả trước" : "total credit"}: ${totals.credit.map((m) => m.display).join(" · ") || "0"}; ${totals.overdueInvoiceCount} ${vi ? "hóa đơn quá hạn" : "overdue invoice(s)"}`;
    }
    case "propose_order_plan":
    case "propose_tasks": {
      const count =
        payload.itemCount ??
        (payload.items as unknown[] | undefined)?.length ??
        0;
      return vi
        ? `Đề xuất ${payload.proposalId} gồm ${count} việc đang chờ duyệt. Đây mới là bản nháp: chưa có việc nào được tạo cho đến khi người có quyền duyệt đề xuất trên cổng quản trị.`
        : `Proposal ${payload.proposalId} with ${count} items is pending approval. This is a draft: no task exists until someone with the permission approves it in the portal.`;
    }
    case "list_editorial_work": {
      return raw.slice(0, 1_500);
    }
    default:
      return raw.slice(0, 1_500);
  }
}

export class MockAssistantProvider implements AssistantProvider {
  readonly kind = "mock" as const;
  readonly model = "mock-scripted";

  async complete(request: ProviderRequest): Promise<ProviderResult> {
    const offered = new Set(request.tools.map((tool) => tool.name));
    const locale: "vi" | "en" = request.system.includes("Answer in Vietnamese")
      ? "vi"
      : "en";
    const usage = { inputTokens: 0, outputTokens: 0 };

    const results = lastToolResults(request.messages);
    if (results) {
      const body = results
        .map((result) =>
          result.isError
            ? `${result.name}: ${locale === "vi" ? "không đọc được" : "could not read"} — ${result.text.slice(0, 300)}`
            : render(result.name, result.text, locale),
        )
        .join("\n\n");
      return {
        content: [
          text(body || (locale === "vi" ? "Không có dữ liệu." : "No data.")),
        ],
        stopReason: "end_turn",
        usage,
      };
    }

    const message = lastUserText(request.messages);
    const lower = message.toLowerCase();
    const today = todayFromSystem(request.system);
    const orderCode = ORDER_CODE.exec(message)?.[0]?.toUpperCase() ?? null;

    if (INJECTION.test(message)) {
      return {
        content: [
          text(
            locale === "vi"
              ? "Tôi chỉ làm việc theo quyền của tài khoản đang đăng nhập và không thể thay đổi chỉ thị hệ thống hay vai trò."
              : "I only act within the signed-in account's permissions and cannot change the system instructions or your role.",
          ),
        ],
        stopReason: "end_turn",
        usage,
      };
    }

    const wants = (tool: string) => offered.has(tool);
    const deniedText = (what: string) =>
      text(
        locale === "vi"
          ? `Tài khoản của bạn không có quyền xem ${what}.`
          : `Your account does not hold the permission to read ${what}.`,
      );

    if (/(kế hoạch|lập kế hoạch|\bplan\b)/i.test(lower) && orderCode) {
      if (!wants("propose_order_plan")) {
        return {
          content: [
            deniedText(
              locale === "vi"
                ? "hoặc lập kế hoạch cho đơn hàng"
                : "or plan orders",
            ),
          ],
          stopReason: "end_turn",
          usage,
        };
      }
      return {
        content: [toolUse("propose_order_plan", { orderCode })],
        stopReason: "tool_use",
        usage,
      };
    }

    if (/(nhắc tôi|remind me)/i.test(lower)) {
      if (!wants("propose_tasks")) {
        return {
          content: [
            deniedText(locale === "vi" ? "hoặc tạo việc" : "or create tasks"),
          ],
          stopReason: "end_turn",
          usage,
        };
      }
      const dueDate = /ngày mai|tomorrow/i.test(lower)
        ? addDays(today, 1)
        : /hôm nay|today/i.test(lower)
          ? today
          : null;
      const title =
        message
          .replace(/^(nhắc tôi|remind me)\s*/i, "")
          .replace(/\s*(ngày mai|tomorrow|hôm nay|today)\s*/i, " ")
          .trim() || message;
      return {
        content: [
          toolUse("propose_tasks", {
            tasks: [{ title: title.slice(0, 200), dueDate, orderCode }],
          }),
        ],
        stopReason: "tool_use",
        usage,
      };
    }

    if (/(công nợ|receivable|dư nợ|debt)/i.test(lower)) {
      if (!wants("get_receivables_overview")) {
        return {
          content: [deniedText(locale === "vi" ? "công nợ" : "receivables")],
          stopReason: "end_turn",
          usage,
        };
      }
      const customer =
        /(?:của|of)\s+(?:khách(?: hàng)?\s+|customer\s+)?(.{2,60})$/i
          .exec(message.trim())?.[1]
          ?.replace(/\s*(giúp tôi|please|cho tôi)\s*$/i, "")
          .replace(/[?.!]+$/, "")
          .trim();
      if (customer && wants("find_customer")) {
        return {
          content: [toolUse("find_customer", { query: customer })],
          stopReason: "tool_use",
          usage,
        };
      }
      return {
        content: [toolUse("get_receivables_overview", {})],
        stopReason: "tool_use",
        usage,
      };
    }

    if (/(giá bán|selling price|price)/i.test(lower) && orderCode) {
      if (!wants("get_order")) {
        return {
          content: [deniedText(locale === "vi" ? "đơn hàng" : "orders")],
          stopReason: "end_turn",
          usage,
        };
      }
      return {
        content: [toolUse("get_order", { orderCode })],
        stopReason: "tool_use",
        usage,
      };
    }

    if (orderCode) {
      if (!wants("get_order")) {
        return {
          content: [deniedText(locale === "vi" ? "đơn hàng" : "orders")],
          stopReason: "end_turn",
          usage,
        };
      }
      return {
        content: [toolUse("get_order", { orderCode })],
        stopReason: "tool_use",
        usage,
      };
    }

    if (/(phê duyệt|approval)/i.test(lower)) {
      if (!wants("list_pending_approvals")) {
        return {
          content: [
            deniedText(
              locale === "vi" ? "hàng đợi phê duyệt" : "the approval queue",
            ),
          ],
          stopReason: "end_turn",
          usage,
        };
      }
      return {
        content: [toolUse("list_pending_approvals", {})],
        stopReason: "tool_use",
        usage,
      };
    }

    if (
      /(hôm nay|cần làm|quá hạn|sắp đến hạn|việc|task|todo|overdue|due)/i.test(
        lower,
      )
    ) {
      if (!wants("list_my_tasks")) {
        return {
          content: [deniedText(locale === "vi" ? "việc cần làm" : "tasks")],
          stopReason: "end_turn",
          usage,
        };
      }
      const overdueOnly = /quá hạn|overdue/i.test(lower);
      return {
        content: [
          toolUse(
            "list_my_tasks",
            overdueOnly ? { overdueOnly: true } : { dueWithinDays: 7 },
          ),
        ],
        stopReason: "tool_use",
        usage,
      };
    }

    if (/(đơn hàng|orders|tiến độ|progress)/i.test(lower)) {
      if (!wants("list_orders")) {
        return {
          content: [deniedText(locale === "vi" ? "đơn hàng" : "orders")],
          stopReason: "end_turn",
          usage,
        };
      }
      return {
        content: [toolUse("list_orders", { limit: 20 })],
        stopReason: "tool_use",
        usage,
      };
    }

    if (
      /(bài viết|tin tức|nội dung|sản phẩm|article|content|draft)/i.test(
        lower,
      ) &&
      wants("list_editorial_work")
    ) {
      return {
        content: [toolUse("list_editorial_work", {})],
        stopReason: "tool_use",
        usage,
      };
    }

    return {
      content: [
        text(
          locale === "vi"
            ? "Tôi có thể tra cứu đơn hàng, việc cần làm, phê duyệt đang chờ, công nợ (nếu bạn có quyền) hoặc đề xuất kế hoạch cho một đơn hàng. Hãy nêu mã đơn hoặc việc bạn cần."
            : "I can look up orders, tasks, pending approvals, receivables (if you hold the permission) or draft a plan for an order. Name the order code or what you need.",
        ),
      ],
      stopReason: "end_turn",
      usage,
    };
  }
}
