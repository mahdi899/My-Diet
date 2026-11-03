import { Body, Controller, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, requiredUuid } from '../common/parse.js';
import { MessagingService } from './messaging.service.js';

const messageSchema = z.object({
  body: z.string().max(2000).optional(),
  clientRequestId: z.uuid().optional(),
  mediaId: z.uuid().optional(),
}).strict();
const mediaStartSchema = z.object({
  purpose: z.enum(['image', 'voice']),
  declaredType: z.string().min(1).max(80),
  voiceDurationMs: z.number().int().positive().max(300_000).optional(),
}).strict();
const mediaFinishSchema = z.object({
  declaredType: z.string().min(1).max(80),
  contentBase64: z.string().min(1).max(2_100_000),
}).strict();

@ApiTags('messaging')
@Controller('v1')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  list(@Req() req: Request) {
    return this.messaging.list(actor(req).id);
  }

  @Get('conversations/:id/messages')
  messages(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.messages(actor(req).id, requiredUuid(id));
  }

  @Get('conversations/:id/timeline')
  @ApiOperation({ summary: 'Cursor page of messages in server order. after is the last seen position.' })
  timeline(@Req() req: Request, @Param('id') id: string, @Query('after') after?: string, @Query('limit') limit?: string) {
    const cursor = after == null || after === '' ? null : Number(after);
    const size = limit == null || limit === '' ? 50 : Number(limit);
    if ((cursor != null && !Number.isInteger(cursor)) || !Number.isInteger(size) || size < 1 || size > 100) {
      throw new ApiError(400, 'validation', 'صفحهٔ پیام معتبر نیست');
    }
    return this.messaging.timeline(actor(req).id, requiredUuid(id), cursor, size);
  }

  @Post('conversations/:id/messages')
  post(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const parsed = messageSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'پیام معتبر نیست');
    return this.messaging.postRich(actor(req).id, requiredUuid(id), parsed.data);
  }

  @Post('conversations/:id/read')
  read(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.markRead(actor(req).id, requiredUuid(id));
  }

  @Post('conversations/:id/receipts')
  @ApiOperation({ summary: 'Record recipient delivery or read. The sender cannot acknowledge their own message.' })
  receipt(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const parsed = z.object({ messageId: z.uuid(), state: z.enum(['delivered', 'read']) }).strict().safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'رسید معتبر نیست');
    return this.messaging.receipt(actor(req).id, requiredUuid(id), parsed.data.messageId, parsed.data.state);
  }

  @Post('conversations/:id/media')
  @ApiOperation({ summary: 'Start a private upload. The storage key is chosen by the server.' })
  beginMedia(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const parsed = mediaStartSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'شروع بارگذاری معتبر نیست');
    return this.messaging.beginMedia(
      actor(req).id,
      requiredUuid(id),
      parsed.data.purpose,
      parsed.data.declaredType,
      parsed.data.voiceDurationMs ?? null,
    );
  }

  @Roles('user')
  @Post('me/support-conversation')
  support(@Req() req: Request) {
    return this.messaging.openSupport(actor(req).id);
  }

  @Roles('user')
  @Post('me/care-conversation')
  @ApiOperation({ summary: 'Open the customer conversation with the currently assigned specialist.' })
  care(@Req() req: Request) {
    return this.messaging.openCare(actor(req).id);
  }

  @Roles('user')
  @Get('me/sync')
  sync(@Req() req: Request, @Query('since') since?: string) {
    let after: Date | null = null;
    if (since != null && since !== '') {
      after = new Date(since);
      if (Number.isNaN(after.getTime())) throw new ApiError(400, 'validation', 'زمان درست نیست');
    }
    return this.messaging.sync(actor(req).id, after);
  }

  @Get('me/notifications')
  notifications(@Req() req: Request) {
    return this.messaging.notifications(actor(req).id);
  }

  @Post('me/notifications/:id/read')
  readNotification(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.markNotificationRead(actor(req).id, requiredUuid(id));
  }
}

@ApiTags('media')
@Controller('v1/media')
export class MediaController {
  constructor(private readonly messaging: MessagingService) {}

  @Put(':id')
  @ApiOperation({ summary: 'Finish an upload from file bytes. The declared type must match the detected signature.' })
  finish(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const parsed = mediaFinishSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'validation', 'فایل معتبر نیست');
    const bytes = Buffer.from(parsed.data.contentBase64, 'base64');
    if (bytes.toString('base64').replace(/=+$/, '') !== parsed.data.contentBase64.replace(/=+$/, '')) {
      throw new ApiError(400, 'validation', 'محتوای فایل معتبر نیست');
    }
    return this.messaging.finishMedia(actor(req).id, requiredUuid(id), bytes, parsed.data.declaredType);
  }

  @Post(':id/access')
  @ApiOperation({ summary: 'Issue a 60-second grant. It does not reveal the storage key.' })
  grant(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.grantMedia(actor(req).id, requiredUuid(id));
  }

  @Post(':id/content')
  content(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    const grant = record.grant;
    if (typeof grant !== 'string' || grant.length < 20 || grant.length > 200) {
      throw new ApiError(400, 'validation', 'مجوز رسانه معتبر نیست');
    }
    return this.messaging.readMedia(actor(req).id, requiredUuid(id), grant);
  }
}

