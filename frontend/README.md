# رژیم من — یک سایت

فرانت وب یک برنامهٔ React است. سایت، پرسش‌نامه، پنل مدیریت و پنل پزشک مسیرهای همین برنامه هستند و به اپ موبایل (`app/`) وصل نیستند.

```text
frontend/src/
  main.tsx              ورود برنامه
  App.tsx               مسیرها
  features/
    site/               صفحات عمومی
    onboarding/         پرسش‌نامه
    admin/              پنل مدیریت
    doctor/             پنل پزشک
  shared/
    api/                نشست و درخواست
    ui/                 پوستهٔ مشترک پنل‌ها
    hooks/
    utils/
public/                 تصویر، فونت عمومی، مجله
```

```powershell
cd frontend
npm install
npm run dev
```

توسعه: http://localhost:3001

| مسیر | بخش |
|---|---|
| `/` | سایت |
| `/onboarding` | پرسش‌نامه |
| `/admin` | پنل مدیریت |
| `/doctor` | پنل پزشک |

API در توسعه به `http://127.0.0.1:3000` پروکسی می‌شود.
