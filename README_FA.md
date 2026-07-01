# سفارش Admin: فقط Recoger بدون نام و تلفن

- Admin + Recoger: بدون نام، تلفن و OTP
- Entregar برای همه حتی Admin: نام، تلفن، آدرس و OTP اجباری

## نصب

فایل‌ها را در مسیرهای متناظر جایگزین کنید:
- frontend/src/main.jsx
- backend/restaurant/serializers.py

سپس:

```powershell
cd D:\Python_project\casadekebab
python .\apply_views_admin_collection_patch.py

cd backend
python manage.py check
python manage.py makemigrations --check

cd ..\frontend
npm run build
```

در پایان:

```powershell
cd ..
git add frontend/src/main.jsx
git add backend/restaurant/serializers.py
git add backend/restaurant/views.py
git commit -m "Allow admin collection checkout without identity"
git push origin main
```
