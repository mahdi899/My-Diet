import { Controller, Get, Header, Inject, OnApplicationShutdown, Post, Query, Req } from '@nestjs/common';
import { Pool } from 'pg';
import type { Request } from 'express';
import { actor, Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { ENV, type Env } from '../config/env.js';
import { audit, withTransaction } from '../common/sql.js';
import { PG_POOL } from '../database/database.js';
import { analyticsExitsSql } from './analytics-exits.js';

/** Read-only reporting against the pinned, self-hosted Umami PostgreSQL schema. */
@Controller('v1/admin/web-analytics')
@Roles('admin')
export class WebAnalyticsController implements OnApplicationShutdown {
  private readonly pool: Pool | null;
  constructor(@Inject(ENV) private readonly env: Env, @Inject(PG_POOL) private readonly appPool: Pool) {
    this.pool = env.ANALYTICS_DATABASE_URL ? new Pool({connectionString:env.ANALYTICS_DATABASE_URL,max:2,statement_timeout:10000,connectionTimeoutMillis:5000}) : null;
  }
  async onApplicationShutdown() { await this.pool?.end(); }

  @Post('reset')
  async reset(@Req() request: Request) {
    return withTransaction(this.appPool, async client => {
      const { rows } = await client.query<{ updated_at: Date }>(
        `insert into app_settings (key, value, updated_at)
         values ('analytics.report_reset', 'true'::jsonb, clock_timestamp())
         on conflict (key) do update set updated_at=clock_timestamp(),
           version=app_settings.version+1
         returning updated_at`,
      );
      const resetAt = rows[0].updated_at.toISOString();
      await audit(client, actor(request).id, 'web_analytics_reset', 'web_analytics', null, { resetAt });
      return { resetAt };
    });
  }

  private async resetTime() {
    const { rows } = await this.appPool.query<{ updated_at: Date }>(
      "select updated_at from app_settings where key='analytics.report_reset'",
    );
    return rows[0]?.updated_at.toISOString() ?? null;
  }

  @Get('live')
  @Header('Cache-Control', 'private, no-store')
  async live(@Query('campaign') campaign?: string) {
    return this.sessionPositions(campaign, false);
  }

  @Get('departures')
  @Header('Cache-Control', 'private, no-store')
  async departures(@Query('campaign') campaign?: string) {
    return this.sessionPositions(campaign, true);
  }

  private async sessionPositions(campaign: string | undefined, departed: boolean) {
    if (campaign !== undefined && (typeof campaign !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(campaign) || campaign.length > 64)) {
      throw new ApiError(400, 'validation', 'لینک ورودی معتبر نیست');
    }
    if (!this.pool || !this.env.ANALYTICS_WEBSITE_ID) {
      throw new ApiError(503, 'analytics_unavailable', 'سرویس رهگیری هنوز متصل نشده است');
    }
    try {
      const { rows } = await this.pool.query(`
        with recent as (
          select e.event_id, e.event_name, e.created_at, e.url_path, e.utm_campaign,
            coalesce(j.string_value, e.visit_id::text) as journey, s.string_value as step
          from website_event e
          left join event_data j on j.website_event_id=e.event_id and j.data_key='journey'
          left join event_data s on s.website_event_id=e.event_id and s.data_key='step'
          where e.website_id=$1 and e.created_at >= now() - (case when $4::boolean then interval '24 hours' else interval '90 seconds' end)
            and ($2::timestamptz is null or e.created_at >= $2::timestamptz)
            and e.tag is distinct from 'qa'
            and e.event_name in ('step_view', 'active_heartbeat', 'presence_end')
            and e.url_path in ('/onboarding/', '/onboarding/index.html', '/onboarding/goals.html',
              '/onboarding/quiz.html', '/onboarding/payment.html')
        ),
        latest as (
          select distinct on (journey) * from recent
          order by journey, created_at desc, event_id desc
        )
        select journey as id, url_path as page, step, utm_campaign as campaign, created_at as "lastSeen"
        from latest
        where (case when $4::boolean
          then created_at < now()-interval '2 minutes' and step is distinct from 'payment_success'
          else step='preparing' or (event_name <> 'presence_end' and created_at >= now()-interval '25 seconds')
        end)
          and ($3::text is null or utm_campaign=$3)
        order by created_at desc, journey
        limit (case when $4::boolean then 200 else null end)
      `, [this.env.ANALYTICS_WEBSITE_ID, await this.resetTime(), campaign ?? null, departed]);
      return { sessions: rows, generatedAt: new Date().toISOString() };
    } catch {
      throw new ApiError(503, 'analytics_unavailable', departed
        ? 'دریافت نتیجهٔ نشست‌ها ممکن نشد'
        : 'دریافت موقعیت زنده کاربران ممکن نشد');
    }
  }

  @Get()
  async report(@Query('days') raw = '7') {
    const days = Number(raw);
    if (![1,7,30,90].includes(days)) throw new ApiError(400,'validation','بازهٔ گزارش معتبر نیست');
    if (!this.pool || !this.env.ANALYTICS_WEBSITE_ID) throw new ApiError(503,'analytics_unavailable','سرویس رهگیری هنوز متصل نشده است');
    const prefix = `with e as (select * from website_event where website_id=$1 and created_at >= now()-($2 * interval '1 day') and ($3::timestamptz is null or created_at >= $3::timestamptz) and tag is distinct from 'qa'),
      d as (select d.* from event_data d join e on e.event_id=d.website_event_id),
      steps as (select e.*,d.string_value as step from e join d on d.website_event_id=e.event_id and d.data_key='step' where e.event_name='step_view') `;
    try {
      const resetAt = await this.resetTime();
      const query = (text: string) => this.pool!.query(prefix + text, [this.env.ANALYTICS_WEBSITE_ID, days, resetAt]).then(r => r.rows);
      const [summary,events,goals,stages,exits,sources,daily,active] = await Promise.all([
        query(`select count(*) filter(where event_type=1)::int as pageviews,count(distinct session_id)::int as visitors,count(distinct visit_id)::int as visits,count(distinct visit_id) filter(where event_name='questionnaire_completed')::int as completed from e`),
        query(`select event_name as name,count(*)::int as count,count(distinct visit_id)::int as visits from e where event_type=2 group by event_name order by count(*) desc limit 50`),
        query(`select d.string_value as goal,count(*)::int as clicks,count(distinct e.visit_id)::int as visits from e join d on d.website_event_id=e.event_id and d.data_key='goal' where e.event_name='goal_selected' group by d.string_value order by count(*) desc`),
        query(`, times as (select e.visit_id,s.string_value as step,sum(least(30000,greatest(0,t.number_value)))/1000.0 as seconds from e join d s on s.website_event_id=e.event_id and s.data_key='step' join d t on t.website_event_id=e.event_id and t.data_key='activeMs' where e.event_name='step_time' group by e.visit_id,s.string_value), views as (select step,count(*)::int as views,count(distinct visit_id)::int as visits from steps group by step) select v.*,round(coalesce(avg(t.seconds),0),1)::float as "averageSeconds",round(coalesce(sum(t.seconds),0),1)::float as "totalSeconds" from views v left join times t on t.step=v.step group by v.step,v.views,v.visits order by v.views desc limit 200`),
        query(analyticsExitsSql),
        query(`select coalesce(nullif(utm_source,''),nullif(referrer_domain,''),'direct') as source,coalesce(utm_campaign,'') as campaign,count(distinct visit_id)::int as visits from e where event_type=1 group by 1,2 order by count(distinct visit_id) desc limit 100`),
        query(`select to_char(created_at at time zone 'Asia/Tehran','YYYY-MM-DD') as day,count(*) filter(where event_type=1)::int as pageviews,count(distinct visit_id)::int as visits from e group by 1 order by 1`),
        query(`, presence as (select distinct on(visit_id) visit_id,event_name,created_at from e where event_name in ('active_heartbeat','presence_end') order by visit_id,created_at desc) select count(*)::int as count from presence where event_name='active_heartbeat' and created_at>now()-interval '25 seconds'`),
      ]);
      const totalClicks=goals.reduce((n,r)=>n+Number(r.clicks),0);
      return {days,resetAt,generatedAt:new Date().toISOString(),summary:summary[0],activeSessions:active[0]?.count||0,events,goals:goals.map(r=>({...r,percent:totalClicks?Math.round(Number(r.clicks)/totalClicks*1000)/10:0})),stages,exits,sources,daily};
    } catch {
      throw new ApiError(503,'analytics_unavailable','دریافت گزارش رهگیری انجام نشد؛ دوباره تلاش کنید');
    }
  }
}
