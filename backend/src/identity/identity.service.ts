import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { SMS_PROVIDER, type SmsProvider } from '../adapters/sms.js';
import { ENV, type Env } from '../config/env.js';
import { PG_POOL } from '../database/database.js';
import type { Role } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { decryptText, encryptText } from '../common/field-crypto.js';
import { signAccessToken } from '../common/jwt.js';
import { uuidv7 } from '../common/id.js';
import { base32Encode, randomTotpSecret, totpMatches } from '../common/totp.js';
import { withTransaction } from '../common/sql.js';
import { verifyPassword } from '../common/password.js';

const ACCESS_SECONDS = 600;

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  sessionExpiresAt: string;
  role: Role;
}

export interface TotpChallenge {
  totpRequired: true;
  totpToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function codeHmac(pepper: string, challengeId: string, code: string): string {
  return createHmac('sha256', pepper).update(`${challengeId}:${code}`).digest('hex');
}

function sameHex(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class IdentityService {
  async adminLogin(username: string, password: string): Promise<IssuedSession | TotpChallenge> {
    const outcome = await withTransaction(this.pool, async (client) => {
      const result = await client.query<{user_id: string; password_hash: string; failed_attempts: number; locked_until: Date | null; status: string}>(
        `select c.*, u.status from admin_credentials c join users u on u.id=c.user_id
         where c.username=$1 and u.role='admin' for update of c`, [username.toLowerCase().trim()]);
      const row = result.rows[0];
      const valid = verifyPassword(password, row?.password_hash ?? '00000000000000000000000000000000:' + '00'.repeat(64));
      if (!row || !valid || row.status !== 'active' || (row.locked_until && row.locked_until > new Date())) {
        if (row) await client.query(`update admin_credentials set failed_attempts=failed_attempts+1,
          locked_until=case when failed_attempts>=4 then now()+interval '15 minutes' else locked_until end where user_id=$1`, [row.user_id]);
        return null;
      }
      await client.query('update admin_credentials set failed_attempts=0, locked_until=null where user_id=$1', [row.user_id]);
      const totp = await client.query('select 1 from staff_totp where user_id=$1 and confirmed_at is not null', [row.user_id]);
      if (totp.rowCount) {
        const token = randomBytes(32).toString('base64url');
        await client.query(`insert into totp_challenges (id,user_id,token_hash,device_label,platform,expires_at)
          values ($1,$2,$3,'Admin website','web',now()+interval '5 minutes')`, [uuidv7(),row.user_id,hashToken(token)]);
        return {totpRequired: true as const, totpToken: token};
      }
      return this.issue(client,row.user_id,'admin','Admin website','web');
    });
    if (!outcome) throw new ApiError(401,'unauthorized','نام کاربری یا رمز عبور نادرست است یا ورود موقتاً مسدود شده است');
    return outcome;
  }
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ENV) private readonly env: Env,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async requestOtp(phoneE164: string, ip: string, existingAccountOnly = false): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
    const challengeId = uuidv7();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await withTransaction(this.pool, async (client) => {
      // Serialize both budgets, including the first request when no row exists.
      // All callers acquire IP before phone to keep lock ordering consistent.
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`otp:ip:${ip}`]);
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [`otp:phone:${phoneE164}`]);
      const locked = await client.query<{ n: number; latest: Date | null }>(
        `select count(*)::int as n, max(locked_at) as latest
         from otp_challenges
         where phone_e164 = $1 and locked_at > now() - interval '1 hour'`,
        [phoneE164],
      );
      const lock = locked.rows[0];
      if (
        lock &&
        lock.n >= 3 &&
        lock.latest &&
        lock.latest.getTime() > Date.now() - 15 * 60 * 1000
      ) {
        throw new ApiError(429, 'rate_limited', 'به‌خاطر تلاش‌های ناموفق، ورود تا چند دقیقه ممکن نیست');
      }
      const hourly = await client.query<{ n: number }>(
        `select count(*)::int as n from otp_challenges
         where phone_e164 = $1 and created_at > now() - interval '1 hour'`,
        [phoneE164],
      );
      if ((hourly.rows[0]?.n ?? 0) >= 5) {
        throw new ApiError(429, 'rate_limited', 'تعداد درخواست کد در این ساعت به سقف رسیده است');
      }
      const daily = await client.query<{ n: number }>(
        `select count(*)::int as n from otp_challenges
         where phone_e164 = $1 and created_at > now() - interval '1 day'`,
        [phoneE164],
      );
      if ((daily.rows[0]?.n ?? 0) >= 10) {
        throw new ApiError(429, 'rate_limited', 'تعداد درخواست کد در امروز به سقف رسیده است');
      }
      const byIp = await client.query<{ n: number }>(
        `select count(*)::int as n from otp_challenges
         where ip = $1 and created_at > now() - interval '1 hour'`,
        [ip],
      );
      if ((byIp.rows[0]?.n ?? 0) >= 20) {
        throw new ApiError(429, 'rate_limited', 'تعداد درخواست از این شبکه به سقف رسیده است');
      }
      const cooling = await client.query<{ cooling: boolean }>(
        `select exists(
           select 1 from otp_challenges
           where phone_e164 = $1 and created_at > now() - interval '60 seconds'
         ) as cooling`,
        [phoneE164],
      );
      if (cooling.rows[0]?.cooling) {
        throw new ApiError(429, 'rate_limited', 'درخواست کد جدید کمی بعد ممکن است');
      }
      if (existingAccountOnly) {
        const account = await client.query(
          "select 1 from users where phone_e164 = $1 and role = 'user' and status = 'active'",
          [phoneE164],
        );
        if (!account.rowCount) {
          throw new ApiError(404, 'account_not_registered', 'هنوز ثبت‌نام نکردی');
        }
      }
      await client.query(
        `update otp_challenges
         set superseded_at = now()
         where phone_e164 = $1 and consumed_at is null and superseded_at is null`,
        [phoneE164],
      );
      await client.query(
        `insert into otp_challenges (id, phone_e164, code_hmac, ip, expires_at)
         values ($1, $2, $3, $4, now() + interval '2 minutes')`,
        [challengeId, phoneE164, codeHmac(this.env.OTP_PEPPER, challengeId, code), ip],
      );
      try {
        await this.sms.sendOtp(phoneE164, code);
      } catch {
        throw new ApiError(503, 'sms_unavailable', 'ارسال کد ممکن نشد. کمی بعد دوباره تلاش کن');
      }
    });
    return { expiresInSeconds: 120, resendAfterSeconds: 60 };
  }

  async verifyOtp(
    phoneE164: string,
    code: string,
    deviceLabel: string | null,
    platform: string | null,
  ): Promise<IssuedSession | TotpChallenge> {
    const outcome = await withTransaction(this.pool, async (client) => {
      const found = await client.query<{
        id: string;
        code_hmac: string;
        attempts: number;
        consumed_at: Date | null;
        superseded_at: Date | null;
        locked_at: Date | null;
        expired: boolean;
      }>(
        `select id, code_hmac, attempts, consumed_at, superseded_at, locked_at, expires_at <= now() as expired
         from otp_challenges
         where phone_e164 = $1
         order by created_at desc
         limit 1
         for update`,
        [phoneE164],
      );
      const challenge = found.rows[0];
      if (!challenge || challenge.consumed_at || challenge.superseded_at || challenge.locked_at) {
        throw new ApiError(401, 'unauthorized', 'کد واردشده درست نیست');
      }
      if (challenge.expired) {
        throw new ApiError(401, 'unauthorized', 'کد منقضی شده است');
      }
      const matches = sameHex(challenge.code_hmac, codeHmac(this.env.OTP_PEPPER, challenge.id, code));
      if (!matches) {
        const next = challenge.attempts + 1;
        await client.query(
          `update otp_challenges
           set attempts = attempts + 1,
               locked_at = case when attempts + 1 >= 5 then now() else locked_at end,
               consumed_at = case when attempts + 1 >= 5 then now() else consumed_at end
           where id = $1`,
          [challenge.id],
        );
        return {
          error: new ApiError(
            401,
            'unauthorized',
            next >= 5 ? 'کد دیگر معتبر نیست. کد جدید بگیرید' : 'کد واردشده درست نیست',
          ),
        };
      }
      await client.query(`update otp_challenges set consumed_at = now() where id = $1`, [challenge.id]);

      const existing = await client.query<{ id: string; role: Role; status: string }>(
        `select id, role, status from users where phone_e164 = $1 for update`,
        [phoneE164],
      );
      let user = existing.rows[0];
      if (!user) {
        const userId = uuidv7();
        const conversationId = uuidv7();
        await client.query(
          `insert into users (id, phone_e164, role) values ($1, $2, 'user')`,
          [userId, phoneE164],
        );
        await client.query(`insert into wallets (user_id) values ($1)`, [userId]);
        await client.query(
          `insert into conversations (id, kind, user_id) values ($1, 'support', $2)`,
          [conversationId, userId],
        );
        await client.query(
          `insert into conversation_participants (conversation_id, user_id) values ($1, $2)`,
          [conversationId, userId],
        );
        user = { id: userId, role: 'user', status: 'active' };
      }
      if (user.role === 'admin') {
        return { error: new ApiError(403, 'admin_web_only', 'برای ورود مدیر از نام کاربری و رمز عبور پنل وب استفاده کنید') };
      }
      if (user.status === 'deleted') {
        return { error: new ApiError(403, 'account_deleted', 'این حساب حذف شده است') };
      }
      if (user.status !== 'active') {
        return { error: new ApiError(403, 'suspended', 'این حساب غیرفعال است') };
      }
      const totp = await client.query<{ secret_encrypted: string }>(
        `select secret_encrypted from staff_totp where user_id = $1 and confirmed_at is not null`,
        [user.id],
      );
      if (totp.rows[0] && user.role !== 'user') {
        const totpToken = randomBytes(32).toString('base64url');
        await client.query(
          `insert into totp_challenges (id, user_id, token_hash, device_label, platform, expires_at)
           values ($1, $2, $3, $4, $5, now() + interval '5 minutes')`,
          [uuidv7(), user.id, hashToken(totpToken), deviceLabel, platform],
        );
        return { totpRequired: true as const, totpToken };
      }
      return { session: await this.issue(client, user.id, user.role, deviceLabel, platform) };
    });
    if ('error' in outcome && outcome.error) throw outcome.error;
    if (outcome.totpRequired === true && outcome.totpToken) {
      return { totpRequired: true, totpToken: outcome.totpToken };
    }
    if (outcome.session) return outcome.session;
    throw new ApiError(500, 'internal', 'ورود کامل نشد');
  }

  async completeTotp(totpToken: string, code: string): Promise<IssuedSession> {
    const outcome = await withTransaction(this.pool, async (client) => {
      const found = await client.query<{
        id: string;
        user_id: string;
        attempts: number;
        expired: boolean;
        consumed_at: Date | null;
        device_label: string | null;
        platform: string | null;
        role: Role;
        status: string;
        secret_encrypted: string;
      }>(
        `select c.id, c.user_id, c.attempts, c.expires_at <= now() as expired, c.consumed_at,
                c.device_label, c.platform, u.role, u.status, t.secret_encrypted
         from totp_challenges c
         join users u on u.id = c.user_id
         join staff_totp t on t.user_id = c.user_id and t.confirmed_at is not null
         where c.token_hash = $1
         for update of c`,
        [hashToken(totpToken)],
      );
      const row = found.rows[0];
      if (!row || row.consumed_at || row.expired) {
        throw new ApiError(401, 'unauthorized', 'ورود دومرحله‌ای منقضی شده است');
      }
      if (row.status !== 'active' || (row.role !== 'admin' && row.role !== 'specialist')) {
        throw new ApiError(403, 'suspended', 'این حساب غیرفعال است');
      }
      const secret = Buffer.from(decryptText(row.secret_encrypted, this.env.FIELD_KEY), 'base64url');
      if (!totpMatches(secret, code)) {
        const next = row.attempts + 1;
        await client.query(
          `update totp_challenges
           set attempts = attempts + 1,
               consumed_at = case when attempts + 1 >= 5 then now() else consumed_at end
           where id = $1`,
          [row.id],
        );
        return {
          error: new ApiError(401, 'unauthorized', next >= 5 ? 'کد دیگر معتبر نیست' : 'کد ورود دومرحله‌ای درست نیست'),
        };
      }
      await client.query(`update totp_challenges set consumed_at = now() where id = $1`, [row.id]);
      return { session: await this.issue(client, row.user_id, row.role, row.device_label, row.platform) };
    });
    if ('error' in outcome) throw outcome.error;
    return outcome.session;
  }

  async totpStatus(userId: string): Promise<{ enabled: boolean }> {
    const row = await this.pool.query(
      `select user_id from staff_totp where user_id = $1 and confirmed_at is not null`,
      [userId],
    );
    return { enabled: (row.rowCount ?? 0) > 0 };
  }

  async setupTotp(userId: string, role: Role): Promise<{ secret: string; otpauthUrl: string }> {
    if (role === 'user') throw new ApiError(403, 'forbidden', 'ورود دومرحله‌ای برای این نقش نیست');
    const existing = await this.pool.query<{ confirmed_at: Date | null }>(
      `select confirmed_at from staff_totp where user_id = $1`,
      [userId],
    );
    if (existing.rows[0]?.confirmed_at) {
      throw new ApiError(409, 'totp_enabled', 'ورود دومرحله‌ای قبلاً فعال شده است');
    }
    const secret = randomTotpSecret();
    const encoded = base32Encode(secret);
    await this.pool.query(
      `insert into staff_totp (user_id, secret_encrypted)
       values ($1, $2)
       on conflict (user_id) do update set secret_encrypted = excluded.secret_encrypted, confirmed_at = null`,
      [userId, encryptText(secret.toString('base64url'), this.env.FIELD_KEY)],
    );
    return {
      secret: encoded,
      otpauthUrl: `otpauth://totp/Sabzine:${role}?secret=${encoded}&issuer=Sabzine&digits=6&period=30`,
    };
  }

  async confirmTotp(userId: string, role: Role, code: string): Promise<{ enabled: true }> {
    if (role === 'user') throw new ApiError(403, 'forbidden', 'ورود دومرحله‌ای برای این نقش نیست');
    const row = await this.pool.query<{ secret_encrypted: string; confirmed_at: Date | null }>(
      `select secret_encrypted, confirmed_at from staff_totp where user_id = $1`,
      [userId],
    );
    const stored = row.rows[0];
    if (!stored) throw new ApiError(409, 'totp_missing', 'ابتدا ورود دومرحله‌ای را راه‌اندازی کن');
    if (stored.confirmed_at) throw new ApiError(409, 'totp_enabled', 'ورود دومرحله‌ای قبلاً فعال شده است');
    const secret = Buffer.from(decryptText(stored.secret_encrypted, this.env.FIELD_KEY), 'base64url');
    if (!totpMatches(secret, code)) throw new ApiError(401, 'unauthorized', 'کد ورود دومرحله‌ای درست نیست');
    await this.pool.query(`update staff_totp set confirmed_at = now() where user_id = $1`, [userId]);
    return { enabled: true };
  }

  async refresh(rawToken: string): Promise<IssuedSession> {
    const outcome = await withTransaction(this.pool, async (client) => {
      const found = await client.query<{
        id: string;
        session_id: string;
        used_at: Date | null;
        revoked_at: Date | null;
        expired: boolean;
        user_id: string;
        role: Role;
        status: string;
      }>(
        `select t.id, t.session_id, t.used_at, s.revoked_at, s.absolute_expires_at <= now() as expired,
                s.user_id, u.role, u.status
         from refresh_tokens t
         join sessions s on s.id = t.session_id
         join users u on u.id = s.user_id
         where t.token_hash = $1
         for update of s, t`,
        [hashToken(rawToken)],
      );
      const row = found.rows[0];
      if (!row) throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
      if (row.used_at) {
        await client.query(
          `update sessions
           set revoked_at = now(), revoke_reason = 'refresh_reuse'
           where id = $1 and revoked_at is null`,
          [row.session_id],
        );
        return { error: new ApiError(401, 'unauthorized', 'نشست پایان یافته است') };
      }
      if (row.revoked_at || row.expired) {
        throw new ApiError(401, 'unauthorized', 'نشست پایان یافته است');
      }
      if (row.status === 'deleted') {
        throw new ApiError(403, 'account_deleted', 'این حساب حذف شده است');
      }
      if (row.status !== 'active') {
        throw new ApiError(403, 'suspended', 'این حساب غیرفعال است');
      }
      await client.query(`update refresh_tokens set used_at = now() where id = $1 and used_at is null`, [row.id]);
      await client.query(`update sessions set last_seen_at = now() where id = $1`, [row.session_id]);
      return { session: await this.rotate(client, row.session_id, row.user_id, row.role, row.id) };
    });
    if ('error' in outcome) throw outcome.error;
    return outcome.session;
  }

  async profile(userId: string, role: Role) {
    const rows = await this.pool.query<{ display_name: string | null }>(
      `select display_name from users where id = $1`,
      [userId],
    );
    return { id: userId, role, displayName: rows.rows[0]?.display_name ?? null };
  }

  async rename(userId: string, role: Role, displayName: string) {
    await this.pool.query(`update users set display_name = $2 where id = $1`, [userId, displayName]);
    return this.profile(userId, role);
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.pool.query(
      `update sessions set revoked_at = now(), revoke_reason = 'logout'
       where id = $1 and user_id = $2 and revoked_at is null`,
      [sessionId, userId],
    );
  }

  async sessions(userId: string, currentSessionId: string) {
    const rows = await this.pool.query<{
      id: string;
      created_at: Date;
      absolute_expires_at: Date;
      platform: string | null;
      device_label: string | null;
    }>(
      `select id, created_at, absolute_expires_at, platform, device_label
       from sessions
       where user_id = $1 and revoked_at is null and absolute_expires_at > now()
       order by created_at desc`,
      [userId],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      sessionExpiresAt: row.absolute_expires_at.toISOString(),
      platform: row.platform,
      deviceLabel: row.device_label,
      current: row.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.pool.query(
      `update sessions set revoked_at = now(), revoke_reason = 'revoked'
       where id = $1 and user_id = $2 and revoked_at is null`,
      [sessionId, userId],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'not_found', 'نشست پیدا نشد');
  }

  private async issue(
    client: PoolClient,
    userId: string,
    role: Role,
    deviceLabel: string | null,
    platform: string | null,
  ): Promise<IssuedSession> {
    const sessionId = uuidv7();
    const created = await client.query<{ absolute_expires_at: Date }>(
      `insert into sessions (id, user_id, created_at, absolute_expires_at, platform, device_label, last_seen_at)
       values ($1, $2, now(), now() + interval '30 days', $3, $4, now())
       returning absolute_expires_at`,
      [sessionId, userId, platform, deviceLabel],
    );
    const refreshToken = randomBytes(32).toString('base64url');
    await client.query(
      `insert into refresh_tokens (id, session_id, token_hash, expires_at)
       select $1, s.id, $2, s.absolute_expires_at from sessions s where s.id = $3`,
      [uuidv7(), hashToken(refreshToken), sessionId],
    );
    return this.tokens(userId, sessionId, role, created.rows[0]!.absolute_expires_at, refreshToken);
  }

  private async rotate(
    client: PoolClient,
    sessionId: string,
    userId: string,
    role: Role,
    parentId: string,
  ): Promise<IssuedSession> {
    const refreshToken = randomBytes(32).toString('base64url');
    await client.query(
      `insert into refresh_tokens (id, session_id, token_hash, parent_id, expires_at)
       select $1, s.id, $2, $3, s.absolute_expires_at from sessions s where s.id = $4`,
      [uuidv7(), hashToken(refreshToken), parentId, sessionId],
    );
    const session = await client.query<{ absolute_expires_at: Date }>(
      `select absolute_expires_at from sessions where id = $1`,
      [sessionId],
    );
    return this.tokens(userId, sessionId, role, session.rows[0]!.absolute_expires_at, refreshToken);
  }

  private tokens(
    userId: string,
    sessionId: string,
    role: Role,
    sessionExpires: Date,
    refreshToken: string,
  ): IssuedSession {
    const iat = Math.floor(Date.now() / 1000);
    const exp = Math.min(iat + ACCESS_SECONDS, Math.floor(sessionExpires.getTime() / 1000));
    return {
      accessToken: signAccessToken({ sub: userId, sid: sessionId, role, iat, exp }, this.env.JWT_SECRET),
      refreshToken,
      accessExpiresAt: new Date(exp * 1000).toISOString(),
      sessionExpiresAt: sessionExpires.toISOString(),
      role,
    };
  }
}
