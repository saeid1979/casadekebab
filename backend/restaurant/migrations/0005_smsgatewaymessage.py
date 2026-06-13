from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('restaurant', '0004_order_route_distance_km_order_route_duration_min_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SmsGatewayMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone', models.CharField(max_length=30)),
                ('message', models.TextField()),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('sent', 'Sent'), ('failed', 'Failed')], db_index=True, default='pending', max_length=20)),
                ('device_id', models.CharField(blank=True, default='', max_length=160)),
                ('error', models.TextField(blank=True, default='')),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'ordering': ['created_at']},
        ),
    ]
