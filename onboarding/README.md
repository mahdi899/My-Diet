# آنبوردینگ وب — مسیر برنامه غذایی

نسخهٔ تم‌دار فایل `sabzine.html` با رنگ‌ها و تایپوگرافی سایت عمومی سبزینه.

## فایل‌ها

- `questionnaire-data.js` — سوالات دسته‌بندی‌شده از «پرسشنامه اصلی.docx»
- `theme.css` — تم سبزینه (کرم `#F7F8F0`، سبز `#205638`، sage `#EAF1DC`)
- `assets/` — فونت Vazirmatn، نشان و تصویر قهرمان

## بازسازی

پس از تغییر منبع روی Desktop:

```powershell
node C:\Users\Mohamadi\Desktop\sabzine\sabzine\tool\build_sabzine_onboarding.cjs
```

## پیش‌نمایش

```powershell
cd C:\Users\Mohamadi\Desktop\sabzine\sabzine\onboarding
python -m http.server 8790
```

سپس در مرورگر: `http://127.0.0.1:8790/`

یا از پیش‌نمایش یکپارچهٔ پروژه: `http://127.0.0.1:8781/onboarding/` (اگر سرور preview_frontend در حال اجراست).
