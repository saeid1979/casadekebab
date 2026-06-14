package com.casadekebab.smsgateway;

import android.app.*;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;
import android.provider.Settings;
import android.telephony.SmsManager;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class SmsGatewayService extends Service {
    private static final String TAG = "CasaKebabSmsGateway";
    private static final String CHANNEL_ID = "casa_kebab_sms_gateway";
    private volatile boolean running = false;
    private Thread worker;

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, SmsGatewayService.class);
        if (android.os.Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, SmsGatewayService.class));
    }

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(44, buildNotification("SMS Gateway running"));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!running) {
            running = true;
            worker = new Thread(this::loop);
            worker.start();
        }
        return START_STICKY;
    }

    private void loop() {
        while (running) {
            SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE);
            boolean enabled = prefs.getBoolean(MainActivity.KEY_ENABLED, false);
            int interval = prefs.getInt(MainActivity.KEY_INTERVAL, 5);
            if (interval < 3) interval = 3;
            try {
                if (enabled) pollAndSend(prefs);
            } catch (Exception e) {
                saveLast("Error: " + e.getMessage());
                Log.e(TAG, "Loop error", e);
            }
            try { Thread.sleep(interval * 1000L); } catch (InterruptedException ignored) {}
        }
    }

    private void pollAndSend(SharedPreferences prefs) throws Exception {
        String baseUrl = prefs.getString(MainActivity.KEY_BASE_URL, "");
        String token = prefs.getString(MainActivity.KEY_TOKEN, "");
        if (baseUrl.isEmpty() || token.isEmpty()) {
            saveLast("Missing base URL or token");
            return;
        }

        String deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        String response = http("GET", baseUrl + "/sms-gateway/pending/?device_id=" + deviceId, token, null);
        JSONObject obj = new JSONObject(response);
        JSONArray items = obj.optJSONArray("messages");
        if (items == null || items.length() == 0) {
            saveLast("No pending SMS");
            return;
        }

        for (int i = 0; i < items.length(); i++) {
            JSONObject msg = items.getJSONObject(i);
            int id = msg.getInt("id");
            String phone = msg.getString("phone");
            String body = msg.getString("message");
            try {
                sendSms(phone, body);
                mark(baseUrl, token, id, "sent", "");
                saveLast("Sent SMS #" + id + " to " + phone);
            } catch (Exception e) {
                mark(baseUrl, token, id, "failed", e.getMessage());
                saveLast("Failed SMS #" + id + ": " + e.getMessage());
            }
        }
    }

    private void sendSms(String phone, String message) {
        SmsManager sms = SmsManager.getDefault();
        java.util.ArrayList<String> parts = sms.divideMessage(message);
        sms.sendMultipartTextMessage(phone, null, parts, null, null);
    }

    private void mark(String baseUrl, String token, int id, String status, String error) throws Exception {
        JSONObject payload = new JSONObject();
        payload.put("id", id);
        payload.put("status", status);
        payload.put("error", error == null ? "" : error);
        payload.put("device_id", Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID));
        http("POST", baseUrl + "/sms-gateway/mark/", token, payload.toString());
    }

    private String http(String method, String urlStr, String token, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (body != null) {
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = conn.getResponseCode();
        InputStream is = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
        String result = readAll(is);
        if (code < 200 || code >= 300) throw new IOException("HTTP " + code + ": " + result);
        return result;
    }

    private String readAll(InputStream is) throws IOException {
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[2048];
        int n;
        while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    private void saveLast(String s) {
        getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE).edit().putString("last_result", s).apply();
        Log.i(TAG, s);
    }

    private Notification buildNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, android.os.Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Notification.Builder b = android.os.Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        return b.setContentTitle("Casa Kebab SMS Gateway").setContentText(text).setSmallIcon(android.R.drawable.sym_action_email).setContentIntent(pi).setOngoing(true).build();
    }

    private void createChannel() {
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Casa Kebab SMS Gateway", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(ch);
        }
    }

    @Override public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
