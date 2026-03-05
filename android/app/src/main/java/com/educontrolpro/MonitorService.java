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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId; 
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String KEY_DEVICE_ID = "assigned_device_id"; 
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; 
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    // Variables de estado y reglas
    private boolean shieldMode = false;
    private boolean useBlacklist = false;
    private boolean blockAllBrowsing = false;
    private List<String> listaNegra = new ArrayList<>();
    
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
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        deviceDocId = prefs.getString(KEY_DEVICE_ID, null);

        if (deviceDocId != null) {
            iniciarListeners(deviceDocId);
        } else {
            Log.e("EDU_Monitor", "Esperando vinculación por QR...");
        }
    }

    private void iniciarListeners(String docId) {
        // 1. Escucha del Dispositivo
        db.collection("dispositivos").document(docId).addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
                Boolean shield = snapshot.getBoolean("shieldMode");
                
                saveUnlockState(adminEnabled != null && adminEnabled);
                this.shieldMode = (shield != null && shield);

                if (this.shieldMode || (adminEnabled != null && !adminEnabled)) {
                    dispararBloqueo();
                }
            }
        });

        // 2. Configuración Global (PIN Maestro)
        db.collection("system_config").document("security").addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                String pin = snapshot.getString("master_pin");
                if (pin != null) saveMasterPin(pin);
            }
        });

        // 3. Reglas de Institución (P2-001) - RECUPERADO
        db.collection("institutions").document("P2-001").addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                useBlacklist = snapshot.getBoolean("useBlacklist") != null ? snapshot.getBoolean("useBlacklist") : false;
                blockAllBrowsing = snapshot.getBoolean("blockAllBrowsing") != null ? snapshot.getBoolean("blockAllBrowsing") : false;
                listaNegra = (List<String>) snapshot.get("blacklist");
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

        // Registro de actividad - RECUPERADO
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            enviarLog(packageName);
        }

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
        
        if (isUnlocked && !shieldMode) return;

        // --- LÓGICA DE BLOQUEO RECUPERADA ---

        // 1. Bloqueo de Ajustes o Shield Mode
        if (packageName.equals("com.android.settings") || packageName.equals("com.google.android.settings") || 
           (shieldMode && !packageName.contains("educontrolpro"))) {
            dispararBloqueo();
            return;
        }

        // 2. Bloqueo de Navegadores Global
        if (blockAllBrowsing && esNavegador(packageName)) {
            dispararBloqueo();
            return;
        }

        // 3. Redes Sociales
        List<String> redes = Arrays.asList("tiktok", "instagram", "facebook", "youtube", "twitter");
        for (String social : redes) {
            if (packageName.toLowerCase().contains(social)) {
                dispararBloqueo();
                return;
            }
        }

        // 4. Análisis de Contenido (Blacklist) - RECUPERADO
        if (esNavegador(packageName)) {
            analizarContenido(event.getSource());
        }
    }

    private boolean esNavegador(String pkg) {
        String p = pkg.toLowerCase();
        return p.contains("chrome") || p.contains("browser") || p.contains("firefox") || p.contains("opera") || p.contains("edge");
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;
        if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
            CharSequence texto = node.getText();
            if (texto != null && useBlacklist && listaNegra != null) {
                String t = texto.toString().toLowerCase();
                for (String sitio : listaNegra) {
                    if (t.contains(sitio.toLowerCase())) {
                        dispararBloqueo();
                        break;
                    }
                }
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            analizarContenido(node.getChild(i));
        }
    }

    private void dispararBloqueo() {
        Intent lockIntent = new Intent(this, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(lockIntent);
    }

    private void enviarLog(String packageName) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("device_id", deviceDocId);
        log.put("app", packageName);
        log.put("timestamp", System.currentTimeMillis());
        db.collection("activity_logs").add(log);
    }

    @Override
    public void onInterrupt() { }
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    