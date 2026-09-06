import type Anthropic from "@anthropic-ai/sdk";

import type { ProviderResult } from "@/domains/assistant/providers/types";

/**
 * Translation between the orchestrator's Anthropic-shaped request/result and
 * the OpenAI Chat Completions wire format that Gemini's compatibility
 * endpoint, Groq, Ollama and others speak. Pure functions with no I/O, so
 * the mapping is unit-tested without a network and the provider class is a
 * thin HTTP shell around it.
 */

export type ChatToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/**
 * A user turn carrying an image has to become an array of parts. The system
 * role keeps its own variant with a plain string: these endpoints accept
 * parts only on a user turn, and widening both at once would let a system
 * prompt be built out of parts that some of them silently drop.
 */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ChatContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  tools?: ChatTool[];
  tool_choice?: "auto";
  reasoning_effort?: string;
  stream?: true;
  stream_options?: { include_usage: true };
};

export type ChatCompletionResponse = {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: {
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export function toChatCompletionRequest(input: {
  model: string;
  system: string;
  messages: readonly Anthropic.MessageParam[];
  tools: readonly Anthropic.Tool[];
  maxTokens: number;
  reasoningEffort?: string | undefined;
  stream?: boolean;
}): ChatCompletionRequest {
  const request: ChatCompletionRequest = {
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      ...toChatMessages(input.messages),
    ],
    max_tokens: input.maxTokens,
  };
  // An empty tool list is rejected by some endpoints; omit it instead.
  if (input.tools.length > 0) {
    request.tools = input.tools.map(toChatTool);
    request.tool_choice = "auto";
  }
  if (input.reasoningEffort) request.reasoning_effort = input.reasoningEffort;
  if (input.stream) {
    request.stream = true;
    // Without this the usage numbers never arrive on a streamed answer and
    // the turn would be recorded as having cost nothing.
    request.stream_options = { include_usage: true };
  }
  return request;
}

export function toChatMessages(
  messages: readonly Anthropic.MessageParam[],
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push(
        message.role === "assistant"
          ? { role: "assistant", content: message.content }
          : { role: "user", content: message.content },
      );
      continue;
    }
    if (message.role === "assistant") {
      const text: string[] = [];
      const toolCalls: ChatToolCall[] = [];
      for (const block of message.content) {
        if (block.type === "text") {
          text.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }
      const assistant: Extract<ChatMessage, { role: "assistant" }> = {
        role: "assistant",
        content: text.join("\n") || (toolCalls.length > 0 ? null : ""),
      };
      if (toolCalls.length > 0) assistant.tool_calls = toolCalls;
      out.push(assistant);
      continue;
    }
    // A user turn: tool results must directly follow the tool calls of the
    // assistant, so they come first; text and images become a user message
    // after them. A turn made only of images still has to produce a
    // message — dropping it would silently delete the person's question and
    // leave the request ending on a tool result.
    const text: string[] = [];
    const images: ChatContentPart[] = [];
    for (const block of message.content) {
      if (block.type === "tool_result") {
        out.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: toolResultText(block),
        });
      } else if (block.type === "text") {
        text.push(block.text);
      } else if (block.type === "image" && block.source.type === "base64") {
        images.push({
          type: "image_url",
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        });
      }
    }
    if (images.length > 0) {
      const parts: ChatContentPart[] = [];
      if (text.length > 0) parts.push({ type: "text", text: text.join("\n") });
      parts.push(...images);
      out.push({ role: "user", content: parts });
    } else if (text.length > 0) {
      out.push({ role: "user", content: text.join("\n") });
    }
  }
  return out;
}

function toolResultText(block: Anthropic.ToolResultBlockParam): string {
  if (typeof block.content === "string") return block.content;
  return (block.content ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");
}

export function toChatTool(tool: Anthropic.Tool): ChatTool {
  const definition: ChatTool = {
    type: "function",
    function: {
      name: tool.name,
      parameters: sanitizeToolSchema(tool.input_schema),
    },
  };
  if (tool.description) definition.function.description = tool.description;
  return definition;
}

/**
 * JSON Schema keywords these endpoints accept in function parameters. Gemini
 * in particular rejects or ignores the rest, and a rejected schema fails the
 * whole request, so anything else is dropped rather than passed through.
 */
const KEPT_KEYWORDS = new Set([
  "type",
  "description",
  "enum",
  "items",
  "properties",
  "required",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "default",
  "anyOf",
  "nullable",
  "title",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeToolSchema(schema: unknown): Record<string, unknown> {
  if (!isObject(schema)) return {};

  // `x | null` unions become the member marked nullable: one plain schema
  // instead of an anyOf with a null branch.
  if (Array.isArray(schema.anyOf)) {
    const members = schema.anyOf.filter(
      (member) => !(isObject(member) && member.type === "null"),
    );
    if (members.length === 1 && members.length < schema.anyOf.length) {
      const rest = Object.fromEntries(
        Object.entries(schema).filter(([key]) => key !== "anyOf"),
      );
      const member = isObject(members[0]) ? members[0] : {};
      return { ...sanitizeToolSchema({ ...rest, ...member }), nullable: true };
    }
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!KEPT_KEYWORDS.has(key)) continue;
    if (key === "properties") {
      out.properties = isObject(value)
        ? Object.fromEntries(
            Object.entries(value).map(([name, property]) => [
              name,
              sanitizeToolSchema(property),
            ]),
          )
        : {};
    } else if (key === "items") {
      out.items = sanitizeToolSchema(value);
    } else if (key === "anyOf") {
      out.anyOf = Array.isArray(value) ? value.map(sanitizeToolSchema) : [];
    } else {
      out[key] = value;
    }
  }

  // Records (z.record with enum keys) arrive as propertyNames +
  // additionalProperties, neither of which is understood here; spell each
  // allowed key out as a property with the shared value schema instead.
  const keyEnum =
    isObject(schema.propertyNames) && Array.isArray(schema.propertyNames.enum)
      ? schema.propertyNames.enum.filter(
          (key): key is string => typeof key === "string",
        )
      : null;
  if (
    out.type === "object" &&
    !out.properties &&
    keyEnum &&
    isObject(schema.additionalProperties)
  ) {
    const valueSchema = sanitizeToolSchema(schema.additionalProperties);
    out.properties = Object.fromEntries(
      keyEnum.map((key) => [key, { ...valueSchema }]),
    );
  }

  if (Array.isArray(out.required)) {
    const known = isObject(out.properties) ? out.properties : {};
    const required = out.required.filter(
      (key): key is string => typeof key === "string" && key in known,
    );
    if (required.length > 0) out.required = required;
    else delete out.required;
  }
  return out;
}

let sequence = 0;

export function fromChatCompletion(
  payload: ChatCompletionResponse,
): ProviderResult {
  const choice = payload.choices?.[0];
  const message = choice?.message;
  const content: Anthropic.ContentBlock[] = [];

  const text = typeof message?.content === "string" ? message.content : "";
  if (text.trim()) content.push({ type: "text", text, citations: null });

  for (const call of message?.tool_calls ?? []) {
    const name = call.function?.name;
    if (!name) continue;
    sequence += 1;
    content.push({
      type: "tool_use",
      id: call.id || `call_${sequence}`,
      name,
      input: parseArguments(call.function?.arguments),
      caller: { type: "direct" },
    });
  }

  const hasToolUse = content.some((block) => block.type === "tool_use");
  return {
    content,
    // Some endpoints report "stop" even when tool calls are present; the
    // calls themselves are the authoritative signal.
    stopReason: hasToolUse ? "tool_use" : stopReasonOf(choice?.finish_reason),
    usage: {
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
    },
  };
}

function stopReasonOf(
  reason: string | null | undefined,
): Anthropic.Message["stop_reason"] {
  switch (reason) {
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "end_turn";
  }
}

/**
 * Tool arguments arrive as a JSON string. Anything unparseable becomes an
 * empty object: the schema validation in the chat loop then tells the model
 * which fields are missing, and the model gets to call again.
 */
function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Streaming                                                           */
/* ------------------------------------------------------------------ */

/**
 * One `data:` payload of a streamed completion. The shape mirrors the
 * non-streamed response except that everything arrives in fragments: text a
 * few characters at a time, and a tool call spread over many chunks, keyed
 * by `index` rather than by id — the id and the function name usually come
 * in the first fragment for that index and the arguments accumulate after.
 */
export type ChatCompletionChunk = {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Splits a growing buffer into complete SSE events. An event ends at a blank
 * line, so whatever follows the last one is an unfinished event and is
 * handed back to be prepended to the next network chunk — a boundary that
 * falls inside a multi-byte character or inside a JSON payload is the whole
 * reason this is a function and not a `split` at the call site.
 */
export function splitSseEvents(buffer: string): {
  events: string[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  return { events: parts.filter((part) => part.trim() !== ""), rest };
}

/** The `data:` payload of one event, or null for a comment or `[DONE]`. */
export function sseData(event: string): string | null {
  const lines = event
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  if (lines.length === 0) return null;
  const payload = lines.join("\n");
  return payload === "[DONE]" ? null : payload;
}

/**
 * Rebuilds a whole answer from its fragments. Text is forwarded as it
 * arrives so the reader watches it being written; tool calls are held back
 * until the end, because a half-received argument list is not valid JSON and
 * a tool must never be called with one.
 */
export function createStreamAssembler(
  onTextDelta?: ((delta: string) => void) | undefined,
): {
  push(chunk: ChatCompletionChunk): void;
  result(): ProviderResult;
} {
  let text = "";
  let finishReason: string | null | undefined;
  const usage = { inputTokens: 0, outputTokens: 0 };
  const calls = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  return {
    push(chunk) {
      if (chunk.usage) {
        usage.inputTokens = chunk.usage.prompt_tokens ?? usage.inputTokens;
        usage.outputTokens =
          chunk.usage.completion_tokens ?? usage.outputTokens;
      }
      const choice = chunk.choices?.[0];
      if (!choice) return;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta;
      if (!delta) return;
      if (typeof delta.content === "string" && delta.content !== "") {
        text += delta.content;
        onTextDelta?.(delta.content);
      }
      for (const [position, fragment] of (delta.tool_calls ?? []).entries()) {
        const index = fragment.index ?? position;
        const held = calls.get(index) ?? { id: "", name: "", arguments: "" };
        calls.set(index, {
          id: fragment.id || held.id,
          name: fragment.function?.name || held.name,
          arguments: held.arguments + (fragment.function?.arguments ?? ""),
        });
      }
    },
    result() {
      return fromChatCompletion({
        choices: [
          {
            message: {
              content: text,
              tool_calls: [...calls.entries()]
                .sort(([left], [right]) => left - right)
                .map(([, call]) => ({
                  id: call.id,
                  function: { name: call.name, arguments: call.arguments },
                })),
            },
            finish_reason: finishReason ?? null,
          },
        ],
        usage: {
          prompt_tokens: usage.inputTokens,
          completion_tokens: usage.outputTokens,
        },
      });
    },
  };
}
