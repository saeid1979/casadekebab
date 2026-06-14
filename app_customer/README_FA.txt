اپ مشتری Casa de Kebab Turco

مسیر پیشنهادی روی ویندوز:
D:\Python_project\casadekebab\app_customer

امکانات:
- ورود کد سفارش و شماره تلفن
- پیگیری خودکار هر 5 ثانیه
- نمایش مراحل سفارش
- نمایش اطلاعات سفارش و محصولات
- نمایش موقعیت رستوران، مشتری و پیک
- مسیر سبز رستوران تا پیک
- مسیر قرمز پیک تا مشتری
- مسیر خیابانی با OSRM و خط مستقیم جایگزین
- جلوگیری از تبدیل null به مختصات 0,0
- پیام انتظار برای GPS پیک

نصب و اجرا:

cd D:\Python_project\casadekebab\app_customer
npm install
copy .env.example .env
npm run dev

ساخت نسخه اندروید:

npm run build
npx cap add android
npx cap sync android
npx cap open android

بعد در Android Studio:
Build > Build APK(s)

نکته:
تا وقتی پیک GPS واقعی ارسال نکرده باشد، مسیر قرمز نمایش داده نمی‌شود.
