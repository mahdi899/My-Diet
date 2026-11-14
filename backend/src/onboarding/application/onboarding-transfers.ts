import { ApplicationError } from '../../common/application-error.js';
import { requiredUuid } from '../../common/identifiers.js';
import type { TransferRepository, TransferServices } from './transfer-ports.js';

const prices = new Map([['weekly', 1290000], ['monthly', 1990000], ['quarterly', 8990000]]);

export class OnboardingTransfers {
  constructor(private readonly repository: TransferRepository, private readonly services: TransferServices) {}

  async create(userId: string, body: { plan?: string; submissionId?: string }) {
    const plan = body?.plan ?? '';
    const price = prices.get(plan);
    if (!price) throw new ApplicationError(400, 'validation', 'پلن معتبر نیست');
    const submissionId = requiredUuid(body.submissionId ?? '');
    return this.repository.transaction(async session => {
      const user = await session.lockUser(userId);
      if (!user) throw new ApplicationError(401, 'unauthorized', 'نشست معتبر نیست');
      if (!await session.isVerifiedSubmission(submissionId, this.services.phoneHash(user.phone))) {
        throw new ApplicationError(403, 'forbidden', 'ابتدا شماره را تأیید کنید');
      }
      const existing = await session.reusable(userId, submissionId, plan);
      if (existing) return existing;
      for (let attempt = 0; attempt < 25; attempt++) {
        const row = await session.insert({
          id: this.services.newId(), userId, submissionId, plan,
          amountToman: this.services.uniqueAmount(price),
        });
        if (row) return row;
      }
      throw new ApplicationError(503, 'unavailable', 'ساخت مبلغ یکتا ممکن نشد. دوباره تلاش کنید.');
    });
  }

  async status(userId: string, id: string) {
    const row = await this.repository.status(requiredUuid(id), userId);
    if (!row) throw new ApplicationError(404, 'not_found', 'درخواست پرداخت پیدا نشد');
    return row;
  }

  async startGateway(userId: string, id: string) {
    return this.repository.transaction(async session => {
      const row = await session.lockPayment(requiredUuid(id), userId);
      if (!row || row.confirmed || (!row.active && !row.trackId)) {
        throw new ApplicationError(409, 'conflict', 'سفارش قابل پرداخت نیست');
      }
      if (row.trackId) return { url: this.services.gateway.redirectUrl(row.trackId) };
      const trackId = await this.services.gateway.start({ amountRial: row.amountToman * 10, orderId: id });
      await session.attachGateway(id, trackId);
      return { url: this.services.gateway.redirectUrl(trackId) };
    });
  }

  async gatewayReturn(trackId: string, success: string) {
    const url = '/onboarding/payment';
    if (typeof trackId !== 'string' || !/^\d{1,20}$/.test(trackId)) return { url };
    const row = await this.repository.byGatewayTrack(trackId);
    if (!row) return { url };
    const target = url + '?order=' + row.id;
    if (row.confirmed) return { url: target };
    if (success !== '1') return { url: target + '&gateway=cancelled' };
    try {
      if (!await this.services.gateway.verify(trackId, row.amountToman * 10)) {
        return { url: target + '&gateway=pending' };
      }
      const updated = await this.repository.transaction(async session => {
        const confirmed = await session.confirmGateway(row.id, 'zibal-' + trackId);
        if (confirmed) await session.audit(null, 'onboarding_zibal_confirmed', row.id, { trackId, amountToman: row.amountToman });
        return confirmed;
      });
      if (updated) await this.sendConfirmation(row.id, updated.phone);
      return { url: target };
    } catch {
      return { url: target + '&gateway=pending' };
    }
  }

  list() { return this.repository.list(); }

  async confirm(actorId: string, id: string, body: { reference?: string; amountToman?: number }) {
    const reference = body?.reference?.trim();
    if (!Number.isSafeInteger(body?.amountToman) || !reference || !/^[a-zA-Z0-9-]{4,80}$/.test(reference)) {
      throw new ApplicationError(400, 'validation', 'شناسه پیگیری بانکی معتبر نیست');
    }
    const row = await this.repository.transaction(async session => {
      await session.lockBankReference(reference);
      if (await session.hasBankReference(reference, requiredUuid(id))) {
        throw new ApplicationError(409, 'conflict', 'این تراکنش قبلاً ثبت شده است');
      }
      const updated = await session.confirmBank(id, reference, body.amountToman!);
      if (!updated) throw new ApplicationError(409, 'conflict', 'مبلغ با سفارش مطابق نیست یا درخواست قبلاً تأیید شده است');
      await session.audit(actorId, 'onboarding_transfer_confirmed', id, { reference, amountToman: updated.amountToman });
      return updated;
    });
    return { confirmed: true, smsStatus: await this.sendConfirmation(id, row.phone) };
  }

  private async sendConfirmation(id: string, phone: string) {
    let status: 'sent' | 'failed' = 'sent';
    try { await this.services.confirmation.send(phone); }
    catch { status = 'failed'; }
    await this.repository.setSmsStatus(id, status);
    return status;
  }
}
