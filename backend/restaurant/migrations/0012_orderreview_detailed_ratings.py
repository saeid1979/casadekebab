from django.db import migrations, models
from django.core.validators import MinValueValidator


class Migration(migrations.Migration):
    dependencies = [('restaurant', '0011_system_backup')]

    operations = [
        migrations.AddField(model_name='orderreview', name='food_rating', field=models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1)])),
        migrations.AddField(model_name='orderreview', name='packaging_rating', field=models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1)])),
        migrations.AddField(model_name='orderreview', name='delivery_rating', field=models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1)])),
        migrations.AddField(model_name='orderreview', name='rider_rating', field=models.PositiveSmallIntegerField(default=5, validators=[MinValueValidator(1)])),
        migrations.AddField(model_name='orderreview', name='would_recommend', field=models.BooleanField(default=True)),
        migrations.AddField(model_name='orderreview', name='admin_reply', field=models.TextField(blank=True, default='')),
        migrations.AddField(model_name='orderreview', name='is_featured', field=models.BooleanField(default=False)),
    ]
