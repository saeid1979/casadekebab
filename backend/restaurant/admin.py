from django.contrib import admin
from .models import Category, MenuItem, MenuOptionGroup, MenuOption, Customer, CustomerAddress, PhoneVerificationCode, Order, OrderItem, Payment, Rider, RestaurantSettings, Coupon, SmsGatewayMessage, OrderChatMessage, OrderReview

class MenuOptionInline(admin.TabularInline):
    model = MenuOption
    extra = 1

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name_es', 'name_en', 'slug', 'sort_order', 'is_active')
    list_editable = ('sort_order', 'is_active')
    search_fields = ('name_es', 'name_en', 'slug')

@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ('name_es', 'category', 'price', 'is_active', 'is_available', 'sort_order')
    list_editable = ('price', 'is_active', 'is_available', 'sort_order')
    list_filter = ('category', 'is_active', 'is_available')
    search_fields = ('name_es', 'name_en', 'description_es')

@admin.register(MenuOptionGroup)
class MenuOptionGroupAdmin(admin.ModelAdmin):
    list_display = ('title_es', 'menu_item', 'required', 'min_choices', 'max_choices', 'sort_order')
    inlines = [MenuOptionInline]
    search_fields = ('title_es', 'menu_item__name_es')

@admin.register(MenuOption)
class MenuOptionAdmin(admin.ModelAdmin):
    list_display = ('name_es', 'group', 'extra_price', 'is_active', 'sort_order')
    list_editable = ('extra_price', 'is_active', 'sort_order')
    search_fields = ('name_es', 'name_en')

class CustomerAddressInline(admin.TabularInline):
    model = CustomerAddress
    extra = 0

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('phone', 'name', 'email', 'total_orders', 'last_order_at', 'created_at')
    search_fields = ('phone', 'name', 'email', 'default_address')
    inlines = [CustomerAddressInline]

@admin.register(PhoneVerificationCode)
class PhoneVerificationCodeAdmin(admin.ModelAdmin):
    list_display = ('phone', 'code', 'expires_at', 'is_used', 'attempt_count', 'created_at')
    list_filter = ('is_used',)
    search_fields = ('phone', 'code')

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('total',)

class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ('created_at',)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_code', 'customer_phone', 'customer_name', 'delivery_type', 'status', 'assigned_rider', 'payment_method', 'payment_status', 'total', 'created_at')
    list_filter = ('status', 'assigned_rider', 'payment_method', 'payment_status', 'delivery_type', 'created_at')
    search_fields = ('order_code', 'customer_phone', 'customer_name', 'address')
    readonly_fields = ('order_code', 'subtotal', 'total', 'created_at', 'updated_at')
    inlines = [OrderItemInline, PaymentInline]

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'name_snapshot', 'quantity', 'price_snapshot', 'total')
    search_fields = ('order__order_code', 'name_snapshot')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('order', 'method', 'provider', 'amount', 'status', 'transaction_id', 'created_at')
    list_filter = ('method', 'provider', 'status')
    search_fields = ('order__order_code', 'transaction_id')


@admin.register(Rider)
class RiderAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'username', 'phone', 'is_active',
        'last_location_at', 'created_at'
    )
    list_editable = ('is_active',)
    list_filter = ('is_active',)
    search_fields = ('name', 'username', 'phone')
    readonly_fields = (
        'password_hash', 'current_latitude', 'current_longitude',
        'last_location_at', 'created_at'
    )
    fieldsets = (
        ('Datos del repartidor', {
            'fields': ('name', 'username', 'phone', 'is_active')
        }),
        ('Seguridad', {
            'fields': ('password_hash',),
            'description': (
                'La contraseña se gestiona de forma segura desde '
                'Admin PRO > Repartidores.'
            ),
        }),
        ('Ubicación', {
            'fields': (
                'current_latitude', 'current_longitude', 'last_location_at'
            ),
        }),
        ('Registro', {
            'fields': ('created_at',),
        }),
    )


@admin.register(RestaurantSettings)
class RestaurantSettingsAdmin(admin.ModelAdmin):
    list_display = ('restaurant_name', 'phone', 'is_open', 'delivery_enabled', 'delivery_fee', 'minimum_delivery_order', 'updated_at')


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'value', 'minimum_order', 'first_order_only', 'is_active', 'used_count', 'max_uses')
    list_filter = ('is_active', 'discount_type', 'first_order_only')
    search_fields = ('code', 'description')


@admin.register(SmsGatewayMessage)
class SmsGatewayMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'phone', 'status', 'device_id', 'attempts', 'created_at', 'sent_at')
    list_filter = ('status', 'created_at')
    search_fields = ('phone', 'message', 'device_id', 'error')
    readonly_fields = ('created_at', 'updated_at', 'sent_at')



@admin.register(OrderChatMessage)
class OrderChatMessageAdmin(admin.ModelAdmin):
    list_display = ('order', 'sender_type', 'sender_name', 'created_at', 'is_read')
    list_filter = ('sender_type', 'is_read', 'created_at')
    search_fields = ('order__order_code', 'sender_name', 'message')
    readonly_fields = ('created_at',)


@admin.register(OrderReview)
class OrderReviewAdmin(admin.ModelAdmin):
    list_display = ('order', 'customer_name', 'rating', 'status', 'created_at', 'approved_at')
    list_editable = ('status',)
    list_filter = ('status', 'rating', 'created_at')
    search_fields = ('order__order_code', 'customer_name', 'customer_phone', 'comment')
    readonly_fields = ('created_at', 'approved_at')
