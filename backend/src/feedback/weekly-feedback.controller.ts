import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { AFFORDABILITY, AVAILABILITY, PORTION, PREPARATION } from './facts.js';
import { requireWeek, WeeklyFeedbackService } from './weekly-feedback.service.js';

const feedbackSchema = z.object({
  weekStart: z.iso.date(),
  favorites: z.array(z.uuid()).max(20),
  dislikes: z.array(z.uuid()).max(20),
  preparationDifficulty: z.enum(PREPARATION),
  ingredientAvailability: z.enum(AVAILABILITY),
  affordability: z.enum(AFFORDABILITY),
  portionSatisfaction: z.enum(PORTION),
  serviceRating: z.number().int().min(1).max(5).nullable(),
  comment: z.string().max(1000),
  publishPermission: z.boolean(),
}).strict();
const confirmSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  favoriteOptions: z.array(z.string().trim().min(1).max(80)).max(30),
  dislikedOptions: z.array(z.string().trim().min(1).max(80)).max(30),
  note: z.string().max(500),
}).strict();
const reportSchema = z.object({ weekStart: z.iso.date(), commandId: z.uuid() }).strict();

function weekQuery(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError(400, 'validation', 'شروع هفته لازم است');
  return requireWeek(value);
}

@ApiTags('weekly-feedback')
@Roles('user')
@Controller('v1/me')
export class WeeklyFeedbackController {
  constructor(private readonly feedback: WeeklyFeedbackService) {}

  @Put('weekly-feedback')
  @ApiOperation({ summary: 'Store private weekly feedback for a plan week. Publishing is a separate explicit step.' })
  save(@Req() req: Request, @Body() body: unknown) {
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'بازخورد معتبر نیست');
    return this.feedback.save(actor(req).id, parsed.data);
  }

  @Get('weekly-feedback')
  read(@Req() req: Request, @Query('weekStart') weekStart: unknown) {
    return this.feedback.get(actor(req).id, weekQuery(weekStart));
  }

  @Post('weekly-feedback/publish')
  @ApiOperation({ summary: 'Queue a public review only when the customer explicitly allowed publication. Private feedback stays.' })
  publish(@Req() req: Request, @Body() body: unknown) {
    const parsed = z.object({ weekStart: z.iso.date() }).strict().safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'هفتهٔ انتشار معتبر نیست');
    return this.feedback.publish(actor(req).id, parsed.data.weekStart);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Preference suggestions from questionnaire, substitutions and feedback. Not a diagnosis.' })
  preferences(@Req() req: Request) {
    return this.feedback.preferences(actor(req).id);
  }

  @Put('preferences')
  confirm(@Req() req: Request, @Body() body: unknown) {
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'اصلاح ترجیح معتبر نیست');
    const value = parsed.data;
    return this.feedback.confirm(actor(req).id, value.expectedRevision, value.favoriteOptions, value.dislikedOptions, value.note);
  }

  @Post('patient-reports')
  @ApiOperation({ summary: 'Build one versioned fact report for the week. Retries reuse the command. It never publishes a plan.' })
  report(@Req() req: Request, @Body() body: unknown) {
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'درخواست گزارش معتبر نیست');
    return this.feedback.generate(actor(req).id, parsed.data.weekStart, parsed.data.commandId);
  }

  @Get('patient-reports')
  latest(@Req() req: Request, @Query('weekStart') weekStart: unknown) {
    return this.feedback.latest(actor(req).id, weekQuery(weekStart));
  }
}

@ApiTags('weekly-feedback')
@Roles('specialist')
@Controller('v1/specialist/patients')
export class SpecialistReportController {
  constructor(private readonly feedback: WeeklyFeedbackService) {}

  @Get(':userId/patient-reports')
  @ApiOperation({ summary: 'Assigned specialist reads the patient week report. Unassigned patients are not found.' })
  read(@Req() req: Request, @Param('userId') userId: string, @Query('weekStart') weekStart: unknown) {
    if (!z.uuid().safeParse(userId).success) throw new ApiError(400, 'validation', 'بیمار معتبر نیست');
    return this.feedback.forSpecialist(actor(req).id, userId, weekQuery(weekStart));
  }
}

@ApiTags('weekly-feedback')
@Roles('admin')
@Controller('v1/admin/feedback-metrics')
export class FeedbackMetricsController {
  constructor(private readonly feedback: WeeklyFeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'Private feedback quality is separate from public approved-review metrics.' })
  metrics() {
    return this.feedback.metrics();
  }
}
