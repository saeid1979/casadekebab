from decimal import Decimal
import random
import string
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator


class Category(models.Model):
    name_es = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True, default='')
    slug = models.SlugField(max_length=140, unique=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name_es']

    def __str__(self):
        return self.name_es


class MenuItem(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='items')
    name_es = models.CharField(max_length=160)
    name_en = models.CharField(max_length=160, blank=True, default='')
    description_es = models.TextField(blank=True, default='')
    description_en = models.TextField(blank=True, default='')
    price = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(Decimal('0.00'))])
    image = models.ImageField(upload_to='menu_items/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__sort_order', 'sort_order', 'name_es']

    def __str__(self):
        return self.name_es


class MenuOptionGroup(models.Model):
    menu_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='option_groups')
    title_es = models.CharField(max_length=120)
    title_en = models.CharField(max_length=120, blank=True, default='')
    required = models.BooleanField(default=False)
    min_choices = models.PositiveIntegerField(default=0)
    max_choices = models.PositiveIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.menu_item.name_es} - {self.title_es}'


class MenuOption(models.Model):
    group = models.ForeignKey(MenuOptionGroup, on_delete=models.CASCADE, related_name='options')
    name_es = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120, blank=True, default='')
    extra_price = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    def __str__(self):
        return self.name_es


class Customer(models.Model):
    name = models.CharField(max_length=160, blank=True, default='')
    phone = models.CharField(max_length=30, unique=True)
    email = models.EmailField(blank=True, default='')
    default_address = models.TextField(blank=True, default='')
    total_orders = models.PositiveIntegerField(default=0)
    last_order_at = models.DateTimeField(blank=True, null=True)
    last_login_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.phone} {self.name}'.strip()


class CustomerAddress(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    address_text = models.TextField()
    city = models.CharField(max_length=120, default='Salamanca')
    postal_code = models.CharField(max_length=20, blank=True, default='')
    latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return self.address_text[:80]




class Rider(models.Model):
    name = models.CharField(max_length=160)
    phone = models.CharField(max_length=30, unique=True)
    is_active = models.BooleanField(default=True)
    current_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    current_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    last_location_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} - {self.phone}'


class PhoneVerificationCode(models.Model):
    phone = models.CharField(max_length=30)
    code = models.CharField(max_length=8)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempt_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def generate_code(length=6):
        return ''.join(random.choices(string.digits, k=length))

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f'{self.phone} - {self.code}'


class RestaurantSettings(models.Model):
    restaurant_name = models.CharField(max_length=180, default='Casa de Kebab Turco')
    phone = models.CharField(max_length=40, default='+34 613 473 564')
    address = models.CharField(max_length=250, default='Calle García Lorca, 1, Salamanca 37004')
    is_open = models.BooleanField(default=True)
    opening_hours = models.CharField(max_length=180, blank=True, default='12:00 - 01:00')
    collection_enabled = models.BooleanField(default=True)
    delivery_enabled = models.BooleanField(default=True)
    delivery_fee = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('1.50'))
    minimum_delivery_order = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('10.00'))
    free_delivery_minimum = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('25.00'))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Restaurant settings'
        verbose_name_plural = 'Restaurant settings'

    def __str__(self):
        return self.restaurant_name

    @classmethod
    def current(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class Coupon(models.Model):
    DISCOUNT_PERCENT = 'percent'
    DISCOUNT_AMOUNT = 'amount'
    DISCOUNT_TYPE_CHOICES = [
        (DISCOUNT_PERCENT, 'Percent'),
        (DISCOUNT_AMOUNT, 'Fixed amount'),
    ]

    code = models.CharField(max_length=40, unique=True)
    description = models.CharField(max_length=180, blank=True, default='')
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default=DISCOUNT_PERCENT)
    value = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('10.00'))
    minimum_order = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    first_order_only = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateTimeField(blank=True, null=True)
    valid_until = models.DateTimeField(blank=True, null=True)
    max_uses = models.PositiveIntegerField(default=0, help_text='0 means unlimited')
    used_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return self.code

    def is_valid_for(self, subtotal, customer=None):
        now = timezone.now()
        subtotal = Decimal(str(subtotal or '0.00'))
        if not self.is_active:
            return False, 'Cupón desactivado.'
        if self.valid_from and now < self.valid_from:
            return False, 'Cupón todavía no disponible.'
        if self.valid_until and now > self.valid_until:
            return False, 'Cupón caducado.'
        if self.max_uses and self.used_count >= self.max_uses:
            return False, 'Cupón agotado.'
        if subtotal < self.minimum_order:
            return False, f'Pedido mínimo {self.minimum_order} €.'
        if self.first_order_only and customer and customer.total_orders > 0:
            return False, 'Sólo válido para el primer pedido.'
        return True, 'Cupón válido.'

    def calculate_discount(self, subtotal):
        subtotal = Decimal(str(subtotal or '0.00'))
        if self.discount_type == self.DISCOUNT_PERCENT:
            discount = subtotal * (self.value / Decimal('100'))
        else:
            discount = self.value
        if discount > subtotal:
            discount = subtotal
        return discount.quantize(Decimal('0.01'))


class Order(models.Model):
    DELIVERY_COLLECTION = 'collection'
    DELIVERY_DELIVERY = 'delivery'
    DELIVERY_TYPE_CHOICES = [(DELIVERY_COLLECTION, 'Recoger en tienda'), (DELIVERY_DELIVERY, 'Entrega a domicilio')]

    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_PREPARING = 'preparing'
    STATUS_READY = 'ready'
    STATUS_OUT_FOR_DELIVERY = 'out_for_delivery'
    STATUS_DELIVERED = 'delivered'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pendiente'),
        (STATUS_ACCEPTED, 'Aceptado'),
        (STATUS_PREPARING, 'Preparando'),
        (STATUS_READY, 'Listo'),
        (STATUS_OUT_FOR_DELIVERY, 'En reparto'),
        (STATUS_DELIVERED, 'Entregado'),
        (STATUS_CANCELLED, 'Cancelado'),
    ]

    PAYMENT_CASH = 'cash'
    PAYMENT_CARD_DELIVERY = 'card_delivery'
    PAYMENT_ONLINE = 'online'
    PAYMENT_STORE = 'store'
    PAYMENT_METHOD_CHOICES = [
        (PAYMENT_CASH, 'Efectivo'),
        (PAYMENT_CARD_DELIVERY, 'Tarjeta al repartidor'),
        (PAYMENT_ONLINE, 'Pago online'),
        (PAYMENT_STORE, 'Pagar en tienda'),
    ]

    PAYMENT_PENDING = 'pending'
    PAYMENT_PAID = 'paid'
    PAYMENT_FAILED = 'failed'
    PAYMENT_STATUS_CHOICES = [(PAYMENT_PENDING, 'Pendiente'), (PAYMENT_PAID, 'Pagado'), (PAYMENT_FAILED, 'Fallido')]

    order_code = models.CharField(max_length=30, unique=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, blank=True, null=True, related_name='orders')
    assigned_rider = models.ForeignKey(Rider, on_delete=models.SET_NULL, blank=True, null=True, related_name='orders')
    customer_name = models.CharField(max_length=160, blank=True, default='')
    customer_phone = models.CharField(max_length=30)
    customer_email = models.EmailField(blank=True, default='')
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_TYPE_CHOICES, default=DELIVERY_COLLECTION)
    address = models.TextField(blank=True, default='')
    delivery_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    delivery_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)
    route_distance_km = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    route_duration_min = models.DecimalField(max_digits=7, decimal_places=2, blank=True, null=True)
    route_provider = models.CharField(max_length=80, blank=True, default='')
    note = models.TextField(blank=True, default='')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    payment_method = models.CharField(max_length=30, choices=PAYMENT_METHOD_CHOICES, default=PAYMENT_CASH)
    payment_status = models.CharField(max_length=30, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_PENDING)
    subtotal = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal('0.00'))
    delivery_fee = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal('0.00'))
    discount = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.order_code:
            next_num = Order.objects.count() + 1
            self.order_code = f'CDKT-{next_num:06d}'
        self.total = (self.subtotal or Decimal('0.00')) + (self.delivery_fee or Decimal('0.00')) - (self.discount or Decimal('0.00'))
        super().save(*args, **kwargs)

    def __str__(self):
        return self.order_code


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.SET_NULL, blank=True, null=True)
    name_snapshot = models.CharField(max_length=180)
    price_snapshot = models.DecimalField(max_digits=8, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    options_snapshot = models.JSONField(default=list, blank=True)
    total = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal('0.00'))

    def save(self, *args, **kwargs):
        self.total = Decimal(self.quantity) * self.price_snapshot
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.quantity} x {self.name_snapshot}'


class Payment(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    method = models.CharField(max_length=30)
    provider = models.CharField(max_length=60, blank=True, default='')
    amount = models.DecimalField(max_digits=9, decimal_places=2)
    status = models.CharField(max_length=30, default=Order.PAYMENT_PENDING)
    transaction_id = models.CharField(max_length=160, blank=True, default='')
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.order.order_code} - {self.amount} - {self.status}'


class SmsGatewayMessage(models.Model):
    KIND_OTP = 'otp'
    KIND_ORDER = 'order'
    KIND_CHOICES = [
        (KIND_OTP, 'OTP'),
        (KIND_ORDER, 'Order'),
    ]
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_SENT = 'sent'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_SENT, 'Sent'),
        (STATUS_FAILED, 'Failed'),
    ]

    phone = models.CharField(max_length=30)
    message = models.TextField()
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_OTP)
    gateway_phone = models.CharField(max_length=30, default='617664661')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    device_id = models.CharField(max_length=160, blank=True, default='')
    error = models.TextField(blank=True, default='')
    attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.id} - {self.phone} - {self.status}'
