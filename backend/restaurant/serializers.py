from decimal import Decimal
from django.db import transaction
from django.conf import settings
import requests
from django.utils import timezone
from rest_framework import serializers
from .models import Category, MenuItem, MenuOption, MenuOptionGroup, Customer, CustomerAddress, PhoneVerificationCode, Order, OrderItem, Payment, Rider, RestaurantSettings, Coupon, OrderChatMessage, OrderReview, CustomerPushDevice, ExpenseCategory, AccountingSettings, RestaurantFinancialEntry, SystemBackup, RiderPushDevice


SALAMANCA_LAT_MIN = 40.80
SALAMANCA_LAT_MAX = 41.12
SALAMANCA_LNG_MIN = -5.90
SALAMANCA_LNG_MAX = -5.35


def normalize_salamanca_coordinates(latitude, longitude):
    """Normalize a Salamanca point and repair a common lat/lng swap."""
    if latitude is None or longitude is None:
        return None, None

    lat = Decimal(str(latitude))
    lng = Decimal(str(longitude))

    normal = (
        Decimal(str(SALAMANCA_LAT_MIN)) <= lat <= Decimal(str(SALAMANCA_LAT_MAX))
        and Decimal(str(SALAMANCA_LNG_MIN)) <= lng <= Decimal(str(SALAMANCA_LNG_MAX))
    )
    swapped = (
        Decimal(str(SALAMANCA_LAT_MIN)) <= lng <= Decimal(str(SALAMANCA_LAT_MAX))
        and Decimal(str(SALAMANCA_LNG_MIN)) <= lat <= Decimal(str(SALAMANCA_LNG_MAX))
    )

    if normal:
        return lat, lng
    if swapped:
        return lng, lat

    raise serializers.ValidationError({
        'delivery_latitude': 'La ubicación seleccionada no corresponde a Salamanca.',
        'delivery_longitude': 'Selecciona una dirección válida de Salamanca desde las sugerencias.'
    })


def geocode_salamanca_address(address):
    """Resolve a Salamanca address server-side for both web and customer app."""
    query = str(address or '').strip()
    if not query:
        return None, None

    api_key = getattr(settings, 'GOOGLE_PLACES_API_KEY', '')

    if api_key:
        try:
            autocomplete_response = requests.post(
                'https://places.googleapis.com/v1/places:autocomplete',
                json={
                    'input': query,
                    'languageCode': 'es',
                    'regionCode': 'ES',
                    'includedRegionCodes': ['ES'],
                    'locationBias': {
                        'circle': {
                            'center': {
                                'latitude': 40.974836942683254,
                                'longitude': -5.649336331469509,
                            },
                            'radius': 12000.0,
                        }
                    },
                },
                headers={
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': api_key,
                    'X-Goog-FieldMask': 'suggestions.placePrediction.placeId',
                },
                timeout=8,
            )
            if autocomplete_response.status_code < 400:
                suggestions = autocomplete_response.json().get('suggestions', [])
                for suggestion in suggestions[:5]:
                    place_id = (
                        suggestion.get('placePrediction', {}).get('placeId')
                    )
                    if not place_id:
                        continue

                    details_response = requests.get(
                        f'https://places.googleapis.com/v1/places/{place_id}',
                        headers={
                            'X-Goog-Api-Key': api_key,
                            'X-Goog-FieldMask': 'location',
                        },
                        timeout=8,
                    )
                    if details_response.status_code >= 400:
                        continue

                    location = details_response.json().get('location') or {}
                    latitude = location.get('latitude')
                    longitude = location.get('longitude')
                    if latitude is None or longitude is None:
                        continue

                    lat = Decimal(str(latitude)).quantize(Decimal('0.0000001'))
                    lng = Decimal(str(longitude)).quantize(Decimal('0.0000001'))

                    if (
                        Decimal('40.80') <= lat <= Decimal('41.12')
                        and Decimal('-5.90') <= lng <= Decimal('-5.35')
                    ):
                        return lat, lng
        except Exception:
            pass

    # Free fallback so the web order flow is not blocked when Google is unavailable.
    try:
        response = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={
                'q': f'{query}, Salamanca, Castilla y León, España',
                'format': 'json',
                'limit': 5,
                'countrycodes': 'es',
                'addressdetails': 1,
                'viewbox': '-5.75,41.04,-5.55,40.90',
                'bounded': 1,
            },
            headers={
                'User-Agent': 'CasaDeKebabTurco/1.0',
                'Accept-Language': 'es',
            },
            timeout=8,
        )
        if response.status_code < 400:
            for item in response.json():
                lat = Decimal(str(item.get('lat'))).quantize(Decimal('0.0000001'))
                lng = Decimal(str(item.get('lon'))).quantize(Decimal('0.0000001'))
                if (
                    Decimal('40.80') <= lat <= Decimal('41.12')
                    and Decimal('-5.90') <= lng <= Decimal('-5.35')
                ):
                    return lat, lng
    except Exception:
        pass

    return None, None

class MenuOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuOption
        fields = ['id', 'name_es', 'name_en', 'extra_price', 'is_active', 'sort_order']

class MenuOptionGroupSerializer(serializers.ModelSerializer):
    options = MenuOptionSerializer(many=True, read_only=True)
    class Meta:
        model = MenuOptionGroup
        fields = ['id', 'title_es', 'title_en', 'required', 'min_choices', 'max_choices', 'sort_order', 'options']

class MenuItemSerializer(serializers.ModelSerializer):
    option_groups = MenuOptionGroupSerializer(many=True, read_only=True)
    image_url = serializers.SerializerMethodField()
    class Meta:
        model = MenuItem
        fields = ['id', 'category', 'name_es', 'name_en', 'description_es', 'description_en', 'price', 'image_url', 'is_active', 'is_available', 'sort_order', 'option_groups']
    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return ''

class CategoryWithItemsSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    class Meta:
        model = Category
        fields = ['id', 'name_es', 'name_en', 'slug', 'sort_order', 'items']
    def get_items(self, obj):
        qs = obj.items.filter(is_active=True, is_available=True).order_by('sort_order', 'name_es')
        return MenuItemSerializer(qs, many=True, context=self.context).data

class RiderSerializer(serializers.ModelSerializer):
    active_orders_count = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = Rider
        fields = [
            'id', 'name', 'phone', 'username', 'is_active',
            'current_latitude', 'current_longitude', 'last_location_at',
            'active_orders_count', 'has_password', 'created_at'
        ]

    def get_active_orders_count(self, obj):
        return obj.orders.exclude(
            status__in=[Order.STATUS_DELIVERED, Order.STATUS_CANCELLED]
        ).count()

    def get_has_password(self, obj):
        return bool(obj.password_hash)


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = ['id', 'address_text', 'city', 'postal_code', 'latitude', 'longitude', 'is_default']

class CustomerSerializer(serializers.ModelSerializer):
    addresses = CustomerAddressSerializer(many=True, read_only=True)
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'default_address', 'total_orders', 'last_order_at', 'last_login_at', 'addresses']


class CustomerPushDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerPushDevice
        fields = [
            'id', 'customer', 'phone', 'device_token', 'platform',
            'app_version', 'is_active', 'last_seen_at', 'created_at'
        ]
        read_only_fields = ['id', 'last_seen_at', 'created_at']


class SendPhoneCodeSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30)

class VerifyPhoneCodeSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30)
    code = serializers.CharField(max_length=8)

class OrderItemInputSerializer(serializers.Serializer):
    menu_item_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    options = serializers.ListField(required=False, default=list)

class CreateOrderSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    customer_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    admin_collection = serializers.BooleanField(required=False, default=False, write_only=True)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    delivery_type = serializers.ChoiceField(choices=[Order.DELIVERY_COLLECTION, Order.DELIVERY_DELIVERY])
    address = serializers.CharField(required=False, allow_blank=True)
    delivery_latitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False, allow_null=True)
    delivery_longitude = serializers.DecimalField(max_digits=10, decimal_places=7, required=False, allow_null=True)
    route_distance_km = serializers.FloatField(required=False, allow_null=True, min_value=0)
    route_duration_min = serializers.FloatField(required=False, allow_null=True, min_value=0)
    delivery_fee_override = serializers.DecimalField(max_digits=9, decimal_places=2, required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)
    payment_method = serializers.ChoiceField(choices=[Order.PAYMENT_CASH, Order.PAYMENT_CARD_DELIVERY, Order.PAYMENT_ONLINE, Order.PAYMENT_STORE])
    items = OrderItemInputSerializer(many=True)
    coupon_code = serializers.CharField(max_length=40, required=False, allow_blank=True)

    def validate(self, attrs):
        admin_collection = bool(attrs.get('admin_collection'))
        allow_admin_collection = bool(self.context.get('allow_admin_collection'))

        if admin_collection:
            if not allow_admin_collection:
                raise serializers.ValidationError({
                    'admin_collection': 'Valid admin authentication is required.'
                })
            if attrs.get('delivery_type') != Order.DELIVERY_COLLECTION:
                raise serializers.ValidationError({
                    'admin_collection': 'Admin checkout without customer identity is only allowed for collection orders.'
                })
        else:
            phone = str(attrs.get('customer_phone') or '').strip()
            if not phone:
                raise serializers.ValidationError({'customer_phone': 'Phone is required.'})
            name = str(attrs.get('customer_name') or '').strip()
            if not name:
                raise serializers.ValidationError({'customer_name': 'Name is required.'})

        if attrs['delivery_type'] == Order.DELIVERY_DELIVERY:
            if not attrs.get('address'):
                raise serializers.ValidationError({'address': 'Address is required for delivery orders.'})

            latitude = attrs.get('delivery_latitude')
            longitude = attrs.get('delivery_longitude')

            # Web and customer app may send an address before coordinates are ready.
            # Resolve it on the server so one client never breaks the other.
            if latitude is None or longitude is None:
                latitude, longitude = geocode_salamanca_address(attrs.get('address'))

            if latitude is None or longitude is None:
                raise serializers.ValidationError({
                    'address': 'No se encontró una ubicación válida en Salamanca. Selecciona una sugerencia o revisa la dirección.'
                })

            latitude, longitude = normalize_salamanca_coordinates(
                latitude,
                longitude,
            )
            attrs['delivery_latitude'] = latitude.quantize(Decimal('0.0000001'))
            attrs['delivery_longitude'] = longitude.quantize(Decimal('0.0000001'))

        if not attrs.get('items'):
            raise serializers.ValidationError({'items': 'Order must contain at least one item.'})
        # route-input-normalization-v2
        # Browser/OSRM values can contain many decimal places.
        # Normalize them before saving into DecimalField model columns.
        distance = attrs.get('route_distance_km')
        duration = attrs.get('route_duration_min')

        if distance is not None:
            distance = Decimal(str(distance))
            attrs['route_distance_km'] = (
                None if distance > Decimal('100.00')
                else distance.quantize(Decimal('0.01'))
            )

        if duration is not None:
            duration = Decimal(str(duration))
            attrs['route_duration_min'] = (
                None if duration > Decimal('600.00')
                else duration.quantize(Decimal('0.01'))
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        admin_collection = bool(validated_data.pop('admin_collection', False))
        phone = str(validated_data.get('customer_phone') or '').strip()
        customer = None

        if not admin_collection:
            customer, _ = Customer.objects.get_or_create(phone=phone)
            customer.name = validated_data.get('customer_name', customer.name)
            customer.email = validated_data.get('customer_email', customer.email)
            if validated_data.get('address'):
                customer.default_address = validated_data.get('address')
            customer.total_orders += 1
            customer.last_order_at = timezone.now()
            customer.save()

            if validated_data.get('address'):
                CustomerAddress.objects.get_or_create(
                    customer=customer,
                    address_text=validated_data.get('address'),
                    defaults={'city': 'Salamanca', 'is_default': True},
                )

        order = Order.objects.create(
            customer=customer,
            customer_name='' if admin_collection else validated_data.get('customer_name', ''),
            customer_phone='' if admin_collection else phone,
            customer_email='' if admin_collection else validated_data.get('customer_email', ''),
            delivery_type=validated_data['delivery_type'],
            address=validated_data.get('address', ''),
            delivery_latitude=validated_data.get('delivery_latitude'),
            delivery_longitude=validated_data.get('delivery_longitude'),
            route_distance_km=validated_data.get('route_distance_km'),
            route_duration_min=validated_data.get('route_duration_min'),
            route_provider='OSRM demo' if validated_data.get('route_distance_km') else '',
            note=validated_data.get('note', ''),
            payment_method=validated_data['payment_method'],
        )
        subtotal = Decimal('0.00')
        for item_data in items_data:
            menu_item = MenuItem.objects.get(id=item_data['menu_item_id'], is_active=True, is_available=True)
            quantity = item_data['quantity']
            extra_price = Decimal('0.00')
            clean_options = []
            for option in item_data.get('options', []):
                option_id = option.get('id')
                if option_id:
                    try:
                        db_option = MenuOption.objects.get(id=option_id, is_active=True)
                        extra_price += db_option.extra_price
                        clean_options.append({'id': db_option.id, 'name_es': db_option.name_es, 'name_en': db_option.name_en, 'extra_price': str(db_option.extra_price)})
                    except MenuOption.DoesNotExist:
                        pass
            final_price = menu_item.price + extra_price
            order_item = OrderItem.objects.create(order=order, menu_item=menu_item, name_snapshot=menu_item.name_es, price_snapshot=final_price, quantity=quantity, options_snapshot=clean_options)
            subtotal += order_item.total
        order.subtotal = subtotal

        settings_obj = RestaurantSettings.current()
        if order.delivery_type == Order.DELIVERY_DELIVERY:
            override_fee = validated_data.get('delivery_fee_override')
            if subtotal >= settings_obj.free_delivery_minimum:
                order.delivery_fee = Decimal('0.00')
            elif override_fee is not None:
                order.delivery_fee = Decimal(str(override_fee)).quantize(Decimal('0.01'))
            elif order.route_distance_km:
                base_fee = settings_obj.delivery_fee or Decimal('1.50')
                extra_km = max(Decimal('0.00'), Decimal(str(order.route_distance_km)) - Decimal('2.00'))
                order.delivery_fee = (base_fee + (extra_km * Decimal('0.70'))).quantize(Decimal('0.01'))
            else:
                order.delivery_fee = settings_obj.delivery_fee
        else:
            order.delivery_fee = Decimal('0.00')

        coupon_code = validated_data.get('coupon_code', '').strip().upper()
        if coupon_code:
            try:
                coupon = Coupon.objects.get(code__iexact=coupon_code)
                valid, _message = coupon.is_valid_for(subtotal, customer=customer)
                if valid:
                    order.discount = coupon.calculate_discount(subtotal)
                    coupon.used_count += 1
                    coupon.save(update_fields=['used_count'])
            except Coupon.DoesNotExist:
                pass

        order.save()
        Payment.objects.create(order=order, method=order.payment_method, amount=order.total, status=order.payment_status)
        return order

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'name_snapshot', 'price_snapshot', 'quantity', 'options_snapshot', 'total']

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'method', 'provider', 'amount', 'status', 'transaction_id', 'created_at']

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    assigned_rider_data = RiderSerializer(source='assigned_rider', read_only=True)
    class Meta:
        model = Order
        fields = ['id', 'order_code', 'customer_name', 'customer_phone', 'customer_email', 'delivery_type', 'address', 'delivery_latitude', 'delivery_longitude', 'route_distance_km', 'route_duration_min', 'route_provider', 'assigned_rider_data', 'note', 'status', 'payment_method', 'payment_status', 'subtotal', 'delivery_fee', 'discount', 'total', 'items', 'payments', 'created_at']


class CategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name_es', 'name_en', 'slug', 'sort_order', 'is_active']


class MenuItemAdminSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name_es', read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'category', 'category_name', 'name_es', 'name_en',
            'description_es', 'description_en', 'price', 'image', 'image_url',
            'is_active', 'is_available', 'sort_order', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        if obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return ''


class RestaurantSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantSettings
        fields = [
            'id', 'restaurant_name', 'phone', 'address', 'is_open', 'opening_hours',
            'collection_enabled', 'delivery_enabled', 'delivery_fee',
            'minimum_delivery_order', 'free_delivery_minimum', 'updated_at'
        ]


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'description', 'discount_type', 'value', 'minimum_order',
            'first_order_only', 'is_active', 'valid_from', 'valid_until',
            'max_uses', 'used_count', 'created_at'
        ]
        read_only_fields = ['used_count', 'created_at']



class OrderChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderChatMessage
        fields = ['id', 'sender_type', 'sender_name', 'message', 'is_read', 'created_at']
        read_only_fields = ['id', 'is_read', 'created_at']


class OrderReviewSerializer(serializers.ModelSerializer):
    order_code = serializers.CharField(source='order.order_code', read_only=True)

    class Meta:
        model = OrderReview
        fields = ['id', 'order_code', 'customer_name', 'rating', 'comment', 'status', 'created_at', 'approved_at']
        read_only_fields = ['id', 'order_code', 'status', 'created_at', 'approved_at']

class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name', 'is_active', 'sort_order', 'created_at']
        read_only_fields = ['id', 'created_at']


class AccountingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingSettings
        fields = [
            'id', 'saeid_share_percent', 'ahmed_share_percent',
            'bbva_initial_balance', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']

    def validate(self, attrs):
        saeid = Decimal(str(attrs.get(
            'saeid_share_percent',
            getattr(self.instance, 'saeid_share_percent', Decimal('50.00'))
        )))
        ahmed = Decimal(str(attrs.get(
            'ahmed_share_percent',
            getattr(self.instance, 'ahmed_share_percent', Decimal('50.00'))
        )))
        if (saeid + ahmed).quantize(Decimal('0.01')) != Decimal('100.00'):
            raise serializers.ValidationError(
                'La suma de los porcentajes de Saeid y Ahmed debe ser 100.'
            )
        return attrs


class RestaurantFinancialEntrySerializer(serializers.ModelSerializer):
    ALLOWED_RECEIPT_EXTENSIONS = {
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
        '.rtf', '.odt', '.ods', '.ppt', '.pptx',
        '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
        '.tif', '.tiff', '.zip',
    }
    MAX_RECEIPT_SIZE = 20 * 1024 * 1024

    category_name = serializers.CharField(source='category.name', read_only=True)
    receipt_url = serializers.SerializerMethodField()
    paid_by_label = serializers.CharField(source='get_paid_by_display', read_only=True)
    entry_type_label = serializers.CharField(source='get_entry_type_display', read_only=True)
    payment_method_label = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = RestaurantFinancialEntry
        fields = [
            'id', 'entry_type', 'entry_type_label', 'title', 'description',
            'amount', 'entry_date', 'category', 'category_name',
            'paid_by', 'paid_by_label', 'contribution_from', 'settlement_to',
            'payment_method', 'payment_method_label', 'invoice_number',
            'bank_reference', 'receipt', 'receipt_url', 'status', 'status_label',
            'created_by_username', 'updated_by_username', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by_username', 'updated_by_username',
            'created_at', 'updated_at', 'receipt_url'
        ]
        extra_kwargs = {
            'receipt': {'write_only': True, 'required': False, 'allow_null': True}
        }

    def get_receipt_url(self, obj):
        if not obj.receipt:
            return ''
        request = self.context.get('request')
        url = obj.receipt.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        entry_type = attrs.get(
            'entry_type',
            getattr(self.instance, 'entry_type', RestaurantFinancialEntry.TYPE_EXPENSE)
        )
        paid_by = attrs.get(
            'paid_by',
            getattr(self.instance, 'paid_by', RestaurantFinancialEntry.PARTY_SAEID)
        )
        contribution_from = attrs.get(
            'contribution_from',
            getattr(self.instance, 'contribution_from', '')
        )
        settlement_to = attrs.get(
            'settlement_to',
            getattr(self.instance, 'settlement_to', '')
        )

        if entry_type == RestaurantFinancialEntry.TYPE_CONTRIBUTION:
            if contribution_from not in {
                RestaurantFinancialEntry.PARTY_SAEID,
                RestaurantFinancialEntry.PARTY_AHMED,
            }:
                raise serializers.ValidationError({
                    'contribution_from': 'Selecciona Saeid o Ahmed.'
                })
            attrs['paid_by'] = RestaurantFinancialEntry.PARTY_BBVA

        if entry_type == RestaurantFinancialEntry.TYPE_SETTLEMENT:
            if paid_by not in {
                RestaurantFinancialEntry.PARTY_SAEID,
                RestaurantFinancialEntry.PARTY_AHMED,
            }:
                raise serializers.ValidationError({
                    'paid_by': 'Selecciona quién paga la liquidación.'
                })
            if settlement_to not in {
                RestaurantFinancialEntry.PARTY_SAEID,
                RestaurantFinancialEntry.PARTY_AHMED,
            } or settlement_to == paid_by:
                raise serializers.ValidationError({
                    'settlement_to': 'Selecciona el otro socio como destinatario.'
                })

        if entry_type == RestaurantFinancialEntry.TYPE_EXPENSE:
            attrs['contribution_from'] = ''
            attrs['settlement_to'] = ''

        return attrs

    def validate_receipt(self, value):
        if not value:
            return value

        from pathlib import Path

        extension = Path(value.name).suffix.lower()
        if extension not in self.ALLOWED_RECEIPT_EXTENSIONS:
            raise serializers.ValidationError(
                'Formato no permitido. Usa PDF, Office, texto, imagen o ZIP.'
            )
        if value.size > self.MAX_RECEIPT_SIZE:
            raise serializers.ValidationError(
                'El archivo no puede superar 20 MB.'
            )
        return value


class SystemBackupSerializer(serializers.ModelSerializer):
    backup_type_label = serializers.CharField(source='get_backup_type_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    download_available = serializers.SerializerMethodField()

    class Meta:
        model = SystemBackup
        fields = [
            'id', 'backup_type', 'backup_type_label', 'status', 'status_label',
            'file_name', 'file_size', 'checksum_sha256',
            'created_by_username', 'error_message', 'is_protected',
            'created_at', 'completed_at', 'download_available'
        ]
        read_only_fields = fields

    def get_download_available(self, obj):
        return bool(
            obj.status == SystemBackup.STATUS_COMPLETED
            and obj.file_path
        )

# --- Rider push serializer restored by targeted repair ---
class RiderPushDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiderPushDevice
        fields = "__all__"
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "last_seen_at",
        ]
# --- End Rider push serializer repair ---

