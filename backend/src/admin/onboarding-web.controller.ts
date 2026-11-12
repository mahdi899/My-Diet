import { Body, Controller, Get, Header, Inject, Post, Put, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import { Public, Roles, actor } from '../common/auth.js';
import { rejectUnknown, requiredUuid } from '../common/parse.js';
import { ApiError } from '../common/errors.js';
import { encryptText } from '../common/field-crypto.js';
import { normalizeIranianMobile } from '../common/phone.js';
import { PG_POOL } from '../database/database.js';
import { ENV, type Env } from '../config/env.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { plainText } from '../publishing/content.js';

const onboardingGoals = ['weight_loss', 'weight_gain', 'pregnancy', 'detox'];

@Controller('v1')
export class OnboardingQuestionnaireController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Public()
  @Get('public/onboarding-questionnaire')
  @Header('Cache-Control', 'no-store')
  async list() {
    const { rows } = await this.pool.query('select goal, document from demo_questionnaire_settings');
    return Object.fromEntries(rows.map(row => [row.goal, row.document]));
  }

  /** Atomic member counter for the demo “community” hero; one increment per call. */
  @Public()
  @Post('public/onboarding/community-join')
  @Header('Cache-Control', 'no-store')
  async communityJoin() {
    const { rows } = await this.pool.query<{ count: string }>(
      `insert into app_settings (key, value) values ('demo.community_join_counter', '1621'::jsonb)
       on conflict (key) do update set
         value = to_jsonb((app_settings.value #>> '{}')::bigint + 1),
         version = app_settings.version + 1,
         updated_at = now()
       returning (value #>> '{}')::bigint as count`,
    );
    return { count: Number(rows[0]?.count ?? 1622) };
  }

  @Roles('admin')
  @Put('admin/onboarding-questionnaire/:goal')
  async save(@Param('goal') goal: string, @Body() body: { title?: unknown; questions?: unknown }) {
    const invalid = () => new ApiError(400, 'validation', 'تنظیمات هدف یا سؤال‌ها معتبر نیست');
    if (!onboardingGoals.includes(goal) || !Array.isArray(body?.questions) || !body.questions.length || body.questions.length > 100) throw invalid();
    const used = new Set<number>();
    const questions = body.questions.map(raw => {
      if (!raw || !Number.isInteger(raw.id) || raw.id < 1 || raw.id > 10000 || used.has(raw.id)) throw invalid();
      used.add(raw.id);
      const q = plainText(raw.q, 500);
      if (raw.id <= 100) return { id: raw.id, q };
      if (raw.type === 'text') return { id: raw.id, q, type: 'text' };
      if (raw.type !== 'choice' || !Array.isArray(raw.options) || raw.options.length < 2 || raw.options.length > 12) throw invalid();
      return { id: raw.id, q, type: 'choice', options: raw.options.map((label: unknown) => plainText(label, 120)) };
    });
    const document = { title: plainText(body.title, 120), questions };
    await this.pool.query('insert into demo_questionnaire_settings(goal,document) values($1,$2) on conflict(goal) do update set document=excluded.document', [goal, JSON.stringify(document)]);
    return document;
  }
}

@Controller('v1/onboarding/submissions')
export class OnboardingSubmissionsController {
 constructor(@Inject(PG_POOL) private readonly pool:Pool,@Inject(ENV) private readonly env:Env,private readonly onboarding:OnboardingService){}
 @Roles('user')
 @Post(':id/verify')
 async verify(@Param('id') id:string,@Req() request:Request,@Body() body:unknown){
  const journeyId=this.journeyId(body);
  const user=await this.pool.query<{phone_e164:string}>('select phone_e164 from users where id=$1',[actor(request).id]);
  if(!user.rows[0])throw new ApiError(401,'unauthorized','نشست معتبر نیست');
  const hash=createHmac('sha256',this.env.FIELD_KEY).update(user.rows[0].phone_e164).digest('hex');
  const result=await this.pool.query('update demo_lead_submissions set phone_verified=true where id=$1 and phone_hash=$2 returning id',[requiredUuid(id),hash]);
  if(!result.rowCount)throw new ApiError(404,'not_found','اطلاعات ثبت‌شده پیدا نشد');
  await this.onboarding.importVerifiedDemo(actor(request).id);
  if(journeyId)await this.pool.query(`insert into onboarding_analytics_journeys(journey_id,user_id,phone_e164) values($1,$2,$3)
    on conflict(journey_id) do update set user_id=excluded.user_id,phone_e164=excluded.phone_e164,verified_at=now()`,[journeyId,actor(request).id,user.rows[0].phone_e164]);
  return {verified:true};
 }
 /** The analytics path id is optional. A phone is linked only after OTP has already created the user. */
 private journeyId(body:unknown){
  if(body==null)return null;
  if(typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'validation','اطلاعات واردشده ناقص یا نادرست است');
  const record=body as Record<string,unknown>;
  rejectUnknown(record,['journeyId']);
  if(record.journeyId==null||record.journeyId==='')return null;
  return requiredUuid(record.journeyId);
 }
 @Public()
 @Post()
 async save(@Body() body:unknown) {
  const b=body as Record<string,unknown>;
  if(!b||typeof b!=='object'||typeof b.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id)||typeof b.phone!=='string'||!['weight_loss','weight_gain','pregnancy','detox'].includes(String(b.goal))||!Array.isArray(b.answers)||b.answers.length<1||b.answers.length>100)throw new ApiError(400,'validation','اطلاعات پرسش‌نامه کامل نیست');
  const phone=normalizeIranianMobile(b.phone);
  for(const answer of b.answers){
   if(!answer||typeof answer.question!=='string'||typeof answer.answer!=='string'||answer.question.length>500||answer.answer.length>2000)throw new ApiError(400,'validation','پاسخ معتبر نیست');
   // Canonical identifiers from newer demo builds: optional, small and strictly typed.
   if(answer.key!==undefined&&(typeof answer.key!=='string'||!/^[a-z0-9_]{1,60}$/.test(answer.key)))throw new ApiError(400,'validation','پاسخ معتبر نیست');
   if(answer.codes!==undefined&&(!Array.isArray(answer.codes)||answer.codes.length>20||answer.codes.some((c:unknown)=>typeof c!=='string'||!/^[a-z0-9_]{1,60}$/.test(c))))throw new ApiError(400,'validation','پاسخ معتبر نیست');
  }
  const hash=createHmac('sha256',this.env.FIELD_KEY).update(phone).digest('hex');
  const result=await this.pool.query(`insert into demo_lead_submissions(id,phone_hash,phone_encrypted,goal,answers_encrypted) values($1,$2,$3,$4,$5) on conflict(id) do nothing returning id`,[b.id,hash,encryptText(phone,this.env.FIELD_KEY),b.goal,encryptText(JSON.stringify(b.answers),this.env.FIELD_KEY)]);
  if(!result.rowCount){const existing=await this.pool.query('select 1 from demo_lead_submissions where id=$1 and phone_hash=$2',[b.id,hash]);if(!existing.rowCount)throw new ApiError(409,'conflict','شناسهٔ ثبت تکراری است');}
  return {saved:true,id:b.id,phoneVerified:false};
 }
}
