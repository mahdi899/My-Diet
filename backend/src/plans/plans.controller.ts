import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { PlanDraftService } from './plans.service.js';
import { parseQuestionListStatus } from './questions.js';
import { isQueueBucket } from './queue.js';

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
  @Get('me/requests')
  requests(@Req() req: Request) {
    return this.plans.listRequests(actor(req).id);
  }

  @Roles('user')
  @Get('me/requests/:id')
  requestOne(@Req() req: Request, @Param('id') id: string) {
    return this.plans.requestTimeline(actor(req).id, requiredUuid(id));
  }

  @Roles('user')
  @Get('me/plan')
  plan(@Req() req: Request) {
    return this.plans.publishedPlan(actor(req).id);
  }

  @Roles('user')
  @Get('me/plan/week')
  week(@Req() req: Request, @Query('weekStart') weekStart?: string) {
    return this.plans.planWeek(actor(req).id, weekStart ?? '');
  }

  @Roles('user')
  @Get('me/plan/day/:date')
  day(@Req() req: Request, @Param('date') date: string) {
    return this.plans.planDay(actor(req).id, date);
  }

  @Roles('user')
  @Get('me/info-questions')
  questions(@Req() req: Request, @Query('status') status?: string) {
    const selected = parseQuestionListStatus(status);
    if (!selected) throw new ApiError(400, 'validation', 'وضعیت سؤال شناخته نشد');
    return this.plans.questionsForUser(actor(req).id, selected);
  }

  @Roles('user')
  @Post('me/info-questions/:id/answers')
  answer(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['body']);
    return this.plans.answer(actor(req).id, requiredUuid(id), requiredString(record, 'body', 2000));
  }

  @Roles('specialist', 'admin')
  @Get(['specialist/requests', 'specialist/queue'])
  queue(@Req() req: Request, @Query('bucket') bucket?: string) {
    if (bucket == null || bucket === '') return this.plans.queue(actor(req).id, null);
    if (!isQueueBucket(bucket)) throw new ApiError(400, 'validation', 'دستهٔ صف شناخته نشد');
    return this.plans.queue(actor(req).id, bucket);
  }

  @Roles('specialist', 'admin')
  @Get('specialist/requests/:id')
  one(@Req() req: Request, @Param('id') id: string, @Query('reason') reason?: string) {
    const user = actor(req);
    return this.plans.staffRequest(user.id, user.role, requiredUuid(id), reason ?? null);
  }

  @Roles('specialist', 'admin')
  @Put('specialist/requests/:id/draft')
  @ApiOperation({ summary: 'Save a versioned seven-day draft', description: 'Requires If-Match lockVersion. Each meal can include three options: primary, ai_alternative, specialist_alternative. Options require stable optionId, title, portion (quantity/unit/basis), calories (per portion; nullable for alternatives), preparationMinutes, instructions, ingredients and approved. Only specialists may approve. See docs/backend-roadmap-phase-2.md for the complete contract.' })
  @ApiResponse({ status: 400, description: 'Invalid units, quantities, duplicate IDs or primary option mismatch.' })
  @ApiResponse({ status: 409, description: 'Stale lock or request not editable.' })
  replace(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const user = actor(req);
    return this.plans.replaceDraft(user.id, user.role, requiredUuid(id), lockVersion(req), body);
  }

  @Roles('specialist')
  @Post('specialist/requests/:id/publish')
  @ApiOperation({ summary: 'Atomically publish a reviewed plan and replace its active pointer' })
  @ApiResponse({ status: 409, description: 'options_required, plan_incomplete, info_required, lock_conflict or week_closed. The prior active plan remains available.' })
  publish(@Req() req: Request, @Param('id') id: string) {
    const user = actor(req);
    return this.plans.publish(user.id, user.role, requiredUuid(id), lockVersion(req));
  }

  @Roles('specialist')
  @Post('specialist/requests/:id/corrections')
  correct(@Req() req: Request, @Param('id') id: string) {
    return this.plans.correct(actor(req).id, requiredUuid(id));
  }

  @Roles('specialist')
  @Get('specialist/patients/:userId/plan-versions')
  patientVersions(@Req() req: Request, @Param('userId') userId: string) {
    return this.plans.patientPlanVersions(actor(req).id, requiredUuid(userId));
  }

  @Roles('admin')
  @Get('admin/plan-versions/:id')
  adminVersion(@Req() req: Request, @Param('id') id: string, @Query('reason') reason?: string) {
    return this.plans.adminPlanVersion(actor(req).id, requiredUuid(id), reason ?? null);
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

  @Roles('specialist', 'admin')
  @Post('specialist/info-questions/:id/withdraw')
  withdraw(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['reason']);
    const user = actor(req);
    return this.plans.withdraw(user.id, user.role, requiredUuid(id), requiredString(record, 'reason', 500));
  }
}
