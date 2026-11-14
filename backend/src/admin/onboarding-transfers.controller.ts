import { Body, Controller, Get, Header, Inject, Param, Post, Query, Redirect, Req } from '@nestjs/common';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { OnboardingTransfers } from '../onboarding/application/onboarding-transfers.js';

@Controller('v1')
export class OnboardingTransfersController {
  constructor(@Inject(OnboardingTransfers) private readonly transfers: OnboardingTransfers) {}

  @Header('Cache-Control', 'private, no-store')
  @Roles('user')
  @Post('me/onboarding-transfers')
  create(@Req() req: Request, @Body() body: { plan?: string; submissionId?: string }) {
    return this.transfers.create(actor(req).id, body);
  }

  @Header('Cache-Control', 'private, no-store')
  @Roles('user')
  @Get('me/onboarding-transfers/:id')
  status(@Req() req: Request, @Param('id') id: string) {
    return this.transfers.status(actor(req).id, id);
  }

  @Roles('user')
  @Header('Cache-Control', 'private, no-store')
  @Post('me/onboarding-transfers/:id/zibal')
  startGateway(@Req() req: Request, @Param('id') id: string) {
    return this.transfers.startGateway(actor(req).id, id);
  }

  @Public()
  @Header('Cache-Control', 'no-store')
  @Get('me/onboarding-transfers/zibal/return')
  @Redirect('/onboarding/payment', 303)
  gatewayReturn(@Query('trackId') trackId: string, @Query('success') success: string) {
    return this.transfers.gatewayReturn(trackId, success);
  }

  @Roles('admin')
  @Get('admin/onboarding-transfers')
  list() { return this.transfers.list(); }

  @Roles('admin')
  @Post('admin/onboarding-transfers/:id/confirm')
  confirm(@Req() req: Request, @Param('id') id: string, @Body() body: { reference?: string; amountToman?: number }) {
    return this.transfers.confirm(actor(req).id, id, body);
  }
}
