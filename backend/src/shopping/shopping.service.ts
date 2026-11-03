import { Inject,Injectable } from '@nestjs/common';
import type { Pool,PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { PG_POOL } from '../database/database.js';
import { ApiError } from '../common/errors.js';
import { withTransaction } from '../common/sql.js';
import { addCivilDays,weekStartSaturday } from '../common/time.js';
import { parseCivilDate } from '../plans/views.js';
import type { MealOption } from '../plans/options.js';
import { aggregateIngredients,type IngredientInput } from './aggregate.js';

export interface ShoppingScope {weekStart:string;days:string[]}
export function shoppingScope(weekStart:string,days?:string[]):ShoppingScope {
 if(!parseCivilDate(weekStart)||weekStartSaturday(weekStart)!==weekStart)throw new ApiError(400,'validation','شروع هفته باید شنبه باشد');
 const selected=days??Array.from({length:7},(_,i)=>addCivilDays(weekStart,i));
 if(!selected.length||selected.length>7||selected.some(d=>!parseCivilDate(d)||d<weekStart||d>addCivilDays(weekStart,6))||new Set(selected).size!==selected.length)
  throw new ApiError(400,'validation','روزهای انتخاب‌شده معتبر نیست');
 return {weekStart,days:[...selected].sort()};
}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
@Injectable()
export class ShoppingService {
 constructor(@Inject(PG_POOL) private readonly pool:Pool){}
 private async projection(c:PoolClient,userId:string,scope:ShoppingScope){
  const rows=(await c.query(`with chosen as (
   select distinct on(d.civil_date) d.id,d.civil_date,v.id as version_id
   from plan_days d join plan_versions v on v.id=d.plan_version_id join plan_requests r on r.id=v.request_id
   join orders paid on paid.id=r.order_id and paid.status='paid'
   where r.user_id=$1 and d.civil_date=any($2::date[]) and v.status in ('published','superseded')
    and (v.published_at at time zone 'Asia/Tehran')::date<=d.civil_date and d.civil_date>=r.effective_from
   order by d.civil_date,v.published_at desc,v.id desc)
   select d.civil_date::text as date,d.version_id,m.id,m.meal_uid,m.title,o.document,
    s.revision as selection_revision,
    (select coalesce(jsonb_agg(jsonb_build_object('name',i.name,'quantity',i.quantity,'unit',i.unit) order by i.position),'[]') from plan_meal_items i where i.meal_id=m.id) as legacy_items
   from chosen d join plan_meals m on m.plan_day_id=d.id
   left join meal_selections s on s.user_id=$1 and s.civil_date=d.civil_date and s.meal_uid=m.meal_uid and s.version_id=d.version_id
   left join plan_meal_options o on o.meal_id=m.id and o.approved_by is not null and
    (case when s.option_uid is null then o.kind='primary' else o.option_uid=s.option_uid end)
   order by d.civil_date,m.position,m.id`,[userId,scope.days])).rows;
  const ingredients:IngredientInput[]=[];
  for(const row of rows){
   const option=row.document as MealOption|null;
   const items=option?.ingredients??row.legacy_items as Array<{name:string;quantity:number|null;unit:string|null;basis?:string;category?:string}>;
   if(!items.length)ingredients.push({name:row.title,quantity:null,unit:null,basis:'unknown',source:`${row.date}:${row.meal_uid}:missing`});
   for(let i=0;i<items.length;i++){const item=items[i]!;ingredients.push({name:item.name,quantity:item.quantity,unit:item.unit,basis:item.basis??'unknown',category:item.category,source:`${row.date}:${row.meal_uid}:${i}`});}
  }
  const flags=(await c.query('select ingredient_key,already_have,purchased,quantity from shopping_flags where user_id=$1 and week_start=$2 order by ingredient_key',[userId,scope.weekStart])).rows;
  const items=aggregateIngredients(ingredients).map(item=>{const flag=flags.find(f=>f.ingredient_key===item.key);return {...item,
   alreadyHave:flag?.already_have??false,purchased:flag?.purchased??false,
   quantityChangedSinceFlag:!!flag&&(flag.already_have||flag.purchased)&&(flag.quantity===null?item.quantity!==null:Number(flag.quantity)!==item.quantity)};});
  const covered=[...new Set(rows.map(r=>r.date))];
  const missingDays=scope.days.filter(d=>!covered.includes(d));
  const document={...scope,items,missingDays,incomplete:items.some(i=>i.incomplete)||missingDays.length>0};
  const key=hash(scope),source=hash({rows,flags});
  const saved=(await c.query(`insert into shopping_projections(user_id,projection_key,week_start,source_hash,document) values($1,$2,$3,$4,$5::jsonb)
   on conflict(user_id,projection_key) do update set source_hash=excluded.source_hash,document=excluded.document,
    revision=shopping_projections.revision+case when shopping_projections.source_hash=excluded.source_hash then 0 else 1 end,updated_at=now()
   returning revision`,[userId,key,scope.weekStart,source,JSON.stringify(document)])).rows[0];
  return {...document,projectionKey:key,revision:saved.revision};
 }
 async get(userId:string,scope:ShoppingScope){return withTransaction(this.pool,async c=>{await c.query('select id from users where id=$1 for update',[userId]);return this.projection(c,userId,scope);});}
 async flag(userId:string,scope:ShoppingScope,key:string,expectedRevision:number,alreadyHave:boolean,purchased:boolean){return withTransaction(this.pool,async c=>{
  await c.query('select id from users where id=$1 for update',[userId]);
  const current=await this.projection(c,userId,scope);
  if(current.revision!==expectedRevision)throw new ApiError(409,'lock_conflict','لیست خرید تغییر کرده است');
  const item=current.items.find(i=>i.key===key);if(!item)throw new ApiError(404,'not_found','ماده اولیه پیدا نشد');
  await c.query(`insert into shopping_flags(user_id,week_start,ingredient_key,already_have,purchased,quantity) values($1,$2,$3,$4,$5,$6)
   on conflict(user_id,week_start,ingredient_key) do update set already_have=excluded.already_have,purchased=excluded.purchased,quantity=excluded.quantity,updated_at=now()`,
  [userId,scope.weekStart,key,alreadyHave,purchased,item.quantity]);
  return this.projection(c,userId,scope);
 });}
 async share(userId:string,scope:ShoppingScope){const list=await this.get(userId,scope);const line=(s:string)=>s.replace(/[\r\n\u2028\u2029]/g,' ');return {revision:list.revision,text:list.items.map(i=>`${i.purchased?'✓':i.alreadyHave?'☑':'☐'} ${line(i.name)}: ${i.quantity??'نامشخص'} ${line(i.unit??'')} (${line(i.category)})`).join('\n'),incomplete:list.incomplete};}
}
