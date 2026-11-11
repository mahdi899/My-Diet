import http from 'node:http';
import { Readable } from 'node:stream';

/** When AI_HTTPS_PROXY is set, model calls leave through that forwarder instead of this machine's TLS. */
export function aiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const proxy = process.env.AI_HTTPS_PROXY?.trim();
  if (!proxy) return fetch(url, init);
  return fetchViaForwarder(url, init, proxy);
}

function fetchViaForwarder(url: string, init: RequestInit, proxy: string): Promise<Response> {
  const target = new URL(url);
  const proxyUrl = new URL(proxy);
  if (target.protocol !== 'https:' || target.hostname !== 'openrouter.ai') {
    return Promise.reject(new Error('proxy_target_rejected'));
  }
  const headers: http.OutgoingHttpHeaders = { Host: target.hostname };
  const source = init.headers;
  if (source && typeof source === 'object' && !Array.isArray(source) && !(source instanceof Headers)) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string') headers[key] = value;
    }
  }
  const body = typeof init.body === 'string' || Buffer.isBuffer(init.body) ? init.body : undefined;
  if (body) headers['Content-Length'] = Buffer.byteLength(body);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: proxyUrl.hostname,
        port: proxyUrl.port || 80,
        method: init.method ?? 'GET',
        path: `${target.pathname}${target.search}`,
        headers,
        signal: init.signal ?? undefined,
      },
      (incoming) => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (typeof value === 'string') responseHeaders.set(key, value);
          else if (Array.isArray(value)) for (const item of value) responseHeaders.append(key, item);
        }
        const stream = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
        resolve(new Response(stream, { status: incoming.statusCode ?? 502, headers: responseHeaders }));
      },
    );
    request.once('error', reject);
    request.end(body);
  });
}
