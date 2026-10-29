import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
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

  @Public()
  @Get('payments/callback/:gateway')
  callback(@Param('gateway') gateway: string, @Query('paymentId') paymentId?: string) {
    if (gateway !== 'sandbox') {
      throw new ApiError(503, 'payment_unavailable', 'درگاه پرداخت در دسترس نیست');
    }
    return this.money.completeSandbox(requiredUuid(paymentId));
  }

  @Public()
  @Post('payments/sandbox/complete')
  complete(@Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['paymentId']);
    return this.money.completeSandbox(requiredUuid(record.paymentId));
  }
}
