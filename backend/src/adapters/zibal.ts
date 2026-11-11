import { readFile } from 'node:fs/promises';
import { ApiError } from '../common/errors.js';

export const zibalGateway = 'https://gateway.zibal.ir';

type ZibalResponse = {
  result: number;
  trackId?: number | string;
  amount?: number;
  status?: number;
  refNumber?: number | string;
};

export async function zibalRequest(operation: 'request' | 'verify', payload: object): Promise<ZibalResponse> {
  try {
    const merchant = process.env.ZIBAL_MERCHANT?.trim() ||
      (await readFile('/run/secrets/zibal_merchant', 'utf8')).trim();
    if (!merchant) throw new Error('Missing merchant');
    const response = await fetch(zibalGateway + '/v1/' + operation, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, merchant }),
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Gateway request failed');
    return await response.json() as ZibalResponse;
  } catch {
    throw new ApiError(503, 'unavailable', 'ارتباط با درگاه زیبال برقرار نشد');
  }
}
