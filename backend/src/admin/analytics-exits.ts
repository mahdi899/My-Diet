/** Appended to the report's e/d/steps CTEs. Legacy paths are reconstructed from
 * navigation; new paths carry a per-tab journey UUID across demo pages. */
export const analyticsExitsSql = `,
  events_with_journey as (
    select e.*, j.string_value as journey
    from e left join d j on j.website_event_id=e.event_id and j.data_key='journey'
  ),
  legacy_views as (
    select s.*, lag(step) over w as previous_step
    from steps s join events_with_journey e using(event_id)
    where e.journey is null
    window w as (partition by s.visit_id order by s.created_at,s.event_id)
  ),
  boundaries as (
    select *, case
      when previous_step is null then 1
      when step='intro' and previous_step<>'intro' then 1
      when step='goals' and previous_step not in ('intro','goals') then 1
      when step='quiz' and previous_step not in ('intro','goals') then 1
      when step like 'question:%' and previous_step like 'question:%'
        and split_part(step,':',2)<>split_part(previous_step,':',2) then 1
      else 0 end as starts_path
    from legacy_views
  ),
  legacy_starts as (
    select visit_id,created_at,event_id,
      lead(created_at) over w as ends_at,lead(event_id) over w as ends_id
    from boundaries where starts_path=1
    window w as (partition by visit_id order by created_at,event_id)
  ),
  path_events as (
    select e.*, 'new:'||e.journey as path from events_with_journey e where journey is not null
    union all
    select e.*, 'legacy:'||s.event_id::text as path
    from events_with_journey e join legacy_starts s on s.visit_id=e.visit_id
      and (e.created_at,e.event_id)>=(s.created_at,s.event_id)
      and (s.ends_at is null or (e.created_at,e.event_id)<(s.ends_at,s.ends_id))
    where e.journey is null
  ),
  inactive_paths as (
    select visit_id,path from path_events group by visit_id,path
    having max(created_at)<now()-interval '2 minutes'
      and count(*) filter(where event_name='phone_registered')=0
  ),
  last_steps as (
    select distinct on(p.visit_id,p.path) p.visit_id,p.path,s.step
    from path_events p join inactive_paths i using(visit_id,path)
    join steps s on s.event_id=p.event_id
    order by p.visit_id,p.path,p.created_at desc,p.event_id desc
  )
  select step,count(*)::int as visits,
    round(100.0*count(*)/nullif(sum(count(*)) over(),0),1)::float as percent
  from last_steps group by step order by count(*) desc,step`;
