import { Body, Controller, Get, Header, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { bodyRecord, requiredUuid } from '../common/parse.js';
import { OnboardingAdminService } from './onboarding-admin.service.js';
import { OnboardingService } from './onboarding.service.js';

@ApiTags('onboarding')
@Controller('v1')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** The canonical question spec the app and the demo render from. */
  @Public()
  @Get('public/onboarding-spec')
  @Header('Cache-Control', 'public, max-age=300')
  spec() {
    return this.onboarding.spec();
  }

  @Roles('user')
  @Get('me/onboarding')
  @Header('Cache-Control', 'no-store')
  state(@Req() req: Request) {
    return this.onboarding.state(actor(req).id);
  }

  @Roles('user')
  @Put('me/onboarding/draft')
  saveDraft(@Req() req: Request, @Body() body: unknown) {
    return this.onboarding.saveDraft(actor(req).id, bodyRecord(body));
  }

  @Roles('user')
  @Post('me/onboarding/submit')
  submit(@Req() req: Request, @Body() body: unknown) {
    return this.onboarding.submit(actor(req).id, bodyRecord(body));
  }

  @Roles('user')
  @Post('me/onboarding/consent')
  consent(@Req() req: Request) {
    return this.onboarding.consent(actor(req).id);
  }
}

@ApiTags('admin')
@Controller('v1/admin/onboarding')
export class OnboardingAdminController {
  constructor(private readonly admin: OnboardingAdminService) {}

  @Roles('admin')
  @Get('profiles')
  profiles(
    @Query('track') track?: string,
    @Query('tier') tier?: string,
    @Query('source') source?: string,
    @Query('flag') flag?: string,
    @Query('allergen') allergen?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.profiles({ track, tier, source, flag, allergen, q, cursor, limit: limit ? Number(limit) : undefined });
  }

  @Roles('admin')
  @Get('profiles/:userId')
  profile(@Req() req: Request, @Param('userId') userId: string) {
    return this.admin.profile(actor(req).id, requiredUuid(userId));
  }

  @Roles('admin')
  @Get('funnel')
  funnel() {
    return this.admin.funnel();
  }

  @Roles('admin')
  @Post('funnel/refresh')
  refresh() {
    return this.admin.refreshFunnel();
  }

  @Roles('admin')
  @Get('demo-leads')
  demoLeads(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.admin.demoLeads(cursor, limit ? Number(limit) : undefined);
  }
}
