from django.db import migrations, models


def ensure_sms_columns(apps, schema_editor):
    table = 'restaurant_smsgatewaymessage'
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        existing = {c.name for c in connection.introspection.get_table_description(cursor, table)}

    SmsGatewayMessage = apps.get_model('restaurant', 'SmsGatewayMessage')

    if 'kind' not in existing:
        field = models.CharField(max_length=20, default='otp')
        field.set_attributes_from_name('kind')
        schema_editor.add_field(SmsGatewayMessage, field)

    if 'gateway_phone' not in existing:
        field = models.CharField(max_length=30, default='617664661')
        field.set_attributes_from_name('gateway_phone')
        schema_editor.add_field(SmsGatewayMessage, field)


class Migration(migrations.Migration):
    dependencies = [
        ('restaurant', '0005_smsgatewaymessage'),
    ]

    operations = [
        migrations.RunPython(ensure_sms_columns, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='smsgatewaymessage',
                    name='kind',
                    field=models.CharField(
                        choices=[('otp', 'OTP'), ('order', 'Order')],
                        default='otp',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='smsgatewaymessage',
                    name='gateway_phone',
                    field=models.CharField(default='617664661', max_length=30),
                ),
            ],
        ),
    ]
