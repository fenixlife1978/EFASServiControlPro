package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
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
    
    // VARIABLES DE IDENTIDAD (Exactas al JSON del QR)
    private String deviceDocId;      // mapeado de "deviceId"
    private String InstitutoId;      // mapeado de "InstitutoId"
    private String aulaId;           // mapeado de "aulaId"
    private String seccion;          // mapeado de "seccion"
    private String nombreInstituto;  // mapeado de "nombreInstituto"
    
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage"; 
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin"; 
    private static final String CHANNEL_ID = "EDU_Service_Channel";

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
                .setContentText("Protección activa en el Instituto")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .build();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        
        // LEER DESDE EL ALMACENAMIENTO DE CAPACITOR
        SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
        
        // Mapeo exacto según el JSON del QR
        deviceDocId     = capPrefs.getString("deviceId", null);
        InstitutoId     = capPrefs.getString("InstitutoId", null);
        aulaId          = capPrefs.getString("aulaId", null);
        seccion         = capPrefs.getString("seccion", null);
        nombreInstituto = capPrefs.getString("nombreInstituto", null);

        if (deviceDocId != null && InstitutoId != null) {
            Log.d("EDU_Monitor", "VINCULACIÓN EXITOSA:");
            Log.d("EDU_Monitor", "Inst: " + nombreInstituto + " (" + InstitutoId + ")");
            Log.d("EDU_Monitor", "Aula/Secc: " + aulaId + " " + seccion);
            
            iniciarListeners(deviceDocId, InstitutoId);
        } else {
            Log.e("EDU_Monitor", "ERROR: Faltan datos críticos de identidad.");
        }
    }

    private void iniciarListeners(String docId, String instId) {
        // Escuchar cambios en el dispositivo específico
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

        // Escuchar reglas de la institución usando InstitutoId (Ej: P1-001)
        db.collection("institutions").document(instId).addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                useBlacklist = snapshot.getBoolean("useBlacklist") != null ? snapshot.getBoolean("useBlacklist") : false;
                blockAllBrowsing = snapshot.getBoolean("blockAllBrowsing") != null ? snapshot.getBoolean("blockAllBrowsing") : false;
                listaNegra = (List<String>) snapshot.get("blacklist");
                Log.d("EDU_Monitor", "Reglas de bloqueo actualizadas para " + instId);
            }
        });

        // Pin Maestro
        db.collection("system_config").document("security").addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                String pin = snapshot.getString("master_pin");
                if (pin != null) saveMasterPin(pin);
            }
        });
    }

    private void enviarLog(String packageName) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("deviceId", deviceDocId);
        log.put("InstitutoId", InstitutoId);
        log.put("aulaId", aulaId);
        log.put("seccion", seccion);
        log.put("app", packageName);
        log.put("timestamp", System.currentTimeMillis());
        
        // Se guarda en una colección global de logs
        db.collection("activity_logs").add(log);
    }

    // --- EL RESTO DE MÉTODOS (onAccessibilityEvent, analizarContenido, etc) QUEDAN IGUAL ---
    
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
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            enviarLog(packageName);
        }
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);
        if (isUnlocked && !shieldMode) return;
        if (packageName.equals("com.android.settings") || packageName.equals("com.google.android.settings") || 
           (shieldMode && !packageName.contains("educontrolpro"))) {
            dispararBloqueo();
            return;
        }
        if (blockAllBrowsing && esNavegador(packageName)) {
            dispararBloqueo();
            return;
        }
        List<String> redes = Arrays.asList("tiktok", "instagram", "facebook", "youtube", "twitter");
        for (String social : redes) {
            if (packageName.toLowerCase().contains(social)) {
                dispararBloqueo();
                return;
            }
        }
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

    @Override
    public void onInterrupt() { }
}