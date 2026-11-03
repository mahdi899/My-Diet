import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ENV, type Env } from '../config/env.js';
import { ApiError } from '../common/errors.js';
import { verifyAccessToken } from '../common/jwt.js';
import { uuidv7 } from '../common/id.js';
import { withTransaction } from '../common/sql.js';
import { civilNow, tehranToday } from '../common/time.js';
import { PG_POOL, PG_REPLICA } from '../database/database.js';
import { withReadOnly } from '../database/read-only.js';
import {
  JOURNEY_LIMITATIONS,
  JOURNEY_RATE_LIMIT,
  JOURNEY_SCAN_LIMIT,
  isGapped,
  journeyReport,
  parseBatch,
  payloadHash,
  type CleanEvent,
  type JourneySample,
} from './journey-rules.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^\d+\.\d+\.\d+$/;

@Injectable()
export class JourneyService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(PG_REPLICA) private readonly replica: Pool,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async ingest(body: unknown, authorization?: string) {
    const userId = await this.optionalUser(authorization);
    const parsed = parseBatch(body, civilNow());
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `insert into journey_installs (id) values ($1) on conflict (id) do nothing`,
        [parsed.installId],
      );
      const install = await client.query<{ linked_user_id: string | null }>(
        `select linked_user_id from journey_installs where id = $1 for update`,
        [parsed.installId],
      );
      const linkedUser = install.rows[0]?.linked_user_id ?? null;
      const recent = await client.query<{ n: number }>(
        `select count(*)::int as n from journey_batches
         where install_id = $1 and received_at > now() - interval '1 minute'`,
        [parsed.installId],
      );
      if ((recent.rows[0]?.n ?? 0) >= JOURNEY_RATE_LIMIT) {
        throw new ApiError(429, 'rate_limited', 'تعداد دستهٔ رویداد بیش از حد است');
      }
      const existing = await client.query<{
        install_id: string;
        user_id: string | null;
        session_type: 'first_visit' | 'returning';
        first_authenticated: boolean;
        gapped: boolean;
      }>(
        `select install_id, user_id, session_type, first_authenticated, gapped
         from journey_sessions where id = $1 for update`,
        [parsed.sessionId],
      );
      const session = existing.rows[0];
      if (session && session.install_id !== parsed.installId) {
        throw new ApiError(409, 'session_conflict', 'این نشست به نصب دیگری تعلق دارد');
      }
      const prior = await client.query<{ occurred_at: Date; kind: string }>(
        `select occurred_at, kind from journey_events where session_id = $1 order by occurred_at desc limit 1`,
        [parsed.sessionId],
      );
      const last = prior.rows[0];
      if (!session && parsed.events[0]?.type !== 'session_started') {
        throw new ApiError(400, 'validation', 'نشست باید با شروع ثبت شود');
      }
      if (!session && parsed.events.slice(1).some((event) => event.type === 'session_started')) {
        throw new ApiError(400, 'validation', 'نشست یک بار شروع می‌شود');
      }
      let gapped = session?.gapped ?? false;
      let previous = last ? last.occurred_at.toISOString() : null;
      for (const event of parsed.events) {
        if (isGapped(previous, event.occurredAt)) gapped = true;
        previous = event.occurredAt;
      }
      const link = await this.link(client, parsed.installId, userId, linkedUser);
      const opened = session ?? await this.openSession(client, parsed.installId, parsed.sessionId, userId, parsed.events[0]!);
      if (gapped && !opened.gapped) {
        await client.query(`update journey_sessions set gapped = true where id = $1`, [parsed.sessionId]);
      }
      let accepted = 0;
      let duplicates = 0;
      const floor = last?.occurred_at.toISOString() ?? null;
      for (const event of parsed.events) {
        if (session && event.type === 'session_started') {
          const replay = await this.replay(client, parsed.sessionId, event);
          if (replay !== 'duplicate') throw new ApiError(409, 'session_open', 'این نشست قبلاً شروع شده است');
          duplicates += 1;
          continue;
        }
        if (floor && event.occurredAt < floor) {
          const replay = await this.replay(client, parsed.sessionId, event);
          if (replay === 'duplicate') {
            duplicates += 1;
            continue;
          }
          throw new ApiError(400, 'validation', 'رویداد جدید نمی‌تواند پیش از آخرین رویداد نشست باشد');
        }
        const outcome = await this.storeEvent(client, parsed.sessionId, event);
        if (outcome === 'accepted') accepted += 1;
        else duplicates += 1;
      }
      await client.query(`insert into journey_batches (id, install_id) values ($1, $2)`, [uuidv7(), parsed.installId]);
      return {
        sessionType: opened.session_type,
        firstAuthenticated: opened.first_authenticated,
        link,
        accepted,
        duplicates,
        gapped: gapped || opened.gapped,
      };
    });
  }

  async report(from: string, to: string, platform = 'all', appVersion = 'all', sessionType = '') {
    if (!DATE.test(from) || !DATE.test(to) || from > to) return { status: 'invalid' as const };
    if (sessionType !== 'first_visit' && sessionType !== 'returning') return { status: 'invalid' as const };
    if (platform !== 'all' && platform !== 'android' && platform !== 'ios' && platform !== 'web') {
      return { status: 'invalid' as const };
    }
    if (appVersion !== 'all' && !VERSION.test(appVersion)) return { status: 'invalid' as const };
    const loaded = await withReadOnly(this.replica, async (client) => {
      const size = await client.query<{ n: number }>(
        `select count(*)::int as n from journey_sessions
         where started_on between $1::date and $2::date
           and ($3::text = 'all' or platform = $3)
           and ($4::text = 'all' or app_version = $4)`,
        [from, to, platform, appVersion],
      );
      if ((size.rows[0]?.n ?? 0) > JOURNEY_SCAN_LIMIT) return { tooLarge: true as const, rows: [] };
      const rows = await client.query<{
        id: string;
        started_on: string;
        platform: string;
        app_version: string;
        session_type: 'first_visit' | 'returning';
        first_authenticated: boolean;
        gapped: boolean;
        kind: string | null;
        properties: Record<string, unknown> | null;
      }>(
        `select s.id, s.started_on::text, s.platform, s.app_version, s.session_type, s.first_authenticated, s.gapped,
                e.kind, e.properties
         from journey_sessions s
         left join journey_events e on e.session_id = s.id
         where s.started_on between $1::date and $2::date
           and ($3::text = 'all' or s.platform = $3)
           and ($4::text = 'all' or s.app_version = $4)
         order by s.started_on, s.id, e.occurred_at`,
        [from, to, platform, appVersion],
      );
      return { tooLarge: false as const, rows: rows.rows };
    });
    if (loaded.tooLarge) return { status: 'too_large' as const, limitations: JOURNEY_LIMITATIONS };
    const samples = groupSessions(loaded.rows);
    const comparison = {
      firstVisitSessions: samples.filter((item) => item.sessionType === 'first_visit').length,
      returningSessions: samples.filter((item) => item.sessionType === 'returning').length,
      firstAuthenticatedSessions: samples.filter((item) => item.firstAuthenticated).length,
    };
    const selected = samples.filter((item) => item.sessionType === sessionType);
    if (selected.length === 0) {
      return {
        status: 'empty' as const,
        nodes: [],
        edges: [],
        journeys: [],
        entries: [],
        exits: [],
        dropOff: [],
        active: [],
        comparison,
        limitations: JOURNEY_LIMITATIONS,
      };
    }
    return {
      status: 'ready' as const,
      ...journeyReport(selected),
      comparison,
      limitations: JOURNEY_LIMITATIONS,
    };
  }

  private async optionalUser(authorization?: string): Promise<string | null> {
    if (!authorization) return null;
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!match?.[1]) throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
    const claims = verifyAccessToken(match[1], this.env.JWT_SECRET);
    const session = await this.pool.query<{ revoked_at: Date | null; status: string }>(
      `select s.revoked_at, u.status
       from sessions s join users u on u.id = s.user_id
       where s.id = $1 and s.user_id = $2 and s.absolute_expires_at > now()`,
      [claims.sid, claims.sub],
    );
    const row = session.rows[0];
    if (!row || row.revoked_at || row.status !== 'active') {
      throw new ApiError(401, 'unauthorized', 'نشست معتبر نیست');
    }
    return claims.sub;
  }

  private async link(client: PoolClient, installId: string, userId: string | null, linkedUser: string | null) {
    if (!userId) return 'anonymous' as const;
    if (linkedUser === userId) return 'already_linked' as const;
    if (linkedUser) return 'kept_previous' as const;
    await client.query(
      `update journey_installs set linked_user_id = $2, linked_at = now() where id = $1 and linked_user_id is null`,
      [installId, userId],
    );
    return 'linked' as const;
  }

  private async openSession(client: PoolClient, installId: string, sessionId: string, userId: string | null, started: CleanEvent) {
    const platform = String(started.properties.platform);
    const appVersion = String(started.properties.appVersion);
    const seen = await client.query<{ seen: boolean }>(
      `select exists(select 1 from journey_sessions where install_id = $1) as seen`,
      [installId],
    );
    const authenticated = await client.query<{ seen: boolean }>(
      `select exists(select 1 from journey_sessions where install_id = $1 and user_id is not null) as seen`,
      [installId],
    );
    const sessionType = seen.rows[0]?.seen ? 'returning' as const : 'first_visit' as const;
    const firstAuthenticated = Boolean(userId) && authenticated.rows[0]?.seen !== true;
    await client.query(
      `insert into journey_sessions
         (id, install_id, user_id, platform, app_version, session_type, first_authenticated, started_on)
       values ($1,$2,$3,$4,$5,$6,$7,$8::date)`,
      [sessionId, installId, userId, platform, appVersion, sessionType, firstAuthenticated, tehranToday()],
    );
    return { session_type: sessionType, first_authenticated: firstAuthenticated, gapped: false };
  }

  private async replay(client: PoolClient, sessionId: string, event: CleanEvent): Promise<'duplicate' | 'missing'> {
    const found = await client.query<{ session_id: string; payload_hash: string }>(
      `select session_id, payload_hash from journey_events where id = $1`,
      [event.id],
    );
    const row = found.rows[0];
    if (!row) return 'missing';
    if (row.session_id === sessionId && row.payload_hash === payloadHash(event)) return 'duplicate';
    throw new ApiError(409, 'idempotency_conflict', 'این شناسه برای رویداد دیگری استفاده شده است');
  }

  private async storeEvent(client: PoolClient, sessionId: string, event: CleanEvent): Promise<'accepted' | 'duplicate'> {
    const hash = payloadHash(event);
    const replay = await this.replay(client, sessionId, event);
    if (replay === 'duplicate') return 'duplicate';
    await client.query(
      `insert into journey_events (id, session_id, kind, occurred_at, properties, payload_hash)
       values ($1,$2,$3,$4,$5::jsonb,$6)`,
      [event.id, sessionId, event.type, event.occurredAt, JSON.stringify(event.properties), hash],
    );
    return 'accepted';
  }
}

function groupSessions(rows: Array<{
  id: string;
  started_on: string;
  platform: string;
  app_version: string;
  session_type: 'first_visit' | 'returning';
  first_authenticated: boolean;
  gapped: boolean;
  kind: string | null;
  properties: Record<string, unknown> | null;
}>): JourneySample[] {
  const grouped = new Map<string, JourneySample>();
  for (const row of rows) {
    const sample = grouped.get(row.id) ?? {
      date: row.started_on,
      platform: row.platform,
      appVersion: row.app_version,
      sessionType: row.session_type,
      firstAuthenticated: row.first_authenticated,
      gapped: row.gapped,
      events: [],
    };
    if (row.kind && row.properties) sample.events.push({ type: row.kind, properties: row.properties });
    grouped.set(row.id, sample);
  }
  return [...grouped.values()];
}
