# -*- coding: utf-8 -*-
"""
Repair Casa de Kebab Turco after generic finance patch conflict.
Run from:
    D:\Python_project\casadekebab

It removes only the generic Finance patch blocks/imports that reference missing models:
Expense, IngredientPurchase, DailyFinanceSnapshot, etc.
It keeps your original accounting system:
ExpenseCategory, AccountingSettings, RestaurantFinancialEntry, SystemBackup.
"""

from pathlib import Path
import shutil
from datetime import datetime
import re

ROOT = Path.cwd()
APP = ROOT / "backend" / "restaurant"

if not APP.exists():
    raise FileNotFoundError("Run this from D:\\Python_project\\casadekebab")

BACKUP = ROOT / "backup_repair_finance_patch" / datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP.mkdir(parents=True, exist_ok=True)

def backup(path: Path):
    if path.exists():
        dest = BACKUP / path.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)

def write(path: Path, text: str):
    backup(path)
    path.write_text(text, encoding="utf-8")
    print("FIXED:", path)

def remove_block_from_marker(text: str, marker: str) -> str:
    idx = text.find(marker)
    if idx != -1:
        return text[:idx].rstrip() + "\n"
    return text

def remove_finance_import_group(text: str) -> str:
    # Removes exact generic finance serializer/view import groups if present.
    patterns = [
        r"from \.models import \(\s*ExpenseCategory,\s*Expense,\s*Ingredient,\s*IngredientPurchase,\s*RecipeIngredient,\s*DailyFinanceSnapshot\s*\)\s*",
        r"from \.serializers import \(\s*ExpenseCategorySerializer,\s*ExpenseSerializer,\s*IngredientSerializer,\s*IngredientPurchaseSerializer,\s*RecipeIngredientSerializer,\s*DailyFinanceSnapshotSerializer\s*\)\s*",
    ]
    for p in patterns:
        text = re.sub(p, "", text, flags=re.MULTILINE)
    return text

def remove_names_from_import_line(text: str, names):
    # Handles one-line imports from .models or .serializers that include patch names.
    for import_from in [".models", ".serializers"]:
        pattern = rf"from {re.escape(import_from)} import ([^\n]+)"
        def repl(m):
            parts = [x.strip() for x in m.group(1).split(",")]
            parts = [x for x in parts if x not in names and x]
            if not parts:
                return ""
            return f"from {import_from} import " + ", ".join(parts)
        text = re.sub(pattern, repl, text)
    return text

GENERIC_FINANCE_NAMES = {
    "Expense",
    "Ingredient",
    "IngredientPurchase",
    "RecipeIngredient",
    "DailyFinanceSnapshot",
    "ExpenseSerializer",
    "IngredientSerializer",
    "IngredientPurchaseSerializer",
    "RecipeIngredientSerializer",
    "DailyFinanceSnapshotSerializer",
    "ExpenseViewSet",
    "IngredientViewSet",
    "IngredientPurchaseViewSet",
    "RecipeIngredientViewSet",
    "DailyFinanceSnapshotViewSet",
    "profit_loss_report",
    "menu_item_cost_report",
}

# 1) models.py: remove only generic block added by the bad patch.
models_path = APP / "models.py"
if models_path.exists():
    text = models_path.read_text(encoding="utf-8")
    text = remove_block_from_marker(text, "# =========================\n# Finance / Profit & Loss")
    write(models_path, text)

# 2) admin.py: remove only generic Finance admin block added by the bad patch.
admin_path = APP / "admin.py"
if admin_path.exists():
    text = admin_path.read_text(encoding="utf-8")
    text = remove_block_from_marker(text, "# =========================\n# Finance admin")
    write(admin_path, text)

# 3) serializers.py: remove generic Finance serializers block and bad imports.
serializers_path = APP / "serializers.py"
if serializers_path.exists():
    text = serializers_path.read_text(encoding="utf-8")
    text = remove_block_from_marker(text, "# =========================\n# Finance serializers")
    text = remove_finance_import_group(text)
    text = remove_names_from_import_line(text, GENERIC_FINANCE_NAMES)
    write(serializers_path, text)

# 4) views.py: remove generic Finance API block and bad imports.
views_path = APP / "views.py"
if views_path.exists():
    text = views_path.read_text(encoding="utf-8")
    text = remove_block_from_marker(text, "# =========================\n# Finance API")
    text = remove_finance_import_group(text)
    text = remove_names_from_import_line(text, GENERIC_FINANCE_NAMES)
    write(views_path, text)

# 5) urls.py: remove generic Finance urls block.
urls_path = APP / "urls.py"
if urls_path.exists():
    text = urls_path.read_text(encoding="utf-8")
    text = remove_block_from_marker(text, "# =========================\n# Finance urls")
    # Remove leftover finance urlpatterns if no marker existed.
    lines = []
    skip = False
    for line in text.splitlines():
        if "finance/" in line or any(name in line for name in GENERIC_FINANCE_NAMES):
            continue
        lines.append(line)
    write(urls_path, "\n".join(lines).rstrip() + "\n")

print("\nDONE.")
print("Backup saved at:", BACKUP)
print("\nNow run:")
print(r"cd D:\Python_project\casadekebab\backend")
print("python manage.py check")
print("python manage.py makemigrations restaurant")
print("python manage.py migrate")
