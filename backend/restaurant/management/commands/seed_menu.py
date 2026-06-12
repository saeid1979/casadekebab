from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from restaurant.models import Category, MenuItem, MenuOptionGroup, MenuOption, RestaurantSettings, Coupon


CATEGORIES = [
    (1, "OFERTA COMBO", "Combo Offers"),
    (2, "MENÚS", "Menus"),
    (3, "DONER KEBAB", "Doner Kebab"),
    (4, "DURUM", "Durum"),
    (5, "LAHMACUN", "Lahmacun"),
    (6, "PLATO KEBAB", "Kebab Plate"),
    (7, "HAMBURGUESA", "Burger"),
    (8, "POLLO BROASTER", "Broaster Chicken"),
    (9, "RACIONES", "Sides"),
    (10, "COMIDA HINDÚ", "Indian Food"),
    (11, "BEBIDAS", "Drinks"),
]

MENU = {
    "OFERTA COMBO": [
        ("Combo 1", "2 kebabs, 4 alitas o 2 muslos, patatas y 2 bebidas.", "11.95"),
        ("Combo 2", "2 durum, 4 alitas o 2 muslos, patatas y 2 bebidas.", "12.95"),
        ("Combo 3", "3 kebabs, 6 alitas o 3 muslos, 2 patatas y bebida 2L.", "16.95"),
        ("Combo 4", "3 durum, 6 alitas o 3 muslos, 2 patatas y bebida 2L.", "17.95"),
        ("Combo 5", "2 kebabs, 2 durum, 6 alitas o 3 muslos, 2 patatas y bebida 2L.", "19.95"),
        ("Combo 6", "3 kebabs, 3 durum, 6 alitas o 3 muslos, 2 patatas y 2 bebidas 2L.", "35.95"),
    ],
    "MENÚS": [
        ("Menú Doner Kebab", "Kebab con patatas y bebida.", "7.50"),
        ("Menú Durum", "Durum con patatas y bebida.", "8.00"),
        ("Menú Lahmacun", "Lahmacun con patatas y bebida.", "8.50"),
        ("Menú Plato Kebab", "Plato kebab con patatas y bebida.", "9.50"),
    ],
    "DONER KEBAB": [
        ("Kebab Ternera", "Pan kebab con carne de ternera, ensalada y salsa.", "4.95"),
        ("Kebab Pollo", "Pan kebab con pollo, ensalada y salsa.", "4.95"),
        ("Kebab Mixto", "Pan kebab con carne mixta, ensalada y salsa.", "5.25"),
        ("Kebab Solo Carne", "Pan kebab con carne y salsa, sin ensalada.", "5.95"),
    ],
    "DURUM": [
        ("Durum Ternera", "Durum de ternera con ensalada y salsa.", "5.50"),
        ("Durum Pollo", "Durum de pollo con ensalada y salsa.", "5.50"),
        ("Durum Mixto", "Durum mixto con ensalada y salsa.", "5.95"),
        ("Durum Solo Carne", "Durum con carne y salsa, sin ensalada.", "6.50"),
    ],
    "LAHMACUN": [
        ("Lahmacun Ternera", "Pizza turca con ternera, ensalada y salsa.", "6.50"),
        ("Lahmacun Pollo", "Pizza turca con pollo, ensalada y salsa.", "6.50"),
        ("Lahmacun Mixto", "Pizza turca con carne mixta, ensalada y salsa.", "6.95"),
    ],
    "PLATO KEBAB": [
        ("Plato Kebab Ternera", "Carne de ternera con ensalada, patatas y salsa.", "8.50"),
        ("Plato Kebab Pollo", "Pollo con ensalada, patatas y salsa.", "8.50"),
        ("Plato Kebab Mixto", "Carne mixta con ensalada, patatas y salsa.", "8.95"),
        ("Plato Falafel", "Falafel con ensalada, patatas y salsa.", "7.50"),
    ],
    "HAMBURGUESA": [
        ("Hamburguesa Clásica", "Hamburguesa con lechuga, tomate, queso y salsa.", "5.50"),
        ("Hamburguesa de Pollo", "Hamburguesa de pollo con lechuga, tomate, queso y salsa.", "5.50"),
        ("Menú Hamburguesa", "Hamburguesa con patatas y bebida.", "7.50"),
    ],
    "POLLO BROASTER": [
        ("4 Alitas", "4 alitas de pollo broaster.", "4.95"),
        ("6 Alitas", "6 alitas de pollo broaster.", "6.95"),
        ("9 Alitas", "9 alitas de pollo broaster.", "9.95"),
        ("2 Muslos", "2 muslos de pollo broaster.", "5.95"),
        ("4 Muslos", "4 muslos de pollo broaster.", "9.95"),
    ],
    "RACIONES": [
        ("Patatas Fritas", "Ración de patatas fritas.", "2.50"),
        ("Patatas Bravas", "Patatas con salsa brava.", "3.50"),
        ("Nuggets", "Nuggets de pollo.", "4.50"),
        ("Falafel", "Ración de falafel.", "4.50"),
        ("Aros de Cebolla", "Ración de aros de cebolla.", "3.95"),
    ],
    "COMIDA HINDÚ": [
        ("Pollo Tikka Masala", "Pollo troceado cocinado con nata, almendras y yogur, ligeramente picante.", "9.95"),
        ("Pollo al Curry", "Pollo cocinado en salsa curry suave.", "9.95"),
        ("Pollo Korma", "Pollo troceado y cocinado en nata y anacardos con coco muy suave.", "9.95"),
        ("Butter Chicken", "Pollo cocinado en horno de arcilla con mantequilla, almendras y nata.", "9.95"),
        ("Pollo Tikka", "Pollo marinado con especias y cocinado al horno.", "9.95"),
        ("Pollo Bhuna", "Pollo cocinado con cebolla, tomate y especias suaves.", "9.95"),
    ],
    "BEBIDAS": [
        ("Coca-Cola", "Lata 330ml.", "1.80"),
        ("Fanta Naranja", "Lata 330ml.", "1.80"),
        ("Fanta Limón", "Lata 330ml.", "1.80"),
        ("Agua", "Botella de agua.", "1.20"),
        ("Coca-Cola 2L", "Botella 2 litros.", "3.50"),
    ],
}

SAUCES = [("Salsa blanca", "0.00"), ("Salsa roja", "0.00"), ("Salsa picante", "0.00"), ("Sin salsa", "0.00")]
SALAD = [("Con ensalada", "0.00"), ("Sin ensalada", "0.00")]
MEAT = [("Ternera", "0.00"), ("Pollo", "0.00"), ("Mixto", "0.50")]
DRINKS = [("Coca-Cola", "0.00"), ("Fanta Naranja", "0.00"), ("Fanta Limón", "0.00"), ("Agua", "0.00")]
SPICE = [("Suave", "0.00"), ("Medio", "0.00"), ("Picante", "0.00")]


class Command(BaseCommand):
    help = "Create Casa de Kebab Turco starter menu, categories and common options."

    def handle(self, *args, **options):
        created_categories = {}
        for order, name_es, name_en in CATEGORIES:
            cat, _ = Category.objects.update_or_create(
                slug=slugify(name_es),
                defaults={"name_es": name_es, "name_en": name_en, "sort_order": order, "is_active": True},
            )
            created_categories[name_es] = cat

        total_items = 0
        for cat_name, items in MENU.items():
            cat = created_categories[cat_name]
            for index, (name, desc, price) in enumerate(items, start=1):
                item, _ = MenuItem.objects.update_or_create(
                    category=cat,
                    name_es=name,
                    defaults={
                        "name_en": name,
                        "description_es": desc,
                        "description_en": desc,
                        "price": Decimal(price),
                        "is_active": True,
                        "is_available": True,
                        "sort_order": index,
                    },
                )
                item.option_groups.all().delete()
                self.add_options(item, cat_name)
                total_items += 1

        settings_obj = RestaurantSettings.current()
        settings_obj.opening_hours = "12:00 - 01:00"
        settings_obj.is_open = True
        settings_obj.save(update_fields=["opening_hours", "is_open"])

        self.stdout.write(self.style.SUCCESS(f"Seed completed: {len(CATEGORIES)} categories, {total_items} menu items. Opening hours updated: 12:00 - 01:00"))

    def create_group(self, item, title, choices, required=False, min_choices=0, max_choices=1, sort_order=0):
        group = MenuOptionGroup.objects.create(
            menu_item=item,
            title_es=title,
            title_en=title,
            required=required,
            min_choices=min_choices,
            max_choices=max_choices,
            sort_order=sort_order,
        )
        for i, (name, extra) in enumerate(choices, start=1):
            MenuOption.objects.create(
                group=group,
                name_es=name,
                name_en=name,
                extra_price=Decimal(extra),
                is_active=True,
                sort_order=i,
            )

    def add_options(self, item, cat_name):
        # Food option groups. Oferta Combo and Menús must keep the normal food selections.
        if cat_name in ["OFERTA COMBO", "MENÚS", "DONER KEBAB", "DURUM", "LAHMACUN", "PLATO KEBAB"]:
            self.create_group(item, "Carne", MEAT, True, 1, 1, 1)
            self.create_group(item, "Ensalada", SALAD, False, 0, 1, 2)
            self.create_group(item, "Salsa", SAUCES, False, 0, 2, 3)

        # Drinks are optional, but when the customer chooses a drink, only one can be selected.
        if cat_name in ["OFERTA COMBO", "MENÚS"]:
            self.create_group(item, "Bebida", DRINKS, False, 0, 1, 4)

        if cat_name == "COMIDA HINDÚ":
            self.create_group(item, "Nivel de picante", SPICE, False, 0, 1, 1)
        if cat_name == "BEBIDAS":
            return
