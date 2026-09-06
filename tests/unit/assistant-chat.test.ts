import { describe, expect, it } from "vitest";

import type {
  AssistantProvider,
  ProviderResult,
} from "@/domains/assistant/providers/types";
import {
  availableTools,
  toAnthropicTool,
  assistantTools,
} from "@/domains/assistant/tools";

import { buildWorld, runCase, seeded } from "../eval/harness";

/**
 * Loop-level guarantees the JSON cases cannot express: timeouts, the round
 * cap, a failing data store, and the tool definitions handed to the model.
 */

function providerOf(fn: () => Promise<ProviderResult>): AssistantProvider {
  return { kind: "mock", model: "test", complete: fn };
}

describe("chat loop limits", () => {
  it("surfaces a provider timeout as PROVIDER_TIMEOUT and performs no action", async () => {
    // A provider that ignores the abort signal entirely: the loop's own
    // timer must still give up and report a timeout, with nothing written.
    const hanging = providerOf(
      () => new Promise<ProviderResult>(() => undefined),
    );
    const world = buildWorld();
    await expect(
      runCase({
        role: "DIRECTOR",
        message: "x",
        provider: hanging,
        world,
        limits: { requestTimeoutMs: 30 },
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
    expect(world.proposals.proposals.size).toBe(0);
    expect(world.tasks.insertCalls).toBe(2);
  });

  it("stops at the round cap when the model keeps calling tools and says so", async () => {
    let calls = 0;
    const looping = providerOf(async () => {
      calls += 1;
      return {
        content: [
          {
            type: "tool_use",
            id: `t${calls}`,
            name: "list_orders",
            input: {},
            caller: { type: "direct" },
          },
        ],
        stopReason: "tool_use",
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    });
    const result = await runCase({
      role: "DIRECTOR",
      message: "x",
      provider: looping,
      limits: { maxRounds: 3 },
    });
    expect(calls).toBe(3);
    expect(result.calledTools).toEqual([
      "list_orders",
      "list_orders",
      "list_orders",
    ]);
    expect(result.response.truncated).toBe(true);
    expect(result.response.text).toContain("vượt số lần tra cứu");
  });

  it("refuses a tool the user was not offered even if the model asks for it", async () => {
    const sneaky = providerOf(async () => ({
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "get_receivables_overview",
          input: {},
          caller: { type: "direct" },
        },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    const result = await runCase({
      role: "WAREHOUSE_MANAGER",
      message: "x",
      provider: sneaky,
      limits: { maxRounds: 1 },
    });
    expect(result.response.trace[0]).toMatchObject({
      tool: "get_receivables_overview",
      ok: false,
      code: "UNKNOWN_TOOL",
    });
    expect(result.toolPayloads).toEqual([]);
  });

  it("reports a failing data store as UNAVAILABLE, distinct from not-found", async () => {
    const world = buildWorld();
    world.orders.findByCode = async () => {
      throw new Error("MongoNetworkError: connection closed");
    };
    const result = await runCase({
      role: "DIRECTOR",
      message: `Đơn ${seeded.orderCode} đang ở bước nào?`,
      world,
    });
    expect(result.response.trace[0]).toMatchObject({
      tool: "get_order",
      ok: false,
      code: "UNAVAILABLE",
    });
    expect(result.response.text).toContain("không đọc được");
  });

  it("marks a refusal and a truncated answer honestly", async () => {
    const refusing = providerOf(async () => ({
      content: [],
      stopReason: "refusal",
      usage: { inputTokens: 1, outputTokens: 0 },
    }));
    const refused = await runCase({
      role: "DIRECTOR",
      message: "x",
      provider: refusing,
    });
    expect(refused.response.text).toContain("từ chối");
    const cut = providerOf(async () => ({
      content: [{ type: "text", text: "Một phần", citations: null }],
      stopReason: "max_tokens",
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    const truncated = await runCase({
      role: "DIRECTOR",
      message: "x",
      provider: cut,
    });
    expect(truncated.response.truncated).toBe(true);
    expect(truncated.response.text).toContain("bị cắt");
  });

  it("passes prior turns as plain text and never as tool blocks", async () => {
    let seen: unknown = null;
    const echo = providerOf(async () => ({
      content: [{ type: "text", text: "ok", citations: null }],
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    }));
    const spy: AssistantProvider = {
      ...echo,
      complete: async (request) => {
        seen = [...request.messages];
        return echo.complete(request);
      },
    };
    await runCase({
      role: "DIRECTOR",
      message: "tiếp",
      provider: spy,
      history: [
        { role: "assistant", text: "orphan assistant turn" },
        { role: "user", text: "trước đó" },
        { role: "assistant", text: "trả lời cũ" },
      ],
    });
    const messages = seen as { role: string; content: unknown }[];
    expect(messages[0]!.role).toBe("user");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages.every((m) => typeof m.content === "string")).toBe(true);
  });
});

describe("tool catalog", () => {
  it("offers every role exactly the tools its grants allow", async () => {
    const offered = async (role: Parameters<typeof runCase>[0]["role"]) =>
      (await runCase({ role, message: "hello" })).offeredTools;
    expect(await offered("DIRECTOR")).toEqual(
      assistantTools.map((tool) => tool.name),
    );
    expect(await offered("CONTENT_CREATOR")).toEqual(["list_editorial_work"]);
    expect(await offered("FACTORY_ACCOUNTANT")).toEqual([
      "list_my_tasks",
      "list_orders",
      "get_order",
      "list_pending_approvals",
      "propose_order_plan",
      "propose_tasks",
    ]);
    expect(await offered("WAREHOUSE_MANAGER")).toEqual([
      "list_my_tasks",
      "list_orders",
      "get_order",
      "list_pending_approvals",
      "propose_order_plan",
      "propose_tasks",
    ]);
    expect(await offered("COMPANY_ACCOUNTANT")).toContain(
      "get_customer_receivables",
    );
  });

  it("produces JSON-schema tool definitions the API accepts (object type, no $schema)", () => {
    for (const tool of assistantTools) {
      const definition = toAnthropicTool(tool);
      expect(definition.input_schema.type).toBe("object");
      expect("$schema" in definition.input_schema).toBe(false);
      expect((definition.description ?? "").length).toBeGreaterThan(40);
    }
    expect(availableTools({})).toEqual([]);
  });
});
