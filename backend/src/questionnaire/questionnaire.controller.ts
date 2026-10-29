import { Body, Controller, Get, Put, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { QuestionnaireService } from './questionnaire.service.js';

@ApiTags('questionnaire')
@Controller('v1/questionnaire')
export class QuestionnaireSchemaController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Public()
  @Get('schema')
  schema() {
    return this.questionnaires.schema();
  }
}

@ApiTags('questionnaire')
@Controller('v1/me/questionnaire')
export class QuestionnaireController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Roles('user')
  @Get()
  draft(@Req() req: Request) {
    return this.questionnaires.draft(actor(req).id);
  }

  @Roles('user')
  @Put()
  save(@Req() req: Request, @Body() body: unknown) {
    return this.questionnaires.saveDraft(actor(req).id, body);
  }

  @Roles('user')
  @Post('submissions')
  submit(@Req() req: Request, @Body() body: unknown) {
    return this.questionnaires.submit(actor(req).id, body);
  }
}
