import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('SECRET_KEY', 'CHANGE_ME_CASA_DE_KEBAB_DEV_SECRET')
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',') if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "cloudinary_storage",
    "cloudinary",

    "corsheaders",
    "rest_framework",
    "restaurant",
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ]},
    }
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASE_URL = os.getenv('DATABASE_URL', '')
if DATABASE_URL.startswith('postgres'):
    import dj_database_url
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}

LANGUAGE_CODE = 'es-es'
TIME_ZONE = 'Europe/Madrid'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Compatibility with django-cloudinary-storage
STATICFILES_STORAGE = (
    "whitenoise.storage.CompressedStaticFilesStorage"
)

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer', 'rest_framework.renderers.BrowsableAPIRenderer'],
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://casadekebab.com',
    'https://www.casadekebab.com',
    'https://casadekebab-frontend-v1.onrender.com',
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^capacitor://localhost$',
    r'^https?://localhost(?::\d+)?$',
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'https://casadekebab.com',
    'https://www.casadekebab.com',
    'https://casadekebab-backend.onrender.com',
]


CLOUDINARY_STORAGE = {
    "CLOUD_NAME": os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    "API_KEY": os.getenv("CLOUDINARY_API_KEY", ""),
    "API_SECRET": os.getenv("CLOUDINARY_API_SECRET", ""),
}

# Compatibility for django-cloudinary-storage collectstatic command.
#STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

SMS_MODE = os.getenv('SMS_MODE', 'console')

# Android polling SMS gateway
SMS_GATEWAY_TOKEN = os.getenv('SMS_GATEWAY_TOKEN', '')
SMS_GATEWAY_PHONE = os.getenv('SMS_GATEWAY_PHONE', '617664661')

TELEGRAM_ENABLED = os.getenv('TELEGRAM_ENABLED', 'False').lower() == 'true'
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')

# Google Places New API key for backend address autocomplete proxy
GOOGLE_PLACES_API_KEY = os.getenv('GOOGLE_PLACES_API_KEY', '')
import os

FIREBASE_ENABLED = os.getenv('FIREBASE_ENABLED', 'False').lower() in ('1', 'true', 'yes', 'on')
FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', '')
FIREBASE_CLIENT_EMAIL = os.getenv('FIREBASE_CLIENT_EMAIL', '')
FIREBASE_PRIVATE_KEY = os.getenv('FIREBASE_PRIVATE_KEY', '')
FIREBASE_PRIVATE_KEY_ID = os.getenv('FIREBASE_PRIVATE_KEY_ID', '')
FIREBASE_CLIENT_ID = os.getenv('FIREBASE_CLIENT_ID', '')
FIREBASE_CLIENT_CERT_URL = os.getenv('FIREBASE_CLIENT_CERT_URL', '')