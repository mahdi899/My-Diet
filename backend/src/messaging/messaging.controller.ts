import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { MessagingService } from './messaging.service.js';

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

  @Post('conversations/:id/messages')
  post(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['body']);
    return this.messaging.post(actor(req).id, requiredUuid(id), requiredString(record, 'body', 2000));
  }

  @Post('conversations/:id/read')
  read(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.markRead(actor(req).id, requiredUuid(id));
  }

  @Roles('user')
  @Post('me/support-conversation')
  support(@Req() req: Request) {
    return this.messaging.openSupport(actor(req).id);
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
