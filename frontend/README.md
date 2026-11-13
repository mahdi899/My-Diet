# رژیم من — فرانت React

یک سایت، یک بیلد، یک `node_modules`.

```powershell
cd frontend
npm install
npm run dev
npm run build
```

توسعه: http://localhost:3001

| مسیر | بخش |
|---|---|
| `/` | سایت |
| `/admin` | پنل مدیریت |
| `/onboarding` | پرسش‌نامه |
| `/doctor` | پنل پزشک |

خروجی تولید در `frontend/dist` است. سرور باید هر مسیری که فایل نیست را به `index.html` بدهد.

```nginx
location / {
  root /app/frontend;
  try_files $uri $uri/ /index.html;
}
```

API در توسعه به `http://127.0.0.1:3000` پروکسی می‌شود.
