import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { actor, Public, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { bodyRecord, rejectUnknown } from '../common/parse.js';
import { QuestionnaireService } from './questionnaire.service.js';

const EDITOR_PAGE = `<!doctype html>
<html lang="fa" dir="rtl">
<meta charset="utf-8">
<title>ویرایش پرسشنامه</title>
<style>
  body { font-family: sans-serif; margin: 2rem; }
  textarea, input { width: 100%; box-sizing: border-box; }
  textarea { min-height: 24rem; }
  pre { white-space: pre-wrap; }
</style>
<h1>ویرایش پرسشنامه</h1>
<p>توکن مدیر را بگذار، سازگاری را بررسی کن، بعد پیش‌نویس را ذخیره و منتشر کن. حذف سؤال ثابت رد می‌شود.</p>
<label>توکن دسترسی <input id="token" autocomplete="off"></label>
<p><button id="load" type="button">بارگذاری نسخهٔ منتشرشده</button>
<button id="check" type="button">بررسی سازگاری</button>
<button id="save" type="button">ذخیرهٔ پیش‌نویس</button>
<button id="publish" type="button">انتشار</button></p>
<textarea id="document"></textarea>
<pre id="result"></pre>
<script>
const token = document.querySelector('#token');
const documentBox = document.querySelector('#document');
const result = document.querySelector('#result');
let draftVersion = null;
async function call(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token.value.trim(), ...(options && options.headers) }
  });
  const body = await response.json().catch(() => ({}));
  result.textContent = JSON.stringify(body, null, 2);
  if (!response.ok) throw new Error('request failed');
  return body;
}
document.querySelector('#load').onclick = async () => {
  const schema = await call('/v1/questionnaire/schema', { headers: {} });
  documentBox.value = JSON.stringify({ questions: schema.questions }, null, 2);
};
document.querySelector('#check').onclick = () => call('/v1/admin/questionnaire/compatibility', { method: 'POST', body: documentBox.value });
document.querySelector('#save').onclick = async () => {
  const saved = await call('/v1/admin/questionnaire/schemas', { method: 'POST', body: documentBox.value });
  draftVersion = saved.version;
};
document.querySelector('#publish').onclick = () => {
  if (!draftVersion) { result.textContent = 'ابتدا پیش‌نویس را ذخیره کن'; return; }
  return call('/v1/admin/questionnaire/schemas/' + draftVersion + '/publish', { method: 'POST', body: '{}' });
};
</script>
</html>`;

@ApiTags('questionnaire')
@Controller()
export class QuestionnaireEditorPageController {
  @Public()
  @Get('questionnaire-editor')
  page(@Res() res: Response) {
    res.type('html').send(EDITOR_PAGE);
  }
}

@ApiTags('admin')
@Controller('v1/admin/questionnaire')
@Roles('admin')
export class QuestionnaireAdminController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Get('schemas')
  list() {
    return this.questionnaires.listSchemas();
  }

  @Post('compatibility')
  check(@Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['questions']);
    return this.questionnaires.check(record);
  }

  @Post('schemas')
  save(@Req() req: Request, @Body() body: unknown) {
    const record = bodyRecord(body);
    rejectUnknown(record, ['questions']);
    return this.questionnaires.saveDraftSchema(actor(req).id, record);
  }

  @Post('schemas/:version/publish')
  publish(@Req() req: Request, @Param('version') version: string) {
    const parsed = Number(version);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ApiError(400, 'validation', 'نسخهٔ پرسشنامه پیدا نشد');
    }
    return this.questionnaires.publishSchema(actor(req).id, parsed);
  }
}
