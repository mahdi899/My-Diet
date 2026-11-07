async function articlesPage() {
  const root = element('div', null, 'report-stack');
  const toolbar = element('section', null, 'card tracking-filters');
  const status = field(toolbar, 'status', 'وضعیت', 'select');
  for (const [value, label] of [['', 'همه'], ['draft', 'پیش‌نویس'], ['published', 'منتشرشده']]) {
    status.append(Object.assign(element('option', label), { value }));
  }
  const content = element('div');
  let page = 1;
  let generation = 0;

  function editor(article) {
    openModal(article ? 'ویرایش مقاله' : 'افزودن مقاله', (body, dialog) => {
      const form = element('form');
      const slug = field(form, 'slug', 'شناسهٔ آدرس', 'text', article?.id ?? '');
      slug.dir = 'ltr';
      slug.pattern = '[a-z0-9]+(-[a-z0-9]+)*';
      slug.maxLength = 64;
      slug.readOnly = Boolean(article);
      help(slug, 'حروف کوچک انگلیسی، عدد و خط تیره، مانند weekly-planning');
      field(form, 'title', 'عنوان مقاله', 'text', article?.title ?? '').maxLength = 120;
      field(form, 'category', 'دسته‌بندی', 'text', article?.category ?? '').maxLength = 40;
      const image = field(form, 'image', 'تصویر روی جلد', 'select');
      ['سالاد', 'سبزیجات', 'صبحانه', 'کاسهٔ غذا'].forEach((label, value) => {
        image.append(Object.assign(element('option', label), { value: String(value) }));
      });
      image.value = String(article?.image ?? 0);
      const minutes = field(form, 'readingMinutes', 'زمان مطالعه (دقیقه)', 'number', String(article?.readingMinutes ?? 5));
      minutes.min = '1';
      minutes.max = '60';
      field(form, 'intro', 'خلاصه', 'textarea', article?.intro ?? '').maxLength = 400;
      const sections = element('div', null, 'report-stack');
      const add = button('افزودن بخش', () => addSection(), { secondary: true, iconName: 'plus' });
      const sync = () => {
        add.disabled = sections.children.length >= 8;
        for (const group of sections.children) group.querySelector('button').disabled = sections.children.length === 1;
      };
      function addSection(section) {
        const group = element('fieldset');
        group.append(element('legend', 'بخش مقاله'));
        field(group, 'heading', 'تیتر بخش', 'text', section?.heading ?? '').maxLength = 120;
        const bodyText = field(group, 'body', 'متن بخش', 'textarea', section?.body ?? '');
        bodyText.maxLength = 2000;
        bodyText.rows = 5;
        group.append(button('حذف بخش', () => { group.remove(); sync(); }, { secondary: true }));
        sections.append(group);
        sync();
      }
      for (const section of article?.sections ?? [{}]) addSection(section);
      const preview = element('details');
      const previewBody = element('div');
      preview.append(element('summary', 'پیش‌نمایش متن'), previewBody);
      preview.addEventListener('toggle', renderPreview);
      form.addEventListener('input', renderPreview);
      function renderPreview() {
        if (!preview.open) return;
        previewBody.replaceChildren(element('h2', form.elements.title.value), element('p', form.elements.intro.value));
        for (const group of sections.children) {
          previewBody.append(element('h3', group.querySelector('[name=heading]').value), element('p', group.querySelector('[name=body]').value));
        }
      }
      form.append(sections, add, preview, formFooter(article?.status === 'published' ? 'ذخیره تغییرات مقالهٔ منتشرشده' : 'ذخیره پیش‌نویس', 'check', dialog));
      onForm(form, async data => {
        const payload = {
          title: data.title, category: data.category, image: Number(data.image),
          readingMinutes: Number(data.readingMinutes), intro: data.intro,
          sections: Array.from(sections.children, group => ({
            heading: group.querySelector('[name=heading]').value,
            body: group.querySelector('[name=body]').value,
          })),
        };
        if (article) await api('admin/articles/' + article.id, 'PUT', payload);
        else await api('admin/articles', 'POST', { ...payload, slug: data.slug });
        dialog.close();
        notice('مقاله ذخیره شد');
        await refresh();
      });
      body.append(form);
    }, { iconName: 'clipboard' });
  }

  function changeStatus(row) {
    const publish = row.status === 'draft';
    const label = publish ? 'انتشار مقاله' : 'لغو انتشار';
    openModal(label, (body, dialog) => {
      const form = element('form');
      form.append(element('p', row.title), formFooter(label, 'check', dialog));
      onForm(form, async () => {
        await api('admin/articles/' + row.id + '/' + (publish ? 'publish' : 'unpublish'), 'POST');
        dialog.close();
        notice(publish ? 'مقاله منتشر شد' : 'مقاله به پیش‌نویس برگشت');
        await refresh();
      });
      body.append(form);
    });
  }

  async function refresh() {
    const ticket = ++generation;
    content.replaceChildren(skeleton());
    try {
      const result = await api('admin/articles?' + new URLSearchParams({ page, status: status.value }));
      if (ticket !== generation) return;
      if (!result.items.length && page > 1) { page--; return refresh(); }
      const pager = element('div', null, 'form-submit');
      const prev = button('صفحهٔ قبل', () => { page--; void refresh(); }, { secondary: true });
      const next = button('صفحهٔ بعد', () => { page++; void refresh(); }, { secondary: true });
      prev.disabled = page === 1;
      next.disabled = page * result.pageSize >= result.total;
      pager.append(prev, element('span', 'صفحهٔ ' + number(page) + ' · ' + number(result.total) + ' مقاله'), next);
      content.replaceChildren(listPanel(result.items, {
        title: 'فهرست مقالات', pageSize: result.pageSize, compact: true,
        emptyTitle: 'مقاله‌ای در این وضعیت نیست',
        columns: [
          { label: 'عنوان', key: 'title' }, { label: 'دسته‌بندی', key: 'category' },
          { label: 'وضعیت', render: row => row.status === 'published' ? 'منتشرشده' : 'پیش‌نویس' },
          { label: 'عملیات', render: row => {
            const actions = element('div', null, 'form-submit');
            actions.append(button('ویرایش', () => editor(row), { secondary: true }),
              button(row.status === 'draft' ? 'انتشار' : 'لغو انتشار', () => changeStatus(row), { secondary: true }));
            if (row.status === 'published') {
              const link = element('a', 'نمایش در سایت');
              link.href = '/article.html?id=' + encodeURIComponent(row.id);
              link.target = '_blank';
              link.rel = 'noopener';
              actions.append(link);
            }
            return actions;
          } },
        ],
      }), pager);
    } catch (error) {
      if (ticket === generation) content.replaceChildren(infoNote(error.message));
    }
  }

  status.onchange = () => { page = 1; void refresh(); };
  toolbar.append(button('افزودن مقاله', () => editor(), { iconName: 'plus' }));
  root.append(toolbar, content);
  await refresh();
  return root;
}
