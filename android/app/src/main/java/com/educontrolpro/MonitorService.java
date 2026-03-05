package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.app.NotificationCompat;
import com.google.firebase.firestore.FirebaseFirestore;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId; 
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String KEY_DEVICE_ID = "assigned_device_id"; // El mismo que usa tu lógica de QR
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; 
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    private boolean shieldMode = false;
    private List<String> listaBlancaSistema = Arrays.asList(
        "com.android.packageinstaller",
        "com.google.android.packageinstaller",
        "com.educontrolpro"
    );

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(1, getNotification());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(CHANNEL_ID, "Monitoreo Educativo", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro Activo")
                .setContentText("Protección de dispositivo activa.")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        // 1. LEER EL ID QUE PASÓ EL QR
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        deviceDocId = prefs.getString(KEY_DEVICE_ID, null);

        if (deviceDocId != null) {
            Log.d("EDU_Monitor", "Servicio iniciado para: " + deviceDocId);
            iniciarListeners(deviceDocId);
        } else {
            Log.e("EDU_Monitor", "No hay ID vinculado. Esperando QR...");
        }
    }

    private void iniciarListeners(String docId) {
        // Listener Individual (Colección: dispositivos)
        db.collection("dispositivos").document(docId).addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                Boolean admin = snapshot.getBoolean("admin_mode_enable");
                Boolean shield = snapshot.getBoolean("shieldMode");
                
                // Actualizar estados locales
                saveUnlockState(admin != null && admin);
                this.shieldMode = (shield != null && shield);

                // Bloquear si el blindaje se activa o si no es modo admin
                if (this.shieldMode || (admin != null && !admin)) {
                    dispararBloqueo();
                }
            }
        });

        // Listener Global para PIN y Emergencia
        db.collection("system_config").document("security").addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                String pin = snapshot.getString("master_pin");
                if (pin != null) saveMasterPin(pin);

                Boolean globalLock = snapshot.getBoolean("global_lock_enabled");
                if (globalLock != null && globalLock) {
                    saveUnlockState(false);
                    dispararBloqueo();
                }
            }
        });
    }

    private void saveMasterPin(String pin) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_MASTER_PIN, pin).apply();
    }

    private void saveUnlockState(boolean isUnlocked) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();

        if (listaBlancaSistema.contains(packageName)) return; 

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
        
        // El técnico navega libre SOLO si no hay Blindaje activo
        if (isUnlocked && !shieldMode) return;

        // --- LÓGICA DE BLOQUEO ---
        
        // Bloquear Ajustes o si el Blindaje está activo
        if (packageName.equals("com.android.settings") || packageName.equals("com.google.android.settings") || 
           (shieldMode && !packageName.contains("educontrolpro"))) {
            dispararBloqueo();
            return;
        }

        // Redes Sociales (Ejemplo rápido de bloqueo por nombre de paquete)
        if (packageName.contains("tiktok") || packageName.contains("instagram") || 
            packageName.contains("facebook") || packageName.contains("youtube")) {
            dispararBloqueo();
        }
    }

    private void dispararBloqueo() {
        Intent lockIntent = new Intent(this, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                           Intent.FLAG_ACTIVITY_SINGLE_TOP | 
                           Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(lockIntent);
    }

    @Override
    public void onInterrupt() { }
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           }