async function campaignLinksPage() {
  const rows = await api('admin/campaign-links');
  const root = element('div', null, 'report-stack');
  const url = row => location.origin + '/go/' + row.slug;
  const toolbar = element('section', null, 'card tracking-filters');
  toolbar.append(button('ساخت لینک جدید', () => openModal('ساخت لینک تبلیغاتی', (body, dialog) => {
    const form = element('form');
    field(form, 'name', 'نام لینک').maxLength = 120;
    const source = field(form, 'source', 'کانال ورودی', 'select');
    for (const [value, title] of [['telegram','تلگرام'],['instagram','اینستاگرام'],['whatsapp','واتساپ'],['sms','پیامک'],['other','سایر']]) {
      const option = element('option', title); option.value = value; source.append(option);
    }
    const slug = field(form, 'slug', 'پسوند دلخواه لینک'); slug.dir = 'ltr'; slug.maxLength = 64; slug.pattern = '[a-z0-9]+(-[a-z0-9]+)*'; slug.placeholder = 'telegram-summer';
    help(slug, 'حروف کوچک انگلیسی، عدد و خط تیره؛ پس از ساخت قابل تغییر نیست.');
    const preview = element('p', location.origin + '/go/…', 'form-help'); preview.dir = 'ltr';
    slug.addEventListener('input', () => { preview.textContent = location.origin + '/go/' + slug.value; }); form.append(preview);
    form.append(formFooter('ساخت لینک', 'plus', dialog));
    onForm(form, async value => { await api('admin/campaign-links', 'POST', value); dialog.close(); await load(); notice('لینک ساخته شد؛ می‌توانید آن را کپی کنید'); }); body.append(form);
  }), { iconName: 'plus' }));
  root.append(toolbar, infoNote('لینک غیرفعال، بازدیدکننده را به دمو نمی‌فرستد. صفحه‌های بازشده قبلی و آدرس عمومی دمو همچنان در دسترس هستند. آمار نشست‌ها را در «رهگیری سایت دمو ← کانال‌های ورودی» بر اساس منبع و کمپین ببینید.'));
  root.append(listPanel(rows, {
    title: 'لینک‌های تبلیغاتی', description: 'تعداد بازشدن شامل درخواست ربات‌ها و پیش‌نمایش پیام‌رسان‌ها هم می‌شود؛ برابر با تعداد کاربران نیست.', pageSize: 10,
    emptyTitle: 'هنوز لینکی نساخته‌اید', emptyDescription: 'برای تبلیغات هر کانال یک پسوند جدا بسازید.', iconName: 'history',
    columns: [
      {label:'نام', key:'name'}, {label:'منبع', key:'source'},
      {label:'لینک / کمپین', render: row => { const text=element('span',url(row));text.dir='ltr';text.style.overflowWrap='anywhere';return text; }},
      {label:'وضعیت', render: row => row.active ? 'فعال' : 'غیرفعال'},
      {label:'بازشدن لینک', render: row => number(row.opens)},
      {label:'عملیات', render: row => {
        const actions=element('div',null,'form-submit');
        actions.append(button('کپی لینک', async () => { try { await navigator.clipboard.writeText(url(row)); notice('لینک کپی شد'); } catch { notice('کپی خودکار ممکن نیست؛ آدرس جدول را کپی کنید'); } }, {secondary:true}));
        actions.append(button(row.active?'غیرفعال کردن':'فعال کردن', () => openModal(row.active?'غیرفعال کردن لینک':'فعال کردن لینک', (body,dialog)=>{
          body.append(element('p',row.active?'پس از تأیید، ورودهای جدید از این لینک متوقف می‌شوند.':'این لینک دوباره به صفحه دمو هدایت خواهد شد.'));
          const form=element('form');form.append(formFooter('تأیید','check',dialog));onForm(form,async()=>{await api('admin/campaign-links/'+row.id,'PATCH',{active:!row.active});dialog.close();await load();notice('وضعیت لینک تغییر کرد');});body.append(form);
        }), {secondary:true})); return actions;
      }},
    ],
  }));
  return root;
}
