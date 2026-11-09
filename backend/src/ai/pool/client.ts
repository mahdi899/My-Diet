import { assertPublicEndpoint } from './endpoint.js';
import {
  ProviderCallError,
  StreamBrokenError,
  type ChatMessage,
  type Completion,
  type CompletionParams,
  type ProviderConfig,
  type ToolCall,
} from './types.js';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_TOOL_CALLS = 8;

export interface ClientDeps {
  fetch?: typeof fetch;
  allowPrivate?: boolean;
}

function headersFor(provider: ProviderConfig, stream: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (stream) headers.Accept = 'text/event-stream';
  if (provider.kind === 'openrouter') {
    if (provider.httpReferer) headers['HTTP-Referer'] = provider.httpReferer;
    if (provider.appTitle) headers['X-Title'] = encodeURIComponent(provider.appTitle);
  }
  return headers;
}

export function buildBody(
  provider: ProviderConfig,
  model: string,
  params: CompletionParams,
  options: { stream?: boolean } = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: params.messages satisfies ChatMessage[],
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  };
  if (params.json) body.response_format = { type: 'json_object' };
  const tools = params.tools?.length ? params.tools : null;
  if (tools) {
    body.tools = tools;
    body.tool_choice = params.toolChoice ?? 'auto';
  }
  if (options.stream) {
    body.stream = true;
    body.stream_options = { include_usage: true };
  }
  if (provider.kind === 'openrouter') {
    // Health data: do not let routed providers keep or train on prompts; report real cost.
    // With tools, only route to providers that honour every parameter (otherwise tools are silently dropped).
    body.provider = tools ? { data_collection: 'deny', require_parameters: true } : { data_collection: 'deny' };
    body.usage = { include: true };
  }
  return body;
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

const costOf = (usage: Record<string, unknown>): number | null =>
  typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? Math.ceil(usage.cost * 1_000_000) : null;

/** Sends the request and maps every HTTP-level failure. Returns an OK response whose body is still unread. */
async function open(
  provider: ProviderConfig,
  model: string,
  params: CompletionParams,
  deps: ClientDeps,
  stream: boolean,
  started: number,
): Promise<Response> {
  const elapsed = () => Date.now() - started;
  let url: URL;
  try {
    url = await assertPublicEndpoint(provider.baseUrl, deps.allowPrivate ?? false);
  } catch (error) {
    throw new ProviderCallError('rejected', error instanceof Error ? error.message : 'endpoint_invalid', elapsed());
  }
  const endpoint = `${url.toString().replace(/\/+$/, '')}/chat/completions`;
  const send = deps.fetch ?? fetch;

  let response: Response;
  try {
    response = await send(endpoint, {
      method: 'POST',
      headers: headersFor(provider, stream),
      body: JSON.stringify(buildBody(provider, model, params, { stream })),
      redirect: 'error',
      signal: AbortSignal.timeout(params.timeoutMs),
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'TimeoutError' || name === 'AbortError') throw new ProviderCallError('timeout', 'timeout', elapsed());
    throw new ProviderCallError('outcome_unknown', 'network_error', elapsed());
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const retryAfter = Number(response.headers.get('retry-after'));
    const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 600) * 1000 : null;
    if (response.status === 401 || response.status === 403) {
      throw new ProviderCallError('auth_failed', `http_${response.status}`, elapsed());
    }
    if (response.status === 402) throw new ProviderCallError('auth_failed', 'insufficient_credit', elapsed());
    if (response.status === 429) throw new ProviderCallError('rate_limited', 'http_429', elapsed(), retryAfterMs);
    if (response.status === 408 || response.status === 504) throw new ProviderCallError('timeout', `http_${response.status}`, elapsed());
    throw new ProviderCallError('rejected', `http_${response.status}`, elapsed());
  }
  return response;
}

function upstreamError(error: { message?: unknown; code?: unknown }, latency: number): ProviderCallError {
  // OpenRouter reports upstream failures inside a 200 body or mid-stream.
  const code = typeof error.code === 'number' ? error.code : 0;
  if (code === 429) return new ProviderCallError('rate_limited', 'upstream_429', latency);
  if (code === 401 || code === 403 || code === 402) return new ProviderCallError('auth_failed', `upstream_${code}`, latency);
  return new ProviderCallError('rejected', 'upstream_error', latency);
}

function parseToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return [];
  const calls: ToolCall[] = [];
  for (const entry of raw.slice(0, MAX_TOOL_CALLS)) {
    const item = entry as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
    const name = item.function?.name;
    if (typeof name !== 'string' || !name) continue;
    const args = item.function?.arguments;
    calls.push({
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 80) : `call_${calls.length + 1}`,
      type: 'function',
      function: { name: name.slice(0, 64), arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}) },
    });
  }
  return calls;
}

/** One chat completion. Network uncertainty is reported as such and never retried here. */
export async function chatCompletion(
  provider: ProviderConfig,
  model: string,
  params: CompletionParams,
  deps: ClientDeps = {},
): Promise<Completion> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  const response = await open(provider, model, params, deps, false, started);

  let text: string;
  try {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('empty');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ProviderCallError('rejected', 'response_too_large', elapsed());
      }
      chunks.push(value);
    }
    text = Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    if (error instanceof ProviderCallError) throw error;
    // The provider accepted the call; the body was lost, so it may have been billed.
    throw new ProviderCallError('outcome_unknown', 'body_lost', elapsed());
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ProviderCallError('outcome_unknown', 'bad_envelope', elapsed());
  }
  const error = json.error as { message?: unknown; code?: unknown } | undefined;
  if (error && !json.choices) throw upstreamError(error, elapsed());
  const choice = (json.choices as Array<{ message?: { content?: unknown; tool_calls?: unknown }; finish_reason?: unknown }> | undefined)?.[0];
  const content = choice?.message?.content;
  const toolCalls = parseToolCalls(choice?.message?.tool_calls);
  const hasText = typeof content === 'string' && content.trim() !== '';
  if (!hasText && toolCalls.length === 0) throw new ProviderCallError('rejected', 'empty_completion', elapsed());
  const usage = (json.usage ?? {}) as Record<string, unknown>;
  return {
    content: hasText ? content : '',
    toolCalls,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    model: typeof json.model === 'string' ? json.model.slice(0, 256) : model,
    tokensIn: Math.round(num(usage.prompt_tokens)),
    tokensOut: Math.round(num(usage.completion_tokens)),
    costMicros: costOf(usage),
    latencyMs: elapsed(),
  };
}

interface PartialToolCall {
  id: string;
  name: string;
  args: string;
}

/**
 * Reads an OpenAI-compatible `text/event-stream` body: `data: {json}` lines, `: comment` keep-alives and a final
 * `data: [DONE]`. Text deltas go to `onDelta` as they arrive; tool-call fragments are stitched by `index`.
 */
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onDelta: ((text: string) => void) | undefined,
  context: { model: string; started: number },
): Promise<Completion> {
  const elapsed = () => Date.now() - context.started;
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let size = 0;
  let content = '';
  let model = context.model;
  let finish: string | null = null;
  let usage: Record<string, unknown> = {};
  let sawChunk = false;
  const calls = new Map<number, PartialToolCall>();

  const handle = (data: string): 'done' | 'ok' => {
    if (data === '[DONE]') return 'done';
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return 'ok'; // a broken frame is skipped; the rest of the stream may still be fine
    }
    const error = json.error as { message?: unknown; code?: unknown } | undefined;
    if (error) {
      const failure = upstreamError(error, elapsed());
      if (content === '' && calls.size === 0) throw failure;
      throw new StreamBrokenError(failure.code, elapsed(), content);
    }
    sawChunk = true;
    if (typeof json.model === 'string') model = json.model.slice(0, 256);
    if (json.usage && typeof json.usage === 'object') usage = json.usage as Record<string, unknown>;
    const choice = (json.choices as Array<{ delta?: { content?: unknown; tool_calls?: unknown }; finish_reason?: unknown }> | undefined)?.[0];
    if (!choice) return 'ok';
    if (typeof choice.finish_reason === 'string') finish = choice.finish_reason;
    const delta = choice.delta;
    if (typeof delta?.content === 'string' && delta.content !== '') {
      content += delta.content;
      onDelta?.(delta.content);
    }
    if (Array.isArray(delta?.tool_calls)) {
      for (const fragment of delta.tool_calls as Array<{ index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }>) {
        const index = typeof fragment.index === 'number' ? fragment.index : calls.size;
        const current = calls.get(index) ?? { id: '', name: '', args: '' };
        if (typeof fragment.id === 'string' && fragment.id) current.id = fragment.id;
        if (typeof fragment.function?.name === 'string') current.name += fragment.function.name;
        if (typeof fragment.function?.arguments === 'string') current.args += fragment.function.arguments;
        calls.set(index, current);
      }
    }
    return 'ok';
  };

  const drain = (flush: boolean): boolean => {
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline < 0 && !(flush && buffer.length > 0)) return false;
      const line = (newline < 0 ? buffer : buffer.slice(0, newline)).replace(/\r$/, '');
      buffer = newline < 0 ? '' : buffer.slice(newline + 1);
      if (line.startsWith('data:')) {
        if (handle(line.slice(5).trimStart()) === 'done') return true;
      }
      // blank lines, `event:`/`id:` fields and `:` comments carry nothing we need
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new StreamBrokenError('response_too_large', elapsed(), content);
      }
      buffer += decoder.decode(value, { stream: true });
      if (drain(false)) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    buffer += decoder.decode();
    drain(true);
  } catch (error) {
    if (error instanceof ProviderCallError) throw error;
    const name = (error as { name?: string }).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      if (content === '' && calls.size === 0) throw new ProviderCallError('timeout', 'timeout', elapsed());
      throw new StreamBrokenError('timeout', elapsed(), content);
    }
    if (content === '' && calls.size === 0) throw new ProviderCallError('outcome_unknown', 'body_lost', elapsed());
    throw new StreamBrokenError('stream_lost', elapsed(), content);
  }

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort(([left], [right]) => left - right)
    .slice(0, MAX_TOOL_CALLS)
    .filter(([, call]) => call.name !== '')
    .map(([index, call]) => ({
      id: (call.id || `call_${index + 1}`).slice(0, 80),
      type: 'function' as const,
      function: { name: call.name.slice(0, 64), arguments: call.args === '' ? '{}' : call.args },
    }));
  if (!sawChunk || (content.trim() === '' && toolCalls.length === 0)) {
    throw new ProviderCallError('rejected', 'empty_completion', elapsed());
  }
  return {
    content,
    toolCalls,
    finishReason: finish,
    model,
    tokensIn: Math.round(num(usage.prompt_tokens)),
    tokensOut: Math.round(num(usage.completion_tokens)),
    costMicros: costOf(usage),
    latencyMs: elapsed(),
  };
}

/** Streaming chat completion (`stream: true`). `onDelta` receives text as soon as the provider sends it. */
export async function chatStream(
  provider: ProviderConfig,
  model: string,
  params: CompletionParams,
  deps: ClientDeps = {},
  onDelta?: (text: string) => void,
): Promise<Completion> {
  const started = Date.now();
  const response = await open(provider, model, params, deps, true, started);
  if (!response.body) throw new ProviderCallError('outcome_unknown', 'body_lost', Date.now() - started);
  return consumeChatStream(response.body, onDelta, { model, started });
}
