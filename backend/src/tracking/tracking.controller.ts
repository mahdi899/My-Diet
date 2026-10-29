import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { TrackingService } from './tracking.service.js';

@ApiTags('tracking')
@Controller('v1/me')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Roles('user')
  @Get('dashboard')
  dashboard(@Req() req: Request) {
    return this.tracking.dashboard(actor(req).id);
  }

  @Roles('user')
  @Post('meal-logs')
  meal(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['mealUid', 'eaten']);
    if (typeof record.eaten !== 'boolean') {
      throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }
    return this.tracking.setMeal(actor(req).id, requiredUuid(record.mealUid), record.eaten);
  }

  @Roles('user')
  @Post('weights')
  weight(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['kilograms']);
    if (typeof record.kilograms !== 'number') {
      throw new ApiError(400, 'validation', 'وزن باید بین ۲۵ و ۳۰۰ کیلوگرم باشد');
    }
    return this.tracking.setWeight(actor(req).id, record.kilograms);
  }

  @Roles('user')
  @Get('weights')
  weights(@Req() req: Request) {
    return this.tracking.weights(actor(req).id);
  }

  @Roles('user')
  @Post('reviews')
  review(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['requestId', 'weekStart', 'rating', 'body']);
    if (typeof record.rating !== 'number') {
      throw new ApiError(400, 'validation', 'امتیاز باید بین ۱ و ۵ باشد');
    }
    return this.tracking.review(
      actor(req).id,
      requiredUuid(record.requestId),
      requiredString(record, 'weekStart', 10),
      record.rating,
      typeof record.body === 'string' ? record.body.trim().slice(0, 1000) : '',
    );
  }
}
