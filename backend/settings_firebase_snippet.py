# Add these lines to backend/config/settings.py (or your active settings file)
# They do not affect Category or menu data.

import os

FIREBASE_ENABLED = os.getenv('FIREBASE_ENABLED', 'False').lower() in ('1', 'true', 'yes', 'on')
FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', '')
FIREBASE_CLIENT_EMAIL = os.getenv('FIREBASE_CLIENT_EMAIL', '')
FIREBASE_PRIVATE_KEY = os.getenv('FIREBASE_PRIVATE_KEY', '')
FIREBASE_PRIVATE_KEY_ID = os.getenv('FIREBASE_PRIVATE_KEY_ID', '')
FIREBASE_CLIENT_ID = os.getenv('FIREBASE_CLIENT_ID', '')
FIREBASE_CLIENT_CERT_URL = os.getenv('FIREBASE_CLIENT_CERT_URL', '')
