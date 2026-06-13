import requests
from django.conf import settings
from .models import SmsGatewayMessage


def send_telegram_message(text: str) -> bool:
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    chat_id = getattr(settings, 'TELEGRAM_CHAT_ID', '')
    enabled = getattr(settings, 'TELEGRAM_ENABLED', False)
    if not enabled or not token or not chat_id:
        return False
    try:
        url = f'https://api.telegram.org/bot{token}/sendMessage'
        response = requests.post(url, json={
            'chat_id': chat_id,
            'text': text,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True,
        }, timeout=8)
        return response.ok
    except Exception as exc:
        print(f'Telegram alert failed: {exc}')
        return False


def build_order_message(order) -> str:
    lines = [
        '🆕 <b>Nuevo pedido - Casa de Kebab Turco</b>',
        f'Pedido: <b>{order.order_code}</b>',
        f'Cliente: {order.customer_name or "Sin nombre"}',
        f'Teléfono: {order.customer_phone}',
        f'Tipo: {order.get_delivery_type_display()}',
        f'Pago: {order.get_payment_method_display()}',
        f'Estado pago: {order.get_payment_status_display()}',
        f'Total: <b>{order.total} €</b>',
    ]
    if order.address:
        lines.append(f'Dirección: {order.address}')
    if order.note:
        lines.append(f'Nota: {order.note}')
    lines.append('')
    lines.append('<b>Artículos:</b>')
    for item in order.items.all():
        option_names = []
        for opt in item.options_snapshot or []:
            option_names.append(opt.get('name_es', ''))
        options_text = f" ({', '.join([x for x in option_names if x])})" if option_names else ''
        lines.append(f'- {item.quantity} x {item.name_snapshot}{options_text} = {item.total} €')
    return '\n'.join(lines)

def queue_sms(phone: str, message: str, kind: str = SmsGatewayMessage.KIND_OTP) -> bool:
    phone = str(phone or '').strip()
    message = str(message or '').strip()
    if not phone or not message:
        return False
    SmsGatewayMessage.objects.create(
        phone=phone,
        message=message,
        kind=kind,
        gateway_phone=str(getattr(settings, 'SMS_GATEWAY_PHONE', '617664661') or '617664661'),
        status=SmsGatewayMessage.STATUS_PENDING,
    )
    return True


def send_customer_order_sms(order) -> bool:
    if getattr(order, 'delivery_type', '') != 'delivery':
        return False
    phone = str(getattr(order, 'customer_phone', '') or '').strip()
    if not phone:
        return False
    order_code = str(getattr(order, 'order_code', '') or '').strip()
    message = (
        f'Casa de Kebab Turco: pedido {order_code} confirmado. '
        f'Total: {getattr(order, "total", 0)} EUR. '
        'Seguimiento: https://casadekebab.com/track'
    )
    if str(getattr(settings, 'SMS_MODE', 'console')).lower() == 'console':
        print(f'[SMS console] {phone}: {message}')
        return True
    return queue_sms(phone, message, kind=SmsGatewayMessage.KIND_ORDER)
