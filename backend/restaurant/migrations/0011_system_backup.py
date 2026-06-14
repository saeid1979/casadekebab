# Generated for Casa de Kebab Turco backup management

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0010_partner_accounting'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemBackup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('backup_type', models.CharField(choices=[('database', 'Base de datos JSON'), ('configuration', 'Configuración'), ('media', 'Archivos Media')], db_index=True, max_length=30)),
                ('status', models.CharField(choices=[('pending', 'Pendiente'), ('running', 'En proceso'), ('completed', 'Completado'), ('failed', 'Fallido')], db_index=True, default='pending', max_length=20)),
                ('file_name', models.CharField(blank=True, default='', max_length=255)),
                ('file_path', models.CharField(blank=True, default='', max_length=600)),
                ('file_size', models.BigIntegerField(default=0)),
                ('checksum_sha256', models.CharField(blank=True, default='', max_length=64)),
                ('created_by_username', models.CharField(blank=True, default='', max_length=150)),
                ('error_message', models.TextField(blank=True, default='')),
                ('is_protected', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
