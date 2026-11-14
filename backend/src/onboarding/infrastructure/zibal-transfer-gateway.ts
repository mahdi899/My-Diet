import { ApplicationError } from '../../common/application-error.js';
import { zibalGateway, zibalRequest } from '../../adapters/zibal.js';
import type { TransferGateway } from '../application/transfer-ports.js';

export class ZibalTransferGateway implements TransferGateway {
  async start(input: { amountRial: number; orderId: string }) {
    const payment = await zibalRequest('request', {
      amount: input.amountRial, orderId: input.orderId,
      callbackUrl: 'https://my-diet.ir/v1/me/onboarding-transfers/zibal/return',
    });
    const trackId = String(payment.trackId ?? '');
    if (payment.result !== 100 || !/^\d{1,20}$/.test(trackId)) {
      throw new ApplicationError(502, 'gateway_rejected', 'درگاه زیبال درخواست پرداخت را نپذیرفت');
    }
    return trackId;
  }
  async verify(trackId: string, amountRial: number) {
    const payment = await zibalRequest('verify', { trackId: Number(trackId) });
    return [100, 201].includes(payment.result) && payment.status === 1 && Number(payment.amount) === amountRial;
  }
  redirectUrl(trackId: string) { return zibalGateway + '/start/' + trackId; }
}
