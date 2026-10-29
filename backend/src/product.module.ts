import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MoneyModule } from './money/money.module.js';
import { PlansModule } from './plans/plans.module.js';
import { QuestionnaireModule } from './questionnaire/questionnaire.module.js';
import { TrackingModule } from './tracking/tracking.module.js';

@Module({
  imports: [
    IdentityModule,
    QuestionnaireModule,
    PlansModule,
    MoneyModule,
    TrackingModule,
    MessagingModule,
    AdminModule,
  ],
})
export class ProductModule {}
