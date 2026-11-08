import { Module } from '@nestjs/common';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module.js';
import { OnboardingAdminService } from './onboarding-admin.service.js';
import { OnboardingAdminController, OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';

@Module({
  imports: [QuestionnaireModule],
  controllers: [OnboardingController, OnboardingAdminController],
  providers: [OnboardingService, OnboardingAdminService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
