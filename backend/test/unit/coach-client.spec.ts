import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBody, consumeChatStream } from '../../src/ai/pool/client.js';
import type { CompletionParams, ProviderConfig } from '../../src/ai/pool/types.js';

const provider: ProviderConfig = {
  id: 'p1',
  name: 'openrouter',
  kind: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: 'test-key',
  httpReferer: 'https://my-diet.ir',
  appTitle: 'رژیم من',
};

function sse(text: string): ReadableStream<Uint8Array> {
  const encoded = new TextEncoder().encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });
}

const plain: CompletionParams = {
  messages: [{ role: 'user', content: 'سلام' }],
  temperature: 0.2,
  maxTokens: 200,
  timeoutMs: 1000,
  json: true,
};

describe('coach pool client', () => {
  it('keeps a plain JSON completion backward compatible', () => {
    const body = buildBody(provider, 'openai/gpt-4o-mini', plain);
    assert.equal(body.stream, undefined);
    assert.equal(body.tools, undefined);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.provider, { data_collection: 'deny' });
    assert.deepEqual(body.messages, plain.messages);
  });

  it('adds streaming, tool choice, and image parts without rewriting the text', () => {
    const messages = [{
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'این غذا چیست؟' },
        { type: 'image_url' as const, image_url: { url: 'data:image/jpeg;base64,AAAA' } },
      ],
    }];
    const body = buildBody(provider, 'openai/gpt-4o-mini', {
      ...plain,
      json: false,
      messages,
      tools: [{ type: 'function', function: { name: 'search_food', description: 'جستجو', parameters: { type: 'object', additionalProperties: false } } }],
      toolChoice: 'auto',
    }, { stream: true });
    assert.equal(body.stream, true);
    assert.deepEqual(body.stream_options, { include_usage: true });
    assert.equal(body.tool_choice, 'auto');
    assert.deepEqual(body.provider, { data_collection: 'deny', require_parameters: true });
    assert.equal(body.response_format, undefined);
    assert.deepEqual(body.messages, messages);
  });

  it('stitches streamed text and split tool-call fragments', async () => {
    const deltas: string[] = [];
    const completion = await consumeChatStream(sse([
      ': ping\n\n',
      'data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"show_","arguments":""}}]}}]}\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"calorie_ring","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n',
      'data: {"model":"openai/gpt-4o-mini","usage":{"prompt_tokens":11,"completion_tokens":3,"cost":0.000002}}\n\n',
      'data: [DONE]\n',
    ].join('')), (text) => deltas.push(text), { model: 'fallback', started: Date.now() });
    assert.deepEqual(deltas, ['سلام', '!']);
    assert.equal(completion.content, 'سلام!');
    assert.equal(completion.toolCalls?.[0]?.function.name, 'show_calorie_ring');
    assert.equal(completion.toolCalls?.[0]?.function.arguments, '{}');
    assert.equal(completion.toolCalls?.[0]?.id, 'call_1');
    assert.equal(completion.tokensIn, 11);
    assert.equal(completion.tokensOut, 3);
    assert.equal(completion.costMicros, 2);
    assert.equal(completion.model, 'openai/gpt-4o-mini');
  });
});
