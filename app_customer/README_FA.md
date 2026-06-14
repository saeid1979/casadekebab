# Casa de Kebab Turco - App Cliente کامل

مسیر پیشنهادی نصب:
D:\Python_project\casadekebab\app_customer

قابلیت‌ها:
- نمایش منو و دسته‌بندی غذاها از Backend
- جستجوی غذا
- افزودن/حذف از سبد خرید
- ورود و ثبت‌نام یکپارچه با کد SMS
- اگر کاربر وارد نشده باشد، قبل از سفارش OTP ارسال می‌شود
- ثبت سفارش تحویل یا حضوری
- پرداخت نقدی، کارت به پیک یا پرداخت در فروشگاه
- پرداخت آنلاین فعلاً غیرفعال است
- رسید تأیید سفارش
- لیست سفارش‌های مشتری
- پیگیری مرحله‌ای سفارش
- نقشه رستوران، مشتری و پیک
- مسیر سبز رستوران تا پیک
- مسیر قرمز پیک تا مشتری
- بروزرسانی خودکار هر 5 ثانیه
- جلوگیری از نمایش مختصات null به‌صورت 0,0

## نصب

فایل ZIP را Extract کن و پوشه را به این مسیر منتقل کن:

D:\Python_project\casadekebab\app_customer

سپس:

```powershell
cd D:\Python_project\casadekebab\app_customer
npm install
Copy-Item .env.example .env
npm run dev
```

## Build اندروید

```powershell
cd D:\Python_project\casadekebab\app_customer
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

بعد در Android Studio:
Build > Build Bundle(s) / APK(s) > Build APK(s)

## نکته
برای OTP واقعی، Backend باید SMS_MODE غیر از console داشته باشد و SMS Gateway فعال باشد.
