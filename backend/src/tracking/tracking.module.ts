import { Module } from '@nestjs/common';
import { MoneyModule } from '../money/money.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { PublicReviewsController, TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';
import { MealActivityService } from './meal-activity.service.js';

@Module({
  imports: [PlansModule, MoneyModule],
  controllers: [TrackingController, PublicReviewsController],
  providers: [TrackingService,MealActivityService],
  exports: [TrackingService, MealActivityService],
})
export class TrackingModule {}
