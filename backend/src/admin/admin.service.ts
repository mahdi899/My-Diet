import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { ApiError } from '../common/errors.js';
import { decryptText } from '../common/field-crypto.js';
import { uuidv7 } from '../common/id.js';
import { audit, toman, withTransaction, type Queryable } from '../common/sql.js';
import { tehranDayStartUtc, tehranToday } from '../common/time.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import { loadUserIntake, rememberDemoIdentities } from './user-intake.js';
import { OUTBOX_MAX_ATTEMPTS } from '../jobs/outbox-policy.js';
import { debitFits, signedAdjustment } from './adjustment.js';
import {
  verificationAfterCouncilChange,
  type VerificationStatus,
} from './profile.js';

@Injectable()
export class AdminService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async aiExecutions() {
    return (await this.pool.query(`select request_id as "requestId",status,started_at as "startedAt",
      finished_at as "finishedAt",error_code as "errorCode" from ai_execution_claims order by started_at desc limit 100`)).rows;
  }

  async reconcileAi(actorId:string,requestId:string,costMicros:number,reason:string) {
    if(!Number.isSafeInteger(costMicros)||costMicros<0||reason.trim().length<3)throw new ApiError(400,'validation','هزینه و دلیل بررسی معتبر نیست');
    return withTransaction(this.pool,async client=>{
      const claim=(await client.query("select * from ai_execution_claims where request_id=$1 and status='failed' for update",[requestId])).rows[0];
      if(!claim || claim.error_code==='reconciled')throw new ApiError(409,'conflict','تلاش نامشخصی برای بررسی وجود ندارد');
      await client.query(`update ai_generations set cost_micros=$2 where id=(select id from ai_generations
        where request_id=$1 and status='failed' order by created_at desc limit 1)`,[requestId,costMicros]);
      await client.query("update ai_execution_claims set error_code='reconciled' where request_id=$1",[requestId]);
      await audit(client,actorId,'ai_cost_reconciled','plan_request',requestId,{costMicros,reason,previousError:claim.error_code});
      return {ok:true};
    });
  }

  async dashboard(adminId: string) {
    const today = tehranDayStartUtc();
    const result = await this.pool.query(`select
      (select count(*)::int from users where role='user' and status <> 'deleted') as users,
      (select count(*)::int from users where role='user' and status <> 'deleted' and created_at >= $1::timestamptz - interval '7 days') as new_users,
      (select coalesce(sum(amount_toman),0)::text from payments where status='credited' and created_at >= now()-interval '30 days') as revenue,
      (select count(*)::int from payments where status='credited' and created_at >= now()-interval '30 days') as paid_orders,
      (select count(*)::int from ai_generations where created_at >= $1::timestamptz and created_at < $1::timestamptz + interval '1 day') as ai_today,
      (select count(*)::int from messages m join conversations c on c.id=m.conversation_id
       left join conversation_participants cp on cp.conversation_id=c.id and cp.user_id=$2
       where c.kind='support' and m.author_id<>$2 and m.created_at>coalesce(cp.last_read_at,'-infinity'::timestamptz)) as unread`, [today,adminId]);
    const row=result.rows[0]!;
    return { users: row.users, newUsers: row.new_users, revenueToman: toman(row.revenue), paidOrders: row.paid_orders, aiToday: row.ai_today, unreadMessages: row.unread };
  }

  async orders(limit = 100) {
    const result = await this.pool.query(`select o.id,u.display_name,u.phone_e164,o.service_code,o.price_toman,o.status,o.created_at
      from orders o join users u on u.id=o.user_id order by o.created_at desc,o.id desc limit $1`, [limit]);
    return result.rows.map(row=>({id:row.id,user:row.display_name || row.phone_e164,serviceCode:row.service_code,amountToman:toman(row.price_toman),status:row.status,createdAt:row.created_at.toISOString()}));
  }

  async createSpecialist(actorId: string, input: {
    phoneE164: string;
    displayName: string;
    credential: string;
    bio: string;
    capacity: number;
    councilNo?: string;
    birthDate?: string | null;
    education?: string;
    portrait?: string;
    username?: string;
    passwordHash?: string;
  }) {
    const existing = await this.pool.query(`select id from users where phone_e164 = $1`, [input.phoneE164]);
    if ((existing.rowCount ?? 0) > 0) {
      throw new ApiError(409, 'phone_taken', 'این شماره قبلاً ثبت شده است');
    }
    const id = uuidv7();
    const conversationId = uuidv7();
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `insert into users (id, phone_e164, role, display_name, status) values ($1, $2, 'specialist', $3, 'active')`,
        [id, input.phoneE164, input.displayName],
      );
      await client.query(`insert into wallets (user_id) values ($1)`, [id]);
      if (input.councilNo) {
        const taken = await client.query(
          `select user_id from specialist_profiles where medical_council_no = $1`,
          [input.councilNo],
        );
        if ((taken.rowCount ?? 0) > 0) throw new ApiError(409, 'council_taken', 'این شمارهٔ نظام قبلاً ثبت شده است');
      }
      await client.query(
        `insert into specialist_profiles
           (user_id, display_name, credential, bio, capacity, medical_council_no, birth_date, education, portrait)
         values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9)`,
        [id, input.displayName, input.credential, input.bio, input.capacity, input.councilNo ?? '', input.birthDate ?? null, input.education ?? '', input.portrait ?? ''],
      );
      if (input.username && input.passwordHash) {
        const takenName = await client.query(
          `select 1 from admin_credentials where lower(username) = $1
           union all
           select 1 from specialist_credentials where username = $1`,
          [input.username],
        );
        if ((takenName.rowCount ?? 0) > 0) throw new ApiError(409, 'username_taken', 'این نام کاربری قبلاً ثبت شده است');
        await client.query(
          `insert into specialist_credentials (user_id, username, password_hash) values ($1, $2, $3)`,
          [id, input.username, input.passwordHash],
        );
      }
      await client.query(
        `insert into conversations (id, kind, user_id) values ($1, 'support', $2)`,
        [conversationId, id],
      );
      await client.query(
        `insert into conversation_participants (conversation_id, user_id) values ($1, $2)`,
        [conversationId, id],
      );
      await audit(client, actorId, 'specialist_created', 'user', id, { capacity: input.capacity });
    });
    return { id };
  }

  async updateSpecialist(actorId: string, specialistId: string, input: {
    active?: boolean;
    capacity?: number;
    displayName?: string;
    credential?: string;
    bio?: string;
  }) {
    return withTransaction(this.pool, async (client) => {
    const current = await client.query(`select user_id from specialist_profiles where user_id = $1 for update`, [specialistId]);
    if (current.rowCount === 0) throw new ApiError(404, 'not_found', 'متخصص پیدا نشد');
    await client.query(
      `update specialist_profiles
       set active = coalesce($2, active),
           capacity = coalesce($3, capacity),
           display_name = coalesce($4, display_name),
           credential = coalesce($5, credential),
           bio = coalesce($6, bio)
       where user_id = $1`,
      [specialistId, input.active ?? null, input.capacity ?? null, input.displayName ?? null, input.credential ?? null, input.bio ?? null],
    );
    await audit(client, actorId, 'specialist_updated', 'user', specialistId, input);
    if (input.active === false) {
      await client.query(
        `delete from conversation_participants cp using conversations c
         where cp.conversation_id=c.id and c.kind='care' and cp.user_id=$1`, [specialistId],
      );
      await client.query(
        `update plan_requests
         set assigned_specialist_id = null, updated_at = now()
         where assigned_specialist_id = $1
           and status in ('queued', 'generating', 'in_review', 'awaiting_user', 'response_received')`,
        [specialistId],
      );
    }
    return { ok: true };
    });
  }

  async ownProfile(specialistId: string) {
    const row = await this.profileRow(specialistId);
    if (!row) throw new ApiError(404, 'not_found', 'پروندهٔ متخصص پیدا نشد');
    return this.profileView(row);
  }

  async updateOwnProfile(
    specialistId: string,
    input: { displayName?: string; credential?: string; bio?: string; councilNo?: string },
  ) {
    if (
      input.displayName == null &&
      input.credential == null &&
      input.bio == null &&
      input.councilNo == null
    ) {
      throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }
    const current = await this.profileRow(specialistId);
    if (!current) throw new ApiError(404, 'not_found', 'پروندهٔ متخصص پیدا نشد');
    const councilNo = input.councilNo ?? current.medical_council_no;
    if (councilNo !== '' && councilNo !== current.medical_council_no) {
      const taken = await this.pool.query(
        `select user_id from specialist_profiles where medical_council_no = $1 and user_id <> $2`,
        [councilNo, specialistId],
      );
      if ((taken.rowCount ?? 0) > 0) throw new ApiError(409, 'council_taken', 'این شمارهٔ نظام قبلاً ثبت شده است');
    }
    const verification = verificationAfterCouncilChange(
      current.medical_council_no,
      input.councilNo,
      current.verification_status,
    );
    await this.pool.query(
      `update specialist_profiles
       set display_name = $2, credential = $3, bio = $4, medical_council_no = $5, verification_status = $6
       where user_id = $1`,
      [
        specialistId,
        input.displayName ?? current.display_name,
        input.credential ?? current.credential,
        input.bio ?? current.bio,
        councilNo,
        verification,
      ],
    );
    await audit(this.pool, specialistId, 'specialist_profile_updated', 'user', specialistId, {
      councilChanged: input.councilNo != null && input.councilNo !== current.medical_council_no,
      verificationStatus: verification,
    });
    return this.profileView({
      ...current,
      display_name: input.displayName ?? current.display_name,
      credential: input.credential ?? current.credential,
      bio: input.bio ?? current.bio,
      medical_council_no: councilNo,
      verification_status: verification,
    });
  }

  async setVerification(actorId: string, specialistId: string, status: VerificationStatus) {
    const result = await this.pool.query(
      `update specialist_profiles set verification_status = $2 where user_id = $1 returning user_id`,
      [specialistId, status],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'متخصص پیدا نشد');
    await audit(this.pool, actorId, 'specialist_verification', 'user', specialistId, { status });
    return { id: specialistId, verificationStatus: status };
  }

  private async profileRow(specialistId: string) {
    const rows = await this.pool.query<{
      display_name: string;
      credential: string;
      bio: string;
      medical_council_no: string;
      verification_status: VerificationStatus;
      active: boolean;
    }>(
      `select display_name, credential, bio, medical_council_no, verification_status, active
       from specialist_profiles where user_id = $1`,
      [specialistId],
    );
    return rows.rows[0];
  }

  private profileView(row: {
    display_name: string;
    credential: string;
    bio: string;
    medical_council_no: string;
    verification_status: VerificationStatus;
    active: boolean;
  }) {
    return {
      displayName: row.display_name,
      credential: row.credential,
      bio: row.bio,
      councilNo: row.medical_council_no,
      verificationStatus: row.verification_status,
      active: row.active,
    };
  }

  async assign(actorId: string, requestId: string, specialistId: string, reason: string) {
    return withTransaction(this.pool, async (client) => {
    const specialist = await client.query(
      `select p.user_id from specialist_profiles p join users u on u.id=p.user_id
       where p.user_id = $1 and p.active=true and p.verification_status='verified'
         and u.status='active' and u.role='specialist' for update of p`,
      [specialistId],
    );
    if (specialist.rowCount === 0) throw new ApiError(404, 'not_found', 'متخصص پیدا نشد');
    const request = await client.query(`select id, assigned_specialist_id from plan_requests where id = $1 for update`, [requestId]);
    if (request.rowCount === 0) throw new ApiError(404, 'not_found', 'درخواست پیدا نشد');
    await client.query(
      `update plan_requests set assigned_specialist_id = $2, updated_at = now() where id = $1`,
      [requestId, specialistId],
    );
    await client.query(
      `delete from conversation_participants cp using conversations c, users u
       where cp.conversation_id=c.id and cp.user_id=u.id and c.request_id=$1
         and c.kind='care' and u.role='specialist' and cp.user_id<>$2`,
      [requestId, specialistId],
    );
    await client.query(
      `insert into conversation_participants (conversation_id, user_id)
       select id, $2 from conversations where request_id = $1 and kind = 'care'
       on conflict do nothing`,
      [requestId, specialistId],
    );
    await client.query(
      `insert into health_access_logs (id, actor_id, request_id, reason) values ($1, $2, $3, $4)`,
      [uuidv7(), actorId, requestId, reason],
    );
    await audit(client, actorId, 'request_assigned', 'plan_request', requestId, {
      previousSpecialistId: request.rows[0].assigned_specialist_id, specialistId, reason,
    });
    return { ok: true };
    });
  }

  async setPrice(actorId: string, serviceCode: string, amountToman: number) {
    if (!Number.isSafeInteger(amountToman) || amountToman <= 0 || amountToman > 100_000_000) {
      throw new ApiError(400, 'validation', 'مبلغ درست نیست');
    }
    const known = await this.pool.query(`select code from services where code = $1`, [serviceCode]);
    if (known.rowCount === 0) throw new ApiError(404, 'not_found', 'خدمت پیدا نشد');
    await this.pool.query(
      `insert into service_prices (id, service_code, amount_toman) values ($1, $2, $3)`,
      [uuidv7(), serviceCode, amountToman],
    );
    await audit(this.pool, actorId, 'price_changed', 'service', null, { serviceCode, amountToman });
    return { serviceCode, amountToman };
  }

  async setReward(actorId: string, amountToman: number) {
    if (!Number.isSafeInteger(amountToman) || amountToman <= 0 || amountToman > 100_000_000) {
      throw new ApiError(400, 'validation', 'مبلغ درست نیست');
    }
    await this.pool.query(
      `update reward_policies set amount_toman = $1 where kind = 'weekly_completion'`,
      [amountToman],
    );
    await this.pool.query(
      `update app_settings set value = to_jsonb($1::int), version = version + 1, updated_at = now()
       where key = 'reward.weekly_completion_toman'`,
      [amountToman],
    );
    await audit(this.pool, actorId, 'reward_changed', 'reward_policy', null, { amountToman });
    return { amountToman };
  }

  async moderateReview(actorId: string, reviewId: string, status: 'approved' | 'rejected') {
    const result = await this.pool.query(
      `update program_reviews set status = $2 where id = $1 returning id`,
      [reviewId, status],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'نظر پیدا نشد');
    await audit(this.pool, actorId, 'review_moderated', 'program_review', reviewId, { status });
    return { id: reviewId, status };
  }

  async ledger(userId?: string) {
    const rows = await this.pool.query<{
      id: string;
      user_id: string;
      bucket: string;
      amount_toman: string;
      kind: string;
      reference_id: string;
      created_at: Date;
    }>(
      `select id, user_id, bucket, amount_toman, kind, reference_id, created_at
       from wallet_ledger
       where ($1::uuid is null or user_id = $1)
       order by created_at desc
       limit 100`,
      [userId ?? null],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      bucket: row.bucket,
      amountToman: toman(row.amount_toman),
      kind: row.kind,
      referenceId: row.reference_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async payments() {
    const rows = await this.pool.query<{
      id: string;
      user_name: string;
      package_code: string;
      amount_toman: string;
      status: string;
      created_at: Date;
    }>(
      `select p.id, coalesce(nullif(u.display_name, ''), u.phone_e164) as user_name,
              p.package_code, p.amount_toman, p.status, p.created_at
       from payments p
       join users u on u.id = p.user_id
       order by p.created_at desc, p.id desc
       limit 100`,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      user: row.user_name,
      packageCode: row.package_code,
      amountToman: toman(row.amount_toman),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async reviews(status: 'pending' | 'approved' | 'rejected') {
    const rows = await this.pool.query<{
      id: string;
      user_id: string;
      request_id: string;
      week_start: string;
      rating: number;
      body: string;
      status: string;
    }>(
      `select id, user_id, request_id, week_start::text as week_start, rating, body, status
       from program_reviews where status = $1
       order by created_at desc
       limit 50`,
      [status],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      requestId: row.request_id,
      weekStart: row.week_start,
      rating: row.rating,
      body: row.body,
      status: row.status,
    }));
  }

  async auditLogs() {
    const rows = await this.pool.query<{
      id: string;
      actor_id: string | null;
      action: string;
      target_type: string;
      target_id: string | null;
      created_at: Date;
    }>(
      `select id, actor_id, action, target_type, target_id, created_at
       from audit_logs order by created_at desc limit 100`,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async aiGenerations() {
    const rows = await this.pool.query<{
      id: string;
      request_id: string;
      provider: string;
      status: string;
      skipped_reason: string | null;
      created_at: Date;
    }>(
      `select id, request_id, provider, status, skipped_reason, created_at
       from ai_generations order by created_at desc limit 100`,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      provider: row.provider,
      status: row.status,
      skippedReason: row.skipped_reason,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async userDetail(userId: string) {
    const rows = await this.pool.query<{
      id: string;
      phone_e164: string;
      role: string;
      display_name: string | null;
      status: string;
      created_at: Date;
    }>(
      `select id, phone_e164, role, display_name, status, created_at from users where id = $1`,
      [userId],
    );
    const user = rows.rows[0];
    if (!user) throw new ApiError(404, 'not_found', 'کاربر پیدا نشد');
    const intake = await loadUserIntake(this.pool, this.env, userId);
    const details = await this.pool.query<{ details_encrypted: string }>(
      'select details_encrypted from user_personal_details where user_id = $1', [userId],
    );
    const personalDetails = details.rows[0]
      ? JSON.parse(decryptText(details.rows[0].details_encrypted, this.env.FIELD_KEY))
      : null;
    return {
      id: user.id,
      phone: user.phone_e164,
      role: user.role,
      displayName: personalDetails?.name ?? intake?.displayName ?? user.display_name,
      personalDetails,
      status: user.status,
      createdAt: user.created_at.toISOString(),
      intake: intake
        ? {
            trackId: intake.trackId,
            trackLabel: intake.trackLabel,
            source: intake.source,
            answers: intake.answers,
          }
        : null,
    };
  }

  async requests() {
    const rows = await this.pool.query<{
      id: string;
      user_id: string;
      status: string;
      kind: string;
      created_at: Date;
    }>(
      `select id, user_id, status, kind, created_at from plan_requests
       order by created_at desc limit 100`,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      kind: row.kind,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async supportConversations() {
    const rows = await this.pool.query<{ id: string; user_id: string; created_at: Date }>(
      `select id, user_id, created_at from conversations
       where kind = 'support'
       order by created_at desc
       limit 100`,
    );
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async saveDailyMessage(actorId: string, date: string, body: string) {
    await this.pool.query(
      `insert into daily_messages (civil_date, body) values ($1::date, $2)
       on conflict (civil_date) do update set body = excluded.body, updated_at = now()`,
      [date, body],
    );
    await audit(this.pool, actorId, 'daily_message', 'daily_message', null, { date });
    return { date, body };
  }

  async dailyMessage(date: string) {
    const rows = await this.pool.query<{ body: string }>(
      `select body from daily_messages where civil_date = $1::date`,
      [date],
    );
    return { date, body: rows.rows[0]?.body ?? null };
  }

  async users() {
    const rows = await this.pool.query<{
      id: string;
      phone_e164: string;
      role: string;
      status: string;
      display_name: string | null;
      signup_channel: string;
      profile_source: string | null;
      campaign_name: string | null;
      campaign_source: string | null;
      package_title: string | null;
      ends_at: Date | null;
      details_encrypted: string | null;
    }>(
      `select u.id, u.phone_e164, u.role, u.status, u.display_name, u.signup_channel,
              p.source as profile_source,
              c.name as campaign_name, c.source as campaign_source,
              coalesce(s.title_fa, ordered.title_fa) as package_title,
              a.ends_at, pd.details_encrypted
       from users u
       left join user_personal_details pd on pd.user_id = u.id
       left join nutrition_profiles p on p.user_id = u.id
       left join demo_campaign_links c on c.slug = u.signup_channel
       left join lateral (
         select sv.title_fa
         from orders o
         join services sv on sv.code = o.service_code
         where o.user_id = u.id and o.status = 'paid'
         order by o.created_at desc
         limit 1
       ) ordered on true
       left join user_service_access a on a.user_id = u.id
       left join services s on s.code = a.service_code
       where u.role = 'user' and u.status <> 'deleted'
       order by u.created_at desc
       limit 200`,
    );
    const identities = await rememberDemoIdentities(
      this.pool,
      this.env,
      rows.rows.map((row) => ({ id: row.id, phone: row.phone_e164, displayName: row.display_name })),
    );
    return rows.rows.map((row) => {
      const identity = identities.get(row.id);
      const label = registrationLabel(row);
      return {
        id: row.id,
        phone: row.phone_e164,
        role: row.role,
        status: row.status,
        displayName: identity?.displayName ?? row.display_name,
        photo: row.details_encrypted
          ? JSON.parse(decryptText(row.details_encrypted, this.env.FIELD_KEY)).photo ?? null
          : null,
        registrationLabel: identity?.fromDemo && label === 'اپلیکیشن' ? 'آنبوردینگ وب' : label,
        packageTitle: row.package_title,
        daysRemaining: row.ends_at == null ? null : remainingDays(row.ends_at),
      };
    });
  }

  async setStatus(actorId: string, userId: string, status: 'active' | 'suspended' | 'pending') {
    const current = await this.pool.query<{ role: string; status: string }>(
      `select role, status from users where id = $1`,
      [userId],
    );
    const user = current.rows[0];
    if (!user) throw new ApiError(404, 'not_found', 'کاربر پیدا نشد');
    if (user.role === 'admin') throw new ApiError(403, 'forbidden', 'وضعیت حساب مدیریت از اینجا عوض نمی‌شود');
    if (user.status === 'deleted') throw new ApiError(409, 'account_deleted', 'این حساب حذف شده است');
    await this.pool.query(`update users set status = $2 where id = $1`, [userId, status]);
    await audit(this.pool, actorId, 'user_status', 'user', userId, { status });
    return { id: userId, status };
  }

  async deleteUser(actorId: string, userId: string) {
    if (actorId === userId) throw new ApiError(403, 'forbidden', 'حذف حساب خودتان از این فهرست ممکن نیست');
    return withTransaction(this.pool, async (client) => {
      const current = await client.query<{ role: string }>(
        `select role from users where id = $1 for update`,
        [userId],
      );
      const user = current.rows[0];
      if (!user) throw new ApiError(404, 'not_found', 'کاربر پیدا نشد');
      if (user.role === 'admin') throw new ApiError(403, 'forbidden', 'حساب مدیریت از اینجا حذف نمی‌شود');
      await audit(client, actorId, 'user_delete', 'user', userId, { purged: true });
      await purgeUser(client, userId);
      return { deleted: true };
    });
  }

  async setPackageDays(actorId: string, userId: string, daysRemaining: number) {
    if (!Number.isSafeInteger(daysRemaining) || daysRemaining < 0 || daysRemaining > 3650) {
      throw new ApiError(400, 'validation', 'تعداد روز درست نیست');
    }
    return withTransaction(this.pool, async (client) => {
      const user = await client.query<{ status: string }>(`select status from users where id = $1 for update`, [userId]);
      if (!user.rows[0]) throw new ApiError(404, 'not_found', 'کاربر پیدا نشد');
      if (user.rows[0].status === 'deleted') throw new ApiError(409, 'account_deleted', 'این حساب حذف شده است');
      const service = await client.query<{ code: string; title_fa: string }>(
        `select code, title_fa from (
           select s.code, s.title_fa, 0 as rank
           from user_service_access a
           join services s on s.code = a.service_code
           where a.user_id = $1
           union all
           select s.code, s.title_fa, 1 as rank
           from orders o
           join services s on s.code = o.service_code
           where o.user_id = $1 and o.status = 'paid'
           union all
           select code, title_fa, 2 as rank from services where code = 'new_plan'
         ) choices
         order by rank
         limit 1`,
        [userId],
      );
      const chosen = service.rows[0];
      if (!chosen) throw new ApiError(409, 'conflict', 'خدمتی برای این پکیج ثبت نشده است');
      await client.query(`update users set status = 'active' where id = $1 and role = 'user'`, [userId]);
      await client.query(
        `insert into user_service_access (user_id, service_code, ends_at)
         values ($1, $2, now() + make_interval(days => $3))
         on conflict (user_id) do update
           set service_code = excluded.service_code, ends_at = excluded.ends_at, updated_at = now()`,
        [userId, chosen.code, daysRemaining],
      );
      await audit(client, actorId, 'user_package_days', 'user', userId, { daysRemaining, serviceCode: chosen.code });
      return { id: userId, packageTitle: chosen.title_fa, daysRemaining };
    });
  }

  async adminSpecialists() {
    const rows = await this.pool.query<{
      user_id: string;
      display_name: string;
      phone_e164: string;
      credential: string;
      bio: string;
      education: string;
      medical_council_no: string;
      birth_date: string | null;
      portrait: string;
      username: string | null;
      average: string | null;
      reviews: number;
    }>(
      `select sp.user_id, sp.display_name, u.phone_e164, sp.credential, sp.bio, sp.education,
              sp.medical_council_no, sp.birth_date, sp.portrait, sc.username,
              (select round(avg(pr.rating)::numeric, 2)
               from program_reviews pr
               join plan_requests r on r.id = pr.request_id
               where r.assigned_specialist_id = sp.user_id and pr.status = 'approved') as average,
              (select count(*)::int
               from program_reviews pr
               join plan_requests r on r.id = pr.request_id
               where r.assigned_specialist_id = sp.user_id and pr.status = 'approved') as reviews
       from specialist_profiles sp
       join users u on u.id = sp.user_id
       left join specialist_credentials sc on sc.user_id = sp.user_id
       where u.status <> 'deleted'
       order by sp.display_name`,
    );
    return rows.rows.map((row) => ({
      id: row.user_id,
      displayName: row.display_name,
      phone: row.phone_e164,
      credential: row.credential,
      bio: row.bio,
      education: row.education || row.credential,
      councilNo: row.medical_council_no,
      birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : null,
      portrait: row.portrait || null,
      username: row.username,
      averageRating: row.average == null ? null : Number(row.average),
      reviewCount: row.reviews,
    }));
  }

  async publicSpecialists() {
    const rows = await this.pool.query<{
      user_id: string;
      display_name: string;
      credential: string;
      bio: string;
      average: string | null;
      reviews: number;
    }>(
      `select sp.user_id, sp.display_name, sp.credential, sp.bio,
              (select round(avg(pr.rating)::numeric, 2)
               from program_reviews pr
               join plan_requests r on r.id = pr.request_id
               where r.assigned_specialist_id = sp.user_id and pr.status = 'approved') as average,
              (select count(*)::int
               from program_reviews pr
               join plan_requests r on r.id = pr.request_id
               where r.assigned_specialist_id = sp.user_id and pr.status = 'approved') as reviews
       from specialist_profiles sp
       where sp.active = true
       order by sp.display_name`,
    );
    return rows.rows.map((row) => ({
      id: row.user_id,
      displayName: row.display_name,
      credential: row.credential,
      bio: row.bio,
      averageRating: row.average == null ? null : Number(row.average),
      reviewCount: row.reviews,
    }));
  }

  async aiControls() {
    const row = await this.controlRow();
    return {
      killSwitch: row.kill_switch,
      dailyCostCapMicros: row.daily_cost_cap_micros == null ? null : Number(row.daily_cost_cap_micros),
    };
  }

  async setAiControls(
    actorId: string,
    input: { killSwitch?: boolean; dailyCostCapMicros?: number | null },
  ) {
    if (input.killSwitch == null && input.dailyCostCapMicros === undefined) {
      throw new ApiError(400, 'validation', 'اطلاعات واردشده ناقص یا نادرست است');
    }
    if (
      input.dailyCostCapMicros != null &&
      (!Number.isSafeInteger(input.dailyCostCapMicros) || input.dailyCostCapMicros < 0)
    ) {
      throw new ApiError(400, 'validation', 'سقف هزینه درست نیست');
    }
    const current = await this.controlRow();
    const killSwitch = input.killSwitch ?? current.kill_switch;
    const cap = input.dailyCostCapMicros === undefined ? current.daily_cost_cap_micros : input.dailyCostCapMicros;
    await this.pool.query(
      `update ai_controls set kill_switch = $1, daily_cost_cap_micros = $2, updated_at = now() where id = true`,
      [killSwitch, cap],
    );
    await audit(this.pool, actorId, 'ai_controls_updated', 'ai_controls', null, {
      killSwitch,
      dailyCostCapMicros: cap,
    });
    return { killSwitch, dailyCostCapMicros: cap == null ? null : Number(cap) };
  }

  async aiCost() {
    const controls = await this.controlRow();
    const totals = await this.pool.query<{ attempts: number; drafted: number; skipped: number; spent: string }>(
      `select count(*)::int as attempts,
              count(*) filter (where status = 'drafted')::int as drafted,
              count(*) filter (where status = 'skipped')::int as skipped,
              coalesce(sum(cost_micros), 0)::text as spent
       from ai_generations
       where created_at >= $1`,
      [tehranDayStartUtc()],
    );
    const row = totals.rows[0];
    return {
      day: tehranToday(),
      spentMicros: Number(row?.spent ?? 0),
      capMicros: controls.daily_cost_cap_micros == null ? null : Number(controls.daily_cost_cap_micros),
      killSwitch: controls.kill_switch,
      attempts: row?.attempts ?? 0,
      drafted: row?.drafted ?? 0,
      skipped: row?.skipped ?? 0,
    };
  }

  private async controlRow() {
    const rows = await this.pool.query<{ kill_switch: boolean; daily_cost_cap_micros: string | null }>(
      `select kill_switch, daily_cost_cap_micros::text as daily_cost_cap_micros from ai_controls where id = true`,
    );
    const row = rows.rows[0];
    if (!row) throw new ApiError(500, 'ai_controls_missing', 'تنظیم مدل پیدا نشد');
    return row;
  }

  async adjustCash(
    actorId: string,
    input: {
      userId: string;
      amountToman: number;
      direction: 'debit' | 'credit';
      reason: string;
      referenceId: string;
    },
  ) {
    if (!Number.isSafeInteger(input.amountToman) || input.amountToman <= 0 || input.amountToman > 100_000_000) {
      throw new ApiError(400, 'validation', 'مبلغ درست نیست');
    }
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      throw new ApiError(400, 'validation', 'دلیل اصلاح را بنویسید');
    }
    const signed = signedAdjustment(input.direction, input.amountToman);
    return withTransaction(this.pool, async (client) => {
      const wallet = await client.query<{ cash_toman: string; promo_toman: string }>(
        `select cash_toman, promo_toman from wallets where user_id = $1 for update`,
        [input.userId],
      );
      const held = wallet.rows[0];
      if (!held) throw new ApiError(404, 'not_found', 'کیف پول پیدا نشد');
      const existing = await client.query<{ user_id: string; amount_toman: string }>(
        `select user_id, amount_toman from wallet_ledger
         where kind = 'adjustment' and reference_id = $1 and bucket = 'cash'`,
        [input.referenceId],
      );
      const prior = existing.rows[0];
      if (prior) {
        if (prior.user_id !== input.userId || Number(prior.amount_toman) !== signed) {
          throw new ApiError(409, 'adjustment_conflict', 'این شناسه قبلاً برای اصلاح دیگری استفاده شده است');
        }
        return this.adjustmentResult(held, input);
      }
      if (input.direction === 'debit' && !debitFits(Number(held.cash_toman), input.amountToman)) {
        throw new ApiError(402, 'insufficient_funds', 'موجودی نقدی کافی نیست');
      }
      await client.query(
        `update wallets set cash_toman = cash_toman + $2, version = version + 1 where user_id = $1`,
        [input.userId, signed],
      );
      await client.query(
        `insert into wallet_ledger (id, user_id, bucket, amount_toman, kind, reference_id)
         values ($1, $2, 'cash', $3, 'adjustment', $4)`,
        [uuidv7(), input.userId, signed, input.referenceId],
      );
      const next = await client.query<{ cash_toman: string; promo_toman: string }>(
        `select cash_toman, promo_toman from wallets where user_id = $1`,
        [input.userId],
      );
      await audit(client, actorId, 'wallet_adjusted', 'wallet', input.userId, {
        direction: input.direction,
        amountToman: input.amountToman,
        referenceId: input.referenceId,
        reason,
      });
      return this.adjustmentResult(next.rows[0] ?? held, input);
    });
  }

  async deadLetters() {
    const rows = await this.pool.query<{ id: string; topic: string; attempts: number; created_at: Date }>(
      `select id, topic, attempts, created_at
       from outbox_events
       where dispatched_at is null and attempts >= $1
       order by created_at
       limit 100`,
      [OUTBOX_MAX_ATTEMPTS],
    );
    return {
      events: rows.rows.map((row) => ({
        id: row.id,
        topic: row.topic,
        attempts: row.attempts,
        createdAt: row.created_at.toISOString(),
      })),
    };
  }

  async retryDeadLetter(actorId: string, id: string) {
    const updated = await this.pool.query(
      `update outbox_events set attempts = 0
       where id = $1 and dispatched_at is null and attempts >= $2
       returning id`,
      [id, OUTBOX_MAX_ATTEMPTS],
    );
    if ((updated.rowCount ?? 0) === 0) throw new ApiError(404, 'not_found', 'رویداد مرده پیدا نشد');
    await audit(this.pool, actorId, 'outbox_retried', 'outbox_event', id, {});
    return { id, attempts: 0 };
  }

  private adjustmentResult(
    wallet: { cash_toman: string; promo_toman: string },
    input: { userId: string; amountToman: number; direction: 'debit' | 'credit'; referenceId: string },
  ) {
    return {
      userId: input.userId,
      direction: input.direction,
      amountToman: input.amountToman,
      referenceId: input.referenceId,
      cashToman: toman(wallet.cash_toman),
      promoToman: toman(wallet.promo_toman),
    };
  }
}

const channelNames: Record<string, string> = {
  telegram: 'تلگرام',
  instagram: 'اینستاگرام',
  whatsapp: 'واتساپ',
  rubika: 'روبیکا',
  eitaa: 'ایتا',
  website: 'وب‌سایت',
  app: 'اپلیکیشن',
};

function registrationLabel(row: {
  signup_channel: string;
  profile_source: string | null;
  campaign_name: string | null;
  campaign_source: string | null;
}) {
  if (row.campaign_name) {
    const source = channelNames[row.campaign_source ?? ''] ?? row.campaign_source;
    return source ? `${row.campaign_name} · ${source}` : row.campaign_name;
  }
  if (row.profile_source === 'demo' || row.signup_channel === 'demo') return 'آنبوردینگ وب';
  return 'اپلیکیشن';
}

function remainingDays(endsAt: Date) {
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000));
}

type ForeignKey = {
  child: string;
  parent: string;
  childCols: string[];
  parentCols: string[];
  nullable: boolean;
};

function ident(name: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('unsafe identifier');
  return `"${name}"`;
}

function pgTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return [];
}

async function purgeUser(client: Queryable, userId: string) {
  const keys = await client.query<{
    child: string;
    parent: string;
    child_cols: string[];
    parent_cols: string[];
    nullable: boolean;
  }>(
    `select child.relname as child, parent.relname as parent,
            array_agg(att.attname order by ck.ord) as child_cols,
            array_agg(patt.attname order by ck.ord) as parent_cols,
            bool_and(not att.attnotnull) as nullable
     from pg_constraint c
     join pg_class child on child.oid = c.conrelid
     join pg_class parent on parent.oid = c.confrelid
     join pg_namespace n on n.oid = child.relnamespace
     join lateral unnest(c.conkey) with ordinality as ck(attnum, ord) on true
     join pg_attribute att on att.attrelid = child.oid and att.attnum = ck.attnum
     join lateral unnest(c.confkey) with ordinality as pk(attnum, ord) on pk.ord = ck.ord
     join pg_attribute patt on patt.attrelid = parent.oid and patt.attnum = pk.attnum
     where c.contype = 'f' and n.nspname = 'public' and parent.relnamespace = n.oid
     group by c.oid, child.relname, parent.relname`,
  );
  const foreignKeys: ForeignKey[] = keys.rows.map((row) => ({
    child: row.child,
    parent: row.parent,
    childCols: pgTextArray(row.child_cols),
    parentCols: pgTextArray(row.parent_cols),
    nullable: row.nullable === true || String(row.nullable) === 't',
  }));
  const triggers = await client.query<{ name: string }>(
    `select distinct c.relname as name
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal and c.relkind = 'r'`,
  );
  for (const table of triggers.rows) {
    await client.query(`alter table public.${ident(table.name)} disable trigger user`);
  }
  const stack: string[] = [];
  const remove = async (table: string, whereSql: string) => {
    if (stack.includes(table) || stack.length > 32) return;
    stack.push(table);
    for (const key of foreignKeys.filter((item) => item.parent === table)) {
      if (!key.childCols.length || !key.parentCols.length) continue;
      const match = `(${key.childCols.map(ident).join(', ')}) in (select ${key.parentCols.map(ident).join(', ')} from ${ident(table)} where ${whereSql})`;
      if (key.child === table) {
        if (key.nullable) {
          const sets = key.childCols.map((column) => `${ident(column)} = null`).join(', ');
          await client.query(`update ${ident(table)} set ${sets} where ${match}`, [userId]);
        }
        continue;
      }
      if (key.nullable) {
        const sets = key.child === 'journey_installs' && key.childCols.includes('linked_user_id')
          ? 'linked_user_id = null, linked_at = null'
          : key.childCols.map((column) => `${ident(column)} = null`).join(', ');
        await client.query(`update ${ident(key.child)} set ${sets} where ${match}`, [userId]);
        continue;
      }
      await remove(key.child, match);
    }
    await client.query(`delete from ${ident(table)} where ${whereSql}`, [userId]);
    stack.pop();
  };
  try {
    await client.query(
      `delete from refresh_tokens where session_id in (select id from sessions where user_id = $1)`,
      [userId],
    );
    await client.query(`delete from sessions where user_id = $1`, [userId]);
    await client.query(`delete from wallet_ledger where user_id = $1`, [userId]);
    await client.query(`delete from wallets where user_id = $1`, [userId]);
    await client.query(
      `update demo_lead_submissions set claimed_user_id = null, claimed_at = null where claimed_user_id = $1`,
      [userId],
    );
    await client.query(`delete from conversation_participants where user_id = $1`, [userId]);
    await client.query(
      `delete from messages where conversation_id in (select id from conversations where user_id = $1)`,
      [userId],
    );
    await client.query(`delete from conversations where user_id = $1`, [userId]);
    await client.query(`delete from onboarding_drafts where user_id = $1`, [userId]);
    await remove('users', 'id = $1');
    for (const table of triggers.rows) {
      await client.query(`alter table public.${ident(table.name)} enable trigger user`);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('user purge failed', error);
    throw new ApiError(409, 'delete_blocked', 'حذف این کاربر به‌خاطر وابستگی داده‌ها انجام نشد');
  }
}
