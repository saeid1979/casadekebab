from datetime import timedelta
import uuid
import requests
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.core import signing
from functools import wraps
from django.utils import timezone
from django.db.models import Sum, Count
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Category, MenuItem, Customer, PhoneVerificationCode, Order, Rider, RestaurantSettings, Coupon, Payment
from .serializers import CategoryWithItemsSerializer, SendPhoneCodeSerializer, VerifyPhoneCodeSerializer, CustomerSerializer, CreateOrderSerializer, OrderSerializer, RiderSerializer, CategoryAdminSerializer, MenuItemAdminSerializer, MenuItemSerializer, RestaurantSettingsSerializer, CouponSerializer
from .notifications import send_telegram_message, build_order_message, send_customer_order_sms


ADMIN_TOKEN_SALT = 'casa-de-kebab-admin-v1'
ADMIN_TOKEN_MAX_AGE = 60 * 60 * 12  # 12 hours


def build_admin_token(user):
    return signing.dumps({
        'uid': user.id,
        'username': user.get_username(),
        'is_staff': bool(user.is_staff),
        'is_superuser': bool(user.is_superuser),
    }, salt=ADMIN_TOKEN_SALT)


def get_admin_user_from_request(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '') or ''
    token = ''
    if auth_header.lower().startswith('bearer '):
        token = auth_header.split(' ', 1)[1].strip()
    if not token:
        token = request.query_params.get('admin_token', '').strip()
    if not token:
        return None
    try:
        data = signing.loads(token, salt=ADMIN_TOKEN_SALT, max_age=ADMIN_TOKEN_MAX_AGE)
        user = get_user_model().objects.get(id=data.get('uid'), is_active=True)
    except Exception:
        return None
    if not (user.is_staff or user.is_superuser):
        return None
    return user


def admin_token_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user = get_admin_user_from_request(request)
        if not user:
            return Response({'detail': 'Admin login required.'}, status=status.HTTP_401_UNAUTHORIZED)
        request.admin_user = user
        return view_func(request, *args, **kwargs)
    return wrapper


@api_view(['POST'])
def admin_login(request):
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if not username or not password:
        return Response({'detail': 'username and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    user = authenticate(request, username=username, password=password)
    if not user or not user.is_active or not (user.is_staff or user.is_superuser):
        return Response({'detail': 'Invalid admin username or password.'}, status=status.HTTP_403_FORBIDDEN)
    token = build_admin_token(user)
    return Response({
        'success': True,
        'token': token,
        'user': {
            'id': user.id,
            'username': user.get_username(),
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        },
        'expires_in_hours': 12,
    })


@api_view(['GET'])
def admin_me(request):
    user = get_admin_user_from_request(request)
    if not user:
        return Response({'authenticated': False}, status=status.HTTP_401_UNAUTHORIZED)
    return Response({
        'authenticated': True,
        'user': {
            'id': user.id,
            'username': user.get_username(),
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        }
    })

def find_available_rider():
    """Return the active rider with the fewest active delivery orders.

    This keeps assignment simple and predictable for a small restaurant: the
    rider with the smallest number of unfinished delivery orders receives the
    next delivery order. If there are no active riders, return None.
    """
    riders = list(Rider.objects.filter(is_active=True))
    if not riders:
        return None
    active_statuses_to_ignore = [Order.STATUS_DELIVERED, Order.STATUS_CANCELLED]
    return min(
        riders,
        key=lambda rider: rider.orders.filter(delivery_type=Order.DELIVERY_DELIVERY).exclude(status__in=active_statuses_to_ignore).count()
    )


def auto_assign_rider_to_order(order, force_status=False):
    """Assign the best available rider to a delivery order if it has none."""
    if order.delivery_type != Order.DELIVERY_DELIVERY or order.assigned_rider_id:
        return order, False
    rider = find_available_rider()
    if not rider:
        return order, False
    order.assigned_rider = rider
    update_fields = ['assigned_rider', 'updated_at']
    if force_status and order.status in [Order.STATUS_PENDING, Order.STATUS_ACCEPTED, Order.STATUS_PREPARING, Order.STATUS_READY]:
        order.status = Order.STATUS_OUT_FOR_DELIVERY
        update_fields.append('status')
    order.save(update_fields=update_fields)
    return order, True

class MenuViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CategoryWithItemsSerializer
    def get_queryset(self):
        return Category.objects.filter(is_active=True).prefetch_related('items', 'items__option_groups', 'items__option_groups__options').order_by('sort_order', 'name_es')

@api_view(['POST'])
def send_phone_code(request):
    serializer = SendPhoneCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = serializer.validated_data['phone']
    code = PhoneVerificationCode.generate_code()
    PhoneVerificationCode.objects.filter(phone=phone, is_used=False).update(is_used=True)
    verification = PhoneVerificationCode.objects.create(phone=phone, code=code, expires_at=timezone.now() + timedelta(minutes=5))
    sms_mode = getattr(settings, 'SMS_MODE', 'console')
    if sms_mode == 'console':
        print('======================================')
        print('Casa de Kebab Turco verification code')
        print(f'Phone: {phone}')
        print(f'Code: {verification.code}')
        print('======================================')
    return Response({'success': True, 'message': 'Verification code sent.', 'mode': sms_mode})

@api_view(['POST'])
def verify_phone_code(request):
    serializer = VerifyPhoneCodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    phone = serializer.validated_data['phone']
    code = serializer.validated_data['code']
    try:
        verification = PhoneVerificationCode.objects.filter(phone=phone, code=code, is_used=False).latest('created_at')
    except PhoneVerificationCode.DoesNotExist:
        return Response({'success': False, 'message': 'Invalid code.'}, status=status.HTTP_400_BAD_REQUEST)
    verification.attempt_count += 1
    if verification.is_expired:
        verification.save()
        return Response({'success': False, 'message': 'Code expired.'}, status=status.HTTP_400_BAD_REQUEST)
    verification.is_used = True
    verification.save()
    customer, created = Customer.objects.get_or_create(phone=phone)
    customer.last_login_at = timezone.now()
    customer.save()
    return Response({'success': True, 'customer': CustomerSerializer(customer).data, 'is_new_customer': created})

@api_view(['GET'])
def customer_by_phone(request):
    phone = request.query_params.get('phone')
    if not phone:
        return Response({'detail': 'phone is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        customer = Customer.objects.get(phone=phone)
    except Customer.DoesNotExist:
        return Response({'exists': False})
    return Response({'exists': True, 'customer': CustomerSerializer(customer).data})

@api_view(['POST'])
def create_order(request):
    serializer = CreateOrderSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    order = serializer.save()

    # Auto-assign delivery orders to the currently freest active rider.
    # The order remains pending/accepted until the restaurant changes its status;
    # when it is sent out for delivery, auto assignment is also enforced.
    order, auto_assigned = auto_assign_rider_to_order(order, force_status=False)

    # Send Telegram alert if enabled in .env
    try:
        order = Order.objects.select_related('assigned_rider').prefetch_related('items').get(id=order.id)
        send_telegram_message(build_order_message(order))
    except Exception as exc:
        print(f'Order notification skipped: {exc}')
    sms_sent = False
    try:
        sms_sent = send_customer_order_sms(order)
    except Exception as exc:
        print(f'Customer order SMS skipped: {exc}')

    payload = OrderSerializer(order).data
    payload['auto_assigned_rider'] = auto_assigned
    payload['customer_sms_sent'] = sms_sent
    return Response({'success': True, 'order': payload}, status=status.HTTP_201_CREATED)

@api_view(['GET'])
def order_detail(request, order_code):
    try:
        order = Order.objects.prefetch_related('items', 'payments').get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(OrderSerializer(order).data)


@api_view(['GET'])
def public_order_tracking(request):
    """Allow customers to track an order using order code and phone number."""
    order_code = request.query_params.get('order_code', '').strip().upper()
    phone = request.query_params.get('phone', '').strip()
    if not order_code or not phone:
        return Response({'detail': 'order_code and phone are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        order = Order.objects.select_related('assigned_rider').prefetch_related('items', 'payments').get(order_code__iexact=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Pedido no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    clean_input_phone = ''.join(ch for ch in phone if ch.isdigit())
    clean_order_phone = ''.join(ch for ch in order.customer_phone if ch.isdigit())
    if clean_input_phone and clean_order_phone and not clean_order_phone.endswith(clean_input_phone[-9:]):
        return Response({'detail': 'El teléfono no coincide con el pedido.'}, status=status.HTTP_403_FORBIDDEN)
    payload = OrderSerializer(order).data
    payload['tracking_enabled'] = bool(order.assigned_rider and order.assigned_rider.current_latitude and order.assigned_rider.current_longitude)
    payload['restaurant_location'] = {'latitude': '40.974836942683254', 'longitude': '-5.649336331469509'}
    return Response(payload)


@api_view(['GET'])
@admin_token_required
def admin_tracking_orders(request):
    """Return active delivery orders with rider location for the admin live map."""
    qs = Order.objects.select_related('assigned_rider').prefetch_related('items', 'payments').filter(
        delivery_type=Order.DELIVERY_DELIVERY
    ).exclude(status__in=[Order.STATUS_DELIVERED, Order.STATUS_CANCELLED]).order_by('-created_at')[:80]
    return Response(OrderSerializer(qs, many=True).data)


@api_view(['GET'])
def live_orders(request):
    """Return the latest orders for the live restaurant dashboard."""
    limit = int(request.query_params.get('limit', 30))
    qs = Order.objects.prefetch_related('items', 'payments').order_by('-created_at')[:limit]
    return Response(OrderSerializer(qs, many=True).data)


@api_view(['PATCH', 'POST'])
@admin_token_required
def update_order_status(request, order_code):
    try:
        order = Order.objects.get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    if new_status not in dict(Order.STATUS_CHOICES):
        return Response({'detail': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

    order.status = new_status
    order.save(update_fields=['status', 'updated_at'])

    # If the restaurant marks a delivery order as ready or out for delivery and
    # no rider is selected yet, automatically choose the freest active rider.
    if new_status in [Order.STATUS_READY, Order.STATUS_OUT_FOR_DELIVERY]:
        order, _ = auto_assign_rider_to_order(order, force_status=(new_status == Order.STATUS_OUT_FOR_DELIVERY))

    return Response(OrderSerializer(order).data)


@api_view(['POST'])
def test_telegram(request):
    ok = send_telegram_message('✅ Test Telegram - Casa de Kebab Turco')
    return Response({'success': ok})


@api_view(['GET', 'POST'])
@admin_token_required
def riders_list(request):
    """List active riders or create a rider from the React live orders panel."""
    if request.method == 'GET':
        qs = Rider.objects.filter(is_active=True).order_by('name')
        return Response(RiderSerializer(qs, many=True).data)

    name = request.data.get('name', '').strip()
    phone = request.data.get('phone', '').strip()
    if not name or not phone:
        return Response({'detail': 'name and phone are required'}, status=status.HTTP_400_BAD_REQUEST)
    rider, created = Rider.objects.get_or_create(phone=phone, defaults={'name': name})
    if not created:
        rider.name = name
        rider.is_active = True
        rider.save(update_fields=['name', 'is_active'])
    return Response(RiderSerializer(rider).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(['POST'])
@admin_token_required
def auto_assign_rider(request, order_code):
    """Manually trigger automatic rider assignment for one delivery order."""
    try:
        order = Order.objects.select_related('assigned_rider').get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    if order.delivery_type != Order.DELIVERY_DELIVERY:
        return Response({'detail': 'Auto assignment is only available for delivery orders.'}, status=status.HTTP_400_BAD_REQUEST)

    previous_rider_id = order.assigned_rider_id
    order, assigned = auto_assign_rider_to_order(order, force_status=True)

    # If the order already had a rider, return it as a successful no-op.
    if previous_rider_id and not assigned:
        return Response({
            'success': True,
            'assigned': False,
            'message': 'Order already has a rider.',
            'order': OrderSerializer(order).data,
        })

    if not order.assigned_rider_id:
        return Response({
            'success': False,
            'assigned': False,
            'detail': 'No active rider is available.',
            'order': OrderSerializer(order).data,
        }, status=status.HTTP_409_CONFLICT)

    return Response({
        'success': True,
        'assigned': True,
        'message': 'Rider assigned automatically.',
        'order': OrderSerializer(order).data,
    })


@api_view(['POST'])
@admin_token_required
def assign_rider(request, order_code):
    try:
        order = Order.objects.get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    rider_id = request.data.get('rider_id')
    if not rider_id:
        order.assigned_rider = None
        order.save(update_fields=['assigned_rider', 'updated_at'])
        return Response(OrderSerializer(order).data)

    try:
        rider = Rider.objects.get(id=rider_id, is_active=True)
    except Rider.DoesNotExist:
        return Response({'detail': 'Rider not found'}, status=status.HTTP_404_NOT_FOUND)

    order.assigned_rider = rider
    if order.status in [Order.STATUS_PENDING, Order.STATUS_ACCEPTED, Order.STATUS_PREPARING, Order.STATUS_READY]:
        order.status = Order.STATUS_OUT_FOR_DELIVERY
        order.save(update_fields=['assigned_rider', 'status', 'updated_at'])
    else:
        order.save(update_fields=['assigned_rider', 'updated_at'])
    return Response(OrderSerializer(order).data)


@api_view(['GET'])
def rider_orders(request):
    phone = request.query_params.get('phone', '').strip()
    if not phone:
        return Response({'detail': 'phone is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rider = Rider.objects.get(phone=phone, is_active=True)
    except Rider.DoesNotExist:
        return Response({'detail': 'Rider not found'}, status=status.HTTP_404_NOT_FOUND)
    qs = rider.orders.exclude(status__in=[Order.STATUS_DELIVERED, Order.STATUS_CANCELLED]).prefetch_related('items', 'payments').order_by('-created_at')
    return Response({'rider': RiderSerializer(rider).data, 'orders': OrderSerializer(qs, many=True).data})


@api_view(['POST'])
def rider_location(request):
    phone = request.data.get('phone', '').strip()
    latitude = request.data.get('latitude')
    longitude = request.data.get('longitude')
    if not phone or latitude is None or longitude is None:
        return Response({'detail': 'phone, latitude and longitude are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        rider = Rider.objects.get(phone=phone, is_active=True)
    except Rider.DoesNotExist:
        return Response({'detail': 'Rider not found'}, status=status.HTTP_404_NOT_FOUND)
    rider.current_latitude = latitude
    rider.current_longitude = longitude
    rider.last_location_at = timezone.now()
    rider.save(update_fields=['current_latitude', 'current_longitude', 'last_location_at'])
    return Response(RiderSerializer(rider).data)


@api_view(['GET'])
def customer_orders(request):
    """Return a customer profile and all previous orders by phone number."""
    phone = request.query_params.get('phone', '').strip()
    if not phone:
        return Response({'detail': 'phone is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        customer = Customer.objects.get(phone=phone)
    except Customer.DoesNotExist:
        return Response({'exists': False, 'orders': []})

    orders = Order.objects.filter(customer=customer).prefetch_related('items', 'payments').order_by('-created_at')
    return Response({
        'exists': True,
        'customer': CustomerSerializer(customer).data,
        'orders': OrderSerializer(orders, many=True).data,
    })


@api_view(['GET'])
@admin_token_required
def dashboard_summary(request):
    """Professional restaurant dashboard: sales, order counts, payments, customers and product performance."""
    today = timezone.localdate()
    today_orders = Order.objects.filter(created_at__date=today)
    all_orders = Order.objects.all()
    paid_orders = all_orders.filter(payment_status=Order.PAYMENT_PAID)

    def safe_total(qs, field='total'):
        return qs.aggregate(value=Sum(field)).get('value') or 0

    payment_breakdown = list(
        all_orders.values('payment_method')
        .annotate(count=Count('id'), total=Sum('total'))
        .order_by('payment_method')
    )

    today_payment_breakdown = list(
        today_orders.values('payment_method')
        .annotate(count=Count('id'), total=Sum('total'))
        .order_by('payment_method')
    )

    status_breakdown = list(
        all_orders.values('status')
        .annotate(count=Count('id'), total=Sum('total'))
        .order_by('status')
    )

    delivery_breakdown = list(
        all_orders.values('delivery_type')
        .annotate(count=Count('id'), total=Sum('total'))
        .order_by('delivery_type')
    )

    product_sales = (
        Order.objects.values('items__name_snapshot')
        .annotate(quantity=Sum('items__quantity'), total=Sum('items__total'))
        .exclude(items__name_snapshot__isnull=True)
        .exclude(items__name_snapshot='')
    )
    top_items = list(product_sales.order_by('-quantity')[:10])
    low_items = list(product_sales.order_by('quantity')[:10])

    today_top_items = list(
        Order.objects.filter(created_at__date=today)
        .values('items__name_snapshot')
        .annotate(quantity=Sum('items__quantity'), total=Sum('items__total'))
        .exclude(items__name_snapshot__isnull=True)
        .exclude(items__name_snapshot='')
        .order_by('-quantity')[:10]
    )

    recent_customers = list(
        Customer.objects.order_by('-last_order_at')[:12]
        .values('id', 'name', 'phone', 'email', 'default_address', 'total_orders', 'last_order_at')
    )

    card_methods = [Order.PAYMENT_CARD_DELIVERY, Order.PAYMENT_ONLINE]
    card_paid = paid_orders.filter(payment_method__in=card_methods)

    return Response({
        'today': str(today),
        'today_sales': safe_total(today_orders),
        'today_orders_count': today_orders.count(),
        'pending_orders_count': all_orders.filter(status=Order.STATUS_PENDING).count(),
        'active_orders_count': all_orders.exclude(status__in=[Order.STATUS_DELIVERED, Order.STATUS_CANCELLED]).count(),
        'delivered_today_count': today_orders.filter(status=Order.STATUS_DELIVERED).count(),
        'cancelled_today_count': today_orders.filter(status=Order.STATUS_CANCELLED).count(),
        'total_sales': safe_total(all_orders),
        'total_orders_count': all_orders.count(),
        'paid_total': safe_total(paid_orders),
        'paid_orders_count': paid_orders.count(),
        'pending_payment_total': safe_total(all_orders.filter(payment_status=Order.PAYMENT_PENDING)),
        'card_paid_total': safe_total(card_paid),
        'card_paid_count': card_paid.count(),
        'cash_total': safe_total(all_orders.filter(payment_method=Order.PAYMENT_CASH)),
        'delivery_fee_total': safe_total(all_orders, 'delivery_fee'),
        'discount_total': safe_total(all_orders, 'discount'),
        'customers_count': Customer.objects.count(),
        'riders_count': Rider.objects.count(),
        'menu_items_count': MenuItem.objects.count(),
        'categories_count': Category.objects.count(),
        'payment_breakdown': payment_breakdown,
        'today_payment_breakdown': today_payment_breakdown,
        'status_breakdown': status_breakdown,
        'delivery_breakdown': delivery_breakdown,
        'top_items': top_items,
        'today_top_items': today_top_items,
        'low_items': low_items,
        'recent_customers': recent_customers,
    })



@api_view(['GET'])
@admin_token_required
def admin_customers(request):
    """Return customers for the professional admin panel."""
    limit = int(request.GET.get('limit', 200))
    qs = Customer.objects.order_by('-last_order_at', '-created_at')[:limit]
    rows = []
    for c in qs:
        orders = c.orders.all()
        rows.append({
            'id': c.id,
            'name': c.name,
            'phone': c.phone,
            'email': c.email,
            'default_address': c.default_address,
            'total_orders': c.total_orders,
            'last_order_at': c.last_order_at,
            'created_at': c.created_at,
            'total_spent': orders.aggregate(value=Sum('total')).get('value') or 0,
            'last_status': orders.order_by('-created_at').values_list('status', flat=True).first() or '',
        })
    return Response(rows)


@api_view(['PATCH', 'POST'])
@admin_token_required
def update_payment_status(request, order_code):
    try:
        order = Order.objects.get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('payment_status')
    if new_status not in dict(Order.PAYMENT_STATUS_CHOICES):
        return Response({'detail': 'Invalid payment status'}, status=status.HTTP_400_BAD_REQUEST)

    order.payment_status = new_status
    order.save(update_fields=['payment_status', 'updated_at'])
    order.payments.update(status=new_status)
    return Response(OrderSerializer(order).data)


# =========================
# Menu Management API
# =========================

@api_view(['GET', 'POST'])
@admin_token_required
def admin_categories(request):
    if request.method == 'GET':
        qs = Category.objects.all().order_by('sort_order', 'name_es')
        return Response(CategoryAdminSerializer(qs, many=True).data)

    serializer = CategoryAdminSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    category = serializer.save()
    return Response(CategoryAdminSerializer(category).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@admin_token_required
def admin_category_detail(request, category_id):
    try:
        category = Category.objects.get(id=category_id)
    except Category.DoesNotExist:
        return Response({'detail': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        category.is_active = False
        category.save(update_fields=['is_active'])
        return Response({'success': True, 'message': 'Category disabled'})

    serializer = CategoryAdminSerializer(category, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    category = serializer.save()
    return Response(CategoryAdminSerializer(category).data)


@api_view(['GET', 'POST'])
@admin_token_required
def admin_menu_items(request):
    if request.method == 'GET':
        qs = MenuItem.objects.select_related('category').all().order_by('category__sort_order', 'sort_order', 'name_es')
        return Response(MenuItemAdminSerializer(qs, many=True, context={'request': request}).data)

    serializer = MenuItemAdminSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    item = serializer.save()
    return Response(MenuItemAdminSerializer(item, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@admin_token_required
def admin_menu_item_detail(request, item_id):
    try:
        item = MenuItem.objects.get(id=item_id)
    except MenuItem.DoesNotExist:
        return Response({'detail': 'Menu item not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        item.is_active = False
        item.is_available = False
        item.save(update_fields=['is_active', 'is_available', 'updated_at'])
        return Response({'success': True, 'message': 'Menu item archived'})

    serializer = MenuItemAdminSerializer(item, data=request.data, partial=True, context={'request': request})
    serializer.is_valid(raise_exception=True)
    item = serializer.save()
    return Response(MenuItemAdminSerializer(item, context={'request': request}).data)


@api_view(['POST'])
@admin_token_required
def admin_menu_item_image(request, item_id):
    try:
        item = MenuItem.objects.get(id=item_id)
    except MenuItem.DoesNotExist:
        return Response({'detail': 'Menu item not found'}, status=status.HTTP_404_NOT_FOUND)

    image = request.FILES.get('image')
    if not image:
        return Response({'detail': 'image file is required'}, status=status.HTTP_400_BAD_REQUEST)

    item.image = image
    item.save(update_fields=['image', 'updated_at'])
    return Response(MenuItemAdminSerializer(item, context={'request': request}).data)



@api_view(['GET'])
def google_places_autocomplete(request):
    """Backend proxy for Google Places API (New) autocomplete.
    Keeps the API key off the frontend and avoids browser/referrer issues during local development.
    """
    q = (request.query_params.get('q') or '').strip()
    if len(q) < 1:
        return Response({'predictions': []})

    api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')
    if not api_key:
        return Response({'predictions': [], 'detail': 'GOOGLE_PLACES_API_KEY is not configured on backend.'}, status=status.HTTP_200_OK)

    url = 'https://places.googleapis.com/v1/places:autocomplete'
    payload = {
        'input': q,
        'languageCode': 'es',
        'regionCode': 'ES',
        'includedRegionCodes': ['ES'],
        'locationBias': {
            'circle': {
                'center': {'latitude': 40.974836942683254, 'longitude': -5.649336331469509},
                'radius': 12000.0,
            }
        },
    }
    headers = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': api_key,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=8)
        if r.status_code >= 400:
            return Response({'predictions': [], 'detail': r.text[:300]}, status=status.HTTP_200_OK)
        data = r.json()
    except Exception as exc:
        return Response({'predictions': [], 'detail': str(exc)}, status=status.HTTP_200_OK)

    predictions = []
    for item in data.get('suggestions', []):
        p = item.get('placePrediction') or {}
        text_obj = p.get('text') or {}
        structured = p.get('structuredFormat') or {}
        main_text = (structured.get('mainText') or {}).get('text') or text_obj.get('text') or ''
        secondary_text = (structured.get('secondaryText') or {}).get('text') or ''
        description = text_obj.get('text') or ', '.join(x for x in [main_text, secondary_text] if x)
        if not description:
            continue
        predictions.append({
            'place_id': p.get('placeId') or description,
            'description': description.replace(', Spain', ', España'),
            'main_text': main_text,
            'secondary_text': secondary_text.replace(', Spain', ', España'),
        })
    return Response({'predictions': predictions[:8]})

@api_view(['GET'])
def public_settings(request):
    settings_obj = RestaurantSettings.current()
    return Response(RestaurantSettingsSerializer(settings_obj).data)


@api_view(['GET', 'PATCH'])
@admin_token_required
def admin_restaurant_settings(request):
    settings_obj = RestaurantSettings.current()
    if request.method == 'GET':
        return Response(RestaurantSettingsSerializer(settings_obj).data)

    serializer = RestaurantSettingsSerializer(settings_obj, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['POST'])
def validate_coupon(request):
    code = request.data.get('code', '').strip().upper()
    subtotal = Decimal(str(request.data.get('subtotal', '0.00') or '0.00'))
    phone = request.data.get('phone', '').strip()
    customer = None
    if phone:
        customer = Customer.objects.filter(phone=phone).first()
    if not code:
        return Response({'valid': False, 'message': 'Introduce un código.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        coupon = Coupon.objects.get(code__iexact=code)
    except Coupon.DoesNotExist:
        return Response({'valid': False, 'message': 'Cupón no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    valid, message = coupon.is_valid_for(subtotal, customer=customer)
    discount = coupon.calculate_discount(subtotal) if valid else Decimal('0.00')
    return Response({
        'valid': valid,
        'message': message,
        'code': coupon.code,
        'discount': str(discount),
        'coupon': CouponSerializer(coupon).data,
    })


@api_view(['GET', 'POST'])
@admin_token_required
def admin_coupons(request):
    if request.method == 'GET':
        qs = Coupon.objects.all().order_by('code')
        return Response(CouponSerializer(qs, many=True).data)
    serializer = CouponSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(code=serializer.validated_data['code'].upper())
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@admin_token_required
def admin_coupon_detail(request, coupon_id):
    try:
        coupon = Coupon.objects.get(id=coupon_id)
    except Coupon.DoesNotExist:
        return Response({'detail': 'Coupon not found'}, status=status.HTTP_404_NOT_FOUND)
    if request.method == 'DELETE':
        coupon.is_active = False
        coupon.save(update_fields=['is_active'])
        return Response({'success': True})
    data = request.data.copy()
    if 'code' in data:
        data['code'] = str(data['code']).upper()
    serializer = CouponSerializer(coupon, data=data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# =========================
# Demo Online Payment API
# =========================

@api_view(['POST'])
def create_online_payment(request, order_code):
    """Create a demo online payment session.

    This is a safe test payment flow. It does not charge real money.
    Later we can replace provider='demo' with Stripe or Redsys/BBVA.
    """
    try:
        order = Order.objects.get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    if order.payment_method != Order.PAYMENT_ONLINE:
        order.payment_method = Order.PAYMENT_ONLINE
        order.payment_status = Order.PAYMENT_PENDING
        order.save(update_fields=['payment_method', 'payment_status', 'updated_at'])

    payment = order.payments.filter(provider='demo').order_by('-created_at').first()
    if not payment:
        payment = Payment.objects.create(
            order=order,
            method=Order.PAYMENT_ONLINE,
            provider='demo',
            amount=order.total,
            status=Order.PAYMENT_PENDING,
            transaction_id=f'DEMO-{uuid.uuid4().hex[:12].upper()}',
            raw_response={'mode': 'demo', 'created_by': 'Casa de Kebab Turco local test'},
        )

    return Response({
        'success': True,
        'provider': 'demo',
        'order_code': order.order_code,
        'amount': str(order.total),
        'payment_status': order.payment_status,
        'transaction_id': payment.transaction_id,
        'checkout_url': f'/payment-demo/{order.order_code}',
        'message': 'Demo payment session created. No real money is charged.',
    })


@api_view(['POST'])
def confirm_online_payment(request, order_code):
    """Confirm or fail a demo online payment.

    Body: {"result": "success"} or {"result": "failed"}
    """
    result = request.data.get('result', 'success')

    try:
        order = Order.objects.get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

    new_status = Order.PAYMENT_PAID if result == 'success' else Order.PAYMENT_FAILED
    order.payment_method = Order.PAYMENT_ONLINE
    order.payment_status = new_status
    order.save(update_fields=['payment_method', 'payment_status', 'updated_at'])

    payment = order.payments.filter(provider='demo').order_by('-created_at').first()
    if not payment:
        payment = Payment.objects.create(
            order=order,
            method=Order.PAYMENT_ONLINE,
            provider='demo',
            amount=order.total,
            transaction_id=f'DEMO-{uuid.uuid4().hex[:12].upper()}',
        )
    payment.status = new_status
    payment.raw_response = {'mode': 'demo', 'result': result, 'confirmed_at': timezone.now().isoformat()}
    payment.save(update_fields=['status', 'raw_response'])

    return Response({
        'success': True,
        'order': OrderSerializer(order).data,
        'message': 'Payment updated successfully.' if result == 'success' else 'Payment marked as failed.',
    })


@api_view(['GET'])
def online_payment_status(request, order_code):
    try:
        order = Order.objects.prefetch_related('items', 'payments').get(order_code=order_code)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response(OrderSerializer(order).data)
