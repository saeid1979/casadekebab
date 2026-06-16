# Generated safely for Casa de Kebab Turco accounting attachments.
from django.db import migrations, models
import cloudinary_storage.storage


class Migration(migrations.Migration):

    dependencies = [
        ("restaurant", "0013_customerpushdevice_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="restaurantfinancialentry",
            name="receipt",
            field=models.FileField(
                blank=True,
                null=True,
                storage=cloudinary_storage.storage.RawMediaCloudinaryStorage(),
                upload_to="accounting_receipts/%Y/%m/",
            ),
        ),
    ]
