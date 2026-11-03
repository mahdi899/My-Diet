import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { StreakService } from './streak.service.js';

const claimSchema = z.object({ commandId: z.uuid() }).strict();
const milestoneSchema = z.object({ day: z.number().int(), amountToman: z.number().int() }).strict();
const publishSchema = z.object({
  consecutiveDays: z.number().int(),
  milestones: z.array(milestoneSchema).min(1).max(10),
  startsOn: z.string(),
  endsOn: z.string().nullable().optional(),
  effectiveOn: z.string(),
  repeat: z.enum(['cycle', 'none']),
}).strict();

function parsed<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, 'validation', 'اطلاعات درخواست کامل نیست');
  return result.data;
}

@ApiTags('streaks')
@Controller('v1')
export class StreakController {
  constructor(private readonly streaks: StreakService) {}

  @Roles('user')
  @Get('me/streak')
  @ApiOperation({ summary: 'Current campaign snapshot. Login and reading this route never qualify a day or credit the wallet.' })
  snapshot(@Req() req: Request) {
    return this.streaks.snapshot(actor(req).id);
  }

  @Roles('user')
  @Post('me/streak/claim')
  @ApiOperation({ summary: 'Credit reached milestones once. The same commandId returns the original result.' })
  claim(@Req() req: Request, @Body() body: unknown) {
    return this.streaks.claim(actor(req).id, parsed(claimSchema, body).commandId);
  }

  @Roles('admin')
  @Get('admin/streak-campaigns')
  list() {
    return this.streaks.list();
  }

  @Roles('admin')
  @Post('admin/streak-campaigns')
  publish(@Body() body: unknown) {
    const input = parsed(publishSchema, body);
    return this.streaks.publish({ ...input, endsOn: input.endsOn ?? null });
  }
}
