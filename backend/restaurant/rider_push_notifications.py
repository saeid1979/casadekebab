import base64
import json
import os
from datetime import timedelta

from django.utils import timezone
from firebase_admin import credentials, get_app, initialize_app, messaging

from .models import RiderPushDevice


def _firebase_app():
    try:
        return get_app()
    except ValueError:
        pass

    raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    raw_base64 = os.getenv("FIREBASE_SERVICE_ACCOUNT_BASE64", "").strip()

    if raw_base64 and not raw_json:
        raw_json = base64.b64decode(raw_base64).decode("utf-8")

    if not raw_json:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON or "
            "FIREBASE_SERVICE_ACCOUNT_BASE64 is missing."
        )

    return initialize_app(
        credentials.Certificate(json.loads(raw_json))
    )


def send_new_order_to_rider(order):
    rider = order.assigned_rider

    if not rider:
        return {"success": False, "sent": 0, "detail": "No assigned rider."}

    devices = list(
        RiderPushDevice.objects.filter(rider=rider, is_active=True)
    )

    if not devices:
        return {
            "success": True,
            "sent": 0,
            "detail": "No active rider push device.",
        }

    app = _firebase_app()
    sent = 0
    failed = 0

    for device in devices:
        try:
            message = messaging.Message(
                token=device.device_token,
                notification=messaging.Notification(
                    title="🛵 Nuevo pedido asignado",
                    body=(
                        f"{order.order_code} · "
                        f"{order.customer_name or 'Cliente'} · "
                        f"{order.total} €"
                    ),
                ),
                data={
                    "type": "new_rider_order",
                    "order_code": str(order.order_code),
                    "customer_name": str(order.customer_name or ""),
                    "total": str(order.total),
                },
                android=messaging.AndroidConfig(
                    priority="high",
                    ttl=timedelta(minutes=15),
                    notification=messaging.AndroidNotification(
                        channel_id="rider_orders",
                        sound="rider_order_alert",
                        color="#8F1D18",
                        visibility="public",
                        vibrate_timings_millis=[
                            0, 350, 180, 350, 180,
                            350, 180, 350, 180, 350,
                        ],
                    ),
                ),
            )

            messaging.send(message, app=app)
            sent += 1
            device.last_error = ""
            device.last_seen_at = timezone.now()
            device.save(
                update_fields=[
                    "last_error",
                    "last_seen_at",
                    "updated_at",
                ]
            )
        except Exception as exc:
            failed += 1
            device.last_error = str(exc)[:1000]
            device.save(update_fields=["last_error", "updated_at"])

    return {
        "success": sent > 0,
        "sent": sent,
        "failed": failed,
        "rider_id": rider.id,
    }
