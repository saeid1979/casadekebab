# -*- coding: utf-8 -*-
"""
Fix duplicated Finance patch blocks in Casa de Kebab Turco.
Run from project root:
    cd D:\\Python_project\\casadekebab
    python fix_finance_duplicates.py
Then:
    cd backend
    python manage.py check
    python manage.py makemigrations restaurant
    python manage.py migrate
"""
from pathlib import Path
import shutil
from datetime import datetime

ROOT = Path.cwd()
APP = ROOT / "backend" / "restaurant"
if not APP.exists():
    raise FileNotFoundError("Run this from D:\\Python_project\\casadekebab")

backup = ROOT / "backup_fix_finance_duplicates" / datetime.now().strftime("%Y%m%d_%H%M%S")
backup.mkdir(parents=True, exist_ok=True)

def save_backup(p: Path):
    if p.exists():
        dest = backup / p.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)

# 1) models.py: remove generic duplicated finance block only
models_path = APP / "models.py"
save_backup(models_path)
models_text = models_path.read_text(encoding="utf-8")
marker = "# =========================\n# Finance / Profit & Loss\n# Casa de Kebab Turco\n# ========================="
if marker in models_text:
    models_text = models_text.split(marker)[0].rstrip() + "\n"
    models_path.write_text(models_text, encoding="utf-8")
    print("Cleaned duplicated generic finance models from models.py")
else:
    print("No duplicated generic finance block found in models.py")

# 2) admin.py: remove duplicated finance admin block
admin_path = APP / "admin.py"
save_backup(admin_path)
admin_text = admin_path.read_text(encoding="utf-8")
admin_marker = "# =========================\n# Finance admin\n# ========================="
if admin_marker in admin_text:
    admin_text = admin_text.split(admin_marker)[0].rstrip() + "\n"
    print("Cleaned duplicated finance admin block from admin.py")
else:
    print("No duplicated finance admin block found in admin.py")

# 3) ensure existing v18 product-cost models are imported and visible in admin
first_line_start = "from .models import "
lines = admin_text.splitlines()
for i, line in enumerate(lines):
    if line.startswith(first_line_start):
        needed = ["Ingredient", "ProductCostProfile", "RecipeIngredient"]
        for name in needed:
            if name not in line:
                # insert before end of import line
                line = line.rstrip()
                line += f", {name}"
        lines[i] = line
        break
admin_text = "\n".join(lines).rstrip() + "\n"

append = '''

# =========================
# Product cost / stock admin
# =========================
@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'unit_cost', 'stock_quantity', 'reorder_level', 'supplier_name', 'is_active')
    list_editable = ('unit_cost', 'stock_quantity', 'reorder_level', 'is_active')
    list_filter = ('unit', 'is_active')
    search_fields = ('name', 'supplier_name')


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 1
    readonly_fields = ('line_cost',)


@admin.register(ProductCostProfile)
class ProductCostProfileAdmin(admin.ModelAdmin):
    list_display = ('menu_item', 'packaging_cost', 'fixed_cost', 'target_margin_percent', 'updated_at')
    list_filter = ('updated_at',)
    search_fields = ('menu_item__name_es', 'notes')
    inlines = [RecipeIngredientInline]


@admin.register(RecipeIngredient)
class RecipeIngredientAdmin(admin.ModelAdmin):
    list_display = ('profile', 'ingredient', 'quantity', 'line_cost')
    list_filter = ('ingredient__unit',)
    search_fields = ('profile__menu_item__name_es', 'ingredient__name')
'''
if "@admin.register(Ingredient)" not in admin_text:
    admin_text += append
    print("Added admin screens for Ingredient, ProductCostProfile, RecipeIngredient")
else:
    print("Product-cost admin registrations already exist")
admin_path.write_text(admin_text, encoding="utf-8")

print(f"Backup saved in: {backup}")
print("Done. Now run: cd backend && python manage.py check")
