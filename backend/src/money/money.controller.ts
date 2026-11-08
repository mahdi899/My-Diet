import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import {
  bodyRecord,
  optionalString,
  rejectUnknown,
  requiredInt,
  requiredString,
  requiredUuid,
} from '../common/parse.js';
import { MoneyService } from './money.service.js';

@ApiTags('catalog')
@Controller('v1')
export class MoneyController {
  constructor(private readonly money: MoneyService) {}

  @Public()
  @Get('catalog')
  catalog() {
    return this.money.catalog();
  }

  @Roles('user')
  @Get('me/wallet')
  wallet(@Req() req: Request) {
    return this.money.wallet(actor(req).id);
  }

  @Roles('user')
  @Get('me/wallet/ledger')
  ledger(@Req() req: Request) {
    return this.money.ledgerForUser(actor(req).id);
  }

  @Roles('user')
  @Get('me/orders/:id')
  orderOne(@Req() req: Request, @Param('id') id: string) {
    return this.money.orderForUser(actor(req).id, requiredUuid(id));
  }

  @Roles('user')
  @Get('me/topups/:id')
  topupOne(@Req() req: Request, @Param('id') id: string) {
    return this.money.topupForUser(actor(req).id, requiredUuid(id));
  }

  @Public()
  @Get('payments/gateways')
  gateways() {
    return this.money.gatewayList();
  }

  @Roles('user')
  @Post('me/topups')
  topup(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['packageCode', 'gateway']);
    return this.money.startTopup(
      actor(req).id,
      requiredString(record, 'packageCode', 40),
      optionalString(record, 'gateway', 40) ?? null,
    );
  }

  @Roles('user')
  @Post('me/orders')
  order(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['serviceCode', 'expectedPriceToman', 'parentRequestId']);
    const headerKey = req.header('idempotency-key') ?? '';
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(headerKey)) {
      throw new ApiError(400, 'validation', 'کلید تکرار درخواست معتبر نیست');
    }
    const parent = record.parentRequestId == null ? null : requiredUuid(record.parentRequestId);
    return this.money.placeOrder(
      actor(req).id,
      headerKey,
      requiredString(record, 'serviceCode', 40),
      requiredInt(record.expectedPriceToman),
      parent,
    );
  }

  @Roles('user')
  @Post('me/orders/:id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.money.cancel(actor(req).id, requiredUuid(id));
  }

  @Roles('user')
  @Post('me/requests/:id/cancel')
  cancelRequest(@Req() req: Request, @Param('id') id: string) {
    return this.money.cancelRequest(actor(req).id, requiredUuid(id));
  }

  @Roles('admin')
  @Post('admin/orders/:id/compensate')
  compensate(@Req() req: Request, @Param('id') id: string) {
    return this.money.compensatePermanentFailure(actor(req).id, requiredUuid(id));
  }

  @Public()
  @Get('payments/callback/:gateway')
  async callback(
    @Param('gateway') gateway: string,
    @Res() res: Response,
    @Query('paymentId') paymentId?: string,
    @Query('Authority') authority?: string,
    @Query('Status') status?: string,
  ) {
    if (gateway === 'sandbox') {
      res.json(await this.money.completeSandbox(requiredUuid(paymentId)));
      return;
    }
    const outcome = await this.money.completeHosted(
      gateway,
      requiredUuid(paymentId),
      typeof authority === 'string' ? authority : null,
      typeof status === 'string' ? status : null,
    );
    res.status(200).type('html').send(paymentResultPage(outcome));
  }
  @Public()
  @Post('payments/sandbox/complete')
  complete(@Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['paymentId']);
    return this.money.completeSandbox(requiredUuid(record.paymentId));
  }
}

/** What the person sees in the browser after paying. The app learns the outcome by polling the wallet. */
function paymentResultPage(outcome: 'credited' | 'failed' | 'pending'): string {
  const message = {
    credited: ['پرداخت موفق بود', 'کیف پولت شارژ شد. به برنامهٔ سبزینه برگرد.'],
    failed: ['پرداخت انجام نشد', 'اگه مبلغی کم شده، تا چند ساعت دیگه برمی‌گرده. به برنامه برگرد و دوباره تلاش کن.'],
    pending: ['در حال بررسی پرداخت', 'تأیید پرداخت کمی طول کشید. به برنامه برگرد؛ نتیجه همونجا نشون داده می‌شه.'],
  }[outcome];
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${message[0]}</title><style>body{font-family:system-ui,Tahoma,sans-serif;background:#f7f8f0;color:#233c2d;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}main{max-width:380px}h1{font-size:22px}p{color:#76836e;line-height:2}a{display:inline-block;margin-top:16px;background:#205638;color:#fff;border-radius:14px;padding:12px 22px;text-decoration:none}</style></head><body><main><h1>${message[0]}</h1><p>${message[1]}</p><a href="sabzine://payment?status=${outcome}">بازگشت به سبزینه</a></main></body></html>`;
}