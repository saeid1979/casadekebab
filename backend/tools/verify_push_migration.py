"""
Run this after `python manage.py makemigrations restaurant` and BEFORE migrate.

It rejects any new migration mentioning Category or menu category fields.
This is a safety check, not a replacement for reviewing the migration file.
"""
from pathlib import Path
import sys

migration_dir = Path(__file__).resolve().parents[1] / 'restaurant' / 'migrations'
files = sorted(
    [p for p in migration_dir.glob('*.py') if p.name != '__init__.py'],
    key=lambda p: p.stat().st_mtime,
    reverse=True,
)
if not files:
    print('No migration files found.')
    sys.exit(1)

latest = files[0]
text = latest.read_text(encoding='utf-8').lower()
blocked = [
    "name='category'",
    'model_name="category"',
    "model_name='category'",
    "menuitem",
    "category_id",
    "runpython",
    "runsql",
]

hits = [term for term in blocked if term in text]
print(f'Checking: {latest.name}')
if hits:
    print('BLOCKED: migration may affect menu/category data:', ', '.join(hits))
    sys.exit(2)

required = ["customerpushdevice", "createmodel"]
missing = [term for term in required if term not in text]
if missing:
    print('WARNING: latest migration does not clearly create CustomerPushDevice.')
    sys.exit(3)

print('SAFE CHECK PASSED: no Category/MenuItem/Data migration keywords found.')
