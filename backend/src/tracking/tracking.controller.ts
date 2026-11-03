import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation,ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown, requiredString, requiredUuid } from '../common/parse.js';
import { TrackingService } from './tracking.service.js';
import { MealActivityService } from './meal-activity.service.js';
import { activitySchema,selectionSchema } from './meal-activity.js';
import { parseCivilDate } from '../plans/views.js';

@ApiTags('tracking')
@Controller('v1/me')
export class TrackingController {
  constructor(private readonly tracking: TrackingService,private readonly activity:MealActivityService) {}

  @Roles('user')
  @Get('substitution-reasons')
  reasons(){return this.activity.reasons();}

  @Roles('user')
  @Get('meal-activity/:date')
  activityDay(@Req() req:Request,@Param('date') date:string){
    if(!parseCivilDate(date))throw new ApiError(400,'validation','تاریخ معتبر نیست');
    return this.activity.day(actor(req).id,date);
  }

  @Roles('user')
  @Get('meal-activity/:date/history')
  activityHistory(@Req() req:Request,@Param('date') date:string){
    if(!parseCivilDate(date))throw new ApiError(400,'validation','تاریخ معتبر نیست');
    return this.activity.history(actor(req).id,date);
  }

  @Roles('user')
  @Post('meal-consumption')
  @ApiOperation({summary:'Record or correct current-day consumption',description:'Requires commandId, expectedRevision, date, versionId, mealUid, optionId and state. less/more/different require actual quantity and unit; different also requires foodName. See backend-roadmap-phase-4.md. Unknown calories are null; retries use the same commandId.'})
  record(@Req() req:Request,@Body() body:unknown){
    const parsed=activitySchema.safeParse(body);
    if(!parsed.success)throw new ApiError(400,'validation','اطلاعات مصرف معتبر نیست');
    return this.activity.record(actor(req).id,parsed.data);
  }

  @Roles('user')
  @Post('meal-selections')
  @ApiOperation({summary:'Select an approved meal option without recording consumption',description:'Requires commandId, expectedRevision, date, versionId, mealUid and optionId. Current-day selection requires an active reasonId; past-day changes and consumed-meal replacements are rejected.'})
  select(@Req() req:Request,@Body() body:unknown){
    const parsed=selectionSchema.safeParse(body);
    if(!parsed.success)throw new ApiError(400,'validation','اطلاعات انتخاب معتبر نیست');
    return this.activity.select(actor(req).id,parsed.data);
  }

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
  @Get('specialist')
  specialist(@Req() req: Request) {
    return this.tracking.mySpecialist(actor(req).id);
  }

  @Roles('user')
  @Get('rewards/pending')
  pendingRewards(@Req() req: Request) {
    return this.tracking.pendingRewards(actor(req).id);
  }

  @Roles('user')
  @Post('rewards/:id/acknowledge')
  acknowledge(@Req() req: Request, @Param('id') id: string, @Body() body: unknown) {
    if (body != null) rejectUnknown(bodyRecord(body), []);
    return this.tracking.acknowledgeReward(actor(req).id, requiredUuid(id));
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

@ApiTags('reviews')
@Public()
@Controller('v1/public')
export class PublicReviewsController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('reviews')
  reviews() {
    return this.tracking.publicReviews();
  }
}
