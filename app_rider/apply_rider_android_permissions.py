from pathlib import Path
import shutil
R=Path(__file__).resolve().parent;M=R/'app_rider'/'android'/'app'/'src'/'main'/'AndroidManifest.xml'
if not M.exists():raise FileNotFoundError('Run npx cap add android first')
t=M.read_text(encoding='utf-8');tag='<manifest xmlns:android="http://schemas.android.com/apk/res/android">'
for x in ['<uses-permission android:name="android.permission.INTERNET" />','<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />','<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />']:
    if x not in t:t=t.replace(tag,tag+'\n    '+x,1)
M.write_text(t,encoding='utf-8');print('PATCH_OK')
