from pathlib import Path
from datetime import datetime
import shutil

ROOT = Path(r"D:\Python_project\casadekebab")
MODELS = ROOT / "backend" / "restaurant" / "models.py"
MAIN = ROOT / "frontend" / "src" / "main.jsx"
COMMAND_DIR = ROOT / "backend" / "restaurant" / "management" / "commands"
COMMAND_FILE = COMMAND_DIR / "repair_order_totals.py"

ORDER_METHODS = "\n    class Meta:\n\n        ordering = ['-created_at']\n\n\n\n    def save(self, *args, **kwargs):\n\n        if not self.order_code:\n\n            last_order = (\n\n                Order.objects\n\n                .exclude(order_code='')\n\n                .order_by('-id')\n\n                .first()\n\n            )\n\n\n\n            next_num = 1\n\n\n\n            if last_order and last_order.order_code:\n\n                try:\n\n                    current_num = int(\n\n                        last_order.order_code.split('-')[-1]\n\n                    )\n\n                    next_num = current_num + 1\n\n                except (ValueError, IndexError):\n\n                    next_num = last_order.id + 1\n\n\n\n            while Order.objects.filter(\n\n                order_code=f'CDKT-{next_num:06d}'\n\n            ).exists():\n\n                next_num += 1\n\n\n\n            self.order_code = f'CDKT-{next_num:06d}'\n\n\n\n        self.total = (\n\n            (self.subtotal or Decimal('0.00'))\n\n            + (self.delivery_fee or Decimal('0.00'))\n\n            - (self.discount or Decimal('0.00'))\n\n        )\n\n\n\n        super().save(*args, **kwargs)\n\n\n\n    def __str__(self):\n\n        return self.order_code\n"

REPAIR_COMMAND = "from decimal import Decimal\n\nfrom django.core.management.base import BaseCommand\nfrom django.db import transaction\n\nfrom restaurant.models import Order\n\n\nclass Command(BaseCommand):\n    help = 'Repair blank order codes, subtotal, total and payment amounts after Order.save indentation issue.'\n\n    def handle(self, *args, **options):\n        repaired = 0\n        used_codes = set(Order.objects.exclude(order_code='').values_list('order_code', flat=True))\n        next_num = 1\n\n        def next_code():\n            nonlocal next_num\n            while f'CDKT-{next_num:06d}' in used_codes:\n                next_num += 1\n            code = f'CDKT-{next_num:06d}'\n            used_codes.add(code)\n            next_num += 1\n            return code\n\n        with transaction.atomic():\n            for order in Order.objects.prefetch_related('items', 'payments').order_by('id'):\n                subtotal = Decimal('0.00')\n                for item in order.items.all():\n                    item_total = item.total\n                    if item_total is None:\n                        item_total = Decimal(str(item.price_snapshot or '0.00')) * Decimal(str(item.quantity or 0))\n                    subtotal += Decimal(str(item_total or '0.00'))\n\n                changed = False\n                if not order.order_code:\n                    order.order_code = next_code()\n                    changed = True\n\n                expected_total = (\n                    subtotal\n                    + Decimal(str(order.delivery_fee or '0.00'))\n                    - Decimal(str(order.discount or '0.00'))\n                ).quantize(Decimal('0.01'))\n\n                if order.subtotal != subtotal:\n                    order.subtotal = subtotal\n                    changed = True\n                if order.total != expected_total:\n                    order.total = expected_total\n                    changed = True\n\n                if changed:\n                    order.save(update_fields=['order_code', 'subtotal', 'total', 'updated_at'])\n                    repaired += 1\n\n                for payment in order.payments.all():\n                    if payment.amount != order.total:\n                        payment.amount = order.total\n                        payment.save(update_fields=['amount'])\n\n        self.stdout.write(self.style.SUCCESS(f'Repaired {repaired} orders.'))\n"

def backup(path):
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = path.with_name(f"{path.stem}_before_order_total_receipt_fix_{stamp}{path.suffix}")
    shutil.copy2(path, target)
    return target

def replace_region(text, start_marker, end_marker, replacement, label):
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"Could not find start marker for {label}.")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"Could not find end marker for {label}.")
    return text[:start] + replacement + "\n\n\n\n" + text[end:]

def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"Could not find {label}.")
    return text.replace(old, new, 1)

def main():
    if not MODELS.exists():
        raise FileNotFoundError(f"Missing {MODELS}")
    if not MAIN.exists():
        raise FileNotFoundError(f"Missing {MAIN}")

    saved_models = backup(MODELS)
    saved_main = backup(MAIN)

    try:
        models_text = MODELS.read_text(encoding="utf-8")
        order_start = models_text.find("class Order(models.Model):")
        order_item_start = models_text.find("class OrderItem(models.Model):", order_start)
        if order_start < 0 or order_item_start < 0:
            raise RuntimeError("Could not find Order / OrderItem classes.")

        order_block = models_text[order_start:order_item_start]
        meta_start = order_block.find("    class Meta:")
        if meta_start < 0:
            raise RuntimeError("Could not find Order.Meta.")
        fixed_order_block = order_block[:meta_start] + ORDER_METHODS
        models_text = models_text[:order_start] + fixed_order_block + "\n\n\n" + models_text[order_item_start:]
        MODELS.write_text(models_text, encoding="utf-8")

        main_text = MAIN.read_text(encoding="utf-8")

        old_redirect = """      const orderCode = res.data.order.order_code;
      setCart([]);
      setCheckoutOpen(false);
      window.location.href = `/receipt/${orderCode}`;"""
        new_redirect = """      const orderCode = res.data?.order?.order_code;
      setCart([]);
      setCheckoutOpen(false);
      if (!orderCode) {
        setMessage('Pedido registrado, pero el servidor no devolvió código de ticket. Actualiza pedidos vivos y abre el ticket desde Admin.');
        return;
      }
      window.location.href = `/receipt/${encodeURIComponent(orderCode)}`;"""
        if old_redirect in main_text:
            main_text = main_text.replace(old_redirect, new_redirect, 1)

        old_customer = """      <p><b>Cliente:</b> {order.customer_name || 'Sin nombre'}</p>
      <p><b>Tel:</b> {order.customer_phone}</p>
      <p><b>Tipo:</b> {order.delivery_type === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</p>
      {order.address && <p><b>Dirección:</b> {order.address}</p>}"""
        new_customer = """      <p><b>Cliente:</b> {order.customer_name || (order.delivery_type === 'collection' ? 'Cliente mostrador' : 'Sin nombre')}</p>
      {order.customer_phone && <p><b>Tel:</b> {order.customer_phone}</p>}
      <p><b>Tipo:</b> {order.delivery_type === 'delivery' ? 'Entrega a domicilio' : 'Recoger en tienda'}</p>
      {order.delivery_type === 'delivery' && order.address && <p><b>Dirección de entrega:</b> {order.address}</p>}
      {order.delivery_type === 'collection' && <p><b>Recogida en local:</b> {RESTAURANT_ADDRESS}</p>}"""
        if old_customer in main_text:
            main_text = main_text.replace(old_customer, new_customer, 1)

        old_confirm = """        <p><b>En un máximo de 20 minutos tu pedido llegará a la dirección indicada.</b></p>
        <p>Gracias por pedir tu comida en Casa de Kebab Turco.</p>"""
        new_confirm = """        {order.delivery_type === 'delivery'
          ? <p><b>En un máximo de 20 minutos tu pedido llegará a la dirección indicada.</b></p>
          : <p><b>Tu pedido estará preparado para recoger en el local.</b></p>}
        <p>Gracias por pedir tu comida en Casa de Kebab Turco.</p>"""
        if old_confirm in main_text:
            main_text = main_text.replace(old_confirm, new_confirm, 1)

        MAIN.write_text(main_text, encoding="utf-8")

        COMMAND_DIR.mkdir(parents=True, exist_ok=True)
        (COMMAND_DIR / "__init__.py").write_text("", encoding="utf-8")
        (COMMAND_DIR.parent / "__init__.py").write_text("", encoding="utf-8")
        COMMAND_FILE.write_text(REPAIR_COMMAND, encoding="utf-8")

    except Exception:
        shutil.copy2(saved_models, MODELS)
        shutil.copy2(saved_main, MAIN)
        raise

    print("SUCCESS: Admin collection total and receipt fixes installed.")
    print("No migration is needed.")
    print("Next:")
    print("  cd backend")
    print("  python manage.py check")
    print("  python manage.py repair_order_totals")
    print("  cd ..\\frontend")
    print("  npm run build")

if __name__ == "__main__":
    main()
