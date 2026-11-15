"""Build an offline viewer for the four unmodified extracted Lottie files."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parent
assets = json.loads((root / "animation-assets.json").read_text(encoding="utf-8"))
names = {"jashn2.json": "جشن", "loading_tm_pink.json": "انتظار", "nowifi4.json": "بدون شبکه", "no_find_folder_pink.json": "نتیجهٔ خالی"}
items = []
for item in assets:
    path = root / "animation-assets" / item["file"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == item["sha256"]
    data = json.loads(path.read_text(encoding="utf-8"))
    # These files are vector assets. Do not silently load remote image dependencies.
    for asset in data.get("assets", []):
        if asset.get("p") and not asset["p"].startswith("data:"):
            raise ValueError("External image dependency in " + item["file"])
    items.append({**item, "title": names[item["file"]], "data": data})

payload = json.dumps(items, ensure_ascii=False).replace("<", "\\u003c")
page = """<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'">
<title>انیمیشن‌های استخراج‌شدهٔ فیبو ۴.۰.۶</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f5f1;color:#20241f;font:15px/1.9 Tahoma,Arial,sans-serif}main{max-width:1100px;margin:auto;padding:32px 24px}h1{font-size:24px;margin:0 0 8px}h2{font-size:18px;margin:0}.intro{max-width:820px;color:#50564d}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;margin-top:24px}article{background:white;border:1px solid #dfe2d9;border-radius:12px;overflow:hidden}header{padding:18px 20px 0}p{margin:6px 0}.filename{font:12px/1.6 monospace;direction:ltr;text-align:right;color:#656b60}.stage{height:300px;background:#fff;overflow:hidden}.stage svg{width:100%;height:100%}.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px 20px;border-top:1px solid #e5e7e1}button,select{font:inherit;border:1px solid #b8c5af;background:#f2f5ee;color:#263d1d;border-radius:6px;padding:4px 12px;cursor:pointer}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #3a6c26;outline-offset:3px}input{width:100%;accent-color:#3a6c26}.meta,footer{font-size:12px;color:#656b60}a{color:#325d24}footer{margin-top:24px}.frame{font:12px monospace;min-width:65px}.notice{border-right:3px solid #779266;padding-right:12px}label{font-size:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}main{padding:20px 14px}.stage{height:260px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style></head><body><main>
<h1>چهار انیمیشن واقعی استخراج‌شده از فیبو</h1>
<p class="intro">منبع: APK ارسالی، نسخهٔ ۴.۰.۶. این صفحه خود فایل‌های Lottie را پخش می‌کند؛ فیلم اجرای برنامه نیست. کد JSON فایل‌ها تغییر نکرده است و این پخش‌کننده هیچ داده‌ای به شبکه نمی‌فرستد.</p>
<p class="intro notice">شخصیت Rive و صحنه‌های اختصاصی اندروید در این پخش‌کننده نمایش داده نمی‌شوند. برای Rive، فایل <a href="animation-assets/fibo_sobo.riv" download>fibo_sobo.riv</a> جداگانه در دسترس است.</p>
<div id="grid" class="grid"></div>
<footer>پخش با <a href="https://github.com/airbnb/lottie-web/tree/v5.13.0" target="_blank" rel="noopener noreferrer">lottie-web 5.13.0</a>، نسخهٔ light ذخیره‌شده به‌صورت محلی · زمان هر دور از تعداد فریم و نرخ فریم محاسبه شده است · <a href="vendor/LOTTIE-LICENSE.md">مجوز پخش‌کننده</a></footer>
</main><script src="vendor/lottie_light.min.js"></script>
<script id="animation-data" type="application/json">__PAYLOAD__</script>
<script>
const items=JSON.parse(document.getElementById('animation-data').textContent);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const grid=document.getElementById('grid');
items.forEach((item,index)=>{
 const card=document.createElement('article');
 const header=document.createElement('header');
 const title=document.createElement('h2');title.textContent=item.title;header.append(title);
 const file=document.createElement('p');file.className='filename';file.textContent=item.file;header.append(file);
 const meta=document.createElement('p');meta.className='meta';meta.textContent=`${item.duration_seconds} ثانیه · ${item.width}×${item.height} · ${Number(item.fps.toFixed(2))} fps`;header.append(meta);
 const stage=document.createElement('div');stage.className='stage';stage.setAttribute('role','img');stage.setAttribute('aria-label',`انیمیشن ${item.title}`);
 const controls=document.createElement('div');controls.className='controls';
 const button=document.createElement('button');button.type='button';button.textContent=reduced?'پخش':'توقف';button.setAttribute('aria-pressed',String(!reduced));
 const reset=document.createElement('button');reset.type='button';reset.textContent='از اول';
 const speedLabel=document.createElement('label');speedLabel.textContent='سرعت ';
 const speed=document.createElement('select');speed.setAttribute('aria-label',`سرعت ${item.title}`);
 [0.5,1,2].forEach(s=>{const o=document.createElement('option');o.value=String(s);o.textContent=s+'×';o.selected=s===1;speed.append(o)});speedLabel.append(speed);
 const frame=document.createElement('span');frame.className='frame';frame.setAttribute('aria-hidden','true');
 const range=document.createElement('input');range.type='range';range.min='0';range.max=String(Math.max(1,Math.floor(item.data.op-item.data.ip)-1));range.value='0';range.setAttribute('aria-label',`فریم انیمیشن ${item.title}`);
 controls.append(button,reset,speedLabel,frame,range);card.append(header,stage,controls);grid.append(card);
 const anim=lottie.loadAnimation({container:stage,renderer:'svg',loop:true,autoplay:!reduced,animationData:item.data});
 let playing=!reduced;
 const showState=()=>{button.textContent=playing?'توقف':'پخش';button.setAttribute('aria-pressed',String(playing))};
 button.addEventListener('click',()=>{playing=!playing;playing?anim.play():anim.pause();showState()});
 reset.addEventListener('click',()=>{playing?anim.goToAndPlay(0,true):anim.goToAndStop(0,true)});
 speed.addEventListener('change',()=>anim.setSpeed(Number(speed.value)));
 range.addEventListener('input',()=>{playing=false;anim.goToAndStop(Number(range.value),true);showState()});
 anim.addEventListener('enterFrame',()=>{range.value=String(Math.round(anim.currentFrame));frame.textContent=Math.round(anim.currentFrame)+' / '+Math.floor(anim.totalFrames)});
 anim.addEventListener('data_failed',()=>{stage.textContent='پخش فایل ناموفق بود؛ JSON اصلی در پوشهٔ animation-assets موجود است.'});
});
</script></body></html>"""
(root / "animation-gallery.html").write_text(page.replace("__PAYLOAD__", payload), encoding="utf-8")
print("Built offline gallery with", len(items), "verified Lottie assets")
