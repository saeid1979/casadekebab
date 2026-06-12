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

def send_customer_order_sms(order) -> bool:
    # Send generated order code to delivery customers.
    if getattr(order, "delivery_type", "") != "delivery":
        return False

    phone = str(getattr(order, "customer_phone", "") or "").strip()
    if not phone:
        return False

    order_code = str(getattr(order, "order_code", "") or "").strip()
    message = (
        f"Casa de Kebab Turco: pedido {order_code} confirmado. "
        f"Total: {getattr(order, 'total', 0)} EUR. "
        "Seguimiento: https://casadekebab.com/track"
    )

    sms_mode = str(getattr(settings, "SMS_MODE", "console") or "console").lower()

    if sms_mode == "console":
        print("======================================")
        print("Casa de Kebab Turco - order SMS")
        print(f"Phone: {phone}")
        print(f"Message: {message}")
        print("======================================")
        return True

    gateway_url = str(getattr(settings, "SMS_GATEWAY_URL", "") or "").strip()
    gateway_token = str(getattr(settings, "SMS_GATEWAY_TOKEN", "") or "").strip()

    if not gateway_url:
        print("Order SMS skipped: SMS_GATEWAY_URL is not configured.")
        return False

    headers = {"Content-Type": "application/json"}
    if gateway_token:
        headers["Authorization"] = f"Bearer {gateway_token}"

    try:
        response = requests.post(
            gateway_url,
            json={
                "phone": phone,
                "message": message,
                "order_code": order_code,
            },
            headers=headers,
            timeout=12,
        )
        if not response.ok:
            print(
                f"Order SMS gateway failed: "
                f"{response.status_code} {response.text[:300]}"
            )
        return response.ok
    except Exception as exc:
        print(f"Order SMS failed: {exc}")
        return False
