# fix_after_v11_admin_models.py
# Run this file inside: D:\Python_project\casadekebab\backend
# It fixes RestaurantSettings/Coupon import/model issues after extracting v11.

from pathlib import Path
import shutil

BASE = Path(__file__).resolve().parent
models_path = BASE / "restaurant" / "models.py"
admin_path = BASE / "restaurant" / "admin.py"

if not models_path.exists():
    raise FileNotFoundError(f"Not found: {models_path}")
if not admin_path.exists():
    raise FileNotFoundError(f"Not found: {admin_path}")

models_text = models_path.read_text(encoding="utf-8")
admin_text = admin_path.read_text(encoding="utf-8")

# Backup first
shutil.copy2(models_path, models_path.with_suffix(".py.bak_fix_after_v11"))
shutil.copy2(admin_path, admin_path.with_suffix(".py.bak_fix_after_v11"))

# Ensure Decimal import exists
if "from decimal import Decimal" not in models_text:
    models_text = "from decimal import Decimal\n" + models_text

# Add RestaurantSettings if missing
if "class RestaurantSettings" not in models_text:
    models_text += '''

class RestaurantSettings(models.Model):
    restaurant_name = models.CharField(max_length=160, default="Casa de Kebab Turco")
    phone = models.CharField(max_length=40, default="+34 613 473 564")
    address = models.CharField(max_length=255, default="Calle García Lorca, 1, Salamanca 37004")

    is_open = models.BooleanField(default=True)
    delivery_enabled = models.BooleanField(default=True)
    collection_enabled = models.BooleanField(default=True)

    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("1.50"))
    minimum_delivery_order = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("10.00"))
    free_delivery_from = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("30.00"))

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Restaurant Settings"
        verbose_name_plural = "Restaurant Settings"

    def __str__(self):
        return self.restaurant_name
'''

# Add Coupon if missing
if "class Coupon" not in models_text:
    models_text += '''

class Coupon(models.Model):
    DISCOUNT_PERCENT = "percent"
    DISCOUNT_FIXED = "fixed"

    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_PERCENT, "Percent"),
        (DISCOUNT_FIXED, "Fixed Amount"),
    ]

    code = models.CharField(max_length=40, unique=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default=DISCOUNT_PERCENT)
    value = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("10.00"))
    is_active = models.BooleanField(default=True)
    first_order_only = models.BooleanField(default=False)
    minimum_order_amount = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    expires_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code
'''

models_path.write_text(models_text, encoding="utf-8")

# Fix admin import
admin_text = admin_path.read_text(encoding="utf-8")

# If admin.py uses RestaurantSettings/Coupon but doesn't import them, add imports safely.
if "RestaurantSettings" in admin_text or "Coupon" in admin_text:
    # Case 1: from .models import (...)
    if "from .models import (" in admin_text:
        start = admin_text.index("from .models import (")
        end = admin_text.index(")", start)
        block = admin_text[start:end]
        additions = []
        if "RestaurantSettings" not in block:
            additions.append("    RestaurantSettings,\n")
        if "Coupon" not in block:
            additions.append("    Coupon,\n")
        if additions:
            admin_text = admin_text[:end] + "".join(additions) + admin_text[end:]
    # Case 2: single-line import
    elif "from .models import " in admin_text:
        lines = admin_text.splitlines()
        new_lines = []
        done = False
        for line in lines:
            if line.startswith("from .models import ") and not done:
                if "RestaurantSettings" not in line:
                    line += ", RestaurantSettings"
                if "Coupon" not in line:
                    line += ", Coupon"
                done = True
            new_lines.append(line)
        admin_text = "\n".join(new_lines) + "\n"
    else:
        admin_text = "from .models import RestaurantSettings, Coupon\n" + admin_text

admin_path.write_text(admin_text, encoding="utf-8")

print("OK: RestaurantSettings and Coupon exist in models.py, and admin.py imports them.")
print("Backups created:")
print(f"- {models_path.with_suffix('.py.bak_fix_after_v11')}")
print(f"- {admin_path.with_suffix('.py.bak_fix_after_v11')}")
