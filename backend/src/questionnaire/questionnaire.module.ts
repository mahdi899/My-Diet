import { Module } from '@nestjs/common';
import { QuestionnaireController, QuestionnaireSchemaController } from './questionnaire.controller.js';
import { QuestionnaireAdminController, QuestionnaireEditorPageController } from './editor.controller.js';
import { QuestionnaireService } from './questionnaire.service.js';

@Module({
  controllers: [
    QuestionnaireSchemaController,
    QuestionnaireController,
    QuestionnaireAdminController,
    QuestionnaireEditorPageController,
  ],
  providers: [QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
