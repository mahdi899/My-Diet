import type { HostedPaymentGateway, HostedStart, HostedVerify } from './payment.js';

export interface ZarinpalOptions {
  merchantId: string;
  /** Zarinpal's own sandbox host; no money moves. */
  sandbox: boolean;
  /** Overrides the host (integration tests point this at a local fake). */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface ZarinpalEnvelope {
  data?: { code?: number; authority?: string; ref_id?: number | string } | unknown[];
  errors?: { code?: number; message?: string } | unknown[];
}

/** Zarinpal v4: request -> StartPay redirect -> callback -> verify. Amounts are in rials. */
export class ZarinpalPaymentGateway implements HostedPaymentGateway {
  readonly name = 'zarinpal' as const;
  readonly collectsCardData = false as const;
  readonly callsExternalNetwork = true;
  private readonly base: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly options: ZarinpalOptions) {
    this.base = (
      options.baseUrl ?? (options.sandbox ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com')
    ).replace(/\/+$/, '');
    this.doFetch = options.fetchImpl ?? fetch;
  }

  async start(input: {
    amountRial: number;
    callbackUrl: string;
    description: string;
    mobile?: string;
  }): Promise<HostedStart> {
    const body = await this.post('/pg/v4/payment/request.json', {
      merchant_id: this.options.merchantId,
      amount: input.amountRial,
      callback_url: input.callbackUrl,
      description: input.description,
      ...(input.mobile ? { metadata: { mobile: input.mobile } } : {}),
    });
    const data = body.data;
    const authority = !Array.isArray(data) && data?.code === 100 ? data.authority : undefined;
    if (!authority || !/^[A-Za-z0-9]{10,64}$/.test(authority)) {
      throw new Error(`zarinpal_request_failed:${this.errorCode(body)}`);
    }
    return { authority, redirectUrl: `${this.base}/pg/StartPay/${authority}` };
  }

  async verify(input: { amountRial: number; authority: string }): Promise<HostedVerify> {
    const body = await this.post('/pg/v4/payment/verify.json', {
      merchant_id: this.options.merchantId,
      amount: input.amountRial,
      authority: input.authority,
    });
    const data = body.data;
    const code = !Array.isArray(data) && typeof data?.code === 'number' ? data.code : this.errorCode(body);
    // 100 = verified now, 101 = verified earlier (a repeated callback).
    const ok = code === 100 || code === 101;
    const refId = !Array.isArray(data) && data?.ref_id != null ? String(data.ref_id) : null;
    return { ok, alreadyVerified: code === 101, refId, code };
  }

  private errorCode(body: ZarinpalEnvelope): number {
    const errors = body.errors;
    return !Array.isArray(errors) && typeof errors?.code === 'number' ? errors.code : -1;
  }

  private async post(path: string, payload: unknown): Promise<ZarinpalEnvelope> {
    const response = await this.doFetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
    });
    // Zarinpal reports business errors with HTTP 200 + errors{}; only a non-JSON reply is a transport fault.
    const text = await response.text();
    try {
      return JSON.parse(text) as ZarinpalEnvelope;
    } catch {
      throw new Error(`zarinpal_bad_response:${response.status}`);
    }
  }
}
