package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import androidx.core.app.NotificationCompat;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FieldValue;
import java.util.HashMap;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db;
    private String deviceDocId;
    private Handler heartbeatHandler = new Handler(Looper.getMainLooper());
    private Runnable heartbeatRunnable;
    private static final long HEARTBEAT_INTERVAL = 30000; // 30 segundos

    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d("EDU_Monitor", "✅ onCreate: Servicio creado");

        try {
            db = FirebaseFirestore.getInstance();
            SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            deviceDocId = capPrefs.getString("deviceId", null);

            // Log de inicio en Firestore
            Map<String, Object> bootLog = new HashMap<>();
            bootLog.put("evento", "onCreate");
            bootLog.put("deviceId", deviceDocId);
            bootLog.put("timestamp", FieldValue.serverTimestamp());
            if (db != null && deviceDocId != null) {
                db.collection("service_logs").add(bootLog);
            }

            createNotificationChannel();
            startForeground(1, getNotification());

        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en onCreate", e);
        }
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        Log.d("EDU_Monitor", "✅ onServiceConnected: Conectado");

        if (deviceDocId != null) {
            iniciarHeartbeat();
            // Reportar estado inicial online
            Map<String, Object> estado = new HashMap<>();
            estado.put("online", true);
            estado.put("ultimoAcceso", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId)
                .update(estado)
                .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error actualizando online", e));
        }
    }

    private void iniciarHeartbeat() {
        heartbeatRunnable = new Runnable() {
            @Override
            public void run() {
                if (deviceDocId != null && db != null) {
                    Map<String, Object> heartbeat = new HashMap<>();
                    heartbeat.put("online", true);
                    heartbeat.put("ultimoAcceso", FieldValue.serverTimestamp());
                    db.collection("dispositivos").document(deviceDocId)
                        .update(heartbeat)
                        .addOnFailureListener(e -> Log.e("EDU_Monitor", "Error en heartbeat", e));
                }
                heartbeatHandler.postDelayed(this, HEARTBEAT_INTERVAL);
            }
        };
        heartbeatHandler.post(heartbeatRunnable);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Por ahora solo logueamos que recibimos eventos
        if (event.getPackageName() != null) {
            Log.d("EDU_Monitor", "Evento: " + event.getPackageName());
        }
    }

    @Override
    public void onInterrupt() {
        Log.d("EDU_Monitor", "Servicio interrumpido");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (heartbeatHandler != null && heartbeatRunnable != null) {
            heartbeatHandler.removeCallbacks(heartbeatRunnable);
        }
        // Marcar offline
        if (deviceDocId != null && db != null) {
            Map<String, Object> offline = new HashMap<>();
            offline.put("online", false);
            offline.put("ultimoAcceso", FieldValue.serverTimestamp());
            db.collection("dispositivos").document(deviceDocId).update(offline);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Monitoreo", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro")
                .setContentText("Protección activa")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }
}