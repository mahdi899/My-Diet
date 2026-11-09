import { Injectable } from '@nestjs/common';
import { ValidationFailure } from '../ai/pool/types.js';
import type { ChatMessage, ToolCall, ToolSpec } from '../ai/pool/types.js';
import { PoolRouter } from '../ai/pool/router.js';

export const COACH_LLM = Symbol('COACH_LLM');

export const COACH_POOL = 'nutrition_coach';
export const VISION_POOL = 'nutrition_vision';
export const MEMORY_POOL = 'coach_memory';

export interface LlmUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
}

export interface ChatTurn {
  messages: ChatMessage[];
  tools: ToolSpec[];
  /** Ledger tag so the per-request budget cap applies to one coach turn. */
  requestId: string | null;
  /** Forwards text deltas as the model produces them. */
  onDelta?: (text: string) => void;
}

export interface ChatResult extends LlmUsage {
  content: string;
  toolCalls: ToolCall[];
}

export interface VisionInput {
  requestId: string | null;
  system: string;
  mime: string;
  base64: string;
  caption: string;
}

export interface JsonInput {
  requestId: string | null;
  system: string;
  user: string;
}

/** Everything the coach needs from a language model. Implemented by the provider pool and by the fake driver. */
export interface CoachLlm {
  readonly name: string;
  chat(turn: ChatTurn): Promise<ChatResult>;
  /** Looks at one image and answers with a JSON object (parsed, not validated). */
  vision(input: VisionInput): Promise<{ value: Record<string, unknown>; usage: LlmUsage }>;
  /** One-shot JSON answer, used for memory extraction and summaries. */
  json(input: JsonInput): Promise<{ value: Record<string, unknown>; usage: LlmUsage }>;
}

export function parseJsonObject(content: string): Record<string, unknown> {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ValidationFailure('invalid_json', 'no_object');
  try {
    const value: unknown = JSON.parse(stripped.slice(start, end + 1));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not_object');
    return value as Record<string, unknown>;
  } catch {
    throw new ValidationFailure('invalid_json', 'parse_failed');
  }
}

@Injectable()
export class PoolCoachLlm implements CoachLlm {
  readonly name = 'pool';

  constructor(private readonly router: PoolRouter) {}

  async chat(turn: ChatTurn): Promise<ChatResult> {
    const { completion, usage } = await this.router.chat({
      task: 'coach_chat',
      poolCode: COACH_POOL,
      requestId: turn.requestId,
      messages: turn.messages,
      tools: turn.tools,
      toolChoice: 'auto',
      json: false,
      ...(turn.onDelta ? { onDelta: turn.onDelta } : {}),
    });
    return {
      content: completion.content,
      toolCalls: completion.toolCalls ?? [],
      model: usage.model || completion.model,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      costMicros: usage.costMicros,
    };
  }

  async vision(input: VisionInput): Promise<{ value: Record<string, unknown>; usage: LlmUsage }> {
    const messages: ChatMessage[] = [
      { role: 'system', content: input.system },
      {
        role: 'user',
        content: [
          { type: 'text', text: input.caption || 'این غذا را شناسایی کن.' },
          { type: 'image_url', image_url: { url: `data:${input.mime};base64,${input.base64}` } },
        ],
      },
    ];
    const result = await this.router.run({
      task: 'coach_vision',
      poolCode: VISION_POOL,
      requestId: input.requestId,
      messages,
      json: true,
      validate: (content) => parseJsonObject(content),
    });
    return { value: result.value, usage: { model: result.usage.model, tokensIn: 0, tokensOut: 0, costMicros: result.usage.costMicros } };
  }

  async json(input: JsonInput): Promise<{ value: Record<string, unknown>; usage: LlmUsage }> {
    const result = await this.router.run({
      task: 'coach_memory',
      poolCode: MEMORY_POOL,
      requestId: input.requestId,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
      json: true,
      validate: (content) => parseJsonObject(content),
    });
    return { value: result.value, usage: { model: result.usage.model, tokensIn: 0, tokensOut: 0, costMicros: result.usage.costMicros } };
  }
}
