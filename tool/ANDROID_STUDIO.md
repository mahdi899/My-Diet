# پیش‌نمایش در Android Studio

Cursor روی این پوشه کار می‌کند:

`Desktop\sabzine\sabzine`

Android Studio معمولاً این پوشه را باز می‌کند:

`source\repos\سبزینه`

هر دو از یک Git هستند، اما **دو کپی روی دیسک**‌اند؛ تغییر در Cursor خودکار در Android Studio دیده نمی‌شود.

## بعد از هر تغییر (یا بعد از کار Agent)

در ترمینال همین پروژه:

```powershell
powershell -ExecutionPolicy Bypass -File tool\sync_android_studio.ps1
```

سپس در Android Studio:

1. **File → Sync Project with Gradle Files** (در صورت نیاز)
2. **Hot Restart** یا Stop و دوباره **Run** روی `lib/main.dart`

## یک مسیر واحد (پیشنهادی)

اگر می‌خواهید همیشه بدون sync پیش‌نمایش ببینید:

1. Android Studio را ببندید.
2. پوشهٔ `source\repos\سبزینه` را rename کنید (مثلاً `سبزینه_backup`).
3. در CMD با دسترسی Administrator:

```cmd
mklink /J "%USERPROFILE%\source\repos\سبزینه" "%USERPROFILE%\Desktop\sabzine\sabzine"
```

4. همان پروژه را دوباره در Android Studio باز کنید.

از آن به بعد هر تغییر در Cursor بلافاصله در Android Studio هم همان فایل است.
