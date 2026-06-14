from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    MenuViewSet,
    send_phone_code,
    verify_phone_code,
    customer_by_phone,
    create_order,
    order_detail,
    live_orders,
    update_order_status,
    test_telegram,
    riders_list,
    rider_detail,
    assign_rider,
    auto_assign_rider,
    rider_orders,
    rider_location,
    rider_login,
    secure_rider_orders,
    secure_rider_location,
    secure_rider_update_order_status,
    rider_update_order_status,
    customer_orders,
    dashboard_summary,
    admin_customers,
    update_payment_status,
    admin_categories,
    admin_category_detail,
    admin_menu_items,
    admin_menu_item_detail,
    admin_menu_item_image,
    public_settings,
    admin_restaurant_settings,
    validate_coupon,
    admin_coupons,
    admin_coupon_detail,
    create_online_payment,
    confirm_online_payment,
    online_payment_status,
    google_places_autocomplete,
    google_place_details,
    public_order_tracking,
    admin_tracking_orders,
    admin_login,
    admin_me,
    sms_gateway_pending,
    sms_gateway_mark,
    order_tracking_location,
    order_chat,
    create_order_review,
    public_reviews,
)

router = DefaultRouter()
router.register(r'menu', MenuViewSet, basename='menu')

urlpatterns = [
    path('', include(router.urls)),

    # Auth / customer
    path('auth/send-code/', send_phone_code, name='send-phone-code'),
    path('auth/verify-code/', verify_phone_code, name='verify-phone-code'),
    path('auth/admin/login/', admin_login, name='admin-login'),
    path('auth/admin/me/', admin_me, name='admin-me'),
    path('customers/by-phone/', customer_by_phone, name='customer-by-phone'),
    path('customers/orders/', customer_orders, name='customer-orders'),
    path('settings/public/', public_settings, name='public-settings'),
    path('coupons/validate/', validate_coupon, name='validate-coupon'),
    path('places/autocomplete/', google_places_autocomplete, name='google-places-autocomplete'),
    path('places/details/', google_place_details, name='google-place-details'),
    path('orders/track/', public_order_tracking, name='public-order-tracking'),
    path('orders/<str:order_code>/location/', order_tracking_location, name='order-tracking-location'),
    path('orders/<str:order_code>/chat/', order_chat, name='order-chat'),
    path('reviews/', create_order_review, name='create-order-review'),
    path('reviews/public/', public_reviews, name='public-reviews'),

    path('sms-gateway/pending/', sms_gateway_pending, name='sms-gateway-pending'),
    path('sms-gateway/mark/', sms_gateway_mark, name='sms-gateway-mark'),

    # Orders
    path('orders/', create_order, name='create-order'),
    path('orders/live/', live_orders, name='live-orders'),
    path('orders/<str:order_code>/status/', update_order_status, name='update-order-status'),
    path('orders/<str:order_code>/payment/', update_payment_status, name='update-payment-status'),
    path('orders/<str:order_code>/assign-rider/', assign_rider, name='assign-rider'),
    path('orders/<str:order_code>/auto-assign-rider/', auto_assign_rider, name='auto-assign-rider'),
    path('orders/<str:order_code>/', order_detail, name='order-detail'),


    # Demo online payment. This is test mode, not real money.
    path('payments/demo/<str:order_code>/create/', create_online_payment, name='create-online-payment'),
    path('payments/demo/<str:order_code>/confirm/', confirm_online_payment, name='confirm-online-payment'),
    path('payments/demo/<str:order_code>/status/', online_payment_status, name='online-payment-status'),

    # Telegram
    path('telegram/test/', test_telegram, name='test-telegram'),

    # Riders. Keep /rider/* because the current React frontend calls these paths.
    path('riders/', riders_list, name='riders-list'),
    path('riders/<int:rider_id>/', rider_detail, name='rider-detail'),
    path('rider/orders/', rider_orders, name='rider-orders'),
    path('rider/location/', rider_location, name='rider-location'),
    path('auth/rider/login/', rider_login, name='rider-login'),
    path('rider/secure/orders/', secure_rider_orders, name='secure-rider-orders'),
    path('rider/secure/location/', secure_rider_location, name='secure-rider-location'),
    path('rider/secure/orders/<str:order_code>/status/', secure_rider_update_order_status, name='secure-rider-update-order-status'),
    path('rider/orders/<str:order_code>/status/', rider_update_order_status, name='rider-update-order-status'),


    # Menu management
    path('admin/categories/', admin_categories, name='admin-categories'),
    path('admin/categories/<int:category_id>/', admin_category_detail, name='admin-category-detail'),
    path('admin/menu-items/', admin_menu_items, name='admin-menu-items'),
    path('admin/menu-items/<int:item_id>/', admin_menu_item_detail, name='admin-menu-item-detail'),
    path('admin/menu-items/<int:item_id>/image/', admin_menu_item_image, name='admin-menu-item-image'),
    path('admin/settings/', admin_restaurant_settings, name='admin-restaurant-settings'),
    path('admin/coupons/', admin_coupons, name='admin-coupons'),
    path('admin/coupons/<int:coupon_id>/', admin_coupon_detail, name='admin-coupon-detail'),

    # Dashboard
    path('dashboard/summary/', dashboard_summary, name='dashboard-summary'),
    path('admin/customers/', admin_customers, name='admin-customers'),
    path('admin/tracking-orders/', admin_tracking_orders, name='admin-tracking-orders'),
]
