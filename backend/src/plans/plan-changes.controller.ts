import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { requiredUuid } from '../common/parse.js';
import { PlanChangeService } from './plan-changes.service.js';

const targetSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  mealUid: z.uuid().optional(),
}).strict();
const submitSchema = z.object({
  commandId: z.uuid(),
  versionId: z.uuid(),
  reasonIds: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  explanation: z.string().max(2000).optional(),
  targets: z.array(targetSchema).max(28).optional(),
}).strict();
const textSchema = z.object({ explanation: z.string().trim().min(1).max(2000) }).strict();
const promptSchema = z.object({ prompt: z.string().trim().min(1).max(1000) }).strict();
const replySchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
const reasonSchema = z.object({
  label: z.string().trim().min(1).max(200),
  active: z.boolean(),
}).strict();

function parsed<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, 'validation', 'اطلاعات درخواست کامل نیست');
  return result.data;
}

function lockVersion(req: Request): number {
  const raw = req.header('if-match');
  if (!raw || !/^\d+$/.test(raw)) throw new ApiError(400, 'validation', 'نسخهٔ ویرایش لازم است');
  return Number(raw);
}

@ApiTags('plan-changes')
@Controller('v1')
export class PlanChangesController {
  constructor(private readonly changes: PlanChangeService) {}

  @Roles('user')
  @Get('me/plan-change-reasons')
  reasons() {
    return this.changes.reasons(true);
  }

  @Roles('user')
  @Post('me/plan-changes')
  @ApiOperation({ summary: 'Ask to replace the active plan. One open request per customer. Retries reuse commandId.' })
  submit(@Req() req: Request, @Body() body: unknown) {
    return this.changes.submit(actor(req).id, parsed(submitSchema, body));
  }

  @Roles('user')
  @Get('me/plan-changes')
  mine(@Req() req: Request) {
    return this.changes.mine(actor(req).id);
  }

  @Roles('user')
  @Get('me/plan-changes/:id')
  one(@Req() req: Request, @Param('id') id: string) {
    return this.changes.forCustomer(actor(req).id, requiredUuid(id));
  }

  @Roles('user')
  @Post('me/plan-changes/:id/replies')
  reply(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.changes.reply(actor(req).id, requiredUuid(id), parsed(replySchema, body).body);
  }

  @Roles('specialist')
  @Get('specialist/plan-changes')
  @ApiOperation({ summary: 'Assigned specialist queue. This is not delivered as a request card in the chat stream.' })
  queue(@Req() req: Request) {
    return this.changes.queue(actor(req).id);
  }

  @Roles('specialist')
  @Get('specialist/plan-changes/:id')
  staffOne(@Req() req: Request, @Param('id') id: string) {
    return this.changes.forSpecialist(actor(req).id, requiredUuid(id));
  }

  @Roles('specialist')
  @Post('specialist/plan-changes/:id/review')
  review(@Req() req: Request, @Param('id') id: string) {
    return this.changes.review(actor(req).id, requiredUuid(id));
  }

  @Roles('specialist')
  @Post('specialist/plan-changes/:id/reject')
  reject(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.changes.reject(actor(req).id, requiredUuid(id), parsed(textSchema, body).explanation);
  }

  @Roles('specialist')
  @Post('specialist/plan-changes/:id/clarifications')
  clarify(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    return this.changes.clarify(actor(req).id, requiredUuid(id), parsed(promptSchema, body).prompt);
  }

  @Roles('specialist')
  @Post('specialist/plan-changes/:id/approve')
  @ApiOperation({ summary: 'Publish the replacement draft and complete the request in one transaction. If-Match is the draft lock.' })
  approve(@Req() req: Request, @Param('id') id: string) {
    return this.changes.approve(actor(req).id, requiredUuid(id), lockVersion(req));
  }

  @Roles('admin')
  @Get('admin/plan-change-reasons')
  allReasons() {
    return this.changes.reasons(false);
  }

  @Roles('admin')
  @Put('admin/plan-change-reasons/:id')
  updateReason(@Param('id') id: string, @Body() body: unknown) {
    const input = parsed(reasonSchema, body);
    return this.changes.updateReason(id, input.label, input.active);
  }
}
