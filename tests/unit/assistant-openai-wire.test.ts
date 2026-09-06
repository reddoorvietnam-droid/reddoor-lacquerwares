import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import {
  fromChatCompletion,
  sanitizeToolSchema,
  toChatCompletionRequest,
  toChatMessages,
} from "@/domains/assistant/providers/openai-wire";
import { assistantTools, toAnthropicTool } from "@/domains/assistant/tools";

/**
 * The Anthropic ⇄ OpenAI Chat Completions mapping used for Gemini and other
 * compatible endpoints. Pure translation, no network: the shape of what is
 * sent and how a reply is read back into the loop's content blocks.
 */

describe("openai wire: requests", () => {
  it("lays out system, text turns, tool calls and tool results in protocol order", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "Đơn RD-20260906-E2E1 đang ở bước nào?" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Để tôi tra cứu." },
          {
            type: "tool_use",
            id: "call_1",
            name: "get_order",
            input: { orderCode: "RD-20260906-E2E1" },
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "call_1",
            content: '{"ok":true}',
            is_error: false,
          },
        ],
      },
    ];
    const request = toChatCompletionRequest({
      model: "gemini-2.5-flash",
      system: "SYSTEM",
      messages,
      tools: [toAnthropicTool(assistantTools[2]!)],
      maxTokens: 4096,
      reasoningEffort: "low",
    });
    expect(request.messages).toEqual([
      { role: "system", content: "SYSTEM" },
      { role: "user", content: "Đơn RD-20260906-E2E1 đang ở bước nào?" },
      {
        role: "assistant",
        content: "Để tôi tra cứu.",
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "get_order",
              arguments: '{"orderCode":"RD-20260906-E2E1"}',
            },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", content: '{"ok":true}' },
    ]);
    expect(request.max_tokens).toBe(4096);
    expect(request.tool_choice).toBe("auto");
    expect(request.reasoning_effort).toBe("low");
    expect(request.tools?.[0]?.function.name).toBe("get_order");
  });

  it("omits the tool list and reasoning effort when there is nothing to send", () => {
    const request = toChatCompletionRequest({
      model: "m",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      tools: [],
      maxTokens: 10,
    });
    expect(request).not.toHaveProperty("tools");
    expect(request).not.toHaveProperty("tool_choice");
    expect(request).not.toHaveProperty("reasoning_effort");
  });

  it("puts tool results before text in the same user turn and nulls empty assistant text", () => {
    const messages = toChatMessages([
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "c", name: "list_orders", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          { type: "text", text: "and then?" },
          {
            type: "tool_result",
            tool_use_id: "c",
            content: [
              { type: "text", text: "A" },
              { type: "text", text: "B" },
            ],
          },
        ],
      },
    ]);
    expect(messages).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "c",
            type: "function",
            function: { name: "list_orders", arguments: "{}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "c", content: "A\nB" },
      { role: "user", content: "and then?" },
    ]);
  });
});

describe("openai wire: tool schemas", () => {
  it("keeps only the keywords the endpoints understand", () => {
    const schema = sanitizeToolSchema({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      additionalProperties: false,
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 20,
          exclusiveMinimum: 0,
        },
      },
      required: ["limit", "ghost"],
    });
    expect(schema).toEqual({
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      required: ["limit"],
    });
  });

  it("turns a nullable union into a nullable member", () => {
    expect(
      sanitizeToolSchema({
        description: "d",
        default: null,
        anyOf: [{ type: "string", pattern: "^x$" }, { type: "null" }],
      }),
    ).toEqual({
      description: "d",
      default: null,
      type: "string",
      pattern: "^x$",
      nullable: true,
    });
  });

  it("spells out enum-keyed records as explicit properties", () => {
    const schema = sanitizeToolSchema({
      type: "object",
      propertyNames: { type: "string", enum: ["a", "b"] },
      additionalProperties: { type: "integer", minimum: 0 },
      required: ["a", "b"],
    });
    expect(schema).toEqual({
      type: "object",
      properties: {
        a: { type: "integer", minimum: 0 },
        b: { type: "integer", minimum: 0 },
      },
      required: ["a", "b"],
    });
  });

  it("produces a clean schema for every catalog tool", () => {
    const forbidden = ["additionalProperties", "propertyNames", "$schema"];
    for (const tool of assistantTools) {
      const text = JSON.stringify(
        sanitizeToolSchema(toAnthropicTool(tool).input_schema),
      );
      for (const keyword of forbidden) {
        expect(text, tool.name).not.toContain(`"${keyword}"`);
      }
    }
  });
});

describe("openai wire: responses", () => {
  it("maps tool calls to tool_use blocks with parsed input, whatever the finish reason says", () => {
    const result = fromChatCompletion({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "abc",
                function: {
                  name: "get_order",
                  arguments: '{"orderCode":"RD-1"}',
                },
              },
              { function: { name: "list_my_tasks", arguments: "not json" } },
            ],
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });
    expect(result.stopReason).toBe("tool_use");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 });
    expect(result.content).toMatchObject([
      {
        type: "tool_use",
        id: "abc",
        name: "get_order",
        input: { orderCode: "RD-1" },
      },
      { type: "tool_use", name: "list_my_tasks", input: {} },
    ]);
    const generated = result.content[1] as Anthropic.ToolUseBlock;
    expect(generated.id).toMatch(/^call_\d+$/);
  });

  it("maps text answers and finish reasons", () => {
    expect(
      fromChatCompletion({
        choices: [{ message: { content: "Xong." }, finish_reason: "stop" }],
      }),
    ).toMatchObject({
      content: [{ type: "text", text: "Xong." }],
      stopReason: "end_turn",
      usage: { inputTokens: 0, outputTokens: 0 },
    });
    expect(
      fromChatCompletion({
        choices: [{ message: { content: "cut" }, finish_reason: "length" }],
      }).stopReason,
    ).toBe("max_tokens");
    expect(
      fromChatCompletion({
        choices: [
          { message: { content: "" }, finish_reason: "content_filter" },
        ],
      }),
    ).toMatchObject({ content: [], stopReason: "refusal" });
    expect(fromChatCompletion({})).toMatchObject({
      content: [],
      stopReason: "end_turn",
    });
  });
});
