import { Inject, Injectable } from '@nestjs/common';
import type { Pool,PoolClient } from 'pg';
import { PG_POOL } from '../database/database.js';
import { ApiError } from '../common/errors.js';
import { uuidv7 } from '../common/id.js';
import { insertOutbox,withTransaction } from '../common/sql.js';
import { tehranToday } from '../common/time.js';
import type { MealOption } from '../plans/options.js';
import { PlanDraftService } from '../plans/plans.service.js';
import { TrackingService } from './tracking.service.js';
import { compatibleRatio,proportionalCalories,type ActivityInput,type SelectionInput } from './meal-activity.js';

@Injectable()
export class MealActivityService {
 constructor(@Inject(PG_POOL) private readonly pool:Pool,private readonly plans:PlanDraftService,private readonly tracking:TrackingService){}
 async reasons(){return (await this.pool.query('select id,label from substitution_reasons where active=true order by id')).rows;}
 async day(userId:string,date:string){
  const plan=await this.plans.planDay(userId,date);
  const planned=plan.meals.map(m=>m.plannedCalories);
  const consumed=plan.meals.map(m=>m.consumptionState==='unrecorded'?null:m.consumption?.consumedCalories ?? null);
  const summarize=(values:unknown[])=>({knownSubtotal:values.reduce<number>((sum,v)=>sum+(typeof v==='number'?v:0),0),unknownCount:values.filter(v=>typeof v!=='number').length,
    total:values.some(v=>typeof v!=='number')?null:values.reduce<number>((sum,v)=>sum+Number(v),0)});
  return {date,calories:{planned:summarize(planned),consumed:summarize(consumed)},records:(await this.pool.query('select meal_uid as "mealUid",plan_version_id as "versionId",option_uid as "optionId",revision,details,eaten from meal_logs where user_id=$1 and scheduled_date=$2',[userId,date])).rows,
   selections:(await this.pool.query('select meal_uid as "mealUid",version_id as "versionId",option_uid as "optionId",revision from meal_selections where user_id=$1 and civil_date=$2',[userId,date])).rows};
 }
 async history(userId:string,date:string){return {consumption:(await this.pool.query(`select id,previous,current,recorded_at as "recordedAt" from meal_log_history
    where user_id=$1 and current->>'scheduled_date'=$2 order by id desc limit 100`,[userId,date])).rows,
   selections:(await this.pool.query('select id,previous,current,recorded_at as "recordedAt" from meal_selection_history where user_id=$1 and civil_date=$2 order by id desc limit 100',[userId,date])).rows};}
 private async command(userId:string,input:ActivityInput|SelectionInput,kind:string,work:(c:PoolClient)=>Promise<object>){
  return withTransaction(this.pool,async c=>{
   await c.query('select id from users where id=$1 for update',[userId]);
   const payload={kind,...input};
   const old=(await c.query('select payload,response from meal_activity_commands where user_id=$1 and command_id=$2',[userId,input.commandId])).rows[0];
   if(old){
    const same=(await c.query('select $1::jsonb=$2::jsonb as same',[JSON.stringify(payload),JSON.stringify(old.payload)])).rows[0].same;
    if(!same)throw new ApiError(409,'idempotency_conflict','این شناسه برای درخواست دیگری استفاده شده است');
    return old.response;
   }
   const response=await work(c);
   await c.query('insert into meal_activity_commands(user_id,command_id,payload,response) values($1,$2,$3::jsonb,$4::jsonb)',[userId,input.commandId,JSON.stringify(payload),JSON.stringify(response)]);
   return response;
  });
 }
 private async option(c:PoolClient,userId:string,input:ActivityInput|SelectionInput){
  const row=(await c.query<{meal_id:string;request_id:string;document:MealOption}>(`select m.id as meal_id,r.id as request_id,o.document
   from plan_meals m join plan_days d on d.id=m.plan_day_id join plan_versions v on v.id=d.plan_version_id
   join plan_requests r on r.id=v.request_id join orders paid on paid.id=r.order_id and paid.status='paid'
   join plan_meal_options o on o.meal_id=m.id and o.option_uid=$4
   where r.user_id=$1 and v.id=$2 and m.meal_uid=$3 and d.civil_date=$5::date and d.civil_date>=r.effective_from
   and v.status in ('published','superseded') and o.approved_by is not null and o.approved_at is not null`,
  [userId,input.versionId,input.mealUid,input.optionId,input.date])).rows[0];
  if(!row)throw new ApiError(404,'not_found','گزینه تأییدشده پیدا نشد');
  return row;
 }
 private async current(c:PoolClient,userId:string,input:ActivityInput|SelectionInput){
  const latest=(await c.query(`select v.id from plan_versions v join plan_days d on d.plan_version_id=v.id
   join plan_requests r on r.id=v.request_id where r.user_id=$1 and d.civil_date=$2::date
   and v.status in ('published','superseded') and (v.published_at at time zone 'Asia/Tehran')::date<=$2::date
   order by v.published_at desc,v.id desc limit 1`,[userId,input.date])).rows[0];
  if(latest?.id!==input.versionId)throw new ApiError(409,'plan_changed','نسخه برنامه تغییر کرده است');
 }
 async record(userId:string,input:ActivityInput){return this.command(userId,input,'record',async c=>{
  if(input.date!==tehranToday())throw new ApiError(409,'not_today','اصلاح یا ثبت مصرف فقط برای امروز ممکن است');
  const option=await this.option(c,userId,input);
  const old=(await c.query('select * from meal_logs where user_id=$1 and scheduled_date=$2 and meal_uid=$3',[userId,input.date,input.mealUid])).rows[0];
  if((old?.revision??0)!==input.expectedRevision)throw new ApiError(409,'lock_conflict','ثبت مصرف تغییر کرده است');
  if(old && (old.eaten || old.details.state && old.details.state!=='unrecorded') && (old.plan_version_id!==input.versionId||old.option_uid!==input.optionId))throw new ApiError(409,'consumption_exists','ابتدا ثبت قبلی را صریحاً اصلاح کنید');
  if(!old || old.plan_version_id!==input.versionId)await this.current(c,userId,input);
  const selected=(await c.query('select option_uid,version_id from meal_selections where user_id=$1 and civil_date=$2 and meal_uid=$3',[userId,input.date,input.mealUid])).rows[0];
  if((!old||old.option_uid!==input.optionId||old.plan_version_id!==input.versionId) && (selected ? selected.option_uid!==input.optionId||selected.version_id!==input.versionId : option.document.kind!=='primary'))throw new ApiError(409,'selection_required','ابتدا جایگزین را انتخاب کنید');
  let consumed:number|null=null;
  if(input.state==='as_planned')consumed=option.document.calories;
  if(input.state==='skipped')consumed=0;
  if(input.actual && (input.state==='less'||input.state==='more')){
   consumed=proportionalCalories(option.document.calories,option.document.portion,input.actual);
   const ratio=compatibleRatio(option.document.portion,input.actual);
   if(ratio!==null && (input.state==='less'?ratio>=1:ratio<=1))throw new ApiError(400,'validation','مقدار واقعی با کمتر یا بیشتر مطابقت ندارد');
  }
  const details={state:input.state,actual:input.actual??null,foodName:input.foodName??null,plannedCalories:option.document.calories,consumedCalories:consumed};
  const saved=(await c.query(`insert into meal_logs(id,user_id,request_id,scheduled_date,meal_uid,eaten,plan_version_id,plan_meal_id,option_uid,details)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) on conflict(user_id,scheduled_date,meal_uid) do update
   set eaten=excluded.eaten,plan_version_id=excluded.plan_version_id,plan_meal_id=excluded.plan_meal_id,option_uid=excluded.option_uid,details=excluded.details,updated_at=now()
   returning revision`,[uuidv7(),userId,option.request_id,input.date,input.mealUid,input.state==='as_planned',input.versionId,option.meal_id,input.optionId,JSON.stringify(details)])).rows[0];
  const reward=input.state==='as_planned'?await this.tracking.rewardForRecordedMeal(c,userId,option.request_id):null;
  return {...details,revision:saved.revision,versionId:input.versionId,optionId:input.optionId,reward};
 });}
 async select(userId:string,input:SelectionInput){return this.command(userId,input,'select',async c=>{
  if(input.date<tehranToday())throw new ApiError(409,'past_day','انتخاب برای روزهای گذشته مجاز نیست');
  await this.current(c,userId,input);const option=await this.option(c,userId,input);
  const log=(await c.query('select eaten,details from meal_logs where user_id=$1 and scheduled_date=$2 and meal_uid=$3',[userId,input.date,input.mealUid])).rows[0];
  if(log && (log.eaten||Object.keys(log.details).length>0 && log.details.state!=='unrecorded'))throw new ApiError(409,'consumption_exists','انتخاب وعده ثبت‌شده تغییر نمی‌کند؛ ابتدا مصرف را اصلاح کنید');
  const old=(await c.query('select * from meal_selections where user_id=$1 and civil_date=$2 and meal_uid=$3',[userId,input.date,input.mealUid])).rows[0];
  if((old?.revision??0)!==input.expectedRevision)throw new ApiError(409,'lock_conflict','انتخاب تغییر کرده است');
  const reason=input.reasonId?(await c.query('select id,label from substitution_reasons where id=$1 and active=true',[input.reasonId])).rows[0]:null;
  if(input.reasonId&&!reason || input.date===tehranToday()&&!reason)throw new ApiError(400,'reason_required','دلیل معتبر انتخاب لازم است');
  const result=(await c.query(`insert into meal_selections(user_id,civil_date,meal_uid,version_id,meal_id,option_uid,reason_id,reason_label)
   values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(user_id,civil_date,meal_uid) do update set version_id=excluded.version_id,meal_id=excluded.meal_id,option_uid=excluded.option_uid,
   reason_id=excluded.reason_id,reason_label=excluded.reason_label,revision=meal_selections.revision+1,updated_at=now() returning *`,[userId,input.date,input.mealUid,input.versionId,option.meal_id,input.optionId,reason?.id??null,reason?.label??null])).rows[0];
  await c.query('insert into meal_selection_history(user_id,civil_date,meal_uid,previous,current) values($1,$2,$3,$4::jsonb,$5::jsonb)',[userId,input.date,input.mealUid,old?JSON.stringify(old):null,JSON.stringify(result)]);
  await insertOutbox(c,'shopping.invalidate',userId,{date:input.date,mealUid:input.mealUid,selectionRevision:result.revision});
  return {revision:result.revision,optionId:input.optionId,versionId:input.versionId};
 });}
}
