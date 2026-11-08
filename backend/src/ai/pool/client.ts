import { assertPublicEndpoint } from './endpoint.js';
import {
  ProviderCallError,
  type ChatMessage,
  type Completion,
  type CompletionParams,
  type ProviderConfig,
} from './types.js';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_RESPONSE_BYTES = 2_000_000;

export interface ClientDeps {
  fetch?: typeof fetch;
  allowPrivate?: boolean;
}

function headersFor(provider: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${provider.apiKey}`,
    'Content-Type': 'application/json',
  };
  if (provider.kind === 'openrouter') {
    if (provider.httpReferer) headers['HTTP-Referer'] = provider.httpReferer;
    if (provider.appTitle) headers['X-Title'] = encodeURIComponent(provider.appTitle);
  }
  return headers;
}

export function buildBody(provider: ProviderConfig, model: string, params: CompletionParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: params.messages satisfies ChatMessage[],
    temperature: params.temperature,
    max_tokens: params.maxTokens,
  };
  if (params.json) body.response_format = { type: 'json_object' };
  if (provider.kind === 'openrouter') {
    // Health data: do not let routed providers keep or train on prompts; report real cost.
    body.provider = { data_collection: 'deny' };
    body.usage = { include: true };
  }
  return body;
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

/** One chat completion. Network uncertainty is reported as such and never retried here. */
export async function chatCompletion(
  provider: ProviderConfig,
  model: string,
  params: CompletionParams,
  deps: ClientDeps = {},
): Promise<Completion> {
  const started = Date.now();
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
      headers: headersFor(provider),
      body: JSON.stringify(buildBody(provider, model, params)),
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
  if (error && !json.choices) {
    // OpenRouter reports upstream failures inside a 200 body.
    const code = typeof error.code === 'number' ? error.code : 0;
    if (code === 429) throw new ProviderCallError('rate_limited', 'upstream_429', elapsed());
    if (code === 401 || code === 403 || code === 402) throw new ProviderCallError('auth_failed', `upstream_${code}`, elapsed());
    throw new ProviderCallError('rejected', 'upstream_error', elapsed());
  }
  const choice = (json.choices as Array<{ message?: { content?: unknown } }> | undefined)?.[0];
  const content = choice?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    throw new ProviderCallError('rejected', 'empty_completion', elapsed());
  }
  const usage = (json.usage ?? {}) as Record<string, unknown>;
  const cost = typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? Math.ceil(usage.cost * 1_000_000) : null;
  return {
    content,
    model: typeof json.model === 'string' ? json.model.slice(0, 256) : model,
    tokensIn: Math.round(num(usage.prompt_tokens)),
    tokensOut: Math.round(num(usage.completion_tokens)),
    costMicros: cost,
    latencyMs: elapsed(),
  };
}
