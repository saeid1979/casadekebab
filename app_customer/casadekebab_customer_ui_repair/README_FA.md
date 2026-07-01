# اصلاح ظاهر اپ مشتری Casa de Kebab Turco

این بسته مشکلاتی را که بعد از Patchهای قبلی ایجاد شده اصلاح می‌کند:

- قرارگرفتن دکمه «Cuenta» در ردیف دوم منوی پایین
- بزرگ و چندردیفه‌شدن منوی پایین
- افتادن منوی اپ روی نوار اصلی Android
- زوم و Crop زیاد تصاویر غذا
- بزرگ‌شدن غیرعادی تصویر کارت غذا
- حفظ Safe Area بدون تغییر طراحی اصلی اپ

هیچ تغییری در Backend، دیتابیس، Category، دسته‌بندی غذا یا سفارش‌ها ایجاد نمی‌شود.

## مرحله ۱: استخراج ZIP

```text
D:\Python_project\casadekebab_customer_ui_repair
```

## مرحله ۲: اجرای اصلاح

```powershell
cd D:\Python_project\casadekebab_customer_ui_repair

python apply_customer_ui_repair.py `
  --project "D:\Python_project\casadekebab\app_customer"
```

قبل از تغییر فایل‌ها Backup ساخته می‌شود:

```text
D:\Python_project\casadekebab\app_customer\_backup_before_ui_repair_YYYYMMDD_HHMMSS
```

## مرحله ۳: Build و Sync

```powershell
cd D:\Python_project\casadekebab_customer_ui_repair

powershell -ExecutionPolicy Bypass -File .\verify_build.ps1 `
  -Project "D:\Python_project\casadekebab\app_customer"
```

یا دستی:

```powershell
cd D:\Python_project\casadekebab\app_customer

npm run build
npx cap sync android
npx cap open android
```

## مرحله ۴: ساخت APK

در Android Studio:

```text
Build
→ Build Bundle(s) / APK(s)
→ Build APK(s)
```

## مرحله ۵: نتیجه مورد انتظار

- پنج دکمه پایین در یک ردیف قرار بگیرند.
- «Cuenta» دیگر به ردیف دوم نرود.
- منوی اپ بالای نوار Android قرار بگیرد.
- تصویر محصولات حدود 110 تا 118 پیکسل ارتفاع داشته باشد.
- تصویر کامل‌تر دیده شود و Crop/Zoom شدید نداشته باشد.
- ظاهر قبلی کارت‌ها و صفحه حفظ شود.

## مرحله ۶: Commit امن

```powershell
cd D:\Python_project\casadekebab
git status

git add app_customer/src/styles.css
git add app_customer/src/utils/cloudinaryImage.js
git add app_customer/index.html
git add app_customer/android/app/src/main/AndroidManifest.xml

git commit -m "repair customer app navigation and food image layout"
git push
```

از `git add .` استفاده نکن.
