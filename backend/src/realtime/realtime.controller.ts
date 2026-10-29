import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { actor, Roles } from '../common/auth.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { RealtimeService } from './realtime.service.js';

@ApiTags('realtime')
@Controller('v1')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Roles('user', 'specialist', 'admin')
  @Post('me/devices')
  register(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['platform', 'pushToken', 'provider']);
    const user = actor(req);
    return this.realtime.register(
      user.id,
      user.sessionId,
      requiredString(record, 'platform', 40),
      requiredString(record, 'pushToken', 4096),
      requiredString(record, 'provider', 40),
    );
  }

  @Roles('user', 'specialist', 'admin')
  @Delete('me/devices/:id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.realtime.remove(actor(req).id, requiredUuid(id));
  }

  @Roles('user', 'specialist', 'admin')
  @Get('events')
  async events(
    @Req() req: Request,
    @Res() res: Response,
    @Query('once') once?: string,
    @Query('since') since?: string,
  ) {
    const userId = actor(req).id;
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    let cursor = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : '1970-01-01T00:00:00.000Z';
    const write = async () => {
      const events = await this.realtime.since(userId, cursor);
      for (const event of events) {
        res.write(`id: ${event.at}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        cursor = event.at;
      }
    };
    await write();
    if (once === '1') {
      res.end();
      return;
    }
    const timer = setInterval(() => {
      void write().catch(() => undefined);
    }, 1000);
    req.on('close', () => {
      clearInterval(timer);
      res.end();
    });
  }
}
