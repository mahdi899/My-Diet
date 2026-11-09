import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { requiredUuid } from '../common/parse.js';
import { CoachEffects } from './effects.js';
import { coachToApi, openSse, sendProblem, sseProblem, writePing, writeSse } from './http.js';
import { CoachInsights } from './insights.js';
import { CoachRunner, type Accepted, type Incoming } from './runner.js';
import { CoachStore } from './store.js';
import type { CoachMessage, Json, MealType } from './types.js';

const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
const actions = ['confirm_meal', 'dismiss', 'confirm_swap', 'log_as_planned', 'log_water', 'log_weight', 'show_ring'] as const;

const messageSchema = z.object({
  clientMessageId: z.uuid(),
  kind: z.enum(['text', 'quick_reply', 'card_action', 'photo']),
  text: z.string().max(8000).optional(),
  value: z.string().max(200).optional(),
  label: z.string().max(80).optional(),
  action: z.string().max(40).optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  sourceMessageId: z.uuid().optional(),
  mediaId: z.uuid().optional(),
  caption: z.string().max(300).optional(),
  mealType: mealType.optional(),
}).strict();

const actionSchema = z.object({
  clientMessageId: z.uuid(),
  action: z.enum(actions),
  args: z.record(z.string(), z.unknown()).optional(),
  label: z.string().max(80).optional(),
  sourceMessageId: z.uuid().optional(),
}).strict();

const photoSchema = z.object({
  clientMessageId: z.uuid(),
  image: z.string().min(16).max(2_800_000),
  mime: z.string().max(80).optional(),
  caption: z.string().max(300).optional(),
  mealType: mealType.optional(),
}).strict();

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  mealType: mealType.optional(),
  items: z.array(z.record(z.string(), z.unknown())).max(8).optional(),
  planMealUid: z.uuid().nullable().optional(),
}).strict();

function invalid(): never {
  throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
}

@ApiTags('coach')
@Controller('v1')
export class CoachController {
  constructor(
    private readonly runner: CoachRunner,
    private readonly effects: CoachEffects,
    private readonly insights: CoachInsights,
    private readonly store: CoachStore,
  ) {}

  @Roles('user')
  @Get('me/coach/thread')
  async thread(@Req() req: Request, @Query('before') before?: string, @Query('limit') limit?: string) {
    const userId = actor(req).id;
    const row = await this.store.ensureThread(userId);
    let cursor: number | null = null;
    if (before != null && before !== '') {
      if (!/^\d+$/.test(before)) invalid();
      cursor = Number(before);
    }
    const size = limit == null || limit === '' ? 30 : Number(limit);
    if (!Number.isInteger(size) || size < 1 || size > 50) invalid();
    const page = await this.store.page(row.id, cursor, size);
    return { thread: { id: row.id, dayBriefDate: row.dayBriefDate }, messages: page.items, nextCursor: page.nextCursor };
  }

  @Roles('user')
  @Post('me/coach/messages')
  async messages(@Req() req: Request, @Res() res: Response, @Body() body: unknown): Promise<void> {
    let accepted: Accepted;
    try {
      accepted = await this.runner.accept(actor(req).id, parseMessage(body));
    } catch (error) {
      sendProblem(res, error);
      return;
    }
    openSse(res);
    const ping = setInterval(() => writePing(res), 15_000);
    const stop = () => clearInterval(ping);
    req.on('close', stop);
    try {
      await this.runner.respond(accepted, (event) => writeSse(res, event));
    } catch (error) {
      writeSse(res, { event: 'error', data: sseProblem(error) });
    } finally {
      stop();
      if (!res.writableEnded) res.end();
    }
  }

  @Roles('user')
  @Post('me/coach/food-photos')
  photo(@Req() req: Request, @Body() body: unknown) {
    const parsed = photoSchema.safeParse(body);
    if (!parsed.success) invalid();
    return this.guard(() => this.runner.submitPhoto(actor(req).id, {
      clientMessageId: parsed.data.clientMessageId,
      image: parsed.data.image,
      ...(parsed.data.mime ? { mime: parsed.data.mime } : {}),
      ...(parsed.data.caption ? { caption: parsed.data.caption } : {}),
      ...(parsed.data.mealType ? { mealType: parsed.data.mealType } : {}),
    }));
  }

  @Roles('user')
  @Patch('me/coach/meals/:id')
  async patchMeal(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) invalid();
    const userId = actor(req).id;
    const profile = await this.insights.profile(userId);
    if (!profile) throw new ApiError(409, 'no_profile', 'اول پرسش‌نامهٔ تغذیه را کامل کن.');
    const applied = await this.effects.applyConfirm(profile, { ...parsed.data, entryId: requiredUuid(id) });
    if ('error' in applied) throw new ApiError(400, 'validation', applied.error);
    return { entry: applied.entry, message: applied.message, today: applied.today };
  }

  @Roles('user')
  @Get('me/coach/today')
  today(@Req() req: Request) {
    return this.insights.today(actor(req).id);
  }

  @Roles('user')
  @Post('me/coach/day-brief')
  dayBrief(@Req() req: Request) {
    return this.guard(() => this.effects.ensureDayBrief(actor(req).id));
  }

  @Roles('user')
  @Post('me/coach/actions')
  async action(@Req() req: Request, @Body() body: unknown) {
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) invalid();
    const accepted = await this.guard(() => this.runner.accept(actor(req).id, {
      clientMessageId: parsed.data.clientMessageId,
      kind: 'card_action',
      text: parsed.data.label ?? '',
      action: parsed.data.action,
      args: (parsed.data.args ?? {}) as Json,
      sourceMessageId: parsed.data.sourceMessageId ?? null,
      mediaId: null,
      mealType: null,
    }));
    if (accepted.replay) return { userMessage: accepted.userMessage, messages: accepted.replies };
    const messages: CoachMessage[] = [];
    await this.guard(() => this.runner.respond(accepted, (event) => {
      if (event.event === 'message') messages.push(event.data.message);
    }));
    return { userMessage: accepted.userMessage, messages };
  }

  @Roles('user')
  @Get('me/coach/media/:id')
  async media(@Req() req: Request, @Res() res: Response, @Param('id') id: string): Promise<void> {
    const row = await this.store.media(actor(req).id, requiredUuid(id));
    if (!row) {
      sendProblem(res, new ApiError(404, 'not_found', 'عکس پیدا نشد'));
      return;
    }
    res.status(200);
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Content-Length', String(row.content.length));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(row.content);
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw coachToApi(error);
    }
  }
}

function parseMessage(body: unknown): Incoming {
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) invalid();
  const row = parsed.data;
  const text = row.kind === 'quick_reply'
    ? (row.label || row.value || row.text || '')
    : (row.text ?? row.caption ?? '');
  return {
    clientMessageId: row.clientMessageId,
    kind: row.kind,
    text,
    action: row.action ?? null,
    args: (row.args ?? {}) as Json,
    sourceMessageId: row.sourceMessageId ?? null,
    mediaId: row.mediaId ?? null,
    mealType: (row.mealType ?? null) as MealType | null,
  };
}
