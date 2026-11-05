import { Body, Controller, Inject, Post, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import { Public, Roles, actor } from '../common/auth.js';
import { requiredUuid } from '../common/parse.js';
import { ApiError } from '../common/errors.js';
import { encryptText } from '../common/field-crypto.js';
import { normalizeIranianMobile } from '../common/phone.js';
import { PG_POOL } from '../database/database.js';
import { ENV, type Env } from '../config/env.js';

@Controller('v1/demo/submissions')
export class DemoLeadsController {
 constructor(@Inject(PG_POOL) private readonly pool:Pool,@Inject(ENV) private readonly env:Env){}
 @Roles('user')
 @Post(':id/verify')
 async verify(@Param('id') id:string,@Req() request:Request){
  const user=await this.pool.query<{phone_e164:string}>('select phone_e164 from users where id=$1',[actor(request).id]);
  if(!user.rows[0])throw new ApiError(401,'unauthorized','نشست معتبر نیست');
  const hash=createHmac('sha256',this.env.FIELD_KEY).update(user.rows[0].phone_e164).digest('hex');
  const result=await this.pool.query('update demo_lead_submissions set phone_verified=true where id=$1 and phone_hash=$2 returning id',[requiredUuid(id),hash]);
  if(!result.rowCount)throw new ApiError(404,'not_found','اطلاعات ثبت‌شده پیدا نشد');
  return {verified:true};
 }
 @Public()
 @Post()
 async save(@Body() body:unknown) {
  const b=body as Record<string,unknown>;
  if(!b||typeof b!=='object'||typeof b.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(b.id)||typeof b.phone!=='string'||!['weight_loss','weight_gain','pregnancy','detox'].includes(String(b.goal))||!Array.isArray(b.answers)||b.answers.length<20||b.answers.length>100)throw new ApiError(400,'validation','اطلاعات پرسش‌نامه کامل نیست');
  const phone=normalizeIranianMobile(b.phone);
  for(const answer of b.answers)if(!answer||typeof answer.question!=='string'||typeof answer.answer!=='string'||answer.question.length>500||answer.answer.length>2000)throw new ApiError(400,'validation','پاسخ معتبر نیست');
  const hash=createHmac('sha256',this.env.FIELD_KEY).update(phone).digest('hex');
  const result=await this.pool.query(`insert into demo_lead_submissions(id,phone_hash,phone_encrypted,goal,answers_encrypted) values($1,$2,$3,$4,$5) on conflict(id) do nothing returning id`,[b.id,hash,encryptText(phone,this.env.FIELD_KEY),b.goal,encryptText(JSON.stringify(b.answers),this.env.FIELD_KEY)]);
  if(!result.rowCount){const existing=await this.pool.query('select 1 from demo_lead_submissions where id=$1 and phone_hash=$2',[b.id,hash]);if(!existing.rowCount)throw new ApiError(409,'conflict','شناسهٔ ثبت تکراری است');}
  return {saved:true,id:b.id,phoneVerified:false};
 }
}
