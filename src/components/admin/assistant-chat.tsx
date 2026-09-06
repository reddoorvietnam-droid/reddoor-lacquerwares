"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

import {
  decideProposalAction,
  type DecideProposalResult,
} from "@/app/[locale]/admin/(portal)/tasks/actions";

/**
 * The assistant conversation. The transcript lives only in this component
 * for the life of the page: nothing is stored server-side, so a revoked
 * grant cannot be replayed from history, and every answer is stamped with
 * the provider that produced it. Answers are rendered as plain text — no
 * markdown, no HTML — and links come only from the server's source list.
 */

type ProposalItem = {
  index: number;
  title: string;
  dueDate: string | null;
  ownerRole: string | null;
  assigneeUserId: string | null;
};

type ProposalView = {
  id: string;
  kind: "orderPlan" | "tasks";
  status: string;
  orderCode: string | null;
  items: ProposalItem[];
  assumptions: string[];
  revision: number;
};

type Source = { label: string; href: string };

type ChatResult = {
  text: string;
  trace: { tool: string; ok: boolean; code: string | null }[];
  sources: Source[];
  proposals: ProposalView[];
  truncated: boolean;
  provider: { kind: "anthropic" | "mock"; model: string };
  dataAt: string;
};

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; result: ChatResult }
  | { role: "error"; code: string; detail?: string };

const copy = {
  vi: {
    placeholder:
      "Hỏi về đơn hàng, việc cần làm, công nợ… hoặc yêu cầu lập kế hoạch cho một đơn",
    send: "Gửi",
    sending: "Đang tra cứu…",
    suggestions: "Gợi ý",
    sources: "Nguồn",
    tools: "Đã tra cứu",
    dataAt: "Dữ liệu lúc",
    mock: "GIẢ LẬP",
    mockHint:
      "Câu trả lời từ provider giả lập để phát triển, không phải mô hình thật.",
    proposalTitle: "Đề xuất chờ duyệt",
    proposalHint:
      "Chưa có việc nào được tạo. Kiểm tra rồi duyệt để tạo việc thật.",
    assumptions: "Giả định",
    approve: "Duyệt và tạo việc",
    reject: "Từ chối",
    rejectReason: "Lý do từ chối",
    approved: "Đã duyệt và tạo việc.",
    rejected: "Đã từ chối đề xuất.",
    deciding: "Đang lưu…",
    viewTasks: "Xem việc cần làm",
    truncated: "Câu trả lời bị cắt ngắn.",
    errors: {
      UNAUTHENTICATED: "Phiên đăng nhập đã hết. Đăng nhập lại.",
      FORBIDDEN: "Tài khoản của bạn không có quyền dùng trợ lý.",
      NOT_CONFIGURED: "Trợ lý chưa được cấu hình trên máy chủ (thiếu khóa AI).",
      RATE_LIMITED: "Bạn gửi quá nhanh. Đợi một lát rồi thử lại.",
      PROVIDER_TIMEOUT:
        "Mô hình không phản hồi kịp. Không có thao tác nào được thực hiện. Thử lại.",
      PROVIDER_ERROR:
        "Nhà cung cấp mô hình báo lỗi. Không có thao tác nào được thực hiện.",
      UNAVAILABLE: "Hệ thống tạm thời không phản hồi.",
      NETWORK: "Không kết nối được máy chủ.",
      ALREADY_DECIDED: "Đề xuất đã được quyết định trước đó.",
      SOURCE_CHANGED:
        "Đơn hàng đã thay đổi sau khi đề xuất; hãy yêu cầu kế hoạch mới.",
      INVALID_PLAN: "Kế hoạch không còn hợp lệ; hãy yêu cầu kế hoạch mới.",
      REVISION_CONFLICT: "Đề xuất đã thay đổi; tải lại trang.",
      INVALID_INPUT: "Dữ liệu chưa hợp lệ (từ chối cần lý do).",
    } as Record<string, string>,
  },
  en: {
    placeholder:
      "Ask about orders, tasks, receivables… or ask for a plan for an order",
    send: "Send",
    sending: "Looking up…",
    suggestions: "Suggestions",
    sources: "Sources",
    tools: "Looked up",
    dataAt: "Data as of",
    mock: "MOCK",
    mockHint:
      "Answer from the scripted development provider, not a real model.",
    proposalTitle: "Proposal awaiting approval",
    proposalHint:
      "No task exists yet. Review, then approve to create the real tasks.",
    assumptions: "Assumptions",
    approve: "Approve and create tasks",
    reject: "Reject",
    rejectReason: "Rejection reason",
    approved: "Approved; tasks created.",
    rejected: "Proposal rejected.",
    deciding: "Saving…",
    viewTasks: "View tasks",
    truncated: "The answer was cut short.",
    errors: {
      UNAUTHENTICATED: "Your session expired. Sign in again.",
      FORBIDDEN: "Your account may not use the assistant.",
      NOT_CONFIGURED:
        "The assistant is not configured on the server (AI key missing).",
      RATE_LIMITED: "Too many requests. Wait a moment and retry.",
      PROVIDER_TIMEOUT:
        "The model did not answer in time. Nothing was changed. Retry.",
      PROVIDER_ERROR:
        "The model provider returned an error. Nothing was changed.",
      UNAVAILABLE: "The system is temporarily unavailable.",
      NETWORK: "Could not reach the server.",
      ALREADY_DECIDED: "This proposal was already decided.",
      SOURCE_CHANGED:
        "The order changed after the proposal; ask for a new plan.",
      INVALID_PLAN: "The plan is no longer valid; ask for a new plan.",
      REVISION_CONFLICT: "The proposal changed; reload the page.",
      INVALID_INPUT: "Invalid input (a rejection needs a reason).",
    } as Record<string, string>,
  },
} as const;

function safeInternalHref(href: string): Route | null {
  return /^\/[a-z]{2}(?:-[A-Z]{2})?\/admin(?:\/[A-Za-z0-9._\-/?=&#%]*)?$/.test(
    href,
  )
    ? (href as Route)
    : null;
}

export function AssistantChat({
  locale,
  configured,
  missing,
  providerKind,
  suggestions,
  initialPrompt,
}: {
  locale: "vi" | "en";
  configured: boolean;
  missing: readonly string[];
  providerKind: "anthropic" | "mock" | null;
  suggestions: readonly string[];
  initialPrompt?: string | undefined;
}) {
  const text = copy[locale];
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, pending]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setInput("");
    const history = turns
      .filter(
        (turn): turn is Extract<Turn, { role: "user" | "assistant" }> =>
          turn.role !== "error",
      )
      .slice(-10)
      .map((turn) => ({ role: turn.role, text: turn.text }));
    setTurns((current) => [...current, { role: "user", text: trimmed }]);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, history, locale }),
      });
      if (!response.ok) {
        let code = "UNAVAILABLE";
        try {
          const body = (await response.json()) as { error?: string };
          if (body.error) code = body.error;
        } catch {
          // keep the generic code
        }
        setTurns((current) => [...current, { role: "error", code }]);
        return;
      }
      const result = (await response.json()) as ChatResult;
      setTurns((current) => [
        ...current,
        { role: "assistant", text: result.text, result },
      ]);
    } catch {
      setTurns((current) => [...current, { role: "error", code: "NETWORK" }]);
    } finally {
      setPending(false);
    }
  }

  if (!configured) {
    return (
      <section className="border-lacquer/25 bg-lacquer/5 mt-8 max-w-3xl rounded-2xl border p-6">
        <p className="text-burgundy font-semibold">
          {text.errors.NOT_CONFIGURED}
        </p>
        {missing.length > 0 ? (
          <p className="text-charcoal/60 mt-2 font-mono text-xs">
            {missing.join(", ")}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <div className="mt-8 grid gap-4">
      {providerKind === "mock" ? (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
          {text.mock} · {text.mockHint}
        </p>
      ) : null}

      <div className="border-burgundy/15 min-h-64 rounded-2xl border bg-white p-4 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)]">
        {turns.length === 0 ? (
          <div>
            <p className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
              {text.suggestions}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="text-burgundy border-burgundy/20 hover:bg-ivory/70 rounded-full border px-4 py-2 text-left text-sm"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ol className="grid gap-4" aria-live="polite">
          {turns.map((turn, index) => (
            <li key={index}>
              {turn.role === "user" ? (
                <p className="bg-burgundy text-ivory ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
                  {turn.text}
                </p>
              ) : turn.role === "error" ? (
                <p
                  role="alert"
                  className="border-lacquer/40 bg-lacquer/5 text-lacquer max-w-[85%] rounded-2xl border px-4 py-2.5 text-sm"
                >
                  {text.errors[turn.code] ?? text.errors.UNAVAILABLE}
                </p>
              ) : (
                <AssistantTurn turn={turn} locale={locale} />
              )}
            </li>
          ))}
        </ol>
        {pending ? (
          <p className="text-charcoal/50 mt-3 text-sm">{text.sending}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="sticky bottom-3 flex gap-2"
      >
        <label htmlFor="assistant-input" className="sr-only">
          {text.placeholder}
        </label>
        <textarea
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder={text.placeholder}
          className="border-burgundy/20 focus:border-burgundy/50 min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center self-end rounded-full px-6 text-sm font-semibold disabled:opacity-50"
        >
          {text.send}
        </button>
      </form>
    </div>
  );
}

function AssistantTurn({
  turn,
  locale,
}: {
  turn: Extract<Turn, { role: "assistant" }>;
  locale: "vi" | "en";
}) {
  const text = copy[locale];
  const { result } = turn;
  return (
    <div className="max-w-[92%]">
      <div className="bg-ivory/70 text-charcoal rounded-2xl rounded-bl-sm px-4 py-3 text-sm whitespace-pre-wrap">
        {turn.text}
        {result.truncated ? (
          <p className="text-lacquer mt-2 text-xs">{text.truncated}</p>
        ) : null}
      </div>
      <div className="text-charcoal/50 mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
        {result.provider.kind === "mock" ? (
          <span className="font-semibold text-amber-800">{text.mock}</span>
        ) : null}
        {result.trace.length > 0 ? (
          <span>
            {text.tools}:{" "}
            {result.trace
              .map(
                (entry) => `${entry.tool}${entry.ok ? "" : ` (${entry.code})`}`,
              )
              .join(", ")}
          </span>
        ) : null}
        <span>
          {text.dataAt}{" "}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(result.dataAt))}
        </span>
      </div>
      {result.sources.length > 0 ? (
        <p className="mt-1 flex flex-wrap gap-x-3 px-1 text-xs">
          <span className="text-charcoal/50">{text.sources}:</span>
          {result.sources.map((source) => {
            const href = safeInternalHref(source.href);
            return href ? (
              <Link
                key={source.href}
                href={href}
                className="text-burgundy font-semibold hover:underline"
              >
                {source.label}
              </Link>
            ) : (
              <span key={source.href}>{source.label}</span>
            );
          })}
        </p>
      ) : null}
      {result.proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} locale={locale} />
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  locale,
}: {
  proposal: ProposalView;
  locale: "vi" | "en";
}) {
  const text = copy[locale];
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "decided"; result: Extract<DecideProposalResult, { ok: true }> }
    | { kind: "failed"; code: string; details: string[] }
  >({ kind: "idle" });
  const [reason, setReason] = useState("");

  async function decide(decision: "approved" | "rejected") {
    if (state.kind === "saving" || state.kind === "decided") return;
    setState({ kind: "saving" });
    const result = await decideProposalAction({
      proposalId: proposal.id,
      expectedRevision: proposal.revision,
      decision,
      reason: reason.trim() || null,
    });
    if (result.ok) setState({ kind: "decided", result });
    else
      setState({ kind: "failed", code: result.code, details: result.details });
  }

  return (
    <section
      data-testid="proposal-card"
      className="border-gold/50 bg-gold/10 mt-3 rounded-2xl border p-4"
    >
      <p className="text-burgundy text-sm font-semibold">
        {text.proposalTitle}
        {proposal.orderCode ? (
          <span className="ml-2 font-mono">{proposal.orderCode}</span>
        ) : null}
      </p>
      <p className="text-charcoal/60 mt-1 text-xs">{text.proposalHint}</p>
      <ol className="mt-2 grid gap-1 text-sm">
        {proposal.items.map((item) => (
          <li key={item.index} className="flex flex-wrap gap-x-3">
            <span>{item.title}</span>
            {item.dueDate ? (
              <span className="text-charcoal/50 font-mono text-xs">
                {item.dueDate}
              </span>
            ) : null}
            {item.ownerRole ? (
              <span className="text-charcoal/45 text-xs">{item.ownerRole}</span>
            ) : null}
          </li>
        ))}
      </ol>
      {proposal.assumptions.length > 0 ? (
        <details className="mt-2 text-xs">
          <summary className="text-charcoal/60 cursor-pointer font-semibold">
            {text.assumptions} ({proposal.assumptions.length})
          </summary>
          <ul className="text-charcoal/60 mt-1 list-disc pl-5">
            {proposal.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {state.kind === "decided" ? (
        <p className="mt-3 text-sm font-semibold">
          {state.result.status === "approved" ? text.approved : text.rejected}{" "}
          <Link
            href={`/${locale}/admin/tasks` as Route}
            className="text-burgundy hover:underline"
          >
            {text.viewTasks}
          </Link>
        </p>
      ) : (
        <div className="mt-3">
          {state.kind === "failed" ? (
            <p role="alert" className="text-lacquer mb-2 text-xs">
              {state.code === "FORBIDDEN"
                ? locale === "vi"
                  ? "Bạn không giữ quyền duyệt đề xuất này."
                  : "You do not hold the permission to decide this proposal."
                : (text.errors[state.code] ?? text.errors.UNAVAILABLE)}
              {state.details.length > 0 ? ` (${state.details.join("; ")})` : ""}
            </p>
          ) : null}
          <label
            htmlFor={`reason-${proposal.id}`}
            className="text-charcoal/60 mb-1 block text-xs"
          >
            {text.rejectReason}
          </label>
          <input
            id={`reason-${proposal.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            className="border-burgundy/20 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={state.kind === "saving"}
              onClick={() => void decide("approved")}
              className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-10 items-center rounded-full px-5 text-sm font-semibold disabled:opacity-50"
            >
              {state.kind === "saving" ? text.deciding : text.approve}
            </button>
            <button
              type="button"
              disabled={state.kind === "saving"}
              onClick={() => void decide("rejected")}
              className="text-burgundy border-burgundy/30 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {text.reject}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
