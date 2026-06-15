import os
from typing import Iterable

from django.conf import settings
from django.utils import timezone

from .models import CustomerPushDevice


STATUS_MESSAGES = {
    'pending': (
        'Pedido recibido',
        'Hemos recibido tu pedido {order_code}.',
    ),
    'accepted': (
        'Pedido aceptado',
        'El restaurante ha aceptado tu pedido {order_code}.',
    ),
    'preparing': (
        'Preparando tu pedido',
        'Tu pedido {order_code} se está preparando.',
    ),
    'ready': (
        'Pedido listo',
        'Tu pedido {order_code} está listo.',
    ),
    'out_for_delivery': (
        'El repartidor está en camino',
        'Tu pedido {order_code} ya está en reparto.',
    ),
    'delivered': (
        'Pedido entregado',
        'Tu pedido {order_code} ha sido entregado. ¡Buen provecho!',
    ),
    'cancelled': (
        'Pedido cancelado',
        'Tu pedido {order_code} ha sido cancelado.',
    ),
}

PAYMENT_MESSAGES = {
    'paid': (
        'Pago confirmado',
        'El pago del pedido {order_code} se confirmó correctamente.',
    ),
    'failed': (
        'Pago no completado',
        'No se pudo confirmar el pago del pedido {order_code}.',
    ),
    'refunded': (
        'Pago reembolsado',
        'El pago del pedido {order_code} ha sido reembolsado.',
    ),
}


def _enabled():
    value = str(getattr(settings, 'FIREBASE_ENABLED', os.getenv('FIREBASE_ENABLED', 'False')))
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _initialize_firebase():
    if not _enabled():
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        return None

    if firebase_admin._apps:
        return firebase_admin.get_app()

    project_id = getattr(settings, 'FIREBASE_PROJECT_ID', os.getenv('FIREBASE_PROJECT_ID', '')).strip()
    client_email = getattr(settings, 'FIREBASE_CLIENT_EMAIL', os.getenv('FIREBASE_CLIENT_EMAIL', '')).strip()
    private_key = getattr(settings, 'FIREBASE_PRIVATE_KEY', os.getenv('FIREBASE_PRIVATE_KEY', ''))
    private_key = private_key.replace('\\n', '\n').strip()

    if not project_id or not client_email or not private_key:
        return None

    certificate = {
        'type': 'service_account',
        'project_id': project_id,
        'private_key_id': getattr(settings, 'FIREBASE_PRIVATE_KEY_ID', os.getenv('FIREBASE_PRIVATE_KEY_ID', '')),
        'private_key': private_key,
        'client_email': client_email,
        'client_id': getattr(settings, 'FIREBASE_CLIENT_ID', os.getenv('FIREBASE_CLIENT_ID', '')),
        'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
        'token_uri': 'https://oauth2.googleapis.com/token',
        'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
        'client_x509_cert_url': getattr(
            settings,
            'FIREBASE_CLIENT_CERT_URL',
            os.getenv('FIREBASE_CLIENT_CERT_URL', ''),
        ),
        'universe_domain': 'googleapis.com',
    }

    return firebase_admin.initialize_app(credentials.Certificate(certificate))


def _tokens_for_phone(phone: str) -> list[str]:
    clean = ''.join(ch for ch in str(phone or '') if ch.isdigit())
    if not clean:
        return []

    devices = CustomerPushDevice.objects.filter(is_active=True)
    tokens = []
    for device in devices:
        saved = ''.join(ch for ch in str(device.phone or '') if ch.isdigit())
        if saved and saved.endswith(clean[-9:]):
            tokens.append(device.device_token)
    return list(dict.fromkeys(tokens))


def _deactivate_invalid_tokens(tokens: Iterable[str], error_message='Invalid Firebase token'):
    CustomerPushDevice.objects.filter(device_token__in=list(tokens)).update(
        is_active=False,
        last_error=error_message[:1000],
        updated_at=timezone.now(),
    )


def send_push_to_phone(phone, title, body, data=None):
    app = _initialize_firebase()
    if app is None:
        return {'enabled': False, 'sent': 0, 'failed': 0}

    tokens = _tokens_for_phone(phone)
    if not tokens:
        return {'enabled': True, 'sent': 0, 'failed': 0}

    from firebase_admin import messaging

    payload = {str(key): str(value) for key, value in (data or {}).items() if value is not None}
    sent = 0
    failed = 0
    invalid_tokens = []

    for token in tokens:
        try:
            message = messaging.Message(
                token=token,
                notification=messaging.Notification(title=title, body=body),
                data=payload,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        channel_id='orders',
                        sound='default',
                        click_action='FCM_PLUGIN_ACTIVITY',
                    ),
                ),
            )
            messaging.send(message, app=app)
            sent += 1
            CustomerPushDevice.objects.filter(device_token=token).update(
                last_seen_at=timezone.now(),
                last_error='',
            )
        except Exception as exc:
            failed += 1
            text=str(exc)
            if any(term in text.lower() for term in ['registration-token-not-registered', 'invalid argument', 'not found']):
                invalid_tokens.append(token)
            CustomerPushDevice.objects.filter(device_token=token).update(
                last_error=text[:1000],
            )

    if invalid_tokens:
        _deactivate_invalid_tokens(invalid_tokens)

    return {'enabled': True, 'sent': sent, 'failed': failed}


def send_order_status_push(order):
    title_template, body_template = STATUS_MESSAGES.get(
        order.status,
        ('Pedido actualizado', 'El estado del pedido {order_code} ha cambiado.'),
    )
    return send_push_to_phone(
        order.customer_phone,
        title_template,
        body_template.format(order_code=order.order_code),
        {
            'type': 'order_status',
            'order_code': order.order_code,
            'status': order.status,
        },
    )


def send_payment_status_push(order):
    title_template, body_template = PAYMENT_MESSAGES.get(
        order.payment_status,
        ('Pago actualizado', 'El pago del pedido {order_code} se ha actualizado.'),
    )
    return send_push_to_phone(
        order.customer_phone,
        title_template,
        body_template.format(order_code=order.order_code),
        {
            'type': 'payment_status',
            'order_code': order.order_code,
            'payment_status': order.payment_status,
        },
    )
