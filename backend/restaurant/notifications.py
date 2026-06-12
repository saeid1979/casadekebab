import requests
from django.conf import settings


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
