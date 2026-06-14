package com.casadekebab.smsgateway;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.*;
import android.graphics.Color;
import android.text.InputType;

public class MainActivity extends Activity {
    public static final String PREFS = "CasaKebabSmsGatewayPrefs";
    public static final String KEY_BASE_URL = "base_url";
    public static final String KEY_TOKEN = "gateway_token";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_INTERVAL = "poll_interval_seconds";

    private EditText baseUrlInput;
    private EditText tokenInput;
    private EditText intervalInput;
    private TextView statusText;
    private final int REQ_PERMS = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 38, 32, 24);
        root.setGravity(Gravity.TOP);
        root.setBackgroundColor(Color.rgb(255, 250, 244));

        TextView title = new TextView(this);
        title.setText("Casa de Kebab Turco\\nSMS Gateway");
        title.setTextSize(24);
        title.setTextColor(Color.rgb(120, 43, 0));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 26);
        root.addView(title);

        TextView info = new TextView(this);
        info.setText("This phone sends OTP SMS from your SIM card. Keep the phone on, charged, connected to internet, and allow SMS permission.");
        info.setTextSize(14);
        info.setTextColor(Color.DKGRAY);
        info.setPadding(0, 0, 0, 20);
        root.addView(info);

        baseUrlInput = new EditText(this);
        baseUrlInput.setHint("Backend API base URL");
        baseUrlInput.setSingleLine(true);
        baseUrlInput.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        baseUrlInput.setText(prefs.getString(KEY_BASE_URL, "https://casadekebab-backend.onrender.com/api"));
        root.addView(baseUrlInput);

        tokenInput = new EditText(this);
        tokenInput.setHint("Gateway token");
        tokenInput.setSingleLine(true);
        tokenInput.setText(prefs.getString(KEY_TOKEN, ""));
        root.addView(tokenInput);

        intervalInput = new EditText(this);
        intervalInput.setHint("Polling interval seconds");
        intervalInput.setInputType(InputType.TYPE_CLASS_NUMBER);
        intervalInput.setSingleLine(true);
        intervalInput.setText(String.valueOf(prefs.getInt(KEY_INTERVAL, 5)));
        root.addView(intervalInput);

        Button saveBtn = new Button(this);
        saveBtn.setText("Save Settings");
        root.addView(saveBtn);

        Button startBtn = new Button(this);
        startBtn.setText("Start Gateway");
        root.addView(startBtn);

        Button stopBtn = new Button(this);
        stopBtn.setText("Stop Gateway");
        root.addView(stopBtn);

        Button batteryBtn = new Button(this);
        batteryBtn.setText("Open Battery Settings");
        root.addView(batteryBtn);

        statusText = new TextView(this);
        statusText.setTextSize(15);
        statusText.setPadding(0, 24, 0, 0);
        root.addView(statusText);
        setContentView(root);

        saveBtn.setOnClickListener(v -> saveSettings(false));
        startBtn.setOnClickListener(v -> {
            saveSettings(true);
            requestPermissionsIfNeeded();
            SmsGatewayService.start(this);
            updateStatus();
        });
        stopBtn.setOnClickListener(v -> {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, false).apply();
            SmsGatewayService.stop(this);
            updateStatus();
        });
        batteryBtn.setOnClickListener(v -> {
            try { startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); }
            catch (Exception e) { Toast.makeText(this, "Could not open settings", Toast.LENGTH_SHORT).show(); }
        });

        requestPermissionsIfNeeded();
        updateStatus();
    }

    private void saveSettings(boolean enabled) {
        int interval = 5;
        try { interval = Integer.parseInt(intervalInput.getText().toString().trim()); } catch (Exception ignored) {}
        if (interval < 3) interval = 3;
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_BASE_URL, baseUrlInput.getText().toString().trim().replaceAll("/+$", ""))
                .putString(KEY_TOKEN, tokenInput.getText().toString().trim())
                .putInt(KEY_INTERVAL, interval)
                .putBoolean(KEY_ENABLED, enabled)
                .apply();
        Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
        updateStatus();
    }

    private void updateStatus() {
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean enabled = prefs.getBoolean(KEY_ENABLED, false);
        statusText.setText("Status: " + (enabled ? "RUNNING" : "STOPPED") +
                "\\nDevice ID: " + Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID) +
                "\\nLast result: " + prefs.getString("last_result", "-"));
    }

    private void requestPermissionsIfNeeded() {
        if (android.os.Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{ Manifest.permission.SEND_SMS, Manifest.permission.POST_NOTIFICATIONS }, REQ_PERMS);
        }
    }
}
