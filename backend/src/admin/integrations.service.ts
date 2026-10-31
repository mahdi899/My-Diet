import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { Pool } from 'pg';
import { cert, initializeApp, deleteApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PG_POOL } from '../database/database.js';
import { ENV, type Env } from '../config/env.js';
import { encryptText, decryptText } from '../common/field-crypto.js';
import { uuidv7 } from '../common/id.js';
import { ApiError } from '../common/errors.js';
import { audit, withTransaction } from '../common/sql.js';
import { connectionSchema, campaignSchema } from './integration-validation.js';

@Injectable()
export class IntegrationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy=false;
  constructor(@Inject(PG_POOL) private readonly pool:Pool,@Inject(ENV) private readonly env:Env){}
  onModuleInit(){if(this.env.APP_ROLE==='api' && this.env.NODE_ENV!=='test')this.timer=setInterval(()=>{void this.dispatch().catch(()=>undefined);},15000);}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  async connections(){return (await this.pool.query(`select id,name,base_url as "baseUrl",model,active,cost_per_1k_tokens as "costPer1kTokens",created_at as "createdAt" from ai_connections order by created_at desc`)).rows;}
  async addConnection(actorId:string,body:unknown){
    const parsed=connectionSchema.safeParse(body);if(!parsed.success)throw new ApiError(400,'validation',parsed.error.issues[0]?.message||'تنظیمات درست نیست');
    const v=parsed.data,id=uuidv7();
    await withTransaction(this.pool,async c=>{
      await c.query('insert into ai_connections(id,name,base_url,model,api_key_encrypted,cost_per_1k_tokens) values($1,$2,$3,$4,$5,$6)',[id,v.name,v.baseUrl.replace(/\/$/,''),v.model,encryptText(JSON.stringify(v.apiKey),this.env.FIELD_KEY),v.costPer1kTokens]);
      await audit(c,actorId,'ai_connection_created','ai_connection',id,{});
    });return {id};
  }
  async activate(actorId:string,id:string,active:boolean){
    await withTransaction(this.pool,async c=>{
      await c.query("select pg_advisory_xact_lock(813441)");
      if(active)await c.query('update ai_connections set active=false where active');
      if(!(await c.query('update ai_connections set active=$2 where id=$1',[id,active])).rowCount)throw new ApiError(404,'not_found','سرویس پیدا نشد');
      await audit(c,actorId,'ai_connection_activation','ai_connection',id,{active});
    });return {ok:true};
  }
  async removeConnection(actorId:string,id:string){
    await withTransaction(this.pool,async c=>{if(!(await c.query('delete from ai_connections where id=$1',[id])).rowCount)throw new ApiError(404,'not_found','سرویس پیدا نشد');await audit(c,actorId,'ai_connection_deleted','ai_connection',id,{});});return {ok:true};
  }
  async firebase(){const row=(await this.pool.query("select value from app_settings where key='firebase_admin'")).rows[0];return row?JSON.parse(decryptText(row.value.encrypted,this.env.FIELD_KEY)):null;}
  async configureFirebase(actorId:string,body:unknown){
    const v=body as Record<string,unknown>;
    if(!v||typeof v.project_id!=='string'||typeof v.client_email!=='string'||typeof v.private_key!=='string'||!v.private_key.includes('BEGIN PRIVATE KEY'))throw new ApiError(400,'validation','فایل JSON حساب سرویس Firebase معتبر نیست');
    const account={projectId:v.project_id,clientEmail:v.client_email,privateKey:v.private_key};
    try{cert(account);}catch{throw new ApiError(400,'validation','کلید Firebase معتبر نیست');}
    await withTransaction(this.pool,async c=>{await c.query(`insert into app_settings(key,value) values('firebase_admin',$1::jsonb) on conflict(key) do update set value=excluded.value,version=app_settings.version+1,updated_at=now()`,[JSON.stringify({encrypted:encryptText(JSON.stringify(account),this.env.FIELD_KEY)})]);await audit(c,actorId,'firebase_configured','settings',null,{});});return {ok:true};
  }
  async pushStatus(){const config=await this.firebase();const counts=(await this.pool.query(`select (select count(*)::int from devices d join users u on u.id=d.user_id where d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user') as devices,(select count(*)::int from push_campaigns where status='scheduled' and deleted_at is null) as scheduled`)).rows[0];return {configured:!!config,projectId:config?.projectId??null,...counts};}
  async devices(){return(await this.pool.query(`select d.id,d.platform,u.display_name as "displayName",d.last_seen_at as "lastSeenAt" from devices d join users u on u.id=d.user_id where d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user' order by d.last_seen_at desc limit 500`)).rows;}
  async campaigns(){return(await this.pool.query(`select c.id,c.title,c.body,c.audience,c.device_id as "deviceId",c.status,c.scheduled_at as "scheduledAt",c.sent_at as "sentAt",c.created_at as "createdAt",count(d.device_id)::int as total,count(*) filter(where d.status='accepted')::int as accepted,count(*) filter(where d.status in ('failed','unknown'))::int as failed from push_campaigns c left join campaign_deliveries d on d.campaign_id=c.id where c.deleted_at is null group by c.id order by c.created_at desc limit 200`)).rows;}
  async createCampaign(actorId:string,body:unknown){const p=campaignSchema.safeParse(body);if(!p.success)throw new ApiError(400,'validation',p.error.issues[0]?.message||'اطلاعات اعلان درست نیست');const v=p.data,id=uuidv7();if(v.scheduledAt && Date.parse(v.scheduledAt)<=Date.now())throw new ApiError(400,'validation','زمان ارسال باید در آینده باشد');
    await withTransaction(this.pool,async c=>{if(v.audience==='device' && !(await c.query(`select d.id from devices d join users u on u.id=d.user_id where d.id=$1 and d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user'`,[v.deviceId])).rowCount)throw new ApiError(400,'validation','دستگاه واجد شرایط پیدا نشد');await c.query(`insert into push_campaigns(id,title,body,audience,device_id,scheduled_at,created_by) values($1,$2,$3,$4,$5,$6,$7)`,[id,v.title,v.body,v.audience,v.deviceId??null,v.scheduledAt??null,actorId]);await audit(c,actorId,'push_draft_created','push_campaign',id,{});});return {id};}
  async sendCampaign(actorId:string,id:string){if(!await this.firebase())throw new ApiError(409,'firebase_required','ابتدا Firebase را از تنظیمات متصل کنید');
    await withTransaction(this.pool,async c=>{const campaign=(await c.query("select * from push_campaigns where id=$1 and deleted_at is null for update",[id])).rows[0];if(!campaign)throw new ApiError(404,'not_found','اعلان پیدا نشد');if(campaign.status!=='draft')throw new ApiError(409,'conflict','این اعلان قبلاً در صف ارسال قرار گرفته است');
      await c.query(`insert into campaign_deliveries(campaign_id,device_id) select $1,d.id from devices d join users u on u.id=d.user_id where d.provider='fcm' and d.revoked_at is null and u.status='active' and u.role='user' and ($2::uuid is null or d.id=$2)`,[id,campaign.audience==='device'?campaign.device_id:null]);
      await c.query("update push_campaigns set status='scheduled',scheduled_at=coalesce(scheduled_at,now()) where id=$1",[id]);await audit(c,actorId,'push_queued','push_campaign',id,{});
    });return {ok:true};}
  async deleteCampaign(actorId:string,id:string){await withTransaction(this.pool,async c=>{if(!(await c.query("update push_campaigns set deleted_at=now() where id=$1 and status<>'sending' and deleted_at is null",[id])).rowCount)throw new ApiError(409,'conflict','اعلان موجود نیست یا در حال ارسال است');await audit(c,actorId,'push_deleted','push_campaign',id,{});});return {ok:true};}
  async dispatch(){
    if(this.busy)return;this.busy=true;const c=await this.pool.connect().catch(error=>{this.busy=false;throw error;});let locked=false;
    try{
      locked=(await c.query('select pg_try_advisory_lock(813442) as locked')).rows[0].locked;if(!locked)return;
      const config=await this.firebase();if(!config)return;
      const campaign=(await c.query(`select * from push_campaigns where deleted_at is null and ((status='scheduled' and scheduled_at<=now()) or status='sending') order by scheduled_at limit 1`)).rows[0];if(!campaign)return;
      await c.query("update push_campaigns set status='sending' where id=$1",[campaign.id]);
      // A crash after sending leaves an ambiguous result; do not send that device twice.
      await c.query("update campaign_deliveries set status='unknown',error_code='interrupted' where campaign_id=$1 and status='sending'",[campaign.id]);
      const app=initializeApp({credential:cert(config as ServiceAccount)},'campaign-'+uuidv7());
      try{
        const deliveries=(await c.query(`select t.device_id,d.push_token,d.revoked_at,u.status as user_status from campaign_deliveries t join devices d on d.id=t.device_id join users u on u.id=d.user_id where t.campaign_id=$1 and t.status='pending' limit 100`,[campaign.id])).rows;
        for(const d of deliveries){
          if(d.revoked_at||d.user_status!=='active'){await c.query("update campaign_deliveries set status='failed',error_code='ineligible' where campaign_id=$1 and device_id=$2",[campaign.id,d.device_id]);continue;}
          await c.query("update campaign_deliveries set status='sending' where campaign_id=$1 and device_id=$2",[campaign.id,d.device_id]);
          try{await getMessaging(app).send({token:d.push_token,notification:{title:campaign.title,body:campaign.body},data:{campaignId:campaign.id}});await c.query("update campaign_deliveries set status='accepted' where campaign_id=$1 and device_id=$2",[campaign.id,d.device_id]);}
          catch(error){const code=typeof (error as {code?:unknown}).code==='string'?(error as {code:string}).code.slice(0,100):'send_failed';await c.query("update campaign_deliveries set status='failed',error_code=$3 where campaign_id=$1 and device_id=$2",[campaign.id,d.device_id,code]);}
        }
      }finally{await deleteApp(app);}
      await c.query(`update push_campaigns set status=case when exists(select 1 from campaign_deliveries where campaign_id=$1 and status='accepted') then 'completed' else 'failed' end,sent_at=now() where id=$1 and not exists(select 1 from campaign_deliveries where campaign_id=$1 and status='pending')`,[campaign.id]);
    }finally{if(locked)await c.query('select pg_advisory_unlock(813442)');c.release();this.busy=false;}
  }
}
