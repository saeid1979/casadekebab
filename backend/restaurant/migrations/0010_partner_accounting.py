# Generated for Casa de Kebab Turco partner accounting

import django.core.validators
import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models
import django.utils.timezone


def seed_expense_categories(apps, schema_editor):
    ExpenseCategory = apps.get_model('restaurant', 'ExpenseCategory')
    names = [
        'Materias primas', 'Carne y pollo', 'Verduras', 'Bebidas',
        'Pan', 'Embalaje', 'Alquiler', 'Electricidad', 'Agua',
        'Gas', 'Internet y teléfono', 'Sueldos', 'Seguridad Social',
        'Impuestos', 'Mantenimiento', 'Equipamiento de cocina',
        'Publicidad', 'Transporte', 'Seguros', 'Licencias',
        'Limpieza', 'Otros',
    ]
    for index, name in enumerate(names):
        ExpenseCategory.objects.get_or_create(
            name=name,
            defaults={'sort_order': index * 10, 'is_active': True},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0009_rider_password_hash_rider_username'),
    ]

    operations = [
        migrations.CreateModel(
            name='AccountingSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('saeid_share_percent', models.DecimalField(decimal_places=2, default=Decimal('50.00'), max_digits=5, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))])),
                ('ahmed_share_percent', models.DecimalField(decimal_places=2, default=Decimal('50.00'), max_digits=5, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))])),
                ('bbva_initial_balance', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Accounting settings',
                'verbose_name_plural': 'Accounting settings',
            },
        ),
        migrations.CreateModel(
            name='ExpenseCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name_plural': 'Expense categories',
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='RestaurantFinancialEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('entry_type', models.CharField(choices=[('expense', 'Gasto'), ('contribution', 'Aportación a BBVA'), ('settlement', 'Liquidación entre socios')], db_index=True, default='expense', max_length=20)),
                ('title', models.CharField(max_length=180)),
                ('description', models.TextField(blank=True, default='')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('entry_date', models.DateField(db_index=True, default=django.utils.timezone.localdate)),
                ('paid_by', models.CharField(choices=[('saeid', 'Saeid'), ('ahmed', 'Ahmed'), ('bbva', 'Cuenta conjunta BBVA')], db_index=True, default='saeid', max_length=20)),
                ('contribution_from', models.CharField(blank=True, choices=[('saeid', 'Saeid'), ('ahmed', 'Ahmed'), ('bbva', 'Cuenta conjunta BBVA')], default='', max_length=20)),
                ('settlement_to', models.CharField(blank=True, choices=[('saeid', 'Saeid'), ('ahmed', 'Ahmed'), ('bbva', 'Cuenta conjunta BBVA')], default='', max_length=20)),
                ('payment_method', models.CharField(choices=[('cash', 'Efectivo'), ('personal_card', 'Tarjeta personal'), ('transfer', 'Transferencia'), ('bbva', 'Cuenta BBVA conjunta'), ('bizum', 'Bizum'), ('other', 'Otro')], default='cash', max_length=30)),
                ('invoice_number', models.CharField(blank=True, default='', max_length=100)),
                ('bank_reference', models.CharField(blank=True, default='', max_length=160)),
                ('receipt', models.FileField(blank=True, null=True, upload_to='accounting_receipts/%Y/%m/')),
                ('status', models.CharField(choices=[('pending', 'Pendiente'), ('approved', 'Aprobado'), ('rejected', 'Rechazado'), ('reimbursed', 'Reembolsado')], db_index=True, default='approved', max_length=20)),
                ('created_by_username', models.CharField(blank=True, default='', max_length=150)),
                ('updated_by_username', models.CharField(blank=True, default='', max_length=150)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entries', to='restaurant.expensecategory')),
            ],
            options={
                'ordering': ['-entry_date', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='restaurantfinancialentry',
            index=models.Index(fields=['entry_type', 'entry_date'], name='restaurant__entry_t_2f323a_idx'),
        ),
        migrations.AddIndex(
            model_name='restaurantfinancialentry',
            index=models.Index(fields=['paid_by', 'entry_date'], name='restaurant__paid_by_415d48_idx'),
        ),
        migrations.RunPython(seed_expense_categories, migrations.RunPython.noop),
    ]
