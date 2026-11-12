/* Iranian food catalogue. Plans are built from these rows: the model only picks slugs, the server computes energy. */
const SabzineFoods = (() => {
  const categories = { breakfast: 'صبحانه', main: 'غذای اصلی', side: 'مخلفات', soup: 'سوپ و آش', salad: 'سالاد', protein: 'پروتئین', carb: 'نان و غلات', dairy: 'لبنیات', fruit: 'میوه', snack: 'میان‌وعده', drink: 'نوشیدنی', dessert: 'دسر' };
  const meals = { breakfast: 'صبحانه', lunch: 'ناهار', dinner: 'شام', snack: 'میان‌وعده' };
  const seasons = { spring: 'بهار', summer: 'تابستان', autumn: 'پاییز', winter: 'زمستان' };
  const cost = { 1: 'ارزان', 2: 'متوسط', 3: 'گران' };
  const split = text => String(text || '').split(/[,،|]/).map(s => s.trim()).filter(Boolean);
  const ingredientsText = list => (list || []).map(i => `${i.name}:${i.quantity}:${i.unit}:${i.category}`).join('\n');
  const parseIngredients = text => text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [name, quantity, unit, category] = line.split(':').map(s => s.trim());
    return { name, quantity: Number(quantity), unit, category: category || 'other' };
  });

  function checkboxes(form, name, title, options, selected) {
    const set = element('fieldset', null, 'checks'); set.append(element('legend', title));
    for (const [value, text] of Object.entries(options)) { const label = element('label', null, 'check'); const box = Object.assign(element('input'), { type: 'checkbox', name, value, checked: selected.includes(value) }); label.append(box, element('span', text)); set.append(label); }
    form.append(set); return set;
  }

  function compressFoodPhoto(file) {
    if (file.size > 8000000) return Promise.reject(new Error('عکس بزرگ‌تر از ۸ مگابایت است'));
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('عکس باز نشد')); return; }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('عکس باز نشد'));
          reader.readAsDataURL(blob);
        }, 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('عکس باز نشد')); };
      img.src = url;
    });
  }

  function foodThumb(food) {
    const img = element('img', null, 'food-thumb');
    img.alt = food.nameFa || '';
    img.width = 56;
    img.height = 56;
    const slug = String(food.slug || '');
    const bySlug = /^[a-z0-9_-]{1,80}$/.test(slug) ? '/assets/foods/' + slug + '.jpg' : '';
    const stored = food.image ? String(food.image).trim() : '';
    const sources = [...new Set([stored, bySlug].filter(Boolean))].map(src => src + (src.includes('?') ? '&' : '?') + 'v=4');
    if (!sources.length) { img.hidden = true; return img; }
    let index = 0;
    img.src = sources[0];
    img.onerror = () => {
      index += 1;
      if (index < sources.length) img.src = sources[index];
      else { img.hidden = true; img.removeAttribute('src'); }
    };
    return img;
  }

  function editor(food, onSaved) {
    const create = !food;
    openModal(create ? 'غذای جدید' : 'ویرایش «' + food.nameFa + '»', (body, dialog) => {
      const form = element('form', null, 'food-form');
      const f = food || { slug: '', nameFa: '', category: 'main', mealTypes: ['lunch'], servingLabel: '', servingG: null, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, allergens: [], tags: [], regions: [], seasons: [], costTier: 2, prepMinutes: 30, ingredients: [], active: true };
      const slug = field(form, 'slug', 'شناسهٔ لاتین (slug)', 'text', f.slug); slug.dir = 'ltr'; slug.pattern = '[a-z][a-z0-9_]{1,63}'; slug.disabled = !create;
      field(form, 'nameFa', 'نام فارسی', 'text', f.nameFa);
      const photo = element('fieldset', null, 'food-photo');
      photo.append(element('legend', 'عکس غذا'));
      const preview = element('img');
      preview.alt = f.nameFa || 'پیش‌نمایش عکس غذا';
      preview.hidden = !f.image;
      if (f.image) preview.src = f.image;
      const file = element('input');
      file.type = 'file';
      file.accept = 'image/jpeg,image/png,image/webp';
      file.setAttribute('aria-label', 'انتخاب عکس غذا');
      const image = field(form, 'image', 'یا مسیر عکس موجود', 'text', f.image || '');
      image.required = false;
      image.dir = 'ltr';
      let imageData;
      file.onchange = () => {
        const picked = file.files && file.files[0];
        if (!picked) return;
        compressFoodPhoto(picked).then(jpeg => {
          imageData = jpeg;
          preview.src = 'data:image/jpeg;base64,' + jpeg;
          preview.hidden = false;
          image.value = '';
        }).catch(error => { file.value = ''; notice(error.message); });
      };
      const clearPhoto = button('حذف عکس', () => {
        imageData = null;
        file.value = '';
        image.value = '';
        preview.hidden = true;
        preview.removeAttribute('src');
      }, { secondary: true });
      clearPhoto.type = 'button';
      photo.append(preview, file, clearPhoto, element('p', 'JPG، PNG یا WebP. عکس کنار همین غذا ذخیره می‌شود.', 'form-help'));
      form.insertBefore(photo, image.parentElement);
      help(image, 'اگر فایلی انتخاب نکنی، می‌توانی مسیر قبلی را بنویسی. مثال: /assets/foods/food_name.jpg');
      if (f.nutrition) {
        form.append(infoNote('برآورد تغذیه‌ای · ' + f.nutrition.reference + '\n' + f.nutrition.notes));
        const sourceDetails = element('details');
        sourceDetails.append(element('summary', 'منابع و مبنای محاسبهٔ مواد'));
        const sourceLink = element('a', 'منبع داده‌های USDA');
        sourceLink.href = f.nutrition.sourceUrl;
        sourceLink.target = '_blank';
        sourceLink.rel = 'noopener noreferrer';
        sourceDetails.append(sourceLink);
        for (const source of f.nutrition.ingredients || []) {
          sourceDetails.append(element('p', source.ingredient + ' · ' + number(source.grams) + ' گرم · FDC ' + source.fdcId + '\n' + source.description));
        }
        form.append(sourceDetails);
      }
      const cat = field(form, 'category', 'دسته', 'select'); for (const [v, l] of Object.entries(categories)) cat.append(Object.assign(element('option', l), { value: v, selected: v === f.category }));
      checkboxes(form, 'mealTypes', 'وعده‌های مناسب', meals, f.mealTypes);
      field(form, 'servingLabel', 'اندازهٔ یک پرس (مثلاً «۱ بشقاب (۳۰۰ گرم)»)', 'text', f.servingLabel);
      const num = (name, label, value, step = '1') => { const i = field(form, name, label, 'number', value ?? ''); i.step = step; i.min = '0'; return i; };
      const grams = num('servingG', 'وزن هر پرس (گرم، اختیاری)', f.servingG); grams.required = false;
      num('kcal', 'کیلوکالری هر پرس', f.kcal); num('proteinG', 'پروتئین (گرم)', f.proteinG, '0.1'); num('carbsG', 'کربوهیدرات (گرم)', f.carbsG, '0.1'); num('fatG', 'چربی (گرم)', f.fatG, '0.1'); num('fiberG', 'فیبر (گرم)', f.fiberG, '0.1');
      const lists = [['allergens', 'آلرژن‌ها (کد انگلیسی، با ویرگول: gluten, dairy, nuts, egg, seafood, soy, sesame)', f.allergens], ['tags', 'برچسب‌ها (meat, poultry, fish, vegetarian, vegan, high_protein, light, traditional …)', f.tags], ['regions', 'مناطق (مثلاً gilan, khorasan)', f.regions]];
      for (const [name, label, value] of lists) { const i = field(form, name, label, 'text', value.join(', ')); i.required = false; i.dir = 'ltr'; }
      checkboxes(form, 'seasons', 'فصل‌ها (خالی = همهٔ سال)', seasons, f.seasons);
      const tier = field(form, 'costTier', 'سطح هزینه', 'select'); for (const [v, l] of Object.entries(cost)) tier.append(Object.assign(element('option', l), { value: v, selected: Number(v) === f.costTier }));
      num('prepMinutes', 'زمان آماده‌سازی (دقیقه)', f.prepMinutes);
      const ing = field(form, 'ingredients', 'مواد (هر خط: نام:مقدار:واحد:گروه)', 'textarea', ingredientsText(f.ingredients)); ing.rows = 6; ing.dir = 'rtl';
      help(ing, 'واحد: g kg ml l piece serving cup tbsp tsp · گروه: produce dairy protein grains pantry other');
      const active = field(form, 'active', 'وضعیت', 'select'); for (const [v, l] of [['true', 'فعال'], ['false', 'غیرفعال']]) active.append(Object.assign(element('option', l), { value: v, selected: String(f.active) === v }));
      form.append(formFooter('ذخیره', 'check', dialog)); body.append(form);
      onForm(form, async () => {
        const data = new FormData(form);
        const payload = {
          slug: slug.value.trim(), nameFa: data.get('nameFa'), category: data.get('category'), mealTypes: data.getAll('mealTypes'), servingLabel: data.get('servingLabel'),
          servingG: data.get('servingG') === '' ? null : Number(data.get('servingG')), kcal: Number(data.get('kcal')), proteinG: Number(data.get('proteinG')), carbsG: Number(data.get('carbsG')), fatG: Number(data.get('fatG')), fiberG: Number(data.get('fiberG')),
          allergens: split(data.get('allergens')), tags: split(data.get('tags')), regions: split(data.get('regions')), seasons: data.getAll('seasons'), costTier: Number(data.get('costTier')), prepMinutes: Number(data.get('prepMinutes')),
          ingredients: parseIngredients(String(data.get('ingredients') || '')), active: data.get('active') === 'true',
          image: image.value.trim() || null,
        };
        if (imageData) {
          payload.imageData = imageData;
          try {
            const saved = await fetch('/local/food-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: payload.slug, jpeg: imageData }) });
            if (saved.ok) payload.image = (await saved.json()).image;
          } catch { /* The API stores the photo when this preview writer is not available. */ }
        }
        if (f.nutrition && (['kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'servingG'].some(key => payload[key] !== f[key]) || JSON.stringify(payload.ingredients) !== JSON.stringify(f.ingredients))) {
          payload.nutrition = null;
          payload.tags = payload.tags.filter(tag => tag !== 'recipe_estimate');
        }
        await api(create ? 'admin/foods' : 'admin/foods/' + encodeURIComponent(food.slug), create ? 'POST' : 'PUT', payload);
        dialog.close(); notice(create ? 'غذا افزوده شد' : 'غذا ذخیره شد'); await onSaved();
      });
    }, { iconName: 'clipboard' });
  }

  function importModal(onDone) {
    openModal('درون‌ریزی فایل CSV', (body, dialog) => {
      const form = element('form'); const file = field(form, 'file', 'فایل CSV (همان قالب خروجی)', 'file'); file.accept = '.csv,text/csv';
      form.append(infoNote('غذاهای موجود (با همان slug) به‌روز می‌شوند و غذاهای تازه افزوده می‌شوند. در صورت هر خطا هیچ ردیفی ذخیره نمی‌شود.'), formFooter('درون‌ریزی', 'send', dialog)); body.append(form);
      onForm(form, async () => {
        const text = await file.files[0].text();
        const result = await api('admin/foods/import', 'POST', { csv: text });
        dialog.close(); notice(`${number(result.created)} غذای جدید و ${number(result.updated)} به‌روزرسانی`); await onDone();
      });
    }, { iconName: 'send' });
  }

  async function exportCsv() {
    const { csv } = await api('admin/foods/export');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'sabzine-foods.csv' }); document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadJson(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function replaceModal(onDone) {
    openModal('جایگزینی کاتالوگ غذا', (body, dialog) => {
      const form = element('form');
      const file = field(form, 'catalog', 'فایل JSON غذاها و عکس‌ها', 'file');
      file.accept = '.json,application/json';
      const preview = element('div', null, 'report-stack');
      const submit = button('بررسی فایل', null, { iconName: 'clipboard' });
      submit.type = 'submit';
      form.append(infoNote('جایگزینی، غذاهای فعلی را از کاتالوگ حذف و تمام غذاهای فایل را وارد می‌کند. نسخهٔ کامل قبل از تغییر روی سرور ذخیره و برایت دانلود می‌شود.'), preview, submit);
      let prepared = null;
      file.onchange = () => {
        prepared = null;
        preview.replaceChildren();
        submit.textContent = 'بررسی فایل';
      };
      onForm(form, async () => {
        if (!prepared) {
          if (!file.files[0] || file.files[0].size > 2000000) throw new Error('فایل JSON حداکثر دو مگابایت را انتخاب کن');
          const data = JSON.parse(await file.files[0].text());
          if (!Array.isArray(data.foods) || data.foods.length < 1 || data.foods.length > 1000 || new Set(data.foods.map(food => food.slug)).size !== data.foods.length) throw new Error('فهرست غذاها خالی، تکراری یا نامعتبر است');
          for (const food of data.foods) {
            if (!food.nameFa || !food.servingLabel || !Number.isFinite(food.kcal) || !Array.isArray(food.ingredients) || !food.ingredients.length) throw new Error('نام، اندازهٔ پرس، انرژی و مواد همهٔ غذاها باید کامل باشد');
          }
          const { revision } = await api('admin/foods/revision');
          prepared = { foods: data.foods, expectedRevision: revision, operationId: crypto.randomUUID() };
          preview.append(element('strong', number(data.foods.length) + ' غذا آمادهٔ جایگزینی است'));
          for (const food of data.foods) {
            const row = element('div', null, 'card');
            if (food.image) {
              if (!/^\/assets\/foods\/[a-z0-9_-]+\.jpg$/.test(food.image)) throw new Error('مسیر عکس معتبر نیست');
              const img = element('img');
              img.src = food.image;
              img.alt = food.nameFa;
              img.width = 64;
              img.height = 64;
              img.loading = 'lazy';
              row.append(img);
            }
            row.append(element('strong', food.nameFa), element('p', food.servingLabel + ' · ' + number(food.kcal) + ' kcal'));
            if (food.nutrition?.originalPromptKcal != null) row.append(element('small', 'کالری تقریبی فایل اولیه: ' + number(food.nutrition.originalPromptKcal) + ' · مقدار بالا برای دستور و پرس مشخص محاسبه شده است.'));
            preview.append(row);
          }
          submit.textContent = 'تأیید حذف غذاهای فعلی و جایگزینی';
          return;
        }
        const previous = await api('admin/foods/export.json');
        const result = await api('admin/foods/replace', 'POST', prepared);
        downloadJson(previous, 'food-catalog-backup-' + result.backupId + '.json');
        dialog.close();
        notice(number(result.replaced) + ' غذا جایگزین شد؛ نسخهٔ پشتیبان ' + result.backupId);
        await onDone();
      });
      body.append(form);
    }, { iconName: 'clipboard' });
  }

  async function page() {
    const view = element('div', null, 'report-stack');
    const filters = { q: '', category: '', active: '' };
    const bar = element('form', null, 'ob-filters'); bar.onsubmit = e => e.preventDefault();
    const search = searchField('جستجوی نام یا slug…'); let timer; search.input.oninput = () => { clearTimeout(timer); timer = setTimeout(() => { filters.q = search.input.value.trim(); void reload(); }, 300); }; bar.append(search.wrap);
    const pick = (name, title, options) => { const s = element('select'); s.setAttribute('aria-label', title); s.append(Object.assign(element('option', title), { value: '' })); for (const [v, l] of options) s.append(Object.assign(element('option', l), { value: v })); s.onchange = () => { filters[name] = s.value; void reload(); }; bar.append(s); };
    pick('category', 'همهٔ دسته‌ها', Object.entries(categories)); pick('active', 'همهٔ وضعیت‌ها', [['true', 'فعال'], ['false', 'غیرفعال']]);
    const tools = element('div', null, 'actions'); tools.append(button('غذای جدید', () => editor(null, reload), { iconName: 'plus' }), button('درون‌ریزی CSV', () => importModal(reload), { secondary: true, iconName: 'send' }), button('خروجی CSV', exportCsv, { secondary: true, iconName: 'clipboard' }));
    tools.append(button('پشتیبان کامل JSON', async () => downloadJson(await api('admin/foods/export.json'), 'food-catalog-backup.json'), { secondary: true, iconName: 'clipboard' }), button('جایگزینی کاتالوگ', () => replaceModal(reload), { secondary: true, iconName: 'send' }));
    const holder = element('div'); let items = [], cursor = null;
    const draw = () => {
      holder.replaceChildren(listPanel(items, { title: 'کاتالوگ غذاهای ایرانی', description: number(items.length) + ' غذا بارگذاری شد', search: false, pageSize: 15, iconName: 'clipboard', emptyTitle: 'غذایی پیدا نشد', columns: [
        { label: 'عکس', className: 'food-thumb-cell', render: r => foodThumb(r) },
        { label: 'غذا', render: r => { const w = element('div'); w.append(element('strong', r.nameFa), element('small', r.slug, 'ltr')); if (r.nutrition?.method === 'recipe_estimate') w.append(element('small', 'برآورد برای پرس مشخص')); return w; } }, { label: 'دسته', render: r => categories[r.category] || r.category },
        { label: 'وعده‌ها', render: r => r.mealTypes.map(m => meals[m] || m).join('، ') }, { label: 'پرس', render: r => r.servingLabel }, { label: 'انرژی', render: r => number(r.kcal) + ' kcal' },
        { label: 'پ / ک / چ', render: r => `${number(r.proteinG)} / ${number(r.carbsG)} / ${number(r.fatG)}` }, { label: 'آلرژن', render: r => r.allergens.join('، ') || '—' }, { label: 'هزینه', render: r => cost[r.costTier] },
        { label: 'وضعیت', render: r => badge(r.active ? 'active' : 'suspended', r.active ? 'فعال' : 'غیرفعال') },
        { label: '', render: r => { const a = element('div', null, 'cell-actions'); a.append(button('ویرایش', () => editor(r, reload), { secondary: true, iconName: 'sliders' }), button(r.active ? 'غیرفعال' : 'فعال', async () => { await api(`admin/foods/${encodeURIComponent(r.slug)}/active`, 'POST', { active: !r.active }); notice('وضعیت تغییر کرد'); await reload(); }, { secondary: true })); return a; } },
      ] }));
      if (cursor) holder.append(button('بارگذاری بیشتر', async () => { await fetchPage(true); draw(); }, { secondary: true, iconName: 'plus' }));
    };
    const fetchPage = async append => {
      const params = new URLSearchParams({ limit: '100' }); for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v); if (append && cursor) params.set('cursor', cursor);
      const result = await api('admin/foods?' + params); items = append ? items.concat(result.items) : result.items; cursor = result.nextCursor;
    };
    async function reload() { try { await fetchPage(false); draw(); } catch (error) { notice(error.message, 'error'); } }
    await fetchPage(false); draw(); view.append(tools, bar, holder); return view;
  }
  return { page };
})();
