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

    secure_rider_push_register,

    secure_rider_push_unregister,

    secure_rider_push_test,

    secure_rider_location,

    secure_rider_update_order_status,

    rider_update_order_status,

    customer_orders,

    dashboard_summary,
    admin_dynamic_reports,

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

    register_push_device,

    unregister_push_device,

    test_customer_push,

    admin_accounting_summary,

    admin_accounting_settings,

    admin_expense_categories,

    admin_financial_entries,

    admin_financial_entry_detail,

    admin_system_health,

    admin_system_backups,

    admin_system_backup_detail,

    admin_system_backup_download,

    admin_system_backup_verify,
    admin_profitability_ingredients,
    admin_profitability_ingredient_detail,
    admin_profitability_recipe,
    admin_profitability_report,
    public_customer_menu_highlights,
    admin_smart_finance_overview,
    admin_smart_finance_recurring_costs,
    admin_smart_finance_recurring_cost_detail,
    admin_inventory_real_overview,
    admin_inventory_purchase,
    admin_inventory_waste,
    admin_inventory_adjustment,
    admin_profit_intelligence_overview,
    admin_profit_intelligence_targets,

)



router = DefaultRouter()

router.register(r'menu', MenuViewSet, basename='menu')



urlpatterns = [
    path('menu/customer-highlights/', public_customer_menu_highlights, name='public-customer-menu-highlights'),

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

    path('push/register/', register_push_device, name='push-register'),

    path('push/unregister/', unregister_push_device, name='push-unregister'),

    path('push/test/', test_customer_push, name='push-test'),



    # Admin smart finance & inventory - phase 1
    path('admin/smart-finance/overview/', admin_smart_finance_overview, name='admin-smart-finance-overview'),
    path('admin/smart-finance/recurring-costs/', admin_smart_finance_recurring_costs, name='admin-smart-finance-recurring-costs'),
    path('admin/smart-finance/recurring-costs/<int:rule_id>/', admin_smart_finance_recurring_cost_detail, name='admin-smart-finance-recurring-cost-detail'),

    # Admin real inventory - phase 2
    path('admin/inventory/overview/', admin_inventory_real_overview, name='admin-inventory-real-overview'),
    path('admin/inventory/purchase/', admin_inventory_purchase, name='admin-inventory-purchase'),
    path('admin/inventory/waste/', admin_inventory_waste, name='admin-inventory-waste'),
    path('admin/inventory/adjustment/', admin_inventory_adjustment, name='admin-inventory-adjustment'),

    # Admin profit intelligence - phase 3
    path('admin/profit-intelligence/overview/', admin_profit_intelligence_overview, name='admin-profit-intelligence-overview'),
    path('admin/profit-intelligence/targets/', admin_profit_intelligence_targets, name='admin-profit-intelligence-targets'),

    # Admin partner accounting

    path('admin/accounting/summary/', admin_accounting_summary, name='admin-accounting-summary'),

    path('admin/accounting/settings/', admin_accounting_settings, name='admin-accounting-settings'),

    path('admin/accounting/categories/', admin_expense_categories, name='admin-expense-categories'),

    path('admin/accounting/entries/', admin_financial_entries, name='admin-financial-entries'),

    path('admin/accounting/entries/<int:entry_id>/', admin_financial_entry_detail, name='admin-financial-entry-detail'),



    # Admin system backup and health

    path('admin/system/health/', admin_system_health, name='admin-system-health'),

    path('admin/system/backups/', admin_system_backups, name='admin-system-backups'),

    path('admin/system/backups/<int:backup_id>/', admin_system_backup_detail, name='admin-system-backup-detail'),

    path('admin/system/backups/<int:backup_id>/download/', admin_system_backup_download, name='admin-system-backup-download'),

    path('admin/system/backups/<int:backup_id>/verify/', admin_system_backup_verify, name='admin-system-backup-verify'),



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

    path('rider/secure/push/register/', secure_rider_push_register, name='secure-rider-push-register'),

    path('rider/secure/push/unregister/', secure_rider_push_unregister, name='secure-rider-push-unregister'),

    path('rider/secure/push/test/', secure_rider_push_test, name='secure-rider-push-test'),

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
    path('admin/reports/dynamic/', admin_dynamic_reports, name='admin-dynamic-reports'),

    path('admin/customers/', admin_customers, name='admin-customers'),

    path('admin/tracking-orders/', admin_tracking_orders, name='admin-tracking-orders'),
    path('admin/profitability/ingredients/', admin_profitability_ingredients, name='admin-profitability-ingredients'),
    path('admin/profitability/ingredients/<int:ingredient_id>/', admin_profitability_ingredient_detail, name='admin-profitability-ingredient-detail'),
    path('admin/profitability/recipes/<int:menu_item_id>/', admin_profitability_recipe, name='admin-profitability-recipe'),
    path('admin/profitability/report/', admin_profitability_report, name='admin-profitability-report'),

]

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
