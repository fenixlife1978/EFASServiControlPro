package com.educontrolpro;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.core.app.NotificationCompat;
import com.google.firebase.firestore.FirebaseFirestore;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String androidId;
    
    // Constantes de seguridad
    private static final String PREFS_NAME = "AdminPrefs";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    // Variables de configuración dinámica
    private boolean enviarAFirebase = true;
    private boolean enviarAServidor = false;
    private String urlServidor = "";

    // Nuevos interruptores de seguridad profesional
    private boolean useBlacklist = false;
    private boolean useWhitelist = false;
    private boolean blockAllBrowsing = false;
    private boolean shieldMode = false;
    private List<String> listaNegra = new ArrayList<>();
    private List<String> listaBlanca = Arrays.asList("com.google.android.apps.classroom", "com.android.settings", "com.educontrolpro");

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
            manager.createNotificationChannel(serviceChannel);
        }
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("EDUControlPro Activo")
                .setContentText("El dispositivo está bajo supervisión educativa.")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .build();
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);

        // Listener de Admin Mode
        db.collection("devices").document(androidId).addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                boolean remoteUnlock = snapshot.getBoolean("admin_mode_enabled") != null ? snapshot.getBoolean("admin_mode_enabled") : false;
                saveUnlockState(remoteUnlock);
            }
        });

        // Listener de Configuraciones Generales
        db.collection("config").document("app_settings").addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                enviarAFirebase = snapshot.getBoolean("firebase_enabled") != null ? snapshot.getBoolean("firebase_enabled") : true;
                enviarAServidor = snapshot.getBoolean("server_enabled") != null ? snapshot.getBoolean("server_enabled") : false;
                urlServidor = snapshot.getString("server_url") != null ? snapshot.getString("server_url") : "";
            }
        });

        // Listener de Reglas de Institución (Blacklist, Whitelist, Shield)
        db.collection("institutions").document("P2-001").addSnapshotListener((snapshot, e) -> {
            if (snapshot != null && snapshot.exists()) {
                useBlacklist = snapshot.getBoolean("useBlacklist") != null ? snapshot.getBoolean("useBlacklist") : false;
                useWhitelist = snapshot.getBoolean("useWhitelist") != null ? snapshot.getBoolean("useWhitelist") : false;
                blockAllBrowsing = snapshot.getBoolean("blockAllBrowsing") != null ? snapshot.getBoolean("blockAllBrowsing") : false;
                shieldMode = snapshot.getBoolean("shieldMode") != null ? snapshot.getBoolean("shieldMode") : false;
                listaNegra = (List<String>) snapshot.get("blacklist");
            }
        });

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED | AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS;
        setServiceInfo(info);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);

        if (event.getPackageName() == null) return;
        String packageName = event.getPackageName().toString();
        
        // Log de actividad (Funcionalidad original)
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            enviarLog(packageName);
        }

        if (isUnlocked) return;

        // 1. MODO BLINDAJE (Shield Mode)
        if (shieldMode && !packageName.equals("com.android.settings")) {
            dispararBloqueo();
            return;
        }

        // 2. LISTA BLANCA
        if (useWhitelist && !listaBlanca.contains(packageName) && !packageName.contains("educontrolpro")) {
            dispararBloqueo();
            return;
        }

        // 3. BLOQUEO ABSOLUTO DE NAVEGACIÓN
        if (blockAllBrowsing && esNavegador(packageName)) {
            dispararBloqueo();
            return;
        }

        // 4. FILTRO UNIVERSAL Y LISTA NEGRA
        if (esNavegador(packageName)) {
            analizarContenido(event.getSource());
        }

        // 5. BLOQUEOS ESTÁTICOS ORIGINALES
        if (packageName.equals("com.android.settings") || packageName.equals("com.google.android.packageinstaller") ||
            packageName.contains("tiktok") || packageName.contains("instagram") || 
            packageName.contains("facebook") || packageName.contains("youtube")) {
            dispararBloqueo();
        }
    }

    private boolean esNavegador(String pkg) {
        return pkg.contains("chrome") || pkg.contains("browser") || pkg.contains("firefox") || pkg.contains("opera");
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;
        if (node.getClassName() != null && node.getClassName().equals("android.widget.EditText")) {
            CharSequence texto = node.getText();
            if (texto != null) {
                String t = texto.toString().toLowerCase();
                // Verificación de lista negra dinámica
                if (useBlacklist && listaNegra != null) {
                    for (String sitio : listaNegra) {
                        if (t.contains(sitio.toLowerCase())) dispararBloqueo();
                    }
                }
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) analizarContenido(node.getChild(i));
    }

    private void dispararBloqueo() {
        Intent lockIntent = new Intent(this, LockActivity.class);
        lockIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(lockIntent);
    }

    private void saveUnlockState(boolean isUnlocked) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
    }

    private void enviarLog(String packageName) {
        Map<String, Object> log = new HashMap<>();
        log.put("app", packageName);
        log.put("timestamp", System.currentTimeMillis());
        if (enviarAFirebase) db.collection("activity_logs").add(log);
        if (enviarAServidor && !urlServidor.isEmpty()) enviarAServidorPropio(packageName, urlServidor);
    }

    private void enviarAServidorPropio(String packageName, String url) {
        new Thread(() -> {
            try {
                URL endpoint = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) endpoint.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                String jsonInputString = "{\"app\": \"" + packageName + "\", \"timestamp\": " + System.currentTimeMillis() + "}";
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(jsonInputString.getBytes("utf-8"));
                }
                conn.getResponseCode();
            } catch (Exception e) {
                Log.e("EDU_Monitor", "Error: " + e.getMessage());
            }
        }).start();
    }

    @Override
    public void onInterrupt() { Log.e("EDU_Monitor", "Servicio interrumpido"); }
}