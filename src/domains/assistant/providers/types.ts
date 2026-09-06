import type Anthropic from "@anthropic-ai/sdk";

/**
 * The narrow contract the chat orchestrator needs from a model provider.
 * Message and tool parameters reuse the Anthropic SDK types so the real
 * adapter passes them through untouched; the result is reduced to the
 * fields the loop acts on, which lets the scripted mock produce it without
 * imitating the whole SDK response object.
 */

export type ProviderKind = "anthropic" | "openai-compatible" | "mock";

export type ProviderRequest = {
  system: string;
  messages: readonly Anthropic.MessageParam[];
  tools: readonly Anthropic.Tool[];
  maxTokens: number;
  signal: AbortSignal;
  /**
   * Called with each piece of answer text as it arrives, when the caller
   * wants to show the answer being written. An adapter that cannot stream —
   * and the scripted provider, which has nothing to stream — simply ignores
   * it and returns the whole result at the end, so this stays an optional
   * field rather than a second method every provider and test fake would
   * have to implement.
   */
  onTextDelta?: ((delta: string) => void) | undefined;
};

export type ProviderResult = {
  content: readonly Anthropic.ContentBlock[];
  stopReason: Anthropic.Message["stop_reason"];
  usage: { inputTokens: number; outputTokens: number };
};

export interface AssistantProvider {
  readonly kind: ProviderKind;
  readonly model: string;
  complete(request: ProviderRequest): Promise<ProviderResult>;
}
