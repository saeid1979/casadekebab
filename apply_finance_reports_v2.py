# -*- coding: utf-8 -*-
"""
Casa de Kebab Turco - Finance Reports v2
Run from: D:\Python_project\casadekebab

No new models. No migrations. No category/menu data changes.
"""

from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path.cwd()
APP = ROOT / "backend" / "restaurant"

if not APP.exists():
    raise FileNotFoundError("Run this from D:\\Python_project\\casadekebab")

BACKUP = ROOT / "backup_finance_reports_v2" / datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP.mkdir(parents=True, exist_ok=True)

def backup(path: Path):
    if path.exists():
        dest = BACKUP / path.relative_to(ROOT)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)

def append_once(path: Path, marker: str, content: str):
    text = path.read_text(encoding="utf-8")
    if marker in text:
        print("SKIP already installed:", path)
        return
    backup(path)
    path.write_text(text.rstrip() + "\n\n" + content.strip() + "\n", encoding="utf-8")
    print("PATCHED:", path)

VIEWS_APPEND = """
# ============================================================
# Finance Reports v2 - Casa de Kebab Turco
# Uses existing models only. No new database tables.
# ============================================================

from decimal import Decimal
from django.db.models import Sum, Count
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from .models import (
    Order,
    OrderItem,
    RestaurantFinancialEntry,
    AccountingSettings,
)


def _finance_v2_money(value):
    value = Decimal(str(value or "0.00"))
    return str(value.quantize(Decimal("0.01")))


def _finance_v2_date_range(request):
    start = parse_date(request.GET.get("start", ""))
    end = parse_date(request.GET.get("end", ""))
    if not start or not end:
        today = timezone.localdate()
        start = today.replace(day=1)
        end = today
    return start, end


def _finance_v2_orders_between(start, end):
    return Order.objects.filter(
        created_at__date__gte=start,
        created_at__date__lte=end,
    ).exclude(status=Order.STATUS_CANCELLED)


def _finance_v2_entries_between(start, end):
    return RestaurantFinancialEntry.objects.filter(
        entry_date__gte=start,
        entry_date__lte=end,
        status=RestaurantFinancialEntry.STATUS_APPROVED,
    )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def finance_profit_loss_v2(request):
    start, end = _finance_v2_date_range(request)

    orders = _finance_v2_orders_between(start, end)
    entries = _finance_v2_entries_between(start, end)

    revenue = orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    subtotal = orders.aggregate(s=Sum("subtotal"))["s"] or Decimal("0.00")
    delivery_fees = orders.aggregate(s=Sum("delivery_fee"))["s"] or Decimal("0.00")
    discounts = orders.aggregate(s=Sum("discount"))["s"] or Decimal("0.00")

    expenses = entries.filter(
        entry_type=RestaurantFinancialEntry.TYPE_EXPENSE
    ).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

    contributions = entries.filter(
        entry_type=RestaurantFinancialEntry.TYPE_CONTRIBUTION
    ).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

    settlements = entries.filter(
        entry_type=RestaurantFinancialEntry.TYPE_SETTLEMENT
    ).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")

    net_profit = revenue - expenses
    orders_count = orders.count()
    avg_order_value = revenue / orders_count if orders_count else Decimal("0.00")

    by_payment_method = list(
        orders.values("payment_method")
        .annotate(count=Count("id"), total=Sum("total"))
        .order_by("-total")
    )

    by_delivery_type = list(
        orders.values("delivery_type")
        .annotate(count=Count("id"), total=Sum("total"))
        .order_by("-total")
    )

    expense_by_category = list(
        entries.filter(entry_type=RestaurantFinancialEntry.TYPE_EXPENSE)
        .values("category__name")
        .annotate(count=Count("id"), total=Sum("amount"))
        .order_by("-total")
    )

    expense_by_paid_by = list(
        entries.filter(entry_type=RestaurantFinancialEntry.TYPE_EXPENSE)
        .values("paid_by")
        .annotate(count=Count("id"), total=Sum("amount"))
        .order_by("-total")
    )

    return Response({
        "period": {"start": start, "end": end},
        "summary": {
            "revenue": _finance_v2_money(revenue),
            "subtotal": _finance_v2_money(subtotal),
            "delivery_fees": _finance_v2_money(delivery_fees),
            "discounts": _finance_v2_money(discounts),
            "expenses": _finance_v2_money(expenses),
            "contributions_to_bbva": _finance_v2_money(contributions),
            "settlements": _finance_v2_money(settlements),
            "net_profit": _finance_v2_money(net_profit),
            "orders_count": orders_count,
            "average_order_value": _finance_v2_money(avg_order_value),
        },
        "orders_by_payment_method": [
            {"payment_method": x["payment_method"], "count": x["count"], "total": _finance_v2_money(x["total"])}
            for x in by_payment_method
        ],
        "orders_by_delivery_type": [
            {"delivery_type": x["delivery_type"], "count": x["count"], "total": _finance_v2_money(x["total"])}
            for x in by_delivery_type
        ],
        "expenses_by_category": [
            {"category": x["category__name"] or "Sin categoría", "count": x["count"], "total": _finance_v2_money(x["total"])}
            for x in expense_by_category
        ],
        "expenses_by_paid_by": [
            {"paid_by": x["paid_by"], "count": x["count"], "total": _finance_v2_money(x["total"])}
            for x in expense_by_paid_by
        ],
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def finance_product_sales_v2(request):
    start, end = _finance_v2_date_range(request)
    orders = _finance_v2_orders_between(start, end)

    rows = (
        OrderItem.objects
        .filter(order__in=orders)
        .values("menu_item_id", "name_snapshot")
        .annotate(quantity_sold=Sum("quantity"), revenue=Sum("total"))
        .order_by("-revenue")
    )

    data = []
    for row in rows:
        revenue = row["revenue"] or Decimal("0.00")
        qty = row["quantity_sold"] or 0
        avg_price = revenue / Decimal(qty) if qty else Decimal("0.00")
        data.append({
            "menu_item_id": row["menu_item_id"],
            "product": row["name_snapshot"],
            "quantity_sold": qty,
            "revenue": _finance_v2_money(revenue),
            "average_price": _finance_v2_money(avg_price),
        })

    return Response({"period": {"start": start, "end": end}, "products": data})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def finance_daily_report_v2(request):
    start, end = _finance_v2_date_range(request)

    orders_by_day = (
        _finance_v2_orders_between(start, end)
        .values("created_at__date")
        .annotate(revenue=Sum("total"), orders_count=Count("id"))
        .order_by("created_at__date")
    )

    expenses_by_day = (
        _finance_v2_entries_between(start, end)
        .filter(entry_type=RestaurantFinancialEntry.TYPE_EXPENSE)
        .values("entry_date")
        .annotate(expenses=Sum("amount"))
        .order_by("entry_date")
    )

    result = {}

    for x in orders_by_day:
        d = str(x["created_at__date"])
        result.setdefault(d, {"date": d, "revenue": Decimal("0.00"), "expenses": Decimal("0.00"), "orders_count": 0})
        result[d]["revenue"] = x["revenue"] or Decimal("0.00")
        result[d]["orders_count"] = x["orders_count"]

    for x in expenses_by_day:
        d = str(x["entry_date"])
        result.setdefault(d, {"date": d, "revenue": Decimal("0.00"), "expenses": Decimal("0.00"), "orders_count": 0})
        result[d]["expenses"] = x["expenses"] or Decimal("0.00")

    rows = []
    for d in sorted(result.keys()):
        row = result[d]
        net = row["revenue"] - row["expenses"]
        rows.append({
            "date": row["date"],
            "revenue": _finance_v2_money(row["revenue"]),
            "expenses": _finance_v2_money(row["expenses"]),
            "net_profit": _finance_v2_money(net),
            "orders_count": row["orders_count"],
        })

    return Response({"period": {"start": start, "end": end}, "days": rows})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def finance_partner_summary_v2(request):
    start, end = _finance_v2_date_range(request)
    settings = AccountingSettings.current()
    entries = _finance_v2_entries_between(start, end)

    expenses_by_partner = {"saeid": Decimal("0.00"), "ahmed": Decimal("0.00"), "bbva": Decimal("0.00")}
    for row in entries.filter(entry_type=RestaurantFinancialEntry.TYPE_EXPENSE).values("paid_by").annotate(total=Sum("amount")):
        expenses_by_partner[row["paid_by"]] = row["total"] or Decimal("0.00")

    contributions_by_partner = {"saeid": Decimal("0.00"), "ahmed": Decimal("0.00"), "bbva": Decimal("0.00")}
    for row in entries.filter(entry_type=RestaurantFinancialEntry.TYPE_CONTRIBUTION).values("contribution_from").annotate(total=Sum("amount")):
        if row["contribution_from"]:
            contributions_by_partner[row["contribution_from"]] = row["total"] or Decimal("0.00")

    total_expenses = sum(expenses_by_partner.values(), Decimal("0.00"))
    saeid_expected = total_expenses * (settings.saeid_share_percent / Decimal("100"))
    ahmed_expected = total_expenses * (settings.ahmed_share_percent / Decimal("100"))

    return Response({
        "period": {"start": start, "end": end},
        "shares": {
            "saeid_percent": _finance_v2_money(settings.saeid_share_percent),
            "ahmed_percent": _finance_v2_money(settings.ahmed_share_percent),
        },
        "expenses_paid": {k: _finance_v2_money(v) for k, v in expenses_by_partner.items()},
        "contributions_to_bbva": {k: _finance_v2_money(v) for k, v in contributions_by_partner.items()},
        "expected_expense_share": {
            "saeid": _finance_v2_money(saeid_expected),
            "ahmed": _finance_v2_money(ahmed_expected),
        },
        "balance_hint": {
            "saeid": _finance_v2_money(expenses_by_partner["saeid"] - saeid_expected),
            "ahmed": _finance_v2_money(expenses_by_partner["ahmed"] - ahmed_expected),
        }
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def finance_dashboard_v2(request):
    today = timezone.localdate()
    start = today.replace(day=1)
    end = today

    orders = _finance_v2_orders_between(start, end)
    entries = _finance_v2_entries_between(start, end)

    revenue = orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
    expenses = entries.filter(entry_type=RestaurantFinancialEntry.TYPE_EXPENSE).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
    net_profit = revenue - expenses

    top_products = (
        OrderItem.objects.filter(order__in=orders)
        .values("name_snapshot")
        .annotate(quantity_sold=Sum("quantity"), revenue=Sum("total"))
        .order_by("-revenue")[:5]
    )

    latest_expenses = list(
        entries.filter(entry_type=RestaurantFinancialEntry.TYPE_EXPENSE)
        .order_by("-entry_date", "-created_at")
        .values("entry_date", "title", "amount", "paid_by", "category__name")[:10]
    )

    return Response({
        "period": {"start": start, "end": end},
        "cards": {
            "revenue": _finance_v2_money(revenue),
            "expenses": _finance_v2_money(expenses),
            "net_profit": _finance_v2_money(net_profit),
            "orders_count": orders.count(),
        },
        "top_products": [
            {"product": x["name_snapshot"], "quantity_sold": x["quantity_sold"], "revenue": _finance_v2_money(x["revenue"])}
            for x in top_products
        ],
        "latest_expenses": [
            {
                "date": x["entry_date"],
                "title": x["title"],
                "amount": _finance_v2_money(x["amount"]),
                "paid_by": x["paid_by"],
                "category": x["category__name"] or "Sin categoría",
            }
            for x in latest_expenses
        ],
    })
"""

URLS_APPEND = """
# ============================================================
# Finance Reports v2 URLs - Casa de Kebab Turco
# ============================================================

from .views import (
    finance_profit_loss_v2,
    finance_product_sales_v2,
    finance_daily_report_v2,
    finance_partner_summary_v2,
    finance_dashboard_v2,
)

urlpatterns += [
    path("finance-v2/dashboard/", finance_dashboard_v2, name="finance-v2-dashboard"),
    path("finance-v2/profit-loss/", finance_profit_loss_v2, name="finance-v2-profit-loss"),
    path("finance-v2/product-sales/", finance_product_sales_v2, name="finance-v2-product-sales"),
    path("finance-v2/daily/", finance_daily_report_v2, name="finance-v2-daily"),
    path("finance-v2/partners/", finance_partner_summary_v2, name="finance-v2-partners"),
]
"""

views_path = APP / "views.py"
urls_path = APP / "urls.py"

if not views_path.exists() or not urls_path.exists():
    raise FileNotFoundError("Could not find backend/restaurant/views.py or backend/restaurant/urls.py")

urls_text = urls_path.read_text(encoding="utf-8")
if "from django.urls import path" not in urls_text:
    backup(urls_path)
    if "from django.urls import" in urls_text:
        urls_text = re.sub(r"from django\\.urls import ([^\\n]+)", r"from django.urls import path, \\1", urls_text, count=1)
    else:
        urls_text = "from django.urls import path\n" + urls_text
    urls_path.write_text(urls_text, encoding="utf-8")
    print("ENSURED path import in urls.py")

append_once(views_path, "Finance Reports v2 - Casa de Kebab Turco", VIEWS_APPEND)
append_once(urls_path, "Finance Reports v2 URLs - Casa de Kebab Turco", URLS_APPEND)

print("\nDONE.")
print("Backup saved at:", BACKUP)
print("\nNow run:")
print(r"cd D:\Python_project\casadekebab\backend")
print("python manage.py check")
print("python manage.py makemigrations restaurant")
print("python manage.py migrate")
print("python manage.py runserver")
print("\nTest endpoints:")
print("http://127.0.0.1:8000/api/restaurant/finance-v2/dashboard/")
print("http://127.0.0.1:8000/api/restaurant/finance-v2/profit-loss/?start=2026-07-01&end=2026-07-31")
