const icons={leaf:'<path d="M12 22V10M12 15C3 15 1 8 2 3c8 0 12 4 10 12ZM12 20c0-8 4-12 11-12 1 7-3 12-11 12Z"/>',arrow:'<path d="M19 12H5m6-6-6 6 6 6"/>',check:'<path d="m5 12 4 4L19 6"/>',chat:'<path d="M4 4h16v13H9l-5 4Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',carrot:'<path d="M8 8c-4 2-5 10-5 13 5-1 11-4 13-8L8 8Z M10 5c0-4 5-4 5-3l-2 5c5-4 8-1 8 0l-7 3M6 12l3 2m-5 2 3 1"/>',tomato:'<path d="M12 7c-9-7-15 12-3 14 12 4 19-14 6-14M12 3v5M7 5l5 3 5-3M12 8l-4 3m4-3 4 3"/>',bowl:'<path d="M2 12h20c0 11-20 11-20 0Zm5 10h10M6 10C1 3 8 0 11 7m1 3c0-7 9-9 9-4l-4 4M4 7l5 3"/>',phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-3 14h2"/>'};
const svg=n=>`<svg aria-hidden="true" viewBox="0 0 24 24">${icons[n]||icons.leaf}</svg>`;
const photos=['salad.jpg','vegetables.jpg','breakfast.jpg','bowl.jpg'];
const reviews=[{name:'سارا م.',text:'برنامه روشن بود؛ دیگر وسط هفته حدس نمی‌زنم چه بخورم. وقتی سؤال داشتم، جواب متخصص سریع رسید.'},{name:'امیر ح.',text:'غذاهای آشنا توی برنامه بود و اجراش راحت‌تر از چیزی بود که فکر می‌کردم. پیگیری روزانه انگیزه می‌دهد.'},{name:'نرگس ک.',text:'برای روزهای شلوغ، وعده‌های ساده و قابل‌اجرا پیشنهاد شد. حس می‌کنم برنامه واقعاً برای زندگی خودم نوشته شده.'},{name:'رضا ج.',text:'بعد از بررسی متخصص، چند مورد اصلاح شد و دقیقاً همان چیزی شد که می‌خواستم. گفتگو داخل اپ راحت است.'},{name:'مریم ع.',text:'پرسش‌نامه کوتاه بود ولی کامل؛ از همان هفتهٔ اول فهمیدم چقدر و چه چیزی بخورم.'},{name:'پریسا ل.',text:'قدم‌های کوچک هفتگی را دوست دارم. فشار «همه‌چیز یا هیچ» ندارم و مسیر قابل ادامه است.'}];
const reviewCard=r=>`<article class="testimonial-card"><div class="testimonial-stars" aria-label="امتیاز پنج از پنج"><span></span><span></span><span></span><span></span><span></span></div><blockquote><p>${r.text}</p></blockquote><footer class="testimonial-author"><strong>${r.name}</strong></footer></article>`;
function wireHorizontalSlider(track,itemSelector,{autoplayMs=0}={}){
  track.tabIndex=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const stepSize=()=>{const first=track.querySelector(itemSelector);if(!first)return 0;return first.getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap);};
  const isRtl=()=>getComputedStyle(track).direction==='rtl';
  const move=direction=>{const step=stepSize();if(!step)return;const sign=isRtl()?-direction:direction;track.scrollBy({left:sign*step,behavior:reduced.matches?'instant':'smooth'});};
  track.addEventListener('keydown',e=>{if(e.target!==track)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowLeft'?-1:1);}});
  let startX=0,startScroll=0,down=false,dragging=false,lastDrag=-Infinity;
  track.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;down=true;dragging=false;startX=e.clientX;startScroll=track.scrollLeft;});
  track.addEventListener('pointermove',e=>{if(!down)return;if(!dragging&&Math.abs(e.clientX-startX)>8){dragging=true;track.classList.add('dragging');track.setPointerCapture(e.pointerId);}if(dragging){e.preventDefault();track.scrollLeft=startScroll-(e.clientX-startX);}});
  const end=e=>{if(dragging){lastDrag=performance.now();if(track.hasPointerCapture(e.pointerId))track.releasePointerCapture(e.pointerId);}down=false;dragging=false;track.classList.remove('dragging');};
  track.addEventListener('pointerup',end);track.addEventListener('pointercancel',end);track.addEventListener('pointerleave',e=>{if(!dragging)down=false;});
  track.addEventListener('click',e=>{if(performance.now()-lastDrag<300){e.preventDefault();e.stopPropagation();}},true);
  if(autoplayMs>0&&!reduced.matches){
    let inView=false;
    let pagePointerDown=false;
    let sliderPaused=false;
    const items=()=>[...track.querySelectorAll(itemSelector)];
    let index=0;
    const scrollToItem=el=>{
      const r=track.getBoundingClientRect();
      const e=el.getBoundingClientRect();
      const delta=isRtl()?(e.right-r.right):(e.left-r.left);
      track.scrollBy({left:delta,behavior:reduced.matches?'auto':'smooth'});
    };
    const viewRoot=track.closest('.testimonials')||track;
    const io=new IntersectionObserver(([entry])=>{
      inView=!!entry?.isIntersecting;
    },{threshold:0.12});
    io.observe(viewRoot);
    const onPointerUp=()=>{pagePointerDown=false;};
    addEventListener('pointerdown',()=>{pagePointerDown=true;},{passive:true,capture:true});
    addEventListener('pointerup',onPointerUp,{passive:true,capture:true});
    addEventListener('pointercancel',onPointerUp,{passive:true,capture:true});
    const tick=()=>{
      if(!inView||pagePointerDown||sliderPaused||dragging||down||document.hidden)return;
      const list=items();
      if(!list.length)return;
      index=(index+1)%list.length;
      scrollToItem(list[index]);
    };
    const timer=setInterval(tick,autoplayMs);
    track.addEventListener('pointerenter',()=>{sliderPaused=true;});
    track.addEventListener('pointerleave',()=>{sliderPaused=false;});
    addEventListener('pagehide',()=>{clearInterval(timer);io.disconnect();});
  }
}
const card=(p,{showIntro=false}={})=>`<a class="article-card" href="article.html?id=${encodeURIComponent(p.id)}"><div class="photo"><img loading="lazy" src="assets/${photos[p.image]}" alt=""></div><div class="article-card-copy"><span class="tag">${escapeArticle(p.category||'')}</span><h3>${escapeArticle(p.title)}</h3>${showIntro?`<p class="article-card-excerpt">${escapeArticle(String(p.intro||'').split('\n')[0])}</p>`:''}</div></a>`;
const page=document.body.dataset.page;
document.querySelector('#header').innerHTML=`<header class="header"><nav class="nav wrap" aria-label="منوی اصلی"><a class="brand" href="index.html">${svg('leaf')}رژیم من</a><div class="navlinks" id="navlinks">${[['index.html','خانه','home'],['pricing.html','خدمات و تعرفه‌ها','pricing'],['about.html','دربارهٔ ما','about'],['articles.html','مقالات','articles'],['contact.html','تماس با ما','contact']].map(([url,label,key])=>`<a ${page===key||page==='article'&&key==='articles'?'class="active" aria-current="page"':''} href="${url}">${label}</a>`).join('')}</div><button class="btn" data-download>دانلود اپلیکیشن ${svg('arrow')}</button><button class="menu" aria-label="باز کردن منو" aria-expanded="false" aria-controls="navlinks">${svg('menu')}</button></nav></header>`;
document.querySelector('#footer').innerHTML=`<footer class="footer"><div class="wrap"><div class="footer-grid"><div class="footer-brand"><a class="brand" href="index.html">${svg('leaf')}رژیم من</a><p>غذای خوب، متناسب با زندگی تو.<br>ترکیب هوش مصنوعی و نگاه متخصص، برای یک مسیر شخصی‌تر در تغذیه.</p></div><div class="footer-links-block"><div class="footer-nav"><h3>دسترسی سریع</h3><a href="index.html">خانه</a><a href="pricing.html">خدمات و تعرفه‌ها</a><a href="about.html">دربارهٔ ما</a><a href="articles.html">مقالات</a><a href="contact.html">تماس و پشتیبانی</a><a href="terms.html">شرایط خرید</a><a href="refund.html">لغو و بازگشت وجه</a><a href="#" data-download>دانلود اپلیکیشن</a></div><div class="footer-trust" aria-label="نمادهای اعتماد"><a class="trust-badge trust-badge--1" href="https://ecunion.ir" target="_blank" rel="noopener noreferrer" title="اتحادیه کسب‌وکارهای مجازی"></a><a class="trust-badge trust-badge--2" href="https://nec.ir" target="_blank" rel="noopener noreferrer" title="نظام صنفی رایانه‌ای کشور"></a><a class="trust-badge" referrerpolicy="origin" target="_blank" rel="noopener" href="https://trustseal.enamad.ir/?id=8548363&amp;Code=ZYiwbYxH0J4xKTd1Bk19P4I9o8sD2WUa"><img referrerpolicy="origin" src="https://trustseal.enamad.ir/logo.aspx?id=8548363&amp;Code=ZYiwbYxH0J4xKTd1Bk19P4I9o8sD2WUa" alt="نماد اعتماد الکترونیکی" style="width:100%;height:100%;object-fit:contain;cursor:pointer" code="ZYiwbYxH0J4xKTd1Bk19P4I9o8sD2WUa"></a><a class="trust-badge trust-badge--4" href="https://samandehi.ir" target="_blank" rel="noopener noreferrer" title="ساماندهی"></a></div></div></div><div class="footer-bottom"><span>طراحی شده با عشق توسط آکادمی رستمی ❤️</span><span>با فکرِ حال بهتر تو ${svg('leaf')}</span></div></div></footer><dialog class="dialog" id="start-dialog"><button class="close" aria-label="بستن">×</button><div class="iconbox">${svg('phone')}</div><h2 style="margin-top:18px">شروع یک مسیر سبز</h2><p>در اپلیکیشن رژیم من می‌توانی اطلاعاتت را تکمیل کنی، برنامه بگیری و با متخصص گفتگو کنی.</p><p class="sample-label">این سایت فعلاً نسخهٔ طراحی رابط است؛ دریافت اپلیکیشن و ثبت درخواست پس از آماده شدن سرویس فعال می‌شود.</p><button class="btn light" id="dialog-done">متوجه شدم</button></dialog><div class="toast" id="toast" role="status" hidden></div>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=svg(el.dataset.icon));
document.querySelectorAll('[data-start]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();document.querySelector('#start-dialog').showModal()}));
const dialog=document.querySelector('dialog');document.querySelectorAll('.close,#dialog-done').forEach(b=>b.addEventListener('click',()=>dialog.close()));dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
document.querySelector('.menu').addEventListener('click',e=>{const b=e.currentTarget;const open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',open);document.querySelector('.navlinks').classList.toggle('open',open)});
const escapeArticle = text => String(text).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
})[char]);

const articleParagraphs = text => String(text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

function articleRichText(text) {
  return articleParagraphs(text).map(para =>
    escapeArticle(para).replace(/«([^»]+)»/g, '<strong>«$1»</strong>')
  );
}

function fillArticleText(target, text) {
  target.replaceChildren();
  for (const html of articleRichText(text)) {
    const para = document.createElement('p');
    para.className = 'article-para';
    para.innerHTML = html;
    target.append(para);
  }
}

async function magazineItems() {
  if (!magazineItems.cache) {
    const response = await fetch('magazine.json?v=1', {cache:'no-store'});
    if (!response.ok) throw new Error('دریافت مقالات ممکن نشد.');
    magazineItems.cache = (await response.json()).items || [];
  }
  return magazineItems.cache;
}

if (page === 'home') {
  const reviewsEl = document.querySelector('#home-reviews');
  if (reviewsEl) {
    reviewsEl.className = 'blog-slider testimonials-slider';
    reviewsEl.setAttribute('role', 'region');
    reviewsEl.setAttribute('aria-label', 'اسلایدر نظرات کاربران');
    reviewsEl.innerHTML = reviews.map(reviewCard).join('');
    wireHorizontalSlider(reviewsEl, '.testimonial-card', {autoplayMs:5000});
  }
}

async function renderMagazine() {
  const query = new URLSearchParams(location.search);
  if (page === 'article') {
    const slug = query.get('id') || '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('مقاله پیدا نشد.');
    const article = (await magazineItems()).find(item => item.id === slug);
    if (!article) throw new Error('مقاله پیدا نشد.');
    document.title = article.title + ' | مجلهٔ رژیم من';
    document.querySelector('#article-title').textContent = article.title;
    document.querySelector('#article-category').textContent = article.category;
    document.querySelector('#article-time').textContent = article.time + ' دقیقه مطالعه';
    document.querySelector('#article-cover').src = 'assets/' + photos[article.image];
    fillArticleText(document.querySelector('#article-intro'), article.intro);
    const content = document.querySelector('#article-content');
    const toc = document.querySelector('#toc-links');
    for (const [index, section] of article.sections.entries()) {
      const heading = document.createElement('h2');
      heading.id = 'part-' + index;
      heading.textContent = section.heading;
      const body = document.createElement('div');
      body.className = 'article-section-text';
      fillArticleText(body, section.body);
      content.append(heading, body);
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = section.heading;
      toc.append(link);
    }
    document.querySelector('#share').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href); toast('لینک مقاله کپی شد'); }
      catch { toast('آدرس مقاله را از نوار مرورگر کپی کن.'); }
    });
    const update = () => {
      const box = content.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (100 - box.top) / Math.max(1, box.height - innerHeight / 2)));
      document.querySelector('.reading-progress').style.width = progress * 100 + '%';
    };
    addEventListener('scroll', update, {passive:true});
    update();
    const related = (await magazineItems()).filter(item => item.id !== slug);
    document.querySelector('#related-posts').innerHTML = related.map(item => card(item, {showIntro:true})).join('');
    return;
  }
  const home = page === 'home';
  const target = document.querySelector(home ? '#home-posts' : '#article-grid');
  const items = await magazineItems();
  target.className = 'magazine-grid';
  target.innerHTML = items.map(item => card(item, {showIntro:true})).join('');
  if (!items.length) target.textContent = 'مقاله‌ای برای نمایش وجود ندارد.';
}

if (['home','articles','article'].includes(page)) {
  renderMagazine().catch(error => {
    const target = document.querySelector(page === 'home' ? '#home-posts' : page === 'articles' ? '#article-grid' : '#article-title');
    target.textContent = error.message;
    if (page === 'article') document.querySelector('#article-cover').hidden = true;
  });
}
document.querySelectorAll('[data-download]').forEach(button=>button.addEventListener('click',()=>toast('نسخهٔ قابل دانلود به‌زودی منتشر می‌شود.')));
