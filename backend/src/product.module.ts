import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MoneyModule } from './money/money.module.js';
import { PlansModule } from './plans/plans.module.js';
import { QuestionnaireModule } from './questionnaire/questionnaire.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { ShoppingModule } from './shopping/shopping.module.js';
import { WeeklyFeedbackModule } from './feedback/weekly-feedback.module.js';

@Module({
  imports: [
    IdentityModule,
    QuestionnaireModule,
    PlansModule,
    MoneyModule,
    TrackingModule,
    ShoppingModule,
    WeeklyFeedbackModule,
    MessagingModule,
    RealtimeModule,
    PrivacyModule,
    ReportsModule,
    AdminModule,
  ],
})
export class ProductModule {}
