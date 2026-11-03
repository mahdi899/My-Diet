import { Module } from '@nestjs/common';
import { FeedbackMetricsController, SpecialistReportController, WeeklyFeedbackController } from './weekly-feedback.controller.js';
import { WeeklyFeedbackService } from './weekly-feedback.service.js';

@Module({
  providers: [WeeklyFeedbackService],
  controllers: [WeeklyFeedbackController, SpecialistReportController, FeedbackMetricsController],
  exports: [WeeklyFeedbackService],
})
export class WeeklyFeedbackModule {}
