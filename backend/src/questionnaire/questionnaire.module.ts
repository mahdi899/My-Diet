import { Module } from '@nestjs/common';
import { QuestionnaireController, QuestionnaireSchemaController } from './questionnaire.controller.js';
import { QuestionnaireService } from './questionnaire.service.js';

@Module({
  controllers: [QuestionnaireSchemaController, QuestionnaireController],
  providers: [QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
