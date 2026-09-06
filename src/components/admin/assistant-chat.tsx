"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

import {
  decideProposalAction,
  type DecideProposalResult,
} from "@/app/[locale]/admin/(portal)/tasks/actions";

/**
 * The assistant conversation.
 *
 * The transcript is the server's, not this component's: every answered turn
 * is written to the owner's own conversation and read back from it, which is
 * what makes "ask again about the file I sent" possible at all. Three rules
 * of that store show through here and are worth naming, because the UI is
 * where a reader would otherwise assume the opposite:
 *
 * 1. **Only the owner.** There is no parameter for whose list to read; the
 *    server takes the owner from the session. Nothing in this file can widen
 *    it, and no Director override exists to ask for.
 * 2. **Seven days.** The list says so out loud rather than letting a person
 *    treat the chat as a filing cabinet.
 * 3. **Files are read on the server.** An upload returns a handle and a
 *    preview of what was extracted — never the file back. The browser holds
 *    the handle, so the next turn names the file instead of re-sending it.
 *
 * Answers are still rendered as plain text — no markdown, no HTML — and
 * links come only from the server's source list.
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

type TraceEntry = { tool: string; ok: boolean; code: string | null };

type ProviderStamp = {
  kind: "anthropic" | "openai-compatible" | "mock";
  model: string;
};

/**
 * An attachment as the browser knows it: a handle, plus enough of what the
 * server read to show the person what the model will actually see. The
 * extracted text stays on the server; `preview` is its opening lines.
 */
export type AttachmentChip = {
  id: string;
  fileName: string;
  format: string;
  kind: "spreadsheet" | "pdf" | "document" | "image";
  byteSize: number;
  preview: string | null;
  notes: readonly string[];
  truncated: boolean;
};

export type ConversationSummary = {
  id: string;
  title: string;
  messageCount: number;
  /** An ISO instant: the list renders it, never does arithmetic on it. */
  lastMessageAt: string;
};

export type AttachmentLimitsView = {
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  retentionDays: number;
};

type ChatResult = {
  text: string;
  trace: TraceEntry[];
  sources: Source[];
  proposals: ProposalView[];
  truncated: boolean;
  provider: ProviderStamp;
  dataAt: string;
  conversationId: string | null;
};

/**
 * A transcript message as it crosses into the browser: either from the
 * conversations API, or seeded by the page for the conversation named in
 * `?c=`. Dates are ISO strings on both paths so there is one shape.
 */
export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments: AttachmentChip[];
  trace: TraceEntry[];
  sources: Source[];
  proposalIds: string[];
  truncated: boolean;
  createdAt: string;
};

type Turn =
  | { role: "user"; text: string; attachments: readonly AttachmentChip[] }
  | {
      role: "assistant";
      text: string;
      trace: readonly TraceEntry[];
      sources: readonly Source[];
      /** Live proposals, decidable here. Empty for a replayed transcript. */
      proposals: readonly ProposalView[];
      /** Proposals the turn made, when only their count survived storage. */
      storedProposals: number;
      truncated: boolean;
      /** Null for a replayed turn: the transcript does not keep the model. */
      provider: ProviderStamp | null;
      at: string;
    }
  | { role: "error"; code: string };

/**
 * Extensions the upload accepts. It repeats `attachments/detect.ts` on
 * purpose — the server decides by magic number and the browser only spares
 * the person a round trip for an obviously wrong file. Being out of date
 * here can refuse early; it can never let anything through.
 */
const acceptedExtensions = [
  "xlsx",
  "xls",
  "csv",
  "txt",
  "pdf",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
] as const;

const acceptAttribute = acceptedExtensions
  .map((extension) => `.${extension}`)
  .join(",");

/**
 * One instant, formatted the same way on the server and in the browser.
 * The zone has to be pinned: `Intl` otherwise formats in whatever zone the
 * runtime is in, so a server in UTC and a reader at +07 render different
 * text for the same message and React throws the whole tree away with a
 * hydration mismatch. The zone is the company's, passed down from the
 * server so it stays a single setting rather than a constant repeated here.
 */
function formatInstant(
  iso: string,
  locale: "vi" | "en",
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(iso));
}

const NEWLINE = "\n";
/** An SSE event ends at a blank line, whichever line ending is in use. */
const EVENT_BOUNDARY = /\r?\n\r?\n/;

/**
 * Reads the answer as the server writes it.
 *
 * The status line is sent before the model has produced anything, so a
 * failure after that point cannot be an HTTP status — it arrives as an
 * `error` event with the same fixed code the plain path would have used.
 * Returning `null` means the stream ended without ever saying how it went,
 * which is a dead connection rather than a refusal.
 */
async function readAnswer(
  response: Response,
  on: {
    onText: (delta: string) => void;
    onReset: () => void;
    onTool: (entry: TraceEntry) => void;
  },
): Promise<ChatResult | { error: string } | null> {
  const body = response.body;
  if (!body) return null;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outcome: ChatResult | { error: string } | null = null;

  const handle = (raw: string) => {
    const lines = raw.split(NEWLINE);
    const name =
      lines
        .find((line) => line.startsWith("event:"))
        ?.slice(6)
        .trim() ?? "";
    const payload = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join(NEWLINE);
    if (!payload) return;
    let data: unknown;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }
    if (name === "delta") {
      const text = (data as { text?: unknown }).text;
      if (typeof text === "string") on.onText(text);
    } else if (name === "reset") {
      on.onReset();
    } else if (name === "tool") {
      on.onTool(data as TraceEntry);
    } else if (name === "done") {
      outcome = data as ChatResult;
    } else if (name === "error") {
      outcome = data as { error: string };
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(EVENT_BOUNDARY);
      buffer = parts.pop() ?? "";
      for (const part of parts) if (part.trim()) handle(part);
    }
  } finally {
    reader.releaseLock();
  }
  return outcome;
}

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
    answeredAt: "Đã trả lời lúc",
    mock: "GIẢ LẬP",
    mockHint:
      "Câu trả lời từ provider giả lập để phát triển, không phải mô hình thật.",
    proposalTitle: "Đề xuất chờ duyệt",
    proposalHint:
      "Chưa có việc nào được tạo. Kiểm tra rồi duyệt để tạo việc thật.",
    proposalStored:
      "Lượt này có đề xuất. Duyệt hoặc từ chối ở trang Việc cần làm.",
    assumptions: "Giả định",
    approve: "Duyệt và tạo việc",
    reject: "Từ chối",
    rejectReason: "Lý do từ chối",
    approved: "Đã duyệt và tạo việc.",
    rejected: "Đã từ chối đề xuất.",
    deciding: "Đang lưu…",
    viewTasks: "Xem việc cần làm",
    truncated: "Câu trả lời bị cắt ngắn.",
    attach: "Đính kèm tệp",
    attaching: "Đang đọc tệp…",
    attachHint:
      "Excel, CSV, PDF, Word, ảnh. Tệp được đọc trên máy chủ; bản gốc không được lưu.",
    dropHere: "Thả tệp vào đây",
    removeFile: "Bỏ tệp",
    readWhat: "Đã đọc được gì",
    fileNotes: "Ghi chú khi đọc",
    fileTruncated: "đã cắt bớt",
    fileImage: "Ảnh được gửi thẳng cho mô hình.",
    fileNoPreview: "Không có nội dung xem trước.",
    attachments: "Tệp đính kèm",
    historyTitle: "Hội thoại",
    historyNew: "Hội thoại mới",
    historyEmpty: "Chưa có hội thoại nào được lưu.",
    historyRetention: (days: number) =>
      `Hội thoại chỉ bạn đọc được và tự xóa sau ${days} ngày.`,
    historyShow: "Xem",
    historyHide: "Ẩn",
    historyLoading: "Đang mở…",
    historyDelete: "Xóa",
    historyDeleteConfirm: "Xóa hẳn?",
    historyMessages: (count: number) => `${count} lượt`,
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
      INVALID_REQUEST: "Yêu cầu không hợp lệ.",
      NOT_FOUND: "Hội thoại hoặc tệp không còn nữa (đã hết hạn hoặc bị xóa).",
      CONVERSATION_NOT_FOUND:
        "Hội thoại này không còn nữa (đã hết hạn hoặc bị xóa). Câu hỏi tiếp theo sẽ mở hội thoại mới.",
      ATTACHMENT_UNSUPPORTED:
        "Mô hình đang cấu hình không xem được ảnh. Gửi bản PDF hoặc Excel.",
      FILE_TYPE_REJECTED:
        "Định dạng không được nhận. Chỉ Excel, CSV, PDF, Word và ảnh.",
      FILE_TOO_LARGE: "Tệp vượt quá dung lượng cho phép.",
      FILE_TOO_MANY_ROWS: "Bảng có quá nhiều dòng để đọc trong chat.",
      FILE_EMPTY: "Tệp rỗng.",
      TOO_MANY_FILES: "Mỗi lượt chỉ đính kèm được tối đa 3 tệp.",
      FILE_ENCRYPTED: "Tệp đặt mật khẩu nên không đọc được.",
      FILE_MACRO_REJECTED: "Tệp có macro nên bị từ chối.",
      FILE_ZIP_SUSPICIOUS: "Cấu trúc tệp bất thường nên bị từ chối.",
      FILE_PARSE_FAILED: "Không đọc được tệp này.",
      NO_TEXT_FOUND:
        "Không tìm thấy chữ trong tệp (PDF chỉ có ảnh quét chưa đọc được).",
      IMAGE_NOT_SUPPORTED: "Định dạng ảnh này không được nhận.",
      PERMISSION_DENIED: "Bạn không có quyền với tệp này.",
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
    answeredAt: "Answered",
    mock: "MOCK",
    mockHint:
      "Answer from the scripted development provider, not a real model.",
    proposalTitle: "Proposal awaiting approval",
    proposalHint:
      "No task exists yet. Review, then approve to create the real tasks.",
    proposalStored:
      "This turn made a proposal. Approve or reject it on the tasks page.",
    assumptions: "Assumptions",
    approve: "Approve and create tasks",
    reject: "Reject",
    rejectReason: "Rejection reason",
    approved: "Approved; tasks created.",
    rejected: "Proposal rejected.",
    deciding: "Saving…",
    viewTasks: "View tasks",
    truncated: "The answer was cut short.",
    attach: "Attach files",
    attaching: "Reading the file…",
    attachHint:
      "Excel, CSV, PDF, Word, images. Files are read on the server; the original is never stored.",
    dropHere: "Drop the files here",
    removeFile: "Remove file",
    readWhat: "What was read",
    fileNotes: "Reader notes",
    fileTruncated: "cut short",
    fileImage: "The image goes to the model as it is.",
    fileNoPreview: "No preview text.",
    attachments: "Attachments",
    historyTitle: "Conversations",
    historyNew: "New conversation",
    historyEmpty: "No conversation is stored yet.",
    historyRetention: (days: number) =>
      `Only you can read these, and they are deleted after ${days} days.`,
    historyShow: "Show",
    historyHide: "Hide",
    historyLoading: "Opening…",
    historyDelete: "Delete",
    historyDeleteConfirm: "Delete for good?",
    historyMessages: (count: number) => `${count} turns`,
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
      INVALID_REQUEST: "The request was not valid.",
      NOT_FOUND:
        "That conversation or file is gone (it expired or was deleted).",
      CONVERSATION_NOT_FOUND:
        "This conversation is gone (it expired or was deleted). The next question opens a new one.",
      ATTACHMENT_UNSUPPORTED:
        "The configured model cannot look at images. Send a PDF or a spreadsheet.",
      FILE_TYPE_REJECTED:
        "That format is not accepted. Excel, CSV, PDF, Word and images only.",
      FILE_TOO_LARGE: "The file is larger than allowed.",
      FILE_TOO_MANY_ROWS: "The sheet has too many rows to read in chat.",
      FILE_EMPTY: "The file is empty.",
      TOO_MANY_FILES: "At most 3 files travel with one turn.",
      FILE_ENCRYPTED: "The file is password protected.",
      FILE_MACRO_REJECTED: "The file carries macros and was refused.",
      FILE_ZIP_SUSPICIOUS: "The file structure looked wrong and was refused.",
      FILE_PARSE_FAILED: "This file could not be read.",
      NO_TEXT_FOUND:
        "No text was found (a scanned-image PDF cannot be read yet).",
      IMAGE_NOT_SUPPORTED: "That image format is not accepted.",
      PERMISSION_DENIED: "You may not use that file.",
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

function formatBytes(value: number, locale: "vi" | "en"): string {
  const units = ["B", "KB", "MB"] as const;
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const digits = unit > 0 && size < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: digits,
  }).format(size)} ${units[unit] ?? "B"}`;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** The error code carried by a failed response, or a fallback. */
async function codeOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // A response with no JSON body reads as a generic outage.
  }
  return "UNAVAILABLE";
}

/** A stored transcript message, as a turn this component can draw. */
function turnOf(message: StoredMessage): Turn {
  if (message.role === "user") {
    return {
      role: "user",
      text: message.text,
      attachments: message.attachments ?? [],
    };
  }
  return {
    role: "assistant",
    text: message.text,
    trace: message.trace ?? [],
    sources: message.sources ?? [],
    proposals: [],
    // The transcript keeps the ids, not the plans: a replayed turn says a
    // proposal was made and sends the person to where it can be decided,
    // rather than drawing a card whose Approve button has nothing behind it.
    storedProposals: message.proposalIds?.length ?? 0,
    truncated: message.truncated,
    provider: null,
    at: message.createdAt,
  };
}

/** The id shape the store and the `?c=` parameter both use. */
const conversationIdPattern = /^[a-f0-9]{24}$/;

/**
 * Writes the open conversation into the address bar, the way a chat app
 * does, so a reload comes back to the same transcript instead of silently
 * starting a new one.
 *
 * Deliberately `history`, not `router.replace`: the transcript is already
 * on screen, and a navigation would re-run the server component only to
 * fetch what the browser is holding. `?q=` is dropped on the way, because
 * a seed prompt that has already been asked would otherwise refill the
 * composer on every reload.
 *
 * The history entry keeps whatever state the App Router put there — a new
 * entry with a null state makes the router fall back to a full page load
 * on Back.
 */
function syncConversationUrl(id: string | null, mode: "push" | "replace") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set("c", id);
    url.searchParams.delete("q");
  } else {
    url.searchParams.delete("c");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (
    next ===
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) {
    return;
  }
  const state: unknown = window.history.state;
  if (mode === "push") window.history.pushState(state, "", next);
  else window.history.replaceState(state, "", next);
}

/** The conversation the address bar is pointing at right now. */
function conversationInUrl(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get("c");
  return value && conversationIdPattern.test(value) ? value : null;
}

export function AssistantChat({
  locale,
  configured,
  missing,
  providerKind,
  description,
  suggestions,
  initialPrompt,
  initialConversationId,
  timeZone,
  initialMessages,
  initialConversations,
  limits,
}: {
  locale: "vi" | "en";
  configured: boolean;
  missing: readonly string[];
  providerKind: "anthropic" | "openai-compatible" | "mock" | null;
  /** What the assistant is for; shown in the empty transcript. */
  description: string;
  suggestions: readonly string[];
  initialPrompt?: string | undefined;
  /** The conversation named by `?c=`, already read on the server. */
  initialConversationId: string | null;
  /** The company's zone, so server and browser format an instant alike. */
  timeZone: string;
  initialMessages: readonly StoredMessage[];
  initialConversations: readonly ConversationSummary[];
  limits: AttachmentLimitsView;
}) {
  const text = copy[locale];
  const [turns, setTurns] = useState<Turn[]>(() => initialMessages.map(turnOf));
  const [input, setInput] = useState(initialPrompt ?? "");
  const [pending, setPending] = useState(false);

  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId,
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([
    ...initialConversations,
  ]);
  const [opening, setOpening] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // The answer as it is being written, plus the lookups reported while it
  // is. Both live outside `turns`: the finished turn is appended only when
  // the server sends its terminal event, so the transcript list always holds
  // whole turns and never a half-written one.
  const [streaming, setStreaming] = useState<string>("");
  const [progress, setProgress] = useState<TraceEntry[]>([]);

  const [staged, setStaged] = useState<AttachmentChip[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const popHandlerRef = useRef<() => void>(() => {});

  // On a wide screen the transcript scrolls, not the window: `scrollIntoView`
  // would drag the whole page and push the composer out of sight. Below `lg`
  // the column has no fixed height, so that region is not a scroller and the
  // page itself is — there the newest turn has to be brought into view, or a
  // phone answers a question somewhere below the fold.
  useEffect(() => {
    const region = transcriptRef.current;
    if (!region) return;
    if (region.scrollHeight > region.clientHeight) {
      region.scrollTop = region.scrollHeight;
      return;
    }
    region.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [turns, pending]);

  // Back and forward walk the conversations, since it is the URL that names
  // the open one. The handler is read from a ref so the listener is
  // registered once and still sees the current state.
  useEffect(() => {
    popHandlerRef.current = () => {
      const wanted = conversationInUrl();
      if (wanted === conversationId) return;
      if (wanted) void openConversation(wanted, "silent");
      else startNewConversation("silent");
    };
  });

  useEffect(() => {
    const listener = () => popHandlerRef.current();
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  async function refreshConversations() {
    try {
      const response = await fetch("/api/assistant/conversations", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return;
      const body = (await response.json()) as {
        conversations?: ConversationSummary[];
      };
      setConversations(body.conversations ?? []);
    } catch {
      // The list is a convenience; a failed refresh leaves the last one up.
    }
  }

  async function send(message: string) {
    const trimmed = message.trim();
    // A turn carrying only files is a real question ("what is in this?"),
    // which is why an empty message passes when something is attached.
    if ((!trimmed && staged.length === 0) || pending || uploading) return;
    setPending(true);
    setInput("");
    setUploadError(null);
    const carried = staged;
    setStaged([]);

    // History is only read by the server for a conversation it does not
    // hold. Once this chat has an id the server rebuilds the transcript from
    // the owner's own records, so sending turns back would be noise at best.
    const history = conversationId
      ? []
      : turns
          .filter(
            (turn): turn is Extract<Turn, { role: "user" | "assistant" }> =>
              turn.role !== "error",
          )
          .slice(-10)
          .map((turn) => ({
            role: turn.role,
            text:
              turn.text ||
              (turn.role === "user"
                ? `(${text.attachments}: ${turn.attachments
                    .map((attachment) => attachment.fileName)
                    .join(", ")})`
                : ""),
          }));

    setTurns((current) => [
      ...current,
      { role: "user", text: trimmed, attachments: carried },
    ]);
    setStreaming("");
    setProgress([]);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Ask to watch the answer being written. Without this header the
          // same endpoint answers with one JSON object, which is what every
          // script and test that talks to it still gets.
          accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: trimmed,
          history,
          locale,
          conversationId,
          attachmentIds: carried.map((attachment) => attachment.id),
        }),
      });
      if (!response.ok) {
        const code = await codeOf(response);
        // Nothing was recorded — the transcript is only written after an
        // answer exists — so the question goes back where it came from
        // rather than stranding a 4 MB upload behind an error.
        rollBack(trimmed, carried);
        // The conversation was deleted or expired elsewhere. Retrying into
        // it would fail the same way for ever, so this turn starts a new
        // one instead of leaving the composer pointed at a dead id.
        if (code === "CONVERSATION_NOT_FOUND") {
          setConversations((current) =>
            current.filter((entry) => entry.id !== conversationId),
          );
          setConversationId(null);
          syncConversationUrl(null, "replace");
        }
        setTurns((current) => [...current, { role: "error", code }]);
        return;
      }
      const result = await readAnswer(response, {
        onText: (delta) => setStreaming((current) => current + delta),
        onReset: () => setStreaming(""),
        onTool: (entry) => setProgress((current) => [...current, entry]),
      });
      if (result === null) {
        // The stream ended without an answer: the server said so with an
        // `error` event, or the connection died mid-turn.
        rollBack(trimmed, carried);
        setTurns((current) => [
          ...current,
          { role: "error", code: "PROVIDER_ERROR" },
        ]);
        return;
      }
      if ("error" in result) {
        rollBack(trimmed, carried);
        if (result.error === "CONVERSATION_NOT_FOUND") {
          setConversations((current) =>
            current.filter((entry) => entry.id !== conversationId),
          );
          setConversationId(null);
          syncConversationUrl(null, "replace");
        }
        setTurns((current) => [
          ...current,
          { role: "error", code: result.error },
        ]);
        return;
      }
      setTurns((current) => [
        ...current,
        {
          role: "assistant",
          text: result.text,
          trace: result.trace,
          sources: result.sources,
          proposals: result.proposals,
          storedProposals: 0,
          truncated: result.truncated,
          provider: result.provider,
          at: result.dataAt,
        },
      ]);

      const recorded = result.conversationId;
      if (recorded && recorded !== conversationId) {
        // A conversation the server just opened: its title is written from
        // the first question, so the list is read back rather than guessed.
        // The URL is replaced, not pushed — nothing was navigated to, and a
        // Back out of the answer the person just received would be wrong.
        setConversationId(recorded);
        syncConversationUrl(recorded, "replace");
        void refreshConversations();
      } else if (recorded) {
        const at = new Date().toISOString();
        setConversations((current) =>
          [...current]
            .map((entry) =>
              entry.id === recorded
                ? {
                    ...entry,
                    messageCount: entry.messageCount + 2,
                    lastMessageAt: at,
                  }
                : entry,
            )
            .sort((left, right) =>
              right.lastMessageAt.localeCompare(left.lastMessageAt),
            ),
        );
      }
    } catch {
      rollBack(trimmed, carried);
      setTurns((current) => [...current, { role: "error", code: "NETWORK" }]);
    } finally {
      setPending(false);
      setStreaming("");
      setProgress([]);
    }
  }

  /**
   * Puts a failed turn back in the composer: the optimistic question is
   * dropped from the transcript and its files return as chips, so a retry
   * is one press rather than another upload. Anything typed while the model
   * was answering wins — the person moved on, and this is stale.
   */
  function rollBack(message: string, carried: readonly AttachmentChip[]) {
    setTurns((current) =>
      current.length > 0 && current[current.length - 1]?.role === "user"
        ? current.slice(0, -1)
        : current,
    );
    setInput((current) => current || message);
    setStaged((current) => (current.length > 0 ? current : [...carried]));
  }

  async function upload(files: readonly File[]) {
    if (files.length === 0 || uploading || pending) return;
    setUploadError(null);

    // Cheap refusals happen here so an obviously wrong file never costs an
    // upload. The server checks all of this again, by magic number.
    const room = limits.maxFiles - staged.length;
    if (files.length > room) {
      setUploadError(text.errors.TOO_MANY_FILES ?? null);
      return;
    }
    for (const file of files) {
      if (file.size === 0) {
        setUploadError(text.errors.FILE_EMPTY ?? null);
        return;
      }
      if (file.size > limits.maxFileBytes) {
        setUploadError(text.errors.FILE_TOO_LARGE ?? null);
        return;
      }
      if (
        !(acceptedExtensions as readonly string[]).includes(
          extensionOf(file.name),
        )
      ) {
        setUploadError(text.errors.FILE_TYPE_REJECTED ?? null);
        return;
      }
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > limits.maxTotalBytes) {
      setUploadError(text.errors.FILE_TOO_LARGE ?? null);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("file", file);
      const response = await fetch("/api/assistant/attachments", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const code = await codeOf(response);
        setUploadError(text.errors[code] ?? text.errors.UNAVAILABLE ?? null);
        return;
      }
      const body = (await response.json()) as { attachments: AttachmentChip[] };
      setStaged((current) => [...current, ...body.attachments]);
    } catch {
      setUploadError(text.errors.NETWORK ?? null);
    } finally {
      setUploading(false);
    }
  }

  /**
   * Opens a stored conversation. `sync` is "silent" when the browser is
   * already showing the id — a Back or Forward press — so the history is
   * not written twice.
   */
  async function openConversation(
    id: string,
    sync: "push" | "silent" = "push",
  ) {
    if (id === conversationId || opening !== null || pending) return;
    setOpening(id);
    setHistoryError(null);
    try {
      const response = await fetch(`/api/assistant/conversations/${id}`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        const code = await codeOf(response);
        setHistoryError(text.errors[code] ?? text.errors.UNAVAILABLE ?? null);
        // Gone on the server: drop the row rather than leave a dead link,
        // and take the id out of the address bar so a reload does not try
        // it again.
        if (code === "NOT_FOUND") {
          setConversations((current) =>
            current.filter((entry) => entry.id !== id),
          );
          if (conversationInUrl() === id) syncConversationUrl(null, "replace");
        }
        return;
      }
      const body = (await response.json()) as { messages: StoredMessage[] };
      setTurns(body.messages.map(turnOf));
      setConversationId(id);
      if (sync === "push") syncConversationUrl(id, "push");
      setStaged([]);
      setUploadError(null);
      setHistoryOpen(false);
    } catch {
      setHistoryError(text.errors.NETWORK ?? null);
    } finally {
      setOpening(null);
    }
  }

  async function removeConversation(id: string) {
    setHistoryError(null);
    try {
      const response = await fetch(`/api/assistant/conversations/${id}`, {
        method: "DELETE",
      });
      // A conversation already gone is the outcome that was asked for.
      if (!response.ok && response.status !== 404) {
        const code = await codeOf(response);
        setHistoryError(text.errors[code] ?? text.errors.UNAVAILABLE ?? null);
        return;
      }
      setConversations((current) => current.filter((entry) => entry.id !== id));
      // Nothing to walk back to: the conversation no longer exists, so the
      // parameter is replaced rather than pushed.
      if (id === conversationId) startNewConversation("replace");
    } catch {
      setHistoryError(text.errors.NETWORK ?? null);
    }
  }

  /**
   * Empties the chat. "push" leaves the conversation the person was reading
   * one Back press away; "replace" is for a conversation that is gone, and
   * "silent" for a Back press that landed here on its own.
   */
  function startNewConversation(sync: "push" | "replace" | "silent" = "push") {
    setConversationId(null);
    setTurns([]);
    setStaged([]);
    setUploadError(null);
    setHistoryError(null);
    setHistoryOpen(false);
    if (sync !== "silent") syncConversationUrl(null, sync);
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

  const busy = pending || uploading;
  const empty = turns.length === 0;

  // A chat, not a document: the two columns fill what the shell left over
  // and scroll on their own, so the composer never walks off the screen.
  return (
    <div className="mt-6 grid min-h-[32rem] gap-4 lg:h-[calc(100dvh-16rem)] lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-burgundy/10 bg-ivory/70 flex min-h-0 min-w-0 flex-col gap-3 rounded-2xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-charcoal/50 text-xs font-semibold tracking-[0.12em] uppercase">
            {text.historyTitle}
          </p>
          {conversations.length > 0 ? (
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              aria-controls="assistant-history"
              className="text-charcoal/60 border-charcoal/20 inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold lg:hidden"
            >
              {historyOpen ? text.historyHide : text.historyShow}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => startNewConversation()}
          className="text-burgundy border-burgundy/25 hover:border-burgundy/50 inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-full border bg-white px-3 text-xs font-semibold"
        >
          {text.historyNew}
        </button>

        <div
          id="assistant-history"
          className={`${historyOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col gap-3 lg:flex`}
        >
          <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {conversations.length === 0 ? (
              <p className="text-charcoal/45 text-xs">{text.historyEmpty}</p>
            ) : (
              <ul className="grid gap-1.5">
                {conversations.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    locale={locale}
                    timeZone={timeZone}
                    active={conversation.id === conversationId}
                    opening={opening === conversation.id}
                    disabled={busy || opening !== null}
                    onOpen={() => void openConversation(conversation.id)}
                    onDelete={() => void removeConversation(conversation.id)}
                  />
                ))}
              </ul>
            )}
          </div>
          {historyError ? (
            <p role="alert" className="text-lacquer shrink-0 text-xs">
              {historyError}
            </p>
          ) : null}
          <p className="border-burgundy/10 text-charcoal/45 shrink-0 border-t pt-3 text-xs leading-5">
            {text.historyRetention(limits.retentionDays)}
          </p>
        </div>
      </aside>

      <div
        className="flex min-h-0 min-w-0 flex-col gap-3"
        onDragOver={(event) => {
          event.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = Array.from(event.dataTransfer.files ?? []);
          if (dropped.length > 0) void upload(dropped);
        }}
      >
        {providerKind === "mock" ? (
          <p className="shrink-0 rounded-xl bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
            {text.mock} · {text.mockHint}
          </p>
        ) : null}

        <div
          ref={transcriptRef}
          className={`min-h-0 flex-1 overflow-y-auto rounded-2xl border bg-white p-4 shadow-[0_1rem_3rem_rgb(61_13_16/0.04)] ${
            dragging ? "border-burgundy border-dashed" : "border-burgundy/15"
          }`}
        >
          <div
            className={`mx-auto flex w-full max-w-3xl flex-col ${
              empty ? "h-full justify-center" : ""
            }`}
          >
            {dragging ? (
              <p className="text-burgundy mb-3 shrink-0 text-sm font-semibold">
                {text.dropHere}
              </p>
            ) : null}

            {empty ? (
              <div className="text-center">
                <p className="text-charcoal/65 mx-auto max-w-xl text-sm leading-7">
                  {description}
                </p>
                <p className="text-charcoal/50 mt-6 text-xs font-semibold tracking-[0.12em] uppercase">
                  {text.suggestions}
                </p>
                <ul className="mt-3 flex flex-wrap justify-center gap-2">
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
                    <div className="ml-auto w-fit max-w-[85%]">
                      {turn.text ? (
                        <p className="bg-burgundy text-ivory rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
                          {turn.text}
                        </p>
                      ) : null}
                      {turn.attachments.length > 0 ? (
                        <AttachmentList
                          items={turn.attachments}
                          locale={locale}
                          align="end"
                        />
                      ) : null}
                    </div>
                  ) : turn.role === "error" ? (
                    <p
                      role="alert"
                      className="border-lacquer/40 bg-lacquer/5 text-lacquer max-w-[85%] rounded-2xl border px-4 py-2.5 text-sm"
                    >
                      {text.errors[turn.code] ?? text.errors.UNAVAILABLE}
                    </p>
                  ) : (
                    <AssistantTurn
                      turn={turn}
                      locale={locale}
                      timeZone={timeZone}
                    />
                  )}
                </li>
              ))}
            </ol>
            {pending ? (
              <div className="mt-4 max-w-[92%]" aria-live="polite">
                {streaming ? (
                  <div className="bg-ivory/70 text-charcoal rounded-2xl rounded-bl-sm px-4 py-3 text-sm whitespace-pre-wrap">
                    {streaming}
                    <span className="bg-burgundy/60 ml-0.5 inline-block h-4 w-[2px] animate-pulse align-text-bottom" />
                  </div>
                ) : null}
                <p className="text-charcoal/50 mt-2 px-1 text-xs">
                  {progress.length > 0
                    ? `${text.tools}: ${progress
                        .map(
                          (entry) =>
                            `${entry.tool}${entry.ok ? "" : ` (${entry.code})`}`,
                        )
                        .join(", ")}`
                    : text.sending}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <form
          data-testid="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="border-burgundy/20 sticky bottom-3 mx-auto grid w-full max-w-3xl shrink-0 gap-2 rounded-2xl border bg-white p-2 lg:static"
        >
          {staged.length > 0 ? (
            <AttachmentList
              items={staged}
              locale={locale}
              align="start"
              onRemove={(id) =>
                setStaged((current) =>
                  current.filter((attachment) => attachment.id !== id),
                )
              }
            />
          ) : null}
          {uploadError ? (
            <p role="alert" className="text-lacquer px-2 text-xs">
              {uploadError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
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
              className="min-w-0 flex-1 resize-none rounded-xl bg-white px-3 py-2 text-sm outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                name="attachment"
                multiple
                accept={acceptAttribute}
                className="hidden"
                onChange={(event) => {
                  const chosen = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (chosen.length > 0) void upload(chosen);
                }}
              />
              <button
                type="button"
                disabled={busy || staged.length >= limits.maxFiles}
                onClick={() => fileInputRef.current?.click()}
                className="text-burgundy border-burgundy/25 hover:border-burgundy/50 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold disabled:opacity-45"
              >
                {uploading ? text.attaching : text.attach}
              </button>
              <button
                type="submit"
                disabled={busy || (!input.trim() && staged.length === 0)}
                className="bg-lacquer text-ivory hover:bg-burgundy inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold disabled:opacity-50"
              >
                {text.send}
              </button>
            </div>
          </div>
          <p className="text-charcoal/45 px-2 pb-1 text-xs leading-5">
            {text.attachHint}
          </p>
        </form>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  locale,
  timeZone,
  active,
  opening,
  disabled,
  onOpen,
  onDelete,
}: {
  conversation: ConversationSummary;
  locale: "vi" | "en";
  timeZone: string;
  active: boolean;
  opening: boolean;
  disabled: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const text = copy[locale];
  // The two-step delete the admin list rows use: the first press arms the
  // button, a blur disarms it. Nothing here is recoverable once deleted.
  const [armed, setArmed] = useState(false);

  return (
    <li
      className={`rounded-xl border px-3 py-2 ${
        active ? "border-burgundy/40 bg-ivory/70" : "border-burgundy/10"
      }`}
    >
      <button
        type="button"
        disabled={disabled && !opening}
        onClick={onOpen}
        className="block w-full text-left disabled:opacity-60"
      >
        <span className="text-charcoal line-clamp-2 block text-sm leading-5 font-medium">
          {conversation.title}
        </span>
        <span className="text-charcoal/45 mt-0.5 block text-xs">
          {opening
            ? text.historyLoading
            : `${text.historyMessages(conversation.messageCount)} · ${formatInstant(
                conversation.lastMessageAt,
                locale,
                timeZone,
              )}`}
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          onDelete();
        }}
        onBlur={() => setArmed(false)}
        className={`mt-1 text-xs font-semibold ${
          armed ? "text-lacquer" : "text-charcoal/40 hover:text-lacquer"
        }`}
      >
        {armed ? text.historyDeleteConfirm : text.historyDelete}
      </button>
    </li>
  );
}

/**
 * The chips under a question: what was attached and, behind a disclosure,
 * what the server actually managed to read out of it. The preview matters —
 * a person who sees "the first rows" knows the model is reading a partial
 * sheet, and a note saying pages were dropped is the only place that shows.
 */
function AttachmentList({
  items,
  locale,
  align,
  onRemove,
}: {
  items: readonly AttachmentChip[];
  locale: "vi" | "en";
  align: "start" | "end";
  onRemove?: (id: string) => void;
}) {
  const text = copy[locale];
  return (
    <div className={align === "end" ? "mt-1.5 text-right" : "px-1"}>
      <ul
        className={`flex flex-wrap gap-1.5 ${
          align === "end" ? "justify-end" : ""
        }`}
      >
        {items.map((attachment) => (
          <li
            key={attachment.id}
            className="border-burgundy/20 bg-ivory/60 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1"
          >
            <span className="text-charcoal/45 font-mono text-[0.65rem] uppercase">
              {attachment.format}
            </span>
            <span className="text-charcoal max-w-40 truncate text-xs">
              {attachment.fileName}
            </span>
            <span className="text-charcoal/45 text-[0.65rem]">
              {formatBytes(attachment.byteSize, locale)}
            </span>
            {attachment.truncated ? (
              <span className="text-[0.65rem] font-semibold text-amber-700">
                {text.fileTruncated}
              </span>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                aria-label={`${text.removeFile}: ${attachment.fileName}`}
                className="text-charcoal/45 hover:text-lacquer text-sm leading-none"
              >
                ×
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <details className="mt-1 text-left">
        <summary className="text-charcoal/50 cursor-pointer text-xs">
          {text.readWhat}
        </summary>
        <ul className="mt-1 grid gap-2">
          {items.map((attachment) => (
            <li key={attachment.id} className="text-charcoal/60 text-xs">
              <span className="font-semibold">{attachment.fileName}</span>
              <p className="mt-0.5 leading-5">
                {attachment.kind === "image"
                  ? text.fileImage
                  : (attachment.preview ?? text.fileNoPreview)}
              </p>
              {attachment.notes.length > 0 ? (
                <p className="text-charcoal/45 mt-0.5">
                  {text.fileNotes}: {attachment.notes.join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function AssistantTurn({
  turn,
  locale,
  timeZone,
}: {
  turn: Extract<Turn, { role: "assistant" }>;
  locale: "vi" | "en";
  timeZone: string;
}) {
  const text = copy[locale];
  return (
    <div className="max-w-[92%]">
      <div className="bg-ivory/70 text-charcoal rounded-2xl rounded-bl-sm px-4 py-3 text-sm whitespace-pre-wrap">
        {turn.text}
        {turn.truncated ? (
          <p className="text-lacquer mt-2 text-xs">{text.truncated}</p>
        ) : null}
      </div>
      <div className="text-charcoal/50 mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
        {turn.provider?.kind === "mock" ? (
          <span className="font-semibold text-amber-800">{text.mock}</span>
        ) : null}
        {turn.trace.length > 0 ? (
          <span>
            {text.tools}:{" "}
            {turn.trace
              .map(
                (entry) => `${entry.tool}${entry.ok ? "" : ` (${entry.code})`}`,
              )
              .join(", ")}
          </span>
        ) : null}
        <span>
          {turn.provider ? text.dataAt : text.answeredAt}{" "}
          {formatInstant(turn.at, locale, timeZone)}
        </span>
      </div>
      {turn.sources.length > 0 ? (
        <p className="mt-1 flex flex-wrap gap-x-3 px-1 text-xs">
          <span className="text-charcoal/50">{text.sources}:</span>
          {turn.sources.map((source) => {
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
      {turn.proposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} locale={locale} />
      ))}
      {turn.proposals.length === 0 && turn.storedProposals > 0 ? (
        <p className="border-gold/50 bg-gold/10 mt-3 rounded-2xl border px-4 py-2.5 text-xs">
          {text.proposalStored}{" "}
          <Link
            href={`/${locale}/admin/tasks` as Route}
            className="text-burgundy font-semibold hover:underline"
          >
            {text.viewTasks}
          </Link>
        </p>
      ) : null}
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
