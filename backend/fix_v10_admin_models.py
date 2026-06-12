from pathlib import Path
import re

BASE = Path(__file__).resolve().parent
app_dir = BASE / "restaurant"
models_path = app_dir / "models.py"
admin_path = app_dir / "admin.py"

if not models_path.exists():
    raise FileNotFoundError(f"Not found: {models_path}")
if not admin_path.exists():
    raise FileNotFoundError(f"Not found: {admin_path}")

models_text = models_path.read_text(encoding="utf-8")
admin_text = admin_path.read_text(encoding="utf-8")

models_backup = models_path.with_suffix(".py.bak_fix_v10")
admin_backup = admin_path.with_suffix(".py.bak_fix_v10")
models_backup.write_text(models_text, encoding="utf-8")
admin_backup.write_text(admin_text, encoding="utf-8")

settings_model = r'''

# =========================
# Restaurant settings and coupons
# Added by fix_v10_admin_models.py
# =========================
class RestaurantSettings(models.Model):
    name = models.CharField(max_length=160, default="Casa de Kebab Turco")
    phone = models.CharField(max_length=40, blank=True, default="")
    address = models.CharField(max_length=255, default="Calle García Lorca, 1, Salamanca 37004")
    is_open = models.BooleanField(default=True)
    delivery_enabled = models.BooleanField(default=True)
    collection_enabled = models.BooleanField(default=True)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=1.50)
    minimum_delivery_order = models.DecimalField(max_digits=8, decimal_places=2, default=10.00)
    free_delivery_from = models.DecimalField(max_digits=8, decimal_places=2, default=30.00)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Restaurant Settings"
        verbose_name_plural = "Restaurant Settings"

    def __str__(self):
        return self.name

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class Coupon(models.Model):
    DISCOUNT_PERCENT = "percent"
    DISCOUNT_FIXED = "fixed"

    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_PERCENT, "Percent"),
        (DISCOUNT_FIXED, "Fixed amount"),
    ]

    code = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default=DISCOUNT_PERCENT)
    value = models.DecimalField(max_digits=8, decimal_places=2, default=10.00)
    minimum_order_amount = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    active = models.BooleanField(default=True)
    first_order_only = models.BooleanField(default=False)
    usage_limit = models.PositiveIntegerField(default=0, help_text="0 means unlimited")
    used_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return self.code
'''

if "class RestaurantSettings(" not in models_text:
    models_text = models_text.rstrip() + settings_model + "\n"
if "class Coupon(" not in models_text:
    # If RestaurantSettings exists but Coupon doesn't, add only Coupon class
    coupon_class = settings_model[settings_model.find("class Coupon("):]
    models_text = models_text.rstrip() + "\n\n" + coupon_class + "\n"

models_path.write_text(models_text, encoding="utf-8")

# Fix admin import so RestaurantSettings and Coupon are defined in admin.py
if "RestaurantSettings" in admin_text or "Coupon" in admin_text:
    # Find from .models import (...) block
    block_match = re.search(r"from\s+\.models\s+import\s*\((.*?)\)", admin_text, flags=re.S)
    if block_match:
        inside = block_match.group(1)
        names = [x.strip().strip(',') for x in inside.splitlines() if x.strip().strip(',')]
        for needed in ["RestaurantSettings", "Coupon"]:
            if needed not in names:
                names.append(needed)
        new_inside = "\n    " + ",\n    ".join(names) + ",\n"
        admin_text = admin_text[:block_match.start(1)] + new_inside + admin_text[block_match.end(1):]
    else:
        # Single-line import case: from .models import A, B
        line_match = re.search(r"^from\s+\.models\s+import\s+(.+)$", admin_text, flags=re.M)
        if line_match:
            imported = [x.strip() for x in line_match.group(1).split(',')]
            for needed in ["RestaurantSettings", "Coupon"]:
                if needed not in imported:
                    imported.append(needed)
            new_line = "from .models import " + ", ".join(imported)
            admin_text = admin_text[:line_match.start()] + new_line + admin_text[line_match.end():]
        else:
            admin_text = "from .models import RestaurantSettings, Coupon\n" + admin_text

admin_path.write_text(admin_text, encoding="utf-8")

print("OK: fixed RestaurantSettings/Coupon model and admin import.")
print(f"Backup created: {models_backup}")
print(f"Backup created: {admin_backup}")
print("Now run:")
print("python manage.py check")
print("python manage.py makemigrations restaurant")
print("python manage.py migrate")
