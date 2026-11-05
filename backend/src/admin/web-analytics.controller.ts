import { Controller, Get, Inject, OnApplicationShutdown, Query } from '@nestjs/common';
import { Pool } from 'pg';
import { Roles } from '../common/auth.js';
import { ApiError } from '../common/errors.js';
import { ENV, type Env } from '../config/env.js';

/** Read-only reporting against the pinned, self-hosted Umami PostgreSQL schema. */
@Controller('v1/admin/web-analytics')
@Roles('admin')
export class WebAnalyticsController implements OnApplicationShutdown {
  private readonly pool: Pool | null;
  constructor(@Inject(ENV) private readonly env: Env) {
    this.pool = env.ANALYTICS_DATABASE_URL ? new Pool({connectionString:env.ANALYTICS_DATABASE_URL,max:2,statement_timeout:10000,connectionTimeoutMillis:5000}) : null;
  }
  async onApplicationShutdown() { await this.pool?.end(); }

  @Get()
  async report(@Query('days') raw = '7') {
    const days = Number(raw);
    if (![1,7,30,90].includes(days)) throw new ApiError(400,'validation','بازهٔ گزارش معتبر نیست');
    if (!this.pool || !this.env.ANALYTICS_WEBSITE_ID) throw new ApiError(503,'analytics_unavailable','سرویس رهگیری هنوز متصل نشده است');
    const prefix = `with e as (select * from website_event where website_id=$1 and created_at >= now()-($2 * interval '1 day') and tag is distinct from 'qa'),
      d as (select d.* from event_data d join e on e.event_id=d.website_event_id),
      steps as (select e.*,d.string_value as step from e join d on d.website_event_id=e.event_id and d.data_key='step' where e.event_name='step_view') `;
    const query = (text: string) => this.pool!.query(prefix + text,[this.env.ANALYTICS_WEBSITE_ID,days]).then(r=>r.rows);
    try {
      const [summary,events,goals,stages,exits,sources,daily,active] = await Promise.all([
        query(`select count(*) filter(where event_type=1)::int as pageviews,count(distinct session_id)::int as visitors,count(distinct visit_id)::int as visits,count(distinct visit_id) filter(where event_name='questionnaire_completed')::int as completed from e`),
        query(`select event_name as name,count(*)::int as count,count(distinct visit_id)::int as visits from e where event_type=2 group by event_name order by count(*) desc limit 50`),
        query(`select d.string_value as goal,count(*)::int as clicks,count(distinct e.visit_id)::int as visits from e join d on d.website_event_id=e.event_id and d.data_key='goal' where e.event_name='goal_selected' group by d.string_value order by count(*) desc`),
        query(`, times as (select e.visit_id,s.string_value as step,sum(least(30000,greatest(0,t.number_value)))/1000.0 as seconds from e join d s on s.website_event_id=e.event_id and s.data_key='step' join d t on t.website_event_id=e.event_id and t.data_key='activeMs' where e.event_name='step_time' group by e.visit_id,s.string_value), views as (select step,count(*)::int as views,count(distinct visit_id)::int as visits from steps group by step) select v.*,round(coalesce(avg(t.seconds),0),1)::float as "averageSeconds",round(coalesce(sum(t.seconds),0),1)::float as "totalSeconds" from views v left join times t on t.step=v.step group by v.step,v.views,v.visits order by v.views desc limit 200`),
        query(`, inactive as (select visit_id from e group by visit_id having max(created_at)<now()-interval '2 minutes' and count(*) filter(where event_name='phone_registered')=0), last_steps as (select distinct on(s.visit_id) s.visit_id,s.step from steps s join inactive i on i.visit_id=s.visit_id order by s.visit_id,s.created_at desc) select step,count(*)::int as visits,round(100.0*count(*)/nullif(sum(count(*)) over(),0),1)::float as percent from last_steps group by step order by count(*) desc`),
        query(`select coalesce(nullif(utm_source,''),nullif(referrer_domain,''),'direct') as source,coalesce(utm_campaign,'') as campaign,count(distinct visit_id)::int as visits from e where event_type=1 group by 1,2 order by count(distinct visit_id) desc limit 100`),
        query(`select to_char(created_at at time zone 'Asia/Tehran','YYYY-MM-DD') as day,count(*) filter(where event_type=1)::int as pageviews,count(distinct visit_id)::int as visits from e group by 1 order by 1`),
        query(`, presence as (select distinct on(visit_id) visit_id,event_name,created_at from e where event_name in ('active_heartbeat','presence_end') order by visit_id,created_at desc) select count(*)::int as count from presence where event_name='active_heartbeat' and created_at>now()-interval '25 seconds'`),
      ]);
      const totalClicks=goals.reduce((n,r)=>n+Number(r.clicks),0);
      return {days,generatedAt:new Date().toISOString(),summary:summary[0],activeSessions:active[0]?.count||0,events,goals:goals.map(r=>({...r,percent:totalClicks?Math.round(Number(r.clicks)/totalClicks*1000)/10:0})),stages,exits,sources,daily};
    } catch {
      throw new ApiError(503,'analytics_unavailable','دریافت گزارش رهگیری انجام نشد؛ دوباره تلاش کنید');
    }
  }
}
