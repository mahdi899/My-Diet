import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor } from '../common/auth.js';
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

  @Get('me/notifications')
  notifications(@Req() req: Request) {
    return this.messaging.notifications(actor(req).id);
  }

  @Post('me/notifications/:id/read')
  readNotification(@Req() req: Request, @Param('id') id: string) {
    return this.messaging.markNotificationRead(actor(req).id, requiredUuid(id));
  }
}
