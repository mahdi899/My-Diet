import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { PlanDraftService } from './plans.service.js';

function lockVersion(req: Request): number {
  const raw = req.header('if-match');
  if (!raw || !/^\d+$/.test(raw)) {
    throw new ApiError(400, 'validation', 'نسخهٔ ویرایش لازم است');
  }
  return Number(raw);
}

@ApiTags('plans')
@Controller('v1')
export class PlansController {
  constructor(private readonly plans: PlanDraftService) {}

  @Roles('user')
  @Get('me/request')
  mine(@Req() req: Request) {
    return this.plans.userRequest(actor(req).id);
  }

  @Roles('user')
  @Get('me/plan')
  plan(@Req() req: Request) {
    return this.plans.publishedPlan(actor(req).id);
  }

  @Roles('user')
  @Post('me/info-questions/:id/answers')
  answer(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['body']);
    return this.plans.answer(actor(req).id, requiredUuid(id), requiredString(record, 'body', 2000));
  }

  @Roles('specialist', 'admin')
  @Get('specialist/requests')
  queue(@Req() req: Request) {
    return this.plans.queue(actor(req).id);
  }

  @Roles('specialist', 'admin')
  @Get('specialist/requests/:id')
  one(@Req() req: Request, @Param('id') id: string, @Query('reason') reason?: string) {
    const user = actor(req);
    return this.plans.staffRequest(user.id, user.role, requiredUuid(id), reason ?? null);
  }

  @Roles('specialist', 'admin')
  @Put('specialist/requests/:id/draft')
  replace(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const user = actor(req);
    return this.plans.replaceDraft(user.id, user.role, requiredUuid(id), lockVersion(req), body);
  }

  @Roles('specialist', 'admin')
  @Post('specialist/requests/:id/publish')
  publish(@Req() req: Request, @Param('id') id: string) {
    const user = actor(req);
    return this.plans.publish(user.id, user.role, requiredUuid(id), lockVersion(req));
  }

  @Roles('specialist', 'admin')
  @Post('specialist/requests/:id/questions')
  ask(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['prompt', 'required']);
    const user = actor(req);
    const required = record.required == null ? true : record.required === true;
    return this.plans.ask(user.id, user.role, requiredUuid(id), requiredString(record, 'prompt', 500), required);
  }

  @Roles('specialist', 'admin')
  @Post('specialist/info-questions/:id/acknowledge')
  acknowledge(@Req() req: Request, @Param('id') id: string) {
    const user = actor(req);
    return this.plans.acknowledge(user.id, user.role, requiredUuid(id));
  }
}
