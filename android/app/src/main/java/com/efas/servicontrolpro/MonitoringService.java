package com.efas.servicontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;

public class MonitoringService extends Service {
    private FirebaseFirestore db;
    private String deviceId;
    private static final String CHANNEL_ID = "EFAS_MONITORING_CHANNEL";

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 1. Iniciar como servicio de primer plano inmediatamente
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EFAS ServiControlPro")
                .setContentText("Protección escolar activa")
                .setSmallIcon(R.drawable.ic_shield)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        
        startForeground(1, notification);

        // 2. Reportar estado Online a Firestore
        updateStatus("online");

        return START_STICKY;
    }

    private void updateStatus(String status) {
        if (deviceId == null) return;
        Map<String, Object> update = new HashMap<>();
        update.put("status", status);
        update.put("lastActive", com.google.firebase.Timestamp.now());
        
        db.collection("dispositivos").document(deviceId)
            .update(update)
            .addOnFailureListener(e -> {
                // Si el documento no existe (tablet nueva), se podría crear aquí
            });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Servicio de Monitoreo EFAS",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        updateStatus("offline");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
EOFcat <<EOF > android/app/src/main/java/com/efas/servicontrolpro/MonitoringService.java
package com.efas.servicontrolpro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.HashMap;
import java.util.Map;

public class MonitoringService extends Service {
    private FirebaseFirestore db;
    private String deviceId;
    private static final String CHANNEL_ID = "EFAS_MONITORING_CHANNEL";

    @Override
    public void onCreate() {
        super.onCreate();
        db = FirebaseFirestore.getInstance();
        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // 1. Iniciar como servicio de primer plano inmediatamente
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EFAS ServiControlPro")
                .setContentText("Protección escolar activa")
                .setSmallIcon(R.drawable.ic_shield)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        
        startForeground(1, notification);

        // 2. Reportar estado Online a Firestore
        updateStatus("online");

        return START_STICKY;
    }

    private void updateStatus(String status) {
        if (deviceId == null) return;
        Map<String, Object> update = new HashMap<>();
        update.put("status", status);
        update.put("lastActive", com.google.firebase.Timestamp.now());
        
        db.collection("dispositivos").document(deviceId)
            .update(update)
            .addOnFailureListener(e -> {
                // Si el documento no existe (tablet nueva), se podría crear aquí
            });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Servicio de Monitoreo EFAS",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        updateStatus("offline");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
