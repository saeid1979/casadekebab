from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("restaurant", "0014_accounting_receipt_raw_storage"),
    ]

    operations = [
        migrations.CreateModel(
            name="RiderPushDevice",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("device_token", models.TextField(unique=True)),
                (
                    "platform",
                    models.CharField(
                        choices=[("android", "Android"), ("ios", "iOS")],
                        default="android",
                        max_length=20,
                    ),
                ),
                ("app_version", models.CharField(blank=True, default="", max_length=40)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("last_seen_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_error", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "rider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_devices",
                        to="restaurant.rider",
                    ),
                ),
            ],
            options={"ordering": ["-last_seen_at", "-created_at"]},
        ),
        migrations.AddIndex(
            model_name="riderpushdevice",
            index=models.Index(
                fields=["rider", "is_active"],
                name="restaurant__rider_i_idx",
            ),
        ),
    ]
