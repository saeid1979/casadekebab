from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from restaurant.models import Order


class Command(BaseCommand):
    help = 'Repair blank order codes, subtotal, total and payment amounts after Order.save indentation issue.'

    def handle(self, *args, **options):
        repaired = 0
        used_codes = set(Order.objects.exclude(order_code='').values_list('order_code', flat=True))
        next_num = 1

        def next_code():
            nonlocal next_num
            while f'CDKT-{next_num:06d}' in used_codes:
                next_num += 1
            code = f'CDKT-{next_num:06d}'
            used_codes.add(code)
            next_num += 1
            return code

        with transaction.atomic():
            for order in Order.objects.prefetch_related('items', 'payments').order_by('id'):
                subtotal = Decimal('0.00')
                for item in order.items.all():
                    item_total = item.total
                    if item_total is None:
                        item_total = Decimal(str(item.price_snapshot or '0.00')) * Decimal(str(item.quantity or 0))
                    subtotal += Decimal(str(item_total or '0.00'))

                changed = False
                if not order.order_code:
                    order.order_code = next_code()
                    changed = True

                expected_total = (
                    subtotal
                    + Decimal(str(order.delivery_fee or '0.00'))
                    - Decimal(str(order.discount or '0.00'))
                ).quantize(Decimal('0.01'))

                if order.subtotal != subtotal:
                    order.subtotal = subtotal
                    changed = True
                if order.total != expected_total:
                    order.total = expected_total
                    changed = True

                if changed:
                    order.save(update_fields=['order_code', 'subtotal', 'total', 'updated_at'])
                    repaired += 1

                for payment in order.payments.all():
                    if payment.amount != order.total:
                        payment.amount = order.total
                        payment.save(update_fields=['amount'])

        self.stdout.write(self.style.SUCCESS(f'Repaired {repaired} orders.'))
