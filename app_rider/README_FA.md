# Casa Kebab Rider PRO

مسیر نهایی: `D:\Python_project\casadekebab\app_rider`

## اجرا
1. پوشه app_rider را در پروژه قرار بده.
2. فایل `backend_patch/apply_rider_app_backend_patch.py` را به مسیر اصلی پروژه کپی و اجرا کن:
```powershell
cd D:\Python_project\casadekebab
python apply_rider_app_backend_patch.py
cd backend
python manage.py check
cd ..
git add backend/restaurant/views.py backend/restaurant/urls.py
git commit -m "Add rider app endpoints"
git push
```
Backend را در Render Deploy کن.

## تست وب
```powershell
cd D:\Python_project\casadekebab\app_rider
npm install
Copy-Item .env.example .env
npm run dev
```
آدرس: http://localhost:5174

## Android
```powershell
npm run build
npx cap add android
npx cap sync android
cd D:\Python_project\casadekebab
python apply_rider_android_permissions.py
cd app_rider
npx cap sync android
npx cap open android
```
سپس Build APK.
