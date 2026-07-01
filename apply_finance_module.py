
# -*- coding: utf-8 -*-
from pathlib import Path
import shutil
from datetime import datetime

ROOT = Path.cwd()
APP = ROOT / "backend" / "restaurant"

if not APP.exists():
    raise FileNotFoundError(f"Could not find Django app at {APP}. Run this from D:\\Python_project\\casadekebab")

backup_dir = ROOT / "backup_finance_module" / datetime.now().strftime("%Y%m%d_%H%M%S")
backup_dir.mkdir(parents=True, exist_ok=True)

def backup(path: Path):
    if path.exists():
        dest = backup_dir / path.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)

def append_once(path: Path, marker: str, content: str):
    backup(path)
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    if marker in text:
        print(f"SKIP already patched: {path}")
        return
    path.write_text(text.rstrip() + "\n\n" + content.strip() + "\n", encoding="utf-8")
    print(f"PATCHED: {path}")

MODELS_APPEND = '''
# =========================
# Finance / Profit & Loss
# Casa de Kebab Turco
# =========================

class ExpenseCategory(models.Model):
    TYPE_CHOICES = [
        ("fixed", "Fijo"),
        ("variable", "Variable"),
    ]
    name = models.CharField(max_length=120, unique=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="variable")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Categoría de gasto"
        verbose_name_plural = "Categorías de gastos"
        ordering = ["type", "name"]

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class Expense(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ("cash", "Efectivo"),
        ("card", "Tarjeta"),
        ("bank", "Banco"),
        ("other", "Otro"),
    ]
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name="expenses")
    title = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    expense_date = models.DateField()
    supplier = models.CharField(max_length=180, blank=True)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default="cash")
    notes = models.TextField(blank=True)
    invoice_file = models.FileField(upload_to="finance/invoices/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Gasto"
        verbose_name_plural = "Gastos"
        ordering = ["-expense_date", "-id"]

    def __str__(self):
        return f"{self.expense_date} - {self.title} - {self.amount}€"


class Ingredient(models.Model):
    UNIT_CHOICES = [
        ("kg", "Kilogramo"),
        ("g", "Gramo"),
        ("l", "Litro"),
        ("ml", "Mililitro"),
        ("unit", "Unidad"),
        ("box", "Caja"),
        ("pack", "Paquete"),
    ]
    name = models.CharField(max_length=120, unique=True)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default="kg")
    current_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    minimum_stock = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    average_unit_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Ingrediente"
        verbose_name_plural = "Ingredientes"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.current_stock} {self.unit})"


class IngredientPurchase(models.Model):
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="purchases")
    supplier = models.CharField(max_length=180, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2)
    purchase_date = models.DateField()
    expiry_date = models.DateField(blank=True, null=True)
    invoice_file = models.FileField(upload_to="finance/ingredient_invoices/", blank=True, null=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Compra de ingrediente"
        verbose_name_plural = "Compras de ingredientes"
        ordering = ["-purchase_date", "-id"]

    @property
    def unit_cost(self):
        if not self.quantity:
            return 0
        return self.total_cost / self.quantity

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_quantity = 0
        if not is_new:
            old = IngredientPurchase.objects.get(pk=self.pk)
            old_quantity = old.quantity

        super().save(*args, **kwargs)

        ing = self.ingredient
        if is_new:
            ing.current_stock = (ing.current_stock or 0) + self.quantity
        else:
            ing.current_stock = (ing.current_stock or 0) - old_quantity + self.quantity

        if ing.current_stock and ing.current_stock > 0:
            previous_stock_value = (ing.current_stock - self.quantity) * (ing.average_unit_cost or 0)
            ing.average_unit_cost = (previous_stock_value + self.total_cost) / ing.current_stock

        ing.save(update_fields=["current_stock", "average_unit_cost"])

    def __str__(self):
        return f"{self.ingredient.name} - {self.quantity} - {self.total_cost}€"


class RecipeIngredient(models.Model):
    menu_item = models.ForeignKey("restaurant.MenuItem", on_delete=models.CASCADE, related_name="recipe_ingredients")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name="recipe_items")
    quantity_used = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        verbose_name = "Ingrediente de receta"
        verbose_name_plural = "Ingredientes de recetas"
        unique_together = ("menu_item", "ingredient")

    @property
    def cost(self):
        return (self.quantity_used or 0) * (self.ingredient.average_unit_cost or 0)

    def __str__(self):
        return f"{self.menu_item} - {self.ingredient.name}: {self.quantity_used}"


class DailyFinanceSnapshot(models.Model):
    date = models.DateField(unique=True)
    revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    variable_costs = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fixed_costs = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    gross_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_profit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    orders_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Resumen diario financiero"
        verbose_name_plural = "Resúmenes diarios financieros"
        ordering = ["-date"]

    def __str__(self):
        return f"{self.date} - Neto: {self.net_profit}€"
'''

SERIALIZERS_APPEND = '''
# =========================
# Finance serializers
# =========================

from .models import (
    ExpenseCategory, Expense, Ingredient, IngredientPurchase,
    RecipeIngredient, DailyFinanceSnapshot
)

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = "__all__"


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Expense
        fields = "__all__"


class IngredientSerializer(serializers.ModelSerializer):
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Ingredient
        fields = "__all__"

    def get_low_stock(self, obj):
        return obj.current_stock <= obj.minimum_stock


class IngredientPurchaseSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    unit_cost = serializers.DecimalField(max_digits=10, decimal_places=4, read_only=True)

    class Meta:
        model = IngredientPurchase
        fields = "__all__"


class RecipeIngredientSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)
    cost = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = "__all__"


class DailyFinanceSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyFinanceSnapshot
        fields = "__all__"
'''

VIEWS_APPEND = '''
# =========================
# Finance API
# =========================

from decimal import Decimal
from django.db import models
from django.db.models import Sum
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import (
    ExpenseCategory, Expense, Ingredient, IngredientPurchase,
    RecipeIngredient, DailyFinanceSnapshot
)
from .serializers import (
    ExpenseCategorySerializer, ExpenseSerializer, IngredientSerializer,
    IngredientPurchaseSerializer, RecipeIngredientSerializer, DailyFinanceSnapshotSerializer
)

class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    queryset = ExpenseCategory.objects.all()
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAdminUser]


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("category").all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAdminUser]


class IngredientViewSet(viewsets.ModelViewSet):
    queryset = Ingredient.objects.all()
    serializer_class = IngredientSerializer
    permission_classes = [IsAdminUser]


class IngredientPurchaseViewSet(viewsets.ModelViewSet):
    queryset = IngredientPurchase.objects.select_related("ingredient").all()
    serializer_class = IngredientPurchaseSerializer
    permission_classes = [IsAdminUser]


class RecipeIngredientViewSet(viewsets.ModelViewSet):
    queryset = RecipeIngredient.objects.select_related("ingredient", "menu_item").all()
    serializer_class = RecipeIngredientSerializer
    permission_classes = [IsAdminUser]


class DailyFinanceSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DailyFinanceSnapshot.objects.all()
    serializer_class = DailyFinanceSnapshotSerializer
    permission_classes = [IsAdminUser]


def _get_order_model():
    from django.apps import apps
    for name in ["Order", "RestaurantOrder"]:
        try:
            return apps.get_model("restaurant", name)
        except LookupError:
            continue
    return None


def _get_order_total_field(Order):
    for field in ["total_price", "total", "amount", "grand_total", "final_total"]:
        if hasattr(Order, field):
            return field
    return None


def _filter_orders_by_date(qs, start_date, end_date):
    model = qs.model
    for field in ["created_at", "created", "order_date", "date"]:
        if hasattr(model, field):
            kwargs = {
                f"{field}__date__gte": start_date,
                f"{field}__date__lte": end_date,
            }
            return qs.filter(**kwargs)
    return qs


@api_view(["GET"])
@permission_classes([IsAdminUser])
def profit_loss_report(request):
    start = parse_date(request.GET.get("start", ""))
    end = parse_date(request.GET.get("end", ""))

    if not start or not end:
        return Response({"detail": "start and end dates are required: YYYY-MM-DD"}, status=400)

    Order = _get_order_model()
    revenue = Decimal("0.00")
    orders_count = 0

    if Order:
        orders = _filter_orders_by_date(Order.objects.all(), start, end)
        if hasattr(Order, "status"):
            orders = orders.exclude(status__in=["cancelled", "canceled", "cancelado"])
        total_field = _get_order_total_field(Order)
        if total_field:
            revenue = orders.aggregate(s=Sum(total_field))["s"] or Decimal("0.00")
        orders_count = orders.count()

    expenses = Expense.objects.filter(expense_date__gte=start, expense_date__lte=end).select_related("category")
    fixed_costs = expenses.filter(category__type="fixed").aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
    variable_expenses = expenses.filter(category__type="variable").aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

    ingredient_costs = IngredientPurchase.objects.filter(
        purchase_date__gte=start,
        purchase_date__lte=end
    ).aggregate(s=Sum("total_cost"))["s"] or Decimal("0.00")

    variable_costs = variable_expenses + ingredient_costs
    gross_profit = revenue - variable_costs
    net_profit = gross_profit - fixed_costs
    low_stock = Ingredient.objects.filter(is_active=True, current_stock__lte=models.F("minimum_stock")).count()

    return Response({
        "start": start,
        "end": end,
        "revenue": revenue,
        "orders_count": orders_count,
        "fixed_costs": fixed_costs,
        "variable_costs": variable_costs,
        "ingredient_costs": ingredient_costs,
        "gross_profit": gross_profit,
        "net_profit": net_profit,
        "low_stock_items": low_stock,
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def menu_item_cost_report(request):
    data = []
    recipes = RecipeIngredient.objects.select_related("ingredient", "menu_item").all()
    grouped = {}

    for r in recipes:
        grouped.setdefault(r.menu_item_id, {"menu_item": str(r.menu_item), "cost": Decimal("0.00")})
        grouped[r.menu_item_id]["cost"] += Decimal(r.cost or 0)

    for item_id, row in grouped.items():
        data.append({
            "menu_item_id": item_id,
            "menu_item": row["menu_item"],
            "estimated_ingredient_cost": row["cost"],
        })

    return Response(data)
'''

ADMIN_APPEND = '''
# =========================
# Finance admin
# =========================
from .models import (
    ExpenseCategory, Expense, Ingredient, IngredientPurchase,
    RecipeIngredient, DailyFinanceSnapshot
)

@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "is_active")
    list_filter = ("type", "is_active")
    search_fields = ("name",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("expense_date", "title", "category", "amount", "payment_method", "supplier")
    list_filter = ("category", "payment_method", "expense_date")
    search_fields = ("title", "supplier", "notes")


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ("name", "unit", "current_stock", "minimum_stock", "average_unit_cost", "is_active")
    list_filter = ("unit", "is_active")
    search_fields = ("name",)


@admin.register(IngredientPurchase)
class IngredientPurchaseAdmin(admin.ModelAdmin):
    list_display = ("purchase_date", "ingredient", "quantity", "total_cost", "supplier", "expiry_date")
    list_filter = ("purchase_date", "expiry_date")
    search_fields = ("ingredient__name", "supplier", "notes")


@admin.register(RecipeIngredient)
class RecipeIngredientAdmin(admin.ModelAdmin):
    list_display = ("menu_item", "ingredient", "quantity_used", "cost")
    search_fields = ("menu_item__name", "ingredient__name")


@admin.register(DailyFinanceSnapshot)
class DailyFinanceSnapshotAdmin(admin.ModelAdmin):
    list_display = ("date", "revenue", "variable_costs", "fixed_costs", "gross_profit", "net_profit", "orders_count")
    list_filter = ("date",)
'''

URLS_SNIPPET = '''
# =========================
# Finance urls
# =========================
from rest_framework.routers import DefaultRouter
from .views import (
    ExpenseCategoryViewSet, ExpenseViewSet, IngredientViewSet,
    IngredientPurchaseViewSet, RecipeIngredientViewSet, DailyFinanceSnapshotViewSet,
    profit_loss_report, menu_item_cost_report
)

router = DefaultRouter()
router.register(r"finance/expense-categories", ExpenseCategoryViewSet)
router.register(r"finance/expenses", ExpenseViewSet)
router.register(r"finance/ingredients", IngredientViewSet)
router.register(r"finance/ingredient-purchases", IngredientPurchaseViewSet)
router.register(r"finance/recipe-ingredients", RecipeIngredientViewSet)
router.register(r"finance/daily-snapshots", DailyFinanceSnapshotViewSet)

urlpatterns += router.urls
urlpatterns += [
    path("finance/profit-loss/", profit_loss_report, name="finance-profit-loss"),
    path("finance/menu-item-costs/", menu_item_cost_report, name="finance-menu-item-costs"),
]
'''

models_path = APP / "models.py"
append_once(models_path, "Finance / Profit & Loss", MODELS_APPEND)

serializers_path = APP / "serializers.py"
if serializers_path.exists():
    append_once(serializers_path, "Finance serializers", SERIALIZERS_APPEND)
else:
    serializers_path.write_text("from rest_framework import serializers\n\n" + SERIALIZERS_APPEND, encoding="utf-8")

views_path = APP / "views.py"
append_once(views_path, "Finance API", VIEWS_APPEND)

admin_path = APP / "admin.py"
if admin_path.exists():
    text = admin_path.read_text(encoding="utf-8")
    if "from django.contrib import admin" not in text:
        admin_path.write_text("from django.contrib import admin\n" + text, encoding="utf-8")
    append_once(admin_path, "Finance admin", ADMIN_APPEND)
else:
    admin_path.write_text("from django.contrib import admin\n\n" + ADMIN_APPEND, encoding="utf-8")

urls_path = APP / "urls.py"
if urls_path.exists():
    text = urls_path.read_text(encoding="utf-8")
    if "finance/profit-loss" not in text:
        if "urlpatterns" not in text:
            text += "\n\nurlpatterns = []\n"
        if "from django.urls import path" not in text:
            text = "from django.urls import path\n" + text
        urls_path.write_text(text.rstrip() + "\n\n" + URLS_SNIPPET, encoding="utf-8")
else:
    urls_path.write_text("from django.urls import path\n\nurlpatterns = []\n\n" + URLS_SNIPPET, encoding="utf-8")

print("Finance module patch completed.")
print(f"Backup folder: {backup_dir}")
print("Next:")
print("cd D:\\Python_project\\casadekebab\\backend")
print("python manage.py makemigrations restaurant")
print("python manage.py migrate")
print("python manage.py check")
