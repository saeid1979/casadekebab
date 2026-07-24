from decimal import Decimal

import random

import string

from django.db import models

from cloudinary_storage.storage import RawMediaCloudinaryStorage

from django.utils import timezone

from django.core.validators import MinValueValidator

from django.contrib.auth.hashers import make_password, check_password





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

    username = models.CharField(max_length=80, unique=True, blank=True, null=True)

    password_hash = models.CharField(max_length=255, blank=True, default='')

    is_active = models.BooleanField(default=True)

    current_latitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)

    current_longitude = models.DecimalField(max_digits=10, decimal_places=7, blank=True, null=True)

    last_location_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)



    class Meta:

        ordering = ['name']



    def set_password(self, raw_password):

        self.password_hash = make_password(raw_password)



    def check_password(self, raw_password):

        if not self.password_hash:

            return False

        return check_password(raw_password, self.password_hash)



    def __str__(self):

        return f'{self.name} - {self.phone}'






class RiderPushDevice(models.Model):
    PLATFORM_ANDROID = 'android'
    PLATFORM_IOS = 'ios'
    PLATFORM_CHOICES = [
        (PLATFORM_ANDROID, 'Android'),
        (PLATFORM_IOS, 'iOS'),
    ]

    rider = models.ForeignKey(
        Rider,
        on_delete=models.CASCADE,
        related_name='push_devices',
    )
    device_token = models.TextField(unique=True)
    platform = models.CharField(
        max_length=20,
        choices=PLATFORM_CHOICES,
        default=PLATFORM_ANDROID,
    )
    app_version = models.CharField(max_length=40, blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_seen_at', '-created_at']
        indexes = [
            models.Index(fields=['rider', 'is_active']),
        ]

    def __str__(self):
        state = 'active' if self.is_active else 'inactive'
        return f'{self.rider_id} - {self.platform} - {state}'

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

    address = models.CharField(max_length=250, default='Calle GarcÃ­a Lorca, 1, Salamanca 37004')

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

            return False, 'CupÃ³n desactivado.'

        if self.valid_from and now < self.valid_from:

            return False, 'CupÃ³n todavÃ­a no disponible.'

        if self.valid_until and now > self.valid_until:

            return False, 'CupÃ³n caducado.'

        if self.max_uses and self.used_count >= self.max_uses:

            return False, 'CupÃ³n agotado.'

        if subtotal < self.minimum_order:

            return False, f'Pedido mÃ­nimo {self.minimum_order} â‚¬.'

        if self.first_order_only and customer and customer.total_orders > 0:

            return False, 'SÃ³lo vÃ¡lido para el primer pedido.'

        return True, 'CupÃ³n vÃ¡lido.'



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





class OrderChatMessage(models.Model):

    SENDER_CUSTOMER = 'customer'

    SENDER_RIDER = 'rider'

    SENDER_ADMIN = 'admin'

    SENDER_CHOICES = [

        (SENDER_CUSTOMER, 'Cliente'),

        (SENDER_RIDER, 'Repartidor'),

        (SENDER_ADMIN, 'Admin'),

    ]



    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='chat_messages')

    sender_type = models.CharField(max_length=20, choices=SENDER_CHOICES)

    sender_name = models.CharField(max_length=160, blank=True, default='')

    message = models.TextField(max_length=1200)

    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)



    class Meta:

        ordering = ['created_at', 'id']



    def __str__(self):

        return f'{self.order.order_code} - {self.sender_type} - {self.created_at:%Y-%m-%d %H:%M}'





class OrderReview(models.Model):

    STATUS_PENDING = 'pending'

    STATUS_APPROVED = 'approved'

    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [

        (STATUS_PENDING, 'Pendiente'),

        (STATUS_APPROVED, 'Aprobada'),

        (STATUS_REJECTED, 'Rechazada'),

    ]



    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='review')

    customer_name = models.CharField(max_length=160, blank=True, default='')

    customer_phone = models.CharField(max_length=30)

    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])

    comment = models.TextField(max_length=1200)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    admin_note = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    approved_at = models.DateTimeField(blank=True, null=True)



    class Meta:

        ordering = ['-created_at']



    def save(self, *args, **kwargs):

        self.rating = min(5, max(1, int(self.rating or 1)))

        if self.status == self.STATUS_APPROVED and not self.approved_at:

            self.approved_at = timezone.now()

        if self.status != self.STATUS_APPROVED:

            self.approved_at = None

        super().save(*args, **kwargs)



    def __str__(self):

        return f'{self.order.order_code} - {self.rating}/5 - {self.status}'





class CustomerPushDevice(models.Model):

    PLATFORM_ANDROID = 'android'

    PLATFORM_IOS = 'ios'

    PLATFORM_WEB = 'web'

    PLATFORM_CHOICES = [

        (PLATFORM_ANDROID, 'Android'),

        (PLATFORM_IOS, 'iOS'),

        (PLATFORM_WEB, 'Web'),

    ]



    customer = models.ForeignKey(

        Customer,

        on_delete=models.CASCADE,

        related_name='push_devices',

        blank=True,

        null=True,

    )

    phone = models.CharField(max_length=30, db_index=True)

    device_token = models.TextField(unique=True)

    platform = models.CharField(

        max_length=20,

        choices=PLATFORM_CHOICES,

        default=PLATFORM_ANDROID,

    )

    app_version = models.CharField(max_length=40, blank=True, default='')

    is_active = models.BooleanField(default=True, db_index=True)

    last_seen_at = models.DateTimeField(default=timezone.now)

    last_error = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        ordering = ['-last_seen_at', '-created_at']

        indexes = [

            models.Index(fields=['phone', 'is_active']),

        ]



    def __str__(self):

        return f'{self.phone} - {self.platform} - {"active" if self.is_active else "inactive"}'





class ExpenseCategory(models.Model):

    name = models.CharField(max_length=120, unique=True)

    is_active = models.BooleanField(default=True)

    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)



    class Meta:

        ordering = ['sort_order', 'name']

        verbose_name_plural = 'Expense categories'



    def __str__(self):

        return self.name





class AccountingSettings(models.Model):

    saeid_share_percent = models.DecimalField(

        max_digits=5,

        decimal_places=2,

        default=Decimal('50.00'),

        validators=[MinValueValidator(Decimal('0.00'))],

    )

    ahmed_share_percent = models.DecimalField(

        max_digits=5,

        decimal_places=2,

        default=Decimal('50.00'),

        validators=[MinValueValidator(Decimal('0.00'))],

    )

    bbva_initial_balance = models.DecimalField(

        max_digits=12,

        decimal_places=2,

        default=Decimal('0.00'),

    )

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        verbose_name = 'Accounting settings'

        verbose_name_plural = 'Accounting settings'



    def __str__(self):

        return 'Casa de Kebab accounting settings'



    @classmethod

    def current(cls):

        obj, _ = cls.objects.get_or_create(id=1)

        return obj





class RestaurantFinancialEntry(models.Model):

    TYPE_EXPENSE = 'expense'

    TYPE_CONTRIBUTION = 'contribution'

    TYPE_SETTLEMENT = 'settlement'

    TYPE_CHOICES = [

        (TYPE_EXPENSE, 'Gasto'),

        (TYPE_CONTRIBUTION, 'AportaciÃ³n a BBVA'),

        (TYPE_SETTLEMENT, 'LiquidaciÃ³n entre socios'),

    ]



    PARTY_SAEID = 'saeid'

    PARTY_AHMED = 'ahmed'

    PARTY_BBVA = 'bbva'

    PARTY_CHOICES = [

        (PARTY_SAEID, 'Saeid'),

        (PARTY_AHMED, 'Ahmed'),

        (PARTY_BBVA, 'Cuenta conjunta BBVA'),

    ]



    PAYMENT_CASH = 'cash'

    PAYMENT_PERSONAL_CARD = 'personal_card'

    PAYMENT_TRANSFER = 'transfer'

    PAYMENT_BBVA = 'bbva'

    PAYMENT_BIZUM = 'bizum'

    PAYMENT_OTHER = 'other'

    PAYMENT_CHOICES = [

        (PAYMENT_CASH, 'Efectivo'),

        (PAYMENT_PERSONAL_CARD, 'Tarjeta personal'),

        (PAYMENT_TRANSFER, 'Transferencia'),

        (PAYMENT_BBVA, 'Cuenta BBVA conjunta'),

        (PAYMENT_BIZUM, 'Bizum'),

        (PAYMENT_OTHER, 'Otro'),

    ]



    STATUS_PENDING = 'pending'

    STATUS_APPROVED = 'approved'

    STATUS_REJECTED = 'rejected'

    STATUS_REIMBURSED = 'reimbursed'

    STATUS_CHOICES = [

        (STATUS_PENDING, 'Pendiente'),

        (STATUS_APPROVED, 'Aprobado'),

        (STATUS_REJECTED, 'Rechazado'),

        (STATUS_REIMBURSED, 'Reembolsado'),

    ]



    entry_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_EXPENSE, db_index=True)

    title = models.CharField(max_length=180)

    description = models.TextField(blank=True, default='')

    amount = models.DecimalField(

        max_digits=12,

        decimal_places=2,

        validators=[MinValueValidator(Decimal('0.01'))],

    )

    entry_date = models.DateField(default=timezone.localdate, db_index=True)

    category = models.ForeignKey(

        ExpenseCategory,

        on_delete=models.SET_NULL,

        null=True,

        blank=True,

        related_name='entries',

    )

    paid_by = models.CharField(max_length=20, choices=PARTY_CHOICES, default=PARTY_SAEID, db_index=True)

    contribution_from = models.CharField(max_length=20, choices=PARTY_CHOICES, blank=True, default='')

    settlement_to = models.CharField(max_length=20, choices=PARTY_CHOICES, blank=True, default='')

    payment_method = models.CharField(max_length=30, choices=PAYMENT_CHOICES, default=PAYMENT_CASH)

    invoice_number = models.CharField(max_length=100, blank=True, default='')

    bank_reference = models.CharField(max_length=160, blank=True, default='')

    receipt = models.FileField(

        upload_to='accounting_receipts/%Y/%m/',

        storage=RawMediaCloudinaryStorage(),

        blank=True,

        null=True,

    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_APPROVED, db_index=True)

    created_by_username = models.CharField(max_length=150, blank=True, default='')

    updated_by_username = models.CharField(max_length=150, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)



    class Meta:

        ordering = ['-entry_date', '-created_at']

        indexes = [

            models.Index(fields=['entry_type', 'entry_date']),

            models.Index(fields=['paid_by', 'entry_date']),

        ]



    def __str__(self):

        return f'{self.entry_date} - {self.title} - {self.amount}'



class SystemBackup(models.Model):

    TYPE_DATABASE = 'database'

    TYPE_CONFIGURATION = 'configuration'

    TYPE_MEDIA = 'media'

    TYPE_CHOICES = [

        (TYPE_DATABASE, 'Base de datos JSON'),

        (TYPE_CONFIGURATION, 'ConfiguraciÃ³n'),

        (TYPE_MEDIA, 'Archivos Media'),

    ]



    STATUS_PENDING = 'pending'

    STATUS_RUNNING = 'running'

    STATUS_COMPLETED = 'completed'

    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [

        (STATUS_PENDING, 'Pendiente'),

        (STATUS_RUNNING, 'En proceso'),

        (STATUS_COMPLETED, 'Completado'),

        (STATUS_FAILED, 'Fallido'),

    ]



    backup_type = models.CharField(max_length=30, choices=TYPE_CHOICES, db_index=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)

    file_name = models.CharField(max_length=255, blank=True, default='')

    file_path = models.CharField(max_length=600, blank=True, default='')

    file_size = models.BigIntegerField(default=0)

    checksum_sha256 = models.CharField(max_length=64, blank=True, default='')

    created_by_username = models.CharField(max_length=150, blank=True, default='')

    error_message = models.TextField(blank=True, default='')

    is_protected = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    completed_at = models.DateTimeField(blank=True, null=True)



    class Meta:

        ordering = ['-created_at']



    def __str__(self):

        return f'{self.get_backup_type_display()} - {self.created_at:%Y-%m-%d %H:%M}'

# v18 real product profitability (no Category changes)
class Ingredient(models.Model):
    UNIT_GRAM = 'g'
    UNIT_ML = 'ml'
    UNIT_UNIT = 'unit'
    UNIT_CHOICES = [
        (UNIT_GRAM, 'Gramos'),
        (UNIT_ML, 'Mililitros'),
        (UNIT_UNIT, 'Unidades'),
    ]

    name = models.CharField(max_length=140, unique=True)
    unit = models.CharField(max_length=12, choices=UNIT_CHOICES, default=UNIT_GRAM)
    unit_cost = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=Decimal('0.0000'),
        validators=[MinValueValidator(Decimal('0.0000'))],
        help_text='Coste por la unidad elegida: g, ml o unidad.'
    )
    stock_quantity = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    reorder_level = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    supplier_name = models.CharField(max_length=160, blank=True, default='')
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.unit})'


class ProductCostProfile(models.Model):
    menu_item = models.OneToOneField(MenuItem, on_delete=models.CASCADE, related_name='cost_profile')
    packaging_cost = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'))
    fixed_cost = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text='Coste fijo adicional por unidad: servilletas, energía u otros.'
    )
    target_margin_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('55.00'))
    notes = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['menu_item__name_es']

    def __str__(self):
        return f'Coste: {self.menu_item.name_es}'


class RecipeIngredient(models.Model):
    profile = models.ForeignKey(ProductCostProfile, on_delete=models.CASCADE, related_name='components')
    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name='recipe_components')
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))],
        help_text='Cantidad usada por una unidad del producto, en la misma unidad del ingrediente.'
    )

    class Meta:
        ordering = ['ingredient__name']
        constraints = [
            models.UniqueConstraint(fields=['profile', 'ingredient'], name='unique_recipe_ingredient_per_profile')
        ]

    @property
    def line_cost(self):
        return (self.quantity or Decimal('0.000')) * (self.ingredient.unit_cost or Decimal('0.0000'))

    def __str__(self):
        return f'{self.profile.menu_item.name_es} - {self.ingredient.name}'

# v21 Smart Finance & Inventory Phase 1
class RecurringExpenseRule(models.Model):
    FREQUENCY_DAILY = 'daily'
    FREQUENCY_WEEKLY = 'weekly'
    FREQUENCY_MONTHLY = 'monthly'
    FREQUENCY_CHOICES = [
        (FREQUENCY_DAILY, 'Diario'),
        (FREQUENCY_WEEKLY, 'Semanal'),
        (FREQUENCY_MONTHLY, 'Mensual'),
    ]

    title = models.CharField(max_length=180)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    frequency = models.CharField(max_length=12, choices=FREQUENCY_CHOICES, default=FREQUENCY_MONTHLY)
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='recurring_rules',
    )
    paid_by = models.CharField(
        max_length=20,
        choices=RestaurantFinancialEntry.PARTY_CHOICES,
        default=RestaurantFinancialEntry.PARTY_BBVA,
    )
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(blank=True, null=True)
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True, default='')
    created_by_username = models.CharField(max_length=150, blank=True, default='')
    updated_by_username = models.CharField(max_length=150, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['title', 'id']
        indexes = [
            models.Index(fields=['is_active', 'start_date']),
        ]

    def __str__(self):
        return f'{self.title} ({self.frequency})'

# v22 Real Inventory, purchases, waste and automatic consumption
class InventoryMovement(models.Model):
    TYPE_PURCHASE = 'purchase'
    TYPE_SALE = 'sale'
    TYPE_WASTE = 'waste'
    TYPE_ADJUSTMENT = 'adjustment'
    TYPE_CHOICES = [
        (TYPE_PURCHASE, 'Compra'),
        (TYPE_SALE, 'Consumo por venta'),
        (TYPE_WASTE, 'Merma / desperdicio'),
        (TYPE_ADJUSTMENT, 'Ajuste manual'),
    ]

    ingredient = models.ForeignKey(Ingredient, on_delete=models.PROTECT, related_name='inventory_movements')
    movement_type = models.CharField(max_length=16, choices=TYPE_CHOICES, db_index=True)
    quantity_delta = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost_snapshot = models.DecimalField(max_digits=12, decimal_places=4, default=Decimal('0.0000'))
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    # Purchase tax details. total_cost is the net/base cost; total_amount_with_iva is the paid amount.
    iva_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    iva_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount_with_iva = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    order_item = models.ForeignKey('OrderItem', on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_movements')
    financial_entry = models.ForeignKey(RestaurantFinancialEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='inventory_movements')
    supplier_name = models.CharField(max_length=160, blank=True, default='')
    invoice_number = models.CharField(max_length=100, blank=True, default='')
    reference = models.CharField(max_length=180, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    occurred_at = models.DateTimeField(default=timezone.now, db_index=True)
    created_by_username = models.CharField(max_length=150, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at', '-id']
        indexes = [
            models.Index(fields=['ingredient', 'occurred_at']),
            models.Index(fields=['movement_type', 'occurred_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['order_item', 'ingredient', 'movement_type'],
                name='unique_inventory_sale_per_order_item_ingredient_type',
            )
        ]

    def __str__(self):
        return f'{self.ingredient.name} {self.movement_type} {self.quantity_delta}'

# v23 Profit Intelligence goals
class BusinessTarget(models.Model):
    monthly_revenue_target = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    monthly_profit_target = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    updated_by_username = models.CharField(max_length=150, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Business target'
        verbose_name_plural = 'Business targets'

    @classmethod
    def current(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj

