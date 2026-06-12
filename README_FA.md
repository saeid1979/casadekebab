# Casa de Kebab Turco - v6

این نسخه شامل سایت سفارش آنلاین، پنل سفارش‌های زنده، اتصال تلگرام، مدیریت پیک و صفحه مخصوص پیک است.

## مسیر پیشنهادی نصب

فایل ZIP را داخل مسیر زیر Extract کن:

```powershell
D:\Python_project\
```

ساختار نهایی:

```text
D:\Python_project\casadekebab
├── backend
├── frontend
└── README_FA.md
```

## اجرای Backend

```powershell
cd D:\Python_project\casadekebab\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py makemigrations restaurant
python manage.py migrate
python manage.py seed_menu
python manage.py createsuperuser
python manage.py runserver
```

اگر قبلاً دیتابیس ساخته‌ای، باز هم این‌ها را بزن:

```powershell
python manage.py makemigrations restaurant
python manage.py migrate
```

چون در نسخه v6 مدل Rider و اتصال سفارش به پیک اضافه شده است.

## اجرای Frontend

در PowerShell دوم:

```powershell
cd D:\Python_project\casadekebab\frontend
copy .env.example .env
npm install
npm run dev
```

## آدرس‌های مهم

```text
سایت سفارش مشتری:
http://127.0.0.1:5173/

سفارش‌های زنده و مدیریت پیک:
http://127.0.0.1:5173/orders-live

صفحه مخصوص پیک:
http://127.0.0.1:5173/rider

ادمین Django:
http://127.0.0.1:8000/admin/

API منو:
http://127.0.0.1:8000/api/restaurant/menu/
```

## تنظیم Telegram

فایل زیر را باز کن:

```text
D:\Python_project\casadekebab\backend\.env
```

این مقادیر را تنظیم کن:

```env
TELEGRAM_ENABLED=True
TELEGRAM_BOT_TOKEN=توکن_ربات
TELEGRAM_CHAT_ID=شناسه_چت_یا_گروه
```

بعد بک‌اند را خاموش و روشن کن:

```powershell
Ctrl + C
python manage.py runserver
```

برای تست برو به:

```text
http://127.0.0.1:5173/orders-live
```

و دکمه Test Telegram را بزن.

## امکانات جدید v6

- ساخت مدل Rider برای پیک‌ها
- ثبت پیک از صفحه سفارش‌های زنده
- اختصاص سفارش به پیک
- تغییر خودکار وضعیت سفارش به En reparto هنگام اختصاص پیک
- صفحه مخصوص پیک در مسیر `/rider`
- ورود پیک با شماره تلفن
- نمایش سفارش‌های اختصاص داده‌شده به پیک
- باز کردن آدرس مشتری در Google Maps
- تماس مستقیم با مشتری از موبایل
- ارسال موقعیت GPS پیک به بک‌اند
- تغییر وضعیت سفارش توسط پیک به En reparto یا Entregado

## روش تست پیک

1. برو به:

```text
http://127.0.0.1:5173/orders-live
```

2. در بخش Repartidores یک پیک اضافه کن، مثلاً:

```text
Nombre: Ali
Teléfono: 613473564
```

3. یک سفارش تستی از سایت ثبت کن.
4. در صفحه سفارش‌های زنده، سفارش را به پیک اختصاص بده.
5. برو به:

```text
http://127.0.0.1:5173/rider
```

6. شماره پیک را وارد کن و Enter/Entrar بزن.
7. سفارش اختصاص داده‌شده را می‌بینی.
8. با دکمه Abrir Google Maps مسیر مشتری را باز کن.
9. وضعیت را به En reparto یا Entregado تغییر بده.

## دامنه نهایی

برای دامنه نهایی:

```text
www.casadekebab.com
casadekebab.com
```

در مرحله انتشار باید مقدارهای زیر درست شوند:

```env
ALLOWED_HOSTS=127.0.0.1,localhost,casadekebab.com,www.casadekebab.com
CORS_ALLOWED_ORIGINS=https://casadekebab.com,https://www.casadekebab.com
VITE_API_BASE=https://www.casadekebab.com/api/restaurant
```

## نسخه v7 - حساب مشتری، داشبورد و فاکتور چاپی

در این نسخه اضافه شده است:

- صفحه حساب مشتری در مسیر `/account`
- مشاهده سفارش‌های قبلی براساس شماره تلفن مشتری
- صفحه داشبورد فروش در مسیر `/dashboard`
- خلاصه فروش روز، تعداد سفارش‌ها، سفارش‌های فعال، فروش کل
- لیست محصولات پرفروش روز
- تفکیک پرداخت‌های روز براساس روش پرداخت
- صفحه فاکتور چاپی در مسیر `/receipt/CDKT-000001`
- دکمه Ticket در صفحه سفارش‌های زنده
- دکمه Mark paid / Marcar pagado برای تغییر وضعیت پرداخت سفارش

آدرس‌های مهم:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/orders-live
http://127.0.0.1:5173/rider
http://127.0.0.1:5173/account
http://127.0.0.1:5173/dashboard
http://127.0.0.1:5173/receipt/CDKT-000001
```

بعد از Extract اگر قبلاً دیتابیس داری فقط این‌ها را اجرا کن:

```powershell
cd D:\Python_project\casadekebab\backend
venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations restaurant
python manage.py migrate
python manage.py runserver
```

فرانت‌اند:

```powershell
cd D:\Python_project\casadekebab\frontend
npm install
npm run dev
```


## نسخه v10 - تنظیمات رستوران و کد تخفیف

در این نسخه اضافه شد:

- تنظیم باز/بسته بودن رستوران
- تنظیم هزینه ارسال، حداقل سفارش ارسال و ارسال رایگان
- مدیریت کد تخفیف از پنل React
- کد پیش‌فرض `PRIMERPEDIDO` با ۱۰ درصد تخفیف برای اولین سفارش
- اعمال تخفیف در Checkout

آدرس مدیریت تنظیمات:

```text
http://127.0.0.1:5173/settings-admin
```

APIهای جدید:

```text
GET  /api/restaurant/settings/public/
PATCH /api/restaurant/admin/settings/
GET  /api/restaurant/admin/coupons/
POST /api/restaurant/admin/coupons/
PATCH /api/restaurant/admin/coupons/<id>/
POST /api/restaurant/coupons/validate/
```


## نسخه v11: پرداخت آنلاین آزمایشی

در این نسخه مسیر پرداخت آنلاین دمو اضافه شده است. این پرداخت پول واقعی جابه‌جا نمی‌کند و فقط برای تست جریان سفارش است.

مسیرهای جدید بک‌اند:

```text
POST /api/restaurant/payments/demo/<ORDER_CODE>/create/
POST /api/restaurant/payments/demo/<ORDER_CODE>/confirm/
GET  /api/restaurant/payments/demo/<ORDER_CODE>/status/
```

مسیر جدید فرانت‌اند:

```text
/payment-demo/CDKT-000001
```

برای تست، در Checkout گزینه `Pago online` را انتخاب کن. بعد از ثبت سفارش به صفحه پرداخت دمو منتقل می‌شوی. با دکمه `Simular pago correcto` وضعیت پرداخت به `paid` تغییر می‌کند.

بعداً همین ساختار را به Stripe یا Redsys/BBVA وصل می‌کنیم.


## نسخه v12 - گرافیک و خوانایی
- هدر و Hero جدید با 4 عکس غذا
- فونت های خواناتر Inter و Poppins
- رنگ بندی گرم متناسب با برند Casa de Kebab Turco
- تصویر پیش فرض برای آیتم هایی که هنوز عکس آپلود نشده دارند
- رفع import مدل های RestaurantSettings و Coupon در admin.py


## نسخه v13 - نقشه رایگان و موقعیت مشتری
- اضافه شدن Leaflet و OpenStreetMap برای نمایش نقشه بدون Google Maps API
- جستجوی آدرس با Nominatim محدود به Salamanca
- دکمه استفاده از موقعیت فعلی مشتری
- انتخاب نقطه تحویل با کلیک روی نقشه
- محاسبه فاصله تقریبی تا رستوران و کنترل محدوده ارسال
- ذخیره latitude و longitude سفارش در بک‌اند


## v13.1 - اصلاح جستجوی آدرس
- جستجو با چند روش مختلف در Nominatim
- محدود کردن نتایج به محدوده Salamanca با viewbox
- جلوگیری از نمایش شهرهای دیگر مثل Madrid, Valencia, Logroño
- امکان ادامه سفارش با آدرس دستی و انتخاب نقطه روی نقشه


## نسخه v13.2 - آدرس ثابت رستوران و لوگو روی نقشه
- آدرس رستوران همیشه در بخش نقشه checkout نمایش داده می‌شود.
- لوگوی Casa de Kebab Turco به عنوان نشانگر رستوران روی نقشه استفاده شد.
- کارت آدرس رستوران با لوگو به بخش ارسال اضافه شد.


## نسخه v13.3 - موقعیت دقیق رستوران
مختصات دقیق رستوران روی نقشه به این مقدار تغییر کرد:

```text
40.974836942683254, -5.649336331469509
```

از این به بعد لوگوی رستوران روی همین نقطه نمایش داده می‌شود و فاصله مشتری تا همین نقطه محاسبه می‌شود.


## نسخه v14 - پیشنهاد آدرس و مسیر واقعی
- پیشنهاد آدرس هنگام تایپ با تأخیر کوتاه برای جلوگیری از درخواست زیاد
- محاسبه مسیر خیابانی واقعی با OSRM demo service
- نمایش خط مسیر روی نقشه؛ اگر مسیر پیدا نشود، خط مستقیم به‌عنوان fallback نمایش داده می‌شود
- نمایش فاصله مسیر، زمان تقریبی رسیدن پیک و هزینه ارسال
- ذخیره route_distance_km و route_duration_min داخل سفارش
- هزینه ارسال پویا: پایه 1.50 یورو، تا 2 کیلومتر شامل قیمت پایه، سپس 0.70 یورو برای هر کیلومتر اضافه؛ ارسال رایگان طبق تنظیمات رستوران


## نسخه v14.1
- حذف نمایش متن فارسی/عربی از نتایج آدرس Nominatim با فرمت اسپانیایی
- انتقال فرم جستجو از روی نقشه به بالای نقشه تا نقشه برای مشتری کامل دیده شود
- حفظ پیشنهاد آدرس لحظه‌ای، مسیر واقعی، زمان تقریبی و هزینه ارسال براساس فاصله


## نسخه v14.2 - استفاده از کل صفحه برای Checkout و نقشه
- پنجره نهایی سفارش بزرگ و تقریباً تمام‌صفحه شد.
- نقشه کنار اطلاعات رستوران نمایش داده می‌شود و فضای بیشتری دارد.
- در دسکتاپ نقشه ارتفاع بزرگ‌تر دارد و در موبایل تمام صفحه استفاده می‌شود.


## نسخه v14.3
- فعال شدن zoom نقشه با اسکرول موس
- فعال شدن double click zoom و touch zoom
- بزرگ‌تر شدن کنترل‌های + و - نقشه


## نسخه v14.11 - منوی بالای سایت براساس نقش کاربر
- نقش‌های آزمایشی: Cliente, Repartidor, Empleado, Admin
- نمایش دکمه‌های منوی بالا براساس مجوز نقش
- جلوگیری از ورود مستقیم به صفحات بدون مجوز در Frontend
- برای نسخه نهایی روی دامنه باید همین منطق با احراز هویت واقعی Backend/JWT تکمیل شود.


## Google Places Autocomplete v14.29
برای جستجوی حرف به حرف آدرس، کلید Google Places New API را در بک‌اند قرار بده:

```env
GOOGLE_PLACES_API_KEY=YOUR_REAL_GOOGLE_API_KEY
```

فرانت‌اند دیگر مستقیماً از Google Places قدیمی استفاده نمی‌کند؛ آدرس‌ها از مسیر بک‌اند `/api/restaurant/places/autocomplete/` گرفته می‌شوند.


## v14.30 Admin PRO

در این نسخه مسیر `/dashboard` به پنل حرفه‌ای ادمین تبدیل شده است و تب‌های زیر را دارد:

- خلاصه مدیریت
- سفارشات زنده
- پیک / Repartidores
- مشتریان
- حسابداری
- پیکربندی
- دسته‌بندی و منو
- آمار پرداخت کارت / آنلاین
- بیشترین و کمترین فروش غذا

برای دسترسی محلی، نقش ادمین را با Console مرورگر فعال کن:

```javascript
localStorage.setItem('cdkt_role', 'admin')
location.reload()
```

سپس برو به:

```text
http://localhost:5173/dashboard
```


## نسخه v14.31 - پیگیری سفارش و موقعیت زنده پیک
- صفحه /track برای پیگیری سفارش با کد سفارش و تلفن مشتری اضافه شد.
- موقعیت زنده پیک روی نقشه برای مشتری و ادمین نمایش داده می‌شود.
- در پنل پیک دکمه فعال‌سازی ارسال خودکار GPS اضافه شد.
- در Admin PRO تب Mapa pیک en vivo برای مشاهده سفارش‌های در حال ارسال اضافه شد.
