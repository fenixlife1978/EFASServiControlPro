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
import com.google.firebase.firestore.FieldValue;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MonitorService extends AccessibilityService {

    private FirebaseFirestore db = FirebaseFirestore.getInstance();
    private String deviceDocId;
    private String InstitutoId;
    private String aulaId;
    private String seccion;
    private String alumnoAsignado = "";

    private static final String PREFS_NAME = "AdminPrefs";
    private static final String CAPACITOR_PREFS = "CapacitorStorage";
    private static final String KEY_UNLOCKED = "is_unlocked";
    private static final String KEY_MASTER_PIN = "master_pin";
    private static final String KEY_DEVICE_ID = "deviceId";
    private static final String CHANNEL_ID = "EDU_Service_Channel";

    private boolean shieldMode = false;
    private boolean useBlacklist = false;
    private boolean blockAllBrowsing = false;
    private boolean cortarNavegacion = false;
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
        Log.d("EDU_Monitor", "onCreate: Servicio creado");
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
        Log.d("EDU_Monitor", "onServiceConnected: Leyendo preferencias");

        try {
            SharedPreferences capPrefs = getSharedPreferences(CAPACITOR_PREFS, MODE_PRIVATE);
            deviceDocId = capPrefs.getString("deviceId", null);
            InstitutoId = capPrefs.getString("InstitutoId", null);
            aulaId = capPrefs.getString("aulaId", null);
            seccion = capPrefs.getString("seccion", null);

            if (deviceDocId == null || InstitutoId == null) {
                Log.e("EDU_Monitor", "Faltan datos de identidad");
                return;
            }

            Log.d("EDU_Monitor", "Vinculado a: " + deviceDocId);

            // Listeners
            db.collection("dispositivos").document(deviceDocId).addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error listener dispositivo", e);
                    guardarError("deviceListener", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    Boolean adminEnabled = snapshot.getBoolean("admin_mode_enable");
                    Boolean shield = snapshot.getBoolean("shieldMode");
                    Boolean cortar = snapshot.getBoolean("cortarNavegacion");
                    String nuevoAlumno = snapshot.getString("alumno_asignado");

                    if (nuevoAlumno != null) alumnoAsignado = nuevoAlumno;
                    shieldMode = shield != null && shield;
                    cortarNavegacion = cortar != null && cortar;
                    saveUnlockState(adminEnabled != null && adminEnabled);

                    if (shieldMode || (adminEnabled != null && !adminEnabled)) {
                        dispararBloqueo();
                    }
                }
            });

            db.collection("institutions").document(InstitutoId).addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error listener institución", e);
                    guardarError("institutionListener", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    blockAllBrowsing = snapshot.getBoolean("blockAllBrowsing") != null ? snapshot.getBoolean("blockAllBrowsing") : false;
                    useBlacklist = snapshot.getBoolean("useBlacklist") != null ? snapshot.getBoolean("useBlacklist") : false;
                    listaNegra = (List<String>) snapshot.get("blacklist");
                }
            });

            db.collection("system_config").document("security").addSnapshotListener((snapshot, e) -> {
                if (e != null) {
                    Log.e("EDU_Monitor", "Error listener seguridad", e);
                    guardarError("securityListener", e);
                    return;
                }
                if (snapshot != null && snapshot.exists()) {
                    String pin = snapshot.getString("master_pin");
                    if (pin != null) saveMasterPin(pin);
                }
            });

        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en onServiceConnected", e);
            guardarError("onServiceConnected", e);
        }
    }

    private void guardarError(String lugar, Exception e) {
        if (deviceDocId == null) return;
        Map<String, Object> error = new HashMap<>();
        error.put("deviceId", deviceDocId);
        error.put("lugar", lugar);
        error.put("mensaje", e.getMessage());
        error.put("stacktrace", Log.getStackTraceString(e));
        error.put("timestamp", FieldValue.serverTimestamp());
        db.collection("error_logs").add(error);
    }

    private void saveMasterPin(String pin) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putString(KEY_MASTER_PIN, pin).apply();
    }

    private void saveUnlockState(boolean isUnlocked) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_UNLOCKED, isUnlocked).apply();
    }

    private void enviarLog(String packageName) {
        if (deviceDocId == null) return;
        Map<String, Object> log = new HashMap<>();
        log.put("deviceId", deviceDocId);
        log.put("InstitutoId", InstitutoId);
        log.put("aulaId", aulaId);
        log.put("seccion", seccion);
        log.put("app", packageName);
        log.put("timestamp", FieldValue.serverTimestamp());
        db.collection("activity_logs").add(log);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        try {
            if (event.getPackageName() == null) return;
            String packageName = event.getPackageName().toString();

            if (listaBlancaSistema.contains(packageName)) return;

            if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
                enviarLog(packageName);
            }

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            boolean isUnlocked = prefs.getBoolean(KEY_UNLOCKED, false);

            if (isUnlocked && !shieldMode) return;

            if (packageName.contains("settings")) {
                dispararBloqueo();
                return;
            }

            if (shieldMode && !packageName.contains("educontrolpro")) {
                dispararBloqueo();
                return;
            }

            if ((cortarNavegacion || blockAllBrowsing) && esNavegador(packageName)) {
                dispararBloqueo();
                return;
            }

            List<String> redes = Arrays.asList("tiktok", "instagram", "facebook", "youtube", "twitter", "whatsapp");
            for (String social : redes) {
                if (packageName.toLowerCase().contains(social)) {
                    dispararBloqueo();
                    return;
                }
            }

            if (esNavegador(packageName)) {
                analizarContenido(event.getSource());
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error en onAccessibilityEvent", e);
            guardarError("onAccessibilityEvent", e);
        }
    }

    private boolean esNavegador(String pkg) {
        String p = pkg.toLowerCase();
        return p.contains("chrome") || p.contains("browser") || p.contains("firefox") ||
               p.contains("opera") || p.contains("edge") || p.contains("brave");
    }

    private void analizarContenido(AccessibilityNodeInfo node) {
        if (node == null) return;
        try {
            if (node.getClassName() != null && node.getClassName().toString().contains("EditText")) {
                CharSequence texto = node.getText();
                if (texto != null) {
                    String url = texto.toString();
                    if (url.startsWith("http") || url.contains(".")) {
                        // Reportar URL
                        Map<String, Object> history = new HashMap<>();
                        history.put("deviceId", deviceDocId);
                        history.put("url", url);
                        history.put("timestamp", FieldValue.serverTimestamp());
                        db.collection("web_history").add(history);

                        if (useBlacklist && listaNegra != null) {
                            for (String sitio : listaNegra) {
                                if (url.toLowerCase().contains(sitio.toLowerCase())) {
                                    dispararBloqueo();
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            for (int i = 0; i < node.getChildCount(); i++) {
                analizarContenido(node.getChild(i));
            }
        } catch (Exception e) {
            Log.e("EDU_Monitor", "Error analizando contenido", e);
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