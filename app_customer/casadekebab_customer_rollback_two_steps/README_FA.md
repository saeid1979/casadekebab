# پچ بازگشت دو مرحله‌ای اپ مشتری

این پچ دو تغییر اخیر رابط کاربری اپ مشتری را برمی‌گرداند:

1. پچ Safe Area منوی پایین
2. پچ تعمیر گرافیکی بعدی

فایل‌های بازگردانی‌شده:

```text
app_customer/index.html
app_customer/src/styles.css
app_customer/src/utils/cloudinaryImage.js
app_customer/android/app/src/main/AndroidManifest.xml
```

این پچ هیچ تغییری در Backend، دیتابیس، Category، منوی غذا، سفارش‌ها یا اطلاعات مشتریان ایجاد نمی‌کند.

## پیش‌نیاز

باید پوشه‌های Backup ساخته‌شده توسط پچ‌های قبلی داخل این مسیر وجود داشته باشند:

```text
D:\Python_project\casadekebab\app_customer\_backup_safe_area_*
D:\Python_project\casadekebab\app_customer\_backup_before_ui_repair_*
```

پچ جدیدترین Backup از هر نوع را خودکار پیدا می‌کند.

## اجرا

فایل ZIP را در این مسیر Extract کن:

```text
D:\Python_project\casadekebab_customer_rollback_two_steps
```

سپس PowerShell:

```powershell
cd D:\Python_project\casadekebab_customer_rollback_two_steps

powershell -ExecutionPolicy Bypass -File .\rollback_two_steps.ps1 `
  -Project "D:\Python_project\casadekebab\app_customer"
```

پچ قبل از بازگردانی، از وضعیت فعلی یک Backup اضطراری می‌سازد:

```text
D:\Python_project\casadekebab\app_customer\_backup_before_two_step_rollback_YYYYMMDD_HHMMSS
```

## Build و Sync

```powershell
cd D:\Python_project\casadekebab\app_customer

npm run build
npx cap sync android
npx cap open android
```

در Android Studio:

```text
Build
→ Build Bundle(s) / APK(s)
→ Build APK(s)
```

## تست

بعد از نصب APK جدید بررسی کن:

- ظاهر اپ به قبل از دو پچ اخیر برگشته باشد.
- منوهای پایین و کارت‌های غذا شکل قبلی را داشته باشند.
- تصاویر دیگر تحت تأثیر پچ تعمیر گرافیکی اخیر نباشند.

## Commit امن

```powershell
cd D:\Python_project\casadekebab

git status

git add app_customer/index.html
git add app_customer/src/styles.css
git add app_customer/src/utils/cloudinaryImage.js
git add app_customer/android/app/src/main/AndroidManifest.xml

git commit -m "rollback customer app UI by two stages"
git push
```

از `git add .` استفاده نکن.
