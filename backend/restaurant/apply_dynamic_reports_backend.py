from pathlib import Path
from datetime import datetime
import shutil

ROOT = Path(r"D:\Python_project\casadekebab")
VIEWS = ROOT / "backend" / "restaurant" / "views.py"
URLS = ROOT / "backend" / "restaurant" / "urls.py"

REPORT_FUNCTION = """@api_view(['GET'])
def admin_dynamic_reports(request):
    admin_user = get_admin_user_from_request(request)
    if not admin_user:
        return Response({'detail': 'Admin authentication is required.'}, status=status.HTTP_401_UNAUTHORIZED)

    from datetime import timedelta
    from decimal import Decimal
    from django.db.models import Count, Sum, F, DecimalField, ExpressionWrapper, Max, Q
    from django.db.models.functions import TruncDate, ExtractHour
    from django.utils.dateparse import parse_date
    from .models import Order, OrderItem

    today = timezone.localdate()
    date_from = parse_date(str(request.query_params.get('date_from') or '')) or (today - timedelta(days=29))
    date_to = parse_date(str(request.query_params.get('date_to') or '')) or today
    if date_from > date_to:
        return Response({'detail': 'La fecha inicial no puede ser posterior a la fecha final.'}, status=status.HTTP_400_BAD_REQUEST)

    orders = Order.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)
    delivery_type = str(request.query_params.get('delivery_type') or '').strip()
    payment_method = str(request.query_params.get('payment_method') or '').strip()
    status_filter = str(request.query_params.get('status') or '').strip()
    rider_id = str(request.query_params.get('rider_id') or '').strip()
    if delivery_type: orders = orders.filter(delivery_type=delivery_type)
    if payment_method: orders = orders.filter(payment_method=payment_method)
    if status_filter: orders = orders.filter(status=status_filter)
    if rider_id.isdigit(): orders = orders.filter(assigned_rider_id=int(rider_id))

    cancelled_qs = orders.filter(status=Order.STATUS_CANCELLED)
    valid_orders = orders.exclude(status=Order.STATUS_CANCELLED)
    revenue = valid_orders.aggregate(value=Sum('total'))['value'] or Decimal('0.00')
    discounts = valid_orders.aggregate(value=Sum('discount'))['value'] or Decimal('0.00')
    orders_count = valid_orders.count()
    cancelled_count = cancelled_qs.count()
    average_order = (revenue / orders_count) if orders_count else Decimal('0.00')
    item_revenue = ExpressionWrapper(F('price_snapshot') * F('quantity'), output_field=DecimalField(max_digits=12, decimal_places=2))

    daily_sales = [{'day': row['day'].isoformat() if row['day'] else '', 'orders': row['orders'] or 0, 'revenue': float(row['revenue'] or 0)} for row in valid_orders.annotate(day=TruncDate('created_at')).values('day').annotate(orders=Count('id'), revenue=Sum('total')).order_by('day')]
    top_items = [{'name': row['name_snapshot'] or 'Producto', 'quantity': int(row['quantity'] or 0), 'revenue': float(row['revenue'] or 0)} for row in OrderItem.objects.filter(order__in=valid_orders).values('name_snapshot').annotate(quantity=Sum('quantity'), revenue=Sum(item_revenue)).order_by('-quantity', '-revenue')[:10]]

    status_labels = {'pending':'Pendiente','accepted':'Aceptado','preparing':'Preparando','out_for_delivery':'En reparto','delivered':'Entregado','cancelled':'Cancelado'}
    status_breakdown = [{'label': status_labels.get(row['status'], row['status']), 'count': int(row['count'] or 0), 'revenue': float(row['revenue'] or 0)} for row in orders.values('status').annotate(count=Count('id'), revenue=Sum('total')).order_by('-count')]
    payment_labels = {'cash':'Efectivo','card_delivery':'Tarjeta','store':'En tienda','online':'Online'}
    payment_breakdown = [{'label': payment_labels.get(row['payment_method'], row['payment_method']), 'count': int(row['count'] or 0), 'revenue': float(row['revenue'] or 0)} for row in valid_orders.values('payment_method').annotate(count=Count('id'), revenue=Sum('total')).order_by('-revenue')]
    hourly_sales = [{'hour': f"{int(row['hour'] or 0):02d}:00", 'orders': int(row['orders'] or 0), 'revenue': float(row['revenue'] or 0)} for row in valid_orders.annotate(hour=ExtractHour('created_at')).values('hour').annotate(orders=Count('id'), revenue=Sum('total')).order_by('hour')]
    rider_performance = [{'id':row['assigned_rider_id'], 'name':row['assigned_rider__name'] or 'Repartidor', 'orders':int(row['orders'] or 0), 'delivered':int(row['delivered'] or 0), 'revenue':float(row['revenue'] or 0)} for row in valid_orders.filter(assigned_rider__isnull=False).values('assigned_rider_id','assigned_rider__name').annotate(orders=Count('id'), delivered=Count('id', filter=Q(status=Order.STATUS_DELIVERED)), revenue=Sum('total')).order_by('-delivered','-orders')]
    top_customers = [{'name':row['customer_name'] or 'Sin nombre','phone':row['customer_phone'] or '','orders':int(row['orders'] or 0),'revenue':float(row['revenue'] or 0),'last_order':row['last_order'].isoformat() if row['last_order'] else None} for row in valid_orders.exclude(customer_phone='').values('customer_name','customer_phone').annotate(orders=Count('id'), revenue=Sum('total'), last_order=Max('created_at')).order_by('-revenue','-orders')[:20]]

    return Response({
        'filters': {'date_from':date_from.isoformat(),'date_to':date_to.isoformat(),'delivery_type':delivery_type,'payment_method':payment_method,'status':status_filter,'rider_id':rider_id},
        'metrics': {'orders_count':orders_count,'revenue':float(revenue),'average_order':float(average_order),'delivery_orders':valid_orders.filter(delivery_type=Order.DELIVERY_DELIVERY).count(),'collection_orders':valid_orders.filter(delivery_type=Order.DELIVERY_COLLECTION).count(),'cancelled_orders':cancelled_count,'cancel_rate':round((cancelled_count / orders.count() * 100), 1) if orders.exists() else 0,'unique_customers':valid_orders.exclude(customer_phone='').values('customer_phone').distinct().count(),'discount_total':float(discounts)},
        'daily_sales':daily_sales,'top_items':top_items,'status_breakdown':status_breakdown,'payment_breakdown':payment_breakdown,'hourly_sales':hourly_sales,'rider_performance':rider_performance,'top_customers':top_customers,
    })
"""

def copy_backup(path):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = path.with_name(f"{path.stem}_before_dynamic_reports_{stamp}{path.suffix}")
    shutil.copy2(path, backup)
    return backup

def main():
    if not VIEWS.exists() or not URLS.exists():
        raise FileNotFoundError("Expected backend restaurant files were not found.")
    vb, ub = copy_backup(VIEWS), copy_backup(URLS)
    try:
        view_text = VIEWS.read_text(encoding="utf-8")
        if "def admin_dynamic_reports(request):" not in view_text:
            VIEWS.write_text(view_text.rstrip() + "\n\n" + REPORT_FUNCTION.strip() + "\n", encoding="utf-8")

        url_text = URLS.read_text(encoding="utf-8")
        if "admin_dynamic_reports" not in url_text:
            import_marker = "    dashboard_summary,"
            if import_marker not in url_text:
                raise RuntimeError("dashboard_summary import anchor not found in urls.py")
            url_text = url_text.replace(import_marker, import_marker + "\n    admin_dynamic_reports,", 1)
            route_marker = "    path('dashboard/summary/', dashboard_summary, name='dashboard-summary'),"
            if route_marker not in url_text:
                raise RuntimeError("dashboard summary route anchor not found in urls.py")
            url_text = url_text.replace(route_marker, route_marker + "\n    path('admin/reports/dynamic/', admin_dynamic_reports, name='admin-dynamic-reports'),", 1)
            URLS.write_text(url_text, encoding="utf-8")
    except Exception:
        shutil.copy2(vb, VIEWS)
        shutil.copy2(ub, URLS)
        raise
    print("Dynamic reports backend patch applied.")
    print("Backups:", vb, ub)

if __name__ == "__main__":
    main()
