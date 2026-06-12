# Google Places برای جستجوی آدرس

برای فعال شدن جستجوی آدرس با Google Places در فرانت‌اند، داخل مسیر زیر فایل `.env.local` بسازید:

```powershell
D:\Python_project\casadekebab\frontend\.env.local
```

محتوای فایل:

```env
VITE_API_BASE=http://127.0.0.1:8000/api/restaurant
VITE_GOOGLE_MAPS_API_KEY=کلید_API_شما
```

بعد فرانت‌اند را متوقف و دوباره اجرا کنید:

```powershell
cd D:\Python_project\casadekebab\frontend
npm run dev
```

در Google Cloud بهتر است این APIها فعال باشند:

- Maps JavaScript API
- Places API

برای امنیت، کلید را در Google Cloud روی دامنه‌های مجاز محدود کنید:

- برای تست: `http://127.0.0.1:5173/*`
- برای دامنه نهایی: `https://www.casadekebab.com/*`
