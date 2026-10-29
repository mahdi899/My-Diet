import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown, requiredString } from '../common/parse.js';
import { PrivacyService } from './privacy.service.js';

@ApiTags('privacy')
@Controller('v1/me')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Roles('user', 'specialist', 'admin')
  @Get('export')
  exportAccount(@Req() req: Request) {
    return this.privacy.exportAccount(actor(req).id);
  }

  @Roles('user', 'specialist', 'admin')
  @Post('account/delete')
  deleteAccount(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['confirmation']);
    if (requiredString(record, 'confirmation', 40) !== 'حذف حساب') {
      throw new ApiError(400, 'validation', 'برای حذف حساب عبارت تأیید را بنویس');
    }
    return this.privacy.deleteAccount(actor(req).id);
  }
}
