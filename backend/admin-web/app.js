const $ = (id) => document.getElementById(id);
let token = null, challenge = null, current = 'dashboard';
const sections = {dashboard:'داشبورد',users:'کاربران',orders:'سفارش‌ها',requests:'درخواست‌ها',specialists:'پزشکان',reviews:'نظرات',payments:'پرداخت‌ها',messages:'پیام‌ها',tickets:'تیکت‌ها',settings:'تعرفه و پاداش','audit-logs':'تاریخچه فعالیت'};
const labels = {id:'شناسه',displayName:'نام',phone:'تلفن',role:'نقش',status:'وضعیت',createdAt:'تاریخ',userId:'کاربر',kind:'نوع',amountToman:'مبلغ (تومان)',credential:'تخصص',bio:'معرفی',capacity:'ظرفیت',active:'فعال',rating:'امتیاز',comment:'نظر',text:'متن',action:'عملیات',verificationStatus:'تأیید پزشک'};
function notice(message=''){ $('message').textContent=message; }
async function api(path, method='GET', body, retry=true){
  const response = await fetch('/v1/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','x-sabzine-client':'web',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data = await response.json().catch(()=>({}));
  if(response.status===401 && retry && token && !path.startsWith('auth/')){
    try { const session=await api('auth/refresh','POST',{},false); token=session.accessToken; return api(path,method,body,false); } catch { signedOut(); }
  }
  if(!response.ok) throw new Error(data.detail||data.message||'ارتباط با سرور ناموفق بود');
  return data;
}
function signedOut(){token=null;challenge=null;$('panel').hidden=true;$('login').hidden=false;$('totp-form').hidden=true;$('login-form').hidden=false;$('content').replaceChildren();}
function signedIn(session){if(session.role!=='admin')throw new Error('این حساب دسترسی مدیریت ندارد');token=session.accessToken;$('login').hidden=true;$('panel').hidden=false;load();}
async function submit(form,action){const button=form.querySelector('button');button.disabled=true;notice();try{await action(Object.fromEntries(new FormData(form)));}catch(e){notice(e.message);}finally{button.disabled=false;}}
$('login-form').onsubmit=(e)=>{e.preventDefault();submit(e.target,async body=>{const session=await api('auth/admin/login','POST',body);e.target.reset();if(session.totpRequired){challenge=session.totpToken;$('login-form').hidden=true;$('totp-form').hidden=false;}else signedIn(session);});};
$('totp-form').onsubmit=(e)=>{e.preventDefault();submit(e.target,async body=>{signedIn(await api('auth/totp','POST',{...body,totpToken:challenge}));e.target.reset();});};
$('logout').onclick=async()=>{try{await api('auth/logout','POST');signedOut();notice('از حساب خارج شدید');}catch(e){notice(e.message);}};
for(const [key,label] of Object.entries(sections)){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{current=key;load();};b.dataset.section=key;$('nav').append(b);}
$('refresh').onclick=()=>load();
function element(tag,text){const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;}
const number = value => new Intl.NumberFormat('fa-IR').format(value);
function navigate(section){current=section;load();}
function orderTable(rows){
  const wrap=element('div');wrap.className='table-wrap';
  if(!rows.length){wrap.append(element('p','هنوز سفارشی ثبت نشده است.'));return wrap;}
  const table=element('table'),head=element('tr');
  ['کاربر','خدمت','مبلغ','وضعیت','زمان ثبت'].forEach(text=>head.append(element('th',text)));table.append(head);
  const services={new_plan:'برنامه جدید',ai_revision:'بازنگری هوش مصنوعی',specialist_revision:'بازنگری پزشک'};
  for(const row of rows){const tr=element('tr');[row.user,services[row.serviceCode]||row.serviceCode,number(row.amountToman)+' تومان',({paid:'پرداخت‌شده',refunded:'بازپرداخت‌شده'})[row.status]||row.status,new Date(row.createdAt).toLocaleString('fa-IR')].forEach(text=>tr.append(element('td',text)));table.append(tr);}wrap.append(table);return wrap;
}
function dashboard(stats,orders){
  const view=element('div'),cards=element('div');cards.className='cards';
  for(const [title,value,description] of [
    ['کاربران',number(stats.users),number(stats.newUsers)+' عضو جدید در ۷ روز اخیر'],
    ['درآمد ۳۰ روز اخیر · تومان',number(stats.revenueToman)+' تومان',number(stats.paidOrders)+' سفارش پرداخت‌شده · سهم نقدی سفارش‌ها'],
    ['پیام‌های خوانده‌نشده',number(stats.unreadMessages),'پیام‌های پشتیبانی در انتظار پاسخ شما'],
    ['درخواست‌های امروز هوش مصنوعی',number(stats.aiToday),'تعداد تلاش‌های ثبت‌شده امروز به وقت تهران']
  ]){const card=element('section');card.className='card';const count=element('div',value);count.className='count';card.append(element('p',title),count,element('small',description));cards.append(card);}view.append(cards);
  const latest=element('section');latest.className='card';const header=element('header'),all=element('button','همه سفارش‌ها');all.className='secondary';all.onclick=()=>navigate('orders');header.append(element('h2','آخرین سفارش‌ها'),all);latest.append(header,orderTable(orders.slice(0,5)));view.append(latest);
  view.append(element('h2','دسترسی سریع'));const quick=element('div');quick.className='cards';
  for(const [key,title,description] of [['users','کاربران','حساب‌ها و اطلاعات کاربران'],['orders','سفارش‌ها','پرداخت‌ها و جزئیات سفارش'],['messages','پیام‌ها','ارتباط با کاربران'],['tickets','تیکت‌ها','درخواست‌های پشتیبانی اپ']]){const card=element('section');card.className='card';const button=element('button',title);button.className='secondary';button.onclick=()=>navigate(key);card.append(button,element('p',description));quick.append(card);}view.append(quick);return view;
}
function table(rows){const wrap=element('div');wrap.className='card table-wrap';if(!rows.length){wrap.textContent='هنوز موردی ثبت نشده است.';return wrap;}const keys=Object.keys(rows[0]).filter(k=>!['phoneE164'].includes(k));const t=element('table'),head=element('tr');keys.forEach(k=>head.append(element('th',labels[k]||k)));if(current==='reviews')head.append(element('th','بررسی'));t.append(head);for(const row of rows){const tr=element('tr');keys.forEach(k=>tr.append(element('td',typeof row[k]==='object'?JSON.stringify(row[k]):String(row[k]??'—'))));if(current==='reviews'){const td=element('td');for(const [status,label] of [['approved','تأیید'],['rejected','رد']]){const b=element('button',label);b.onclick=async()=>{b.disabled=true;try{await api('admin/reviews/'+encodeURIComponent(row.id),'POST',{status});await load();notice('نظر به‌روزرسانی شد');}catch(e){notice(e.message);b.disabled=false;}};td.append(b);}tr.append(td);}t.append(tr);}wrap.append(t);return wrap;}
function settings(){const card=element('section');card.className='card fields';card.append(element('h2','تنظیم تعرفه خدمات'));
const form=element('form');for(const [name,label,type] of [['serviceCode','کد سرویس','text'],['amountToman','مبلغ (تومان)','number']]){const l=element('label',label),i=element('input');i.name=name;i.type=type;i.required=true;if(type==='number'){i.min='0';i.step='1';}l.append(i);form.append(l);}form.append(element('button','ذخیره تعرفه'));form.onsubmit=e=>{e.preventDefault();submit(form,async body=>{await api('admin/prices','PUT',{...body,amountToman:Number(body.amountToman)});notice('تعرفه ذخیره شد');});};card.append(form,element('h2','پاداش هفتگی'));const reward=element('form'),label=element('label','مبلغ پاداش (تومان)'),input=element('input');input.type='number';input.name='amountToman';input.min='0';input.step='1';input.required=true;label.append(input);reward.append(label,element('button','ذخیره پاداش'));reward.onsubmit=e=>{e.preventDefault();submit(reward,async body=>{await api('admin/reward','PUT',{amountToman:Number(body.amountToman)});notice('پاداش ذخیره شد');});};card.append(reward);return card;}
let generation=0;
async function load(){const request=++generation, section=current;$('title').textContent=sections[section];document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.section===section));$('content').textContent='در حال دریافت اطلاعات…';notice();try{let view;if(section==='settings')view=settings();else if(section==='dashboard'){const [stats,orders]=await Promise.all([api('admin/dashboard'),api('admin/orders')]);view=dashboard(stats,orders);}else{const path=section==='specialists'?'specialists':section==='reviews'?'admin/reviews?status=pending':section==='messages'?'conversations':section==='tickets'?'admin/support-conversations':'admin/'+section;const rows=await api(path);if(request!==generation)return;view=section==='orders'?orderTable(rows):table(rows);}if(request===generation)$('content').replaceChildren(view);}catch(e){if(request===generation){$('content').textContent='دریافت اطلاعات انجام نشد. دوباره تلاش کنید.';notice(e.message);}}}
api('auth/refresh','POST',{},false).then(signedIn).catch(()=>signedOut());
